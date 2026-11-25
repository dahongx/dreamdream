"use client";

import { useMemo, useState } from "react";
import { OpeningErrorBoundary } from "@/components/characters/OpeningErrorBoundary";
import { FloatingLayer } from "@/components/chat/FloatingLayer";
import { FloatingSlot } from "@/components/chat/FloatingSlot";
import { OpeningSlot } from "@/components/chat/OpeningSlot";
import { useI18n } from "@/i18n/client";
import type { OpeningComponentWithSlots } from "@/lib/opening/queries";
import { sanitizeAndScopeCss } from "@/lib/styling/whitelist";

/**
 * 角色详情页的「播放厅」—— 进聊天前先展示角色的开场组件(小剧场),
 * 让访客了解角色氛围。默认展开,可点标题折叠/收起。
 *
 * 复用聊天页的 OpeningSlot 渲染(artifact→沙箱 iframe / 否则 sanitize HTML),
 * 视觉与真实聊天里的开场一致。预览语境:history 空、onSendMessage no-op
 * (详情页不真发消息)。
 */
interface Props {
  title: string;
  collapseLabel: string;
  expandLabel: string;
  components: OpeningComponentWithSlots[];
  globalCss: string;
  characterId: string;
  characterName: string;
  previewUserName: string;
}

export function CharacterReelSection({
  title,
  collapseLabel,
  expandLabel,
  components,
  globalCss,
  characterId,
  characterName,
  previewUserName,
}: Props) {
  const [open, setOpen] = useState(true);
  const { dict } = useI18n();

  // sanitize 轨（非 artifact 的开场组件走 MessageRenderer）此前在详情页
  // 完全没接皮肤 —— chat 页有页级 [data-character-css=characterId] wrapper
  // + <style>，详情页没有对应物。这里补上：scope 用 "opening"，与
  // OpeningSlot 注入 iframe 的皮肤同一 scope id。iframe 是独立 document
  // 不受此 wrapper 影响（它们的宿主属性由 buildIframeSrcdoc 挂在 body 上）。
  const scopedCss = useMemo(
    () => (globalCss ? sanitizeAndScopeCss(globalCss, "opening").css : ""),
    [globalCss],
  );

  const reelCharacter = useMemo(
    () => ({
      id: characterId,
      name: characterName,
      avatarUrl: null,
      tags: [],
      bio: null,
    }),
    [characterId, characterName],
  );

  if (components.length === 0) return null;

  return (
    /* glass-card 容器让播放厅与前后区块同一体系（之前无背景无边框，
       视觉上是"悬空"的一段）。容器本身保持素净 —— 这里面是创作者皮肤
       的橱窗，chrome 不抢戏。static：整卡不可点，不该有 hover 上浮。 */
    <section className="glass-card glass-card-static overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-[var(--space-sm)] px-[var(--space-md)] py-[var(--space-sm)] text-left transition-colors hover:bg-surface-glass/60"
      >
        <span className="flex items-center gap-[var(--space-sm)]">
          {/* 折叠指示用主 accent；珍贵强调金只留给徽章 / 特别标记。 */}
          <span
            className={`font-mono text-xs uppercase tracking-[0.2em] text-accent-primary transition-transform duration-[var(--dur-short)] ${open ? "rotate-90" : ""}`}
          >
            ▶
          </span>
          <span className="font-display-zh text-lg text-text-primary">
            {title}
          </span>
        </span>
        <span className="text-xs text-text-muted">
          {open ? collapseLabel : expandLabel}
        </span>
      </button>

      {open && (
        /* rise-in：展开时内容柔和浮现（收起瞬时 —— 高度过渡需要
           overflow 裁切，会剪掉创作者组件的溢出视觉，不做）。 */
        <div
          className="rise-in border-t border-border-subtle p-[var(--space-md)]"
          data-character-css="opening"
        >
          {scopedCss && (
            // biome-ignore lint/security/noDangerouslySetInnerHtml: pre-sanitized + scope-prefixed by sanitizeAndScopeCss
            <style dangerouslySetInnerHTML={{ __html: scopedCss }} />
          )}
          {/* 崩溃兜底：个别坏卡的开场组件渲染抛错时，只降级这一块，
              不连累整个详情页（编辑/删除/滑动/评论照常）。 */}
          <OpeningErrorBoundary
            fallbackLabel={dict.characterDetail.reelLoadFailed}
          >
            <OpeningSlot
              components={components}
              history={[]}
              character={reelCharacter}
              userName={previewUserName}
              globalCss={globalCss}
              onSendMessage={() => {}}
            />
          </OpeningErrorBoundary>
        </div>
      )}

      {/* 悬浮件（灵动岛）—— 从演绎内容里拆出来，浮在整个演绎室区块上，不随
          详情页滚动。scope 到本 section（relative），不会浮到站点导航栏上。
          与聊天页共用 FloatingLayer / FloatingSlot，只是挂载容器不同。 */}
      {open && (
        <OpeningErrorBoundary
          fallbackLabel={dict.characterDetail.reelLoadFailed}
        >
          <FloatingLayer>
            <FloatingSlot
              components={components}
              character={reelCharacter}
              userName={previewUserName}
              globalCss={globalCss}
              onSendMessage={() => {}}
            />
          </FloatingLayer>
        </OpeningErrorBoundary>
      )}
    </section>
  );
}
