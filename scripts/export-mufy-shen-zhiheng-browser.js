/**
 * 在已登录 Mufy 的 Edge 开发者工具 Sources -> Snippets 中运行。
 *
 * 只读取沈知衡的角色详情，并下载为 mufy-shen-zhiheng-detail.json。
 * 不创建对话、不发送消息、不修改 Mufy 数据，也不导出登录令牌。
 */
(async () => {
  const expectedName = "沈知衡";
  const roleId = "3edce9c0-a422-412e-bcbf-7e4cb99e0c66";
  const token = localStorage.getItem("mufy-token");

  if (!token) {
    throw new Error("当前页面没有 Mufy 登录令牌，请刷新页面并确认已经登录。");
  }

  const response = await fetch(
    `/api/characters/get?id=${encodeURIComponent(roleId)}`,
    {
      method: "GET",
      credentials: "include",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    },
  );

  const body = await response.json();
  if (!response.ok || !body?.data) {
    throw new Error(
      `角色详情读取失败：HTTP ${response.status} ${body?.message ?? body?.reason ?? ""}`,
    );
  }
  if (body.data.characterId !== roleId || body.data.name !== expectedName) {
    throw new Error(
      `角色校验失败：期望 ${expectedName}/${roleId}，实际 ${body.data.name}/${body.data.characterId}`,
    );
  }

  const exported = {
    exportedAt: new Date().toISOString(),
    source: `${location.origin}/api/characters/get`,
    scope: [roleId],
    includesSessionData: false,
    cards: {
      [expectedName]: {
        roleId,
        status: response.status,
        ok: response.ok,
        body,
      },
    },
  };

  const blob = new Blob([JSON.stringify(exported, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "mufy-shen-zhiheng-detail.json";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  console.log(
    `导出完成：${expectedName}，开场白 ${String(body.data.greeting ?? "").length} 字符，视觉代码 ${String(body.data.codeRenderContent ?? "").length + String(body.data.optimizationCode ?? "").length} 字符。`,
  );
})();
