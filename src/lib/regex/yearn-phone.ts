import type { Locale } from "@/i18n/config";

/** Canonical persisted rule copy; request-localized names live in dictionaries. */
export const YEARN_PHONE_RULE_NAME = "Dearm Phone";
export const YEARN_PHONE_SAMPLE_TEXT = [
  "<phone>",
  "[wechat]",
  "user: What?|||Why are you never full?",
  "ai: Canned food!|||I want canned food!|||Lots and lots of canned food!",
  "[notes]",
  "Today 14:30|Shopping list|Buy cat food, hairball gel, and lots of canned food",
  "Yesterday 20:00|Cat diary|The boss is upset because I got home late",
  "Monday|Reminder|Take MUMU for the vaccination!",
  "[wallet]",
  "Harbor Bank|Debit card|8888|red",
  "North Bank|Credit card|1024|blue",
  "MUMU's snack fund|Snacks only|0001|gray",
  "[weibo]",
  "MUMU's daily life|Just now|🐱|Another hungry-cat day. Why isn't my human home?",
  "Pet fans|2 hours ago|🐶|One easy way to cheer up a cat: open a fresh can",
  "</phone>",
].join("\n");

export interface YearnPhoneUi {
  apps: {
    wechat: string;
    notes: string;
    wallet: string;
    weibo: string;
    baidu: string;
    status: string;
  };
  moreAria: string;
  emptyMessages: string;
  inputPlaceholder: string;
  send: string;
  emptyNotes: string;
  search: string;
  emptyCards: string;
  emptyPosts: string;
  unconfiguredApp: string;
  homeAria: string;
  uninstalledApp: string;
}

/**
 * Embedded in the canonical iframe asset. The host selects exactly one entry
 * after host-ready, using context.locale; selectors and payload grammar stay
 * locale-neutral.
 */
export const YEARN_PHONE_UI_BY_LOCALE: Record<Locale, YearnPhoneUi> = {
  "zh-TW": {
    apps: {
      wechat: "WeChat",
      notes: "備忘錄",
      wallet: "錢包",
      weibo: "微博",
      baidu: "百度",
      status: "狀態",
    },
    moreAria: "更多",
    emptyMessages: "還沒有收到訊息。",
    inputPlaceholder: "輸入內容…",
    send: "傳送",
    emptyNotes: "還沒有寫下任何備忘。",
    search: "搜尋",
    emptyCards: "還沒有任何卡片。",
    emptyPosts: "還沒有微博貼文。",
    unconfiguredApp: "這個 app 尚未設定劇情內容",
    homeAria: "返回主畫面",
    uninstalledApp: "這個 app 尚未安裝。",
  },
  "ja-JP": {
    apps: {
      wechat: "WeChat",
      notes: "メモ",
      wallet: "ウォレット",
      weibo: "Weibo",
      baidu: "Baidu",
      status: "ステータス",
    },
    moreAria: "その他",
    emptyMessages: "メッセージはまだありません。",
    inputPlaceholder: "メッセージを入力…",
    send: "送信",
    emptyNotes: "メモはまだありません。",
    search: "検索",
    emptyCards: "カードはまだありません。",
    emptyPosts: "投稿はまだありません。",
    unconfiguredApp: "このアプリのシナリオ内容は未設定です",
    homeAria: "ホーム画面へ戻る",
    uninstalledApp: "このアプリはまだインストールされていません。",
  },
  "th-TH": {
    apps: {
      wechat: "WeChat",
      notes: "โน้ต",
      wallet: "กระเป๋าเงิน",
      weibo: "Weibo",
      baidu: "Baidu",
      status: "สถานะ",
    },
    moreAria: "เพิ่มเติม",
    emptyMessages: "ยังไม่มีข้อความ",
    inputPlaceholder: "พิมพ์ข้อความ…",
    send: "ส่ง",
    emptyNotes: "ยังไม่มีบันทึก",
    search: "ค้นหา",
    emptyCards: "ยังไม่มีบัตร",
    emptyPosts: "ยังไม่มีโพสต์",
    unconfiguredApp: "ยังไม่ได้ตั้งค่าเนื้อเรื่องสำหรับแอปนี้",
    homeAria: "กลับไปหน้าหลัก",
    uninstalledApp: "ยังไม่ได้ติดตั้งแอปนี้",
  },
  en: {
    apps: {
      wechat: "WeChat",
      notes: "Notes",
      wallet: "Wallet",
      weibo: "Weibo",
      baidu: "Baidu",
      status: "Status",
    },
    moreAria: "More",
    emptyMessages: "No messages yet.",
    inputPlaceholder: "Type a message…",
    send: "Send",
    emptyNotes: "No notes yet.",
    search: "Search",
    emptyCards: "No cards yet.",
    emptyPosts: "No posts yet.",
    unconfiguredApp: "No story content is configured for this app",
    homeAria: "Return to Home Screen",
    uninstalledApp: "This app is not installed yet.",
  },
};

