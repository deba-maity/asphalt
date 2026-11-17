"""Set reproducible native import options; never edits source image pixels."""
from pathlib import Path
import json
import re
import struct

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT/'game/assets'
normals = set()
for path in (ASSETS/'performance').glob('*.glb'):
    if path.name.startswith('motion_source'): continue
    raw = path.read_bytes()
    size = struct.unpack_from('<I', raw, 12)[0]
    doc = json.loads(raw[20:20+size])
    for material in doc.get('materials', []):
        if 'normalTexture' in material:
            texture = doc['textures'][material['normalTexture']['index']]
            image = doc['images'][texture['source']]
            if 'uri' in image: normals.add((path.parent/image['uri']).resolve())

count = 0
for directory in ['performance/textures', 'court']:
    for path in (ASSETS/directory).rglob('*.import'):
        source = Path(str(path).removesuffix('.import'))
        if source.suffix.lower() not in ['.png', '.jpg', '.jpeg']: continue
        text = path.read_text(encoding='utf-8')
        options = {'compress/mode': '2', 'compress/high_quality': 'true',
                   'process/size_limit': '2048', 'mipmaps/generate': 'true'}
        if source.resolve() in normals or 'nor_gl' in source.name or 'Normal' in source.name:
            options['compress/normal_map'] = '1'
        for key, value in options.items():
            text = re.sub(r'^'+re.escape(key)+r'=.*$', key+'='+value, text, flags=re.MULTILINE)
        path.write_text(text, encoding='utf-8')
        count += 1
print('Configured', count, 'texture imports: 2K maximum, mipmaps, high-quality VRAM compression')
