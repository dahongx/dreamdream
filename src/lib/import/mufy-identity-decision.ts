import { createHash } from "node:crypto";
import {
  openingNarrativeText,
  openingsShareNarrative,
} from "./mufy-opening-comparison";
type Local = {
  primaryName: string | null;
  persona: string;
  opening: string;
  age: number | null;
};
type Live = {
  roleId: string;
  name: string;
  status: string;
  greeting?: string;
  description?: string;
  codeRenderContent?: unknown;
  age?: number;
};
type Target = {
  id: string;
  name: string;
  bio?: string;
  persona_fingerprint?: string;
};
const normalized = (s: string) =>
  s.normalize("NFKC").replace(/\s+/g, "").toLowerCase();
export function decideIdentity(
  sourceName: string,
  local: Local,
  live: Live | undefined,
  targets: Target[],
) {
  if (!live || live.status !== "found")
    return { status: "awaiting-read", reason: "公开详情尚未成功读取" };
  const names = [sourceName, live.name].map(normalized);
  if (
    local.primaryName &&
    !names.some((name) =>
      name.includes(normalized(local.primaryName as string)),
    )
  )
    return { status: "reject", reason: "索引名字与本地人物设定主角不一致" };
  const fingerprint = createHash("md5")
    .update(local.persona.trim())
    .digest("hex");
  const duplicate = targets.find(
    (target) =>
      names.some(
        (name) =>
          normalized(target.name) === name ||
          name.startsWith(normalized(target.name) + "("),
      ) ||
      target.persona_fingerprint === fingerprint ||
      (!!live.description &&
        normalized(live.description).length >= 20 &&
        normalized(target.bio ?? "") === normalized(live.description)),
  );
  if (duplicate)
    return {
      status: "existing",
      reason: `测试服已有名称、设定指纹或公开简介对应：${duplicate.name}`,
      targetId: duplicate.id,
    };
  const greeting = live.greeting ?? "";
  const narrativeMatch = openingsShareNarrative(local.opening, greeting);
  const primaryKnown =
    !!local.primaryName || local.persona.slice(0, 1200).includes(sourceName);
  const actor = local.primaryName ?? sourceName;
  const narrativeHasActor = normalized(openingNarrativeText(greeting)).includes(
    normalized(actor),
  );
  if (narrativeMatch && primaryKnown && narrativeHasActor)
    return {
      status: "confirmed",
      reason: "本地主角对应，公开开场长正文一致；按用户授权使用本地档案版本",
      evidence: "opening-narrative-equal",
      narrativeSha256: createHash("sha256")
        .update(openingNarrativeText(greeting))
        .digest("hex"),
      ageMetadataConflict: local.age !== null && live.age !== local.age,
    };
  const publicProfile = openingNarrativeText(
    typeof live.codeRenderContent === "string" ? live.codeRenderContent : "",
  );
  const segments = local.persona
    .split(/[\n。！？!?]/)
    .map((s) => openingNarrativeText(s))
    .filter(
      (s) =>
        s.length >= 45 &&
        s.length <= 400 &&
        !/禁止|指令|回复|生成|输出|格式|代码|必须|模型|严禁/.test(s),
    );
  const shared = [
    ...new Set(segments.filter((s) => publicProfile.includes(s))),
  ];
  if (
    primaryKnown &&
    shared.length >= 2 &&
    normalized(publicProfile).includes(normalized(actor)) &&
    (local.age === null || live.age === local.age)
  )
    return {
      status: "confirmed",
      reason:
        "主角对应，至少两段非指令型人物事实与公开人物介绍逐字一致；公开开场可单独同步",
      evidence: "public-persona-passages-equal",
      sharedPassageCount: shared.length,
      sharedPassageHashes: shared.map((s) =>
        createHash("sha256").update(s).digest("hex"),
      ),
    };
  return {
    status: "pending",
    reason: "需要进一步核对人物/关系/世界观；不能只凭同名或年龄放行",
    sharedPassageCount: shared.length,
  };
}
