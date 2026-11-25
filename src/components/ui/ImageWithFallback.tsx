"use client";

import Image from "next/image";
import { type ReactNode, useState } from "react";
import { toLocalOptimizableMediaSrc } from "@/lib/media/optimizable-src";

/**
 * 外链图片 + 加载失败兜底 —— 全站封面/头像统一用这个。
 *
 * 背景：平台图片全是外链 <img>（无 remote-host pattern），坏图此前直接
 * 渲染成裸 alt 文字浮在暗底上。fallback 由调用方传（封面用衬线首字大字、
 * 头像用小号首字），保持各处兜底形状与占位风格一致。
 *
 * client 组件（onError 需要），server 组件可直接引用；fallback JSX 从
 * server 传入是合法的可序列化 prop。
 */
interface Props {
  src: string;
  alt: string;
  className?: string;
  loading?: "eager" | "lazy";
  decoding?: "async" | "auto" | "sync";
  fetchPriority?: "high" | "low" | "auto";
  fill?: boolean;
  sizes?: string;
  preload?: boolean;
  ariaHidden?: boolean;
  /** 加载失败时渲染的占位（通常是首字 fallback） */
  fallback: ReactNode;
}

function shouldUseNextImage(src: string): boolean {
  return src.startsWith("/") && !src.startsWith("/api/media/");
}

export function ImageWithFallback({
  src,
  alt,
  className,
  loading,
  decoding,
  fetchPriority,
  fill,
  sizes,
  preload,
  ariaHidden,
  fallback,
}: Props) {
  const [failed, setFailed] = useState(false);
  if (failed) return <>{fallback}</>;
  const normalizedSrc = toLocalOptimizableMediaSrc(src);
  if (fill && shouldUseNextImage(normalizedSrc)) {
    return (
      <Image
        src={normalizedSrc}
        alt={alt}
        aria-hidden={ariaHidden}
        className={className}
        fill
        sizes={sizes}
        loading={preload ? undefined : loading}
        decoding={decoding}
        fetchPriority={fetchPriority}
        preload={preload}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    // biome-ignore lint/performance/noImgElement: external URLs, no remote-host pattern set yet
    <img
      src={normalizedSrc}
      alt={alt}
      aria-hidden={ariaHidden}
      className={className}
      loading={loading}
      decoding={decoding}
      fetchPriority={fetchPriority}
      onError={() => setFailed(true)}
    />
  );
}
