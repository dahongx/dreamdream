"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BreathingDots } from "@/components/ai/BreathingDots";
import { OpeningComponentList } from "@/components/opening/OpeningComponentList";
import { AssistantTab } from "@/components/packs/studio/AssistantTab";
import {
  ExternalImportDialog,
  type ExternalImported,
} from "@/components/packs/studio/ExternalImportEntry";
import {
  type ChooserPick,
  NewSessionChooser,
} from "@/components/packs/studio/NewSessionChooser";
import {
  PreviewCanvas,
  type PreviewFocus,
} from "@/components/packs/studio/PreviewCanvas";
import { SessionFooter } from "@/components/packs/studio/SessionFooter";
import { StudioSessionSidebar } from "@/components/packs/studio/StudioSessionSidebar";
import { RegexRuleList } from "@/components/regex/RegexRuleList";
import { useDialog } from "@/components/ui/DialogProvider";
import { useI18n } from "@/i18n/client";
import type {
  BeautificationPack,
  OpeningComponent,
  RegexRule,
  StudioDraftPayload,
  StudioSession,
} from "@/lib/db/schema";
import {
  deleteOpeningComponentAction,
  updateOpeningComponentContentAction,
} from "@/lib/opening/actions";
import { updatePackAction } from "@/lib/packs/actions";
import type {
  ProposalAddOpening,
  ProposalAddRule,
} from "@/lib/packs/assistant-parser";
import {
  commitStudioSessionAction,
  createStudioSessionAction,
  discardStudioSessionAction,
  getSessionMessagesAction,
  updateSessionDraftAction,
} from "@/lib/packs/session-actions";
import { deleteRegexRuleAction } from "@/lib/regex/actions";

type Drawer = "rules" | "css" | "opening" | null;

