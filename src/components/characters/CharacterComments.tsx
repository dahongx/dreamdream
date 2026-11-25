"use client";

import { Heart, MessageCircle, Send, Trash2 } from "lucide-react";
import Link from "next/link";
import {
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useDialog } from "@/components/ui/DialogProvider";
import { ImageWithFallback } from "@/components/ui/ImageWithFallback";
import { useI18n } from "@/i18n/client";
import type { Locale } from "@/i18n/config";
import {
  addCharacterCommentAction,
  type CommentActionResult,
  deleteCharacterCommentAction,
  toggleCharacterCommentLikeAction,
} from "@/lib/characters/comment-actions";
import type {
  CharacterCommentListItem,
  CharacterCommentSort,
  CharacterCommentsPage,
} from "@/lib/characters/comments";
import { firstChar } from "@/lib/util/first-char";

interface Props {
  characterId: string;
  commentsPage: CharacterCommentsPage;
  canModerate: boolean;
  commentsPath: string;
}

interface CommentFormProps {
  characterId: string;
  parentId: string | null;
  placeholder: string;
  submitLabel: string;
  compact?: boolean;
  onSuccess?: () => void;
}

function formatCommentTime(value: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function buildCommentsHref(
  commentsPath: string,
  page: number,
  sort: CharacterCommentSort,
): string {
  const params = new URLSearchParams();
  if (page > 1) params.set("commentsPage", String(page));
  if (sort !== "latest") params.set("commentsSort", sort);
  const query = params.toString();
  return query ? `${commentsPath}?${query}` : commentsPath;
}

function Avatar({
  name,
  avatarUrl,
}: {
  name: string;
  avatarUrl: string | null;
}) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-solid font-display-zh text-sm text-text-secondary ring-1 ring-border-subtle">
      {avatarUrl ? (
        <ImageWithFallback
          src={avatarUrl}
          alt={name}
          className="h-full w-full object-cover"
          fallback={firstChar(name)}
        />
      ) : (
        firstChar(name)
      )}
    </span>
  );
}

function CommentForm({
  characterId,
  parentId,
  placeholder,
  submitLabel,
  compact = false,
  onSuccess,
}: CommentFormProps) {
  const { dict } = useI18n();
  const t = dict.characterDetail.comments;
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = useActionState<
    CommentActionResult | null,
    FormData
  >(addCharacterCommentAction, null);
  const submitFailed = state && !state.ok;

  useEffect(() => {
    if (state?.ok !== true) return;
    formRef.current?.reset();
    onSuccess?.();
  }, [state, onSuccess]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className={
        compact
          ? "flex items-end gap-[var(--space-sm)]"
          : "rounded-[var(--radius-md)] border border-border-subtle bg-surface-glass p-[var(--space-md)]"
      }
    >
      <input type="hidden" name="characterId" value={characterId} />
      <input type="hidden" name="parentId" value={parentId ?? ""} />
      <div
        className={
          compact ? "min-w-0 flex-1" : "flex flex-col gap-[var(--space-sm)]"
        }
      >
        <textarea
          name="body"
          rows={1}
          maxLength={800}
          placeholder={placeholder}
          className="w-full resize-none rounded-[var(--radius-sm)] border border-border-subtle bg-bg-elevated px-[var(--space-md)] py-[var(--space-sm)] font-body-zh text-sm leading-relaxed text-text-primary outline-none transition-colors placeholder:text-text-disabled focus:border-border-strong"
        />
        {!compact && (
          <div
            className={`flex items-center gap-[var(--space-sm)] ${submitFailed ? "justify-between" : "justify-end"}`}
          >
            {submitFailed && (
              <p className="text-xs text-semantic-error" role="alert">
                {t.submitFailed}
              </p>
            )}
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-[var(--space-xs)] rounded-[var(--radius-sm)] bg-accent-primary px-[var(--space-md)] py-[var(--space-xs)] text-sm font-semibold text-text-on-accent transition-colors hover:bg-accent-primary-hover disabled:opacity-60"
            >
              <Send size={14} aria-hidden="true" />
              {isPending ? t.submitting : submitLabel}
            </button>
          </div>
        )}
      </div>
      {compact && (
        <button
          type="submit"
          disabled={isPending}
          title={submitLabel}
          aria-label={submitLabel}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-primary text-text-on-accent transition-colors hover:bg-accent-primary-hover disabled:opacity-60"
        >
          <Send size={15} aria-hidden="true" />
        </button>
      )}
    </form>
  );
}

