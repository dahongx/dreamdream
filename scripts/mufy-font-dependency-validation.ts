import postcss from 'postcss';

type Face = { family: string; sources: string[] };
const familyName = (value: string) => value.trim().replace(/^(['"])([\s\S]*)\1$/, '$2').toLowerCase();
function faces(css: string): Face[] {
  const result: Face[] = [];
  postcss.parse(css).walkAtRules(/^font-face$/i, rule => {
    let family = '';
    const sources: string[] = [];
    rule.walkDecls(decl => {
      if (decl.prop.toLowerCase() === 'font-family') family = familyName(decl.value);
      if (decl.prop.toLowerCase() === 'src') sources.push(decl.value.trim());
    });
    if (family) result.push({ family, sources });
  });
  return result;
}

/** Compare public CSS in the SAME document as the observed headings.
 * A face in a sibling iframe cannot satisfy a host heading dependency.
 * Declaration parity never proves that a font downloaded or painted correctly.
 */
export function validateFontDependencies(sourceCss: string, targetCss: string, observedFamilies: readonly string[]) {
  const used = new Set(observedFamilies.flatMap(value => postcss.list.comma(value).map(familyName)));
  const source = faces(sourceCss).filter(face => used.has(face.family));
  const target = faces(targetCss);
  const missingFamilies = [...new Set(source.filter(face => !target.some(other => other.family === face.family)).map(face => face.family))];
  const changedSources = [...new Set(source.filter(face => target.some(other => other.family === face.family) &&
    !target.some(other => other.family === face.family && JSON.stringify(other.sources) === JSON.stringify(face.sources))).map(face => face.family))];
  return { missingFamilies, changedSources, declarationParity: missingFamilies.length === 0 && changedSources.length === 0,
    resourceLoadVerified: false, visualAccepted: false };
}

if (import.meta.main) {
  const startedAt = new Date().toISOString(), tick = performance.now();
  const root = 'logs/mufy-profiles/full-20261013/next-batch-10-20261023/strict-acceptance-20261024';
  const evidence = await Bun.file(`${root}/qie-font-dom-evidence.json`).json();
  if (typeof evidence.sourceCss !== 'string' || typeof evidence.targetCss !== 'string' || evidence.headings.length !== 8) throw Error('INVALID_PUBLIC_FONT_EVIDENCE');
  const report = { observedAt: evidence.observedAt, ...validateFontDependencies(evidence.sourceCss, evidence.targetCss,
    evidence.headings.map((heading: {font: string}) => heading.font)), startedAt, elapsedMs: performance.now() - tick };
  await Bun.write(`${root}/font-dependency-validation.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
}
