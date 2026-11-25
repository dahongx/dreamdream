/** Preserve stylesheet EOF boundaries when multiple public <style> elements are
 * combined. Browsers close unfinished blocks/comments at each stylesheet EOF;
 * concatenation must not let one author's broken tail swallow the next sheet.
 * This is structural recovery only, never a replacement for the CSS sanitizer. */
export function closeStyleBlockAtEof(css: string): string {
  const stack: string[] = [];
  let quote = "";
  let comment = false;
  for (let i = 0; i < css.length; i++) {
    const c = css[i], next = css[i + 1];
    if (comment) {
      if (c === "*" && next === "/") { comment = false; i++; }
      continue;
    }
    if (c === "\\") { i++; continue; }
    if (quote) {
      if (c === quote || c === "\n" || c === "\r") quote = "";
      continue;
    }
    if (c === "/" && next === "*") { comment = true; i++; continue; }
    if (c === '"' || c === "'") { quote = c; continue; }
    if (c === "{") stack.push("}");
    else if (c === "(") stack.push(")");
    else if (c === "[") stack.push("]");
    else if (c === stack.at(-1)) stack.pop();
  }
  return css + (comment ? "*/" : "") + quote + stack.reverse().join("") + "\n";
}
