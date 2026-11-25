"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/i18n/client";
import type { Locale } from "@/i18n/config";

interface ModelHealthStatusProps {
  models: Array<{
    modelId: string;
    label: string;
    hint: string;
    status?: "healthy" | "degraded" | "unhealthy" | "unknown";
    lastCheckAt?: Date | null;
    lastSuccessAt?: Date | null;
    lastErrorAt?: Date | null;
    lastErrorMessage?: string | null;
    avgLatencyMs?: number | null;
    checkCount?: number;
    successCount?: number;
    errorCount?: number;
  }>;
}

function getStatusColor(
  status: "healthy" | "degraded" | "unhealthy" | "unknown",
): string {
  switch (status) {
    case "healthy":
      return "text-green-400";
    case "degraded":
      return "text-yellow-400";
    case "unhealthy":
      return "text-red-400";
    case "unknown":
      return "text-text-tertiary";
  }
}

function getStatusBgColor(
  status: "healthy" | "degraded" | "unhealthy" | "unknown",
): string {
  switch (status) {
    case "healthy":
      return "bg-green-400/20";
    case "degraded":
      return "bg-yellow-400/20";
    case "unhealthy":
      return "bg-red-400/20";
    case "unknown":
      return "bg-surface-glass";
  }
}

function getStatusLabel(
  status: "healthy" | "degraded" | "unhealthy" | "unknown",
): string {
  switch (status) {
    case "healthy":
      return "可用";
    case "degraded":
      return "延迟高";
    case "unhealthy":
      return "不可用";
    case "unknown":
      return "未检查";
  }
}

function formatDate(date: Date | null | undefined, locale: Locale): string {
  if (!date) return "—";
  return new Date(date).toLocaleString(locale, {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AdminModelStatusSection({ models }: ModelHealthStatusProps) {
  const { locale } = useI18n();
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(false);

  const handleCheckHealth = async () => {
    setIsChecking(true);
    try {
      await fetch("/api/admin/models/health-check", {
        method: "POST",
      });
      router.refresh();
    } catch (error) {
      console.error("Health check failed:", error);
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <section className="flex flex-col gap-[var(--space-lg)]">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-text-primary">模型健康状态</h2>
        <button
          type="button"
          onClick={handleCheckHealth}
          disabled={isChecking}
          className="rounded-[var(--radius-sm)] bg-accent-primary px-[var(--space-md)] py-[var(--space-sm)] text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {isChecking ? "检查中..." : "立即检查"}
        </button>
      </div>

      <div className="grid gap-[var(--space-md)] sm:grid-cols-2 lg:grid-cols-3">
        {models.map((model) => {
          const status = model.status ?? "unknown";
          const successRate =
            model.checkCount && model.checkCount > 0
              ? ((model.successCount ?? 0) / model.checkCount) * 100
              : null;

          return (
            <div
              key={model.modelId}
              className={`rounded-[var(--radius-md)] border border-border-subtle p-[var(--space-md)] ${getStatusBgColor(status)}`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-medium text-text-primary">
                    {model.label}
                  </h3>
                  <p className="mt-1 text-xs text-text-tertiary">
                    {model.hint}
                  </p>
                </div>
                <div
                  className={`flex h-3 w-3 rounded-full ${status === "healthy" ? "bg-green-400" : status === "degraded" ? "bg-yellow-400" : status === "unhealthy" ? "bg-red-400" : "bg-surface-subtle"}`}
                  title={getStatusLabel(status)}
                />
              </div>

              <div className="mt-[var(--space-md)] space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-secondary">状态</span>
                  <span className={`font-medium ${getStatusColor(status)}`}>
                    {getStatusLabel(status)}
                  </span>
                </div>

                {model.avgLatencyMs !== null &&
                  model.avgLatencyMs !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-text-secondary">平均延迟</span>
                      <span className="font-mono text-text-primary">
                        {model.avgLatencyMs}ms
                      </span>
                    </div>
                  )}

                {successRate !== null && (
                  <div className="flex justify-between">
                    <span className="text-text-secondary">成功率</span>
                    <span className="font-mono text-text-primary">
                      {successRate.toFixed(1)}%
                    </span>
                  </div>
                )}

                {model.lastCheckAt && (
                  <div className="flex justify-between">
                    <span className="text-text-secondary">最后检查</span>
                    <span className="font-mono text-xs text-text-tertiary">
                      {formatDate(model.lastCheckAt, locale)}
                    </span>
                  </div>
                )}

                {model.lastErrorMessage && status === "unhealthy" && (
                  <div className="mt-2 rounded bg-surface-glass p-2">
                    <p className="text-xs text-text-tertiary">最近错误:</p>
                    <p className="mt-1 text-xs text-red-400">
                      {model.lastErrorMessage.slice(0, 100)}
                      {model.lastErrorMessage.length > 100 ? "..." : ""}
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-[var(--radius-md)] border border-border-subtle bg-surface-glass p-[var(--space-md)]">
        <h3 className="font-medium text-text-primary">模型可用性说明</h3>
        <p className="mt-2 text-sm text-text-secondary">
          所选模型不可用时会直接提示，不会自动切换至其他模型。首字响应时间 ≥10
          秒记为延迟高，请求失败记为不可用。
        </p>
      </div>
    </section>
  );
}
