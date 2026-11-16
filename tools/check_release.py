"""Validate every intended upload byte against the finalized manifest."""
from pathlib import Path
import argparse,hashlib,json,zipfile
p=argparse.ArgumentParser(); p.add_argument('directory',type=Path); args=p.parse_args(); root=args.directory.resolve()
data=json.loads((root/'release.json').read_text()); verification=json.loads((root/'portable-verification.json').read_text())
assert data['source_dirty'] is False and data['tests']['fresh_zip']=='passed'
assert data['tests']['source_headless']=='passed' and verification['status']=='passed'
expected={a['filename'] for a in data['artifacts']}|{'release.json','portable-verification.json'}
manifest={}
for line in (root/'SHA256SUMS.txt').read_text().splitlines():
    digest,name=line.split('  ',1); assert Path(name).name==name
    assert name not in manifest; manifest[name]=digest
assert set(manifest)==expected,'Missing or unexpected manifest entry'
for name,digest in manifest.items():
    path=root/name
    assert path.stat().st_size<2*1024**3
    assert hashlib.file_digest(path.open('rb'),'sha256').hexdigest()==digest,name
for artifact in data['artifacts']:
    path=root/artifact['filename']; assert path.stat().st_size==artifact['size_bytes']
    assert manifest[path.name]==artifact['sha256']
    with zipfile.ZipFile(path) as archive:
        assert archive.testzip() is None
        if artifact['kind']=='source': assert archive.comment.decode('ascii')==data['source_commit'],'Source ZIP commit mismatch'
        if artifact['kind']=='windows-portable':
            build=json.loads(archive.read(next(n for n in archive.namelist() if n.endswith('/BUILD.json'))))
            for key in ['version','source_commit','source_dirty','build_date_utc','engine','platform','architecture','status','signature']:
                assert build[key]==data[key],'Embedded build identity mismatch: '+key
print('PASS: coherent candidate, clean source, final upload checksums and ZIP CRCs.')
