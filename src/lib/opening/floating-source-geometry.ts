/** Explicit, bounded public-source geometry. This grants no execution capability. */
export interface FloatingSourceSize {
  width: number;
  height: number;
}

export type FloatingSourceGeometry = {
  version: 1;
  rightPx: number;
  collapsed: FloatingSourceSize;
  expanded?: FloatingSourceSize;
} & ({ topPx: number; bottomPx?: never } | { bottomPx: number; topPx?: never });

export interface FloatingSourceViewport {
  width: number;
  height: number;
}

export interface FloatingSourceRect extends FloatingSourceSize {
  left: number;
  top: number;
}

export const FLOATING_SOURCE_GEOMETRY_MAX_ATTRIBUTE_LENGTH = 2048;

function record(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
): boolean {
  return Reflect.ownKeys(value).every(
    (key) =>
      typeof key === "string" &&
      allowed.includes(key) &&
      Object.getOwnPropertyDescriptor(value, key)?.get === undefined &&
      Object.getOwnPropertyDescriptor(value, key)?.set === undefined,
  );
}

function bounded(
  value: unknown,
  maximum: number,
  minimum = 0,
): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= minimum &&
    value <= maximum
  );
}

function size(value: unknown): value is FloatingSourceSize {
  return (
    record(value) &&
    exactKeys(value, ["width", "height"]) &&
    Object.hasOwn(value, "width") &&
    Object.hasOwn(value, "height") &&
    bounded(value.width, 500, 16) &&
    bounded(value.height, 800, 16)
  );
}

/** Missing opt-in, CSS strings, unknown fields and permission extensions all reject. */
export function parseFloatingSourceGeometry(
  value: unknown,
): FloatingSourceGeometry | null {
  if (
    !record(value) ||
    !exactKeys(value, [
      "version",
      "rightPx",
      "topPx",
      "bottomPx",
      "collapsed",
      "expanded",
    ])
  )
    return null;
  if (
    !Object.hasOwn(value, "version") ||
    !Object.hasOwn(value, "rightPx") ||
    !Object.hasOwn(value, "collapsed") ||
    value.version !== 1 ||
    !bounded(value.rightPx, 100) ||
    !size(value.collapsed)
  )
    return null;
  const hasTop = Object.hasOwn(value, "topPx");
  const hasBottom = Object.hasOwn(value, "bottomPx");
  if (hasTop === hasBottom) return null;
  if (hasTop ? !bounded(value.topPx, 1200) : !bounded(value.bottomPx, 1200))
    return null;
  if (Object.hasOwn(value, "expanded") && !size(value.expanded)) return null;
  const base = {
    version: 1 as const,
    rightPx: value.rightPx,
    collapsed: { width: value.collapsed.width, height: value.collapsed.height },
    ...(Object.hasOwn(value, "expanded") && size(value.expanded)
      ? {
          expanded: {
            width: value.expanded.width,
            height: value.expanded.height,
          },
        }
      : {}),
  };
  return hasTop
    ? { ...base, topPx: value.topPx as number }
    : { ...base, bottomPx: value.bottomPx as number };
}

export function encodeFloatingSourceGeometry(value: unknown): string {
  const parsed = parseFloatingSourceGeometry(value);
  if (!parsed) throw new TypeError("INVALID_FLOATING_SOURCE_GEOMETRY");
  const attribute = encodeURIComponent(JSON.stringify(parsed));
  if (attribute.length > FLOATING_SOURCE_GEOMETRY_MAX_ATTRIBUTE_LENGTH) {
    throw new RangeError("FLOATING_SOURCE_GEOMETRY_ATTRIBUTE_TOO_LONG");
  }
  return attribute;
}

export function decodeFloatingSourceGeometry(
  attribute: unknown,
): FloatingSourceGeometry | null {
  if (
    typeof attribute !== "string" ||
    attribute.length === 0 ||
    attribute.length > FLOATING_SOURCE_GEOMETRY_MAX_ATTRIBUTE_LENGTH
  )
    return null;
  try {
    return parseFloatingSourceGeometry(
      JSON.parse(decodeURIComponent(attribute)) as unknown,
    );
  } catch {
    return null;
  }
}

function validViewport(viewport: FloatingSourceViewport): boolean {
  return (
    Number.isFinite(viewport.width) &&
    viewport.width > 0 &&
    Number.isFinite(viewport.height) &&
    viewport.height > 0
  );
}

const clamp = (value: number, maximum: number) =>
  Math.min(Math.max(value, 0), maximum);

/** Pixel anchors are preserved across viewports; only off-screen extents clamp. */
export function floatingSourceRect(
  value: unknown,
  open: boolean,
  viewport: FloatingSourceViewport,
): FloatingSourceRect | null {
  const geometry = parseFloatingSourceGeometry(value);
  if (!geometry || !validViewport(viewport)) return null;
  const selected = open
    ? (geometry.expanded ?? geometry.collapsed)
    : geometry.collapsed;
  const width = Math.min(selected.width, viewport.width);
  const height = Math.min(selected.height, viewport.height);
  const sourceTop =
    geometry.topPx ?? viewport.height - (geometry.bottomPx ?? 0) - height;
  return {
    left: clamp(
      viewport.width - geometry.rightPx - width,
      viewport.width - width,
    ),
    top: clamp(sourceTop, viewport.height - height),
    width,
    height,
  };
}

/** No opt-in returns undefined so an existing slot's legacy style remains untouched. */
export function floatingSourceGeometryStyle(
  value: unknown,
  open: boolean,
  viewport?: FloatingSourceViewport,
) {
  const geometry = parseFloatingSourceGeometry(value);
  if (!geometry) return undefined;
  const selected = open
    ? (geometry.expanded ?? geometry.collapsed)
    : geometry.collapsed;
  const rect = viewport ? floatingSourceRect(geometry, open, viewport) : null;
  if (viewport && !rect) return undefined;
  const right =
    rect && viewport
      ? viewport.width - rect.left - rect.width
      : geometry.rightPx;
  const anchor =
    geometry.topPx !== undefined
      ? { top: rect?.top ?? geometry.topPx, bottom: "auto" as const }
      : {
          top: "auto" as const,
          bottom:
            rect && viewport
              ? viewport.height - rect.top - rect.height
              : geometry.bottomPx,
        };
  return {
    position: "fixed" as const,
    ...anchor,
    right,
    width: rect?.width ?? selected.width,
    height: rect?.height ?? selected.height,
    transform: "none" as const,
  };
}
