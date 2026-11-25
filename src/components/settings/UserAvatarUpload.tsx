"use client";

import { Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { CropDialog, type CropSession } from "@/components/upload/CropDialog";
import {
  cropImage,
  guessExtension,
  replaceExtension,
} from "@/components/upload/cropper";
import { useI18n } from "@/i18n/client";

interface Props {
  initialValue: string;
  fallbackChar: string;
}

/**
 * 设置页头像上传 —— 复用 /api/uploads/image，scope=user_avatar 走 R2 的
 * users/$uid/avatar/ 前缀。复用 src/components/upload 里的 CropDialog +
 * cropImage：1:1 裁切再上传，跟角色卡头像同套体验。
 *
 * 输出一个 hidden `avatarUrl` 字段让 SettingsForm 用 useActionState 提交时
 * 一起发出去。`fallbackChar` 给没头像时的兜底首字符。
 */
export function UserAvatarUpload({ initialValue, fallbackChar }: Props) {
  const { dict } = useI18n();
  const t = dict.settings;
  const cropCopy = dict.characterForm;
  const [value, setValue] = useState(initialValue);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cropSession, setCropSession] = useState<CropSession | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function upload(file: File) {
    setIsUploading(true);
    setError(null);
    const body = new FormData();
    body.set("file", file);
    body.set("scope", "user_avatar");

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
      setValue(payload.publicUrl);
    } catch {
      setError(t.avatarUploadFailed);
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function openCropper(file: File) {
    setError(null);
    const sourceUrl = URL.createObjectURL(file);
    setCropSession({
      open: true,
      sourceUrl,
      file,
      aspect: 1,
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
      setError(t.avatarUploadFailed);
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
    } catch (err) {
      setError(err instanceof Error ? err.message : t.avatarUploadFailed);
    }
  }

  return (
    <div>
      <input type="hidden" name="avatarUrl" value={value} />
      <span className="mb-[var(--space-xs)] block text-sm text-text-secondary">
        {t.avatarLabel}
      </span>
      <div className="flex items-center gap-[var(--space-md)]">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isUploading}
          aria-label={value ? t.replaceAvatar : t.uploadAvatar}
          className="group relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border-subtle bg-surface-solid transition-colors hover:border-border-strong disabled:opacity-60"
        >
          {value ? (
            // biome-ignore lint/performance/noImgElement: uploaded R2 URLs are user-owned public assets
            <img src={value} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="font-display-zh text-3xl text-text-muted">
              {fallbackChar || "?"}
            </span>
          )}
          <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-[var(--space-xs)] bg-bg-base/75 py-[2px] text-xs text-text-secondary opacity-100 backdrop-blur-sm md:opacity-0 md:transition-opacity md:group-hover:opacity-100">
            <Upload width={12} height={12} strokeWidth={1.6} />
          </span>
        </button>

        <div className="flex min-w-0 flex-col gap-[var(--space-xs)]">
          <p className="text-xs text-text-muted">{t.avatarHint}</p>
          <div className="flex flex-wrap items-center gap-[var(--space-sm)]">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={isUploading}
              className="rounded-[var(--radius-sm)] border border-border-subtle px-[var(--space-md)] py-[var(--space-xs)] text-xs text-text-muted transition-colors hover:border-border-strong hover:text-text-primary disabled:opacity-60"
            >
              {value ? t.replaceAvatar : t.uploadAvatar}
            </button>
            {value && !isUploading && (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setValue("");
                }}
                className="inline-flex items-center gap-[var(--space-xs)] rounded-[var(--radius-sm)] border border-border-subtle px-[var(--space-md)] py-[var(--space-xs)] text-xs text-text-muted transition-colors hover:border-semantic-error/40 hover:text-semantic-error"
              >
                <X width={12} height={12} strokeWidth={1.8} />
                {t.removeAvatar}
              </button>
            )}
            {isUploading && (
              <span className="inline-flex items-center gap-[var(--space-xs)] text-xs text-text-secondary">
                {t.avatarUploading}
                <span className="flex gap-[2px]" aria-hidden="true">
                  <span className="h-1 w-1 animate-pulse rounded-full bg-accent-primary" />
                  <span className="h-1 w-1 animate-pulse rounded-full bg-accent-primary [animation-delay:120ms]" />
                  <span className="h-1 w-1 animate-pulse rounded-full bg-accent-primary [animation-delay:240ms]" />
                </span>
              </span>
            )}
          </div>
          {error && <p className="text-xs text-semantic-error">{error}</p>}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) openCropper(file);
        }}
      />

      {cropSession && (
        <CropDialog
          session={cropSession}
          copy={{
            title: cropCopy.imageCropTitle,
            hint: cropCopy.imageCropHint,
            zoom: cropCopy.imageCropZoom,
            reset: cropCopy.imageCropReset,
            cancel: cropCopy.imageCropCancel,
            confirm: cropCopy.imageCropConfirm,
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
