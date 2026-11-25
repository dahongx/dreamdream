import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * /packs — 重定向到 /create?tab=packs
 * 保留此路由以兼容旧链接和书签
 */
interface Props {
  searchParams: Promise<{ tab?: string; q?: string }>;
}

export default async function PacksPage({ searchParams }: Props) {
  const sp = await searchParams;
  const subtab = sp.tab || "mine";
  const q = sp.q || "";
  const query = q ? `&q=${encodeURIComponent(q)}` : "";
  redirect(`/create?tab=packs&subtab=${subtab}${query}`);
}
