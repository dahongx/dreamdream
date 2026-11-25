#!/usr/bin/env bun
import { readFile, writeFile, appendFile } from "node:fs/promises";
import { join, resolve } from "node:path";
const dir = resolve("logs/mufy-profiles/full-20261013/pilot-5");
const manifest = JSON.parse(
  await readFile(join(dir, "manifest.json"), "utf8"),
) as { rows: { roleId: string; name: string }[] };
if (manifest.rows.some((row) => !/^[a-f0-9-]{36}$/.test(row.roleId)))
  throw new Error("Invalid roleId");
const sql =
  "BEGIN READ ONLY; SELECT COALESCE(json_agg(t),'[]'::json) FROM (SELECT c.id AS character_id,c.name,p.id AS pack_id,substring(p.description from 'sourceRoleId=([a-f0-9-]{36})') AS role_id FROM characters c JOIN users u ON c.owner_id=u.id JOIN character_pack_subscriptions s ON s.character_id=c.id JOIN beautification_packs p ON p.id=s.pack_id WHERE u.email='test@test.com' AND p.owner_user_id=u.id AND substring(p.description from 'sourceRoleId=([a-f0-9-]{36})') IN (" +
  manifest.rows.map((row) => "'" + row.roleId + "'").join(",") +
  ")) t; COMMIT;";
const command =
  "cd /root/projects/yearn-chat && docker compose exec -T db psql -X -q -U postgres -d postgres -At -v ON_ERROR_STOP=1 -c " +
  JSON.stringify(sql);
const child = Bun.spawn(
  [
    "ssh",
    "-o",
    "BatchMode=yes",
    "-o",
    "ConnectTimeout=10",
    "root@115.29.213.73",
    command,
  ],
  { stdout: "pipe", stderr: "pipe" },
);
const output = await new Response(child.stdout).text();
const err = await new Response(child.stderr).text();
if (await child.exited) throw Error(err);
const targets = JSON.parse(output.trim()) as {
  character_id: string;
  name: string;
  pack_id: string;
  role_id: string;
}[];
const previous = JSON.parse(
  await readFile(join(dir, "test-write-summary.json"), "utf8"),
);
await appendFile(
  join(dir, "write-attempt-history.jsonl"),
  JSON.stringify(previous) + "\n",
);
const rows = manifest.rows.flatMap((source) => {
  const found = targets.filter((row) => row.role_id === source.roleId);
  if (found.length > 1)
    throw Error("Ambiguous TEST targets; no automatic retry");
  if (!found.length) return [];
  if (found[0].name !== source.name)
    throw Error("TEST target name changed; no automatic update");
  return [
    {
      name: source.name,
      roleId: source.roleId,
      stage: "written-test-awaiting-browser-acceptance",
      databaseWrite: {
        characterId: found[0].character_id,
        packId: found[0].pack_id,
      },
      targetUrl: "http://115.29.213.73:8091/chat/" + found[0].character_id,
    },
  ];
});
await writeFile(
  join(dir, "test-write-summary.json"),
  JSON.stringify(
    {
      version: 1,
      scope: "TEST",
      host: "115.29.213.73",
      updatedAt: new Date().toISOString(),
      visualAccepted: 0,
      rows,
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify({
    reconciledTargets: rows.length,
    notWritten: manifest.rows.length - rows.length,
  }),
);
