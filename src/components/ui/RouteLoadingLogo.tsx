type RouteLoadingLogoProps = {
  label: string;
  overlay?: boolean;
};

export function RouteLoadingLogo({
  label,
  overlay = false,
}: RouteLoadingLogoProps) {
  return (
    <div
      aria-live="polite"
      aria-busy="true"
      className={
        overlay
          ? "route-loading-logo route-loading-logo-overlay"
          : "route-loading-logo"
      }
    >
      <div className="route-loading-logo-mark">
        {/* biome-ignore lint/performance/noImgElement: local static brand asset */}
        <img
          src="/icon-512.png"
          alt=""
          aria-hidden="true"
          className="h-full w-full object-cover"
        />
      </div>
      <div className="route-loading-logo-dots" aria-hidden="true">
        <span className="ai-loading-dot" />
        <span className="ai-loading-dot [animation-delay:0.2s]" />
        <span className="ai-loading-dot [animation-delay:0.4s]" />
      </div>
      <span className="text-sm text-text-muted">{label}</span>
    </div>
  );
}