function LikeButton({
  characterId,
  comment,
}: {
  characterId: string;
  comment: CharacterCommentListItem;
}) {
  const { dict } = useI18n();
  const t = dict.characterDetail.comments;
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    setError(null);
    startTransition(async () => {
      const result = await toggleCharacterCommentLikeAction(
        comment.id,
        characterId,
        !comment.likedByMe,
      );
      if (!result.ok) setError(t.actionFailed);
    });
  }

  return (
    <span className="inline-flex items-center gap-[var(--space-xs)]">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={comment.likedByMe}
        className={`inline-flex items-center gap-[var(--space-xs)] rounded-[var(--radius-pill)] border px-[var(--space-sm)] py-[2px] text-xs transition-colors disabled:opacity-60 ${
          comment.likedByMe
            ? "border-accent-secondary/40 bg-accent-secondary/10 text-accent-secondary"
            : "border-border-subtle text-text-muted hover:border-border-strong hover:text-text-primary"
        }`}
      >
        <Heart
          size={13}
          aria-hidden="true"
          className={comment.likedByMe ? "fill-current" : undefined}
        />
        {comment.likeCount}
      </button>
      {error && <span className="text-xs text-semantic-error">{error}</span>}
    </span>
  );
}

function DeleteCommentButton({
  characterId,
  commentId,
}: {
  characterId: string;
  commentId: string;
}) {
  const { dict } = useI18n();
  const dialog = useDialog();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const t = dict.characterDetail.comments;

  async function onDelete() {
    const ok = await dialog.confirm({ body: t.deleteConfirm, danger: true });
    if (!ok) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteCharacterCommentAction(commentId, characterId);
      if (!result.ok) setError(t.actionFailed);
    });
  }

  return (
    <span className="inline-flex items-center gap-[var(--space-xs)]">
      <button
        type="button"
        onClick={onDelete}
        disabled={pending}
        className="inline-flex items-center gap-[var(--space-xs)] rounded-[var(--radius-pill)] border border-semantic-error/30 px-[var(--space-sm)] py-[2px] text-xs text-semantic-error transition-colors hover:bg-semantic-error/10 disabled:opacity-60"
      >
        <Trash2 size={13} aria-hidden="true" />
        {t.delete}
      </button>
      {error && <span className="text-xs text-semantic-error">{error}</span>}
    </span>
  );
}

