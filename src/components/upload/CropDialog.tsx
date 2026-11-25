"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import Cropper from "react-easy-crop";
import type { CropArea } from "@/components/upload/cropper";

/**
 * 通用图片裁切对话框 —— CharacterForm 头像/封面、UserAvatarUpload 头像共用。
 *
 * Session state 由调用方持有（同一棵组件树里只可能开一个对话框，不需要全局
 * store）。本组件只负责渲染 Cropper UI 和透传交互回调，不知道裁切结果将被
 * 怎么用 —— 调用方拿到 `croppedAreaPixels` 自己 cropImage + 上传。
 *
 * 文案走 props 注入而不是直接读 dict —— 避免给共用组件挂死的 i18n 路径，
 * 调用方按自己 namespace 传进来。
 */

export interface CropSession {
  open: boolean;
  sourceUrl: string;
  file: File;
  aspect: number;
  crop: { x: number; y: number };
  zoom: number;
  croppedAreaPixels: CropArea | null;
}

export interface CropDialogCopy {
  title: string;
  hint: string;
  zoom: string;
  reset: string;
  cancel: string;
  confirm: string;
}

const imageUploadButtonCls =
  "inline-flex items-center justify-center gap-[var(--space-xs)] rounded-[var(--radius-sm)] border border-border-subtle px-[var(--space-md)] py-[var(--space-sm)] text-sm text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-60";

export function CropDialog({
  session,
  copy,
  onClose,
  onConfirm,
  onCropChange,
  onZoomChange,
  onCropComplete,
}: {
  session: CropSession;
  copy: CropDialogCopy;
  onClose: () => void;
  onConfirm: () => void;
  onCropChange: (crop: { x: number; y: number }) => void;
  onZoomChange: (zoom: number) => void;
  onCropComplete: (croppedAreaPixels: CropArea) => void;
}) {
  return (
    <Dialog.Root
      open={session.open}
      onOpenChange={(open) => !open && onClose()}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-bg-base/85 backdrop-blur-md" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,760px)] -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius-md)] border border-border-strong bg-surface-solid p-[var(--space-lg)] shadow-[0_30px_90px_rgba(0,0,0,0.5)]">
          <div className="flex items-start justify-between gap-[var(--space-md)]">
            <div>
              <Dialog.Title className="font-display-zh text-2xl text-text-primary">
                {copy.title}
              </Dialog.Title>
              <p className="mt-[var(--space-xs)] text-sm text-text-muted">
                {copy.hint}
              </p>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className={imageUploadButtonCls}
                onClick={onClose}
              >
                <X width={14} height={14} strokeWidth={1.8} />
                {copy.cancel}
              </button>
            </Dialog.Close>
          </div>

          <div className="mt-[var(--space-lg)] grid gap-[var(--space-md)]">
            <div className="relative h-[min(60dvh,460px)] overflow-hidden rounded-[var(--radius-md)] border border-border-subtle bg-bg-base">
              <Cropper
                image={session.sourceUrl}
                crop={session.crop}
                zoom={session.zoom}
                aspect={session.aspect}
                minZoom={1}
                maxZoom={3}
                zoomSpeed={0.08}
                showGrid
                onCropChange={onCropChange}
                onZoomChange={onZoomChange}
                onCropComplete={(_, croppedAreaPixels) => {
                  // 通过回调走调用方的 setState,而不是原地 mutate session ——
                  // 否则 confirmCrop 读到的 React state 里 croppedAreaPixels 可能仍是 null。
                  onCropComplete(croppedAreaPixels);
                }}
              />
            </div>

            <div className="flex items-center gap-[var(--space-md)]">
              <span className="shrink-0 text-sm text-text-secondary">
                {copy.zoom}
              </span>
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={session.zoom}
                onChange={(e) => onZoomChange(Number(e.target.value))}
                className="w-full"
              />
            </div>

            <div className="flex flex-wrap justify-end gap-[var(--space-sm)]">
              <button
                type="button"
                className={imageUploadButtonCls}
                onClick={() => {
                  onCropChange({ x: 0, y: 0 });
                  onZoomChange(1);
                }}
              >
                {copy.reset}
              </button>
              <button
                type="button"
                className="rounded-[var(--radius-sm)] bg-accent-primary px-[var(--space-md)] py-[var(--space-sm)] text-sm font-semibold text-text-on-accent transition-colors hover:bg-accent-primary-hover"
                onClick={onConfirm}
              >
                {copy.confirm}
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
