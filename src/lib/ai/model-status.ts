import { gte, lt, sql } from "drizzle-orm";
import { NIMIR_VISIBLE_MODELS, type NimirModelId } from "@/lib/ai/models";
import { db } from "@/lib/db/client";
import { modelHealthStatus, modelRequestEvents } from "@/lib/db/schema";

export const MODEL_STATUS_WINDOW_MINUTES = 30;
const MIN_SAMPLE_COUNT = 1;
const INTERRUPTED_SUCCESS_RATE = 50;
const CONGESTED_SUCCESS_RATE = 90;
const CONGESTED_TTFT_MS = 15_000;
const EVENT_RETENTION_HOURS = 24;

export type ModelStabilityStatus =
  | "smooth"
  | "congested"
  | "interrupted"
  | "unknown";

export interface ModelStatusSnapshot {
  modelId: NimirModelId;
  /** Average time to first visible character, in seconds (Mufy-compatible). */
  firstCharTimeAvg: number | null;
  recentSuccessRate: number | null;
  stabilityStatus: ModelStabilityStatus;
  sampleCount: number;
  windowMinutes: number;
}

interface StatusInputs {
  sampleCount: number;
  successCount: number;
  averageTtftMs: number | null;
}

export function classifyModelStability({
  sampleCount,
  successCount,
  averageTtftMs,
}: StatusInputs): ModelStabilityStatus {
  if (sampleCount < MIN_SAMPLE_COUNT) return "unknown";

  const successRate = (successCount / sampleCount) * 100;
  if (successRate < INTERRUPTED_SUCCESS_RATE) return "interrupted";
  if (
    successRate < CONGESTED_SUCCESS_RATE ||
    (averageTtftMs !== null && averageTtftMs >= CONGESTED_TTFT_MS)
  ) {
    return "congested";
  }
  return "smooth";
}

export function mapProbeHealthStatus(status: string): ModelStabilityStatus {
  if (status === "healthy") return "smooth";
  if (status === "degraded") return "congested";
  if (status === "unhealthy") return "interrupted";
  return "unknown";
}

let lastCleanupAt = 0;

/**
 * Record one provider attempt. Callers must omit user aborts, balance errors,
 * content-policy blocks and other failures that do not describe model health.
 * Telemetry failure is intentionally swallowed so it can never break chat.
 */
export async function recordModelAttempt(input: {
  modelId: NimirModelId;
  outcome: "success" | "failure";
  ttftMs: number | null;
  durationMs: number;
}): Promise<void> {
  try {
    await db.insert(modelRequestEvents).values({
      ...input,
      ttftMs: input.ttftMs === null ? null : Math.max(0, input.ttftMs),
      durationMs: Math.max(0, input.durationMs),
    });

    // Keep this high-volume table bounded without requiring a separate cron.
    // Per-process throttling makes cleanup at most hourly in normal operation.
    const now = Date.now();
    if (now - lastCleanupAt >= 60 * 60 * 1_000) {
      lastCleanupAt = now;
      await db
        .delete(modelRequestEvents)
        .where(
          lt(
            modelRequestEvents.createdAt,
            new Date(now - EVENT_RETENTION_HOURS * 60 * 60 * 1_000),
          ),
        );
    }
  } catch (error) {
    console.error("[model-status] Failed to record model attempt:", error);
  }
}

export async function getRecentModelStatuses(): Promise<ModelStatusSnapshot[]> {
  const windowStart = new Date(
    Date.now() - MODEL_STATUS_WINDOW_MINUTES * 60 * 1_000,
  );
  const [rows, probeRows] = await Promise.all([
    db
      .select({
        modelId: modelRequestEvents.modelId,
        sampleCount: sql<number>`count(*)::int`,
        successCount: sql<number>`count(*) filter (where ${modelRequestEvents.outcome} = 'success')::int`,
        averageTtftMs: sql<
          number | null
        >`round(avg(${modelRequestEvents.ttftMs}) filter (where ${modelRequestEvents.outcome} = 'success'))::int`,
      })
      .from(modelRequestEvents)
      .where(gte(modelRequestEvents.createdAt, windowStart))
      .groupBy(modelRequestEvents.modelId),
    db.select().from(modelHealthStatus),
  ]);

  const byModel = new Map(rows.map((row) => [row.modelId, row]));
  const probeByModel = new Map(probeRows.map((row) => [row.modelId, row]));

  return NIMIR_VISIBLE_MODELS.map((model) => {
    const row = byModel.get(model.id);
    const sampleCount = row?.sampleCount ?? 0;
    const successCount = row?.successCount ?? 0;
    const averageTtftMs = row?.averageTtftMs ?? null;
    const trafficStatus = classifyModelStability({
      sampleCount,
      successCount,
      averageTtftMs,
    });

    if (trafficStatus === "unknown") {
      const probe = probeByModel.get(model.id);
      if (probe?.lastCheckAt) {
        return {
          modelId: model.id,
          firstCharTimeAvg:
            probe.avgLatencyMs === null
              ? null
              : Number((probe.avgLatencyMs / 1_000).toFixed(2)),
          recentSuccessRate:
            probe.checkCount === 0
              ? null
              : Number(
                  ((probe.successCount / probe.checkCount) * 100).toFixed(2),
                ),
          stabilityStatus: mapProbeHealthStatus(probe.status),
          sampleCount: probe.checkCount,
          windowMinutes: MODEL_STATUS_WINDOW_MINUTES,
        };
      }
    }

    return {
      modelId: model.id,
      firstCharTimeAvg:
        averageTtftMs === null
          ? null
          : Number((averageTtftMs / 1_000).toFixed(2)),
      recentSuccessRate:
        sampleCount === 0
          ? null
          : Number(((successCount / sampleCount) * 100).toFixed(2)),
      stabilityStatus: trafficStatus,
      sampleCount,
      windowMinutes: MODEL_STATUS_WINDOW_MINUTES,
    };
  });
}
