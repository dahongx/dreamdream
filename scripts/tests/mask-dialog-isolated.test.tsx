import { afterEach, expect, mock, test } from "bun:test";
import { JSDOM } from "jsdom";
import React, {
  act,
  type ComponentProps,
  createContext,
  type ReactNode,
  useContext,
  useState,
} from "react";
import { createRoot, type Root } from "react-dom/client";
import { zh } from "@/i18n/zh";

// Isolated component tests: no server actions, authentication or database.
const dom = new JSDOM('<!doctype html><div id="root"></div>');
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  navigator: dom.window.navigator,
  IS_REACT_ACT_ENVIRONMENT: true,
});
const Open = createContext<(value: boolean) => void>(() => {});
type Children = { children?: ReactNode };
mock.module("@radix-ui/react-dialog", () => ({
  Root: ({
    open,
    onOpenChange,
    children,
  }: Children & { open: boolean; onOpenChange: (next: boolean) => void }) => (
    <Open.Provider value={onOpenChange}>{open ? children : null}</Open.Provider>
  ),
  Portal: ({ children }: Children) => children,
  Overlay: () => null,
  Content: ({ children, ...props }: ComponentProps<"div">) => (
    <div {...props}>{children}</div>
  ),
  Title: ({ children }: Children) => <h2>{children}</h2>,
  Description: ({ children }: Children) => <p>{children}</p>,
  Close: ({ children, ...props }: ComponentProps<"button">) => {
    const close = useContext(Open);
    return (
      <button {...props} onClick={() => close(false)}>
        {children}
      </button>
    );
  },
}));
mock.module("@/i18n/client", () => ({ useI18n: () => ({ dict: zh }) }));
mock.module("@/components/ui/DialogProvider", () => ({
  useDialog: () => ({ confirm: async () => true, alert: async () => {} }),
}));
let rejectActivation = false;
let throwActivation = false;
let activations: (string | null)[] = [];
let defaultClears = 0;
let rejectDefaultClear = false;
mock.module("@/lib/masks/actions", () => ({
  clearDefaultMaskAction: async () => {
    defaultClears++;
    return rejectDefaultClear ? { ok: false, error: "test" } : { ok: true };
  },
  setSessionActiveMaskAction: async (_session: string, id: string | null) => {
    activations.push(id);
    if (throwActivation) throw new Error("test failure");
    return rejectActivation
      ? { ok: false, error: "test failure" }
      : { ok: true, activeMaskId: id };
  },
  saveMaskAction: async (draft: object) => ({
    ok: true,
    mask: { ...draft, id: "new", isDefault: false },
  }),
  setDefaultMaskAction: async () => ({ ok: true }),
  unsetDefaultMaskAction: async () => ({ ok: true }),
  deleteMaskAction: async () => ({ ok: true }),
}));
const { MaskDialog } = await import("../../src/components/chat/MaskDialog");
type MaskListItem = import("../../src/lib/masks/queries").MaskListItem;
const fixtures = ["A", "B"].map((id) => ({
  id,
  name: id,
  note: null,
  gender: null,
  description: null,
  preference: null,
  instruction: null,
  isDefault: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  userId: "test",
}));
let root: Root;
async function mount(unlimited = true, initialMasks: MaskListItem[] = fixtures) {
  rejectActivation = false;
  throwActivation = false;
  activations = [];
  defaultClears = 0;
  rejectDefaultClear = false;
  function Harness() {
    const [open, setOpen] = useState(true);
    const [masks, setMasks] = useState<MaskListItem[]>(initialMasks);
    const [active, setActive] = useState<string | null>(null);
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>
          Open
        </button>
        <output>{active ?? "none"}</output>
        <MaskDialog
          open={open}
          onOpenChange={setOpen}
          sessionId="test"
          masks={masks}
          onMasksChange={setMasks}
          activeMaskId={active}
          onActiveMaskIdChange={setActive}
          hasUnlimitedMasks={unlimited}
        />
      </>
    );
  }
  root = createRoot(document.getElementById("root")!);
  await act(async () => root.render(<Harness />));
}
async function click(text: string) {
  const button = [...document.querySelectorAll("button")].find(
    (b) => b.textContent?.trim() === text,
  );
  expect(button).toBeDefined();
  await act(async () => button!.click());
}
afterEach(async () => {
  if (root) await act(async () => root.unmount());
});

