import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import {
  adaptKnownPublicPhoneAppendSend,
  adaptKnownPublicPhoneSend,
  KNOWN_PHONE_APPEND_SEND_HANDLER,
  KNOWN_PHONE_SEND_HANDLER,
} from "../mufy-public-phone-send-adapter";

const capture = JSON.parse(
  readFileSync(
    "outputs/mufy-rank53-70-20261111/rank60/public-capture.json",
    "utf8",
  ),
) as { documents: string[] };
const source = capture.documents[3];
const owner = readFileSync(
  "outputs/mufy-rank81-90-20261111/rank60-audit/owner-opening-current-before-phone-send.html",
  "utf8",
);
function harness(
  send: (text: string, options?: unknown) => Promise<unknown>,
  handler = KNOWN_PHONE_SEND_HANDLER,
) {
  let onInput: (() => void) | undefined;
  const fake = {
    value: " hello ",
    dataset: {} as Record<string, string>,
    addEventListener: (_name: string, fn: () => void) => {
      onInput = fn;
    },
  };
  const btn: { dataset: Record<string, string>; disabled: boolean } = {
    dataset: {},
    disabled: false,
  };
  const notices: string[] = [];
  const document = {
    getElementById: (id: string) =>
      id === "fakeInput" ? fake : id === "sendBtn" ? btn : null,
  };
  const invoke = new Function(
    "document",
    "window",
    "showToast",
    `${handler}; return handleSendBtn;`,
  )(document, { host: { sendMessage: send } }, (s: string) =>
    notices.push(s),
  ) as () => Promise<void> | undefined;
  return {
    fake,
    btn,
    notices,
    invoke,
    edit: (text: string) => {
      fake.value = text;
      onInput?.();
    },
  };
}
describe("finite public phone send adapter", () => {
  test("source and current owner exact controllers adapt; ordinary HTML/style/stickers and other scripts stay intact", () => {
    for (const input of [source, owner]) {
      const r = adaptKnownPublicPhoneSend(input);
      expect(r.adapted).toBe(true);
      expect(r.controllerCount).toBe(1);
      expect(r.runtimeVerified).toBe(false);
      const before = new JSDOM(input),
        after = new JSDOM(r.html);
      expect(after.window.document.querySelectorAll("style").length).toBe(
        before.window.document.querySelectorAll("style").length,
      );
      expect(
        [...after.window.document.querySelectorAll("style")].map(
          (x) => x.textContent,
        ),
      ).toEqual(
        [...before.window.document.querySelectorAll("style")].map(
          (x) => x.textContent,
        ),
      );
      expect(after.window.document.querySelector("#box")?.outerHTML).toBe(
        before.window.document.querySelector("#box")?.outerHTML,
      );
      const originalInsert = input.slice(
        input.indexOf("function insertSticker"),
        input.indexOf("function handleSendBtn"),
      );
      expect(r.html).toContain(originalInsert);
      expect(r.html).toContain("function findRealInput()");
      before.window.close();
      after.window.close();
    }
  });
  test("unknown controller/control/program is unchanged, adaptation is idempotent", () => {
    for (const input of [
      source.replace("function handleSendBtn()", "function changedSendBtn()"),
      source.replace('id="sendBtn"', 'id="unknownSendBtn"'),
      "<script>function handleSendBtn(){window.parent.document.body.click()}</script>",
    ])
      expect(adaptKnownPublicPhoneSend(input).html).toBe(input);
    const once = adaptKnownPublicPhoneSend(source);
    expect(adaptKnownPublicPhoneSend(once.html).html).toBe(once.html);
    expect(adaptKnownPublicPhoneSend(once.html).adapted).toBe(false);
  });
  test("no eager send, empty draft skipped, pending blocks repeat and success clears only after promise", async () => {
    const calls: string[] = [];
    let resolve!: () => void;
    const pending = new Promise<void>((r) => {
      resolve = r;
    });
    const h = harness((text) => {
      calls.push(text);
      return pending;
    });
    expect(calls).toEqual([]);
    h.fake.value = " ";
    expect(h.invoke()).toBeUndefined();
    expect(calls).toEqual([]);
    h.fake.value = " hello ";
    const result = h.invoke();
    expect(h.fake.value).toBe(" hello ");
    expect(h.btn.dataset.dearmSendPending).toBe("1");
    expect(h.invoke()).toBeUndefined();
    await Promise.resolve();
    expect(calls).toEqual(["$发送消息：hello"]);
    resolve();
    await result;
    expect(h.fake.value).toBe("");
    expect(h.btn.disabled).toBe(false);
    expect(h.btn.dataset.dearmSendPending).toBeUndefined();
    expect(h.notices).toContain("🚀 已发送");
  });
  test("host rejection keeps draft, reports failure and restores local busy state", async () => {
    const h = harness(async () => {
      throw Error("busy or unavailable");
    });
    await h.invoke();
    expect(h.fake.value).toBe(" hello ");
    expect(h.btn.disabled).toBe(false);
    expect(h.btn.dataset.dearmSendPending).toBeUndefined();
    expect(h.notices).toContain("❌ 发送失败，请重试");
  });
  test("successful completion never erases a new draft typed while pending", async () => {
    let resolve!: () => void;
    const h = harness(
      () =>
        new Promise<void>((r) => {
          resolve = r;
        }),
    );
    const p = h.invoke();
    await Promise.resolve();
    h.fake.value = "new draft";
    resolve();
    await p;
    expect(h.fake.value).toBe("new draft");
  });
  test("v2 passes append mode, accepts empty phone for main-only submission, requires explicit accepted ack", async () => {
    const calls: unknown[] = [];
    const h = harness(async (text, opts) => {
      calls.push([text, opts]);
      return { accepted: true };
    }, KNOWN_PHONE_APPEND_SEND_HANDLER);
    h.fake.value = "";
    await h.invoke();
    expect(calls).toEqual([["", { composerMode: "append-and-send" }]]);
    expect(h.notices).toContain("🚀 已提交发送");
    for (const reply of [
      undefined,
      null,
      { accepted: false, reason: "busy" },
      { accepted: false, reason: "empty" },
    ]) {
      const blocked = harness(
        async () => reply,
        KNOWN_PHONE_APPEND_SEND_HANDLER,
      );
      await blocked.invoke();
      expect(blocked.fake.value).toBe(" hello ");
      expect(blocked.notices).not.toContain("🚀 已提交发送");
    }
    const v2 = adaptKnownPublicPhoneAppendSend(owner);
    expect(v2.adapted).toBe(true);
    expect(v2.readyForApplication).toBe(false);
    expect(v2.html).toContain(KNOWN_PHONE_APPEND_SEND_HANDLER);
  });
  test("v2 retains a same-text new phone draft edited while admission is pending", async () => {
    let resolve!: (value: unknown) => void;
    const h = harness(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
      KNOWN_PHONE_APPEND_SEND_HANDLER,
    );
    const p = h.invoke();
    await Promise.resolve();
    h.edit("new");
    h.edit(" hello ");
    resolve({ accepted: true });
    await p;
    expect(h.fake.value).toBe(" hello ");
    expect(h.btn.dataset.dearmSendPending).toBeUndefined();
  });
});
