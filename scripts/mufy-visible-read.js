/** A bounded recovery for a read-only observation, never for UI actions. */
export async function visibleRead(tab, read) {
  try { return await read(); }
  catch (error) {
    if (!/timed out|deadline/i.test(String(error))) throw error;
    // A fresh visible-page observation must succeed before retrying the read.
    const headings = await tab.playwright.locator('h1').evaluateAll(es =>
      es.filter(e => e.getBoundingClientRect().height > 0).map(e => e.textContent));
    if (!headings.length) throw error;
    return await read();
  }
}
