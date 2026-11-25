/* Run in the authenticated chat.mufy.ai page after assigning
 * window.__MUFY_PROFILE_QUEUE__ from mufy:profiles queue.
 * This only calls the observed search endpoint. No Prompt/token is exported.
 * IndexedDB is private to this origin; closed pages must be resumed explicitly.
 */
(() => {
  if (location.origin !== "https://chat.mufy.ai")
    throw new Error("Mufy origin required");
  if (window.__MUFY_PROFILE_RUNNING__)
    throw new Error("Collector already running");
  const queue = window.__MUFY_PROFILE_QUEUE__;
  if (
    queue?.version !== 1 ||
    typeof queue.jobId !== "string" ||
    !Array.isArray(queue.rows) ||
    queue.request?.showNsfw !== true
  )
    throw new Error("Invalid full-scope queue");
  if (
    !queue.rows.every(
      (r) => typeof r.key === "string" && typeof r.name === "string",
    )
  )
    throw new Error("Invalid queue rows");
  if (!/^[a-f0-9]{64}$/i.test(queue.jobId) && queue.jobId !== "test")
    throw new Error("Invalid source digest");
  if (
    !Number.isInteger(queue.request.pageSize) ||
    queue.request.pageSize < 1 ||
    queue.request.pageSize > 50 ||
    queue.request.sortBy !== "newest"
  )
    throw new Error("Unsupported search options");
  if (
    !Number.isInteger(queue.intervalMs) ||
    queue.intervalMs < 1000 ||
    queue.intervalMs > 60000 ||
    !Number.isInteger(queue.maxRetries) ||
    queue.maxRetries < 1 ||
    queue.maxRetries > 5
  )
    throw new Error("Unsafe request limits");
  window.__MUFY_PROFILE_RUNNING__ = true;
  window.__MUFY_PROFILE_STOP__ = false;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const state = {
    version: 1,
    jobId: queue.jobId,
    request: queue.request,
    status: "running",
    startedAt: new Date().toISOString(),
    activeMs: 0,
    waitMs: 0,
    requests: 0,
    records: [],
  };
  window.__MUFY_PROFILE_EXPORT__ = () =>
    JSON.stringify({ ...state, exportedAt: new Date().toISOString() });
  let db;
  const open = () =>
    new Promise((ok, fail) => {
      const r = indexedDB.open(`mufy-profile-collector-${queue.jobId}`, 1);
      r.onupgradeneeded = () => {
        r.result.createObjectStore("records", { keyPath: "key" });
        r.result.createObjectStore("meta");
      };
      r.onsuccess = () => ok(r.result);
      r.onerror = () => fail(new Error("Checkpoint database unavailable"));
    });
  const readAll = () =>
    new Promise((ok, fail) => {
      const r = db.transaction("records").objectStore("records").getAll();
      r.onsuccess = () => ok(r.result);
      r.onerror = () => fail(new Error("Checkpoint read failed"));
    });
  const put = (store, value, key) =>
    new Promise((ok, fail) => {
      const tx = db.transaction(store, "readwrite");
      const s = tx.objectStore(store);
      key === undefined ? s.put(value) : s.put(value, key);
      tx.oncomplete = ok;
      tx.onerror = () => fail(new Error("Checkpoint write failed"));
      tx.onabort = () => fail(new Error("Checkpoint write aborted"));
    });
  const publish = () => {
    state.exportedAt = new Date().toISOString();
    let node = document.getElementById("mufy-profile-export");
    if (!node) {
      node = document.createElement("script");
      node.id = "mufy-profile-export";
      node.type = "application/json";
      document.body.appendChild(node);
    }
    node.textContent = JSON.stringify(state);
  };
  const metric = (v) =>
    typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;
  const candidate = (r) => {
    if (typeof r.characterId !== "string" || typeof r.name !== "string")
      throw new Error("Candidate schema changed");
    return {
      roleId: r.characterId,
      name: r.name,
      author: typeof r.creatorName === "string" ? r.creatorName : null,
      tags: Array.isArray(r.tags)
        ? r.tags.filter((t) => typeof t === "string")
        : [],
      likes: metric(r.totalLikes),
      favorites: metric(r.totalFollowers),
      chats: metric(r.totalChats),
      updatedAt: typeof r.updatedAt === "string" ? r.updatedAt : null,
    };
  };
  async function page(name, pageNum) {
    let attempts = 0;
    while (attempts < (queue.maxRetries ?? 3)) {
      attempts++;
      state.requests++;
      const token = localStorage.getItem("mufy-token");
      if (!token) throw new Error("AUTH_REQUIRED");
      const t = performance.now();
      let response;
      try {
        response = await fetch("/api/search/characters", {
          method: "POST",
          credentials: "include",
          signal: AbortSignal.timeout(15000),
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            pageNum,
            pageSize: queue.request.pageSize,
            contentType: 0,
            genderText: "全性别",
            searchText: name,
            sortBy: queue.request.sortBy,
            showNsfw: true,
          }),
        });
      } catch {
        state.activeMs += performance.now() - t;
        if (attempts >= (queue.maxRetries ?? 3))
          throw new Error("NETWORK_FAILED");
        const wait = 1000 * 2 ** (attempts - 1);
        state.waitMs += wait;
        await sleep(wait);
        continue;
      }
      state.activeMs += performance.now() - t;
      if ([401, 403].includes(response.status))
        throw new Error("AUTH_REQUIRED");
      if (response.status === 429) throw new Error("RATE_LIMITED");
      if (response.status >= 500) {
        if (attempts >= (queue.maxRetries ?? 3))
          throw new Error("SERVER_FAILED");
        const wait = 1000 * 2 ** (attempts - 1);
        state.waitMs += wait;
        await sleep(wait);
        continue;
      }
      if (!response.ok) throw new Error(`HTTP_${response.status}`);
      const json = await response.json();
      if (
        json.code !== 200 ||
        !Array.isArray(json.data?.data) ||
        typeof json.data.hasNext !== "boolean"
      )
        throw new Error("SEARCH_SCHEMA_CHANGED");
      return { data: json.data, attempts };
    }
    throw new Error("RETRIES_EXHAUSTED");
  }
  window.__MUFY_PROFILE_COLLECTION_PROMISE__ = (async () => {
    try {
      db = await open();
      state.records = await readAll();
      const done = new Set(
        state.records
          .filter((r) => r.complete && r.status !== "failed")
          .map((r) => r.key),
      );
      await put("meta", { queue, startedAt: state.startedAt }, "queue");
      publish();
      for (const row of queue.rows) {
        if (done.has(row.key)) continue;
        if (window.__MUFY_PROFILE_STOP__) {
          state.status = "paused";
          break;
        }
        const start = performance.now();
        const requestsAtStart = state.requests;
        let candidates = [],
          complete = false,
          error;
        if (!row.name.trim()) {
          error = "EMPTY_NAME";
        } else
          try {
            for (let n = 1; n <= 100; n++) {
              const result = await page(row.name, n);
              candidates.push(...result.data.data.map(candidate));
              const interval = Math.max(1000, queue.intervalMs ?? 1500);
              state.waitMs += interval;
              await sleep(interval);
              if (!result.data.hasNext) {
                complete = true;
                break;
              }
              if (n === 100) throw new Error("PAGINATION_LIMIT");
              if (window.__MUFY_PROFILE_STOP__) throw new Error("STOPPED");
            }
          } catch (e) {
            error = e instanceof Error ? e.message : "UNKNOWN";
          }
        candidates = [
          ...new Map(candidates.map((c) => [c.roleId, c])).values(),
        ];
        const observation = {
          key: row.key,
          query: row.name,
          observedAt: new Date().toISOString(),
          elapsedMs: performance.now() - start,
          attempts: state.requests - requestsAtStart,
          status: error ? "failed" : candidates.length ? "found" : "not-found",
          complete,
          candidates,
          ...(error ? { error } : {}),
        };
        await put("records", observation);
        state.records = state.records.filter((r) => r.key !== row.key);
        state.records.push(observation);
        // Persist every record, but avoid serializing the entire 10k roster
        // into the DOM on every request. Explicit export always includes all.
        if (state.records.length % 25 === 0 || error) publish();
        if (
          [
            "AUTH_REQUIRED",
            "RATE_LIMITED",
            "SEARCH_SCHEMA_CHANGED",
            "STOPPED",
            "PAGINATION_LIMIT",
          ].includes(error)
        ) {
          state.status = error;
          break;
        }
      }
      if (state.status === "running") state.status = "finished";
    } catch (e) {
      state.status = "collector-error";
      state.error = e instanceof Error ? e.message : "UNKNOWN";
    } finally {
      state.finishedAt = new Date().toISOString();
      publish();
      if (db) {
        await put(
          "meta",
          {
            status: state.status,
            finishedAt: state.finishedAt,
            activeMs: state.activeMs,
            waitMs: state.waitMs,
          },
          "lastRun",
        ).catch(() => {});
        db.close();
      }
      window.__MUFY_PROFILE_RUNNING__ = false;
    }
    return { status: state.status, records: state.records.length };
  })();
  return {
    jobId: queue.jobId,
    queued: queue.rows.length,
    status: "started",
    checkpoint: "IndexedDB",
    exportNode: "mufy-profile-export",
  };
})();
