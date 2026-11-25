"use client";

import * as Switch from "@radix-ui/react-switch";
import type { UIMessage } from "ai";
import {
  ChevronDown,
  HelpCircle,
  Image as ImageIcon,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  type ReactNode,
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { BreathingDots } from "@/components/ai/BreathingDots";
import { ThinkingDots } from "@/components/ai/ThinkingDots";
import { TagSelector } from "@/components/characters/TagSelector";import { ChatStage } from "@/components/chat/ChatStage";
import {
  CurrencySwitcher,
  type CurrencyType,
} from "@/components/chat/CurrencySwitcher";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { OpeningSlot } from "@/components/chat/OpeningSlot";
import { PackRuleSelector } from "@/components/packs/PackRuleSelector";
import { InsufficientCurrencyModal } from "@/components/quota/InsufficientCurrencyModal";
import { fieldClsSm } from "@/components/ui/field";
import { CropDialog, type CropSession } from "@/components/upload/CropDialog";
import {
  cropImage,
  guessExtension,
  replaceExtension,
} from "@/components/upload/cropper";
import { useI18n } from "@/i18n/client";
import type { Dict } from "@/i18n/types";
import type { ActionResult } from "@/lib/characters/actions";
import {
  CHARACTER_FORM_CSS_PACK_FIELD,
  CHARACTER_FORM_OPENING_PACK_FIELD,
} from "@/lib/characters/subscription-plan";
import type {
  BeautificationPack,
  Character,
  CharacterPackSubscription,
  OpeningComponent,
  RegexRule,
  SubscriptionRuleOverride,
} from "@/lib/db/schema";
import {
  setCharacterOpeningComponentEnabledAction,
  setCharacterOpeningSlotValuesAction,
  setCharacterRuleEnabledAction,
  setSubscriptionCssEnabledAction,
} from "@/lib/packs/actions";
import { OFFICIAL_PACK_ID } from "@/lib/packs/official-ids";
import { SFW_MODE } from "@/lib/config/site";
import { sanitizeAndScopeCss } from "@/lib/styling/whitelist";
import { firstChar } from "@/lib/util/first-char";
import { safeRandomUUID } from "@/lib/uuid";

/**
 * Shared form for /create/character and /characters/[id]/edit.
 */

type ServerAction = (
  prev: ActionResult<{ id: string }> | null,
  formData: FormData,
) => Promise<ActionResult<{ id: string }>>;

interface Props {
  action: ServerAction;
  initial?: Character | null;
  /** Where the [取消] button links back to. New flow → "/mine"; edit flow → "/characters/[id]". */
  cancelHref: string;
  /** Optional slot rendered inside the scrollable area, below the form grid.
   *  Edit flow uses this for the DeleteCharacterButton danger zone. */
  dangerZone?: ReactNode;
  subscriptions?: Array<{
    subscription: CharacterPackSubscription;
    pack: BeautificationPack;
    overrides: SubscriptionRuleOverride[];
    rules: RegexRule[];
  }>;
  myPacks?: BeautificationPack[];
  publicPacks?: BeautificationPack[];
  packRules?: Record<string, RegexRule[]>;
  packOpeningComponents?: Record<string, OpeningComponent[]>;
  /** Edit mode only: opening component ids the owner has turned off. */
  openingDisabledIds?: Set<string>;
  /** Edit mode only: per-component slot values { [componentId]: { [slot]: value } }. */
  openingSlotValues?: Record<string, Record<string, string>>;
  /** Viewer's user id. Lets the D-section pack list expose an "Open Studio →"
   *  link on packs the viewer owns. Omit on pages without a logged-in viewer. */
  currentUserId?: string;
}

type CharacterFormCopy = Dict["characterForm"];

const labelCls = "block text-xs text-text-secondary mb-[var(--space-xs)]";
// 紧凑档共享控件样式（creator 工具密度），颜色/focus 语汇与全站统一
const inputCls = fieldClsSm;
const textareaCls = `${inputCls} font-mono text-xs leading-relaxed min-h-24`;
const sandboxPanelCls =
  "glass-card flex flex-col gap-[var(--space-sm)] p-[var(--space-md)]";
const collapsibleSectionCls =
  "glass-card overflow-hidden border border-border-subtle";
const collapsibleSummaryCls =
  "group flex cursor-pointer list-none items-start justify-between gap-[var(--space-md)] px-[var(--page-px)] py-[var(--space-md)] marker:hidden [&::-webkit-details-marker]:hidden";
const collapsibleBodyCls =
  "border-t border-border-subtle px-[var(--page-px)] py-[var(--space-md)]";
const collapsibleTitleCls =
  "font-display-zh text-lg leading-tight text-text-primary";
const collapsibleHintCls = "mt-[var(--space-xs)] text-xs text-text-muted";
const collapsibleIconCls =
  "mt-[2px] shrink-0 text-text-secondary transition-transform duration-[var(--dur-short)] group-open:rotate-180";
const imageUploadButtonCls =
  "inline-flex items-center justify-center gap-[var(--space-xs)] rounded-[var(--radius-sm)] border border-border-subtle px-[var(--space-md)] py-[var(--space-xs)] text-xs text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-60";
const imageAiButtonCls =
  "inline-flex items-center justify-center gap-[var(--space-xs)] rounded-[var(--radius-sm)] border border-accent-secondary/45 bg-accent-secondary/10 px-[var(--space-md)] py-[var(--space-xs)] text-xs text-accent-secondary transition-colors hover:bg-accent-secondary/20 disabled:cursor-not-allowed disabled:opacity-60";
const toggleRowCls =
  "flex items-center justify-between gap-[var(--space-md)] rounded-[var(--radius-md)] border border-border-subtle bg-bg-elevated/55 px-[var(--space-md)] py-[var(--space-xs)]";
const toggleLabelCls =
  "whitespace-nowrap font-mono text-xs uppercase tracking-[0.12em] text-text-secondary";
const toggleRootCls =
  "group relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-[var(--radius-pill)] border border-border-subtle bg-surface-glass transition-colors duration-[var(--dur-short)] data-[state=checked]:border-accent-primary data-[state=checked]:bg-accent-primary data-[state=checked]:shadow-(--glow-accent) disabled:opacity-60";
const toggleThumbCls =
  "block h-[18px] w-[18px] translate-x-[3px] rounded-full bg-text-primary shadow-[0_1px_3px_rgba(0,0,0,0.5)] transition-transform duration-[var(--dur-short)] will-change-transform data-[state=checked]:translate-x-[22px]";
const SANDBOX_SAMPLE_PREFIX = "sandbox-sample-rule-";

interface DraftCharacter {
  name: string;
  gender: NonNullable<Character["gender"]>;
  age: string;
  nsfw: boolean;
  isAi: boolean;
  contentType: NonNullable<Character["contentType"]>;
  coverImageUrl: string;
  avatarUrl: string;
  tags: string[];
  bio: string;
  creatorNote: string;
  visibility: NonNullable<Character["visibility"]>;
  persona: string;
  adversity: string;
  defaultCognition: string;
  opening: string;
  plotSetting: string;
  outputSetting: string;
  sampleDialogue: string;
}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p className="text-xs text-semantic-error">{messages.join("，")}</p>;
}

function initialDraft(initial?: Character | null): DraftCharacter {
  return {
    name: initial?.name ?? "",
    gender: initial?.gender ?? "unset",
    age: initial?.age == null ? "" : String(initial.age),
    nsfw: initial?.nsfw ?? false,
    isAi: initial?.isAi ?? false,
    contentType: initial?.contentType ?? "original",
    coverImageUrl: initial?.coverImageUrl ?? "",
    avatarUrl: initial?.avatarUrl ?? "",
    tags: initial?.tags ?? [],
    bio: initial?.bio ?? "",
    creatorNote: initial?.creatorNote ?? "",
    visibility: initial?.visibility ?? "private",
    persona: initial?.persona ?? "",
    adversity: initial?.adversity ?? "",
    defaultCognition: initial?.defaultCognition ?? "",
    opening: initial?.opening ?? "",
    plotSetting: initial?.plotSetting ?? "",
    outputSetting: initial?.outputSetting ?? "",
    sampleDialogue: initial?.sampleDialogue ?? "",
  };
}

