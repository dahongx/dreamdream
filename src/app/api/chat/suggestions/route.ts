import { createHash } from "node:crypto";
import { generateText } from "ai";
import { and, desc, eq, isNull } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { checkRateLimit } from "@/lib/ai/generators/rate-limit";
import { isNimirModelId } from "@/lib/ai/models";
import { modelById, providerOptionsByModelId } from "@/lib/ai/provider";
import { getCurrentUserId } from "@/lib/auth/current-user";
import {
  createSuggestionCache,
  parseSuggestions,
  REPLY_SUGGESTION_INSTRUCTION,
  suggestionHistory,
  suggestionRequestSchema,
} from "@/lib/chat/reply-suggestions";
import { db } from "@/lib/db/client";
import { characters, chatSessions, messages } from "@/lib/db/schema";
import { getSessionActiveMask } from "@/lib/masks/queries";
import { isSessionAccessible } from "@/lib/sessions/access";

export const maxDuration = 60;
export const dynamic = "force-dynamic";
const cache = createSuggestionCache();

function failure(error: string, status: number) {
  return Response.json(
    { error },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(req: NextRequest) {
  let userId: string;
  try {
    userId = await getCurrentUserId();
  } catch {
    return failure("unauthorized", 401);
  }
  const parsed = suggestionRequestSchema.safeParse(
    await req.json().catch(() => null),
  );
  if (!parsed.success) return failure("invalid_request", 400);
  try {
    const [session] = await db
      .select()
      .from(chatSessions)
      .where(
        and(
          eq(chatSessions.id, parsed.data.sessionId),
          eq(chatSessions.userId, userId),
          isNull(chatSessions.discardedAt),
        ),
      )
      .limit(1);
    if (!session?.characterId) return failure("session_unavailable", 404);
    const [character] = await db
      .select({
        id: characters.id,
        name: characters.name,
        visibility: characters.visibility,
        ownerId: characters.ownerId,
      })
      .from(characters)
      .where(eq(characters.id, session.characterId))
      .limit(1);
    if (
      !character ||
      !isSessionAccessible(
        {
          characterId: character.id,
          characterVisibility: character.visibility,
          characterOwnerId: character.ownerId,
        },
        userId,
      )
    ) {
      return failure("session_unavailable", 404);
    }
    const rows = await db
      .select({
        id: messages.id,
        role: messages.role,
        content: messages.content,
      })
      .from(messages)
      .where(
        and(eq(messages.sessionId, session.id), isNull(messages.supersededAt)),
      )
      .orderBy(desc(messages.createdAt), desc(messages.id))
      .limit(12);
    // A pending user turn must finish before we can suggest a reply to it.
    if (
      !rows.length ||
      rows[0].role !== "assistant" ||
      !rows[0].content.trim()
    ) {
      return failure("conversation_busy", 409);
    }
    const mask = await getSessionActiveMask(session.id, userId);
    const configured =
      process.env.NIMIR_REPLY_SUGGESTIONS_MODEL || "gemini-3-flash";
    if (!isNimirModelId(configured)) return failure("model_unavailable", 503);
    const history = suggestionHistory(rows.toReversed());
    if (!history.length) return failure("no_context", 409);
    const prompt = JSON.stringify({
      character: character.name,
      player: mask?.name ?? null,
      history,
    });
    const key = createHash("sha256")
      .update(
        JSON.stringify([
          userId,
          session.id,
          configured,
          REPLY_SUGGESTION_INSTRUCTION,
          mask?.id,
          prompt,
          rows.map((r) => r.id),
        ]),
      )
      .digest("hex");
    const suggestions = await cache.get(key, async () => {
      if (!checkRateLimit(`reply-suggestions:${userId}`).allowed)
        throw new Error("rate_limited");
      const started = Date.now();
      const result = await generateText({
        model: modelById(configured),
        providerOptions: providerOptionsByModelId(configured),
        system: REPLY_SUGGESTION_INSTRUCTION,
        prompt,
        maxOutputTokens: 1200,
        maxRetries: 0,
        abortSignal: AbortSignal.any([req.signal, AbortSignal.timeout(45000)]),
      });
      // Operational usage only: never log conversation text or secret creator prompts.
      console.info(
        "[reply-suggestions]",
        JSON.stringify({
          sessionId: session.id,
          model: configured,
          tokensIn: result.usage.inputTokens,
          tokensOut: result.usage.outputTokens,
          finishReason: result.finishReason,
          latencyMs: Date.now() - started,
        }),
      );
      if (result.finishReason !== "stop")
        throw new Error("incomplete_suggestions");
      return parseSuggestions(result.text);
    });
    return Response.json(
      { suggestions },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "rate_limited")
      return failure("rate_limited", 429);
    console.warn("[reply-suggestions] generation failed");
    return failure("suggestions_unavailable", 502);
  }
}
