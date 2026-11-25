"""Activate only the reviewed mask image; keep config and image rollback."""
import datetime
import fcntl
import hashlib
import json
import pathlib
import subprocess
import time
import urllib.request

root = pathlib.Path('/home/lusu/dearm-production-prep-20261020')
release = root / 'release-mask-20261028'
compose = root / 'cutover-20261024/production-compose.json'

def run(args):
    return subprocess.check_output(args, text=True).strip()

def image():
    return run(['docker', 'inspect', 'yearn-chat-app-1', '--format', '{{.Image}}'])

with (root / '.production-release.lock').open('a') as lock:
    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    manifest = json.loads((release / 'manifest.json').read_text())
    assert image() == manifest['baselineImage'], 'Production changed'
    before = (release / 'compose-before.json').read_bytes()
    assert compose.read_bytes() == before, 'Production configuration changed'
    for item in manifest['entries']:
        assert hashlib.sha256((release / 'source' / item['path']).read_bytes()).hexdigest() == item['after']
    subprocess.run(['sha256sum', '-c', str(release / 'preserved.sha256')], cwd=release / 'source', check=True, stdout=subprocess.DEVNULL)
    candidate = run(['docker', 'image', 'inspect', 'dearm-mask:20261028', '--format', '{{.Id}}'])
    assert run(['docker', 'image', 'inspect', 'dearm-mask:20261028', '--format', '{{index .Config.Labels "ai.dearm.release.scope"}}']) == 'production-baseline-plus-mask-ux-and-quota'
    config = json.loads(before)
    assert config['services']['app']['image'] == 'dearm-explore:20261027'
    config['services']['app']['image'] = 'dearm-mask:20261028'
    pending = release / 'compose-pending.json'
    pending.write_text(json.dumps(config, indent=2) + '\n')
    pending.replace(compose)
    try:
        subprocess.run(['docker', 'compose', '-f', str(compose), 'up', '-d', '--no-deps', 'app'], check=True)
        healthy = False
        for _ in range(30):
            try:
                with urllib.request.urlopen('http://127.0.0.1:8091/explore', timeout=5) as response:
                    healthy = response.status == 200
                if healthy:
                    break
            except Exception:
                time.sleep(2)
        assert healthy, 'HTTP health failed'
        assert image() == candidate, 'Unexpected running image'
        manifest.update(status='deployed', image=candidate, deployedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(), databaseMigration=False)
        (release / 'status').write_text('DEPLOYED\n')
    except Exception:
        compose.write_bytes(before)
        subprocess.run(['docker', 'compose', '-f', str(compose), 'up', '-d', '--no-deps', 'app'], check=True)
        (release / 'status').write_text('ROLLED_BACK\n')
        raise
    (release / 'manifest.json').write_text(json.dumps(manifest, indent=2))
    print(json.dumps({'status': manifest['status'], 'image': candidate, 'databaseMigration': False}))
