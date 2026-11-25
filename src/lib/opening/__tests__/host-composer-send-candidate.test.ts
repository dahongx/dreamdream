import { describe, expect, test } from "bun:test";
import {
  admitHostComposerSend,
  admitHostComposerSendAsync,
  type ComposerDraftSnapshot,
  createHostAdmissionTracker,
  dispatchHostSendRpc,
  type HostComposerSendPorts,
  parseHostSendOptions,
} from "../host-composer-send-candidate";

function store(value: string) {
  let draft: ComposerDraftSnapshot = { value, version: 1 },
    busy = false,
    releases = 0;
  const enqueued: string[] = [];
  const ports: HostComposerSendPorts = {
    readDraft: () => ({ ...draft }),
    tryClaimSend: () => {
      if (busy) return false;
      busy = true;
      return true;
    },
    releaseFailedClaim: () => {
      busy = false;
      releases++;
    },
    enqueue: (text) => {
      enqueued.push(text);
    },
    clearDraftIfCurrent: (s) => {
      if (draft.version === s.version && draft.value === s.value)
        draft = { value: "", version: draft.version + 1 };
    },
  };
  return {
    ports,
    enqueued,
    get draft() {
      return draft;
    },
    get releases() {
      return releases;
    },
    setBusy: () => {
      busy = true;
    },
    edit: (value: string) => {
      draft = { value, version: draft.version + 1 };
    },
  };
}
const append = { composerMode: "append-and-send" };
describe("host composer send admission candidate", () => {
  test("merges nonempty main draft and command with exactly one separator, clears admitted snapshot", () => {
    const s = store("earlier draft");
    expect(admitHostComposerSend("$发送消息：hello", append, s.ports)).toEqual({
      accepted: true,
    });
    expect(s.enqueued).toEqual(["earlier draft $发送消息：hello"]);
    expect(s.draft.value).toBe("");
  });
  test("empty main draft sends command; empty fake command submits existing main draft, both empty skip lock/send", () => {
    const a = store("");
    expect(admitHostComposerSend("$发送消息：hello", append, a.ports)).toEqual({
      accepted: true,
    });
    expect(a.enqueued).toEqual(["$发送消息：hello"]);
    const b = store(" main only ");
    expect(admitHostComposerSend("", append, b.ports)).toEqual({
      accepted: true,
    });
    expect(b.enqueued).toEqual(["main only"]);
    expect(b.draft.value).toBe("");
    const c = store(" ");
    expect(admitHostComposerSend("", append, c.ports)).toEqual({
      accepted: false,
      reason: "empty",
    });
    expect(c.enqueued).toEqual([]);
    expect(c.draft.value).toBe(" ");
  });
  test("busy returns no host draft data and changes neither main nor caller phone draft", () => {
    const s = store("private main draft");
    s.setBusy();
    s.ports.readDraft = () => {
      throw Error("busy must not inspect host draft");
    };
    let fake = "phone draft";
    const result = admitHostComposerSend(`$发送消息：${fake}`, append, s.ports);
    if (result.accepted) fake = "";
    expect(result).toEqual({ accepted: false, reason: "busy" });
    expect(s.draft.value).toBe("private main draft");
    expect(fake).toBe("phone draft");
    expect(s.enqueued).toEqual([]);
    expect(JSON.stringify(result)).not.toContain("draft");
  });
  test("empty append and failed snapshot release the claim, allowing a later valid send", () => {
    const s = store("");
    expect(admitHostComposerSend("", append, s.ports)).toEqual({
      accepted: false,
      reason: "empty",
    });
    expect(s.releases).toBe(1);
    s.edit("next");
    expect(admitHostComposerSend("", append, s.ports)).toEqual({
      accepted: true,
    });
    const f = store("private");
    f.ports.readDraft = () => {
      throw Error("read failed");
    };
    expect(admitHostComposerSend("phone", append, f.ports)).toEqual({
      accepted: false,
      reason: "dispatch-failed",
    });
    expect(f.releases).toBe(1);
    expect(f.draft.value).toBe("private");
  });
  test("sync dispatch failure releases claimed lock and preserves both drafts", () => {
    const s = store("main");
    s.ports.enqueue = () => {
      throw Error("failed enqueue");
    };
    expect(admitHostComposerSend("phone", append, s.ports)).toEqual({
      accepted: false,
      reason: "dispatch-failed",
    });
    expect(s.draft.value).toBe("main");
    expect(s.releases).toBe(1);
  });
  test("reentrant/new edits survive, including same text with newer version; duplicate tap rejected", () => {
    for (const next of ["new typed text", "main"]) {
      const s = store("main");
      s.ports.enqueue = (text) => {
        s.enqueued.push(text);
        s.edit(next);
      };
      expect(admitHostComposerSend("phone", append, s.ports)).toEqual({
        accepted: true,
      });
      expect(s.draft.value).toBe(next);
      expect(admitHostComposerSend("phone", append, s.ports)).toEqual({
        accepted: false,
        reason: "busy",
      });
      expect(s.enqueued).toEqual(["main phone"]);
    }
  });
  test("legacy text mode never reads or clears composer, preserves submitted literal text", () => {
    const s = store("main untouched");
    s.ports.readDraft = () => {
      throw Error("must not read");
    };
    s.ports.clearDraftIfCurrent = () => {
      throw Error("must not clear");
    };
    expect(admitHostComposerSend(" literal text ", undefined, s.ports)).toEqual(
      { accepted: true },
    );
    expect(s.enqueued).toEqual([" literal text "]);
    expect(s.draft.value).toBe("main untouched");
  });
  test("strict options reject extra host data/permissions/selectors before reading or sending", () => {
    expect(parseHostSendOptions(undefined)).toBeUndefined();
    expect(parseHostSendOptions(append)).toEqual(append);
    for (const opts of [
      null,
      {},
      [],
      { composerMode: "other" },
      { composerMode: "append-and-send", selector: "textarea" },
      { composerMode: "append-and-send", readDraft: true },
    ]) {
      const s = store("main");
      expect(admitHostComposerSend("phone", opts, s.ports)).toEqual({
        accepted: false,
        reason: "invalid-options",
      });
      expect(s.enqueued).toEqual([]);
      expect(s.draft.value).toBe("main");
    }
  });
  test("async rejection before message admission leaves main and phone drafts intact and unlocks", async () => {
    const s = store("main draft");
    let fake = "phone draft";
    const tracker = createHostAdmissionTracker();
    const ports = {
      ...s.ports,
      enqueue: () =>
        tracker.admit("new-user", async () => {
          throw Error("pre-insertion failure");
        }),
    };
    const result = await admitHostComposerSendAsync("phone", append, ports);
    if (result.accepted) fake = "";
    expect(result).toEqual({ accepted: false, reason: "dispatch-failed" });
    expect(s.draft.value).toBe("main draft");
    expect(fake).toBe("phone draft");
    expect(s.releases).toBe(1);
    expect(tracker.pendingCount).toBe(0);
  });
  test("exact new user history admission resolves before an unfinished model stream; later failure is handled separately", async () => {
    const s = store("main");
    const tracker = createHostAdmissionTracker();
    let rejectStream!: (reason: Error) => void;
    const stream = new Promise<void>((_, reject) => {
      rejectStream = reject;
    });
    const p = admitHostComposerSendAsync("phone", append, {
      ...s.ports,
      enqueue: (text) => {
        s.enqueued.push(text);
        return tracker.admit("new-user", () => stream);
      },
    });
    expect(s.draft.value).toBe("main");
    expect(tracker.pendingCount).toBe(1);
    tracker.observe([
      { id: "old-user", role: "user" },
      { id: "new-user", role: "assistant" },
    ]);
    expect(tracker.pendingCount).toBe(1);
    tracker.observe([{ id: "new-user", role: "user" }]);
    expect(await p).toEqual({ accepted: true });
    expect(s.draft.value).toBe("");
    expect(s.enqueued).toEqual(["main phone"]);
    rejectStream(Error("later model failure"));
    await Promise.resolve();
    expect(tracker.pendingCount).toBe(0);
    expect(s.releases).toBe(0);
  });
  test("new composer edits during async admission survive and busy duplicate never reads drafts", async () => {
    const s = store("main");
    const tracker = createHostAdmissionTracker();
    const ports = {
      ...s.ports,
      enqueue: () =>
        tracker.admit("user-id", () => new Promise<void>(() => {})),
    };
    const p = admitHostComposerSendAsync("phone", append, ports);
    s.edit("typed while pending");
    expect(
      await admitHostComposerSendAsync("second", append, {
        ...ports,
        readDraft: () => {
          throw Error("busy read");
        },
      }),
    ).toEqual({ accepted: false, reason: "busy" });
    tracker.observe([{ id: "user-id", role: "user" }]);
    expect(await p).toEqual({ accepted: true });
    expect(s.draft.value).toBe("typed while pending");
  });
  test("completed send without observed user is not admitted; dispose rejects outstanding work", async () => {
    const tracker = createHostAdmissionTracker();
    const absent = tracker.admit("never-observed", async () => {});
    await Promise.resolve();
    tracker.observe([]);
    await expect(absent).rejects.toThrow("without observing");
    const p = tracker.admit("pending", () => new Promise<void>(() => {}));
    tracker.dispose();
    await expect(p).rejects.toThrow("disposed");
    expect(tracker.pendingCount).toBe(0);
  });
  test("fast completed send waits for a fresh host commit instead of rejecting a not-yet-rendered user message", async () => {
    let observationRequests = 0;
    const tracker = createHostAdmissionTracker(() => {
      observationRequests++;
    });
    const p = tracker.admit("fast-user", async () => {});
    await Promise.resolve();
    expect(observationRequests).toBe(1);
    expect(tracker.pendingCount).toBe(1);
    tracker.observe([{ id: "fast-user", role: "user" }]);
    await p;
    expect(tracker.pendingCount).toBe(0);
  });
  test("RPC keeps legacy return contract; preview append never invokes its old text handler", async () => {
    const calls: string[] = [];
    const legacy = (text: string) => {
      calls.push(text);
    };
    expect(await dispatchHostSendRpc("legacy", undefined, legacy)).toBeNull();
    expect(calls).toEqual(["legacy"]);
    expect(await dispatchHostSendRpc("phone", append, legacy)).toEqual({
      accepted: false,
      reason: "unsupported",
    });
    expect(calls).toEqual(["legacy"]);
    await expect(dispatchHostSendRpc("", undefined, legacy)).rejects.toThrow(
      "text required",
    );
    await expect(
      dispatchHostSendRpc(
        "phone",
        { composerMode: "append-and-send", readDraft: true },
        legacy,
      ),
    ).rejects.toThrow("invalid send options");
  });
  test("RPC brand admits empty phone command and only returns a minimal admission object", async () => {
    const handler = Object.assign(
      async (text: string, opts?: unknown) => {
        expect(text).toBe("");
        expect(opts).toEqual(append);
        return { accepted: true as const, privateDraft: "must not escape" };
      },
      { supportsAppendAndSend: true as const },
    );
    expect(await dispatchHostSendRpc("", append, handler)).toEqual({
      accepted: true,
    });
  });
});