function extractOpeningMessages(opening: string) {
  const matches = Array.from(
    opening.matchAll(/<message>([\s\S]*?)<\/message>/gi),
  ).map((m) => m[1].trim());
  if (matches.length > 0) return matches.slice(0, 2);
  const stripped = opening
    .replace(/<scenario>[\s\S]*?<\/scenario>/gi, "")
    .replace(/<system>[\s\S]*?<\/system>/gi, "")
    .trim();
  return stripped ? [stripped] : [];
}

function TogglePill({
  id,
  name,
  label,
  hint,
  checked,
  onCheckedChange,
}: {
  id: string;
  /** When set, Radix Switch renders a hidden input that posts the
   * value with the surrounding <form>. Required for any toggle whose
   * value needs to round-trip through a server action. */
  name?: string;
  label: string;
  hint?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <span className="flex items-center gap-[var(--space-sm)]">
      <span id={id} className={toggleLabelCls}>
        {label}
      </span>
      {hint ? (
        <button
          type="button"
          tabIndex={0}
          title={hint}
          aria-label={hint}
          className="inline-flex h-4 w-4 shrink-0 cursor-help items-center justify-center rounded-full text-text-muted transition-colors hover:text-text-secondary focus:text-text-secondary focus:outline-none"
        >
          <HelpCircle
            width={14}
            height={14}
            strokeWidth={1.8}
            aria-hidden="true"
          />
        </button>
      ) : null}
      <Switch.Root
        aria-labelledby={id}
        name={name}
        checked={checked}
        onCheckedChange={onCheckedChange}
        className={toggleRootCls}
      >
        <Switch.Thumb className={toggleThumbCls} />
      </Switch.Root>
    </span>
  );
}

function CollapsibleSection({
  title,
  hint,
  defaultOpen = true,
  children,
}: {
  title: string;
  hint?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <details
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      className={collapsibleSectionCls}
    >
      <summary className={collapsibleSummaryCls}>
        <div className="min-w-0">
          <h2 className={collapsibleTitleCls}>{title}</h2>
          {hint ? <p className={collapsibleHintCls}>{hint}</p> : null}
        </div>
        <ChevronDown
          width={18}
          height={18}
          strokeWidth={1.8}
          aria-hidden="true"
          className={collapsibleIconCls}
        />
      </summary>
      <div className={collapsibleBodyCls}>{children}</div>
    </details>
  );
}

function ImageUploadField({
  id,
  name,
  scope,
  label,
  hint,
  value,
  aspectClass,
  errorMessages,
  onChange,
  onUploadingChange,
}: {
  id: string;
  name: keyof Pick<DraftCharacter, "coverImageUrl" | "avatarUrl">;
  scope: "cover" | "avatar";
  label: string;
  hint: string;
  value: string;
  aspectClass: string;
  errorMessages?: string[];
  onChange: (value: string) => void;
  onUploadingChange: (delta: 1 | -1) => void;
}) {
  const { dict } = useI18n();
  const t = dict.characterForm;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [cropSession, setCropSession] = useState<CropSession | null>(null);

  async function upload(file: File) {
    setIsUploading(true);
    onUploadingChange(1);
    setUploadError(null);

    const body = new FormData();
    body.set("file", file);
    body.set("scope", scope);

    try {
      const response = await fetch("/api/uploads/image", {
        method: "POST",
        body,
      });
      const payload = (await response.json().catch(() => null)) as {
        publicUrl?: string;
        error?: string;
      } | null;

      if (!response.ok || !payload?.publicUrl) {
        throw new Error();
      }

      onChange(payload.publicUrl);
    } catch {
      setUploadError(t.imageUploadFailed);
    } finally {
      setIsUploading(false);
      onUploadingChange(-1);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function openCropper(file: File) {
    setUploadError(null);
    const sourceUrl = URL.createObjectURL(file);
    const aspect = scope === "avatar" ? 1 : 3 / 4;
    setCropSession({
      open: true,
      sourceUrl,
      file,
      aspect,
      crop: { x: 0, y: 0 },
      zoom: 1,
      croppedAreaPixels: null,
    });
  }

  function closeCropper() {
    setCropSession((prev) => {
      if (prev) URL.revokeObjectURL(prev.sourceUrl);
      return null;
    });
    if (inputRef.current) inputRef.current.value = "";
  }

  async function confirmCrop() {
    if (!cropSession?.croppedAreaPixels) {
      setUploadError(t.imageUploadFailed);
      return;
    }

    try {
      const blob = await cropImage(
        cropSession.sourceUrl,
        cropSession.croppedAreaPixels,
        cropSession.file.type,
      );
      const file = new File(
        [blob],
        replaceExtension(
          cropSession.file.name,
          guessExtension(cropSession.file),
        ),
        { type: blob.type || cropSession.file.type },
      );
      closeCropper();
      await upload(file);
    } catch {
      setUploadError(t.imageUploadFailed);
    }
  }

  return (
    <div>
      <input type="hidden" name={name} value={value} />
      <label className={labelCls} htmlFor={id}>
        {label}
      </label>
      <div className="rounded-[var(--radius-md)] border border-border-subtle bg-bg-elevated/60 p-[var(--space-sm)]">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isUploading}
          className={`group relative flex w-full overflow-hidden rounded-[var(--radius-sm)] border border-dashed border-border-subtle bg-surface-solid ${aspectClass}`}
        >
          {value ? (
            // biome-ignore lint/performance/noImgElement: uploaded R2 URLs are user-owned public assets
            <img
              src={value}
              alt=""
              className="h-full w-full object-cover opacity-90 transition-transform group-hover:scale-[1.02]"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-[var(--space-sm)] bg-[radial-gradient(circle_at_50%_35%,rgba(184,197,209,0.18),rgba(11,18,32,0.92)_64%)] p-[var(--space-md)] text-center text-text-muted">
              <ImageIcon width={28} height={28} strokeWidth={1.4} />
              <span className="font-display-zh text-base text-text-secondary">
                {hint}
              </span>
            </div>
          )}
          <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-[var(--space-xs)] bg-bg-base/75 px-[var(--space-sm)] py-[var(--space-xs)] text-xs text-text-secondary opacity-100 backdrop-blur-sm transition-opacity group-hover:opacity-100 md:opacity-0">
            <Upload width={14} height={14} strokeWidth={1.6} />
            {value ? t.replaceImageButton : t.uploadImageButton}
          </span>
        </button>

        <input
          ref={inputRef}
          id={id}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void openCropper(file);
          }}
        />

        <div className="mt-[var(--space-sm)] flex flex-wrap items-center justify-end gap-[var(--space-sm)]">
          <div className="flex items-center gap-[var(--space-sm)]">
            {isUploading && (
              <span className="inline-flex items-center gap-[var(--space-xs)] text-xs text-text-secondary">
                {t.imageUploading}
                <BreathingDots size={4} />
              </span>
            )}
            {/* ImageAIGenerateDialog temporarily disabled — GPT-image quota unavailable
            <ImageAIGenerateDialog
              target={scope}
              draft={draft}
              disabled={isUploading}
              onGeneratedFile={(file) => upload(file)}
            /> */}
            {value && (
              <button
                type="button"
                onClick={() => {
                  setUploadError(null);
                  onChange("");
                }}
                className={imageUploadButtonCls}
              >
                <X width={14} height={14} strokeWidth={1.8} />
                {t.removeImageButton}
              </button>
            )}
          </div>
        </div>
      </div>
      {(uploadError || errorMessages?.length) && (
        <p className="mt-[var(--space-xs)] text-xs text-semantic-error">
          {uploadError ?? errorMessages?.join("，")}
        </p>
      )}

      {cropSession && (
        <CropDialog
          session={cropSession}
          copy={{
            title: t.imageCropTitle,
            hint: t.imageCropHint,
            zoom: t.imageCropZoom,
            reset: t.imageCropReset,
            cancel: t.imageCropCancel,
            confirm: t.imageCropConfirm,
          }}
          onClose={closeCropper}
          onConfirm={() => void confirmCrop()}
          onCropChange={(crop) =>
            setCropSession((prev) => (prev ? { ...prev, crop } : prev))
          }
          onZoomChange={(zoom) =>
            setCropSession((prev) => (prev ? { ...prev, zoom } : prev))
          }
          onCropComplete={(croppedAreaPixels) =>
            setCropSession((prev) =>
              prev ? { ...prev, croppedAreaPixels } : prev,
            )
          }
        />
      )}
    </div>
  );
}

