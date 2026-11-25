/** Blocked staging experiment: does not preserve composer merge/admission semantics.
 * Never apply directly. Does not execute captured scripts. */
import { createHash } from "node:crypto";
import { JSDOM } from "jsdom";

const CONTROLLERS = new Set([
  "6f929f3c0e04d9e9cc18a059d12641626c6e264551881103fed4422137c1e61b",
  "16d4301759a80fe270ddc79ebd83d063bf800152d63e40fbd7a7fee9f14de660",
]);
const digest = (s: string) =>
  createHash("sha256").update(s.replace(/\r\n/g, "\n").trim()).digest("hex");
const OLD_HANDLER =
  // biome-ignore lint/suspicious/noTemplateCurlyInString: exact public JavaScript literal, not a host interpolation
  'function handleSendBtn() {\n    let fake = document.getElementById(\'fakeInput\');\n    let raw = fake.value.trim();\n    let el = findRealInput();\n    if (!el) { showToast("❌ 无法连接主界面"); return; }\n    if (raw) {\n        let fmt = `$发送消息：${raw}`;\n        let val = el.value || "";\n        let newVal = val + (val ? " " : "") + fmt;\n        let setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;\n        if(setter) { setter.call(el, newVal); } else { el.value = newVal; }\n        el.dispatchEvent(new Event(\'input\', { bubbles: true }));\n    }\n    setTimeout(() => {\n        let btn = null;\n        try {\n            const doc = window.parent.document;\n            btn = doc.querySelector(\'#mufy_chat_input_box .justify-end button\') || doc.getElementById(\'send_but\') || doc.querySelector(\'button[class*="Send"]\'); \n        } catch(e){}\n        if (btn) { btn.click(); showToast("🚀 已发送"); fake.value = ""; } \n        else { showToast("⚠️ 请手动点击主界面发送"); }\n    }, 100);\n}\n';
export const KNOWN_PHONE_SEND_HANDLER =
  // biome-ignore lint/suspicious/noTemplateCurlyInString: staged JavaScript literal is interpreted only inside its own sandbox
  'function handleSendBtn() {\n    let fake = document.getElementById(\'fakeInput\');\n    let btn = document.getElementById(\'sendBtn\');\n    if (!fake || !btn) return;\n    let raw = fake.value.trim();\n    if (!raw) { showToast("⚠️ 请输入消息"); return; }\n    if (btn.dataset.dearmSendPending === \'1\') { showToast("⏳ 正在发送，请稍候"); return; }\n    if (!window.host || typeof window.host.sendMessage !== \'function\') { showToast("❌ 无法连接主界面"); return; }\n    let originalDraft = fake.value;\n    let wasDisabled = btn.disabled;\n    btn.dataset.dearmSendPending = \'1\';\n    btn.disabled = true;\n    return Promise.resolve().then(() => window.host.sendMessage(`$发送消息：${raw}`)).then(() => {\n        if (fake.value === originalDraft) fake.value = "";\n        showToast("🚀 已发送");\n    }).catch(() => {\n        showToast("❌ 发送失败，请重试");\n    }).finally(() => {\n        delete btn.dataset.dearmSendPending;\n        btn.disabled = wasDisabled;\n    });\n}\n';
