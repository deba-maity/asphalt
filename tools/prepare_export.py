"""Set transient template paths/version, then restore the tracked preset exactly."""
from pathlib import Path
import argparse
import json
import re

ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser()
parser.add_argument('--templates')
parser.add_argument('--restore', action='store_true')
args=parser.parse_args()
p=ROOT/'game/export_presets.cfg'
backup=ROOT/'tools/cache/export-presets.original'
if args.restore:
    if backup.exists(): p.write_bytes(backup.read_bytes()); backup.unlink()
else:
    if backup.exists(): raise SystemExit('An interrupted build left tools/cache/export-presets.original. Run prepare_export.py --restore, then retry.')
    backup.parent.mkdir(parents=True,exist_ok=True)
    backup.write_bytes(p.read_bytes())
    s=p.read_text(encoding='utf-8')
    for kind in ['debug','release']:
        value=(Path(args.templates)/f'windows_{kind}_x86_64.exe').resolve().as_posix()
        s=re.sub(rf'custom_template/{kind}="[^"]*"',f'custom_template/{kind}="{value}"',s,count=1)
    version=json.loads((ROOT/'release-config.json').read_text())['version']
    numeric=version.split('-')[0]+'.1'
    s=s.replace('[preset.0.options]',f'[preset.0.options]\napplication/file_version="{numeric}"\napplication/product_version="{numeric}"')
    p.write_text(s,encoding='utf-8')
