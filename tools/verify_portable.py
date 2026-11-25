"""Extract into a fresh path with spaces and exercise only the packaged engine."""
from pathlib import Path
import argparse, hashlib, json, os, re, subprocess, tempfile, zipfile
from validation_lock import validation_lock

# Minimum coverage shipped in the current candidate. Additional passing checks
# do not invalidate a portable build when a suite gains a regression test.
MINIMUM_CHECKS = {'trial': 48, 'motion': 51, 'combat': 18, 'duel': 62, 'presentation': 38, 'audit': 44}

def main():
    p=argparse.ArgumentParser(); p.add_argument('--release-dir',type=Path,required=True); args=p.parse_args()
    directory=args.release_dir.resolve(); metadata=json.loads((directory/'release.json').read_text())
    artifact=next(a for a in metadata['artifacts'] if a['kind']=='windows-portable')
    filename=artifact['filename']
    if not isinstance(filename,str) or Path(filename).name!=filename or ':' in filename or '\\' in filename or '/' in filename:
        raise SystemExit('Portable artifact must be a filename within the release directory.')
    archive=directory/filename
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
        required=['README.txt','BUILD.json','LICENSE','GODOT_LICENSE.txt','THIRD_PARTY_NOTICES.txt','CREDITS.txt','PERFORMANCE_ASSET_LICENSE.txt','COURT_ASSET_LICENSE.txt','TRIAL_AUDIO_LICENSE.txt','OFL.txt']
        if not all((exe.parent/n).is_file() for n in required): raise SystemExit('Incomplete portable distribution.')
        checks=[('quality',['--test-quality'],'behavior checks passed',60),('campaign',['--campaign-play'],'PLAY: PASS: all six chapters',60),('continue',['--campaign-continue'],'PLAY: Relaunch Continue restored ending, credits, memorial and exactly one canonical death/resurrection.',60)]
        for hz in [30,60]:
            for label,mode,option,marker in [('trial','--test-trial','trial','trial checks passed'),('motion','--test-motion-quality','motion','motion quality checks passed'),('combat','--test-trial-combat','combat','physical combat checks passed'),('duel','--test-trial-duel','duel','duel behavior checks passed'),('presentation','--test-trial-presentation','presentation','presentation checks passed'),('audit','--test-audit','audit','audit checks passed'),('passage','--test-passage','passage','PASS: Touch Begin starts a fresh fight and remembers the rehearsal')]:
                checks.append((f'{label}-{hz}',[mode,f'--{option}-hz={hz}'],marker,hz))
        for label,arguments,marker,hz in checks:
            run=subprocess.run([str(exe),'--headless','--fixed-fps',str(hz),'--']+arguments,cwd=exe.parent,capture_output=True,text=True,encoding='utf-8',errors='replace',timeout=240,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
            (directory/f'portable-{label}.log').write_text(run.stdout+run.stderr,encoding='utf-8')
            output=run.stdout+run.stderr
            success=run.returncode==0 and 'FAIL:' not in output and 'ERROR:' not in output and marker in run.stdout
            if marker.endswith('checks passed') and label != 'quality':
                # Each suite prints its own current count. A partial or empty
                # set of passing checks must still fail packaged validation.
                count = re.search(r'^RESULT: ([1-9]\d*)/(\d+) ' + re.escape(marker) + r'\b', run.stdout, re.MULTILINE)
                success = (success and count is not None and count[1] == count[2]
                           and int(count[1]) >= MINIMUM_CHECKS[label.rsplit('-', 1)[0]])
            if label.startswith('passage-'):
                success = success and any(line.startswith('PASSAGE: ') and line.endswith(' checks, 0 failures') for line in run.stdout.splitlines())
            results.append({'name':label,'status':'passed' if success else 'failed','exit_code':run.returncode,'cwd':'fresh temporary extraction with spaces; no --path or editor invocation'})
            if not success: raise SystemExit(f'Portable {label} failed; read {directory}/portable-{label}.log')
    metadata['tests']['fresh_zip']='passed'
    (directory/'release.json').write_text(json.dumps(metadata,indent=2)+'\n',encoding='utf-8')
    (directory/'portable-verification.json').write_text(json.dumps({'status':'passed','checks':results,'rendered':'not_run: Remote Desktop user restriction'},indent=2)+'\n',encoding='utf-8')
    names=[a['filename'] for a in metadata['artifacts']]+['release.json','portable-verification.json']
    (directory/'SHA256SUMS.txt').write_text(''.join(hashlib.file_digest((directory/name).open('rb'),'sha256').hexdigest()+'  '+name+'\n' for name in names),encoding='ascii')
    print('Fresh ZIP: quality, campaign/Continue and trial/motion/combat/duel/presentation/audit at 30/60 physics ticks passed.')

if __name__=='__main__':
    with validation_lock():
        main()
