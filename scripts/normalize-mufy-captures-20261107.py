"""Lossless pixel-preserving PNG export of returned browser capture bytes.
The original encoded capture is retained beside it; no cropping or retouching.
"""
from pathlib import Path
from PIL import Image
import hashlib, json, time, datetime

root=Path('logs/mufy-profiles/full-20261013/next-batch-30-20261028')
started=time.perf_counter()
rows=[]
for rank in (25,27,33,34,40,42):
    for path in sorted((root/'final-acceptance'/str(rank)).glob('*20261107.png')):
        original=path.read_bytes()
        with Image.open(path) as decoded:
            fmt=decoded.format
            rgb=decoded.convert('RGB')
            size=rgb.size
            pixels=hashlib.sha256(rgb.tobytes()).hexdigest()
            original_path=None
            if fmt!='PNG':
                original_path=path.with_suffix('.capture-original.jpg' if fmt=='JPEG' else '.capture-original.bin')
                if original_path.exists() and original_path.read_bytes()!=original:
                    raise RuntimeError('ORIGINAL_CAPTURE_ALREADY_DIFFERS:'+str(path))
                original_path.write_bytes(original)
                rgb.save(path,format='PNG')
        with Image.open(path) as exported:
            if exported.format!='PNG' or hashlib.sha256(exported.convert('RGB').tobytes()).hexdigest()!=pixels:
                raise RuntimeError('PIXEL_CHANGED:'+str(path))
        rows.append(dict(path=str(path.relative_to(root)),originalFormat=fmt,width=size[0],height=size[1],originalSha256=hashlib.sha256(original).hexdigest(),originalRetained=str(original_path.relative_to(root)) if original_path else None,pngSha256=hashlib.sha256(path.read_bytes()).hexdigest(),decodedRgbSha256=pixels))
report=dict(observedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),scope='Container/encoding normalization only; no new browser observations or acceptance promotion',images=rows,elapsedMs=(time.perf_counter()-started)*1000)
(root/'capture-encoding-provenance-20261107.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps(dict(images=len(rows),converted=sum(r['originalFormat']!='PNG' for r in rows),pixelsUnchanged=True,elapsedMs=report['elapsedMs'])))
