/* Read-only public character evidence. Credentials stay inside the website. */
(() => {
  if (window.__MUFY_SELECTION_AUDIT__?.status === "running")
    throw new Error("Audit already running");
  const queue = window.__MUFY_SELECTION_AUDIT_QUEUE__;
  if (!Array.isArray(queue) || queue.some((id) => !/^[0-9a-f-]{36}$/i.test(id)))
    throw new Error("Invalid audit queue");
  const state = (window.__MUFY_SELECTION_AUDIT__ = {
    version: 1,
    startedAt: new Date().toISOString(),
    status: "running",
    records: [],
    requested: queue.length,
  });
  const run = async () => {
    for (const roleId of queue) {
      const started = performance.now();
      try {
        const token = localStorage.getItem("mufy-token");
        if (!token) throw new Error("AUTH_REQUIRED");
        const response = await fetch(
          `/api/characters/get?id=${encodeURIComponent(roleId)}`,
          {
            credentials: "include",
            headers: {
              Accept: "application/json",
              Authorization: `Bearer ${token}`,
            },
            signal: AbortSignal.timeout(15000),
          },
        );
        if ([401, 403, 429].includes(response.status))
          throw new Error(`PAUSED_HTTP_${response.status}`);
        if (!response.ok) throw new Error(`HTTP_${response.status}`);
        const body = await response.json();
        const d = body.data;
        if (
          body.code !== 200 ||
          !d ||
          d.characterId !== roleId ||
          typeof d.name !== "string"
        )
          throw new Error("PROTOCOL_CHANGED");
        state.records.push({
          roleId,
          observedAt: new Date().toISOString(),
          elapsedMs: performance.now() - started,
          status: "found",
          name: d.name,
          author: d.creatorName ?? null,
          age: d.age ?? null,
          gender: d.gender ?? null,
          description: d.description ?? "",
          avatarUrl: typeof d.avatarUrl === "string" ? d.avatarUrl : null,
          backgroundUrl:
            typeof d.backgroundUrl === "string" ? d.backgroundUrl : null,
          greeting: d.greeting ?? "",
          codeRenderContent: d.codeRenderContent ?? "",
          optimizationCode: d.optimizationCode ?? "",
          updatedAt: d.updatedAt ?? null,
          favorites: d.totalFollowers ?? null,
          likes: d.totalLikes ?? null,
          chats: d.totalChats ?? null,
          tags: Array.isArray(d.tags) ? d.tags : [],
        });
      } catch (error) {
        const reason = error instanceof Error ? error.message : "READ_FAILED";
        state.records.push({
          roleId,
          observedAt: new Date().toISOString(),
          elapsedMs: performance.now() - started,
          status: "failed",
          reason,
        });
        if (/AUTH_REQUIRED|PAUSED_HTTP|PROTOCOL_CHANGED/.test(reason)) {
          state.status = "paused";
          state.reason = reason;
          break;
        }
      }
      await new Promise((ok) => setTimeout(ok, 1000));
    }
    if (state.status === "running") state.status = "finished";
    state.finishedAt = new Date().toISOString();
  };
  void run();
  return { status: state.status, requested: queue.length };
})();
