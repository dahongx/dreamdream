"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/ToastProvider";
import { useI18n } from "@/i18n/client";

interface Props {
  value: string;
}

/**
 * 个人主页头像下方那串 ID 末尾的小复制按钮。
 * 复制成功后短暂切到「已复制」反馈,2 秒后回到默认态。
 *
 * 非 HTTPS / 旧浏览器下 navigator.clipboard 可能不可用,这里走 textarea +
 * execCommand 兜底,避免静默失败。无论走哪条路径都用 toast 反馈一次。
 */
export function CopyIdButton({ value }: Props) {
  const { dict } = useI18n();
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(id);
  }, [copied]);

  async function onCopy() {
    const ok = await copyToClipboard(value);
    if (ok) {
      setCopied(true);
      toast.success(dict.me.idCopied);
    } else {
      toast.error(dict.me.idCopyFailed);
    }
  }

  return (
    <button
      type="button"
      onClick={onCopy}
      aria-label={dict.me.idCopyAria}
      title={copied ? dict.me.idCopied : dict.me.idCopyAria}
      className="inline-flex h-5 w-5 items-center justify-center rounded-[4px] text-text-muted transition-colors hover:bg-surface-glass hover:text-text-primary"
    >
      {copied ? (
        <Check width={12} height={12} strokeWidth={2} />
      ) : (
        <Copy width={12} height={12} strokeWidth={2} />
      )}
    </button>
  );
}

async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // 安全策略 / 权限拒绝 / 非 secure context — 落到 execCommand 兜底
    }
  }
  if (typeof document === "undefined") return false;
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.top = "0";
  ta.style.left = "0";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  ta.setSelectionRange(0, text.length);
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  document.body.removeChild(ta);
  return ok;
}