function imageFileFromBlob(blob: Blob, target: "cover" | "avatar") {
  const type = blob.type || "image/webp";
  const ext =
    type === "image/png" ? "png" : type === "image/jpeg" ? "jpg" : "webp";
  return new File([blob], `dearm-${target}-${safeRandomUUID()}.${ext}`, {
    type,
  });
}

function _ImageAIGenerateDialog({
  target,
  draft,
  disabled,
  onGeneratedFile,
}: {
  target: "cover" | "avatar";
  draft: DraftCharacter;
  disabled: boolean;
  onGeneratedFile: (file: File) => Promise<void>;
}) {
  const { dict } = useI18n();
  const t = dict.characterForm;
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [status, setStatus] = useState<
    | "idle"
    | "optimizing"
    | "ready"
    | "generating"
    | "preview"
    | "uploading"
    | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const [currencyType, setCurrencyType] = useState<CurrencyType>("silver");
  const [insufficientOpen, setInsufficientOpen] = useState(false);
  const [insufficientInfo, setInsufficientInfo] = useState<{
    currencyType: CurrencyType;
    required: number | null;
    balance: number | null;
  } | null>(null);

  function handleInsufficient(body: {
    currencyType?: "gold" | "silver";
    required?: number;
    balance?: number;
  }) {
    setStatus("idle");
    setInsufficientInfo({
      currencyType: body.currencyType ?? currencyType,
      required: body.required ?? null,
      balance: body.balance ?? null,
    });
    setInsufficientOpen(true);
  }
  const dialogTitle =
    target === "cover" ? t.imageAiDialogTitleCover : t.imageAiDialogTitleAvatar;
  const isBusy =
    status === "optimizing" ||
    status === "generating" ||
    status === "uploading";

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function clearPreview() {
    setPreviewFile(null);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }

  function close() {
    if (isBusy) return;
    setOpen(false);
    setPrompt("");
    clearPreview();
    setStatus("idle");
    setError(null);
  }

  async function optimizePrompt() {
    const input = prompt.trim();
    if (!input) return;
    clearPreview();
    setStatus("optimizing");
    setError(null);
    setPrompt("");

    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "image-prompt",
          prompt: input,
          currencyType,
          context: {
            imageTarget: target,
            characterName: draft.name,
            characterBio: draft.bio,
            characterTags: draft.tags,
          },
        }),
      });
      if (!res.ok) {
        if (res.status === 402) {
          const body = await res.json().catch(() => null);
          if (body?.error === "insufficient_currency") {
            handleInsufficient(body);
            return;
          }
        }
        throw new Error();
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("missing response body");
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setPrompt(acc);
      }
      setStatus("ready");
    } catch {
      setError(t.imageAiError);
      setStatus("error");
    }
  }

  async function generateImageFromPrompt() {
    const finalPrompt = prompt.trim();
    if (!finalPrompt) {
      setError(t.imageAiError);
      setStatus("error");
      return;
    }
    clearPreview();
    setStatus("generating");
    setError(null);

    try {
      const res = await fetch("/api/ai/images/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target, prompt: finalPrompt, currencyType }),
      });
      if (!res.ok) {
        if (res.status === 402) {
          const body = await res.json().catch(() => null);
          if (body?.error === "insufficient_currency") {
            handleInsufficient(body);
            return;
          }
        }
        throw new Error();
      }
      const blob = await res.blob();
      const file = imageFileFromBlob(blob, target);
      const url = URL.createObjectURL(file);
      setPreviewFile(file);
      setPreviewUrl(url);
      setStatus("preview");
    } catch {
      setError(t.imageAiError);
      setStatus("error");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className={imageAiButtonCls}
      >
        <Sparkles width={14} height={14} strokeWidth={1.7} />
        {t.imageAiGenerateButton}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-base/70 p-[var(--page-px)] backdrop-blur-sm">
          <div className="flex max-h-[calc(100dvh-var(--space-xl))] w-full max-w-3xl flex-col gap-[var(--space-md)] overflow-y-auto rounded-[var(--radius-md)] border border-border-subtle bg-bg-elevated p-[var(--space-xl)]">
            <div className="flex items-start justify-between gap-[var(--space-md)]">
              <h3 className="font-display-zh text-lg text-text-primary">
                {dialogTitle}
              </h3>
              <button
                type="button"
                onClick={close}
                disabled={isBusy}
                className="text-sm text-text-muted hover:text-text-primary disabled:opacity-50"
              >
                ✕
              </button>
            </div>

            <div>
              <label className={labelCls} htmlFor={`${target}-image-ai-brief`}>
                {t.imageAiShortPromptLabel}
              </label>
              <textarea
                id={`${target}-image-ai-brief`}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={8}
                disabled={isBusy}
                placeholder={t.imageAiShortPromptPlaceholder}
                className="w-full rounded-[var(--radius-sm)] border border-border-subtle bg-surface-glass px-[var(--space-md)] py-[var(--space-sm)] text-base leading-relaxed text-text-primary outline-none focus:border-border-strong disabled:opacity-60"
              />
            </div>

            <div className="flex flex-wrap items-center gap-[var(--space-sm)]">
              <button
                type="button"
                onClick={optimizePrompt}
                disabled={isBusy || !prompt.trim()}
                className="rounded-[var(--radius-sm)] bg-accent-primary px-[var(--space-md)] py-[var(--space-xs)] text-sm font-semibold text-text-on-accent transition-colors hover:bg-accent-primary-hover disabled:opacity-50"
              >
                {status === "optimizing"
                  ? t.imageAiOptimizing
                  : t.imageAiOptimize}
              </button>
              <button
                type="button"
                onClick={generateImageFromPrompt}
                disabled={isBusy || !prompt.trim()}
                className="rounded-[var(--radius-sm)] border border-accent-secondary/50 px-[var(--space-md)] py-[var(--space-xs)] text-sm text-accent-secondary transition-colors hover:bg-accent-secondary/10 disabled:opacity-50"
              >
                {status === "generating"
                  ? t.imageAiGenerating
                  : t.imageAiGenerate}
              </button>
              {previewFile && (
                <button
                  type="button"
                  onClick={async () => {
                    setStatus("uploading");
                    await onGeneratedFile(previewFile);
                    close();
                  }}
                  disabled={isBusy}
                  className="rounded-[var(--radius-sm)] border border-accent-primary/60 px-[var(--space-md)] py-[var(--space-xs)] text-sm text-accent-primary hover:bg-accent-primary/10"
                >
                  {t.imageAiUse}
                </button>
              )}
              {previewFile && (
                <button
                  type="button"
                  onClick={generateImageFromPrompt}
                  disabled={isBusy}
                  className="rounded-[var(--radius-sm)] border border-border-subtle px-[var(--space-md)] py-[var(--space-xs)] text-sm text-text-muted hover:text-text-primary disabled:opacity-50"
                >
                  {t.imageAiRegenerate}
                </button>
              )}
              <span className="ml-auto">
                <CurrencySwitcher
                  storageKey="nj_currency_image_generate"
                  modelId="dearm:image-gen"
                  fixedCost={{ gold: 3, silver: 6 }}
                  onChange={setCurrencyType}
                  disabled={isBusy}
                />
              </span>
            </div>

            {(status === "optimizing" ||
              status === "generating" ||
              status === "uploading") && (
              <ThinkingDots
                label={
                  status === "optimizing"
                    ? t.imageAiOptimizing
                    : status === "uploading"
                      ? t.imageUploading
                      : t.imageAiGenerating
                }
                align="bubble"
              />
            )}

            {previewUrl && (
              <div className="rounded-[var(--radius-md)] border border-border-subtle bg-bg-base/55 p-[var(--space-sm)]">
                {/* biome-ignore lint/performance/noImgElement: local blob URL preview cannot use next/image */}
                <img
                  src={previewUrl}
                  alt={t.imageAiPreviewAlt}
                  className={`mx-auto max-h-[520px] rounded-[var(--radius-sm)] object-cover ${
                    target === "avatar"
                      ? "aspect-square w-full max-w-[360px]"
                      : "aspect-[2/3] w-full max-w-[360px]"
                  }`}
                />
              </div>
            )}

            {error && (
              <p className="rounded-[var(--radius-sm)] border border-semantic-error/40 bg-semantic-error/10 p-[var(--space-sm)] text-xs text-semantic-error">
                {error}
              </p>
            )}
          </div>
        </div>
      )}
      <InsufficientCurrencyModal
        open={insufficientOpen}
        onOpenChange={setInsufficientOpen}
        currencyType={insufficientInfo?.currencyType ?? null}
        required={insufficientInfo?.required ?? null}
        balance={insufficientInfo?.balance ?? null}
      />
    </>
  );
}

