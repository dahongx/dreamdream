/** Read-only visible-document evidence. No app state, requests or credentials. */
export function collectMufySavedReplyDom(doc = document) {
  const root = doc.querySelector('#nj_chat_messages');
  const users = root ? Array.from(root.querySelectorAll('.nj_user_message_bubble')) : [];
  const lastUser = users.at(-1);
  // DOM order works in the authorized read-only browser scope, which does not
  // expose Node.compareDocumentPosition. Include descendants in the boundary.
  const ordered = root ? Array.from(root.querySelectorAll('*')) : [];
  const userIndex = lastUser ? ordered.indexOf(lastUser) : -1;
  if (lastUser && userIndex < 0) throw Error('UNVERIFIED_USER_DOM_BOUNDARY');
  const boundary = userIndex + (lastUser?.querySelectorAll('*').length ?? 0);
  const afterUser = (node) => !!lastUser && ordered.indexOf(node) > boundary;
  const path = (element) => {
    const parts = [];
    let node = element;
    while (node && node !== doc.documentElement) {
      const parent = node.parentElement;
      if (!parent) return null;
      parts.unshift(node.tagName.toLowerCase() + ':nth-child(' + (Array.from(parent.children).indexOf(node) + 1) + ')');
      node = parent;
    }
    return 'html>' + parts.join('>');
  };
  const frames = root ? Array.from(root.querySelectorAll('iframe')).filter(afterUser) : [];
  const summaries = root ? Array.from(root.querySelectorAll('summary')).filter(afterUser) : [];
  const topLevelSummaries = summaries.filter(node => !node.parentElement?.parentElement?.closest('details'));
  const nativeBoxes = root ? Array.from(root.querySelectorAll('[data-character-css="mufy-native-message"]')).filter(afterUser) : [];
  const text = (node) => (node.innerText ?? node.textContent ?? '').trim();
  return {
    title: doc.querySelector('#nj_chat_header h1')?.innerText ?? doc.querySelector('#nj_chat_header h1')?.textContent ?? null,
    hasSavedUserMessage: !!lastUser,
    messageChars: root?.innerText?.length ?? root?.textContent?.length ?? 0,
    replySummaryLabels: summaries.map(node => (node.innerText ?? node.textContent ?? '').trim()),
    topLevelReplySummaryLabels: topLevelSummaries.map(text),
    invalidSummaryParents: summaries.filter(node => node.parentElement?.tagName !== 'DETAILS').map(node => ({label:text(node),parentTag:node.parentElement?.tagName ?? null})),
    replyFrames: frames.map(frame => ({title: frame.title, selector: path(frame), height: frame.getBoundingClientRect().height})),
    ordinaryReplyTextStart: root ? Array.from(root.querySelectorAll('p')).filter(afterUser).map(text).filter(Boolean).join('\n').slice(0, 160) : '',
    nativeReplyTextStart: nativeBoxes.map(text).filter(Boolean).join('\n').slice(0, 160),
    fullFidelityAccepted: false,
  };
}
