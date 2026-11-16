"""Portable, deterministic ZIP creation and artifact-derived release data (stdlib)."""
from pathlib import Path
import argparse, datetime as dt, hashlib, json, os, subprocess, zipfile

ROOT=Path(__file__).resolve().parents[1]

def sha(path): return hashlib.file_digest(path.open('rb'),'sha256').hexdigest()
def git(*args): return subprocess.check_output(['git','-C',str(ROOT),*args],text=True).strip()
def write_json(path,data): path.write_text(json.dumps(data,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')

def main():
    p=argparse.ArgumentParser()
    p.add_argument('--binary-dir',type=Path,default=ROOT/'exports/windows')
    p.add_argument('--output',type=Path)
    p.add_argument('--source-tests',type=Path,required=True)
    p.add_argument('--signed',action='store_true')
    args=p.parse_args()
    config=json.loads((ROOT/'release-config.json').read_text())
    pin=json.loads((ROOT/'engine-version.json').read_text())
    tests=json.loads(args.source_tests.read_text(encoding='utf-8-sig'))
    if tests.get('status')!='passed': raise SystemExit('Source validation must pass before packaging.')
    version=config['version']; commit=git('rev-parse','HEAD')
    dirty=bool(git('status','--porcelain'))
    if dirty: raise SystemExit('Commit source changes before packaging. The source archive must match the exact clean build checkout.')
    epoch=int(os.environ.get('SOURCE_DATE_EPOCH',int(dt.datetime.now(dt.timezone.utc).timestamp())))
    date=dt.datetime.fromtimestamp(epoch,dt.timezone.utc).isoformat()
    output=(args.output or ROOT/'exports/releases'/('v'+version)).resolve()
    output.mkdir(parents=True,exist_ok=True)
    filename=f'AshenVow-v{version}-windows-x86_64.zip'
    archive=output/filename
    if archive.exists(): raise SystemExit(f'{archive} exists. Choose a new output directory; existing candidates/releases are never silently replaced.')
    for name in ['AshenVow.exe','LICENSE','GODOT_LICENSE.txt','THIRD_PARTY_NOTICES.txt','CREDITS.txt']:
        if not (args.binary_dir/name).is_file(): raise SystemExit('Required package file missing: '+name)
    identity={'version':version,'source_commit':commit,'source_dirty':dirty,'build_date_utc':date,'engine':pin['version'],'platform':'windows','architecture':'x86_64','status':'candidate','signature':'signed' if args.signed else 'unsigned','source_headless_tests':'passed','rendered_target_laptop_tests':'not_run'}
    player=(ROOT/'docs/PLAYER_README.txt').read_text(encoding='utf-8').replace('{VERSION}',version)
    entries={name:(args.binary_dir/name).read_bytes() for name in ['AshenVow.exe','LICENSE','GODOT_LICENSE.txt','THIRD_PARTY_NOTICES.txt','CREDITS.txt']}
    entries['README.txt']=player.encode('utf-8')
    entries['BUILD.json']=(json.dumps(identity,indent=2)+'\n').encode()
    folder=filename.removesuffix('.zip')
    stamp=dt.datetime.fromtimestamp(max(epoch,315532800),dt.timezone.utc).timetuple()[:6]
    with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:
        for name,content in sorted(entries.items()):
            info=zipfile.ZipInfo(folder+'/'+name,date_time=stamp)
            info.compress_type=zipfile.ZIP_DEFLATED; info.create_system=3; info.external_attr=0o100644<<16
            z.writestr(info,content,compresslevel=9)
    source=output/f'AshenVow-v{version}-source.zip'
    subprocess.run(['git','-C',str(ROOT),'archive','--format=zip','--prefix=AshenVow-source/','-o',str(source),commit],check=True)
    artifacts=[{'kind':'windows-portable','platform':'windows','architecture':'x86_64','filename':archive.name,'size_bytes':archive.stat().st_size,'sha256':sha(archive),'download_url':None},{'kind':'source','filename':source.name,'size_bytes':source.stat().st_size,'sha256':sha(source),'download_url':None}]
    if any(a['size_bytes']>=2*1024**3 for a in artifacts): raise SystemExit('An artifact exceeds the current GitHub 2 GiB per-asset limit.')
    metadata={**identity,'schema':1,'published':False,'repository_url':None,'release_url':None,'website_url':None,'artifacts':artifacts,'android':{'status':'unavailable','artifact':None,'reason':'SDK, release signing identity, touch adaptation and device acceptance are not completed.'},'tests':{'source_headless':'passed','fresh_zip':'pending','target_laptop':'not_run','visual_audio_devices':'not_run'}}
    write_json(output/'release.json',metadata)
    (output/'SHA256SUMS.txt').write_text(''.join(a['sha256']+'  '+a['filename']+'\n' for a in artifacts),encoding='ascii')
    print(archive)

if __name__=='__main__': main()
