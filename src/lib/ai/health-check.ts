/**
 * 模型健康检查服务
 *
 * 按需检测各模型的可用性和延迟，存储健康状态到数据库。
 * 健康状态分类：
 * - healthy: 可用，延迟 < 15s
 * - degraded: 可用但延迟 >= 15s
 * - unhealthy: 不可用（调用失败）
 * - unknown: 未检查过
 */

import { streamText } from "ai";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { modelHealthStatus } from "@/lib/db/schema";
import { NIMIR_MODELS, type NimirModelId } from "./models";
import { modelById, providerOptionsByModelId } from "./provider";

const LATENCY_THRESHOLD_MS = 15_000;
const HEALTH_CHECK_TIMEOUT_MS = 30_000;

type HealthStatus = "healthy" | "degraded" | "unhealthy" | "unknown";

interface HealthCheckResult {
  modelId: NimirModelId;
  status: HealthStatus;
  latencyMs: number | null;
  error: string | null;
  checkedAt: Date;
}

/**
 * 对单个模型执行健康检查
 * 发送一个极简 prompt，测量 TTFT（Time To First Token）
 */
export async function checkModelHealth(
  modelId: NimirModelId,
): Promise<HealthCheckResult> {
  const startAt = Date.now();
  const checkedAt = new Date();

  try {
    const providerOptions = providerOptionsByModelId(modelId);

    // 极简 prompt，只测试首字响应时间
    const result = streamText({
      model: modelById(modelId),
      messages: [
        {
          role: "user",
          content: "Hi",
        },
      ],
      providerOptions,
      abortSignal: AbortSignal.timeout(HEALTH_CHECK_TIMEOUT_MS),
    });

    let firstTokenAt = 0;

    // 等待首个 token，测量 TTFT
    for await (const part of result.fullStream) {
      if (part.type === "text-delta") {
        firstTokenAt = Date.now();
        break; // 只需要首个 token
      }
      if (part.type === "error") {
        throw part.error;
      }
    }

    if (firstTokenAt === 0) {
      return {
        modelId,
        status: "unhealthy",
        latencyMs: null,
        error: "No token received",
        checkedAt,
      };
    }

    const latencyMs = firstTokenAt - startAt;
    const status: HealthStatus =
      latencyMs < LATENCY_THRESHOLD_MS ? "healthy" : "degraded";

    return {
      modelId,
      status,
      latencyMs,
      error: null,
      checkedAt,
    };
  } catch (error) {
    const latencyMs = Date.now() - startAt;
    return {
      modelId,
      status: "unhealthy",
      latencyMs,
      error: error instanceof Error ? error.message : String(error),
      checkedAt,
    };
  }
}

/**
 * 更新数据库中的健康状态
 */
export async function updateHealthStatus(
  result: HealthCheckResult,
): Promise<void> {
  const { modelId, status, latencyMs, error, checkedAt } = result;

  const [existing] = await db
    .select()
    .from(modelHealthStatus)
    .where(eq(modelHealthStatus.modelId, modelId))
    .limit(1);

  if (!existing) {
    // 首次检查，插入新记录
    await db.insert(modelHealthStatus).values({
      modelId,
      status,
      lastCheckAt: checkedAt,
      lastSuccessAt: status !== "unhealthy" ? checkedAt : null,
      lastErrorAt: status === "unhealthy" ? checkedAt : null,
      lastErrorMessage: error,
      avgLatencyMs: latencyMs,
      checkCount: 1,
      successCount: status !== "unhealthy" ? 1 : 0,
      errorCount: status === "unhealthy" ? 1 : 0,
    });
  } else {
    // 更新已有记录，计算滑动平均延迟
    const newCheckCount = existing.checkCount + 1;
    const newSuccessCount =
      existing.successCount + (status !== "unhealthy" ? 1 : 0);
    const newErrorCount =
      existing.errorCount + (status === "unhealthy" ? 1 : 0);

    // 滑动平均：最近 10 次的平均延迟
    const windowSize = 10;
    const weight = Math.min(newCheckCount, windowSize);
    const newAvgLatency =
      latencyMs !== null && existing.avgLatencyMs !== null
        ? Math.round(
            (existing.avgLatencyMs * (weight - 1) + latencyMs) / weight,
          )
        : (latencyMs ?? existing.avgLatencyMs);

    await db
      .update(modelHealthStatus)
      .set({
        status,
        lastCheckAt: checkedAt,
        lastSuccessAt:
          status !== "unhealthy" ? checkedAt : existing.lastSuccessAt,
        lastErrorAt: status === "unhealthy" ? checkedAt : existing.lastErrorAt,
        lastErrorMessage: error ?? existing.lastErrorMessage,
        avgLatencyMs: newAvgLatency,
        checkCount: newCheckCount,
        successCount: newSuccessCount,
        errorCount: newErrorCount,
        updatedAt: checkedAt,
      })
      .where(eq(modelHealthStatus.modelId, modelId));
  }
}

/**
 * 检查所有模型的健康状态
 */
export async function checkAllModelsHealth(): Promise<HealthCheckResult[]> {
  const results: HealthCheckResult[] = [];

  for (const model of NIMIR_MODELS) {
    console.log(`[health-check] Checking model: ${model.id}`);
    const result = await checkModelHealth(model.id);
    await updateHealthStatus(result);
    results.push(result);
    console.log(
      `[health-check] ${model.id}: ${result.status} (${result.latencyMs}ms)`,
    );
  }

  return results;
}

/**
 * 获取指定模型的健康状态
 */
export async function getModelHealthStatus(
  modelId: NimirModelId,
): Promise<HealthStatus> {
  const [record] = await db
    .select()
    .from(modelHealthStatus)
    .where(eq(modelHealthStatus.modelId, modelId))
    .limit(1);

  return record?.status ?? "unknown";
}

/**
 * 获取所有模型的健康状态
 */
export async function getAllModelsHealthStatus() {
  const records = await db.select().from(modelHealthStatus);

  const statusMap = new Map(records.map((r) => [r.modelId, r]));

  return NIMIR_MODELS.map((model) => ({
    modelId: model.id,
    label: model.label,
    hint: model.hint,
    ...statusMap.get(model.id),
  }));
}

/**
 * 判断模型是否可用（healthy 或 degraded）
 */
export function isModelAvailable(status: HealthStatus): boolean {
  return status === "healthy" || status === "degraded";
}
