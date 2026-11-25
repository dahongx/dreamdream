"use client";
import {derivePublicNoteHeader} from '@/lib/opening/public-note-header';

import { useChat } from "@ai-sdk/react";
import {admitHostComposerSendAsync,createHostAdmissionTracker,type HostSendOptions,type ComposerDraftSnapshot} from "@/lib/opening/host-composer-send-candidate";
import { DefaultChatTransport } from "ai";
import {
  List as ListIcon,
  VenetianMask as MaskIcon,
  RotateCcw as RegenerateIcon,
  History as ReviewIcon,
  Send as SendIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ModelPicker } from "@/components/ai/ModelPicker";
import { ChatHeaderMenu } from "@/components/chat/ChatHeaderMenu";
import { createComposerTextareaAutosizer } from "@/lib/chat/composer-textarea-autosize";
import { chatStreamErrorDiagnosticAttribute } from "@/lib/chat/chat-stream-error-taxonomy";
import { ChatMessagesList } from "@/components/chat/ChatMessagesList";
import {
  ChatReviewDrawer,
  type ReviewNode,
} from "@/components/chat/ChatReviewDrawer";
import { ChatSessionsDrawer } from "@/components/chat/ChatSessionsDrawer";
import { ChatStage } from "@/components/chat/ChatStage";
import {
  CurrencySwitcher,
  type CurrencyType,
} from "@/components/chat/CurrencySwitcher";
import { ChatHistoryContext } from "@/components/chat/chat-history-context";
import { FloatingLayer } from "@/components/chat/FloatingLayer";
import { FloatingSlot } from "@/components/chat/FloatingSlot";
import { MaskDialog } from "@/components/chat/MaskDialog";
import {MufyPrefixPanel} from '@/components/chat/MufyPrefixPanel';
import {MufySourceControls,uniqueSourceControls} from '@/components/chat/MufySourceControls';
import {ChatInputToolbar} from '@/components/chat/ChatInputToolbar';
import {appendComposerDraft,type ComposerFillOptions} from '@/lib/opening/composer-fill';
import {applyScopedComposerPrefix,uniqueComposerPrefix,type ComposerPrefixSelection} from '@/lib/opening/composer-prefix';
import {extractNativeImageSidebars} from '@/lib/opening/native-image-sidebar';
import {applyScopedHaloCommands,type HaloCommandState} from '@/lib/opening/halo-toolkit';
import {MufyHaloToolkit} from './MufyHaloToolkit';
import { ReplySuggestions } from "@/components/chat/ReplySuggestions";
import { StageAdjustmentMenu } from "@/components/chat/StageAdjustmentMenu";
import { InsufficientCurrencyModal } from "@/components/quota/InsufficientCurrencyModal";
import type { HostHistoryEntry } from "@/components/regex/RegexIframe";
import { useDialog } from "@/components/ui/DialogProvider";
import { useToast } from "@/components/ui/ToastProvider";
import { useI18n } from "@/i18n/client";
import {
  DEFAULT_MODEL_ID,
  isNimirModelId,
  type NimirModelId,
} from "@/lib/ai/models";
import { isExplicitModelRefusal } from "@/lib/ai/response-refusal";
import { hasMufyAdaptedComponent, hasMufyRenderedOpening } from "@/lib/import/mufy-native-table";
import {
  type ChatUIMessage,
  createPublicChatMeta,
  type DebugMeta,
} from "@/lib/chat/debug-meta";
import type { Character, RegexRule } from "@/lib/db/schema";
import type { MaskListItem } from "@/lib/masks/queries";
import type { OpeningComponentWithSlots } from "@/lib/opening/queries";
import {
  deleteMessagePairAction,
  deleteUserMessagePairAction,
  forkAtMessageAction,
  updateAssistantMessageAction,
  updateUserMessageAction,
} from "@/lib/sessions/actions";
import type { RecentSessionListItem } from "@/lib/sessions/queries";
import { firstChar } from "@/lib/util/first-char";
import { safeRandomUUID } from "@/lib/uuid";

interface Props {
  sessionId: string;
  character: Pick<
    Character,
    | "id"
    | "name"
    | "avatarUrl"
    | "coverImageUrl"
    | "tags"
    | "bio"
    | "creatorNote"
  >;
  initialMessages: ChatUIMessage[];
  rules: RegexRule[];
  /** Owner-private static opening components for this character's chat. */
  openingComponents: OpeningComponentWithSlots[];
  openingGlobalCss?: string;
  /** Initial per-user opt-out state for visible rules (true = applied). */
  initialUserPrefs: Record<string, boolean>;
  userName: string;
  /** Current user's avatar (Auth.js users.image). null → bubble shows fallback
   *  initial. Threaded through to MessageBubble so user-side bubbles get the
   *  same per-row avatar as the AI side. */
  userAvatarUrl: string | null;
  /** Whether the current user is allowed to see the debug panel (developer
   *  allowlist + card owner). Regular creators are gated out so they can't
   *  reverse-engineer host-level prompt engineering. */
  canDebug: boolean;
  /** Debug + perf metadata per assistant message id (owner-only payload). */
  debugMetaMap: Record<string, DebugMeta>;
  /** Assistant message ids whose generation was truncated by Gemini safety
   *  filter (or relay-side equivalent). Surfaces a "regenerate with another
   *  model" hint under the bubble. Visible to ALL users, not just owners. */
  truncatedBySafetyIds: string[];
  /** Full session list for current user; used to populate the mobile drawer.
   *  Desktop sidebar gets its own copy via the sibling ChatSidebar component. */
  sessions: RecentSessionListItem[];
  /** Character whose row should be highlighted in the sidebar/drawer. */
  activeCharacterId: string;
  masks: MaskListItem[];
  activeMaskId: string | null;
  /** Whether the user has unlimited mask creation (钻石/铂金会员). */
  hasUnlimitedMasks: boolean;
}

/**
 * Right column of /chat. Owns streaming + the per-bubble regex/sanitize
 * pipeline (via MessageBubble) + the developer-gated debug panel toggle
 * (see src/lib/auth/dev-allowlist.ts — gated solely on NIMIR_DEBUG_EMAILS;
 * developers can debug any card, not just their own).
 *
 * 三层舞台（spec §2.2）:
 *   #nj_background_image    立绘层（character.coverImageUrl 优先，fallback
 *                            avatarUrl；都没有也保留 div 让 creator CSS 可挂）
 *   #nj_background_overlay  bg-base @ 60% 蒙层，让文字可读
 *   内容层（z-index 20+）：header / messages / input
 *
 * Selector contract (creator CSS):
 *   #nj_background_image         舞台立绘
 *   #nj_background_overlay       立绘蒙层
 *   #nj_chat_header              top bar (character info)
 *   #nj_chat_messages            scrolling message list container
 *   .nj_ai_message_bubble        each assistant bubble
 *   .nj_user_message_bubble      each user bubble
 *   #nj_chat_input_container     输入区最外层 (form)
 *   #nj_chat_input_box           输入框「外框」wrapper (创作者在此加背景/边框)
 *   #nj_chat_input_textarea      外框内的实际 textarea (默认透明无边框)
 *   #nj_chat_send_button         submit button
 */

// 贴底阈值(px):视口距底部小于这个像素数,认为"仍在贴底范围内"。用户
// 轻微 wheel/touch/滚动条微调不 detach sticky —— 常见误触是滚轮点一格 =
// 10-100px。触屏 momentum scroll 尾巴、Mac trackpad 惯性也常在这个范围。
// 设 200px:覆盖三行文本 + AI ◇◇◇ + Menu 高度。apply-uLE 的 scrollHeight
// 突增补偿(方案 B)用 4× 这个阈值(800px)决定"是否离得太远,不再补偿"。
const STICKY_THRESHOLD_PX = 200;