export function adaptKnownPublicPhoneSend(input: string) {
  const unchanged = (reason: string) => ({
    html: input,
    adapted: false,
    reason,
    controllerCount: 0,
    runtimeVerified: false as const,
    readyForApplication: false as const,
  });
  const dom = new JSDOM(input),
    doc = dom.window.document;
  const ids = [
    "fakeInput",
    "sendBtn",
    "chatTitle",
    "chat-container",
    "toast",
    "plusBtn",
    "box",
  ];
  const validIds = ids.every(
    (id) => doc.querySelectorAll(`[id="${id}"]`).length === 1,
  );
  const send = doc.querySelector("#sendBtn");
  const action = send?.getAttribute("onclick") === "handleSendBtn()";
  const scripts = [...doc.scripts].filter((s) =>
    CONTROLLERS.has(digest(s.textContent ?? "")),
  );
  dom.window.close();
  if (!validIds || !action || scripts.length !== 1)
    return unchanged("EXACT_PUBLIC_PHONE_CONTROLLER_AND_CONTROLS_REQUIRED");
  let count = 0;
  const html = input.replace(
    /<script\b([^>]*)>([\s\S]*?)<\/script>/gi,
    (whole, attrs: string, code: string) => {
      if (!CONTROLLERS.has(digest(code))) return whole;
      const normalized = code.replace(/\r\n/g, "\n");
      if (normalized.split(OLD_HANDLER).length !== 2)
        throw new Error("EXACT_PHONE_HANDLER_SERIALIZATION_CHANGED");
      count++;
      return `<script${attrs}>${normalized.replace(OLD_HANDLER, KNOWN_PHONE_SEND_HANDLER)}</script>`;
    },
  );
  if (count !== 1) throw new Error("EXACT_PHONE_CONTROLLER_COUNT_CHANGED");
  return {
    html,
    adapted: true,
    reason: "EXPERIMENT_BLOCKED_COMPOSER_MERGE_AND_ADMISSION_FEEDBACK_MISSING",
    controllerCount: count,
    runtimeVerified: false as const,
    readyForApplication: false as const,
  };
}

/** Requires the separately reviewed append-and-send admission wiring; still blocked. */
export const KNOWN_PHONE_APPEND_SEND_HANDLER = `function handleSendBtn() {
    let fake = document.getElementById('fakeInput');
    let btn = document.getElementById('sendBtn');
    if (!fake || !btn) return;
    if (btn.dataset.dearmSendPending === '1') { showToast("⏳ 正在发送，请稍候"); return; }
    if (!window.host || typeof window.host.sendMessage !== 'function') { showToast("❌ 无法连接主界面"); return; }
    if (fake.dataset.dearmDraftVersionBound !== '1') {
        fake.dataset.dearmDraftVersionBound = '1';
        fake.dataset.dearmDraftVersion = '0';
        fake.addEventListener('input', () => {
            fake.dataset.dearmDraftVersion = String(Number(fake.dataset.dearmDraftVersion || '0') + 1);
        });
    }
    let originalDraft = fake.value;
    let originalDraftVersion = fake.dataset.dearmDraftVersion;
    let raw = originalDraft.trim();
    let command = raw ? '$发送消息：' + raw : '';
    let wasDisabled = btn.disabled;
    btn.dataset.dearmSendPending = '1';
    btn.disabled = true;
    return Promise.resolve().then(() => window.host.sendMessage(command, {composerMode:'append-and-send'})).then((admission) => {
        if (!admission || admission.accepted !== true) {
            showToast(admission && admission.reason === 'busy' ? "⏳ 主对话正忙，草稿已保留" : "⚠️ 尚未接纳发送，草稿已保留");
            return;
        }
        if (fake.value === originalDraft && fake.dataset.dearmDraftVersion === originalDraftVersion) fake.value = "";
        showToast("🚀 已提交发送");
    }).catch(() => {
        showToast("❌ 发送失败，草稿已保留");
    }).finally(() => {
        delete btn.dataset.dearmSendPending;
        btn.disabled = wasDisabled;
    });
}
`;
export function adaptKnownPublicPhoneAppendSend(input: string) {
  const experiment = adaptKnownPublicPhoneSend(input);
  if (!experiment.adapted) return experiment;
  if (experiment.html.split(KNOWN_PHONE_SEND_HANDLER).length !== 2)
    throw new Error("EXACT_PHONE_APPEND_HANDLER_BOUNDARY_CHANGED");
  return {
    ...experiment,
    html: experiment.html.replace(
      KNOWN_PHONE_SEND_HANDLER,
      KNOWN_PHONE_APPEND_SEND_HANDLER,
    ),
    reason:
      "BLOCKED_UNTIL_APPEND_SEND_ADMISSION_WIRING_AND_REAL_UI_VERIFICATION",
    readyForApplication: false as const,
  };
}
