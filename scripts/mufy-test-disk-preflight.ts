/** Read-only capacity gate. Never cleans images, volumes or databases. */
export const DISK_CHECK_COMMAND = "df -Pk / /root/projects/yearn-chat /var/lib/docker";
export function verifyTestDisk(output: string) {
  const lines = output.trim().split(/\r?\n/).slice(1);
  if (lines.length !== 3) throw Error('DISK_CHECK_INVALID');
  return lines.map(line => {
    const fields = line.trim().split(/\s+/);
    const availableKiB = Number(fields[3]);
    const usedPercent = Number(fields[4]?.replace('%', ''));
    if (!Number.isSafeInteger(availableKiB) || availableKiB < 0 ||
        !Number.isFinite(usedPercent) || usedPercent < 0 || usedPercent > 100 || fields.length !== 6)
      throw Error('DISK_CHECK_INVALID');
    if (availableKiB < 20 * 1024 * 1024 || usedPercent > 80)
      throw Error(`TEST_DISK_CAPACITY_BLOCKED: ${availableKiB} KiB available, ${usedPercent}% used. Review scoped TEST build artifacts; never prune volumes.`);
    return {availableKiB, usedPercent};
  });
}
export async function requireTestDiskCapacity(run: (args: string[], capture: boolean) => Promise<string>, ssh: string[]) {
  if (ssh.at(-1) !== 'root@115.29.213.73') throw Error('EXACT_TEST_HOST_REQUIRED');
  const measurements = verifyTestDisk(await run([...ssh, DISK_CHECK_COMMAND], true));
  console.log(JSON.stringify({stage:'test-disk-preflight', observedAt:new Date().toISOString(), measurements, minimumFreeGiB:20, maximumUsedPercent:80}));
}
