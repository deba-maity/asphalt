"""Transient Android preset + isolated editor settings; secrets stay in env."""
from pathlib import Path
import argparse,json,re
ROOT=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser(); p.add_argument('--java',required=True); p.add_argument('--sdk',required=True); p.add_argument('--template',required=True); p.add_argument('--editor-data',type=Path,required=True); args=p.parse_args()
preset=ROOT/'game/export_presets.cfg'; backup=ROOT/'tools/cache/export-presets.original'
if backup.exists(): raise SystemExit('Interrupted/concurrent export: restore with tools/prepare_export.py --restore first.')
config=json.loads((ROOT/'release-config.json').read_text())
backup.parent.mkdir(parents=True,exist_ok=True); backup.write_bytes(preset.read_bytes())
s=preset.read_text(); windows,android=s.split('[preset.1.options]',1)
android=re.sub(r'custom_template/release="[^"]*"','custom_template/release='+json.dumps(Path(args.template).resolve().as_posix()),android)
android=re.sub(r'package/unique_name="[^"]*"','package/unique_name='+json.dumps(config['android_application_id']),android)
android=re.sub(r'version/code=\d+','version/code='+str(config['android_version_code']),android)
android=re.sub(r'version/name="[^"]*"','version/name='+json.dumps(config['version']),android)
preset.write_text(windows+'[preset.1.options]'+android,encoding='utf-8')
args.editor_data.mkdir(parents=True,exist_ok=True)
settings='[gd_resource type="EditorSettings" format=3]\n\n[resource]\n'
settings+='export/android/java_sdk_path = '+json.dumps(Path(args.java).resolve().as_posix())+'\n'
settings+='export/android/android_sdk_path = '+json.dumps(Path(args.sdk).resolve().as_posix())+'\n'
(args.editor_data/'editor_settings-4.7.tres').write_text(settings,encoding='utf-8')
