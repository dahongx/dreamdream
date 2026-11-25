/*
 * Mufy 登录态角色发现器。
 *
 * 由 Codex 在已登录的 Mufy 页面执行：
 *   window.__MUFY_ROLE_DISCOVERY_QUERY__ = "角色名、roleId 或聊天链接";
 *   // 然后执行本文件
 *
 * 它只读取搜索与详情接口，不发送消息、不修改角色、不导出 token。
 */
(async () => {
  const query = String(window.__MUFY_ROLE_DISCOVERY_QUERY__ || "").trim();
  if (!query) throw new Error("缺少角色名、roleId 或聊天链接");
  const token = localStorage.getItem("mufy-token");
  if (!token) throw new Error("Mufy 登录已失效，请先登录");

  const roleIdPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
  const roleIdFrom = (value) => {
    if (roleIdPattern.test(value)) return value;
    try {
      const id = new URL(value).searchParams.get("roleId");
      return id && roleIdPattern.test(id) ? id : null;
    } catch {
      return null;
    }
  };
  const normalizeName = (value) =>
    String(value || "")
      .trim()
      .replace(/[（(][^()（）]{0,36}[)）]\s*$/u, "")
      .trim();
  const requestJson = async (url, options = {}) => {
    const response = await fetch(url, {
      credentials: "include",
      ...options,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });
    const value = await response.json().catch(() => null);
    if (!response.ok) throw new Error(`Mufy API HTTP ${response.status}`);
    return value;
  };
  const collect = (value, depth = 0) => {
    if (!value || depth > 8) return [];
    if (Array.isArray(value))
      return value.flatMap((entry) => collect(entry, depth + 1));
    if (typeof value !== "object") return [];
    const id = value.characterId || value.roleId || value.id;
    const name = value.name || value.characterName || value.title;
    const current =
      typeof id === "string" && typeof name === "string"
        ? [{ id, name, raw: value }]
        : [];
    return [
      ...current,
      ...Object.values(value).flatMap((entry) => collect(entry, depth + 1)),
    ];
  };
  const detailFor = async (id) => {
    const response = await requestJson(
      `/api/characters/get?id=${encodeURIComponent(id)}`,
    );
    const objects = collect(response);
    const detail = objects.find((entry) => entry.id === id)?.raw || null;
    return {
      roleId: id,
      name: detail?.name || null,
      avatarUrl: detail?.avatarUrl || detail?.avatar || null,
      creatorName:
        detail?.creatorName || detail?.authorName || detail?.userName || null,
      greeting: String(detail?.greeting || "").slice(0, 1200),
    };
  };

  const directRoleId = roleIdFrom(query);
  let candidates;
  if (directRoleId) {
    candidates = [await detailFor(directRoleId)];
  } else {
    const response = await requestJson("/api/characters/query", {
      method: "POST",
      body: JSON.stringify({
        pageNum: 1,
        pageSize: 50,
        sortBy: "all",
        genderText: "全性别",
        tags: [],
        showNsfw: true,
        search: query,
        excludeIds: [],
      }),
    });
    const unique = [
      ...new Map(
        collect(response)
          .filter((entry) => roleIdPattern.test(entry.id))
          .map((entry) => [entry.id, entry]),
      ).values(),
    ];
    const exact = unique.filter((entry) => entry.name.trim() === query);
    const normalized = unique.filter(
      (entry) => normalizeName(entry.name) === normalizeName(query),
    );
    const shortlist = (
      exact.length ? exact : normalized.length ? normalized : unique
    ).slice(0, 20);
    candidates = await Promise.all(
      shortlist.map((entry) => detailFor(entry.id)),
    );
  }

  const exact = candidates.filter((entry) => entry.name?.trim() === query);
  const normalized = candidates.filter(
    (entry) => normalizeName(entry.name) === normalizeName(query),
  );
  const resolved = directRoleId
    ? candidates.find((entry) => entry.roleId === directRoleId) || null
    : exact.length === 1
      ? exact[0]
      : normalized.length === 1
        ? normalized[0]
        : null;
  const result = {
    version: 1,
    exportedAt: new Date().toISOString(),
    query,
    status: resolved
      ? "resolved"
      : candidates.length
        ? "confirmation-required"
        : "not-found",
    resolvedRoleId: resolved?.roleId || null,
    resolvedUrl: resolved
      ? `${location.origin}/chat?roleId=${encodeURIComponent(resolved.roleId)}`
      : null,
    candidates,
  };
  window.__MUFY_ROLE_DISCOVERY_RESULT__ = result;
  const json = JSON.stringify(result, null, 2);
  document.getElementById("mufy-role-discovery-export")?.remove();
  const node = document.createElement("script");
  node.id = "mufy-role-discovery-export";
  node.type = "application/json";
  node.textContent = json;
  document.body.appendChild(node);

  const blob = new Blob([json], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${query.replace(/[\\/:*?"<>|]/g, "_")}-mufy-discovery.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  console.table(candidates);
  console.log(result.status, result.resolvedUrl || "");
})();
