import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * /mine — 重定向到 /create?tab=characters
 * 保留此路由以兼容旧链接和书签
 */
export default function MyLibraryPage() {
  redirect("/create?tab=characters");
}