const YEARN_PHONE_UI_SCRIPT = JSON.stringify(YEARN_PHONE_UI_BY_LOCALE).replace(
  /</g,
  "\\u003c",
);

/**
 * Returns the regex-rule `replacement` for the yearn-phone official pack.
 * Wraps the entire srcdoc payload in an `<artifact>...</artifact>` envelope so
 * segments.ts routes the match to ArtifactIframe (host bridge intact); the
 * srcdoc is just the body markup, since iframe-bridge's buildIframeSrcdoc
 * already injects the doctype, CSP, and `window.host` bridge wrapper.
 *
 * Renamed from `buildYearnPhoneReplacementHtml` (the old name predated the
 * runtime-field removal, when callers had to manually wrap with <artifact>).
 */
export function buildYearnPhoneArtifact() {
  return `<artifact><style>
.nj_phone_shell {
  padding: 8px 0;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  color: #f5f3ff;
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Source Han Sans SC", "Helvetica Neue", Arial, sans-serif;
  user-select: none;
}

.nj_phone_frame {
  position: relative;
  width: 300px;
  height: 640px;
  border-radius: 46px;
  background: #0a0a0c;
  border: 5px solid #c2a265;
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.5),
    0 18px 50px rgba(0, 0, 0, 0.5),
    inset 0 0 0 1px rgba(255, 255, 255, 0.04);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.nj_phone_notch {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 110px;
  height: 30px;
  background: #000;
  border-radius: 0 0 24px 24px;
  z-index: 50;
}

.nj_phone_statusbar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 24px 0;
  font-size: 12px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.92);
  z-index: 40;
  transition: color 0.3s ease;
}

.nj_phone_statusbar--dark {
  color: rgba(0, 0, 0, 0.86);
}

.nj_phone_statusbar_icons {
  display: flex;
  align-items: center;
  gap: 5px;
}

.nj_phone_statusbar_icons svg {
  width: 14px;
  height: 14px;
}

.nj_phone_home_indicator {
  position: absolute;
  bottom: 8px;
  left: 50%;
  transform: translateX(-50%);
  width: 130px;
  height: 5px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.5);
  z-index: 60;
  cursor: pointer;
  border: 0;
  padding: 0;
  transition: background 0.3s ease;
}

.nj_phone_home_indicator:hover {
  background: rgba(255, 255, 255, 0.8);
}

.nj_phone_home_indicator--dark {
  background: rgba(0, 0, 0, 0.3);
}

.nj_phone_home_indicator--dark:hover {
  background: rgba(0, 0, 0, 0.5);
}

.nj_phone_desktop {
  position: absolute;
  inset: 0;
  padding: 112px 40px 0;
  z-index: 0;
}

.nj_phone_grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  column-gap: 40px;
  row-gap: 32px;
  justify-items: center;
}

.nj_phone_app {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: transparent;
  border: 0;
  padding: 0;
  cursor: pointer;
  color: inherit;
}

.nj_phone_app:focus-visible {
  outline: 2px solid rgba(255, 255, 255, 0.6);
  outline-offset: 4px;
  border-radius: 24px;
}

.nj_phone_icon {
  position: relative;
  width: 76px;
  height: 76px;
  border-radius: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.35);
  transition: transform 0.18s ease;
}

.nj_phone_app:active .nj_phone_icon {
  transform: scale(0.9);
}

.nj_phone_icon::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.4);
  mix-blend-mode: overlay;
  pointer-events: none;
}

.nj_phone_icon svg {
  width: 36px;
  height: 36px;
}

.nj_phone_label {
  margin-top: 8px;
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.04em;
  color: rgba(226, 226, 226, 0.96);
}

.nj_phone_app_screen {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: flex;
  flex-direction: column;
  background: #0f0f13;
  transform: scale(0.95) translateY(20%);
  opacity: 0;
  pointer-events: none;
  transform-origin: 50% 75%;
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.nj_phone_app_screen--open {
  transform: scale(1) translateY(0);
  opacity: 1;
  pointer-events: auto;
}

.nj_phone_app_header {
  padding: 48px 16px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.nj_phone_app_title {
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: #fff;
}

.nj_phone_app_more {
  background: transparent;
  border: 0;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  padding: 6px;
  border-radius: 999px;
}

.nj_phone_app_more:hover {
  color: rgba(255, 255, 255, 1);
}

.nj_phone_app_more svg {
  width: 18px;
  height: 18px;
  display: block;
}

.nj_phone_app_body {
  flex: 1;
  overflow-y: auto;
  scrollbar-width: none;
}

.nj_phone_app_body::-webkit-scrollbar {
  display: none;
}

/* WeChat */
.nj_phone_wechat_messages {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 12px 8px 16px;
}

.nj_phone_wechat_row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.nj_phone_wechat_row--user {
  flex-direction: row-reverse;
  padding-left: 12px;
}

.nj_phone_wechat_row--ai {
  padding-right: 12px;
}

.nj_phone_avatar {
  flex: 0 0 auto;
  width: 38px;
  height: 38px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  background: #2a2741;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
}

.nj_phone_wechat_row--user .nj_phone_avatar {
  background: #bde3ff;
}

.nj_phone_bubble {
  max-width: 70%;
  padding: 10px 14px;
  border-radius: 18px;
  font-size: 15px;
  line-height: 1.5;
  word-break: break-word;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.nj_phone_bubble--user {
  background: #05c160;
  color: #fff;
  border-top-right-radius: 4px;
}

.nj_phone_bubble--ai {
  background: #2b2d31;
  color: #e4e4e4;
  border-top-left-radius: 4px;
}

.nj_phone_wechat_footer {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px 28px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  background: #0f0f13;
}

.nj_phone_wechat_input {
  flex: 1;
  height: 40px;
  border-radius: 12px;
  background: #1c1c1e;
  border: 1px solid transparent;
  color: #fff;
  padding: 0 14px;
  font-size: 14px;
  outline: none;
}

.nj_phone_wechat_input::placeholder {
  color: rgba(255, 255, 255, 0.45);
}

.nj_phone_wechat_input:focus {
  border-color: rgba(5, 193, 96, 0.5);
}

.nj_phone_wechat_send {
  height: 40px;
  padding: 0 16px;
  border-radius: 12px;
  background: #05c160;
  color: #fff;
  border: 0;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.nj_phone_wechat_send:hover {
  background: #04b055;
}

.nj_phone_wechat_send:disabled {
  background: #1f1f22;
  color: rgba(255, 255, 255, 0.4);
  cursor: not-allowed;
  box-shadow: none;
}

/* Notes */
.nj_phone_notes_screen {
  background: #f2f2f6;
  color: #000;
}

.nj_phone_notes_screen .nj_phone_app_header {
  background: #f2f2f6;
  border-bottom-color: rgba(0, 0, 0, 0.06);
}

.nj_phone_notes_screen .nj_phone_app_title {
  color: #111;
  font-size: 28px;
  font-weight: 700;
}

.nj_phone_notes_search {
  margin: 4px 16px 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(120, 120, 128, 0.12);
  border-radius: 12px;
  padding: 8px 12px;
  color: rgba(60, 60, 67, 0.6);
  font-size: 14px;
}

.nj_phone_notes_search svg {
  width: 16px;
  height: 16px;
}

.nj_phone_note_list {
  padding: 0 16px 24px;
}

.nj_phone_note {
  background: #fff;
  border-radius: 14px;
  padding: 14px 16px;
  margin-bottom: 10px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

.nj_phone_note_title {
  font-size: 16px;
  font-weight: 600;
  color: #000;
  margin: 0 0 4px;
}

.nj_phone_note_meta {
  display: flex;
  align-items: center;
  gap: 10px;
  color: rgba(60, 60, 67, 0.6);
  font-size: 13px;
}

.nj_phone_note_date {
  flex-shrink: 0;
}

.nj_phone_note_content {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Wallet */
.nj_phone_wallet_screen {
  background: #000;
}

.nj_phone_wallet_screen .nj_phone_app_title {
  color: #fff;
  font-size: 28px;
  font-weight: 700;
}

.nj_phone_wallet_screen .nj_phone_app_more {
  background: rgba(255, 255, 255, 0.06);
  border-radius: 999px;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.nj_phone_wallet_list {
  padding: 8px 16px 60px;
}

.nj_phone_wallet_card {
  position: relative;
  height: 180px;
  border-radius: 18px;
  padding: 18px;
  color: #fff;
  margin-bottom: -40px;
  box-shadow:
    0 12px 24px rgba(0, 0, 0, 0.45),
    inset 0 0 0 1px rgba(255, 255, 255, 0.08);
  transition: transform 0.2s ease;
  cursor: pointer;
}

.nj_phone_wallet_card:hover {
  transform: translateY(-8px);
}

.nj_phone_wallet_card:last-child {
  margin-bottom: 0;
}

.nj_phone_wallet_bank {
  font-size: 17px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.nj_phone_wallet_number {
  position: absolute;
  left: 18px;
  bottom: 22px;
  font-size: 18px;
  letter-spacing: 0.12em;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.nj_phone_wallet_type {
  position: absolute;
  right: 18px;
  bottom: 22px;
  font-size: 12px;
  opacity: 0.85;
}

.nj_phone_wallet_card--red { background: linear-gradient(135deg, #ef4444, #b91c1c); }
.nj_phone_wallet_card--blue { background: linear-gradient(135deg, #3b82f6, #1e3a8a); }
.nj_phone_wallet_card--gray { background: linear-gradient(135deg, #4b5563, #111827); }
.nj_phone_wallet_card--gold { background: linear-gradient(135deg, #f59e0b, #92400e); }
.nj_phone_wallet_card--purple { background: linear-gradient(135deg, #a78bfa, #5b21b6); }
.nj_phone_wallet_card--green { background: linear-gradient(135deg, #10b981, #065f46); }

/* Weibo */
.nj_phone_weibo_screen {
  background: #f5f5f7;
}

.nj_phone_weibo_screen .nj_phone_app_header {
  background: rgba(255, 255, 255, 0.92);
  border-bottom-color: rgba(0, 0, 0, 0.08);
  justify-content: center;
}

.nj_phone_weibo_screen .nj_phone_app_title {
  color: #111;
  font-size: 16px;
  font-weight: 600;
}

.nj_phone_weibo_screen .nj_phone_app_more {
  display: none;
}

.nj_phone_weibo_list {
  padding: 0 0 32px;
}

.nj_phone_weibo_post {
  background: #fff;
  padding: 16px;
  margin-bottom: 8px;
}

.nj_phone_weibo_head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}

.nj_phone_weibo_avatar {
  width: 40px;
  height: 40px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  background: rgba(255, 159, 67, 0.18);
}

.nj_phone_weibo_author {
  font-size: 14px;
  font-weight: 700;
  color: #ff7a45;
}

.nj_phone_weibo_time {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.45);
  margin-top: 2px;
}

.nj_phone_weibo_body {
  font-size: 15px;
  line-height: 1.6;
  color: #222;
}

.nj_phone_weibo_actions {
  display: flex;
  justify-content: space-between;
  padding: 12px 32px 0;
  margin-top: 12px;
  border-top: 1px solid rgba(0, 0, 0, 0.05);
  color: rgba(0, 0, 0, 0.45);
}

.nj_phone_weibo_actions svg {
  width: 18px;
  height: 18px;
}

/* Placeholder */
.nj_phone_placeholder {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.5);
  text-align: center;
  padding: 0 32px;
  gap: 12px;
}

.nj_phone_placeholder svg {
  width: 56px;
  height: 56px;
  opacity: 0.6;
}

.nj_phone_placeholder_text {
  font-size: 14px;
  line-height: 1.6;
}
</style>
<script>
(function () {
  function escapeHtml(input) {
    return String(input == null ? "" : input).replace(/[&<>"]/g, function (ch) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch];
    });
  }

  function timeNow() {
    var d = new Date();
    var h = String(d.getHours()).padStart(2, "0");
    var m = String(d.getMinutes()).padStart(2, "0");
    return h + ":" + m;
  }

  function parsePayload(raw) {
    var sections = { wechat: [], notes: [], wallet: [], weibo: [] };
    if (!raw) return sections;
    var lines = String(raw).split(/\\r?\\n/);
    var current = null;
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) continue;
      var header = line.match(/^\\[(wechat|notes|wallet|weibo)\\]$/);
      if (header) { current = header[1]; continue; }
      if (!current) continue;
      if (current === "wechat") {
        var w = line.match(/^(user|ai)\\s*:\\s*(.*)$/i);
        if (!w) continue;
        var role = w[1].toLowerCase();
        var msgs = w[2].split("|||").map(function (s) { return s.trim(); }).filter(Boolean);
        for (var j = 0; j < msgs.length; j++) sections.wechat.push({ role: role, text: msgs[j] });
      } else {
        var parts = line.split("|").map(function (s) { return s.trim(); });
        if (current === "notes" && parts.length >= 3) {
          sections.notes.push({ date: parts[0], title: parts[1], content: parts.slice(2).join("|") });
        } else if (current === "wallet" && parts.length >= 3) {
          sections.wallet.push({ bank: parts[0], type: parts[1], number: parts[2], color: parts[3] || "red" });
        } else if (current === "weibo" && parts.length >= 4) {
          sections.weibo.push({ author: parts[0], time: parts[1], avatar: parts[2], content: parts.slice(3).join("|") });
        }
      }
    }
    return sections;
  }

  var ICON = {
    signal: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M2 22h2v-4H2v4Zm5 0h2V14H7v8Zm5 0h2V8h-2v14Zm5 0h2V2h-2v20Z"/></svg>',
    wifi: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 18.5a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm0-5a6.5 6.5 0 0 0-4.6 1.9l1.4 1.4a4.5 4.5 0 0 1 6.4 0l1.4-1.4A6.5 6.5 0 0 0 12 13.5Zm0-5a11.5 11.5 0 0 0-8.1 3.4l1.4 1.4a9.5 9.5 0 0 1 13.4 0l1.4-1.4A11.5 11.5 0 0 0 12 8.5Z"/></svg>',
    battery: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="7" width="18" height="10" rx="2"/><rect x="3.5" y="8.5" width="13" height="7" rx="1" fill="currentColor"/><path d="M21 10v4" stroke-linecap="round"/></svg>',
    more: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="6" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="18" cy="12" r="1.5"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5 15.4 17.5M15.4 6.5 8.6 10.5"/></svg>',
    comment: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z"/></svg>',
    heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
    chat: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor"><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z"/></svg>',
    note: '<svg viewBox="0 0 24 24" fill="none" stroke="#FF9F43" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
    wallet: '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12V8H4a2 2 0 0 1 0-4h12v4"/><rect x="2" y="6" width="20" height="14" rx="2"/><circle cx="16" cy="13" r="1.5" fill="white"/></svg>',
    weibo: '<svg viewBox="0 0 24 24" fill="#FF4757" stroke="#FF4757" stroke-width="1.5"><circle cx="12" cy="12" r="3"/><path d="M5 5l2 2M19 5l-2 2M5 19l2-2M19 19l-2-2M3 12h2M19 12h2M12 3v2M12 19v2" stroke-linecap="round"/></svg>',
    paw: '<svg viewBox="0 0 24 24" fill="#1E90FF" stroke="#1E90FF" stroke-width="1.2"><ellipse cx="6" cy="9" rx="1.8" ry="2.3"/><ellipse cx="10" cy="6.5" rx="1.8" ry="2.3"/><ellipse cx="14" cy="6.5" rx="1.8" ry="2.3"/><ellipse cx="18" cy="9" rx="1.8" ry="2.3"/><path d="M12 11c-3 0-5.5 2.2-5.5 5 0 1.7 1.4 3 3.3 3 .9 0 1.4-.3 2.2-.3.8 0 1.3.3 2.2.3 1.9 0 3.3-1.3 3.3-3 0-2.8-2.5-5-5.5-5z"/></svg>',
    heartFill: '<svg viewBox="0 0 24 24" fill="#FF6B81"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
  };

  var UI_BY_LOCALE = ${YEARN_PHONE_UI_SCRIPT};
  var UI = UI_BY_LOCALE.en;

  function localeKey(value) {
    var locale = String(value || "").replace(/_/g, "-").toLowerCase();
    if (locale === "zh" || locale.indexOf("zh-") === 0) return "zh-TW";
    if (locale.indexOf("ja") === 0) return "ja-JP";
    if (locale.indexOf("th") === 0) return "th-TH";
    return "en";
  }

  function buildApps(ui) {
    return [
      { id: "wechat", label: ui.apps.wechat, bg: "#cffdd5", icon: ICON.chat, color: "#FF6B6B", available: true },
      { id: "notes", label: ui.apps.notes, bg: "#ffefc2", icon: ICON.note, available: true },
      { id: "wallet", label: ui.apps.wallet, bg: "#3b4354", icon: ICON.wallet, available: true },
      { id: "weibo", label: ui.apps.weibo, bg: "#ffedc2", icon: ICON.weibo, available: true },
      { id: "baidu", label: ui.apps.baidu, bg: "#d4e4ff", icon: ICON.paw, available: false },
      { id: "status", label: ui.apps.status, bg: "#ffe0ea", icon: ICON.heartFill, available: false },
    ];
  }

  var APPS = buildApps(UI);

  function appButton(app) {
    return [
      '<button type="button" class="nj_phone_app" data-app="' + app.id + '">',
      '  <span class="nj_phone_icon" style="background:' + app.bg + '">' + app.icon + '</span>',
      '  <span class="nj_phone_label">' + escapeHtml(app.label) + '</span>',
      '</button>',
    ].join("");
  }

  function statusBarMarkup(theme) {
    return [
      '<div class="nj_phone_statusbar' + (theme === "dark" ? " nj_phone_statusbar--dark" : "") + '">',
      '  <span data-clock>' + timeNow() + '</span>',
      '  <span class="nj_phone_statusbar_icons">' + ICON.signal + ICON.wifi + ICON.battery + '</span>',
      '</div>',
      '<div class="nj_phone_notch"></div>',
    ].join("");
  }

  function appHeader(title, opts) {
    opts = opts || {};
    return [
      '<div class="nj_phone_app_header">',
      '  <div style="width:24px"></div>',
      '  <div class="nj_phone_app_title">' + escapeHtml(title) + '</div>',
      '  <button type="button" class="nj_phone_app_more" aria-label="' + escapeHtml(UI.moreAria) + '">' + (opts.moreIcon || ICON.more) + '</button>',
      '</div>',
    ].join("");
  }

  function wechatMarkup(messages) {
    var rows = messages.map(function (m) {
      var isUser = m.role === "user";
      var cls = isUser ? "nj_phone_wechat_row--user" : "nj_phone_wechat_row--ai";
      var bubbleCls = isUser ? "nj_phone_bubble--user" : "nj_phone_bubble--ai";
      var avatar = isUser ? "🐈‍⬛" : "🐱";
      return [
        '<div class="nj_phone_wechat_row ' + cls + '">',
        '  <div class="nj_phone_avatar">' + avatar + '</div>',
        '  <div class="nj_phone_bubble ' + bubbleCls + '">' + escapeHtml(m.text) + '</div>',
        '</div>',
      ].join("");
    }).join("");
    if (!rows) {
      rows = '<div class="nj_phone_placeholder_text" style="padding:24px 16px;color:rgba(255,255,255,0.45)">' + escapeHtml(UI.emptyMessages) + '</div>';
    }
    return [
      appHeader("MUMU🐱"),
      '<div class="nj_phone_app_body">',
      '  <div class="nj_phone_wechat_messages">' + rows + '</div>',
      '</div>',
      '<div class="nj_phone_wechat_footer">',
      '  <input class="nj_phone_wechat_input" data-wechat-input placeholder="' + escapeHtml(UI.inputPlaceholder) + '" />',
      '  <button type="button" class="nj_phone_wechat_send" data-wechat-send>' + escapeHtml(UI.send) + '</button>',
      '</div>',
    ].join("");
  }

  function notesMarkup(notes) {
    var items = notes.map(function (n) {
      return [
        '<div class="nj_phone_note">',
        '  <h3 class="nj_phone_note_title">' + escapeHtml(n.title) + '</h3>',
        '  <div class="nj_phone_note_meta">',
        '    <span class="nj_phone_note_date">' + escapeHtml(n.date) + '</span>',
        '    <span class="nj_phone_note_content">' + escapeHtml(n.content) + '</span>',
        '  </div>',
        '</div>',
      ].join("");
    }).join("");
    if (!items) {
      items = placeholderMarkup(UI.emptyNotes);
    }
    return [
      '<div class="nj_phone_notes_screen" style="flex:1;display:flex;flex-direction:column;background:#f2f2f6">',
      appHeader(UI.apps.notes),
      '<div class="nj_phone_notes_search">' + ICON.search + '<span>' + escapeHtml(UI.search) + '</span></div>',
      '<div class="nj_phone_app_body">',
      '  <div class="nj_phone_note_list">' + items + '</div>',
      '</div>',
      '</div>',
    ].join("");
  }

  function walletMarkup(cards) {
    var items = cards.map(function (c) {
      var color = ["red", "blue", "gray", "gold", "purple", "green"].indexOf(c.color) >= 0 ? c.color : "red";
      return [
        '<div class="nj_phone_wallet_card nj_phone_wallet_card--' + color + '">',
        '  <div class="nj_phone_wallet_bank">' + escapeHtml(c.bank) + '</div>',
        '  <div class="nj_phone_wallet_number">**** **** **** ' + escapeHtml(c.number) + '</div>',
        '  <div class="nj_phone_wallet_type">' + escapeHtml(c.type) + '</div>',
        '</div>',
      ].join("");
    }).join("");
    if (!items) {
      items = placeholderMarkup(UI.emptyCards);
    }
    return [
      '<div class="nj_phone_wallet_screen" style="flex:1;display:flex;flex-direction:column;background:#000">',
      appHeader(UI.apps.wallet, { moreIcon: ICON.plus }),
      '<div class="nj_phone_app_body">',
      '  <div class="nj_phone_wallet_list">' + items + '</div>',
      '</div>',
      '</div>',
    ].join("");
  }

  function weiboMarkup(posts) {
    var items = posts.map(function (p) {
      return [
        '<div class="nj_phone_weibo_post">',
        '  <div class="nj_phone_weibo_head">',
        '    <div class="nj_phone_weibo_avatar">' + escapeHtml(p.avatar) + '</div>',
        '    <div>',
        '      <div class="nj_phone_weibo_author">' + escapeHtml(p.author) + '</div>',
        '      <div class="nj_phone_weibo_time">' + escapeHtml(p.time) + '</div>',
        '    </div>',
        '  </div>',
        '  <div class="nj_phone_weibo_body">' + escapeHtml(p.content) + '</div>',
        '  <div class="nj_phone_weibo_actions">' + ICON.share + ICON.comment + ICON.heart + '</div>',
        '</div>',
      ].join("");
    }).join("");
    if (!items) {
      items = placeholderMarkup(UI.emptyPosts);
    }
    return [
      '<div class="nj_phone_weibo_screen" style="flex:1;display:flex;flex-direction:column;background:#f5f5f7">',
      appHeader(UI.apps.weibo),
      '<div class="nj_phone_app_body">',
      '  <div class="nj_phone_weibo_list">' + items + '</div>',
      '</div>',
      '</div>',
    ].join("");
  }

  function placeholderMarkup(text) {
    return [
      '<div class="nj_phone_placeholder">',
      '  <div class="nj_phone_placeholder_text">' + escapeHtml(text) + '</div>',
      '</div>',
    ].join("");
  }

  function appScreenMarkup(view, sections) {
    if (view === "wechat") return wechatMarkup(sections.wechat || []);
    if (view === "notes") return notesMarkup(sections.notes || []);
    if (view === "wallet") return walletMarkup(sections.wallet || []);
    if (view === "weibo") return weiboMarkup(sections.weibo || []);
    return [
      appHeader(view || ""),
      '<div class="nj_phone_app_body">',
      placeholderMarkup(UI.unconfiguredApp),
      '</div>',
    ].join("");
  }

  function appTheme(view) {
    if (view === "notes" || view === "weibo") return "dark";
    return "light";
  }

  window.addEventListener("host-ready", function () {
    UI = UI_BY_LOCALE[localeKey(window.host.context.locale)] || UI_BY_LOCALE.en;
    APPS = buildApps(UI);
    var root = document.getElementById("root");
    root.className = "nj_phone_shell";
    var raw = (window.host.context.captureGroups || [])[0] || "";
    var sections = parsePayload(raw);
    var state = { view: null };

    root.innerHTML = [
      '<div class="nj_phone_frame">',
      statusBarMarkup("light"),
      '  <div class="nj_phone_desktop">',
      '    <div class="nj_phone_grid">',
      APPS.map(appButton).join(""),
      '    </div>',
      '  </div>',
      '  <div class="nj_phone_app_screen" data-app-screen></div>',
      '  <button type="button" class="nj_phone_home_indicator" aria-label="' + escapeHtml(UI.homeAria) + '" data-home></button>',
      '</div>',
    ].join("");

    var frame = root.querySelector(".nj_phone_frame");
    var statusbar = frame.querySelector(".nj_phone_statusbar");
    var screen = frame.querySelector("[data-app-screen]");
    var home = frame.querySelector("[data-home]");

    function paintStatusBar(view) {
      var theme = view ? appTheme(view) : "light";
      statusbar.classList.toggle("nj_phone_statusbar--dark", theme === "dark");
      home.classList.toggle("nj_phone_home_indicator--dark", theme === "dark");
    }

    function openApp(view) {
      var app = APPS.find(function (a) { return a.id === view; });
      if (!app) return;
      state.view = view;
      screen.innerHTML = app.available
        ? appScreenMarkup(view, sections)
        : [appHeader(app.label), '<div class="nj_phone_app_body">' + placeholderMarkup(UI.uninstalledApp) + '</div>'].join("");
      screen.classList.add("nj_phone_app_screen--open");
      paintStatusBar(view);
      bindAppEvents(view);
      try { window.host.setComponentState({ view: view }); } catch (e) {}
    }

    function closeApp() {
      state.view = null;
      screen.classList.remove("nj_phone_app_screen--open");
      paintStatusBar(null);
      setTimeout(function () {
        if (!state.view) screen.innerHTML = "";
      }, 300);
      try { window.host.setComponentState({ view: null }); } catch (e) {}
    }

    function bindAppEvents(view) {
      if (view !== "wechat") return;
      var input = screen.querySelector("[data-wechat-input]");
      var send = screen.querySelector("[data-wechat-send]");
      if (!input || !send) return;
      function update() { send.disabled = input.value.trim().length === 0; }
      update();
      input.addEventListener("input", update);
      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter") { e.preventDefault(); send.click(); }
      });
      send.addEventListener("click", function () {
        var text = input.value.trim();
        if (!text) return;
        send.disabled = true;
        window.host.sendMessage(text).catch(function () {});
        input.value = "";
      });
    }

    frame.querySelectorAll("[data-app]").forEach(function (btn) {
      btn.addEventListener("click", function () { openApp(btn.getAttribute("data-app")); });
    });

    home.addEventListener("click", function () {
      if (state.view) closeApp();
    });

    function tickClock() {
      var nodes = frame.querySelectorAll("[data-clock]");
      var now = timeNow();
      nodes.forEach(function (n) { n.textContent = now; });
    }
    setInterval(tickClock, 30 * 1000);

    paintStatusBar(null);
  });
})();
</script>
<div id="root"></div></artifact>`;
}
