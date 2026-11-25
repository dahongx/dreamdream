import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { MaskDialog } from "../src/components/chat/MaskDialog";
import type { MaskListItem } from "../src/lib/masks/queries";

const masks = ["雨天的旅人", "图书馆的常客", "远行的画师"].map((name, i) => ({
  id: String(i), name, note: "", gender: "", description: "喜欢阅读和旅行，习惯先听对方说完，再认真回应。", preference: "自然、轻松的交流", instruction: "", isDefault: false,
})) as MaskListItem[];
function Preview() {
  const [items, setItems] = useState(masks);
  const [active, setActive] = useState<string | null>(null);
  const [open, setOpen] = useState(true);
  return <main><button type="button" onClick={() => setOpen(true)}>打开面具 · 本地演示数据</button><MaskDialog open={open} onOpenChange={setOpen} sessionId="preview" masks={items} onMasksChange={setItems} activeMaskId={active} onActiveMaskIdChange={setActive} hasUnlimitedMasks /></main>;
}
createRoot(document.getElementById("root")!).render(<Preview />);
