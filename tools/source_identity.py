"""Tie validation and the portable executable to the same runtime source bytes."""
from pathlib import Path
import argparse
import datetime as dt
import hashlib
import json
import subprocess

ROOT=Path(__file__).resolve().parents[1]
TEXT={'.gd','.gdshader','.uid','.json','.godot','.cfg','.tscn','.tres','.import','.txt','.svg','.gltf'}


def sha(path):
    with path.open('rb') as stream:return hashlib.file_digest(stream,'sha256').hexdigest()


def git(*arguments):
    return subprocess.check_output(['git','-C',str(ROOT),*arguments],text=True).strip()


def runtime_fingerprint():
    paths=[p for p in (ROOT/'game').rglob('*') if p.is_file() and '.godot' not in p.parts]
    paths += [ROOT/'engine-version.json',ROOT/'release-config.json']
    digest=hashlib.sha256()
    for path in sorted(paths):
        data=path.read_bytes()
        if path.suffix in TEXT:data=data.replace(b'\r\n',b'\n')
        digest.update(path.relative_to(ROOT).as_posix().encode()+b'\0'+hashlib.sha256(data).digest())
    return digest.hexdigest()


def verify_candidate(binary,identity,tests,commit,fingerprint,version):
    if identity.get('source_commit')!=commit or identity.get('source_dirty') is not False:
        raise ValueError('Executable was not built from this clean commit. Rebuild after committing source.')
    if identity.get('version')!=version or identity.get('runtime_sha256')!=fingerprint:
        raise ValueError('Executable runtime source/version differs from the current checkout.')
    if identity.get('binary_sha256')!=sha(binary):
        raise ValueError('Executable bytes differ from their recorded build identity.')
    if tests.get('status')!='passed' or tests.get('campaign') is not True or tests.get('runtime_sha256')!=fingerprint:
        raise ValueError('A full campaign/source validation of these runtime bytes is required.')


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    sub=parser.add_subparsers(dest='command',required=True)
    sub.add_parser('fingerprint')
    build=sub.add_parser('build');build.add_argument('binary',type=Path);build.add_argument('output',type=Path)
    test=sub.add_parser('tests');test.add_argument('output',type=Path);test.add_argument('--before',required=True);test.add_argument('--campaign',action='store_true');test.add_argument('--hz',type=int,choices=(30,60),required=True)
    args=parser.parse_args();fingerprint=runtime_fingerprint()
    if args.command=='fingerprint':print(fingerprint);return
    record={'source_commit':git('rev-parse','HEAD'),'source_dirty':bool(git('status','--porcelain')),
            'runtime_sha256':fingerprint,'recorded_utc':dt.datetime.now(dt.timezone.utc).isoformat()}
    if args.command=='build':
        record.update(version=json.loads((ROOT/'release-config.json').read_text(encoding='utf-8'))['version'],binary_sha256=sha(args.binary))
    else:
        if args.before!=fingerprint:raise SystemExit('Runtime files changed during validation; no passed test record written.')
        record.update(status='passed',campaign=args.campaign,simulation_hz=args.hz,scope='Headless source checks; native graphics, audio listening and physical input acceptance not run')
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(record,indent=2)+'\n',encoding='utf-8')
    print('Recorded',args.command,'identity:',args.output)


if __name__=='__main__':main()