export function ChatRoom({
  sessionId,
  character,
  initialMessages,
  rules,
  openingComponents,
  openingGlobalCss,
  initialUserPrefs,
  userName,
  userAvatarUrl,
  canDebug,
  debugMetaMap,
  truncatedBySafetyIds,
  sessions,
  activeCharacterId,
  masks: initialMasks,
  activeMaskId: initialActiveMaskId,
  hasUnlimitedMasks,
}: Props) {
  // 内容策略拦截统计。
  //
  // 事故背景（2026-07-05）：单用户对 Gemini 3.1 pro 连点 regenerate 13 次撞
  // content-filter，8 分钟内每次带全 220 条历史（tokens_in 190K+），把整机
  // 内存推穿。SAFETY 命中的半段不入库、退币退 quota；客户端硬上限做最后一道
  // 防线：
  //
  //   ≥3 次连续 safety 拦截 → 禁用 regenerate + 提示换模型/改消息
  //
  // 计数与 truncatedBySafety 状态一起靠 message.metadata.safetyBlocked 推导，
  // 无独立本地状态需要跨会话持久化。
  const SAFETY_RETRY_LIMIT = 3;
  const [runtimeSafetyIds, setRuntimeSafetyIds] = useState<Set<string>>(
    () => new Set(),
  );
  const truncatedBySafetySet = useMemo(() => {
    const set = new Set(truncatedBySafetyIds);
    for (const id of runtimeSafetyIds) set.add(id);
    return set;
  }, [truncatedBySafetyIds, runtimeSafetyIds]);
  const [safetyRetryCount, setSafetyRetryCount] = useState(0);
  const retryLimitReached = safetyRetryCount >= SAFETY_RETRY_LIMIT;
  const { dict } = useI18n();
  const { confirm } = useDialog();
  const { success } = useToast();
  const router = useRouter();
  // 顶部「←」按钮:优先回退到来源页(从 /explore / /sessions / 角色详情进来都
  // 能原路返回);直链或外部跳转进入时 fallback 到 /explore。
  const handleBack = useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/explore");
    }
  }, [router]);
  // 触屏设备（手机 / 平板）没有物理 Shift 键，无法用 Shift+Enter 换行。
  // 用 `pointer: coarse` 判定触屏：这类设备回车走换行、点发送按钮才发送；
  // 桌面（fine pointer）保持 Enter 发送 / Shift+Enter 换行。
  // SSR 初值 false 保证首屏与桌面一致，mount 后按真实设备纠正。
  const [isCoarsePointer, setIsCoarsePointer] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(pointer: coarse)");
    setIsCoarsePointer(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setIsCoarsePointer(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  const [modelId, setModelId] = useState<NimirModelId>(DEFAULT_MODEL_ID);
  const [currencyType, setCurrencyType] = useState<CurrencyType>("silver");
  // Per-session 模型记忆，per-sessionId localStorage 持久化。SSR 初始化用
  // DEFAULT_MODEL_ID 避免 hydration 不一致；mount 后从 localStorage 还原。
  // key 带 sessionId 让不同会话各自记住，切换 session 不串味。
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(`nj_model_${sessionId}`);
      if (raw && isNimirModelId(raw)) setModelId(raw);
    } catch {
      // 损坏 / 禁用 storage —— 保留默认，不打扰用户
    }
  }, [sessionId]);
  function handleModelChange(next: NimirModelId) {
    setModelId(next);
    // 换模型 = 用户对当前拒答做出的响应，safety 重试计数清零
    setSafetyRetryCount(0);
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(`nj_model_${sessionId}`, next);
    } catch {
      // ignore (无痕模式 / quota exceeded)
    }
  }
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [maskDialogOpen, setMaskDialogOpen] = useState(false);
  const [masks, setMasks] = useState<MaskListItem[]>(initialMasks);
  const [activeMaskId, setActiveMaskId] = useState<string | null>(
    initialActiveMaskId,
  );
  const effectiveUserName =
    masks.find((mask) => mask.id === activeMaskId)?.name ?? userName;
  // 立绘亮度 / 清晰度,per-character localStorage 持久化。默认 100/100
  // (identity)避免 SSR/hydration 不一致;mount 后从 localStorage 还原。
  const [stageAdjust, setStageAdjust] = useState<{
    brightness: number;
    clarity: number;
  }>({ brightness: 100, clarity: 100 });
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(`nj_stage_adj_${character.id}`);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<{
        brightness: number;
        clarity: number;
      }>;
      const b =
        typeof parsed.brightness === "number"
          ? Math.max(0, Math.min(100, parsed.brightness))
          : 100;
      const c =
        typeof parsed.clarity === "number"
          ? Math.max(0, Math.min(100, parsed.clarity))
          : 100;
      setStageAdjust({ brightness: b, clarity: c });
    } catch {
      // 损坏的 JSON / 禁用 storage —— 保留默认 100/100,不打扰用户
    }
  }, [character.id]);
  function handleStageAdjust(next: { brightness: number; clarity: number }) {
    setStageAdjust(next);
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        `nj_stage_adj_${character.id}`,
        JSON.stringify(next),
      );
    } catch {
      // ignore (无痕模式 / quota exceeded)
    }
  }
  // ref so the transport-body closure always sees the latest pick without
  // re-instantiating the transport (which would reset useChat state).
  const modelIdRef = useRef<NimirModelId>(modelId);
  const currencyTypeRef = useRef<CurrencyType>(currencyType);
  useEffect(() => {
    modelIdRef.current = modelId;
  }, [modelId]);
  useEffect(() => {
    currencyTypeRef.current = currencyType;
  }, [currencyType]);

  // onError 闭包要用 setMessages（useChat 的返回值），用 ref 解环。
  const setMessagesRef = useRef<
    ((updater: (prev: ChatUIMessage[]) => ChatUIMessage[]) => void) | null
  >(null);
  // useChat 会在重说开始时先从本地列表移除旧回复。服务端现在会等新回复
  // 成功落库后再替换旧回复；前端也保留一份，以便上游拒绝时立即恢复。
  const regenerateBackupRef = useRef<ChatUIMessage | null>(null);
  const {
    messages,
    sendMessage,
    regenerate,
    stop,
    status,
    error,
    setMessages,
  } = useChat<ChatUIMessage>({
    messages: initialMessages,
    // 用 UUID 作消息 id —— useChat 默认是 16 位短串，但 messages.id 列是 uuid。
    // 不对齐的话，刚发出去的 user 消息再去 edit / delete 全都按"找不到行"失败
    // （服务端依赖客户端 id 直接查表）。同一 UUID 在 /api/chat 路由里被复用为
    // messages.id 主键（见 route.ts isUuid 分支 / assistantMessageId）。
    // 走 safeRandomUUID：crypto.randomUUID 只在 secure context 存在,HTTP IP
    // 直访（无证书的临时入口 / 内网）会 undefined 整页崩。
    generateId: () => safeRandomUUID(),
    // 流式 UI 更新节流：不节流的话每个 SSE chunk 都触发一次全列表 React
    // 更新（一次回复上百 chunk）。80ms ≈ 12fps 的文字增量对「呼吸感浮现」
    // 的视觉签名毫无影响，CPU 却少掉一个数量级。
    experimental_throttle: 80,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: () => ({
        sessionId,
        model: modelIdRef.current,
        currencyType: currencyTypeRef.current,
      }),
    }),
    // AI SDK 即使流以 error 结束也会在 onError 后继续调用 onFinish。
    // 错误时必须把备份留给 onError 的异步 state 回滚；成功或主动停止
    // 才可以清掉（主动停止的半成品会由服务端正常落库）。
    onFinish: ({ isError }) => {
      if (!isError) regenerateBackupRef.current = null;
    },
    // 上游模型报错（如中转不支持所选模型）时，useChat 会把已创建的
    // 空 assistant 占位（parts: []）留在 state 里；之后每次发送都会
    // 携带这条空消息，服务端 validateUIMessages 校验失败 → 500 ——
    // 一次上游失败永久毒化整个会话。这里在 error 时清掉空占位。
    //
    // 同一时刻还要回滚 optimistic user 消息 —— 若服务端在
    // `tx.insert(messages)`（route.ts 里那条 user 落库）之前就 return
    // (model_unavailable / insufficient_currency / previous_turn_in_flight /
    // Session not found / Forbidden / Character missing / sessionId required)，
    // 这条 user 副本从未落库；留下会同时踩两个坑：
    //   1) 用户点删除 → deleteUserMessagePair 查不到行 → 弹「删除失败」
    //      (刷新页面消息又自己消失，一致性错乱，报障场景就是这个)。
    //   2) 下次 sendMessage 会把这条幻影当历史一起送上去。
    // 网络错误 / 已入库后失败（deductCurrency 之后的 5xx）不 match 任何
    // marker，走原路径保留 optimistic —— 那些场景 DB 里有行、能删。
    onError: (err) => {
      const errMsg = err?.message ?? "";
      const isPrePersistFailure =
        errMsg.includes("model_unavailable") ||
        errMsg.includes("insufficient_currency") ||
        errMsg.includes("previous_turn_in_flight") ||
        errMsg.includes("Session not found") ||
        errMsg.includes("Forbidden") ||
        errMsg.includes("Character missing") ||
        errMsg.includes("sessionId required");
      setTimeout(() => {
        setMessagesRef.current?.((prev) => {
          let next = prev.filter(
            (m) =>
              m.role !== "assistant" ||
              m.metadata?.stoppedByUser === true ||
              m.parts.some((p) => p.type === "text" && p.text.trim() !== ""),
          );
          if (
            isPrePersistFailure &&
            next.length > 0 &&
            next[next.length - 1].role === "user"
          ) {
            next = next.slice(0, -1);
          }
          const regenerateBackup = regenerateBackupRef.current;
          if (
            regenerateBackup &&
            !next.some((message) => message.id === regenerateBackup.id)
          ) {
            next = [...next, regenerateBackup];
          }
          regenerateBackupRef.current = null;
          return next;
        });
      }, 0);
    },
  });

  setMessagesRef.current = setMessages;

  const [input, setInputState] = useState("");
  const composerDraftRef = useRef<ComposerDraftSnapshot>({value:"",version:0});
  const [hostAdmissionTick,setHostAdmissionTick]=useState(0);
  const hostAdmissionRef = useRef<ReturnType<typeof createHostAdmissionTracker>|null>(null);
  if(!hostAdmissionRef.current)hostAdmissionRef.current=createHostAdmissionTracker(()=>setHostAdmissionTick(v=>v+1));
  useLayoutEffect(()=>{hostAdmissionRef.current?.observe(messages);},[messages,hostAdmissionTick]);
  useEffect(()=>()=>{hostAdmissionRef.current?.dispose();},[]);
  // Every existing composer writer retains its API while advancing a synchronous
  // revision. Functional updates run here once, never inside a React updater.
  const setInput = useCallback((next:React.SetStateAction<string>) => {
    const value = typeof next === "function" ? next(composerDraftRef.current.value) : next;
    composerDraftRef.current = {value,version:composerDraftRef.current.version+1};
    setInputState(value);
  }, []);
  const publicNoteHeader=useMemo(()=>derivePublicNoteHeader(openingComponents,character.creatorNote,character.id),[openingComponents,character.creatorNote,character.id]);
  const prefixSpec=useMemo(()=>uniqueComposerPrefix(openingComponents.filter(c=>c.enabled).map(c=>c.content)),[openingComponents]);
  const sourceControls=useMemo(()=>uniqueSourceControls(openingComponents.filter(c=>c.enabled).map(c=>c.content)),[openingComponents]);
  const prefixScope=`${sessionId}:${prefixSpec?.id??''}`;
  const prefixSelectionRef=useRef<{scope:string;value:ComposerPrefixSelection|null}|null>(null);
  const onPrefixChange=useCallback((value:ComposerPrefixSelection|null)=>{prefixSelectionRef.current={scope:prefixScope,value};},[prefixScope]);
  const haloSpec=useMemo(()=>{const found=openingComponents.filter(c=>c.enabled).flatMap(c=>extractNativeImageSidebars(c.content).sidebars).filter(s=>s.variant==='halo-toolkit');return found.length===1?found[0].haloToolkit:null;},[openingComponents]);
  const haloScope=`${sessionId}:${haloSpec?.id??''}`;
  const haloSelectionRef=useRef<{scope:string;value:HaloCommandState|null}|null>(null);
  const onHaloCommandChange=useCallback((value:HaloCommandState|null)=>{haloSelectionRef.current={scope:haloScope,value};},[haloScope]);
  const applyManualComposerFeatures=useCallback((text:string)=>applyScopedHaloCommands(applyScopedComposerPrefix(text,prefixSelectionRef.current,prefixScope),haloSelectionRef.current,haloScope),[prefixScope,haloScope]);
  const [continuingMessageId, setContinuingMessageId] = useState<string | null>(
    null,
  );
  const [isStopping, setIsStopping] = useState(false);
  const continueAbortRef = useRef<AbortController | null>(null);
  const [debugMode, setDebugMode] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [insufficientOpen, setInsufficientOpen] = useState(false);
  const [insufficientInfo, setInsufficientInfo] = useState<{
    currencyType: CurrencyType;
    required: number | null;
    balance: number | null;
  } | null>(null);

  const isInsufficientCurrency =
    status === "error" && error?.message?.includes("insufficient_currency");
  const isModelUnavailable =
    status === "error" && error?.message?.includes("model_unavailable");
  const isContentRestricted =
    status === "error" && error?.message?.includes("content_restricted");
  useEffect(() => {
    if (!isInsufficientCurrency) return;
    // 后端返回的 JSON 字符串里含 required/balance/currencyType；
    // useChat 把 body 塞进 error.message。尽力 parse，失败就退化为占位。
    let parsed: {
      currencyType?: "gold" | "silver";
      required?: number;
      balance?: number;
    } = {};
    try {
      const msg = error?.message ?? "";
      const start = msg.indexOf("{");
      const end = msg.lastIndexOf("}");
      if (start >= 0 && end > start) {
        parsed = JSON.parse(msg.slice(start, end + 1));
      }
    } catch {
      // 占位即可
    }
    setInsufficientInfo({
      currencyType: parsed.currencyType ?? currencyTypeRef.current,
      required: parsed.required ?? null,
      balance: parsed.balance ?? null,
    });
    setInsufficientOpen(true);
  }, [isInsufficientCurrency, error?.message]);
  const userPrefs = useMemo(() => {
    const m = new Map<string, boolean>();
    for (const [k, v] of Object.entries(initialUserPrefs)) m.set(k, v);
    return m;
  }, [initialUserPrefs]);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const shouldScrollAfterHistoryTrimRef = useRef(false);
  // composer autosize: rows=1 起步, 高度跟随内容, 封顶 ~6 行后内部滚动。
  // 长段角色扮演输入是这个产品的常态, 固定单行体验极差。发送后 input
  // 清空, 本 effect 随之把高度缩回单行。inline height 设在 textarea
  // (#nj_chat_input_textarea) 上, 创作者美化目标是外框 #nj_chat_input_box, 不冲突。
  const inputBoxRef = useRef<HTMLTextAreaElement | null>(null);
  const inputAutosizeRef = useRef<ReturnType<typeof createComposerTextareaAutosizer> | null>(null);
  // CSS replacement changes the input font/box metrics even without an edit.
  useLayoutEffect(() => {
    const element = inputBoxRef.current;
    if (!element) return;
    const autosizer = createComposerTextareaAutosizer(element);
    inputAutosizeRef.current = autosizer;
    return () => {
      if (inputAutosizeRef.current === autosizer) inputAutosizeRef.current = null;
      autosizer.dispose();
    };
  }, [openingGlobalCss]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: input is the controlled textarea content measurement trigger
  useLayoutEffect(() => {
    inputAutosizeRef.current?.measure();
  }, [input]);
  // 贴底跟随 —— 语义:
  //   1. 初始 & 主动动作(onSubmit / onRegenerate / onContinueAssistantMessage
  //      里手动置 true) → 贴底跟随打开
  //   2. 用户任何一次「非程序化」的滑动 → 立即关闭跟随,永久停在用户滑到的位置,
  //      直到下一次主动动作重新打开
  //
  // 判定「用户主动滚动」不能靠 scroll 事件 —— scroll 事件区分不出程序化和
  // 用户,之前用 programmaticScrollRef + rAF 屏蔽自触发的方案在流式期间
  // 不成立:AI chunk 每几毫秒触发一次 stickIfNeeded → 反复排 rAF,用户
  // 手指的 scroll 事件卡在 flag=true 的窗口里被吞掉,stickToBottomRef
  // 一直保持 true,AI 结束时贴底跟随把视口拉到最新底部 —— 表现就是
  // 「用户明明滑走了,结束时视口还是跳」。
  //
  // 改用只有用户才会触发的输入事件:
  //   - wheel      鼠标滚轮 / 触控板双指
  //   - touchmove  触屏拖拽
  //   - keydown    方向键 / PageUp/Down / Home/End / Space
  // 程序化 el.scrollTop = X 不会触发这三种事件,判定无歧义。
  // 加 scrollTop 减小的兜底:程序化只做贴底(scrollTop 增大),任何减小
  // 一定来自用户主动动作(桌面拖动滚动条向上是唯一漏网场景,这里兜住)。
  const stickToBottomRef = useRef(true);

  // 判定"当前是否仍在贴底范围内"—— 用于 wheel/touchmove/keydown/scroll-decrease
  // 事件里,detach 之前先看视口是否已经离底部超过阈值。让用户小范围调整不失
  // 去贴底跟随,只有真正"滚回去看历史"才 detach。阈值 STICKY_THRESHOLD_PX
  // 见文件顶部。
  const isNearBottom = (): boolean => {
    const el = scrollRef.current;
    if (!el) return false;
    return (
      el.scrollHeight - el.scrollTop - el.clientHeight <= STICKY_THRESHOLD_PX
    );
  };

  // === 上跳诊断日志(临时) ===
  // 定位 AI 结束时"跳到上一轮 AI 结尾"的元凶。前端复现后 devtools console
  // filter "[scroll-diag]" 就能看到完整 timeline:哪个探针点 scrollTop 减小 →
  // 就是它把视口拽走的。找到后本 commit 里的所有日志一并删掉。
  //
  // 开关:URL 加 `?scrollDiag=1` 或 localStorage.setItem('scrollDiag','1')
  // 默认关(不给普通用户刷 console)。
  const scrollDiagEnabledRef = useRef(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const on =
      url.searchParams.get("scrollDiag") === "1" ||
      window.localStorage.getItem("scrollDiag") === "1";
    scrollDiagEnabledRef.current = on;
    if (on) {
      console.log(
        "[scroll-diag] enabled. Watch scrollTop/scrollHeight timeline. Turn off via localStorage.removeItem('scrollDiag')",
      );
    }
  }, []);
  const traceScroll = useCallback(
    (tag: string, extra?: Record<string, unknown>) => {
      if (!scrollDiagEnabledRef.current) return;
      const el = scrollRef.current;
      if (!el) return;
      // Chrome/Firefox: 时间戳 + 关键数值一次性打印,方便复制成表格。
      console.log(`[scroll-diag ${Math.round(performance.now())}ms] ${tag}`, {
        statusRef: statusRef.current,
        scrollTop: el.scrollTop,
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
        sticky: stickToBottomRef.current,
        capturedH: capturedStreamHeightRef.current,
        capturedSt: capturedStreamScrollTopRef.current,
        ...extra,
      });
    },
    [],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: isNearBottom uses only refs + constant, stable across renders
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // 用户主动动作 → detach sticky, 但只有当视口已经离底部超过 STICKY_THRESHOLD_PX
    // 才算"真的想离开贴底"。视口仍在底部附近(轻微滚轮误触、trackpad 惯性尾)时
    // 忽略 —— 用户明明还在看最新消息, sticky detach 会让 stream 后半段视口停在
    // 中途、结束时 apply-uLE 恢复到那个中途位置 → 视觉上"跳到上一轮 AI 结尾"。
    const tryDetach = (evt: string, extra?: Record<string, unknown>) => {
      if (isNearBottom()) {
        traceScroll(`detach:${evt}:ignored-near-bottom`, extra);
        return;
      }
      const wasSticky = stickToBottomRef.current;
      stickToBottomRef.current = false;
      traceScroll(`detach:${evt}`, { wasSticky, ...extra });
    };
    const onWheel = () => tryDetach("wheel");
    const onTouchMove = () => tryDetach("touchmove");
    const onKey = (e: KeyboardEvent) => {
      const k = e.key;
      if (
        k === "ArrowUp" ||
        k === "ArrowDown" ||
        k === "PageUp" ||
        k === "PageDown" ||
        k === "Home" ||
        k === "End" ||
        k === " "
      ) {
        tryDetach("key", { key: k });
      }
    };
    let lastTop = el.scrollTop;
    let lastHeight = el.scrollHeight;
    const onScroll = () => {
      const newTop = el.scrollTop;
      const newHeight = el.scrollHeight;
      const topDelta = newTop - lastTop;
      const heightDelta = newHeight - lastHeight;
      // 每次 scroll 事件都打,能看到"跳"到底是浏览器 clamp、程序化贴底
      // 还是用户滑动引起的。delta < 0 = scrollTop 减小(向上跳)。
      traceScroll("scroll", { newTop, lastTop, topDelta, heightDelta });
      // 浏览器 layout clamp:stream 中一次 render 让 scrollHeight 缩水,
      // 浏览器自动把 scrollTop 也 clamp 到新 max,触发 scroll event 报告
      // scrollTop 减小。这个减小**不是用户主动滑动**,不能 detach sticky。
      // 判定标准:scrollTop 减小量 ≈ scrollHeight 减小量(clamp 是 1:1),
      // 允许 2px 浮点误差。如果只 scrollTop 减小 scrollHeight 不减,那才是
      // 用户拖滚动条向上(桌面唯一 detach 漏网场景,这里兜住)。
      const isBrowserClamp =
        topDelta < 0 && heightDelta < 0 && Math.abs(topDelta - heightDelta) < 2;
      if (topDelta < 0 && !isBrowserClamp) {
        tryDetach("scroll-decrease", { topDelta, heightDelta });
      } else if (isBrowserClamp) {
        traceScroll("scroll:clamp-ignored", { topDelta, heightDelta });
      }
      lastTop = newTop;
      lastHeight = newHeight;
    };
    el.addEventListener("wheel", onWheel, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    el.addEventListener("keydown", onKey);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("keydown", onKey);
      el.removeEventListener("scroll", onScroll);
    };
  }, [
    // 每次 scroll 事件都打,能看到"跳"到底是浏览器 clamp、程序化贴底
    // 还是用户滑动引起的。delta < 0 = scrollTop 减小(向上跳)。
    traceScroll,
  ]);

  // 贴底自动跟随: 只在 status=submitted / streaming 期间生效。
  //
  // 硬保证 「AI 结束不再自动划动视口」: status → ready/error 后 ResizeObserver
  // 里 stickIfNeeded 一律 return, 不管 stickToBottomRef 是什么值。
  // 结束瞬间可能仍要贴一次底(让底部 ◇◇◇ + 菜单 + DebugPanel 完整可见), 由
  // 下面 status 变化的 effect 做一次性 rAF 补贴。此后哪怕 DebugPanel 迟到
  // 挂载、iframe postMessage 上报高度、图片加载完成, 视口都保持不动。
  //
  // 用 statusRef 避开把 status 加进依赖数组导致的 ResizeObserver 反复解绑。
  const statusRef = useRef(status);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    const el = scrollRef.current;
    const content = el?.firstElementChild;
    if (!el || !content) return;
    const stickIfNeeded = (entries: ResizeObserverEntry[]) => {
      const preSt = el.scrollTop;
      const preSh = el.scrollHeight;
      if (!stickToBottomRef.current) {
        traceScroll("RO:skip-not-sticky", { preSt, preSh });
        return;
      }
      // AI 结束后一律不再自动动视口 —— 用户「滑到哪就停在哪」是硬保证
      if (statusRef.current === "ready" || statusRef.current === "error") {
        traceScroll("RO:skip-ready", { preSt, preSh });
        return;
      }
      el.scrollTop = el.scrollHeight;
      traceScroll("RO:stick-to-bottom", {
        preSt,
        preSh,
        postSt: el.scrollTop,
        entriesCount: entries.length,
      });
    };
    const ro = new ResizeObserver(stickIfNeeded);
    ro.observe(content);
    return () => ro.disconnect();
  }, [traceScroll]);

  // AI 结束的一次性收尾: 把 stickToBottomRef 置 false, 让后续 ResizeObserver
  // 触发的 stickIfNeeded 一律 return, 保证任何 layout reflow 都动不了视口。
  useEffect(() => {
    traceScroll("status-effect", { newStatus: status });
    if (status !== "ready" && status !== "error") return;
    stickToBottomRef.current = false;
    traceScroll("status-effect:cleared-sticky", { newStatus: status });
  }, [status, traceScroll]);

  // ============================================================
  // 「AI 结束页面绝对静止」硬保证
  // ============================================================
  //
  // 现象: 用户在长对话里翻旧消息看时, 每一轮 AI 生成结束的瞬间视口都会向
  // 上跳一段, 恰好停在"上一轮 AI 回复的结尾处"。
  //
  // 根因: MessageBubble 在流式期间用 (safe + tail) 双段渲染, 结束时切成
  // "对完整 text 应用 regex"—— 角色卡里带折叠效果的 regex(如 `<状态>...`
  // → `<details>...</details>`, 默认收起)让消息 rendered 高度骤降。scrollHeight
  // 变小 → 浏览器 layout 阶段 auto-clamp scrollTop 到新的 (scrollHeight -
  // clientHeight) → 视口相对内容向上跳。dae9c40 关掉主动 rAF 贴底能防"结束
  // 主动划走", 但防不住浏览器 layout 里的 clamp。
  //
  // 修法: 在 status 变 ready 那一次 useLayoutEffect(commit 后 paint 前同步)
  // 里做两件事:
  //   1. 给 messages 内层容器加 min-height = stream 最后一帧的 scrollHeight
  //      → 内容折叠也撑不下去, scrollHeight 保持不变, clamp 无处可 clamp。
  //   2. 恢复 scrollTop 到 stream 最后一帧的值 → 万一浏览器已经 clamp 了,
  //      同一次 layout 里再修回来, paint 时用户看不到中间态。
  //
  // 下一轮开始(status → submitted)时释放 min-height, 让消息列表按自然内容
  // 高度重新计算 —— 否则老会话越点越多 padding。
  //
  // 单元测覆盖不到(强 DOM 依赖), 用两个 ref 追踪 stream 期间的最后一帧,
  // useLayoutEffect 保证同步 fire 拿到 stream 侧的旧值。
  const capturedStreamHeightRef = useRef(0);
  const capturedStreamScrollTopRef = useRef(0);
  const prevStatusRef = useRef(status);

  // 无依赖 useLayoutEffect: 每次 commit 后同步记录当前 scrollHeight/scrollTop,
  // 仅在 streaming/submitted 期间生效。commit 顺序保证 ready 那一轮里第一次
  // fire 时 status 已经切了 → 这里直接 return, ref 保留上一帧(stream 中最后
  // 一次 render)的值给下面的 apply effect 用。
  //
  // 关键: 贴底跟随时 scrollTop **不能**直接读 el.scrollTop —— 上面 ResizeObserver
  // 里的 stickIfNeeded 是 async 的(layout 后的 microtask), 而 useLayoutEffect
  // 在浏览器 layout 之后、ResizeObserver 之前 sync fire, 所以 el.scrollTop 是
  // 上一帧贴底的旧值(小于新 scrollHeight - clientHeight)。恢复到这个旧值 =
  // 视觉上跳 (新 scrollHeight - 旧 scrollTop) - clientHeight 那么多像素, 恰好
  // 是"跳到上一轮 AI 结尾附近"的现象来源。直接算"本次 layout 后应该贴底的
  // 值"= scrollHeight - clientHeight, 保存这个。
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (status === "streaming" || status === "submitted") {
      const sh = el.scrollHeight;
      const beforeH = capturedStreamHeightRef.current;
      const beforeSt = capturedStreamScrollTopRef.current;
      capturedStreamHeightRef.current = sh;
      capturedStreamScrollTopRef.current = stickToBottomRef.current
        ? Math.max(0, sh - el.clientHeight)
        : el.scrollTop;
      traceScroll("capture-uLE", {
        beforeH,
        beforeSt,
        newH: capturedStreamHeightRef.current,
        newSt: capturedStreamScrollTopRef.current,
      });
    }
  });

  useLayoutEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = status;
    // 只在 stream → ready/error 那一次动手(避免页面首次加载 status=ready 时误锁)
    const wasStreaming = prev === "streaming" || prev === "submitted";
    traceScroll("apply-uLE:enter", {
      prev,
      newStatus: status,
      wasStreaming,
    });
    if (!wasStreaming) {
      traceScroll("apply-uLE:skip-not-streaming");
      return;
    }
    if (status !== "ready" && status !== "error") {
      traceScroll("apply-uLE:skip-not-idle");
      return;
    }
    const el = scrollRef.current;
    const inner = el?.firstElementChild as HTMLElement | null;
    if (!el || !inner) return;
    const h = capturedStreamHeightRef.current;
    if (h <= 0) {
      traceScroll("apply-uLE:skip-no-captured");
      return;
    }
    const preSt = el.scrollTop;
    const preSh = el.scrollHeight;
    inner.style.minHeight = `${h}px`;

    // scrollHeight 突增补偿 (方案 B):
    // AI 结束瞬间从 stream 分支切到 final 分支,MessageBubble 里 tail(raw
    // text) → 完整 regex 组件、◇◇◇/Menu/DebugPanel 挂载,scrollHeight 会突
    // 增几百到上千 px。视口 scrollTop 保持不变 = 视口内容重排(用户看到"最
    // 新 AI 消息底部被顶上去、露出上一轮 AI 结尾")。补偿:如果用户离底部
    // 较近(vs 已经翻到很远的历史),把 scrollTop 也 += (postSh - h),保持视
    // 口相对内容底部的距离,视口内看到的元素排列稳定。
    // 已经滑到很远看历史时(distance > STICKY_THRESHOLD_PX * 4)不补偿,让
    // 用户能安静看历史,不被"跳走"打断。
    const targetSt = capturedStreamScrollTopRef.current;
    const postSh = el.scrollHeight;
    const distanceFromBottom = h - targetSt - el.clientHeight;
    const shGrew = postSh - h;
    const shouldCompensate =
      shGrew > 0 && distanceFromBottom <= STICKY_THRESHOLD_PX * 4;
    const finalSt = shouldCompensate ? targetSt + shGrew : targetSt;
    el.scrollTop = finalSt;

    traceScroll("apply-uLE:done", {
      preSt,
      preSh,
      postSt: el.scrollTop,
      postSh,
      minHeight: inner.style.minHeight,
      targetSt,
      shGrew,
      distanceFromBottom,
      compensated: shouldCompensate,
      finalSt,
    });

    // 延迟资源补偿窗口 (1s):
    // apply-uLE 里 shGrew 只覆盖"结束瞬间同步 render 的新元素"(◇◇◇/Menu/
    // final regex 组件)。之后 100-500ms 内还有:
    //   - DebugPanel React lazy 挂载
    //   - iframe artifact 内 srcdoc 加载完通过 postMessage 上报高度
    //   - <img> 元素加载完自然撑高
    // 这些"迟到增量"如果不补偿,视口相对内容底部距离渐渐变小,视觉上"页面
    // 稍微往下移一点点"— 用户报告的残留现象。
    // 只在补偿分支启动 watcher(用户离底部近才关心视口稳定),1s 后自动断开
    // (延迟资源基本全部到位)。sh 增就同步增 scrollTop,sh 减不动(避免程序化
    // 事件误伤)。用户主动滑动会触发 detach → sticky=false 之后 watcher 仍
    // 补偿,是良性行为(用户主动动作时视口和内容一起滚,不会看到"内容跳")。
    if (!shouldCompensate) return;
    let lastSh = postSh;
    const compensator = new ResizeObserver(() => {
      const nowSh = el.scrollHeight;
      const delta = nowSh - lastSh;
      if (delta > 0) {
        el.scrollTop += delta;
        traceScroll("apply-uLE:late-compensate", { delta, nowSh });
      }
      lastSh = nowSh;
    });
    compensator.observe(inner);
    setTimeout(() => {
      compensator.disconnect();
      traceScroll("apply-uLE:compensator-done");
    }, 1000);
  }, [status, traceScroll]);

  // 下一轮开始: 清 min-height 让内容自然计算(否则会话越滑越多空白 padding)。
  // 同时把 sticky 重置回 true —— dae9c40 结束时会把它设为 false,但没有任何
  // 地方重置回 true,导致第 2 轮起 stream 全程 sticky=false。sticky=false 时
  // capture uLE 保存 `el.scrollTop`(用户当前位置 = 上一轮结束位置),apply-uLE
  // 就把视口"恢复"到那个老值 → 用户看到"跳回到上一轮 AI 回复的视窗位置"。
  // 修法:新一轮 submit 时重置 sticky=true,让 stream 全程贴底跟随,capture
  // 保存的是当前贴底位置。
  useLayoutEffect(() => {
    if (status !== "submitted") return;
    const inner = scrollRef.current?.firstElementChild as HTMLElement | null;
    if (!inner) return;
    inner.style.minHeight = "";
    capturedStreamHeightRef.current = 0;
    capturedStreamScrollTopRef.current = 0;
    stickToBottomRef.current = true;
    traceScroll("clear-min-height");
  }, [status, traceScroll]);

  // 初始滚动到底部 —— 页面首次加载时,如果有历史消息,自动定位到最新消息。
  // 用 ref 标记是否已执行过初始滚动,确保只在首次挂载时运行一次(不受后续
  // messages 变化影响)。useLayoutEffect 保证在浏览器 paint 前同步执行,避免
  // 用户看到"先显示顶部再跳到底部"的闪烁。
  const initialScrollDoneRef = useRef(false);
  useLayoutEffect(() => {
    if (initialScrollDoneRef.current) return;
    const el = scrollRef.current;
    if (!el) return;
    // 只有当有消息时才滚动(空会话不需要滚动)
    if (initialMessages.length === 0) {
      initialScrollDoneRef.current = true;
      return;
    }
    // 滚动到底部
    el.scrollTop = el.scrollHeight;
    initialScrollDoneRef.current = true;
    traceScroll("initial-scroll-to-bottom", {
      messageCount: initialMessages.length,
    });
  }, [initialMessages.length, traceScroll]);

  // 删除 / 回溯消息后滚动到底部 —— 因为此时 status === "ready"，
  // ResizeObserver 不会触发滚动，所以需要专门的 effect 处理。
  // biome-ignore lint/correctness/useExhaustiveDependencies: message count change is the post-trim commit signal
  useLayoutEffect(() => {
    if (!shouldScrollAfterHistoryTrimRef.current) return;
    const el = scrollRef.current;
    if (el) {
      // The stream -> ready transition may have frozen the inner wrapper at the
      // pre-render height to prevent a completion-time viewport jump.  A delete
      // is a new, intentional layout change: keeping that minimum height turns
      // the removed message into an equally large blank area, so release it
      // before measuring and scrolling to the new bottom.
      const inner = el.firstElementChild as HTMLElement | null;
      if (inner) inner.style.minHeight = "";
      capturedStreamHeightRef.current = 0;
      capturedStreamScrollTopRef.current = 0;
      el.scrollTop = el.scrollHeight;
      traceScroll("history-trim-scroll-to-bottom", {
        scrollHeight: el.scrollHeight,
      });
    }
    shouldScrollAfterHistoryTrimRef.current = false;
  }, [messages.length, traceScroll]);

  // 历史裁剪必须先同步释放 stream 结束时用于防跳的 min-height。只依赖下一次
  // layout effect 清理会留下一个竞态：DOM 消息先被移除，冻结高度仍撑着，于是
  // 用户看到“内容没了、原位置留白”。回溯与两种删除入口统一走这里。
  const prepareForHistoryTrim = useCallback(() => {
    const el = scrollRef.current;
    const inner = el?.firstElementChild as HTMLElement | null;
    if (inner) inner.style.minHeight = "";
    capturedStreamHeightRef.current = 0;
    capturedStreamScrollTopRef.current = 0;
    shouldScrollAfterHistoryTrimRef.current = true;
    traceScroll("history-trim:release-min-height");
  }, [traceScroll]);

  const lastAssistantIdx = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") return i;
    }
    return -1;
  })();
  const chatSubmitting = status === "submitted" || status === "streaming";
  const isContinuing = continuingMessageId !== null;
  const submitting = chatSubmitting || isContinuing || isStopping;
  const canStopGeneration =
    !isStopping && (status === "streaming" || isContinuing);
  const canRegenerate =
    lastAssistantIdx === messages.length - 1 &&
    messages[lastAssistantIdx - 1]?.role === "user" &&
    !submitting &&
    !retryLimitReached;

  // 监听最新 assistant 消息的 metadata.safetyBlocked，维护连续 safety 拦截计数
  // + runtimeSafetyIds。processedRef 防止同一条消息 metadata 到达时重复计数
  // （React strict mode 双跑、状态其他字段变更导致的 effect 复跑）。
  const lastProcessedAssistantIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (lastAssistantIdx < 0) return;
    const last = messages[lastAssistantIdx];
    if (!last || last.role !== "assistant") return;
    // 没收到 metadata 之前不判定 —— 流式期间 metadata 是 undefined，等 finish 才有
    const meta = last.metadata;
    if (meta === undefined) return;
    if (lastProcessedAssistantIdRef.current === last.id) return;
    lastProcessedAssistantIdRef.current = last.id;
    if (meta.safetyBlocked) {
      setRuntimeSafetyIds((prev) => {
        if (prev.has(last.id)) return prev;
        const next = new Set(prev);
        next.add(last.id);
        return next;
      });
      setSafetyRetryCount((n) => n + 1);
    } else {
      // 成功回复：清空重试计数
      setSafetyRetryCount(0);
    }
  }, [messages, lastAssistantIdx]);

  // 同步发送锁。submitting 来自 useChat 的 status,React state,两次连点之间
  // 还没 re-render 时 closure 拿到的还是旧值 false —— 所有 send 入口都会
  // 漏过,造成 user-user 连发 + 多条 assistant 的孤儿数据。ref 同步置位,
  // status 切回 ready/error 再清回。所有 send 路径都先 tryClaimSend()。
  const sendingRef = useRef(false);
  useEffect(() => {
    if (status === "ready" || status === "error") {
      sendingRef.current = false;
    }
  }, [status]);

  // messages / submitting 的 ref 镜像 —— 下方所有消息操作 handler 都传给
  // memo 化的 ChatMessagesList，闭包里直接引用 messages 会让 handler 每个
  // 流式 chunk 换一次引用，把整条 memo 链击穿。handler 通过 ref 读最新值，
  // 自身引用保持稳定。
  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  const submittingRef = useRef(false);
  useEffect(() => {
    submittingRef.current = submitting;
  }, [submitting]);

  const tryClaimSend = useCallback((): boolean => {
    if (sendingRef.current || submittingRef.current) return false;
    sendingRef.current = true;
    return true;
  }, []);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || !tryClaimSend()) return;
    // 用户主动发新消息 —— 不管之前滑到哪,这次必须跳回底部看自己消息和回复。
    stickToBottomRef.current = true;
    // 新消息 = 用户改写了 input, safety 重试计数清零（不管上一轮是否 blocked）
    setSafetyRetryCount(0);
    regenerateBackupRef.current = null;
    sendMessage({ text:applyManualComposerFeatures(text) });
    setInput("");
  }

  // Include text, not only message IDs: edits and continuation keep their ID.
  const suggestionContextKey = JSON.stringify([
    activeMaskId,
    effectiveUserName,
    messages.slice(-12).map((message) => [message.id, message.parts]),
  ]);

  function sendSuggestedReply(text: string): boolean {
    if (!tryClaimSend()) return false;
    stickToBottomRef.current = true;
    setSafetyRetryCount(0);
    regenerateBackupRef.current = null;
    void sendMessage({ text:applyManualComposerFeatures(text) });
    // A typed draft is not silently discarded by a suggestion card.
    return true;
  }

  async function editSuggestedReply(text: string, isCurrent: () => boolean): Promise<boolean> {
    if (input.trim() && !(await confirm({
      body: dict.chat.replySuggestions.replaceDraft,
      confirmLabel: dict.dialog.confirm,
      cancelLabel: dict.dialog.cancel,
    }))) return false;
    if (submittingRef.current || !isCurrent()) return false;
    setInput(text);
    inputBoxRef.current?.focus();
    return true;
  }

  async function onRegenerate() {
    if (!canRegenerate) return;
    const messageId = messages[lastAssistantIdx]?.id;
    if (!messageId) return;
    const confirmed = await confirm({
      body: dict.chat.regenerateConfirm,
      confirmLabel: dict.dialog.confirm,
      cancelLabel: dict.dialog.cancel,
    });
    if (!confirmed) return;
    if (!tryClaimSend()) return;
    stickToBottomRef.current = true;
    regenerateBackupRef.current = messages[lastAssistantIdx];
    void regenerate({ messageId });
  }

  // 续写末条 assistant —— 不走 useChat / sendMessage,直接 fetch
  // /api/chat/continue 拿 raw text stream。chunk 累积后按 rAF 节流刷进
  // setMessages —— 逐 chunk setState 会让整个消息列每秒重渲染几十次。
  //
  // 跟 sendMessage 的根本区别：sendMessage 会插一条 user 消息再触发新一轮回复;
  // 续写是「同一条 AI 接着说」,不新建 message row,服务端 onFinish 把新文本
  // append 到原 row 的 content。
  //
  // useChat status 在续写期间不会变,所以无法用它的 effect 自动清 sendingRef,
  // 必须 finally 手动 reset。
  const onContinueAssistantMessage = useCallback(
    async (messageId: string) => {
      if (!tryClaimSend()) return;
      stickToBottomRef.current = true;
      const original = messagesRef.current.find((m) => m.id === messageId);
      if (!original) {
        sendingRef.current = false;
        return;
      }
      const abortController = new AbortController();
      continueAbortRef.current = abortController;
      setContinuingMessageId(messageId);
      const prefix = original.parts
        .filter((p) => p.type === "text")
        .map((p) => p.text)
        .join("");

      let acc = "";
      let rafId: number | null = null;
      const flush = () => {
        rafId = null;
        const nextText = prefix + acc;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? { ...m, parts: [{ type: "text" as const, text: nextText }] }
              : m,
          ),
        );
      };

      try {
        const res = await fetch("/api/chat/continue", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: abortController.signal,
          body: JSON.stringify({
            sessionId,
            model: modelIdRef.current,
            currencyType: currencyTypeRef.current,
          }),
        });
        if (!res.ok || !res.body) {
          // 401 / 402 / 429 等不展开,这里只让用户感知到「没续上」。常见错误
          // (quota / currency)用户会在下一次 sendMessage 时通过原弹窗看到。
          window.alert(dict.chat.msgActionsContinueFailed);
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          acc += decoder.decode(value, { stream: true });
          if (rafId === null) rafId = requestAnimationFrame(flush);
        }
        // 收尾强制 flush 一次,保证末尾不足一帧的字符也上屏。
        if (rafId !== null) cancelAnimationFrame(rafId);
        if (isExplicitModelRefusal(acc)) {
          setMessages((prev) =>
            prev.map((m) => (m.id === messageId ? original : m)),
          );
          window.alert(dict.chat.msgActionsContinueFailed);
          return;
        }
        flush();
      } catch {
        if (rafId !== null) cancelAnimationFrame(rafId);
        // 用户主动停止时保留已经刷出的半段，不弹“续写失败”。真正的网络 /
        // provider 异常仍沿用原错误提示。
        if (abortController.signal.aborted) {
          if (acc) flush();
        } else {
          window.alert(dict.chat.msgActionsContinueFailed);
        }
      } finally {
        if (continueAbortRef.current === abortController) {
          continueAbortRef.current = null;
        }
        setContinuingMessageId(null);
        sendingRef.current = false;
      }
    },
    [tryClaimSend, sessionId, setMessages, dict.chat.msgActionsContinueFailed],
  );

  const onStopGeneration = useCallback(async () => {
    if (continuingMessageId) {
      continueAbortRef.current?.abort();
      return;
    }
    if (status !== "streaming") return;

    setIsStopping(true);
    try {
      await stop();
      // stop() intentionally keeps generated tokens. Mark that draft locally so
      // the next request replaces it with a neutral history placeholder instead
      // of teaching the model to repeat prose the player explicitly rejected.
      setMessages((prev) => {
        for (let i = prev.length - 1; i >= 0; i--) {
          const message = prev[i];
          if (message.role !== "assistant") continue;
          const next = [...prev];
          next[i] = {
            ...message,
            metadata: {
              ...(message.metadata ?? createPublicChatMeta()),
              stoppedByUser: true,
            },
          };
          return next;
        }
        return prev;
      });
    } finally {
      // The client abort is immediate; the server needs one short turn to
      // persist the partial assistant row. Keep send locked across that window
      // so a new user turn cannot race the abort settlement in the database.
      await new Promise((resolve) => setTimeout(resolve, 450));
      setIsStopping(false);
    }
  }, [continuingMessageId, status, stop, setMessages]);

  // 「回到此处重说」—— 从某个用户消息节点 fork(软归档)。keepCount = 该用户
  // 消息在 messages 数组里的下标:保留 [0, keepCount),把之后的全部归档。
  // 客户端 setMessages 与服务端按序数对齐(都按 created_at asc 取活跃消息),
  // 无需整页刷新。详见 forkSessionAtMessage / forkAtMessageAction。
  const onForkToMessage = useCallback(
    async (keepCount: number) => {
      if (submittingRef.current) return;
      const removeCount = messagesRef.current.length - keepCount;
      if (removeCount <= 0) return;
      const confirmed = window.confirm(
        dict.chat.forkConfirmFmt.replace("{count}", String(removeCount)),
      );
      if (!confirmed) return;
      const res = await forkAtMessageAction(sessionId, character.id, keepCount);
      if (res.ok) {
        prepareForHistoryTrim();
        setMessages((prev) => prev.slice(0, keepCount));
        setReviewOpen(false);
      } else {
        window.alert(dict.chat.forkFailed);
      }
    },
    [
      sessionId,
      character.id,
      setMessages,
      prepareForHistoryTrim,
      dict.chat.forkConfirmFmt,
      dict.chat.forkFailed,
    ],
  );

  const onDeleteMessage = useCallback(
    async (assistantMsgId: string) => {
      if (submittingRef.current) return;
      const res = await deleteMessagePairAction(
        sessionId,
        character.id,
        assistantMsgId,
      );
      if (res.ok) {
        prepareForHistoryTrim();
        setMessages((prev) => {
          const aiIdx = prev.findIndex((m) => m.id === assistantMsgId);
          if (aiIdx < 0) return prev;
          const userIdx =
            aiIdx > 0 && prev[aiIdx - 1].role === "user" ? aiIdx - 1 : -1;
          return prev.filter(
            (_, i) => i !== aiIdx && (userIdx < 0 || i !== userIdx),
          );
        });
        success(dict.chat.deleteSuccess);
      } else {
        window.alert(dict.chat.msgActionsDeleteFailed);
      }
    },
    [
      sessionId,
      character.id,
      setMessages,
      prepareForHistoryTrim,
      dict.chat.msgActionsDeleteFailed,
      dict.chat.deleteSuccess,
      success,
    ],
  );

  const onEditUserMessage = useCallback(
    async (userMsgId: string, newContent: string) => {
      if (submittingRef.current) return;
      const res = await updateUserMessageAction(
        sessionId,
        character.id,
        userMsgId,
        newContent,
      );
      if (res.ok) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === userMsgId
              ? { ...m, parts: [{ type: "text" as const, text: newContent }] }
              : m,
          ),
        );
        success(dict.chat.editSuccess);
      } else {
        window.alert(dict.chat.userMsgActionsEditFailed);
      }
    },
    [
      sessionId,
      character.id,
      setMessages,
      dict.chat.userMsgActionsEditFailed,
      dict.chat.editSuccess,
      success,
    ],
  );

  const onDeleteUserMessage = useCallback(
    async (userMsgId: string) => {
      if (submittingRef.current) return;
      const res = await deleteUserMessagePairAction(
        sessionId,
        character.id,
        userMsgId,
      );
      if (res.ok) {
        prepareForHistoryTrim();
        setMessages((prev) => {
          const userIdx = prev.findIndex((m) => m.id === userMsgId);
          if (userIdx < 0) return prev;
          const aiIdx =
            userIdx < prev.length - 1 && prev[userIdx + 1].role === "assistant"
              ? userIdx + 1
              : -1;
          return prev.filter(
            (_, i) => i !== userIdx && (aiIdx < 0 || i !== aiIdx),
          );
        });
        success(dict.chat.deleteSuccess);
      } else {
        window.alert(dict.chat.userMsgActionsDeleteFailed);
      }
    },
    [
      sessionId,
      character.id,
      setMessages,
      prepareForHistoryTrim,
      dict.chat.userMsgActionsDeleteFailed,
      dict.chat.deleteSuccess,
      success,
    ],
  );

  const onEditAssistantMessage = useCallback(
    async (assistantMsgId: string, newContent: string) => {
      if (submittingRef.current) return;
      const res = await updateAssistantMessageAction(
        sessionId,
        character.id,
        assistantMsgId,
        newContent,
      );
      if (res.ok) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? { ...m, parts: [{ type: "text" as const, text: newContent }] }
              : m,
          ),
        );
        success(dict.chat.editSuccess);
      } else {
        window.alert(dict.chat.msgActionsEditFailed);
      }
    },
    [
      sessionId,
      character.id,
      setMessages,
      dict.chat.msgActionsEditFailed,
      dict.chat.editSuccess,
      success,
    ],
  );

  // 回顾抽屉数据 —— 每条用户消息 = 一个 fork 节点(index = 它在 messages 里的
  // 下标 = forkAtMessageAction 的 keepCount)。replyPreview 取其后那条 assistant
  // 的纯文本(剥语义标签)截断,不渲染富 HTML。
  const reviewNodes = useMemo<ReviewNode[]>(() => {
    const textOf = (m: ChatUIMessage) =>
      m.parts
        .filter((p) => p.type === "text")
        .map((p) => p.text)
        .join("");
    const nodes: ReviewNode[] = [];
    for (let i = 0; i < messages.length; i++) {
      const m = messages[i];
      if (m.role !== "user") continue;
      const next = messages[i + 1];
      const replyRaw = next && next.role === "assistant" ? textOf(next) : null;
      const replyPreview = replyRaw
        ? replyRaw
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 120) || null
        : null;
      nodes.push({ index: i, userText: textOf(m), replyPreview });
    }
    return nodes;
  }, [messages]);

  // "保存并新建" 在空对话上是 no-op,Menu 据此弹 alert 提示而非真执行。
  const hasUserMessages = useMemo(
    () => messages.some((m) => m.role === "user"),
    [messages],
  );

  // History snapshot fed into the iframe host API. Plain {role, content} —
  // strips parts so creator code can't read tool-call / streaming metadata.
  // 走 ref + ChatHistoryContext（拉模式,getHistory RPC 调用瞬间才读）而不是
  // props 下发 —— 数组引用每个流式 chunk 都会变,灌 props 会击穿整条 memo 链。
  const historyRef = useRef<HostHistoryEntry[]>([]);
  useEffect(() => {
    historyRef.current = messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.parts
        .filter((p) => p.type === "text")
        .map((p) => p.text)
        .join(""),
    }));
  }, [messages]);

  const characterMeta = useMemo(
    () => ({
      id: character.id,
      name: character.name,
      avatarUrl: character.avatarUrl,
      tags: character.tags,
      bio: character.bio,
    }),
    [
      character.id,
      character.name,
      character.avatarUrl,
      character.tags,
      character.bio,
    ],
  );

  const onHostSendMessage = useMemo(
    () => Object.assign((text: string, options?:HostSendOptions) => {
      if (options) return admitHostComposerSendAsync(text, options, {
        readDraft:()=>composerDraftRef.current,
        tryClaimSend,
        releaseFailedClaim:()=>{sendingRef.current=false;},
        enqueue:(submitted)=>{
          stickToBottomRef.current=true;
          setSafetyRetryCount(0);
          regenerateBackupRef.current=null;
          const id = safeRandomUUID();
          return hostAdmissionRef.current!.admit(id,()=>sendMessage({
            id,role:"user",parts:[{type:"text",text:applyManualComposerFeatures(submitted)}],
          }));
        },
        clearDraftIfCurrent:(snapshot)=>{
          const current=composerDraftRef.current;
          if(current.version===snapshot.version&&current.value===snapshot.value)setInput("");
        },
      });
      // iframe Host API / OpeningSlot 通路：流式还没结束就触发会产生孤儿 AI
      // 回复（同一轮 user 两条 assistant）。tryClaimSend 同步置 ref,堵 React
      // state stale 的窗口。
      if (!tryClaimSend()) return;
      stickToBottomRef.current = true;
      sendMessage({ text:applyManualComposerFeatures(text) });
    }, {supportsAppendAndSend:true as const}),
    [tryClaimSend, sendMessage, applyManualComposerFeatures, setInput],
  );

  // censy 侧栏点表情/指令 → 填进输入框（不发送，对齐外部组件预期）。已有内容后接一段，
  // 中间补换行避免粘连。
  const onHostFillComposer = useCallback((text: string, options?:ComposerFillOptions) => {
    if (!text) return;
    setInput((prev) => appendComposerDraft(prev,text,options));
  }, []);

  const stageBg = character.coverImageUrl ?? character.avatarUrl ?? null;

  const headerNode = (
    <>
      <button
        id="nj_back_button"
        type="button"
        onClick={handleBack}
        aria-label={dict.chat.backButtonAria}
        className="rounded-[var(--radius-sm)] border border-border-subtle px-[var(--space-sm)] py-[var(--space-xs)] text-xs text-text-muted transition-colors hover:border-border-strong hover:text-text-primary"
      >
        ←
      </button>
      <button
        id="nj_header_follow_btn"
        type="button"
        aria-label={dict.chat.headerFollowAria}
        aria-hidden="true"
        tabIndex={-1}
        className="nj_header_follow_btn hidden"
      />
      <button
        id="nj_header_message_btn"
        type="button"
        aria-label={dict.chat.headerMessageAria}
        aria-hidden="true"
        tabIndex={-1}
        className="nj_header_message_btn hidden"
      />
      <button
        id="nj_mobile_drawer_btn"
        type="button"
        onClick={() => setDrawerOpen(true)}
        aria-label={dict.chat.sidebarTitle}
        className="relative z-[110] flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border border-border-subtle text-text-muted transition-colors hover:border-border-strong hover:text-text-primary md:hidden"
      >
        <ListIcon width={18} height={18} strokeWidth={1.5} aria-hidden="true" />
      </button>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-solid md:h-10 md:w-10">
        {character.avatarUrl ? (
          // biome-ignore lint/performance/noImgElement: external URLs, no remote-host pattern set yet
          <img
            src={character.avatarUrl}
            alt={character.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="font-display-zh text-base text-text-muted md:text-lg">
            {firstChar(character.name)}
          </span>
        )}
      </span>
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <h1 className="truncate font-display-zh text-base text-text-primary md:text-lg">
          {character.name}
        </h1>
      </div>
      {canDebug && (
        <button
          id="nj_header_clarity_btn"
          type="button"
          onClick={() => setDebugMode((v) => !v)}
          aria-pressed={debugMode}
          className={`rounded-[var(--radius-sm)] border px-[var(--space-md)] py-[var(--space-xs)] text-xs uppercase tracking-[0.2em] transition-colors ${
            debugMode
              ? "border-accent-primary bg-accent-primary/10 text-accent-primary"
              : "border-border-subtle text-text-muted hover:text-text-primary"
          }`}
        >
          {dict.chat.debugToggle}
        </button>
      )}
      <button
        id="nj_review_btn"
        type="button"
        onClick={() => setReviewOpen(true)}
        aria-label={dict.chat.reviewTriggerAria}
        title={dict.chat.reviewTriggerAria}
        className="relative z-[110] flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border border-border-subtle text-text-muted transition-colors hover:border-border-strong hover:text-text-primary"
      >
        <ReviewIcon
          width={18}
          height={18}
          strokeWidth={1.5}
          aria-hidden="true"
        />
      </button>
      <ChatHeaderMenu
        characterId={character.id}
        characterName={character.name}
        currentHasUserMessages={hasUserMessages}
      />
      <StageAdjustmentMenu
        brightness={stageAdjust.brightness}
        clarity={stageAdjust.clarity}
        onChange={handleStageAdjust}
      />
    </>
  );

  const errorText =
    status === "error" && !isInsufficientCurrency
      ? isContentRestricted
        ? dict.chat.contentRestricted
        : isModelUnavailable
          ? dict.chat.modelUnavailable
          : dict.chat.streamError
      : null;

  // 消息列整体提取到 memo 组件（见 ChatMessagesList docblock）：输入框敲字
  // 不再连带重渲染全部历史气泡。currency modal 是 Radix Portal,
  // 不属于消息流,移到组件底部与其他 Dialog 并列。
  const messagesNode = (
    <ChatMessagesList
      messages={messages}
      status={status}
      continuingMessageId={continuingMessageId}
      lastAssistantIdx={lastAssistantIdx}
      submitting={submitting}
      rules={rules}
      userPrefs={userPrefs}
      characterMeta={characterMeta}
      characterName={character.name}
      creatorNote={character.creatorNote}
      publicNoteHeader={publicNoteHeader}
      userName={effectiveUserName}
      userAvatarUrl={userAvatarUrl}
      canDebug={canDebug}
      debugMode={debugMode}
      debugMetaMap={debugMetaMap}
      truncatedBySafetySet={truncatedBySafetySet}
      openingComponents={openingComponents}
      openingGlobalCss={openingGlobalCss}
      errorText={errorText}
      errorDiagnosticKind={chatStreamErrorDiagnosticAttribute(error, canDebug, errorText !== null)}
      onSendMessage={onHostSendMessage}
      onFillComposer={onHostFillComposer}
      onForkToMessage={onForkToMessage}
      onDeleteMessage={onDeleteMessage}
      onContinueMessage={onContinueAssistantMessage}
      onEditUserMessage={onEditUserMessage}
      onDeleteUserMessage={onDeleteUserMessage}
      onEditAssistantMessage={onEditAssistantMessage}
    />
  );

  // 灵动岛悬浮层：从开场组件里拆出的悬浮件挂这里，浮在消息流之上、不随滚动。
  const floatingNode =
    openingComponents.length > 0 ? (
      <FloatingLayer>
        <FloatingSlot
          components={openingComponents}
          character={characterMeta}
          userName={effectiveUserName}
          globalCss={openingGlobalCss}
          onSendMessage={onHostSendMessage}
          onFillComposer={onHostFillComposer}
          onReplaceComposer={setInput}
        />
      </FloatingLayer>
    ) : null;

  const inputNode = (
    <form
      id="nj_chat_input_container"
      onSubmit={onSubmit}
      className="relative z-50 border-t border-border-subtle bg-bg-elevated px-[var(--space-md)] py-[var(--space-sm)] md:px-[var(--space-xl)]"
    >
      {canStopGeneration && (
        <div className="pointer-events-none absolute inset-x-0 bottom-full z-[60] mb-[var(--space-xs)] px-[var(--space-md)] md:px-[var(--space-xl)]">
          <div className="mx-auto flex w-full max-w-[640px] justify-end">
            <button
              id="nj_chat_stop_button"
              type="button"
              onClick={onStopGeneration}
              aria-label={dict.chat.stopButton}
              title={dict.chat.stopButton}
              className="rise-in pointer-events-auto inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] border border-border-strong bg-surface-solid/95 text-text-secondary backdrop-blur-md transition-[color,border-color,background-color,transform] hover:border-semantic-error/60 hover:bg-bg-hover hover:text-semantic-error active:scale-[0.94]"
            >
              <span
                aria-hidden="true"
                className="h-2 w-2 rounded-[2px] bg-semantic-error"
              />
            </button>
          </div>
        </div>
      )}
      {retryLimitReached && (
        <div
          role="note"
          className="mx-auto mb-[var(--space-sm)] w-full max-w-[640px] rounded-[var(--radius-sm)] border border-semantic-warning/40 bg-semantic-warning/10 px-[var(--space-sm)] py-[var(--space-xs)] text-xs text-semantic-warning"
        >
          {dict.chat.retryLimitReached}
        </div>
      )}
      {/* 功能按钮排 —— 原来是绝对定位负 translate 悬在消息流上方：长消息
          滚动时盖住内容，还要靠 pointer-events none/auto 套娃保持穿透。
          改成 form 内常规流式行（composer 顶沿），composer 高度真实占位，
          消息滚动区自然让位。所有 id 原样保留且仍在
          #nj_chat_input_container 子树内，creator 后代选择器不受影响。 */}
      <ChatInputToolbar wrap={!!sourceControls}>
        <button
          id="nj_chat_input_replay_btn"
          type="button"
          aria-label={dict.chat.regenerateButtonAria}
          title={dict.chat.regenerateButtonAria}
          onClick={onRegenerate}
          disabled={!canRegenerate}
          className="nj_chat_input_replay_btn flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] border border-border-subtle bg-surface-glass text-text-muted transition-colors hover:border-border-strong hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RegenerateIcon
            width={16}
            height={16}
            strokeWidth={1.7}
            aria-hidden="true"
          />
        </button>
        <button
          id="nj_mask_btn"
          type="button"
          // 戴面具时挂 data-active（全站激活态惯例）。平台注入的高优先级 CSS
          // #nj_mask_btn[data-active] 用 currentColor 发光描边标记激活态 ——
          // 创作者美化过的卡描边自动取按钮主题色，没美化的取平台紫。见 whitelist.ts。
          data-active={activeMaskId ? "" : undefined}
          aria-label={dict.chat.maskTriggerAria}
          title={dict.chat.maskTriggerAria}
          onClick={() => setMaskDialogOpen(true)}
          className={`flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] border bg-surface-glass transition-colors ${
            activeMaskId
              ? "border-accent-primary text-accent-primary"
              : "border-border-subtle text-text-muted hover:border-border-strong hover:text-text-primary"
          }`}
        >
          <MaskIcon
            width={16}
            height={16}
            strokeWidth={1.7}
            aria-hidden="true"
          />
        </button>
        <div className="nj_chat_input_model_btn">
          <ModelPicker
            value={modelId}
            onChange={handleModelChange}
            size="sm"
            disabled={submitting}
            triggerId="nj_chat_input_model_btn"
          />
        </div>
        <CurrencySwitcher
          storageKey={`nj_currency_${sessionId}`}
          modelId={modelId}
          onChange={setCurrencyType}
          disabled={submitting}
        />
        {sourceControls&&<MufySourceControls key={sessionId+sourceControls.pageControls?.id} spec={sourceControls} inputRef={inputBoxRef} onChange={setInput} userName={effectiveUserName} characterName={character.name}/>}
      </ChatInputToolbar>
      {/* #nj_chat_input_box = 输入框「外框」(wrapper)，与契约 chat-render-spec.md
          §205 及生成器 prompt 一致（外部美化结构）。创作者在这加 background/border/圆角，
          内层 textarea (#nj_chat_input_textarea) 默认透明无边框 → 不产生双层框。
          默认 border+bg-surface-glass 是平台底样，创作者 !important 自然覆盖。 */}
      {haloSpec&&<MufyHaloToolkit key={haloScope} scope={haloScope} data={haloSpec} onFillComposer={onHostFillComposer} onOpenChange={()=>{}} onCommandChange={onHaloCommandChange}/>}
      <div
        id="nj_chat_input_box"
        className="mx-auto flex w-full max-w-[640px] flex-wrap items-end rounded-[var(--radius-lg)] border border-border-subtle bg-[color-mix(in_srgb,var(--surface-solid)_70%,transparent)] backdrop-blur-xl transition-colors focus-within:border-border-strong"
      >
        <ReplySuggestions
          sessionId={sessionId}
          contextKey={suggestionContextKey}
          disabled={submitting || messages.at(-1)?.role !== "assistant"}
          onSend={sendSuggestedReply}
          onEdit={editSuggestedReply}
        />
        {prefixSpec&&<MufyPrefixPanel key={prefixScope} spec={prefixSpec} sessionId={sessionId} onChange={onPrefixChange}/>}
        <textarea
          id="nj_chat_input_textarea"
          ref={inputBoxRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            // 触屏设备（无 Shift 键）：回车 = 换行，只能点发送按钮发送。
            // 桌面：Enter 发送，Shift+Enter 换行。
            if (isCoarsePointer) return;
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSubmit(e);
            }
          }}
          placeholder={dict.chat.sendPlaceholder}
          rows={1}
          className="min-w-0 flex-1 self-center resize-none overflow-y-auto border-0 bg-transparent px-[var(--space-md)] py-[var(--space-sm)] font-body-zh text-base leading-normal text-text-primary outline-none"
        />
        <button
          id="nj_chat_send_button"
          type="submit"
          disabled={submitting || !input.trim()}
          aria-label={dict.chat.sendButton}
          className="order-2 inline-flex min-h-13 min-w-11 shrink-0 items-center justify-center px-[var(--space-sm)] text-text-muted transition-colors hover:text-accent-primary disabled:opacity-40"
        >
          <SendIcon
            width={18}
            height={18}
            strokeWidth={1.5}
            aria-hidden="true"
          />
        </button>
      </div>
    </form>
  );

  return (
    <ChatHistoryContext.Provider value={historyRef}>
      <ChatStage
        sourcePresentation={hasMufyAdaptedComponent(openingComponents) || hasMufyRenderedOpening(rules)}
        stageBg={stageBg}
        scrollRef={scrollRef}
        header={headerNode}
        messages={messagesNode}
        input={inputNode}
        floating={floatingNode}
        brightness={stageAdjust.brightness}
        clarity={stageAdjust.clarity}
      />
      <InsufficientCurrencyModal
        open={insufficientOpen}
        onOpenChange={setInsufficientOpen}
        currencyType={insufficientInfo?.currencyType ?? null}
        required={insufficientInfo?.required ?? null}
        balance={insufficientInfo?.balance ?? null}
      />
      <ChatSessionsDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        sessions={sessions}
        activeCharacterId={activeCharacterId}
        titleText={dict.chat.sidebarTitle}
        emptyText={dict.chat.sidebarEmpty}
        unavailableText={dict.chat.sidebarUnavailable}
      />
      <ChatReviewDrawer
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        nodes={reviewNodes}
        onFork={onForkToMessage}
      />
      <MaskDialog
        open={maskDialogOpen}
        onOpenChange={setMaskDialogOpen}
        sessionId={sessionId}
        masks={masks}
        activeMaskId={activeMaskId}
        onMasksChange={setMasks}
        onActiveMaskIdChange={setActiveMaskId}
        hasUnlimitedMasks={hasUnlimitedMasks}
      />
    </ChatHistoryContext.Provider>
  );
}