const CHARACTER_FORM_ID = "nj_character_form";

function FormTopBar({
  draftName,
  visibility,
  cancelHref,
  isPending,
  uploadingCount,
  isEdit,
  showSavedFlash,
  packPending,
}: {
  draftName: string;
  visibility: NonNullable<Character["visibility"]>;
  cancelHref: string;
  isPending: boolean;
  uploadingCount: number;
  isEdit: boolean;
  showSavedFlash: boolean;
  packPending: boolean;
}) {
  const { dict } = useI18n();
  const t = dict.characterForm;
  const status =
    visibility === "public"
      ? t.statusPublished
      : visibility === "unlisted"
        ? t.statusUnlisted
        : t.statusDraft;
  const name = draftName.trim() || t.untitled;
  const disabled = isPending || uploadingCount > 0 || packPending;

  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-[var(--space-md)] border-b border-border-subtle bg-bg-elevated px-[var(--page-px)] py-[var(--space-sm)]">
      <div className="flex min-w-0 items-center gap-[var(--space-md)]">
        <h1 className="truncate font-display-zh text-lg text-text-primary">
          {name}
        </h1>
        <span className="shrink-0 rounded-[var(--radius-pill)] border border-border-subtle bg-surface-glass/60 px-[var(--space-sm)] py-[2px] text-xs text-text-muted">
          {status}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-[var(--space-sm)]">
        {showSavedFlash && (
          <output aria-live="polite" className="text-sm text-semantic-success">
            {t.savedFlash}
          </output>
        )}
        <Link
          href={cancelHref}
          className="rounded-[var(--radius-sm)] border border-border-subtle px-[var(--space-md)] py-[var(--space-xs)] text-sm text-text-muted transition-colors hover:border-border-strong hover:text-text-primary"
        >
          {t.cancel}
        </Link>
        <button
          type="submit"
          form={CHARACTER_FORM_ID}
          name="intent"
          value="save"
          disabled={disabled}
          className="rounded-[var(--radius-sm)] border border-border-subtle px-[var(--space-md)] py-[var(--space-xs)] text-sm text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary disabled:opacity-50"
        >
          {isPending ? t.saving : isEdit ? t.submitUpdate : t.save}
        </button>
        <button
          type="submit"
          form={CHARACTER_FORM_ID}
          name="intent"
          value="publish"
          disabled={disabled}
          className="rounded-[var(--radius-sm)] bg-accent-primary px-[var(--space-md)] py-[var(--space-xs)] text-sm font-semibold text-text-on-accent transition-colors hover:bg-accent-primary-hover disabled:opacity-50"
        >
          {isPending ? t.publishing : t.publish}
        </button>
      </div>
    </div>
  );
}