export interface AssistantHistoryItem {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface Props {
  pack: BeautificationPack;
  rules: RegexRule[];
  openingComponents: OpeningComponent[];
  sessions: StudioSession[];
  initialActiveSessionId: string | null;
  initialMessages: AssistantHistoryItem[];
  returnTo?: string | null;
}

/**
 * Pack studio canvas layout —— session 模型（一个会话 = 一个产物）。
 *
 * 状态：
 *   persistedRules / persistedCss   服务端真相
 *   sessions                         全部 session 列表（含 active/committed/discarded）
 *   activeSessionId                  当前选中会话 id；只有 active 状态才能 commit/discard
 *   draftPayload(本地)               active session 的 WIP；写后端走 debounce updateSessionDraft
 *
 * 派生 liveRules / liveCss：
 *   - 无 active session → 完全 persisted
 *   - css active → liveCss = draftPayload.css ?? persistedCss
 *   - component active 新建 → append 一个虚拟 rule
 *   - component active 编辑 → 替换 targetRuleId 那条
 */
export function StudioLayout({
  pack,
  rules,
  openingComponents,
  sessions: initialSessions,
  initialActiveSessionId,
  initialMessages,
  returnTo,
}: Props) {
  const { dict } = useI18n();
  const router = useRouter();
  // 全站统一确认/提示框 —— 原生 window.confirm/alert 是系统样式，暗夜氛围出戏
  const { confirm: confirmDialog, alert: alertDialog } = useDialog();
  const [persistedRules, setPersistedRules] = useState(rules);
  const [persistedCss, setPersistedCss] = useState(pack.globalCss ?? "");
  const [directCssDraft, setDirectCssDraft] = useState(pack.globalCss ?? "");
  const [directCssSaving, setDirectCssSaving] = useState(false);
  const [persistedOpening, setPersistedOpening] = useState(openingComponents);
  const [viewingOpeningId, setViewingOpeningId] = useState<string | null>(null);
  const [directOpeningDraft, setDirectOpeningDraft] = useState("");
  const [directOpeningSaving, setDirectOpeningSaving] = useState(false);
  const [sessions, setSessions] = useState<StudioSession[]>(initialSessions);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(
    initialActiveSessionId,
  );
  const [drawer, setDrawer] = useState<Drawer>(null);
  const [externalImportOpen, setExternalImportOpen] = useState(false);
  const [chooserOpen, setChooserOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  /** 移动端单视图切换。默认进入「对话」，无 active session 时引导到「会话」。
   *  桌面端忽略此 state — 三栏一直全显。 */
  const [mobileView, setMobileView] = useState<"sessions" | "chat" | "preview">(
    initialActiveSessionId ? "chat" : "sessions",
  );

  // 消息缓存：session id → messages。初始 active session 的消息由 RSC 预加载。
  const [messagesCache, setMessagesCache] = useState<
    Map<string, AssistantHistoryItem[]>
  >(() => {
    const m = new Map<string, AssistantHistoryItem[]>();
    if (initialActiveSessionId) m.set(initialActiveSessionId, initialMessages);
    return m;
  });
  const [_loadingMessages, setLoadingMessages] = useState(false);

  // 切换 session 时自动加载消息
  useEffect(() => {
    if (!activeSessionId) return;
    if (messagesCache.has(activeSessionId)) return;
    let cancelled = false;
    setLoadingMessages(true);
    getSessionMessagesAction(activeSessionId).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setMessagesCache((prev) => {
          const next = new Map(prev);
          next.set(activeSessionId, result.messages);
          return next;
        });
      }
      setLoadingMessages(false);
    });
    return () => {
      cancelled = true;
    };
  }, [activeSessionId, messagesCache]);

  // 父级 prop 变化（revalidatePath 后 RSC 重渲）同步进 persisted。
  useEffect(() => setPersistedRules(rules), [rules]);
  useEffect(() => setPersistedOpening(openingComponents), [openingComponents]);
  useEffect(() => setPersistedCss(pack.globalCss ?? ""), [pack.globalCss]);
  useEffect(() => setDirectCssDraft(pack.globalCss ?? ""), [pack.globalCss]);
  useEffect(() => setSessions(initialSessions), [initialSessions]);

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionId) ?? null,
    [sessions, activeSessionId],
  );
  const isActiveLive = activeSession?.status === "active";

  // 派生 liveRules / liveCss。component 编辑模式时按 id 替换；新建模式 append。
  const { liveRules, liveCss } = useMemo(() => {
    if (!activeSession || !isActiveLive) {
      return { liveRules: persistedRules, liveCss: persistedCss };
    }
    const payload = activeSession.draftPayload as StudioDraftPayload | null;
    if (!payload) {
      return { liveRules: persistedRules, liveCss: persistedCss };
    }
    if (payload.kind === "css") {
      return { liveRules: persistedRules, liveCss: payload.css };
    }
    if (payload.kind !== "rule") {
      // opening 草稿不影响 rules/css
      return { liveRules: persistedRules, liveCss: persistedCss };
    }
    // payload.kind === "rule"
    if (activeSession.targetRuleId) {
      const rules: RegexRule[] = persistedRules.map((r) =>
        r.id === activeSession.targetRuleId
          ? {
              ...r,
              name: payload.rule.name,
              targetText: payload.rule.targetText ?? null,
              pattern: payload.rule.pattern,
              replacement: payload.rule.replacement,
              variableMapping: payload.rule.variableMapping,
              outputGuidance: payload.rule.outputGuidance ?? null,
              enabled: payload.rule.enabled,
              visible: payload.rule.visible,
              updatedAt: new Date(),
            }
          : r,
      );
      return { liveRules: rules, liveCss: persistedCss };
    }
    // 新建：尾部 append 一条虚拟 rule（id 用 draft-session）
    const virtual: RegexRule = {
      id: `draft-${activeSession.id}`,
      packId: pack.id,
      name: payload.rule.name,
      targetText: payload.rule.targetText ?? null,
      pattern: payload.rule.pattern,
      replacement: payload.rule.replacement,
      variableMapping: payload.rule.variableMapping,
      outputGuidance: payload.rule.outputGuidance ?? null,
      enabled: payload.rule.enabled,
      visible: payload.rule.visible,
      orderIndex: persistedRules.length,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    return { liveRules: [...persistedRules, virtual], liveCss: persistedCss };
  }, [activeSession, isActiveLive, persistedRules, persistedCss, pack.id]);

  // 派生 liveOpeningComponents。opening 编辑模式按 id 替换；新建模式 append 虚拟项。
  const liveOpeningComponents = useMemo(() => {
    if (!activeSession || !isActiveLive || activeSession.type !== "opening") {
      return persistedOpening;
    }
    const payload = activeSession.draftPayload as StudioDraftPayload | null;
    if (!payload || payload.kind !== "opening") return persistedOpening;
    if (activeSession.targetOpeningComponentId) {
      return persistedOpening.map((c) =>
        c.id === activeSession.targetOpeningComponentId
          ? {
              ...c,
              name: payload.opening.name,
              content: payload.opening.content,
              enabled: payload.opening.enabled,
              updatedAt: new Date(),
            }
          : c,
      );
    }
    const virtual: OpeningComponent = {
      id: `draft-${activeSession.id}`,
      packId: pack.id,
      name: payload.opening.name,
      content: payload.opening.content,
      enabled: payload.opening.enabled,
      orderIndex: persistedOpening.length,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    return [...persistedOpening, virtual];
  }, [activeSession, isActiveLive, persistedOpening, pack.id]);

  const hasDraft = !!activeSession?.draftPayload;

  // 编辑模式下，被编辑组件的名字 —— 注入 AssistantTab 空状态，让创作者
  // 一眼知道这是在迭代现有组件（AI 已拿到它的当前内容），而非从零新建。
  const editingTargetName = useMemo(() => {
    if (!activeSession) return null;
    if (activeSession.targetRuleId) {
      return (
        persistedRules.find((r) => r.id === activeSession.targetRuleId)?.name ??
        null
      );
    }
    if (activeSession.targetOpeningComponentId) {
      return (
        persistedOpening.find(
          (c) => c.id === activeSession.targetOpeningComponentId,
        )?.name ?? null
      );
    }
    return null;
  }, [activeSession, persistedRules, persistedOpening]);

  // 派生 PreviewCanvas 的聚焦模式：任何选中的 session 都聚焦到对应产物。
  const previewFocus: PreviewFocus = useMemo(() => {
    if (!activeSession) return { kind: "all" };
    if (activeSession.type === "css") return { kind: "css" };
    if (activeSession.type === "opening") {
      const payload = activeSession.draftPayload as StudioDraftPayload | null;
      const draftContent =
        payload?.kind === "opening" ? payload.opening.content : null;
      const draftName =
        payload?.kind === "opening" ? payload.opening.name : null;
      const target = activeSession.targetOpeningComponentId
        ? persistedOpening.find(
            (c) => c.id === activeSession.targetOpeningComponentId,
          )
        : null;
      return {
        kind: "opening",
        content: draftContent ?? target?.content ?? "",
        label: draftName || target?.name || dict.opening.sectionTitle,
      };
    }
    // component session — 无论 active/committed/discarded 都聚焦
    const payload = activeSession.draftPayload as StudioDraftPayload | null;
    if (activeSession.targetRuleId) {
      const target = persistedRules.find(
        (r) => r.id === activeSession.targetRuleId,
      );
      return {
        kind: "rule",
        ruleId: activeSession.targetRuleId,
        label: target?.name ?? dict.packs.studioFallbackRule,
      };
    }
    // active session with draft: 用 virtual draft id
    if (isActiveLive && payload?.kind === "rule") {
      return {
        kind: "rule",
        ruleId: `draft-${activeSession.id}`,
        label: payload.rule.name || dict.packs.studioFallbackNewRule,
      };
    }
    // committed/discarded session 创建的新 rule：按名称匹配 persistedRules
    if (!isActiveLive && payload?.kind === "rule" && payload.rule.name) {
      const matched = persistedRules.find((r) => r.name === payload.rule.name);
      if (matched) {
        return { kind: "rule", ruleId: matched.id, label: matched.name };
      }
    }
    // active session 还没出 proposal → 空白画布
    if (isActiveLive) {
      return {
        kind: "rule",
        ruleId: "",
        label: dict.packs.studioFallbackNewRule,
      };
    }
    return { kind: "all" };
  }, [
    activeSession,
    isActiveLive,
    persistedRules,
    persistedOpening,
    dict.opening.sectionTitle,
    dict.packs.studioFallbackRule,
    dict.packs.studioFallbackNewRule,
  ]);

  /** 把本地的 draftPayload 改动持久化到后端，debounce 400ms。 */
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistDraft = useCallback(
    (sessionId: string, payload: StudioDraftPayload) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        void updateSessionDraftAction(sessionId, payload);
      }, 400);
    },
    [],
  );

  const setSessionDraft = useCallback(
    (sessionId: string, payload: StudioDraftPayload) => {
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId
            ? { ...s, draftPayload: payload, updatedAt: new Date() }
            : s,
        ),
      );
      persistDraft(sessionId, payload);
    },
    [persistDraft],
  );

  function onRuleAddedInSession(payload: ProposalAddRule) {
    if (!activeSession || activeSession.type !== "component" || !isActiveLive)
      return;
    const draftPayload: StudioDraftPayload = {
      kind: "rule",
      rule: {
        name: payload.name,
        description: payload.description,
        targetText: payload.targetText ?? null,
        pattern: payload.pattern,
        replacement: payload.replacement,
        variableMapping: payload.variableMapping ?? [],
        outputGuidance: payload.outputGuidance ?? null,
        enabled: payload.enabled ?? true,
        visible: payload.visible ?? false,
      },
    };
    setSessionDraft(activeSession.id, draftPayload);
  }

  function onCssChangedInSession(css: string) {
    if (!activeSession || activeSession.type !== "css" || !isActiveLive) return;
    setSessionDraft(activeSession.id, { kind: "css", css });
  }

  function onOpeningAddedInSession(payload: ProposalAddOpening) {
    if (!activeSession || activeSession.type !== "opening" || !isActiveLive)
      return;
    setSessionDraft(activeSession.id, {
      kind: "opening",
      opening: {
        name: payload.name,
        description: payload.description,
        content: payload.content,
        enabled: true,
      },
    });
  }

  async function handleCreate(pick: ChooserPick) {
    setCreating(true);
    setChooserOpen(false);
    try {
      const result = await createStudioSessionAction({
        packId: pack.id,
        type: pick.type,
        targetRuleId:
          pick.type === "component" && "targetRuleId" in pick
            ? pick.targetRuleId
            : undefined,
        targetOpeningComponentId:
          pick.type === "opening" && "targetOpeningComponentId" in pick
            ? pick.targetOpeningComponentId
            : undefined,
      });
      if (!result.ok) {
        // eslint-disable-next-line no-console
        console.error("[studio] create session failed:", result.error);
        void alertDialog({ body: dict.packs.studioOperationFailed });
        return;
      }
      // 把旧 active 标记为 discarded（与 server 同步）+ 插入新 session
      setSessions((prev) => {
        const next = prev.map((s) =>
          s.status === "active" && s.id !== result.session.id
            ? { ...s, status: "discarded" as const, updatedAt: new Date() }
            : s,
        );
        return [result.session, ...next];
      });
      setActiveSessionId(result.session.id);
      setMobileView("chat");
    } finally {
      setCreating(false);
    }
  }

  async function handleConfirm() {
    if (!activeSession || !isActiveLive) return;
    const result = await commitStudioSessionAction(activeSession.id);
    if (!result.ok) {
      throw new Error(dict.packs.studioOperationFailed);
    }
    setPersistedRules(result.rules);
    setPersistedCss(result.globalCss);
    setPersistedOpening(result.openingComponents);
    setSessions((prev) =>
      prev.map((s) => (s.id === activeSession.id ? result.session : s)),
    );
    // 切到 null（无 active）—— sidebar 会把这条挪到「已应用」。
    setActiveSessionId(null);
    setMobileView("preview");
  }

  async function handleDiscard() {
    if (!activeSession || !isActiveLive) return;
    const result = await discardStudioSessionAction(activeSession.id);
    if (!result.ok) throw new Error(dict.packs.studioOperationFailed);
    setSessions((prev) =>
      prev.map((s) => (s.id === activeSession.id ? result.session : s)),
    );
    setActiveSessionId(null);
    setMobileView("sessions");
  }

  async function handleDirectCssSave() {
    setDirectCssSaving(true);
    const result = await updatePackAction(pack.id, {
      globalCss: directCssDraft,
    });
    setDirectCssSaving(false);
    if (!result.ok) {
      void alertDialog({ body: dict.packs.studioOperationFailed });
      return;
    }
    setPersistedCss(directCssDraft);
    router.refresh();
  }

  async function handleDirectOpeningSave() {
    if (!viewingOpeningId) return;
    setDirectOpeningSaving(true);
    const result = await updateOpeningComponentContentAction(
      viewingOpeningId,
      directOpeningDraft,
    );
    setDirectOpeningSaving(false);
    if (!result.ok) {
      void alertDialog({ body: dict.packs.studioOperationFailed });
      return;
    }
    const updated = persistedOpening.map((c) =>
      c.id === viewingOpeningId ? { ...c, content: directOpeningDraft } : c,
    );
    setPersistedOpening(updated);
    setViewingOpeningId(null);
    router.refresh();
  }

  function handleEditRule(ruleId: string) {
    void handleCreate({ type: "component", targetRuleId: ruleId });
  }

  async function handleDeleteRule(ruleId: string, ruleName: string) {
    const msg = dict.packs.studioSessionDeleteConfirm.replace(
      "{name}",
      ruleName,
    );
    if (!(await confirmDialog({ body: msg, danger: true }))) return;
    const result = await deleteRegexRuleAction(ruleId);
    if (!result.ok) {
      void alertDialog({ body: dict.packs.studioOperationFailed });
      return;
    }
    setPersistedRules((prev) => prev.filter((r) => r.id !== ruleId));
    setSessions((prev) =>
      prev.filter((s) => {
        if (s.type !== "component") return true;
        if (s.status === "active") return true;
        if (s.targetRuleId === ruleId) return false;
        if (!s.targetRuleId) {
          const p = s.draftPayload as StudioDraftPayload | null;
          if (p?.kind === "rule" && p.rule.name === ruleName) return false;
        }
        return true;
      }),
    );
  }

  function handleEditOpening(componentId: string) {
    void handleCreate({
      type: "opening",
      targetOpeningComponentId: componentId,
    });
  }

  // 外部导入成功 → 关弹框、刷新、把预览切到刚导入的那块（导入什么看到什么）
  function handleExternalImported(r: ExternalImported) {
    setExternalImportOpen(false);
    router.refresh();
    if (r.kind === "opening" && r.openingId) {
      handleEditOpening(r.openingId);
    } else {
      // 皮肤 / 正则：清掉会话回到「全部」预览，看到皮肤 + 所有组件
      setActiveSessionId(null);
      setDrawer(null);
    }
  }

  async function handleDeleteOpening(componentId: string) {
    // 二次确认 —— 会话栏的删除按钮直接删组件、不可撤销。复用 rule 删除的确认
    // 文案;名字从 persistedOpening 反查(删除按钮只传了 id)。
    const name = persistedOpening.find((c) => c.id === componentId)?.name ?? "";
    const msg = dict.packs.studioSessionDeleteOpeningConfirm.replace(
      "{name}",
      name,
    );
    if (!(await confirmDialog({ body: msg, danger: true }))) return;
    const result = await deleteOpeningComponentAction(componentId);
    if (!result.ok) {
      void alertDialog({ body: dict.packs.studioOperationFailed });
      return;
    }
    setPersistedOpening((prev) => prev.filter((c) => c.id !== componentId));
    setSessions((prev) =>
      prev.filter((s) => {
        if (s.type !== "opening") return true;
        if (s.status === "active") return true;
        return s.targetOpeningComponentId !== componentId;
      }),
    );
  }

  return (
    <div
      id="nj_pack_studio"
      className="flex h-[calc(100dvh-var(--topbar-height)-var(--bottombar-height)-env(safe-area-inset-bottom))] min-h-0 flex-col md:h-[calc(100dvh-var(--topbar-height))]"
    >
      {/* Top bar */}
      <div className="flex shrink-0 items-center justify-between gap-[var(--space-sm)] border-b border-border-subtle bg-bg-elevated px-[var(--space-md)] py-[var(--space-sm)] md:gap-[var(--space-md)] md:px-[var(--space-lg)]">
        <div className="flex min-w-0 items-center gap-[var(--space-sm)] md:gap-[var(--space-md)]">
          <h1 className="truncate font-display-zh text-sm text-text-primary md:text-base">
            {pack.name}
          </h1>
          <span className="hidden shrink-0 rounded-[var(--radius-pill)] border border-border-subtle bg-surface-glass/60 px-[var(--space-sm)] py-[2px] text-[10px] text-text-muted md:inline">
            {dict.packs.studioPackStatsSaved.replace(
              "{n}",
              String(persistedRules.length),
            )}
            {persistedCss.trim()
              ? ` · ${dict.packs.studioPackStatsHasCss}`
              : ""}
          </span>
        </div>
        <div className="flex flex-wrap justify-end gap-[var(--space-xs)] md:flex-nowrap md:gap-[var(--space-sm)]">
          <button
            type="button"
            onClick={() => setDrawer("rules")}
            className="rounded-[var(--radius-sm)] border border-border-subtle px-[var(--space-sm)] py-[2px] text-[11px] text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary md:px-[var(--space-sm)]"
          >
            {dict.packs.studioRulesTab} ({liveRules.length})
          </button>
          <button
            type="button"
            onClick={() => setDrawer("css")}
            className="rounded-[var(--radius-sm)] border border-border-subtle px-[var(--space-sm)] py-[2px] text-[11px] text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
          >
            {dict.packs.studioCssTab}
          </button>
          <button
            type="button"
            onClick={() => setDrawer("opening")}
            className="rounded-[var(--radius-sm)] border border-border-subtle px-[var(--space-sm)] py-[2px] text-[11px] text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
          >
            {dict.opening.sectionTitle} ({liveOpeningComponents.length})
          </button>
          <button
            type="button"
            onClick={() => setExternalImportOpen(true)}
            className="shrink-0 rounded-[var(--radius-sm)] border border-accent-primary/50 px-[var(--space-sm)] py-[2px] text-[11px] font-semibold text-accent-primary transition-colors hover:bg-accent-primary/10"
          >
            {dict.packs.studioImportExternal}
          </button>
          <Link
            href={returnTo ?? "/packs"}
            className="shrink-0 rounded-[var(--radius-sm)] border border-border-subtle px-[var(--space-sm)] py-[2px] text-[11px] text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
          >
            {dict.packs.studioBack}
          </Link>
        </div>
      </div>

      {/* Mobile-only segmented tab —— 切换 sessions / chat / preview。
          桌面端隐藏，三栏始终全显。 */}
      <div className="flex shrink-0 gap-[2px] border-b border-border-subtle bg-bg-elevated px-[var(--space-sm)] py-[var(--space-xs)] md:hidden">
        <MobileTab
          label={dict.packs.studioMobileTabSessions}
          active={mobileView === "sessions"}
          onClick={() => setMobileView("sessions")}
          badge={
            sessions.filter((s) => s.status === "active").length || undefined
          }
        />
        <MobileTab
          label={dict.packs.studioMobileTabChat}
          active={mobileView === "chat"}
          onClick={() => setMobileView("chat")}
          disabled={!activeSession}
        />
        <MobileTab
          label={dict.packs.studioMobileTabPreview}
          active={mobileView === "preview"}
          onClick={() => setMobileView("preview")}
          focused={previewFocus.kind !== "all"}
        />
      </div>

      {/* Main body: sidebar + middle chat + right preview */}
      <div className="flex min-h-0 flex-1">
        <div
          className={`${mobileView === "sessions" ? "flex" : "hidden"} w-full flex-col md:flex md:w-auto`}
        >
          <StudioSessionSidebar
            sessions={sessions}
            persistedRules={persistedRules}
            persistedOpening={persistedOpening}
            activeSessionId={activeSessionId}
            onSelect={(id) => {
              setActiveSessionId(id);
              if (id) setMobileView("chat");
            }}
            onNew={() => setChooserOpen(true)}
            onEditRule={handleEditRule}
            onDeleteRule={handleDeleteRule}
            onEditOpening={handleEditOpening}
            onDeleteOpening={handleDeleteOpening}
          />
        </div>

        <div
          id="nj_pack_studio_assistant"
          className={`${mobileView === "chat" ? "flex" : "hidden"} min-w-0 flex-[1.5] flex-col border-r border-border-subtle md:flex`}
        >
          {activeSession ? (
            <>
              <div className="flex min-h-0 flex-1 flex-col">
                <AssistantTab
                  session={activeSession}
                  initialMessages={messagesCache.get(activeSession.id) ?? []}
                  rules={liveRules}
                  globalCss={liveCss}
                  readOnly={!isActiveLive}
                  editingTargetName={editingTargetName}
                  onRuleAdded={onRuleAddedInSession}
                  onCssChanged={onCssChangedInSession}
                  onOpeningAdded={onOpeningAddedInSession}
                />
              </div>
              {!isActiveLive && (
                <div className="shrink-0 border-t border-border-subtle bg-bg-elevated px-[var(--space-md)] py-[var(--space-sm)] text-xs text-text-muted">
                  {activeSession.status === "committed"
                    ? dict.packs.studioSessionCommittedReadonly
                    : dict.packs.studioSessionDiscardedHint}
                </div>
              )}
            </>
          ) : (
            <EmptyState onNew={() => setChooserOpen(true)} />
          )}
        </div>

        <div
          id="nj_pack_studio_preview"
          className={`${mobileView === "preview" ? "flex" : "hidden"} min-w-0 flex-1 flex-col md:flex`}
        >
          <PreviewCanvas
            packId={pack.id}
            rules={liveRules}
            globalCss={liveCss}
            focus={previewFocus}
            footerActions={
              activeSession && isActiveLive ? (
                <SessionFooter
                  session={activeSession}
                  hasDraft={hasDraft}
                  onConfirm={handleConfirm}
                  onDiscard={handleDiscard}
                />
              ) : undefined
            }
          />
        </div>
      </div>

      {/* Chooser modal */}
      <NewSessionChooser
        open={chooserOpen}
        rules={persistedRules}
        hasActiveSession={sessions.some((s) => s.status === "active")}
        onCancel={() => setChooserOpen(false)}
        onPick={handleCreate}
      />

      {/* Drawer overlay —— 后续 Task #6 把它退化为 session 入口跳板 */}
      {drawer && (
        <div className="fixed inset-0 z-50 flex">
          <button
            type="button"
            aria-label={dict.packs.studioImportDialogCloseAria}
            onClick={() => setDrawer(null)}
            className="flex-1 bg-bg-base/60 backdrop-blur-sm"
          />
          <div className="flex w-[min(560px,90vw)] flex-col border-l border-border-subtle bg-bg-base shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-border-subtle px-[var(--space-lg)] py-[var(--space-md)]">
              <h2 className="font-display-zh text-lg text-text-primary">
                {drawer === "rules"
                  ? dict.packs.studioRulesTab
                  : drawer === "opening"
                    ? dict.opening.sectionTitle
                    : dict.packs.studioCssTab}
              </h2>
              <button
                type="button"
                onClick={() => setDrawer(null)}
                aria-label={dict.packs.studioImportDialogCloseAria}
                className="rounded-[var(--radius-sm)] border border-border-subtle px-[var(--space-sm)] py-[var(--space-xs)] text-sm text-text-muted transition-colors hover:border-border-strong hover:text-text-primary"
              >
                ×
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-[var(--space-md)]">
              {drawer === "rules" && (
                <RegexRuleList
                  packId={pack.id}
                  rules={persistedRules}
                  onEditOverride={(ruleId) => {
                    setDrawer(null);
                    void handleCreate({
                      type: "component",
                      targetRuleId: ruleId,
                    });
                  }}
                />
              )}
              {drawer === "opening" && (
                <div className="flex flex-col gap-[var(--space-md)]">
                  <p className="text-xs text-text-muted">
                    {dict.packs.openingPrivateNotice}
                  </p>
                  {viewingOpeningId ? (
                    <div className="flex flex-col gap-[var(--space-md)]">
                      <div className="rounded-[var(--radius-sm)] border border-border-subtle bg-surface-glass/60 p-[var(--space-md)]">
                        <p className="mb-[var(--space-xs)] text-sm font-semibold text-text-primary">
                          {dict.packs.studioOpeningSourceTitle}
                        </p>
                        <textarea
                          value={directOpeningDraft}
                          onChange={(e) =>
                            setDirectOpeningDraft(e.currentTarget.value)
                          }
                          className="max-h-[60vh] min-h-[300px] w-full resize-y rounded-[var(--radius-sm)] border border-border-subtle bg-bg-base/60 p-[var(--space-sm)] font-mono text-xs leading-relaxed text-text-primary placeholder:text-text-muted focus:border-accent-primary focus:outline-none"
                        />
                        <div className="mt-[var(--space-sm)] flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => setViewingOpeningId(null)}
                            className="self-start rounded-[var(--radius-sm)] border border-accent-primary/50 px-[var(--space-md)] py-[var(--space-xs)] text-xs font-semibold text-accent-primary transition-colors hover:bg-accent-primary/10"
                          >
                            {dict.packs.studioBackToList}
                          </button>
                          <button
                            type="button"
                            onClick={handleDirectOpeningSave}
                            disabled={
                              directOpeningSaving ||
                              directOpeningDraft ===
                                (persistedOpening.find(
                                  (c) => c.id === viewingOpeningId,
                                )?.content ?? "")
                            }
                            className="rounded-[var(--radius-sm)] bg-accent-primary px-[var(--space-md)] py-[var(--space-xs)] text-xs font-semibold text-text-on-accent transition-colors hover:bg-accent-primary-hover disabled:opacity-40"
                          >
                            {directOpeningSaving
                              ? dict.packs.studioSaving
                              : dict.packs.studioSave}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <OpeningComponentList
                      packId={pack.id}
                      components={liveOpeningComponents}
                      onCreate={() => {
                        setDrawer(null);
                        void handleCreate({ type: "opening" });
                      }}
                      onEditOverride={(id) => {
                        setDrawer(null);
                        handleEditOpening(id);
                      }}
                      onDeleteOverride={(id) => {
                        void handleDeleteOpening(id);
                      }}
                      onViewSource={(id) => {
                        const component = persistedOpening.find(
                          (c) => c.id === id,
                        );
                        if (component) {
                          setViewingOpeningId(id);
                          setDirectOpeningDraft(component.content);
                        }
                      }}
                    />
                  )}
                </div>
              )}
              {drawer === "css" && (
                <div className="flex flex-col gap-[var(--space-md)]">
                  <div className="rounded-[var(--radius-sm)] border border-border-subtle bg-surface-glass/60 p-[var(--space-md)]">
                    <textarea
                      value={directCssDraft}
                      onChange={(e) => setDirectCssDraft(e.target.value)}
                      className="max-h-[50vh] min-h-[200px] w-full resize-y rounded-[var(--radius-sm)] border border-border-subtle bg-bg-base/60 p-[var(--space-sm)] font-mono text-xs leading-relaxed text-text-primary focus:border-accent-primary focus:outline-none"
                      placeholder={dict.packs.studioCssPlaceholder}
                      spellCheck={false}
                    />
                    <div className="mt-[var(--space-xs)] flex items-center justify-between">
                      <span className="font-mono text-xs text-text-muted">
                        {dict.packs.studioCssScopeHint}
                      </span>
                      <button
                        type="button"
                        onClick={handleDirectCssSave}
                        disabled={
                          directCssSaving || directCssDraft === persistedCss
                        }
                        className="rounded-[var(--radius-sm)] bg-accent-primary px-[var(--space-md)] py-[var(--space-xs)] text-sm font-semibold text-text-on-accent transition-colors hover:bg-accent-primary-hover disabled:opacity-40"
                      >
                        {directCssSaving
                          ? dict.packs.studioSaving
                          : dict.packs.studioSave}
                      </button>
                    </div>
                  </div>
                  <div className="border-t border-border-subtle pt-[var(--space-md)]">
                    <button
                      type="button"
                      onClick={() => {
                        setDrawer(null);
                        void handleCreate({ type: "css" });
                      }}
                      className="self-start rounded-[var(--radius-sm)] border border-accent-primary/50 px-[var(--space-md)] py-[var(--space-sm)] text-sm font-semibold text-accent-primary transition-colors hover:bg-accent-primary/10"
                    >
                      {dict.packs.studioNewCssSession}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <ExternalImportDialog
        packId={pack.id}
        open={externalImportOpen}
        onClose={() => setExternalImportOpen(false)}
        onImported={handleExternalImported}
      />

      {creating && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-bg-base/40 backdrop-blur-sm">
          <div className="flex items-center gap-[var(--space-sm)] rounded-[var(--radius-md)] border border-border-subtle bg-bg-elevated px-[var(--space-lg)] py-[var(--space-md)] text-sm text-text-secondary">
            <BreathingDots size={6} />
            {dict.packs.studioCreatingSession}
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  const { dict } = useI18n();
  const t = dict.packs;
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-[var(--space-md)] p-[var(--space-xl)] text-center">
      <p className="font-display-zh text-2xl text-text-primary">
        {t.studioSessionEmptyState}
      </p>
      <button
        type="button"
        onClick={onNew}
        className="rounded-[var(--radius-sm)] bg-accent-primary px-[var(--space-lg)] py-[var(--space-sm)] text-sm font-semibold text-text-on-accent transition-colors hover:bg-accent-primary-hover"
      >
        {t.studioSessionEmptyStateCTA}
      </button>
    </div>
  );
}

function MobileTab({
  label,
  active,
  onClick,
  disabled,
  badge,
  focused,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  badge?: number;
  focused?: boolean;
}) {
  const { dict } = useI18n();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-1 items-center justify-center gap-[var(--space-xs)] rounded-[var(--radius-sm)] px-[var(--space-sm)] py-[var(--space-xs)] text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? "bg-accent-primary/15 text-accent-primary"
          : "text-text-muted hover:text-text-primary"
      }`}
    >
      <span>{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="rounded-[var(--radius-pill)] bg-accent-amber/20 px-[6px] py-[1px] text-[10px] font-mono text-accent-amber">
          {badge}
        </span>
      )}
      {focused && !active && (
        <span
          role="img"
          aria-label={dict.packs.studioMobileTabFocusedAria}
          className="inline-block h-[6px] w-[6px] rounded-full bg-accent-primary"
        />
      )}
    </button>
  );
}
