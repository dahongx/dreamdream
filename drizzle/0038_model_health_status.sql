-- 模型健康状态表
CREATE TABLE IF NOT EXISTS "model_health_status" (
  "model_id" text PRIMARY KEY NOT NULL,
  "status" text NOT NULL DEFAULT 'unknown',
  "last_check_at" timestamp with time zone,
  "last_success_at" timestamp with time zone,
  "last_error_at" timestamp with time zone,
  "last_error_message" text,
  "avg_latency_ms" integer,
  "check_count" integer NOT NULL DEFAULT 0,
  "success_count" integer NOT NULL DEFAULT 0,
  "error_count" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "model_health_status_status_check" CHECK (status IN ('healthy', 'degraded', 'unhealthy', 'unknown'))
);

-- 开启 RLS（虽然这张表不会通过 PostgREST 暴露，但保持一致性）
ALTER TABLE "model_health_status" ENABLE ROW LEVEL SECURITY;
