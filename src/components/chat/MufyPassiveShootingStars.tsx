import type { CSSProperties } from "react";
import type { PassiveStarsSpec } from "@/lib/opening/passive-shooting-stars";

// Trusted geometry and animation. Author data supplies bounded numbers only.
// 45 deliberately follows the native ornament layer, below modal dialogs;
// the public source used 999, which is not copied across platform layers.
export const PASSIVE_STARS_CSS = `
.nj_passive_stars_host.nj_passive_stars_host{position:fixed!important;top:0!important;left:0!important;width:0!important;height:0!important;pointer-events:none!important;z-index:45!important}
.nj_passive_stars_host .nj_passive_stars_canvas{position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;overflow:hidden!important;pointer-events:none!important}
.nj_passive_stars_host .nj_passive_star{position:absolute!important;top:-20px!important;pointer-events:none!important;opacity:1;text-shadow:0 0 12px rgba(255,238,180,.9),0 0 20px rgba(255,245,215,.6);animation:nj_public_stars_fall linear infinite}
.nj_passive_stars_host *{pointer-events:none!important}
@keyframes nj_public_stars_fall{to{transform:translateY(105vh);opacity:0}}
`;
export function MufyPassiveShootingStars({ spec }: { spec: PassiveStarsSpec }) {
  return (
    <div
      className="nj_passive_stars_host"
      data-passive-stars={spec.id}
      aria-hidden="true"
      inert
    >
      <style>{PASSIVE_STARS_CSS}</style>
      <div className="nj_passive_stars_canvas">
        {spec.stars.map((star, index) => {
          const style: CSSProperties = {
            left: `${star.leftPercent}%`,
            fontSize: `${star.sizePx}px`,
            color: `rgba(255,250,230,${star.alpha})`,
            animationDuration: `${star.durationSec}s`,
            animationDelay: `${star.delaySec}s`,
          };
          return (
            <span className="nj_passive_star" key={index} style={style}>
              ★
            </span>
          );
        })}
      </div>
    </div>
  );
}