export function CharacterForm({
  action,
  initial,
  cancelHref,
  dangerZone,
  subscriptions = [],
  myPacks = [],
  publicPacks = [],
  packRules = {},
  packOpeningComponents = {},
  openingDisabledIds,
  openingSlotValues = {},
  currentUserId,
}: Props) {
  const { dict } = useI18n();
  const [state, formAction, isPending] = useActionState<
    ActionResult<{ id: string }> | null,
    FormData
  >(action, null);

  const errs = state && !state.ok ? state.fieldErrors : undefined;
  const formErr = state && !state.ok ? state.error : null;
  // 「保存修改」不跳页, 给用户一个短暂确认; 「发布」直接 redirect 不走这.
  const [showSavedFlash, setShowSavedFlash] = useState(false);
  useEffect(() => {
    if (!state?.ok) return;
    setShowSavedFlash(true);
    const id = setTimeout(() => setShowSavedFlash(false), 2500);
    return () => clearTimeout(id);
  }, [state]);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [draft, setDraft] = useState<DraftCharacter>(() =>
    initialDraft(initial),
  );
  const pathname = usePathname();
  const router = useRouter();

  // Auto-refresh server data when the tab regains focus. Studio opens in a
  // new tab; this catches any pack / rule edits done over there so the
  // selector here reflects the new state without a hard reload. Form-local
  // useState (name / persona / draft toggles) is untouched.
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") router.refresh();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [router]);

  const t = dict.characterForm;
  const availablePacks = useMemo(
    () => [...myPacks, ...publicPacks],
    [myPacks, publicPacks],
  );
  const officialPackIds = useMemo(() => new Set([OFFICIAL_PACK_ID]), []);
  // Source of truth for which rules are currently enabled on this character.
  // Edit mode initializes from subscriptions ∖ disabled-overrides; new mode starts empty.
  const [selectedRuleIds, setSelectedRuleIds] = useState<Set<string>>(() => {
    if (!initial) return new Set();
    const next = new Set<string>();
    for (const entry of subscriptions) {
      const disabled = new Set(
        entry.overrides.filter((o) => o.disabled === true).map((o) => o.ruleId),
      );
      const rules = packRules[entry.pack.id] ?? entry.rules;
      for (const r of rules) {
        if (!disabled.has(r.id)) next.add(r.id);
      }
    }
    return next;
  });
  const [packPending, setPackPending] = useState(false);

  // Source of truth for which packs have their globalCss applied. Edit mode
  // initializes from existing subscriptions; new mode starts empty. Keyed by
  // packId so PackRuleSelector can look up by pack regardless of subscription
  // existence (entries missing from this set → CSS not applied).
  const [packCssEnabled, setPackCssEnabled] = useState<Set<string>>(() => {
    if (!initial) return new Set();
    return new Set(
      subscriptions
        .filter((s) => s.subscription.cssEnabled)
        .map((s) => s.pack.id),
    );
  });

  function handleCssToggle(packId: string, enabled: boolean) {
    setPackCssEnabled((prev) => {
      const next = new Set(prev);
      if (enabled) next.add(packId);
      else next.delete(packId);
      return next;
    });
    if (!initial) return; // new flow: persist on form submit
    setPackPending(true);
    setSubscriptionCssEnabledAction(initial.id, packId, enabled)
      .then((result) => {
        if (!result.ok) {
          setPackCssEnabled((prev) => {
            const next = new Set(prev);
            if (enabled) next.delete(packId);
            else next.add(packId);
            return next;
          });
        }
      })
      .finally(() => setPackPending(false));
  }

  // Source of truth for which opening components are enabled on this character.
  // Edit mode: for each subscription with openingEnabled, its components are on
  // unless in openingDisabledIds. New mode starts empty (persist on submit).
  const [selectedOpeningIds, setSelectedOpeningIds] = useState<Set<string>>(
    () => {
      if (!initial) return new Set();
      const disabled = openingDisabledIds ?? new Set<string>();
      const next = new Set<string>();
      for (const s of subscriptions) {
        if (!s.subscription.openingEnabled) continue;
        for (const c of packOpeningComponents[s.pack.id] ?? []) {
          if (!disabled.has(c.id)) next.add(c.id);
        }
      }
      return next;
    },
  );

  // Per-component slot values, editable in the selector. Keyed by componentId
  // then slotKey. Edit mode seeds from server; new mode is empty (slot editing
  // is disabled until the character is saved).
  const [slotValues, setSlotValues] =
    useState<Record<string, Record<string, string>>>(openingSlotValues);

  function handleOpeningComponentToggle(
    packId: string,
    componentId: string,
    enabled: boolean,
  ) {
    setSelectedOpeningIds((prev) => {
      const next = new Set(prev);
      if (enabled) next.add(componentId);
      else next.delete(componentId);
      return next;
    });
    if (!initial) return;
    setPackPending(true);
    setCharacterOpeningComponentEnabledAction(
      initial.id,
      packId,
      componentId,
      enabled,
    )
      .then((result) => {
        if (!result.ok) {
          setSelectedOpeningIds((prev) => {
            const next = new Set(prev);
            if (enabled) next.delete(componentId);
            else next.add(componentId);
            return next;
          });
          console.error("toggle opening component failed:", result.error);
        }
      })
      .finally(() => setPackPending(false));
  }

  function handleOpeningSlotChange(
    componentId: string,
    slotKey: string,
    value: string,
  ) {
    setSlotValues((prev) => ({
      ...prev,
      [componentId]: { ...(prev[componentId] ?? {}), [slotKey]: value },
    }));
    if (!initial) return; // slot editing is gated to edit mode anyway
    setPackPending(true);
    setCharacterOpeningSlotValuesAction(initial.id, componentId, {
      [slotKey]: value,
    })
      .then((result) => {
        if (!result.ok) {
          console.error("save opening slot failed:", result.error);
        }
      })
      .finally(() => setPackPending(false));
  }

  function handleRuleToggle(packId: string, ruleId: string, enabled: boolean) {
    setSelectedRuleIds((prev) => {
      const next = new Set(prev);
      if (enabled) next.add(ruleId);
      else next.delete(ruleId);
      return next;
    });
    if (!initial) return; // new flow: persist on form submit
    setPackPending(true);
    setCharacterRuleEnabledAction(initial.id, packId, ruleId, enabled)
      .then((result) => {
        if (!result.ok) {
          // Revert on failure
          setSelectedRuleIds((prev) => {
            const next = new Set(prev);
            if (enabled) next.delete(ruleId);
            else next.add(ruleId);
            return next;
          });
          console.error("toggle rule failed:", result.error);
        }
      })
      .finally(() => setPackPending(false));
  }

  function set<K extends keyof DraftCharacter>(
    key: K,
    value: DraftCharacter[K],
  ) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function handleUploadingChange(delta: 1 | -1) {
    setUploadingCount((prev) => Math.max(0, prev + delta));
  }

  // Create flow: opening components persist at pack granularity (the create
  // action only knows openingPackIds). A pack counts as opening-enabled if the
  // user turned on at least one of its opening components. Per-component
  // refinement + slot fills happen after the character is saved (edit mode).
  const openingPackIdsForCreate = useMemo(() => {
    const ids = new Set<string>();
    for (const pack of availablePacks) {
      const comps = packOpeningComponents[pack.id] ?? [];
      if (comps.some((c) => selectedOpeningIds.has(c.id))) ids.add(pack.id);
    }
    return Array.from(ids);
  }, [availablePacks, packOpeningComponents, selectedOpeningIds]);

  // For the live preview sandbox: the opening components currently enabled,
  // each carrying its draft slot values so {{slot}} resolves in the preview.
  const activeOpeningSlotValues = slotValues;

  return (
    <div className="flex h-[calc(100dvh-var(--topbar-height))] min-h-0 flex-col">
      <FormTopBar
        draftName={draft.name}
        visibility={draft.visibility}
        cancelHref={cancelHref}
        isPending={isPending}
        uploadingCount={uploadingCount}
        isEdit={Boolean(initial)}
        showSavedFlash={showSavedFlash}
        packPending={packPending}
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <form
          id={CHARACTER_FORM_ID}
          action={formAction}
          noValidate
          className="mx-auto grid w-full max-w-[min(1920px,100%)] gap-[var(--space-lg)] p-[var(--space-md)] md:gap-[var(--space-xl)] md:p-[var(--space-xl)] xl:grid-cols-[minmax(560px,0.9fr)_minmax(560px,1.1fr)] 2xl:grid-cols-[minmax(620px,0.85fr)_minmax(680px,1.15fr)]"
        >
          <div className="order-1 flex min-w-0 flex-col gap-[var(--space-lg)] md:gap-[var(--space-xl)]">
            {formErr && (
              <p
                role="alert"
                className="rounded-[var(--radius-sm)] border border-semantic-error/40 bg-semantic-error/10 p-[var(--space-md)] text-sm text-semantic-error"
              >
                {formErr}
              </p>
            )}
            <CollapsibleSection title={t.sectionInfoLegend}>
              <div className="flex flex-col gap-[var(--space-md)]">
                <div className="grid gap-[var(--space-md)] md:grid-cols-2">
                  <div>
                    <label className={labelCls} htmlFor="name">
                      {t.nameLabel}
                    </label>
                    <input
                      id="name"
                      name="name"
                      required
                      maxLength={128}
                      value={draft.name}
                      onChange={(e) => set("name", e.target.value)}
                      className={inputCls}
                    />
                    <FieldError messages={errs?.name} />
                  </div>

                  <div>
                    <label className={labelCls} htmlFor="gender">
                      {t.genderLabel}
                    </label>
                    <select
                      id="gender"
                      name="gender"
                      value={draft.gender}
                      onChange={(e) =>
                        set(
                          "gender",
                          e.target.value as DraftCharacter["gender"],
                        )
                      }
                      className={inputCls}
                    >
                      <option value="unset">{t.genderUnset}</option>
                      <option value="male">{t.genderMale}</option>
                      <option value="female">{t.genderFemale}</option>
                      <option value="other">{t.genderOther}</option>
                    </select>
                  </div>

                  <div>
                    <label className={labelCls} htmlFor="age">
                      {t.ageLabel}
                    </label>
                    <input
                      id="age"
                      name="age"
                      type="number"
                      min={0}
                      max={9999}
                      value={draft.age}
                      onChange={(e) => set("age", e.target.value)}
                      className={inputCls}
                    />
                  </div>

                  <div>
                    <label className={labelCls} htmlFor="contentType">
                      {t.contentTypeLabel}
                    </label>
                    <select
                      id="contentType"
                      name="contentType"
                      value={draft.contentType}
                      onChange={(e) =>
                        set(
                          "contentType",
                          e.target.value as DraftCharacter["contentType"],
                        )
                      }
                      className={inputCls}
                    >
                      <option value="original">{t.contentTypeOriginal}</option>
                      <option value="self_designed">
                        {t.contentTypeSelfDesigned}
                      </option>
                      <option value="fanwork">{t.contentTypeFanwork}</option>
                    </select>
                  </div>
                </div>

                <div className="grid gap-[var(--space-md)] md:grid-cols-2">
                  <ImageUploadField
                    id="coverImageUrl"
                    name="coverImageUrl"
                    scope="cover"
                    label={t.coverImageLabel}
                    hint={t.coverImageHint}
                    value={draft.coverImageUrl}
                    aspectClass="aspect-[3/4]"
                    errorMessages={errs?.coverImageUrl}
                    onChange={(value) => set("coverImageUrl", value)}
                    onUploadingChange={handleUploadingChange}
                  />
                  <div className="flex flex-col gap-[var(--space-md)]">
                    <ImageUploadField
                      id="avatarUrl"
                      name="avatarUrl"
                      scope="avatar"
                      label={t.avatarLabel}
                      hint={t.avatarImageHint}
                      value={draft.avatarUrl}
                      aspectClass="aspect-square"
                      errorMessages={errs?.avatarUrl}
                      onChange={(value) => set("avatarUrl", value)}
                      onUploadingChange={handleUploadingChange}
                    />
                    <div className={toggleRowCls}>
                      {/* SFW 版没有分级概念，这个勾选框一旦出现就等于告诉
                          creator「这里本该能标成人内容」。写入层已把它钉死
                          为 false（见 lib/characters/schema.ts），这里只是
                          不再提供这个选项。 */}
                      {!SFW_MODE && (
                        <TogglePill
                          id="nj-character-nsfw-toggle-label"
                          name="nsfw"
                          label={t.nsfwLabel}
                          checked={draft.nsfw}
                          onCheckedChange={(checked) => set("nsfw", checked)}
                        />
                      )}
                    </div>
                  </div>
                </div>

                <TagSelector
                  value={draft.tags}
                  onChange={(next) => set("tags", next)}
                />

                <div>
                  <label className={labelCls} htmlFor="bio">
                    {t.bioLabel}
                  </label>
                  <p className="mb-[var(--space-xs)] text-xs leading-relaxed text-text-muted">
                    {t.bioHint}
                  </p>
                  <textarea
                    id="bio"
                    name="bio"
                    value={draft.bio}
                    onChange={(e) => set("bio", e.target.value)}
                    placeholder={t.bioPlaceholder}
                    className={textareaCls}
                    rows={3}
                  />
                </div>

                <div>
                  <label className={labelCls} htmlFor="creatorNote">
                    {t.creatorNoteLabel}
                  </label>
                  <p className="mb-[var(--space-xs)] text-xs leading-relaxed text-text-muted">
                    {t.creatorNoteHint}
                  </p>
                  <textarea
                    id="creatorNote"
                    name="creatorNote"
                    value={draft.creatorNote}
                    onChange={(e) => set("creatorNote", e.target.value)}
                    placeholder={t.creatorNotePlaceholder}
                    className={textareaCls}
                    rows={3}
                  />
                </div>

                <div>
                  <label className={labelCls} htmlFor="visibility">
                    {t.visibilityLabel}
                  </label>
                  <select
                    id="visibility"
                    name="visibility"
                    value={draft.visibility}
                    onChange={(e) =>
                      set(
                        "visibility",
                        e.target.value as DraftCharacter["visibility"],
                      )
                    }
                    className={inputCls}
                  >
                    <option value="public">{t.visibilityPublic}</option>
                    <option value="private">{t.visibilityPrivate}</option>
                    <option value="unlisted">{t.visibilityUnlisted}</option>
                  </select>
                </div>
              </div>
            </CollapsibleSection>

            <CollapsibleSection title={t.sectionPersonaLegend}>
              <div className="flex flex-col gap-[var(--space-md)]">
                <div>
                  <label className={labelCls} htmlFor="persona">
                    {t.personaLabel}
                  </label>
                  <textarea
                    id="persona"
                    name="persona"
                    required
                    value={draft.persona}
                    onChange={(e) => set("persona", e.target.value)}
                    className={textareaCls}
                    rows={10}
                    placeholder={t.personaPlaceholder}
                  />
                  <FieldError messages={errs?.persona} />
                </div>

                <div>
                  <label className={labelCls} htmlFor="adversity">
                    {t.adversityLabel}
                  </label>
                  <textarea
                    id="adversity"
                    name="adversity"
                    value={draft.adversity}
                    onChange={(e) => set("adversity", e.target.value)}
                    className={textareaCls}
                    rows={4}
                    placeholder={t.adversityPlaceholder}
                  />
                </div>

                <div>
                  <label className={labelCls} htmlFor="defaultCognition">
                    {t.defaultCognitionLabel}
                  </label>
                  <textarea
                    id="defaultCognition"
                    name="defaultCognition"
                    value={draft.defaultCognition}
                    onChange={(e) => set("defaultCognition", e.target.value)}
                    className={textareaCls}
                    rows={4}
                    placeholder={t.defaultCognitionPlaceholder}
                  />
                </div>

                <div>
                  <label className={labelCls} htmlFor="opening">
                    {t.openingLabel}
                  </label>
                  <textarea
                    id="opening"
                    name="opening"
                    value={draft.opening}
                    onChange={(e) => set("opening", e.target.value)}
                    className={textareaCls}
                    rows={6}
                    placeholder={t.openingPlaceholder}
                  />
                </div>
              </div>
            </CollapsibleSection>

            <CollapsibleSection
              title={t.sectionAdvancedLegend}
              defaultOpen={Boolean(initial)}
            >
              <div className="flex flex-col gap-[var(--space-md)]">
                <div>
                  <label className={labelCls} htmlFor="plotSetting">
                    {t.plotSettingLabel}
                  </label>
                  <textarea
                    id="plotSetting"
                    name="plotSetting"
                    value={draft.plotSetting}
                    onChange={(e) => set("plotSetting", e.target.value)}
                    className={textareaCls}
                    rows={5}
                  />
                </div>

                <div>
                  <label className={labelCls} htmlFor="outputSetting">
                    {t.outputSettingLabel}
                  </label>
                  <textarea
                    id="outputSetting"
                    name="outputSetting"
                    value={draft.outputSetting}
                    onChange={(e) => set("outputSetting", e.target.value)}
                    placeholder={t.outputSettingPlaceholder}
                    className={textareaCls}
                    rows={5}
                  />
                  <p className="mt-[var(--space-xs)] text-xs text-text-muted">
                    {t.outputSettingHelp}
                  </p>
                  <details className="mt-[var(--space-xs)] text-xs text-text-muted">
                    <summary className="cursor-pointer select-none text-accent-primary hover:text-accent-primary-hover">
                      {t.outputSettingComplexUiToggle}
                    </summary>
                    <p className="mt-[var(--space-xs)]">
                      {t.outputSettingComplexUiHint}
                    </p>
                    <Link
                      href="/packs"
                      className="mt-[var(--space-xs)] inline-block text-accent-primary hover:text-accent-primary-hover"
                    >
                      {t.outputSettingComplexUiManageLink}
                    </Link>
                  </details>
                </div>

                <div>
                  <label className={labelCls} htmlFor="sampleDialogue">
                    {t.sampleDialogueLabel}
                  </label>
                  <textarea
                    id="sampleDialogue"
                    name="sampleDialogue"
                    value={draft.sampleDialogue}
                    onChange={(e) => set("sampleDialogue", e.target.value)}
                    className={textareaCls}
                    rows={6}
                    placeholder={t.sampleDialoguePlaceholder}
                  />
                  <details className="mt-[var(--space-xs)] text-xs text-text-muted">
                    <summary className="cursor-pointer select-none text-accent-primary hover:text-accent-primary-hover">
                      {t.sampleDialogueExampleToggle}
                    </summary>
                    <p className="mt-[var(--space-xs)]">
                      {t.sampleDialogueExampleHint}
                    </p>
                    <pre className="mt-[var(--space-xs)] overflow-x-auto rounded-[var(--radius-sm)] border border-border-subtle bg-surface-glass p-[var(--space-sm)] font-mono text-xs text-text-secondary">
                      {t.sampleDialogueExampleText}
                    </pre>
                  </details>
                </div>
              </div>
            </CollapsibleSection>

            <CollapsibleSection
              title={t.chatStyleLegend}
              defaultOpen={Boolean(initial)}
            >
              <PackRuleSelector
                availablePacks={availablePacks}
                packRules={packRules}
                selectedRuleIds={selectedRuleIds}
                onToggle={handleRuleToggle}
                pending={packPending}
                officialPackIds={officialPackIds}
                currentUserId={currentUserId}
                studioReturnTo={pathname}
                cssEnabledPackIds={packCssEnabled}
                onCssToggle={handleCssToggle}
                packOpeningComponents={packOpeningComponents}
                selectedOpeningIds={selectedOpeningIds}
                onOpeningComponentToggle={handleOpeningComponentToggle}
                openingSlotValues={slotValues}
                onOpeningSlotChange={handleOpeningSlotChange}
                slotEditingEnabled={Boolean(initial)}
              />
              {!initial && (
                <div className="hidden">
                  {Array.from(selectedRuleIds).map((ruleId) => (
                    <input
                      key={ruleId}
                      type="hidden"
                      name="ruleIds"
                      value={ruleId}
                    />
                  ))}
                  {Array.from(packCssEnabled).map((packId) => (
                    <input
                      key={packId}
                      type="hidden"
                      name={CHARACTER_FORM_CSS_PACK_FIELD}
                      value={packId}
                    />
                  ))}
                  {openingPackIdsForCreate.map((packId) => (
                    <input
                      key={packId}
                      type="hidden"
                      name={CHARACTER_FORM_OPENING_PACK_FIELD}
                      value={packId}
                    />
                  ))}
                </div>
              )}
            </CollapsibleSection>
          </div>

          <CreatorSandboxPanel
            draft={draft}
            characterId={initial?.id ?? null}
            selectedRuleIds={selectedRuleIds}
            packCssEnabled={packCssEnabled}
            selectedOpeningIds={selectedOpeningIds}
            openingSlotValues={activeOpeningSlotValues}
            packOpeningComponents={packOpeningComponents}
            availablePacks={availablePacks}
            packRules={packRules}
            currentUserId={currentUserId}
          />
        </form>
        {dangerZone && (
          <div className="mx-auto w-full max-w-[min(1920px,100%)] px-[var(--page-px)] pb-[var(--space-xl)]">
            {dangerZone}
          </div>
        )}
      </div>
    </div>
  );
}

