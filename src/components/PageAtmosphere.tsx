import type { ReactNode } from "react";

interface PageAtmosphereProps {
  children: ReactNode;
  className?: string;
}

/**
 * 普通平台页共用的氛围底层。
 *
 * 聊天页和角色详情页不使用这个壳层：它们各自拥有沉浸画布和作者注入
 * 的小剧场 / CSS，避免平台装饰覆盖创作者的视觉作品。
 */
export function PageAtmosphere({
  children,
  className = "",
}: PageAtmosphereProps) {
  return (
    <div className={`page-atmosphere ${className}`.trim()}>
      <span aria-hidden="true" className="page-atmosphere-wash" />
      <span aria-hidden="true" className="page-atmosphere-dust" />
      <div className="page-atmosphere-content">{children}</div>
    </div>
  );
}
