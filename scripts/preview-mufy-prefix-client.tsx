/** Local fixture only. Submit increments a counter; never contacts a model. */
import { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { MufyPrefixPanel } from "../src/components/chat/MufyPrefixPanel";
import {
  applyComposerPrefix,
  type ComposerPrefixSelection,
  type ComposerPrefixSpec,
} from "../src/lib/opening/composer-prefix";
import source38 from "../logs/mufy-profiles/full-20261013/next-batch-30-20261028/rule-repairs/38/composer-prefix/prefix-spec.json";
import source46 from "../logs/mufy-profiles/full-20261013/next-batch-30-20261028/rule-repairs/46/composer-prefix/prefix-spec.json";
import source41 from "../logs/mufy-profiles/full-20261013/next-batch-30-20261028/rule-repairs/41/composer-prefix/prefix-spec.json";
const spec = (
  new URLSearchParams(location.search).get("rank") === "46"
    ? source46
    : new URLSearchParams(location.search).get("rank") === "41" ? source41 : source38
) as ComposerPrefixSpec;
function Preview() {
  const [draft, setDraft] = useState("本地测试正文"),
    [sent, setSent] = useState(""),
    [sends, setSends] = useState(0),
    [session, setSession] = useState("A"),
    [renders, setRenders] = useState(0);
  const selection = useRef<ComposerPrefixSelection | null>(null);
  return (
    <main>
      <h1>固定前缀 · 本地未发布</h1>
      <p>无账号、无模型请求、无数据库操作。来源仅提供公开样式和默认条目。</p>
      <button type="button" onClick={() => setRenders((x) => x + 1)}>
        模拟回复重绘
      </button>
      <button
        type="button"
        onClick={() => setSession((s) => (s === "A" ? "B" : "A"))}
      >
        切换测试会话
      </button>
      <p>
        会话：<output id="fixture-session">{session}</output> / 重绘：
        <output id="fixture-renders">{renders}</output>
      </p>
      <p>
        本地提交计数：<output id="fixture-send-count">{sends}</output>
      </p>
      <pre
        id="fixture-sent"
        style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
      >
        {sent}
      </pre>
      <form
        id="fixture-form"
        onSubmit={(e) => {
          e.preventDefault();
          setSent(applyComposerPrefix(draft, selection.current));
          setSends((x) => x + 1);
        }}
      >
        <div
          id="nj_chat_input_box"
          style={{
            position: "fixed",
            bottom: 24,
            left: 16,
            right: 16,
            display: "flex",
            alignItems: "center",
            border: "1px solid var(--accent-primary)",
            padding: 12,
            backdropFilter: "blur(20px)",
            background: "var(--bg-base)",
          }}
        >
          <MufyPrefixPanel
            key={session}
            sessionId={"prefix-local-fixture-" + session}
            spec={spec}
            onChange={(s) => {
              selection.current = s;
            }}
          />
          <textarea
            id="fixture-draft"
            aria-label="本地测试正文"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            style={{ flex: 1, minHeight: 70, margin: 0 }}
          />
          <button type="submit">仅本地提交</button>
        </div>
      </form>
    </main>
  );
}
createRoot(document.getElementById("preview-root")!).render(<Preview />);
