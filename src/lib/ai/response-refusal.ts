/** Conservative heuristic for short, standalone service refusals.
 * This is response settlement, not moderation of player/creator content.
 * Ambiguous, quoted, long, or mixed story/refusal answers are left untouched.
 */
export function isExplicitModelRefusal(text: string): boolean {
  const plain = text.trim();
  if (!plain || plain.length > 600 || /[<>“”「」『』"\n]/u.test(plain)) {
    return false;
  }
  const chinese =
    /^(?:(?:非常|很)?(?:抱歉|对不起|對不起)[，,。！!\s]*)?(?:作为AI[，,\s]*)?我(?:无法|無法|不能|不便)(?:参与|參與|协助|協助|提供|生成|创作|創作|继续|繼續|满足|滿足)/u;
  const chineseTask =
    /(?:文学创作|文學創作|角色扮演|性描写|性描寫|露骨|色情|政策|安全准则|安全準則|(?:这类|這類|这种|這種|此类|此類)内容|(?:這類|這種|此類)內容)/u;
  const english =
    /^(?:(?:I'm sorry|I am sorry|Sorry)[,.!\s]*)?I (?:cannot|can't|am unable to|won't) (?:help|assist|participate|engage|provide|generate|create|write|continue|fulfill)\b/i;
  const englishTask =
    /\b(?:request|content|roleplay|role-play|explicit|sexual|romantic|policy|policies|guidelines)\b/i;
  return (
    (chinese.test(plain) && chineseTask.test(plain)) ||
    (english.test(plain) && englishTask.test(plain))
  );
}

export function isBlockedModelResponse(
  finishReason: string,
  text: string,
): boolean {
  return (
    finishReason === "content-filter" ||
    finishReason === "refusal" ||
    (finishReason === "other" && text.trim().length === 0) ||
    isExplicitModelRefusal(text)
  );
}
