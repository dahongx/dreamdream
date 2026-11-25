export type KnownV5QuickAction = "bracket" | "quote" | "dollar" | "phone";
export const KNOWN_V5_QUICK_ACTIONS = [
  {
    action: "bracket",
    label: "（）",
    title: "插入括号",
    text: "（ ）",
    offset: 1,
  },
  { action: "quote", label: "“”", title: "插入引号", text: "“ ”", offset: 1 },
  { action: "dollar", label: "$", title: "插入指令符", text: "$", offset: 0 },
  {
    action: "phone",
    label: "",
    title: "线上聊天",
    text: "$线上聊天：",
    offset: 0,
  },
] as const;
export function insertKnownV5QuickSymbol(
  value: string,
  start: number,
  end: number,
  action: KnownV5QuickAction,
) {
  const spec = KNOWN_V5_QUICK_ACTIONS.find((item) => item.action === action);
  if (!spec) throw Error("UNKNOWN_KNOWN_V5_ACTION");
  const at = Number.isFinite(start)
    ? Math.max(0, Math.min(value.length, start))
    : value.length;
  const until = Number.isFinite(end)
    ? Math.max(at, Math.min(value.length, end))
    : at;
  return {
    value: value.slice(0, at) + spec.text + value.slice(until),
    caret: at + spec.text.length - spec.offset,
  };
}
