import { ExploreLoadingFallback } from "@/components/explore/ExploreLoadingFallback";
import { getRequestDict } from "@/i18n/server";

/**
 * 探索页段级 loading —— 之前全站只有根 loading，force-dynamic 下每次
 * 筛选/排序/搜索都把整个内容区换成 60vh 呼吸点，体感断裂。这里把
 * hero（纯静态文案）原样先画出来，网格用形状对位的骨架占位，导航时
 * 页面骨骼不动，只有卡片区在"呼吸"。
 */
export default async function ExploreLoading() {
  const dict = await getRequestDict();
  return <ExploreLoadingFallback dict={dict} />;
}
