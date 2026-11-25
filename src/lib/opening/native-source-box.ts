/** Geometry measured from a public drawer; never a palette or an execution permission. */
export interface NativeSourceBox {
  topVh: number;
  rightPx: number;
  triggerWidth: number;
  triggerHeight: number;
  triggerInsetRight: number;
  openWidth: number;
  openHeight: number;
  panelGapPx?: number;
}

export function validNativeSourceBox(value: unknown): value is NativeSourceBox {
  if (!value || typeof value !== "object") return false;
  const box = value as Partial<NativeSourceBox>;
  const bounded = (n: unknown, min: number, max: number): n is number =>
    typeof n === "number" && Number.isFinite(n) && n >= min && n <= max;
  return (
    bounded(box.topVh, 0, 80) &&
    bounded(box.rightPx, 0, 100) &&
    bounded(box.triggerWidth, 16, 160) &&
    bounded(box.triggerHeight, 16, 160) &&
    bounded(box.triggerInsetRight, 0, box.triggerWidth) &&
    bounded(box.openWidth, box.triggerWidth, 500) &&
    bounded(box.openHeight, box.triggerHeight, 800) &&
    (box.panelGapPx === undefined || bounded(box.panelGapPx, 0, 32))
  );
}

export function nativeSourceBoxStyle(box: NativeSourceBox, open: boolean) {
  return {
    top: `${box.topVh}vh`,
    right: box.rightPx,
    width: open
      ? `min(${box.openWidth}px,calc(100vw - ${box.rightPx}px))`
      : box.triggerWidth,
    height: open
      ? `min(${box.openHeight}px,calc(100dvh - ${box.topVh}vh))`
      : box.triggerHeight,
    transform: "none",
    pointerEvents: "none" as const,
  };
}

export function nativeSourceBoxCss(box: NativeSourceBox): string {
  const gap = box.panelGapPx ?? 0;
  return `:host{pointer-events:none!important}
[data-character-css="opening"] .mufy-side-btn{pointer-events:auto!important;position:relative!important;right:auto!important;top:auto!important;display:flex!important;justify-content:flex-end;width:100%!important;height:${box.triggerHeight}px!important;padding:0 ${box.triggerInsetRight}px 0 0!important;box-sizing:border-box!important;list-style:none}
[data-character-css="opening"] .mufy-side-panel{pointer-events:auto!important;position:relative!important;right:0!important;top:0!important;width:100%!important;height:calc(100% - ${box.triggerHeight + gap * 2}px)!important;margin:${gap}px 0!important;overflow:auto}
[data-nj-native-documents]>div{padding:0!important}`;
}
