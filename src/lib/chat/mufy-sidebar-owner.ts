/** Keep the previous completed reply's viewport widget while a new turn streams.
 * This is independent of the last-assistant index used by message actions. */
export function mufySidebarOwnerIndex(messages: readonly {role: string; id: string}[], status: string, continuingMessageId: string | null): number {
  for (let i = messages.length - 1; i > 0; i--) {
    const message = messages[i];
    if (message.role !== 'assistant') continue;
    if (message.id === continuingMessageId) return i;
    if ((status === 'streaming' || status === 'submitted') && i === messages.length - 1) continue;
    return i;
  }
  return -1;
}
