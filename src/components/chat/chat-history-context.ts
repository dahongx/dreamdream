"use client";

import { createContext, type RefObject } from "react";
import type { HostHistoryEntry } from "@/components/regex/RegexIframe";

/**
 * 聊天页向 iframe Host API 提供「实时对话历史」的通道。
 *
 * 为什么是 ref 而不是直接把 history 数组灌 props：流式期间每个 chunk 都会
 * 产生新的 history 数组引用，若作为 props 逐层下发，会击穿 MessageBubble /
 * RegexIframe 的 memo —— 每个 chunk 全部气泡重渲染一遍，正是「聊得越多越卡」
 * 的主因之一。ref 对象自身引用永远稳定（Provider value 不变、消费方不因它
 * 重渲染），而 getHistory() RPC 是拉模式，调用瞬间读 ref.current 即拿到最新值。
 *
 * 预览场景（CharacterForm 沙盒 / PackPreview / PreviewCanvas / 角色详情
 * ReelSection）没有 Provider —— RegexIframe 落回自己的 history prop。
 */
export const ChatHistoryContext = createContext<RefObject<
  HostHistoryEntry[]
> | null>(null);