function CreatorSandboxPanel({
  draft,
  characterId,
  selectedRuleIds,
  packCssEnabled,
  selectedOpeningIds,
  openingSlotValues,
  packOpeningComponents,
  availablePacks,
  packRules,
  currentUserId,
}: {
  draft: DraftCharacter;
  characterId: string | null;
  selectedRuleIds: Set<string>;
  packCssEnabled: Set<string>;
  selectedOpeningIds: Set<string>;
  openingSlotValues: Record<string, Record<string, string>>;
  packOpeningComponents: Record<string, OpeningComponent[]>;
  availablePacks: BeautificationPack[];
  packRules: Record<string, RegexRule[]>;
  currentUserId?: string;
}) {
  const { dict } = useI18n();
  const t = dict.characterForm;
  const [messages, setMessages] = useState<UIMessage[]>(() =>
    buildSandboxMessages(draft, t),
  );
  const [input, setInput] = useState("");
  const openingMessages = useMemo(
    () => extractOpeningMessages(draft.opening),
    [draft.opening],
  );
  const previewName = draft.name.trim() || t.sandboxUntitledName;

  useEffect(() => {
    setMessages((prev) => {
      const opening =
        openingMessages[0] ??
        t.sandboxOpeningFallback.replace("{name}", previewName);
      if (prev.length === 0) return buildSandboxMessages(draft, t);
      const [first, ...rest] = prev;
      return [
        {
          ...first,
          parts: [{ type: "text", text: opening }],
        },
        ...rest,
      ];
    });
  }, [draft, openingMessages, previewName, t]);

  const sandboxPacks = useMemo(() => {
    return availablePacks.flatMap((pack) => {
      const rules = (packRules[pack.id] ?? []).filter((r) =>
        selectedRuleIds.has(r.id),
      );
      if (rules.length === 0) return [];
      return [{ pack, rules }];
    });
  }, [availablePacks, packRules, selectedRuleIds]);

  const rules = useMemo(
    () => sandboxPacks.flatMap((entry) => entry.rules),
    [sandboxPacks],
  );
  // For each active rule, pick the text we should drop into the sandbox so the
  // regex has something to match against. Most rules expose a usable XML stub
  // via targetText (e.g. "<env><time>13:37</time>..."); Dearm 手机 gets a
  // richer multi-app sample because its targetText is just a placeholder.
  const sandboxSamples = useMemo(() => {
    const out: Array<{ id: string; text: string }> = [];
    for (const rule of rules) {
      if (!rule.enabled) continue;
      const target = (rule.targetText ?? "").trim();
      if (!target) continue;
      const text = /<phone>/i.test(target) ? t.sandboxPhoneSampleText : target;
      out.push({ id: `${SANDBOX_SAMPLE_PREFIX}${rule.id}`, text });
    }
    return out;
  }, [rules, t.sandboxPhoneSampleText]);
  const sandboxCss = useMemo(() => {
    const raw = availablePacks
      .filter((pack) => packCssEnabled.has(pack.id))
      .map((pack) => pack.globalCss ?? "")
      .filter(Boolean)
      .join("\n");
    return raw ? sanitizeAndScopeCss(raw, "sandbox").css : "";
  }, [availablePacks, packCssEnabled]);

  const activeOpeningComponents = useMemo(
    () =>
      availablePacks
        .flatMap((pack) => packOpeningComponents[pack.id] ?? [])
        .filter((c) => c.enabled && selectedOpeningIds.has(c.id))
        .map((c) => ({ ...c, slotValues: openingSlotValues[c.id] ?? {} })),
    [
      availablePacks,
      selectedOpeningIds,
      openingSlotValues,
      packOpeningComponents,
    ],
  );

  const history = useMemo(
    () =>
      messages.map((message) => ({
        role: message.role as "user" | "assistant",
        content: message.parts
          .filter((part) => part.type === "text")
          .map((part) => part.text)
          .join(""),
      })),
    [messages],
  );

  const characterMeta = useMemo(
    () => ({
      id: characterId ?? "sandbox",
      name: previewName,
      avatarUrl: draft.avatarUrl || null,
      tags: draft.tags,
      bio: draft.bio || null,
    }),
    [characterId, draft.avatarUrl, draft.bio, draft.tags, previewName],
  );

  useEffect(() => {
    setMessages((prev) => {
      // Drop every existing sample message, then re-inject the current set.
      // (Simpler than diffing and behaves correctly when a rule is renamed or
      // its targetText edited live.)
      const cleaned = prev.filter(
        (message) => !message.id.startsWith(SANDBOX_SAMPLE_PREFIX),
      );
      if (sandboxSamples.length === 0) return cleaned;
      return [
        ...cleaned,
        ...sandboxSamples.map(
          (s) =>
            ({
              id: s.id,
              role: "assistant" as const,
              parts: [{ type: "text" as const, text: s.text }],
            }) as UIMessage,
        ),
      ];
    });
  }, [sandboxSamples]);

  function updateMessage(id: string, text: string) {
    setMessages((prev) =>
      prev.map((message) =>
        message.id === id
          ? { ...message, parts: [{ type: "text", text }] }
          : message,
      ),
    );
  }

  function submitInput() {
    const text = input.trim();
    if (!text) return;
    setMessages((prev) => [
      ...prev,
      {
        id: `sandbox-user-${Date.now()}`,
        role: "user",
        parts: [{ type: "text", text }],
      },
    ]);
    setInput("");
  }

  function onHostSendMessage(text: string) {
    if (!text.trim()) return;
    setMessages((prev) => [
      ...prev,
      {
        id: `sandbox-host-${Date.now()}`,
        role: "user",
        parts: [{ type: "text", text }],
      },
    ]);
  }

  return (
    <aside className="order-2 min-w-0 self-start">
      <section
        className={`${sandboxPanelCls} xl:min-h-[900px]`}
        data-character-css="sandbox"
      >
        {sandboxCss && (
          // biome-ignore lint/security/noDangerouslySetInnerHtml: pre-sanitized + scope-prefixed by sanitizeAndScopeCss
          <style dangerouslySetInnerHTML={{ __html: sandboxCss }} />
        )}

        <div className="relative flex h-[560px] min-h-[440px] flex-col overflow-hidden rounded-[var(--radius-md)] border border-border-subtle md:h-[760px] md:min-h-[600px]">
          <ChatStage
            stageBg={
              draft.coverImageUrl?.trim() || draft.avatarUrl?.trim() || null
            }
            header={
              <>
                <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-solid">
                  {draft.avatarUrl?.trim() ? (
                    // biome-ignore lint/performance/noImgElement: external URLs, no remote-host pattern set yet
                    <img
                      src={draft.avatarUrl}
                      alt={previewName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="font-display-zh text-lg text-text-muted">
                      {firstChar(previewName)}
                    </span>
                  )}
                </span>
                <div className="flex flex-1 flex-col gap-[2px]">
                  <p className="font-mono text-xs uppercase tracking-[0.25em] text-text-muted">
                    {t.sandboxEyebrow}
                  </p>
                  <h2 className="font-display-zh text-xl text-text-primary">
                    {previewName}
                  </h2>
                </div>
                <span className="rounded-[var(--radius-pill)] border border-border-subtle px-[var(--space-sm)] py-[2px] text-xs text-text-muted">
                  {rules.length}
                  {dict.packs.ruleCountSuffix}
                </span>
                {characterId &&
                  sandboxPacks.length > 0 &&
                  sandboxPacks[0].pack.ownerUserId === currentUserId && (
                    <Link
                      href={`/packs/${sandboxPacks[0].pack.id}/studio?returnTo=/characters/${characterId}/edit`}
                      className="rounded-[var(--radius-sm)] border border-accent-primary/40 bg-accent-primary/10 px-[var(--space-md)] py-[var(--space-xs)] text-xs text-accent-primary transition-colors hover:bg-accent-primary/20"
                    >
                      {dict.characterDetail.regexButton}
                    </Link>
                  )}
              </>
            }
            messages={[
              ...(activeOpeningComponents.length > 0
                ? [
                    <OpeningSlot
                      key="opening-slot"
                      components={activeOpeningComponents}
                      history={history}
                      character={characterMeta}
                      userName={t.sandboxPreviewUserName}
                      globalCss={sandboxCss}
                      onSendMessage={onHostSendMessage}
                    />,
                  ]
                : []),
              ...messages.map((message) => (
                <EditableSandboxMessage
                  key={message.id}
                  message={message}
                  rules={rules}
                  history={history}
                  character={characterMeta}
                  dict={dict}
                  userName={t.sandboxPreviewUserName}
                  onChange={updateMessage}
                  onHostSendMessage={onHostSendMessage}
                />
              )),
            ]}
            input={
              <div
                id="nj_chat_input_container"
                className="relative z-20 border-t border-border-subtle bg-bg-elevated px-[var(--space-md)] py-[var(--space-sm)]"
              >
                {/* 结构对齐生产 ChatRoom：外框 #nj_chat_input_box 包 textarea +
                    发送按钮，让 studio 预览里创作者的输入框美化所见即所得。 */}
                <div
                  id="nj_chat_input_box"
                  className="mx-auto flex w-full max-w-[640px] items-stretch rounded-[var(--radius-md)] border border-border-subtle bg-surface-glass transition-colors focus-within:border-border-strong"
                >
                  <textarea
                    id="nj_chat_input_textarea"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        submitInput();
                      }
                    }}
                    placeholder={t.sandboxInputPlaceholder}
                    rows={2}
                    className="min-w-0 flex-1 resize-none border-0 bg-transparent px-[var(--space-md)] py-[var(--space-sm)] font-body-zh text-base leading-relaxed text-text-primary outline-none"
                  />
                  <button
                    id="nj_chat_send_button"
                    type="button"
                    onClick={submitInput}
                    disabled={!input.trim()}
                    className="inline-flex shrink-0 items-center px-[var(--space-md)] text-sm font-semibold text-text-muted transition-colors hover:text-accent-primary disabled:opacity-50"
                  >
                    {dict.chat.sendButton}
                  </button>
                </div>
              </div>
            }
          />
        </div>

        <p className="text-xs leading-relaxed text-text-muted">
          {t.sandboxNote}
        </p>
      </section>
    </aside>
  );
}

