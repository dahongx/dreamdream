/** Restore public iframe HTML literally: JavaScript may contain $&, $' or $`. */
export function restoreMufyPublicFrameTokens(
  html: string,
  frames: readonly string[],
): string {
  return html.replace(/MUFY_PUBLIC_FRAME_(\d+)/g, (marker, index: string) => {
    const frame = frames[Number(index)];
    if (frame === undefined) throw new Error(`UNRESOLVED_PUBLIC_FRAME:${marker}`);
    return frame;
  });
}