function CommentItem({
  characterId,
  comment,
  canModerate,
  nested = false,
}: {
  characterId: string;
  comment: CharacterCommentListItem;
  canModerate: boolean;
  nested?: boolean;
}) {
  const { dict, locale } = useI18n();
  const t = dict.characterDetail.comments;
  const [replying, setReplying] = useState(false);

  return (
    <article
      className={
        nested
          ? "border-l border-border-subtle pl-[var(--space-md)]"
          : "rounded-[var(--radius-md)] border border-border-subtle bg-surface-glass p-[var(--space-md)]"
      }
    >
      <div className="flex gap-[var(--space-sm)]">
        <Avatar
          name={comment.author.name}
          avatarUrl={comment.author.avatarUrl}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-[var(--space-xs)]">
            <p className="font-body-zh text-sm font-semibold text-text-primary">
              {comment.author.name}
            </p>
            {comment.author.isCreator && (
              <span className="rounded-[var(--radius-pill)] border border-accent-gold/35 px-[var(--space-sm)] py-[1px] text-[10px] text-accent-gold-soft">
                {t.creatorBadge}
              </span>
            )}
            <time
              className="text-xs text-text-muted"
              dateTime={comment.createdAt.toISOString()}
            >
              {formatCommentTime(comment.createdAt, locale)}
            </time>
          </div>
          <p className="mt-[var(--space-xs)] whitespace-pre-wrap break-words font-body-zh text-sm leading-relaxed text-text-primary">
            {comment.body}
          </p>
          <div className="mt-[var(--space-sm)] flex flex-wrap items-center gap-[var(--space-sm)]">
            <LikeButton characterId={characterId} comment={comment} />
            <button
              type="button"
              onClick={() => setReplying((value) => !value)}
              className="inline-flex items-center gap-[var(--space-xs)] rounded-[var(--radius-pill)] border border-border-subtle px-[var(--space-sm)] py-[2px] text-xs text-text-muted transition-colors hover:border-border-strong hover:text-text-primary"
            >
              <MessageCircle size={13} aria-hidden="true" />
              {t.reply}
            </button>
            {canModerate && (
              <DeleteCommentButton
                characterId={characterId}
                commentId={comment.id}
              />
            )}
          </div>
          {replying && (
            <div className="mt-[var(--space-sm)]">
              <CommentForm
                characterId={characterId}
                parentId={comment.id}
                compact
                placeholder={t.replyTo.replace("{name}", comment.author.name)}
                submitLabel={t.reply}
                onSuccess={() => setReplying(false)}
              />
            </div>
          )}
          {comment.replies.length > 0 && (
            <div className="mt-[var(--space-md)] flex flex-col gap-[var(--space-md)]">
              {comment.replies.map((reply) => (
                <CommentItem
                  key={reply.id}
                  characterId={characterId}
                  comment={reply}
                  canModerate={canModerate}
                  nested
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

export function CharacterComments({
  characterId,
  commentsPage,
  canModerate,
  commentsPath,
}: Props) {
  const { dict } = useI18n();
  const t = dict.characterDetail.comments;
  const { comments, page, totalPages, sort } = commentsPage;
  const sortLatestHref = buildCommentsHref(commentsPath, 1, "latest");
  const sortTopHref = buildCommentsHref(commentsPath, 1, "likes");

  const pageLabel = useMemo(
    () =>
      t.pageLabel
        .replace("{page}", String(page))
        .replace("{total}", String(totalPages)),
    [page, t.pageLabel, totalPages],
  );

  return (
    <section className="glass-card glass-card-static flex min-h-[320px] flex-col overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-[var(--space-sm)] border-b border-border-subtle px-[var(--space-md)] py-[var(--space-sm)] md:px-[var(--space-lg)]">
        <div className="flex flex-wrap items-center gap-[var(--space-sm)]">
          <h2 className="font-body-zh text-sm font-semibold text-text-primary">
            {t.eyebrow}
          </h2>
          <span className="rounded-[var(--radius-pill)] border border-border-subtle px-[var(--space-sm)] py-[1px] text-xs text-text-muted">
            {commentsPage.totalRootCount}
          </span>
          <div className="inline-flex rounded-[var(--radius-pill)] border border-border-subtle bg-bg-elevated p-[2px]">
            <Link
              href={sortLatestHref}
              className={`rounded-[var(--radius-pill)] px-[var(--space-sm)] py-[1px] text-xs transition-colors ${
                sort === "latest"
                  ? "bg-accent-primary text-text-on-accent"
                  : "text-text-muted hover:text-text-primary"
              }`}
            >
              {t.sortLatest}
            </Link>
            <Link
              href={sortTopHref}
              className={`rounded-[var(--radius-pill)] px-[var(--space-sm)] py-[1px] text-xs transition-colors ${
                sort === "likes"
                  ? "bg-accent-primary text-text-on-accent"
                  : "text-text-muted hover:text-text-primary"
              }`}
            >
              {t.sortTop}
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-[var(--space-sm)] text-xs text-text-muted">
          <span>{pageLabel}</span>
          <div className="flex items-center gap-[var(--space-xs)]">
            <Link
              href={buildCommentsHref(
                commentsPath,
                Math.max(1, page - 1),
                sort,
              )}
              aria-disabled={page <= 1}
              className={`rounded-[var(--radius-sm)] border border-border-subtle px-[var(--space-sm)] py-[2px] transition-colors ${
                page <= 1
                  ? "pointer-events-none opacity-40"
                  : "hover:border-border-strong hover:text-text-primary"
              }`}
            >
              {t.prevPage}
            </Link>
            <Link
              href={buildCommentsHref(
                commentsPath,
                Math.min(totalPages, page + 1),
                sort,
              )}
              aria-disabled={page >= totalPages}
              className={`rounded-[var(--radius-sm)] border border-border-subtle px-[var(--space-sm)] py-[2px] transition-colors ${
                page >= totalPages
                  ? "pointer-events-none opacity-40"
                  : "hover:border-border-strong hover:text-text-primary"
              }`}
            >
              {t.nextPage}
            </Link>
          </div>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-[var(--space-md)] overflow-y-auto p-[var(--space-md)] md:p-[var(--space-lg)]">
        <CommentForm
          characterId={characterId}
          parentId={null}
          placeholder={t.placeholder}
          submitLabel={t.submit}
        />

        {comments.length > 0 ? (
          <div className="flex flex-col gap-[var(--space-md)]">
            {comments.map((comment) => (
              <CommentItem
                key={comment.id}
                characterId={characterId}
                comment={comment}
                canModerate={canModerate}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center rounded-[var(--radius-md)] border border-dashed border-border-subtle px-[var(--space-lg)] py-[var(--space-xl)] text-center">
            <p className="font-body-zh text-sm text-text-muted">{t.empty}</p>
          </div>
        )}
      </div>
    </section>
  );
}
