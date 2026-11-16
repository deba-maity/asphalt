"""Extract into a fresh path with spaces and exercise only the packaged engine."""
from pathlib import Path
import argparse, hashlib, json, os, subprocess, tempfile, zipfile

def main():
    p=argparse.ArgumentParser(); p.add_argument('--release-dir',type=Path,required=True); args=p.parse_args()
    directory=args.release_dir.resolve(); metadata=json.loads((directory/'release.json').read_text())
    artifact=next(a for a in metadata['artifacts'] if a['kind']=='windows-portable')
    archive=directory/artifact['filename']
    if hashlib.file_digest(archive.open('rb'),'sha256').hexdigest()!=artifact['sha256']: raise SystemExit('Portable ZIP checksum mismatch.')
    results=[]
    with tempfile.TemporaryDirectory(prefix='Ashen Vow portable verification ') as temp:
        root=Path(temp).resolve()
        if not root.is_relative_to(Path(tempfile.gettempdir()).resolve()): raise SystemExit('Unexpected temporary path.')
        with zipfile.ZipFile(archive) as z:
            if z.testzip(): raise SystemExit('ZIP CRC failure.')
            for info in z.infolist():
                if not (root/info.filename).resolve().is_relative_to(root): raise SystemExit('Unsafe ZIP member path.')
            z.extractall(root)
        exe=next(root.glob('*/AshenVow.exe'))
        required=['README.txt','BUILD.json','LICENSE','GODOT_LICENSE.txt','THIRD_PARTY_NOTICES.txt','CREDITS.txt']
        if not all((exe.parent/n).is_file() for n in required): raise SystemExit('Incomplete portable distribution.')
        checks=[('quality','--test-quality','behavior checks passed'),('campaign','--campaign-play','PLAY: PASS: all six chapters'),('continue','--campaign-continue','PLAY: Relaunch Continue restored ending, credits, memorial and exactly one canonical death/resurrection.')]
        for label,mode,marker in checks:
            run=subprocess.run([str(exe),'--headless','--fixed-fps','60','--',mode],cwd=exe.parent,capture_output=True,text=True,encoding='utf-8',errors='replace',timeout=240)
            (directory/f'portable-{label}.log').write_text(run.stdout+run.stderr,encoding='utf-8')
            output=run.stdout+run.stderr
            success=run.returncode==0 and 'FAIL:' not in output and 'ERROR:' not in output and marker in run.stdout
            results.append({'name':label,'status':'passed' if success else 'failed','exit_code':run.returncode,'cwd':'fresh temporary extraction with spaces; no --path or editor invocation'})
            if not success: raise SystemExit(f'Portable {label} failed; read {directory}/portable-{label}.log')
    metadata['tests']['fresh_zip']='passed'
    (directory/'release.json').write_text(json.dumps(metadata,indent=2)+'\n',encoding='utf-8')
    (directory/'portable-verification.json').write_text(json.dumps({'status':'passed','checks':results,'rendered':'not_run: Remote Desktop user restriction'},indent=2)+'\n',encoding='utf-8')
    names=[a['filename'] for a in metadata['artifacts']]+['release.json','portable-verification.json']
    (directory/'SHA256SUMS.txt').write_text(''.join(hashlib.file_digest((directory/name).open('rb'),'sha256').hexdigest()+'  '+name+'\n' for name in names),encoding='ascii')
    print('Fresh ZIP: quality, complete campaign and separate Continue passed.')

if __name__=='__main__': main()
