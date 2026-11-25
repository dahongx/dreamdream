"use client";
import type { CSSProperties } from "react";
import {
  PUBLIC_WARNING_CLASSES,
  type PublicWarningContract,
} from "@/lib/import/mufy-public-host-warning-candidate";

const LOCAL_STYLE = `#nj_public_source_warning{height:28px!important;min-height:28px!important;max-height:28px!important;width:fit-content!important;max-width:90vw!important;margin:0!important;box-sizing:border-box!important;display:inline-flex!important;align-items:center!important;gap:8px!important;overflow:visible!important;background:var(--nj-warning-background)!important;border:var(--nj-warning-border-width) solid var(--nj-warning-border-color)!important;border-radius:12px!important;padding:6px 16px!important;color:var(--nj-warning-color)!important;font-family:var(--nj-warning-font)!important;font-size:15px!important;line-height:16px!important;letter-spacing:1px!important}
#nj_public_source_warning>span.flex-1{font:inherit!important;color:inherit!important;letter-spacing:inherit!important;white-space:nowrap!important;min-width:0;overflow:hidden;text-overflow:ellipsis}
#nj_public_source_warning>span.flex-1::before,#nj_public_source_warning>span.flex-1::after{content:none!important}
#nj_public_source_warning>svg,#nj_public_source_warning>button{width:14px!important;height:14px!important;flex:0 0 14px!important}
#nj_public_source_warning>button{display:inline-flex!important;align-items:center!important;justify-content:center!important;min-width:0!important;min-height:0!important;border:0!important;border-radius:0!important;margin:0!important;padding:0!important;background:transparent!important;box-shadow:none!important;filter:none!important;color:inherit!important;cursor:pointer;pointer-events:auto}
#nj_public_source_warning>button::before,#nj_public_source_warning>button::after{content:none!important}`;

/** Static semantic replica for converter-produced, validated warning metadata only. */
export function MufyPublicWarningCandidate({
  contract,
  onDismiss,
}: {
  contract: PublicWarningContract;
  onDismiss: () => void;
}) {
  const style = {
    "--nj-warning-background": contract.background,
    "--nj-warning-border-width": contract.borderWidth,
    "--nj-warning-border-color": contract.borderColor,
    "--nj-warning-color": contract.color,
    "--nj-warning-font": contract.fontFamily,
  } as CSSProperties;
  return (
    <>
      <style>{LOCAL_STYLE}</style>
      <div
        id="nj_public_source_warning"
        className={PUBLIC_WARNING_CLASSES}
        data-nj-public-warning="compact-css-observed-v1"
        role="note"
        style={style}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4M12 8h.01" />
        </svg>
        <span className="flex-1">{contract.text}</span>
        <button type="button" aria-label="关闭提示" onClick={onDismiss}>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="m18 6-12 12M6 6l12 12" />
          </svg>
        </button>
      </div>
    </>
  );
}
