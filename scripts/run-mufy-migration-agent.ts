#!/usr/bin/env bun

/**
 * Password-free Mufy migration orchestrator.
 *
 * The user logs into Mufy once. Codex exports the authenticated runtime JSON,
 * then this command owns dry-run, TEST-only persistence, resumable state, and
 * post-migration visual acceptance. It never logs into Mufy or writes PROD.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { sha256, selectMufyRuntimeDetail, parseMufyPrompt, parseMufyPromptSourceText, selectPromptRecord } from "../src/lib/import/mufy-migration";
import { verifyFidelityEvidenceFiles } from "../src/lib/import/mufy-fidelity-review";
import { REPLY_ACCEPTANCE_SCOPE, verifyMufyReplyEvidence } from "../src/lib/import/mufy-reply-review";
import { reviewMufyBrowserRuns, buildMufyRepairQueue } from "../src/lib/import/mufy-browser-review";
import {
  requireVerifiedSelection,
  selectNewTestProfiles,
  validateTestInventory,
} from "../src/lib/import/mufy-profile-selection";
import {
  type ProfileObservation,
  type ProfileReview,
  type ProfileSource,
  requireReviewedProfile,
} from "../src/lib/import/mufy-profiles";
import {
  type RuntimeVisualSnapshot,
  verifyMufyVisualAcceptance,
} from "../src/lib/import/mufy-visual-acceptance";

type Stage =
  | "source-ready"
  | "preflight-failed"
  | "ready-to-write-test"
  | "test-write-failed"
  | "awaiting-test-browser"
  | "visual-failed"
  | "complete";

interface AgentState {
  version: 1;
  sourceRoleId: string;
  sourceName: string;
  sourceRuntimeSha256: string;
  promptSha256: string;
  stage: Stage;
  updatedAt: string;
  characterId: string | null;
  packId: string | null;
  targetUrl: string | null;
  migrationReport: string | null;
  visualReport: string | null;
  nextAction: string | null;
  automaticRepairs?: string[];
  browserCheckPlan?: string;
  testWrittenAt?: string;
  acceptanceScope?: "opening-and-source-components" | typeof REPLY_ACCEPTANCE_SCOPE;
  replyReport?: string;
  browserReviewPath?: string;
  repairQueuePath?: string;
}

interface Options {
  allowMissingImages: boolean;
  preferLocalAge: boolean;
  adaptHostCss: boolean;
  allowMissingAudio: boolean;
  mufyRuntime: string;
  promptJson: string;
  dearmMobileRuntime?: string;
  dearmDesktopRuntime?: string;
  fidelityReport?: string;
  replyReport?: string;
  browserCheckReport?: string;
  autoRepair: boolean;
  jobDir?: string;
  targetName?: string;
  ownerEmail?: string;
  expectedDbHost?: string;
  testBaseUrl?: string;
  updateCharacterId?: string;
  packId?: string;
  visibility: "private" | "unlisted" | "public";
  contentType: "original" | "self_designed" | "fanwork";
  nsfw?: boolean;
  commit: boolean;
  remigrate: boolean;
  profilesJob?: string;
  profileKey?: string;
}

function argument(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function required(flag: string): string {
  const value = argument(flag);
  if (!value) throw new Error(`缺少 ${flag}`);
  return value;
}

function oneOf<T extends string>(
  flag: string,
  values: readonly T[],
  fallback: T,
): T {
  const value = argument(flag);
  if (!value) return fallback;
  if (!values.includes(value as T)) {
    throw new Error(`${flag} 只能是 ${values.join(" / ")}`);
  }
  return value as T;
}

function optionalBoolean(flag: string): boolean | undefined {
  const value = argument(flag);
  if (value === undefined) return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`${flag} 只能是 true 或 false`);
}

function parseOptions(): Options {
  if (process.argv.includes("--help")) {
    console.log(`Mufy 登录态迁移 Agent

必需：
  --mufy-runtime <来源运行态.json>
  --prompt-json <完整Prompt.json|txt>

测试服写入：
  --commit --owner-email <邮箱> --expected-db-host <主机>
  --test-base-url <测试服URL>

验收：
  --dearm-mobile-runtime <手机运行态.json>
  --dearm-desktop-runtime <桌面运行态.json>
  --fidelity-report <v2逐状态观测与来源/目标截图清单.json>
  --reply-report <后续回复证据.json> 至少两条不同后续回复，各含手机/桌面四状态
  --browser-check-report <通用浏览器检查器观测.json>
  --auto-repair 启用已有通用兼容修复；修复后必须重新浏览器验收
  证据须位于清单目录内、指纹一致，并晚于最近一次测试服写入。
  完成必须同时通过开场与后续回复；离线样例不能冒充真实聊天验收。

画像交接（两个参数一起提供）：
  --profiles-job <画像任务目录> --profile-key <原档案编号>
  必须已确认身份且完整 Prompt 指纹一致，否则停止。

修复后原位覆盖：--commit --remigrate`);
    process.exit(0);
  }
  return {
    allowMissingAudio: process.argv.includes("--allow-missing-audio") || process.argv.includes("--allow-missing-media"),
    allowMissingImages: process.argv.includes("--allow-missing-media"),
    preferLocalAge: process.argv.includes("--use-local-age"),
    adaptHostCss: process.argv.includes("--adapt-host-css") || process.argv.includes("--auto-repair"),
    autoRepair: process.argv.includes("--auto-repair"),
    browserCheckReport: argument("--browser-check-report") ? resolve(argument("--browser-check-report") as string) : undefined,
    mufyRuntime: resolve(required("--mufy-runtime")),
    promptJson: resolve(required("--prompt-json")),
    dearmMobileRuntime: argument("--dearm-mobile-runtime")
      ? resolve(argument("--dearm-mobile-runtime") as string)
      : undefined,
    dearmDesktopRuntime: argument("--dearm-desktop-runtime")
      ? resolve(argument("--dearm-desktop-runtime") as string)
      : undefined,
    fidelityReport: argument("--fidelity-report") ? resolve(argument("--fidelity-report") as string) : undefined,
    replyReport: argument("--reply-report") ? resolve(argument("--reply-report") as string) : undefined,
    jobDir: argument("--job-dir")
      ? resolve(argument("--job-dir") as string)
      : undefined,
    targetName: argument("--target-name"),
    ownerEmail: argument("--owner-email"),
    expectedDbHost: argument("--expected-db-host"),
    testBaseUrl: argument("--test-base-url") ?? process.env.DEARM_TEST_BASE_URL,
    updateCharacterId: argument("--update-character-id"),
    packId: argument("--pack-id"),
    visibility: oneOf(
      "--visibility",
      ["private", "unlisted", "public"] as const,
      "private",
    ),
    contentType: oneOf(
      "--content-type",
      ["original", "self_designed", "fanwork"] as const,
      "original",
    ),
    nsfw: optionalBoolean("--nsfw"),
    commit: process.argv.includes("--commit"),
    remigrate: process.argv.includes("--remigrate"),
    profilesJob: argument("--profiles-job"),
    profileKey: argument("--profile-key"),
  };
}

function safeSegment(value: string): string {
  return (
    value
      .replace(/[^\w一-鿿.-]/gu, "_")
      .replace(/_+/gu, "_")
      .replace(/^[_.]+|[_.]+$/gu, "")
      .slice(0, 48) || "character"
  );
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

async function run(args: string[]): Promise<void> {
  const child = Bun.spawn(args, {
    cwd: resolve("."),
    env: process.env,
    stdout: "inherit",
    stderr: "inherit",
  });
  const exitCode = await child.exited;
  if (exitCode !== 0) {
    throw new Error(`${args.slice(0, 2).join(" ")} 失败，退出码 ${exitCode}`);
  }
}

function assertTestBaseUrl(value: string): string {
  const url = new URL(value);
  if (!/^https?:$/u.test(url.protocol)) {
    throw new Error("测试服地址只允许 http/https");
  }
  if (["dearm.ai", "www.dearm.ai"].includes(url.hostname.toLowerCase())) {
    throw new Error("拒绝正式服地址；Mufy 迁移 Agent 只允许测试服");
  }
  return url.toString().replace(/\/$/u, "");
}

async function saveState(path: string, state: AgentState) {
  state.updatedAt = new Date().toISOString();
  await writeFile(path, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

async function main() {
  const options = parseOptions();
  const [runtimeText, promptText] = await Promise.all([
    readFile(options.mufyRuntime, "utf8"),
    readFile(options.promptJson, "utf8"),
  ]);
  const source = JSON.parse(runtimeText) as RuntimeVisualSnapshot & {
    characterId?: string;
    characterName?: string;
    detail?: unknown;
  };
  if (
    source.version !== 3 ||
    source.quality?.version !== 1 ||
    !source.characterId ||
    !source.characterName ||
    !source.detail
  ) {
    throw new Error(
      "来源不是最新版已登录浏览器快照；请在目标 Mufy 页面重新运行 export-mufy-runtime.js",
    );
  }

  const jobDir =
    options.jobDir ??
    resolve(
      "logs/card-imports/mufy-agent",
      `${safeSegment(source.characterName)}-${source.characterId.slice(0, 8)}`,
    );
  if (options.profilesJob || options.profileKey) {
    if (!options.profilesJob || !options.profileKey)
      throw new Error(
        "--profiles-job and --profile-key must be supplied together",
      );
    const profileDir = resolve(options.profilesJob);
    requireVerifiedSelection(
      await readJson<unknown>(join(profileDir, "test-selection.json")),
    );
    const sources = await readJson<ProfileSource[]>(
      join(profileDir, "sources.json"),
    );
    const profile = sources.find((p) => p.key === options.profileKey);
    if (!profile) throw new Error("Profile key not found");
    const candidate = requireReviewedProfile(
      profile,
      await readJson<ProfileObservation[]>(
        join(profileDir, "observations.json"),
      ),
      await readJson<ProfileReview[]>(join(profileDir, "reviews.json")),
    );
    if (
      candidate.roleId !== source.characterId ||
      profile.promptSha256 !== sha256(promptText)
    )
      throw new Error(
        "Profile handoff does not match runtime roleId or Prompt hash",
      );
    const inventory = validateTestInventory(
      await readJson<unknown>(join(profileDir, "test-inventory.json")),
    );
    const selection = selectNewTestProfiles(
      [
        {
          source: profile,
          candidate,
          observedAt: inventory.capturedAt,
          confirmed: true,
        },
      ],
      inventory,
      1,
    );
    if (
      selection.excluded.length &&
      !(
        options.remigrate &&
        options.updateCharacterId &&
        selection.excluded.every((item) =>
          item.targetIds.includes(options.updateCharacterId as string),
        )
      )
    )
      throw new Error(
        "角色在测试服存在同名/版本冲突；停止新建，先核对目标卡。显式更新需 --remigrate 和正确的 --update-character-id",
      );
  }
  await mkdir(jobDir, { recursive: true });
  const statePath = join(jobDir, "agent-state.json");
  let state: AgentState;
  try {
    state = await readJson<AgentState>(statePath);
    if (
      state.sourceRoleId !== source.characterId ||
      state.sourceRuntimeSha256 !== sha256(runtimeText) ||
      state.promptSha256 !== sha256(promptText)
    ) {
      throw new Error(
        "任务目录属于另一份来源快照；请更换 --job-dir，避免覆盖错误角色",
      );
    }
  } catch (error) {
    if (
      error instanceof Error &&
      !/ENOENT|no such file/iu.test(error.message)
    ) {
      throw error;
    }
    state = {
      version: 1,
      sourceRoleId: source.characterId,
      sourceName: source.characterName,
      sourceRuntimeSha256: sha256(runtimeText),
      promptSha256: sha256(promptText),
      stage: "source-ready",
      updatedAt: new Date().toISOString(),
      characterId: null,
      packId: null,
      targetUrl: null,
      migrationReport: null,
      visualReport: null,
      nextAction: null,
    };
  }
  // Every invocation must revalidate evidence against the current renderer.
  // A legacy complete state is not permission to bypass the stronger gate.
  if (state.stage === "complete") {
    state.stage = "awaiting-test-browser";
    state.nextAction = "重新核对当前渲染器的开场及两条后续回复证据；旧完成状态不直接沿用";
  }
  await saveState(statePath, state);

  const migrationReport = join(jobDir, "migration-report.json");
  const baseArgs = [
    "bun",
    resolve("scripts/migrate-mufy-card.ts"),
    "--role",
    source.characterId,
    "--prompt-json",
    options.promptJson,
    "--runtime-json",
    options.mufyRuntime,
    "--report",
    migrationReport,
    "--visibility",
    options.visibility,
    "--content-type",
    options.contentType,
  ];
  if (options.targetName) baseArgs.push("--target-name", options.targetName);
  if (options.allowMissingAudio) baseArgs.push("--allow-missing-audio");
  if (options.allowMissingImages) baseArgs.push("--allow-missing-media");
  if (options.preferLocalAge) baseArgs.push("--use-local-age");
  if (options.adaptHostCss) baseArgs.push("--adapt-host-css");
  if (options.nsfw !== undefined) baseArgs.push("--nsfw", String(options.nsfw));

  try {
    await run(baseArgs);
  } catch (error) {
    state.stage = "preflight-failed";
    state.migrationReport = migrationReport;
    state.nextAction = "根据 migration-report.json 修复阻断项后用同一命令续跑";
    await saveState(statePath, state);
    throw error;
  }
  state.stage = state.characterId
    ? "awaiting-test-browser"
    : "ready-to-write-test";
  state.migrationReport = migrationReport;
  const preparedReport=await readJson<{prepared:{issues:Array<{code:string;message:string}>}}>(migrationReport);
  state.automaticRepairs=preparedReport.prepared.issues.filter(issue=>issue.code==="AUTOMATIC_RUNTIME_ADAPTATION").map(issue=>issue.message);
  state.browserCheckPlan=join(jobDir,"browser-check-plan.json");
  await writeFile(state.browserCheckPlan, JSON.stringify({
    version: 3, scope: "TEST", sourceRoleId: source.characterId, targetUrl: state.targetUrl,
    viewports: [{ width: 390, height: 844 }, { width: 1280, height: 800 }],
    surfaces: ["preview", "chat"], states: ["initial", "expanded", "collapsed", "reopened"],
    fidelityReportOption: "--fidelity-report", replyReportOption: "--reply-report",
    completionRequires: "16 opening states AND two distinct existing later assistant replies, each with eight phone/desktop interaction states; exact source/target/renderer and fresh hash-bound local screenshots required",
    replyChecks: ["outer-background-source-contract", "system-box-count-and-style", "raw-tags-and-user-placeholders", "overflow-and-clipping", "all-controls-open-close-reopen", "runtime-errors", "source-visual-comparison"],
    replyProvenance: "existing-chat-reply only; no automatic paid send; offline fixtures are regression coverage, not live acceptance",
    automaticRepairs: state.automaticRepairs,
    checks: ["opening-styles-and-system-boxes", "source-notices", "current-user-name", "no-added-or-missing-components", "animated-cover-and-media", "composer-hit-test", "outer-and-iframe-overflow", "source-colors-alignment-and-image-size", "collapse-height-shrinks", "source-command-all-steps-fill-without-sending"],
    requiresHumanOnly: ["authentication-or-captcha", "source-identity-ambiguity", "new-security-permission"],
  }, null, 2));
  state.nextAction = state.characterId
    ? "测试服已写入；补齐手机和桌面验收快照后续跑"
    : "预检通过；使用 --commit 写入测试服";
  await saveState(statePath, state);

  const shouldWrite =
    options.commit && (!state.characterId || options.remigrate);
  if (shouldWrite) {
    if (
      !options.ownerEmail ||
      !options.expectedDbHost ||
      !options.testBaseUrl
    ) {
      throw new Error(
        "测试服写入需要 --owner-email、--expected-db-host、--test-base-url",
      );
    }
    const testBaseUrl = assertTestBaseUrl(options.testBaseUrl);
    const commitArgs = [
      ...baseArgs,
      "--commit",
      "--scope",
      "TEST",
      "--owner-email",
      options.ownerEmail,
      "--expected-db-host",
      options.expectedDbHost,
    ];
    const updateCharacterId =
      options.updateCharacterId ??
      (options.remigrate ? state.characterId : null);
    const packId = options.packId ?? (options.remigrate ? state.packId : null);
    if (updateCharacterId)
      commitArgs.push("--update-character-id", updateCharacterId);
    if (packId) commitArgs.push("--pack-id", packId);
    try {
      await run(commitArgs);
      const report = await readJson<{
        databaseWrite?: { characterId?: string; packId?: string };
      }>(migrationReport);
      state.characterId = report.databaseWrite?.characterId ?? null;
      state.packId = report.databaseWrite?.packId ?? null;
      if (!state.characterId) throw new Error("写入报告缺少测试服角色 ID");
      state.targetUrl = `${testBaseUrl}/chat/${state.characterId}`;
      state.stage = "awaiting-test-browser";
      state.testWrittenAt = new Date().toISOString();
      state.visualReport = null;
      delete state.acceptanceScope;
      state.nextAction = `浏览器执行 ${state.browserCheckPlan}：来源组件点击检查及手机/桌面导出后自动续跑；不需要用户逐卡确认`;
      await saveState(statePath, state);
    } catch (error) {
      state.stage = "test-write-failed";
      state.nextAction = "检查测试库保护参数和 migration-report.json 后续跑";
      await saveState(statePath, state);
      throw error;
    }
  }

  let browserStructuralOk = true;
  if (options.browserCheckReport) {
    if (!state.characterId || !state.targetUrl || !state.testWrittenAt) throw new Error("TEST_WRITE_PROVENANCE_REQUIRED");
    const review = reviewMufyBrowserRuns(await readJson<unknown>(options.browserCheckReport), {
      characterId: state.characterId, baseUrl: state.targetUrl, notBefore: state.testWrittenAt,
      allowMediaDeferral: options.allowMissingImages,
    });
    browserStructuralOk = review.structuralOk;
    state.browserReviewPath = join(jobDir, "browser-structural-review.json");
    state.repairQueuePath = join(jobDir, "repair-queue.json");
    await writeFile(state.browserReviewPath, JSON.stringify(review, null, 2));
    await writeFile(state.repairQueuePath, JSON.stringify({version: 1, scope: "TEST", targetCharacterId: state.characterId,
      autoRepairEnabled: options.autoRepair, repairsApplied: state.automaticRepairs ?? [],
      tasks: buildMufyRepairQueue(review.findings), completionRequires: "fresh browser and full source-comparing fidelity evidence", finalFidelityAccepted: false}, null, 2));
    if (!browserStructuralOk) {
      state.stage = "visual-failed";
      state.nextAction = `执行 ${state.repairQueuePath} 的修复任务并重新采集；不要求用户逐卡排查`;
    } else {
      state.stage = "awaiting-test-browser";
      state.nextAction = "结构与原生折叠检查通过，继续完成来源截图比对和定制交互验收";
    }
    await saveState(statePath, state);
  }

  if (options.dearmMobileRuntime && options.dearmDesktopRuntime) {
    // A source-only dry run must never complete by supplying arbitrary target
    // snapshots. Legacy state without write provenance requires a fresh replay.
    if (!state.characterId || !state.targetUrl || !state.testWrittenAt) {
      state.stage = "awaiting-test-browser";
      state.nextAction = "缺少测试服写入时间/角色绑定，须先执行受保护的 --commit --remigrate，再采集验收证据";
      await saveState(statePath, state);
      throw new Error("TEST_WRITE_PROVENANCE_REQUIRED");
    }
    const targetEntries = await Promise.all(
      [
        ["mobile", options.dearmMobileRuntime],
        ["desktop", options.dearmDesktopRuntime],
      ].map(async ([viewport, path]) => ({
        viewport,
        path,
        snapshot: await readJson<RuntimeVisualSnapshot>(path),
      })),
    );
    for (const target of targetEntries) {
      if (
        state.characterId &&
        target.snapshot.characterId !== state.characterId
      ) {
        throw new Error(
          `${target.viewport} 验收快照角色不匹配：期望 ${state.characterId}，实际 ${String(target.snapshot.characterId)}`,
        );
      }
    }
    const results = targetEntries.map((target) => ({
      viewport: target.viewport,
      path: target.path,
      ...verifyMufyVisualAcceptance(source, target.snapshot),
    }));
    for (const target of targetEntries) {
      const expectedWidth = target.viewport === "mobile" ? 390 : 1280;
      if (target.snapshot.viewport?.width !== expectedWidth) {
        results.find(entry => entry.viewport === target.viewport)!.ok = false;
      }
    }
    const evidenceBinding = {
      sourceRuntimeSha256: state.sourceRuntimeSha256,
      targetCharacterId: state.characterId,
      rendererSha256: sha256((await Promise.all([
        "src/lib/import/mufy-rendered-opening.ts",
        "src/lib/import/mufy-source-rules.ts",
        "src/lib/import/mufy-source-rule-envelope.ts",
        "src/lib/regex/segments.ts",
        "src/components/chat/MessageBubble.tsx",
        "src/components/chat/MessageRenderer.tsx",
        "src/components/chat/mufy-native-table.module.css",
        "src/lib/import/mufy-native-table.ts",
        "src/lib/regex/iframe-bridge.ts",
        "src/lib/import/mufy-runtime-adaptation.ts",
        "src/components/chat/ChatMessagesList.tsx",
        "src/components/chat/mufy-shared-component-context.ts",
        "src/lib/import/mufy-shared-component-style.ts",
        "src/components/chat/MufyReplySidebar.tsx",
        "src/components/regex/RegexIframe.tsx",
        "src/lib/regex/iframe-incremental.ts",
        "src/lib/chat/mufy-sidebar-owner.ts",
      ].map(async (file) => `${file}\n${await readFile(resolve(file), "utf8")}`))).join("\n")),
      targetBaseUrl: state.targetUrl,
      notBefore: state.testWrittenAt,
    };
    const fidelity = await verifyFidelityEvidenceFiles(options.fidelityReport ? await readJson<unknown>(options.fidelityReport) : undefined, evidenceBinding, options.fidelityReport ?? join(jobDir, "missing-fidelity-report.json"));
    const replies = await verifyMufyReplyEvidence(options.replyReport ? await readJson<unknown>(options.replyReport) : undefined, {
      ...evidenceBinding, openingText: selectMufyRuntimeDetail(source, source.characterId)?.detail.greeting ?? "",
      outputSetting:parseMufyPrompt(selectPromptRecord(parseMufyPromptSourceText(promptText),source.characterName).prompt).outputSetting??'',
    }, options.replyReport ?? join(jobDir, "missing-reply-report.json"));
    const result = {
      ok: browserStructuralOk && results.every((entry) => entry.ok) && fidelity.ok && replies.ok,
      fidelity,
      replies,
      results,
    };
    const visualReport = join(jobDir, "visual-acceptance.json");
    await writeFile(
      visualReport,
      `${JSON.stringify({ ...result, source: options.mufyRuntime }, null, 2)}\n`,
      "utf8",
    );
    state.visualReport = visualReport;
    state.acceptanceScope = result.ok ? REPLY_ACCEPTANCE_SCOPE : undefined;
    state.replyReport = options.replyReport;
    if (!replies.ok) {
      const replyQueuePath = join(jobDir, "reply-repair-queue.json");
      await writeFile(replyQueuePath, JSON.stringify({ version: 1, finalAccepted: false, findings: replies.errors,
        nextAction: "Agent 检查来源合同及真实聊天 DOM；若为完成标记冲突，保留原卡并添加宿主结束边界兼容指令，通过正常owner编辑入口保存，再按用户已授权的测试额度完成两条真实回复复测。缺项未修复不得收尾；不让用户逐卡返修、不人工补写完成标记。",
        requiredMatrix: { distinctLaterAssistantMessages: 2, widths: [390, 1280], states: ["initial", "expanded", "collapsed", "reopened"] },
        syntheticReplayIsNotLiveAcceptance: true }, null, 2));
    }
    state.stage = result.ok ? "complete" : "visual-failed";
    state.nextAction = result.ok
      ? null
      : "按 visual-acceptance.json / reply-repair-queue.json 修复并重采证据；仅渲染器变更不要求重导卡或修改数据库";
    await saveState(statePath, state);
  } else if (options.dearmMobileRuntime || options.dearmDesktopRuntime) {
    state.stage = "awaiting-test-browser";
    state.nextAction = options.dearmMobileRuntime
      ? "还缺桌面验收快照 --dearm-desktop-runtime"
      : "还缺手机验收快照 --dearm-mobile-runtime";
    await saveState(statePath, state);
  }

  console.log(
    JSON.stringify(
      {
        ok: state.stage === "complete",
        stage: state.stage,
        character: state.sourceName,
        targetUrl: state.targetUrl,
        nextAction: state.nextAction,
        statePath,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(
    error instanceof Error ? (error.stack ?? error.message) : error,
  );
  process.exit(1);
});