test("list is the default view; choosing a mask does not activate or open editor", async () => {
  await mount();
  expect(document.querySelector("form")).toBeNull();
  await click("A");
  expect(activations).toEqual([]);
  expect(document.querySelector("form")).toBeNull();
  await click(zh.chat.maskConfirmSelection);
  expect(activations).toEqual(["A"]);
  expect(document.getElementById("nj_mask_dialog")).toBeNull();
});
async function clickAria(label: string) {
  const button = document.querySelector(
    `button[aria-label="${label}"]`,
  ) as HTMLButtonElement;
  expect(button).not.toBeNull();
  await act(async () => button.click());
}
test("pencil opens editor without changing selection; back returns to list", async () => {
  await mount();
  await clickAria("编辑面具：A");
  expect(
    (document.querySelector("input[required]") as HTMLInputElement).value,
  ).toBe("A");
  expect(activations).toEqual([]);
  expect(document.querySelector("details")?.open).toBe(false);
  await clickAria(zh.chat.maskBack);
  expect(document.querySelector("form")).toBeNull();
});
test("reopening always shows the chooser, not a long form", async () => {
  await mount();
  await clickAria("编辑面具：A");
  await clickAria(zh.chat.maskClose);
  await click("Open");
  expect(document.querySelector("form")).toBeNull();
  await clickAria("编辑面具：A");
  expect(
    (document.querySelector("input[required]") as HTMLInputElement).value,
  ).toBe("A");
});
test("deactivation requires the explicit footer action", async () => {
  await mount();
  await click("A");
  await click(zh.chat.maskConfirmSelection);
  await click("Open");
  await click(zh.chat.maskNoActive);
  expect(activations).toEqual(["A"]);
  await click(zh.chat.maskConfirmSelection);
  expect(activations).toEqual(["A", null]);
});
test("failed activation keeps chooser open and the previous binding", async () => {
  await mount();
  rejectActivation = true;
  await click("A");
  await click(zh.chat.maskConfirmSelection);
  expect(document.querySelector("output")?.textContent).toBe("none");
  expect(document.querySelector('[role="alert"]')).not.toBeNull();
  expect(document.getElementById("nj_mask_dialog")).not.toBeNull();
});
test("default stars never change the current session", async () => {
  await mount();
  await click("B");
  await click(zh.chat.maskConfirmSelection);
  await click("Open");
  await clickAria("A：设为默认");
  await clickAria("无面具：设为默认");
  expect(defaultClears).toBe(1);
  expect(activations).toEqual(["B"]);
  expect(
    document
      .querySelector('button[aria-label="无面具：设为默认"]')
      ?.getAttribute("aria-pressed"),
  ).toBe("true");
  expect(document.querySelector("#nj_mask_dialog output")).toBeNull();
});
test("failed default clear leaves the previous star on", async () => {
  await mount();
  await clickAria("A：设为默认");
  rejectDefaultClear = true;
  await clickAria("无面具：设为默认");
  expect(
    document
      .querySelector('button[aria-label="A：取消默认"]')
      ?.getAttribute("aria-pressed"),
  ).toBe("true");
  expect(activations).toEqual([]);
});
test("new mask has only Save, no combined Save and Use", async () => {
  await mount();
  await clickAria(zh.chat.maskNew);
  expect(document.querySelector("form")).not.toBeNull();
  expect(document.querySelector("form")?.textContent).not.toContain(
    zh.chat.maskSaveAndUse,
  );
  const save = [...document.querySelectorAll("button")].find(
    (b) => b.textContent?.trim() === zh.chat.maskSave,
  );
  expect(save?.disabled).toBe(true);
});
test("a rejected request also handles exceptions without closing", async () => {
  await mount();
  throwActivation = true;
  await click("A");
  await click(zh.chat.maskConfirmSelection);
  expect(document.querySelector('[role="alert"]')?.textContent).toBe(
    zh.chat.maskOperationFailed,
  );
});

test("limited accounts at two masks cannot add, but can edit and use existing masks", async () => {
  await mount(false);
  const add = document.querySelector(`button[aria-label="${zh.chat.maskNew}"]`) as HTMLButtonElement;
  expect(add.disabled).toBe(true);
  await clickAria("编辑面具：A");
  expect(document.querySelector("form")).not.toBeNull();
  await clickAria(zh.chat.maskBack);
  await click("A");
  await click(zh.chat.maskConfirmSelection);
  expect(activations).toEqual(["A"]);
});

test("no mask does not occupy a quota slot", async () => {
  await mount(false, fixtures.slice(0, 1));
  expect((document.querySelector(`button[aria-label="${zh.chat.maskNew}"]`) as HTMLButtonElement).disabled).toBe(false);
  await clickAria(zh.chat.maskNew);
  expect(document.querySelector("form")).not.toBeNull();
});

test("expired membership with more than two masks retains access to every existing mask", async () => {
  await mount(false, [...fixtures, {...fixtures[0],id:"C",name:"C"}]);
  expect((document.querySelector(`button[aria-label="${zh.chat.maskNew}"]`) as HTMLButtonElement).disabled).toBe(true);
  await click("C");
  await click(zh.chat.maskConfirmSelection);
  expect(activations).toEqual(["C"]);
});

test("unlimited benefit permits creating beyond the basic quota", async () => {
  await mount(true);
  await clickAria(zh.chat.maskNew);
  expect(document.querySelector("form")).not.toBeNull();
});
