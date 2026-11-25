"""Scoped Docker metadata cleanup, invoked explicitly via SSH; no volumes/containers touched."""
import json, subprocess, sys, time

def run(*args):
    return subprocess.check_output(args, text=True).strip()

start = time.monotonic()
ids = run('docker','image','ls','-aq','--no-trunc').split()
images = {x['Id']: x for x in json.loads(run('docker','image','inspect',*sorted(set(ids))))}
containers = run('docker','ps','-aq').split()
used = {x['Image'] for x in json.loads(run('docker','inspect',*containers))} if containers else set()
protected = set()
def ancestors(image):
    seen = set()
    while image in images and image not in seen:
        seen.add(image)
        image = images[image].get('Parent')
    return seen
for image, info in images.items():
    if info.get('RepoTags') or image in used:
        protected.update(ancestors(image))
roots = []
for image, info in images.items():
    if image in protected: continue
    history = run('docker','history','--no-trunc','--format','{{.CreatedBy}}',image)
    runner = all(h in history for h in ['3dcf6507ba483da0b7d028378223dbef866dcd412c7aa3d6f63982fc39b41f02','a510113fb4028da2cd10d13a35fb0db5a10caa0a7d86cbd4c98a36d17692d333'])
    builder = ('COPY dir:56a05830c8c5d87532bb8390631678ce7a1c03eb42aa710b55ee1d1a1e18a929 in ./node_modules' in history and 'bun run build' in history and info.get('Config',{}).get('WorkingDir') == '/app')
    if runner or builder: roots.append(image)
candidates = set().union(*(ancestors(x) for x in roots)) - protected if roots else set()
ordered = sorted(candidates, key=lambda x: len(ancestors(x)), reverse=True)
print(json.dumps({'verifiedRoots':roots,'candidateCount':len(ordered),'protectedCount':len(protected),'apply':'--apply' in sys.argv}),flush=True)
if '--apply' in sys.argv:
    for image in ordered:
        # Docker refuses referenced images; never force, never prune.
        result = subprocess.run(['docker','image','rm',image],capture_output=True,text=True)
        print(json.dumps({'image':image,'exitCode':result.returncode}),flush=True)
print(run('df','-Pk','/'))
print(json.dumps({'elapsedMs':round((time.monotonic()-start)*1000)}))
