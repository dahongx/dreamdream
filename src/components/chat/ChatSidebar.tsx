import { ChatSidebarContent } from "@/components/chat/ChatSidebarContent";
import { getRequestDict } from "@/i18n/server";
import type { RecentSessionListItem } from "@/lib/sessions/queries";

interface Props {
  sessions: RecentSessionListItem[];
  activeCharacterId: string;
}

/**
 * 桌面端聊天会话侧栏（>= md）。手机走 ChatSessionsDrawer（从 ChatRoom 自带）。
 *
 * 现在一个角色 = 一段持续对话，所以列表本质是「聊过的角色」。
 *
 * Selector contract: 内层 `#nj_chat_sidebar` 由 ChatSidebarContent 提供，creator
 * CSS 在桌面 / 手机抽屉两处都能命中同一个 id。`.nj_chat_sidebar_item +
 * data-active` 同理。
 */
export async function ChatSidebar({ sessions, activeCharacterId }: Props) {
  const dict = await getRequestDict();
  return (
    <aside className="hidden h-full w-[260px] shrink-0 flex-col border-r border-border-subtle bg-bg-elevated md:flex">
      <ChatSidebarContent
        sessions={sessions}
        activeCharacterId={activeCharacterId}
        titleText={dict.chat.sidebarTitle}
        emptyText={dict.chat.sidebarEmpty}
        unavailableText={dict.chat.sidebarUnavailable}
      />
    </aside>
  );
}
