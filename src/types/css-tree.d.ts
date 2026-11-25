/** The CSS-tree APIs used by the bounded native-font adapter. */
declare module "css-tree" {
  export interface CssNode {
    type: string;
    name?: string;
    property?: string;
    value?: string | CssNode;
  }
  export function parse(
    css: string,
    options?: { context?: "stylesheet" | "value" },
  ): CssNode;
  export function generate(node: CssNode): string;
  export function walk(node: CssNode, visitor: (node: CssNode) => void): void;
}
