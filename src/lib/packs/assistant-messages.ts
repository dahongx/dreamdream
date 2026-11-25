import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  type MessageAttachment,
  type PackAssistantMessage,
  packAssistantMessages,
} from "@/lib/db/schema";

const HISTORY_LIMIT = 40;

export async function getSessionMessages(
  sessionId: string,
): Promise<PackAssistantMessage[]> {
  return db
    .select()
    .from(packAssistantMessages)
    .where(eq(packAssistantMessages.sessionId, sessionId))
    .orderBy(asc(packAssistantMessages.createdAt))
    .limit(HISTORY_LIMIT);
}

export async function appendSessionTurn(
  sessionId: string,
  userText: string,
  assistantText: string,
  userAttachments?: MessageAttachment[] | null,
): Promise<void> {
  await db.insert(packAssistantMessages).values([
    {
      sessionId,
      role: "user",
      content: userText,
      attachments: userAttachments ?? null,
    },
    { sessionId, role: "assistant", content: assistantText, attachments: null },
  ]);
}

export async function clearSessionMessages(sessionId: string): Promise<void> {
  await db
    .delete(packAssistantMessages)
    .where(eq(packAssistantMessages.sessionId, sessionId));
}
