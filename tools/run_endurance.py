"""Freeze a source candidate and run a real-time headless endurance fixture.

The snapshot uses a separate Godot user directory. No window is created and no
desktop input is sent. Cached imports are copied only to avoid re-encoding art.
"""
from pathlib import Path
import argparse
import datetime
import hashlib
import json
import shutil
import subprocess
import time

ROOT = Path(__file__).resolve().parents[1]

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--seconds', type=int, default=5400)
    parser.add_argument('--label', required=True)
    args = parser.parse_args()
    if not args.label.replace('-', '').replace('_', '').isalnum():
        parser.error('Use letters, digits, hyphens and underscores for the label.')
    if args.seconds < 60:
        parser.error('Duration must be at least 60 seconds.')
    snapshot = ROOT/'exports/verification'/args.label
    if snapshot.exists():
        parser.error('Snapshot already exists; choose a new label to preserve evidence.')
    source = ROOT/'game'
    shutil.copytree(source, snapshot/'game', ignore=shutil.ignore_patterns('.godot'))
    cache = source/'.godot'
    if cache.exists():
        shutil.copytree(cache, snapshot/'game/.godot', ignore=shutil.ignore_patterns('editor'))
    user_dir = 'AshenVowSoak-' + args.label
    project = snapshot/'game/project.godot'
    project.write_text(project.read_text(encoding='utf-8').replace(
        'config/custom_user_dir_name="AshenVow"',
        f'config/custom_user_dir_name="{user_dir}"'), encoding='utf-8')
    manifest = {
        'snapshot': str(snapshot), 'user_directory': user_dir,
        'config_override': 'Only config/custom_user_dir_name differs from source.',
        'requested_seconds': args.seconds,
        'source_files': {p.relative_to(source).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
                         for p in source.rglob('*') if p.is_file() and '.godot' not in p.parts},
    }
    logs = ROOT/'tools/logs'
    logs.mkdir(exist_ok=True)
    record = logs/(args.label+'-source.json')
    engine = ROOT/'tools/engine/Godot_v4.7.2-stable_win64_console.exe'
    base = [str(engine), '--headless', '--path', str(snapshot/'game')]
    flags = getattr(subprocess, 'CREATE_NO_WINDOW', 0)
    with (logs/(args.label+'-import.log')).open('w', encoding='utf-8') as log:
        subprocess.run(base+['--editor', '--import', '--quit'], stdout=log,
                       stderr=subprocess.STDOUT, check=True, creationflags=flags)
    manifest['start_utc'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    manifest['start_epoch'] = time.time()
    record.write_text(json.dumps(manifest, indent=2)+'\n', encoding='utf-8')
    print('Frozen snapshot ready. Starting', args.seconds, 'seconds at', manifest['start_utc'], flush=True)
    with (logs/(args.label+'.log')).open('w', encoding='utf-8') as log:
        result = subprocess.run(base+['--max-fps', '60', '--', '--test-endurance',
            f'--endurance-seconds={args.seconds}'], stdout=log, stderr=subprocess.STDOUT, creationflags=flags)
    manifest['end_utc'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    manifest['exit_code'] = result.returncode
    record.write_text(json.dumps(manifest, indent=2)+'\n', encoding='utf-8')
    print('Endurance exit:', result.returncode, 'at', manifest['end_utc'], flush=True)
    raise SystemExit(result.returncode)

if __name__ == '__main__':
    main()
