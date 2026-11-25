/** Structural browser observations are repair input, never a visual pass. */
export interface BrowserFinding {
  code: string;
  detail: string;
}
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const finite = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= 0;
/** Merge only checkpoints belonging to the same named inspection. */
export function assembleMufyBrowserSteps(
  input: unknown[],
  inspectionId: string,
): unknown[] {
  if (!inspectionId.trim()) throw Error("INSPECTION_ID_REQUIRED");
  const groups = new Map<string, Record<string, unknown>[]>();
  for (const run of input) {
    if (
      !object(run) ||
      run.inspectionId !== inspectionId ||
      typeof run.url !== "string" ||
      !finite(run.width)
    )
      continue;
    const key = `${run.url}:${run.width}`;
    groups.set(key, [...(groups.get(key) ?? []), run]);
  }
  return [...groups.values()].map((runs) => {
    const ordered = runs.toSorted(
      (a, b) =>
        Date.parse(String(a.startedAt)) - Date.parse(String(b.startedAt)),
    );
    const states = new Map<string, unknown>();
    const stateRuns = new Map<string, Record<string, unknown>>();
    for (const run of ordered)
      for (const row of Array.isArray(run.rows) ? run.rows : []) {
        if (object(row) && typeof row.state === "string") {
          states.set(row.state, row);
          stateRuns.set(row.state, run);
        }
      }
    const first = ordered[0],
      last = ordered.at(-1)!;
    const current = [...new Set(stateRuns.values())];
    return {
      ...last,
      startedAt: first.startedAt,
      rows: [...states.values()],
      executionMs: ordered.reduce(
        (n, r) => n + (finite(r.executionMs) ? r.executionMs : 0),
        0,
      ),
      actions: current.flatMap((r) =>
        Array.isArray(r.actions) ? r.actions : [],
      ),
      findings: current.flatMap((r) =>
        Array.isArray(r.findings)
          ? r.findings
          : [{ code: "BROWSER_FINDINGS_MISSING" }],
      ),
    };
  });
}
export function reviewMufyBrowserRuns(
  value: unknown,
  expected: {
    characterId: string;
    baseUrl: string;
    notBefore: string;
    allowMediaDeferral?: boolean;
  },
) {
  const findings: BrowserFinding[] = [];
  const add = (code: string, detail: string) => findings.push({ code, detail });
  const rows = Array.isArray(value) ? value : object(value) && Array.isArray(value.runs) ? value.runs : [];
  const origin = new URL(expected.baseUrl).origin;
  const earliest = Date.parse(expected.notBefore);
  if (!Number.isFinite(earliest))
    add("WRITE_TIME_REQUIRED", "最新写入时间缺失，不能复用旧检查");
  for (const surface of ["chat", "characters"])
    for (const width of [390, 1280]) {
      const url = `${origin}/${surface}/${expected.characterId}`;
      const candidates = rows.filter(
        (r) => object(r) && r.url === url && r.width === width,
      );
      const run = candidates.at(-1);
      const key = `${surface}/${width}`;
      if (!object(run)) {
        add("BROWSER_STATE_MISSING", key);
        continue;
      }
      if (run.scope !== "browser-structural-and-native-fold-only")
        add("BROWSER_SCOPE_INVALID", key);
      if (
        !finite(run.executionMs) ||
        typeof run.startedAt !== "string" ||
        typeof run.finishedAt !== "string" ||
        !Number.isFinite(Date.parse(run.startedAt)) ||
        Date.parse(run.startedAt) < earliest ||
        !Number.isFinite(Date.parse(run.finishedAt)) ||
        Date.parse(run.finishedAt) < Date.parse(run.startedAt) ||
        Date.parse(run.finishedAt) > Date.now() + 60_000
      )
        add("BROWSER_TIME_INVALID", key);
      if (!Array.isArray(run.findings)) add("BROWSER_FINDINGS_MISSING", key);
      else
        for (const finding of run.findings)
          if (object(finding))
            add(String(finding.code), `${key}: ${JSON.stringify(finding)}`);
          else add("BROWSER_FINDING_INVALID", key);
      if (!Array.isArray(run.actions)) add("BROWSER_ACTIONS_MISSING", key);
      else
        for (const action of run.actions)
          if (
            !object(action) ||
            typeof action.requestedOpen !== "boolean" ||
            action.actualOpen !== action.requestedOpen
          )
            add("FOLD_ACTION_FAILED", key);
      const states = Array.isArray(run.rows) ? run.rows : [];
      if (states.length !== 4) add("BROWSER_FOUR_STATES_REQUIRED", key);
      for (const state of ["initial", "expanded", "collapsed", "reopened"]) {
        const samples = states.filter((r) => object(r) && r.state === state);
        const row = samples[0];
        if (
          samples.length !== 1 ||
          !object(row) ||
          !Array.isArray(row.frames) ||
          row.frames.length === 0
        ) {
          add("EMPTY_BROWSER_STATE", `${key}/${state}`);
          continue;
        }
        const main = row.frames.filter(
          (f) =>
            object(f) &&
            typeof f.title === "string" &&
            !f.title.includes("floating"),
        );
        if (!main.length) add("CONTENT_FRAME_REQUIRED", `${key}/${state}`);
        for (const frame of main) {
          if (!object(frame)) continue;
          const label = `${key}/${state}/${String(frame.title)}`;
          if (
            !finite(frame.bodyHeight) ||
            frame.bodyHeight <= 0 ||
            !finite(frame.textChars) ||
            !Array.isArray(frame.images) ||
            (frame.textChars === 0 &&
              !frame.images.some((i) => object(i) && i.loaded === true) &&
              !(
                expected.allowMediaDeferral === true &&
                frame.images.length > 0 &&
                frame.images.every(
                  (i) =>
                    object(i) && typeof i.src === "string" && i.src.length > 0,
                )
              ))
          )
            add("EMPTY_RENDER", label);
          if (!finite(frame.overflowPx) || frame.overflowPx > 2)
            add("HORIZONTAL_OVERFLOW", label);
          if (frame.unresolvedUser !== false) add("UNRESOLVED_USER", label);
          if (Array.isArray(frame.images))
            for (const image of frame.images) {
              if (!object(image) || image.loaded !== true)
                add(
                  object(image) && image.complete === false
                    ? "IMAGE_PENDING"
                    : "IMAGE_NOT_LOADED",
                  label,
                );
            }
          if (!Array.isArray(frame.controls)) {
            add("CONTROLS_MISSING", label);
            continue;
          }
          if (state !== "initial")
            for (const c of frame.controls)
              if (
                !object(c) ||
                (c.visible === true && c.open !== (state !== "collapsed"))
              )
                add("INCOMPLETE_FOLD_STATE", label);
        }
      }
    }
  const unique = [
    ...new Map(findings.map((f) => [`${f.code}:${f.detail}`, f])).values(),
  ];
  return {
    version: 1,
    structuralOk: unique.every(
      (f) =>
        expected.allowMediaDeferral === true &&
        ["IMAGE_PENDING", "IMAGE_NOT_LOADED"].includes(f.code),
    ),
    finalFidelityAccepted: false,
    findings: unique,
    deferredMedia:
      expected.allowMediaDeferral === true
        ? unique
            .filter((f) =>
              ["IMAGE_PENDING", "IMAGE_NOT_LOADED"].includes(f.code),
            )
            .map((f) => ({
              ...f,
              disposition: "deferred-authorized",
              reason:
                "用户允许图片等媒体缺项后补，保留原地址和观测，未视为修好",
            }))
        : [],
  };
}

export function buildMufyRepairQueue(findings: BrowserFinding[]) {
  return [...new Set(findings.map((f) => f.code))].map((code) => ({
    code,
    action:
      /EMPTY|MISSING|TIME|SCOPE|WRITE_TIME|BROWSER_CHECK_FAILED|FOLD_ACTION|INCOMPLETE_FOLD/.test(
        code,
      )
        ? "repeat-browser-observation"
        : code === "IMAGE_PENDING"
          ? "wait-for-existing-images-and-reobserve"
          : code === "HORIZONTAL_OVERFLOW"
            ? "repair-responsive-layout"
            : code === "UNRESOLVED_USER"
              ? "repair-user-substitution"
              : code === "IMAGE_NOT_LOADED"
                ? "inspect-media-or-authorized-deferral"
                : "diagnose-new-structure",
    afterRepair:
      "refresh-all-four-browser-configurations-and-full-fidelity-evidence",
    userReviewRequired: false,
  }));
}
