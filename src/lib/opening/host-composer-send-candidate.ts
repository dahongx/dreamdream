/** Local candidate only. Admission acknowledges enqueue, never model completion. */
export type HostSendOptions = { composerMode: "append-and-send" };
export type HostSendAdmission =
  | { accepted: true }
  | {
      accepted: false;
      reason:
        | "busy"
        | "empty"
        | "invalid-options"
        | "dispatch-failed"
        | "unsupported";
    };
export type HostSendHandler = ((
  text: string,
  options?: HostSendOptions,
) =>
  | void
  | HostSendAdmission
  | Promise<// biome-ignore lint/suspicious/noConfusingVoidType: preserves legacy Promise<void> handlers
    void | HostSendAdmission>) & {
  supportsAppendAndSend?: true;
};
export interface ComposerDraftSnapshot {
  value: string;
  version: number;
}
export interface HostComposerSendPorts {
  readDraft(): ComposerDraftSnapshot;
  tryClaimSend(): boolean;
  releaseFailedClaim(): void;
  /** Synchronous enqueue. A later generation error is outside admission. */
  enqueue(text: string): void;
  /** Must compare version and value atomically in the owning state store. */
  clearDraftIfCurrent(snapshot: ComposerDraftSnapshot): void;
}
export interface AsyncHostComposerSendPorts
  extends Omit<HostComposerSendPorts, "enqueue"> {
  /** Resolves only when this exact new user message is observed in local history. */
  enqueue(text: string): Promise<void>;
}
export function parseHostSendOptions(
  value: unknown,
): HostSendOptions | undefined | null {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const keys = Object.keys(value);
  return keys.length === 1 &&
    keys[0] === "composerMode" &&
    (value as Record<string, unknown>).composerMode === "append-and-send"
    ? { composerMode: "append-and-send" }
    : null;
}
/** Keeps legacy RPC return null; unsupported preview callbacks are never invoked in append mode. */
export async function dispatchHostSendRpc(
  text: string,
  rawOptions: unknown,
  handler: HostSendHandler,
): Promise<HostSendAdmission | null> {
  const options = parseHostSendOptions(rawOptions);
  if (options === null) throw Error("invalid send options");
  if (options === undefined) {
    if (!text.trim()) throw Error("text required");
    await handler(text);
    return null;
  }
  if (handler.supportsAppendAndSend !== true)
    return { accepted: false, reason: "unsupported" };
  const result = await handler(text, options);
  if (!result) return { accepted: false, reason: "unsupported" };
  if (result.accepted) return { accepted: true };
  const reasons = [
    "busy",
    "empty",
    "invalid-options",
    "dispatch-failed",
    "unsupported",
  ];
  return {
    accepted: false,
    reason: reasons.includes(result.reason) ? result.reason : "unsupported",
  };
}
export function admitHostComposerSend(
  text: string,
  options: unknown,
  ports: HostComposerSendPorts,
): HostSendAdmission {
  const mode = parseHostSendOptions(options);
  if (mode === null) return { accepted: false, reason: "invalid-options" };
  if (!mode && !text.trim()) return { accepted: false, reason: "empty" };
  if (!ports.tryClaimSend()) return { accepted: false, reason: "busy" };
  let snapshot: ComposerDraftSnapshot | undefined;
  try {
    snapshot = mode ? { ...ports.readDraft() } : undefined;
  } catch {
    ports.releaseFailedClaim();
    return { accepted: false, reason: "dispatch-failed" };
  }
  const combined = snapshot
    ? snapshot.value + (text ? (snapshot.value ? " " : "") + text : "")
    : text;
  // The append mode follows clicking the normal composer, which trims at submit.
  const submitted = mode ? combined.trim() : combined;
  if (!submitted.trim()) {
    ports.releaseFailedClaim();
    return { accepted: false, reason: "empty" };
  }
  try {
    ports.enqueue(submitted);
  } catch {
    ports.releaseFailedClaim();
    return { accepted: false, reason: "dispatch-failed" };
  }
  if (snapshot) ports.clearDraftIfCurrent(snapshot);
  // Do not return main draft, merged text, history or other private host state.
  return { accepted: true };
}

/** Admission-aware variant: never await the model stream to acknowledge admission. */
export async function admitHostComposerSendAsync(
  text: string,
  options: unknown,
  ports: AsyncHostComposerSendPorts,
): Promise<HostSendAdmission> {
  const mode = parseHostSendOptions(options);
  if (mode === null) return { accepted: false, reason: "invalid-options" };
  if (!mode && !text.trim()) return { accepted: false, reason: "empty" };
  if (!ports.tryClaimSend()) return { accepted: false, reason: "busy" };
  let snapshot: ComposerDraftSnapshot | undefined;
  try {
    snapshot = mode ? { ...ports.readDraft() } : undefined;
    const combined = snapshot
      ? snapshot.value + (text ? (snapshot.value ? " " : "") + text : "")
      : text;
    const submitted = mode ? combined.trim() : combined;
    if (!submitted.trim()) {
      ports.releaseFailedClaim();
      return { accepted: false, reason: "empty" };
    }
    await ports.enqueue(submitted);
  } catch {
    ports.releaseFailedClaim();
    return { accepted: false, reason: "dispatch-failed" };
  }
  if (snapshot) ports.clearDraftIfCurrent(snapshot);
  return { accepted: true };
}

/** Internal host-only correlation. No text or composer data is returned to author code. */
export function createHostAdmissionTracker(
  onObservationRequired: () => void = () => {},
) {
  const pending = new Map<
    string,
    { resolve: () => void; reject: (error: Error) => void; completed: boolean }
  >();
  const fail = (id: string, error: unknown) => {
    const item = pending.get(id);
    if (!item) return;
    pending.delete(id);
    item.reject(
      error instanceof Error ? error : new Error("send not admitted"),
    );
  };
  return {
    admit(id: string, dispatch: () => Promise<void>): Promise<void> {
      if (pending.has(id))
        return Promise.reject(new Error("duplicate admission id"));
      return new Promise<void>((resolve, reject) => {
        pending.set(id, { resolve, reject, completed: false });
        // Covers both a synchronous throw and asynchronous pre-insertion rejection.
        try {
          Promise.resolve(dispatch()).then(
            () => {
              const item = pending.get(id);
              if (!item) return;
              // Completion can precede a React commit. Request one normal host-state
              // observation rather than treating a stale effect snapshot as failure.
              item.completed = true;
              onObservationRequired();
            },
            (error) => fail(id, error),
          );
        } catch (error) {
          fail(id, error);
        }
      });
    },
    observe(messages: readonly { id: string; role: string }[]) {
      for (const message of messages) {
        if (message.role !== "user") continue;
        const item = pending.get(message.id);
        if (item) {
          pending.delete(message.id);
          item.resolve();
        }
      }
      for (const [id, item] of pending)
        if (item.completed)
          fail(id, new Error("send ended without observing the user message"));
    },
    dispose() {
      for (const id of [...pending.keys()])
        fail(id, new Error("host disposed before admission"));
    },
    get pendingCount() {
      return pending.size;
    },
  };
}