function EditableSandboxMessage({
  message,
  rules,
  history,
  character,
  dict,
  userName,
  onChange,
  onHostSendMessage,
}: {
  message: UIMessage;
  rules: RegexRule[];
  history: Array<{ role: "user" | "assistant"; content: string }>;
  character: {
    id: string;
    name: string;
    avatarUrl: string | null;
    tags: string[];
    bio: string | null;
  };
  dict: Dict;
  userName: string;
  onChange: (id: string, text: string) => void;
  onHostSendMessage: (text: string) => void;
}) {
  const text = message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");

  return (
    <div className="group flex flex-col gap-[var(--space-xs)]">
      <MessageBubble
        message={message}
        rules={rules}
        isStreaming={false}
        history={history}
        character={character}
        userName={userName}
        userAvatarUrl={null}
        onSendMessage={onHostSendMessage}
      />
      <details className="self-end text-xs text-text-muted">
        <summary className="cursor-pointer select-none rounded-[var(--radius-sm)] border border-border-subtle px-[var(--space-sm)] py-[2px] transition-colors hover:border-border-strong hover:text-text-primary">
          {dict.characterForm.sandboxEditSample}
        </summary>
        <textarea
          value={text}
          onChange={(e) => onChange(message.id, e.target.value)}
          rows={4}
          className="mt-[var(--space-xs)] w-full min-w-[min(520px,70vw)] rounded-[var(--radius-sm)] border border-border-subtle bg-surface-solid p-[var(--space-sm)] font-mono text-xs leading-relaxed text-text-primary outline-none focus:border-border-strong"
        />
      </details>
    </div>
  );
}

function buildSandboxMessages(
  draft: DraftCharacter,
  t: CharacterFormCopy,
): UIMessage[] {
  const name = draft.name.trim() || t.sandboxUntitledName;
  const openingMessages = extractOpeningMessages(draft.opening);
  const firstOpening =
    openingMessages[0] ?? t.sandboxOpeningFallback.replace("{name}", name);
  const secondOpening = openingMessages[1] ?? t.sandboxSecondOpening;

  return [
    {
      id: "sandbox-opening",
      role: "assistant",
      parts: [{ type: "text", text: firstOpening }],
    },
    {
      id: "sandbox-user-sample",
      role: "user",
      parts: [{ type: "text", text: t.sandboxUserMessage }],
    },
    {
      id: "sandbox-ai-sample",
      role: "assistant",
      parts: [{ type: "text", text: secondOpening }],
    },
  ];
}
