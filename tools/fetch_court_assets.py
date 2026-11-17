"""Offline asset preparation. Powered by Poly Haven (https://polyhaven.com).
CC0 downloads are committed; the game never calls the live API.
"""
from pathlib import Path
import hashlib
import json
import urllib.request

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'game/assets/court'
CACHE=ROOT/'tools/cache/polyhaven'
HEADERS={'User-Agent':'AshenVowAssetCompiler/0.6 (offline CC0 game art)'}
MANIFEST=OUT/'provenance.json'
PINNED=json.loads(MANIFEST.read_text(encoding='utf-8')) if MANIFEST.exists() else {}
HASHES={item['file']:item['sha256'] for item in PINNED.get('files',[])}

def fetch(record, destination):
    destination.parent.mkdir(parents=True,exist_ok=True)
    if not destination.exists():
        request=urllib.request.Request(record['url'],headers=HEADERS)
        with urllib.request.urlopen(request,timeout=120) as response:
            destination.write_bytes(response.read())
    data=destination.read_bytes()
    if hashlib.md5(data).hexdigest()!=record['md5']:
        raise ValueError('Publisher hash mismatch: '+destination.name)
    name=destination.relative_to(OUT).as_posix()
    digest=hashlib.sha256(data).hexdigest()
    if name in HASHES and HASHES[name]!=digest:
        raise ValueError('Pinned source hash mismatch: '+name)
    return {'file':name,'url':record['url'],'bytes':len(data),'sha256':digest}

def metadata(asset):
    path=CACHE/(asset+'.json')
    if not path.exists():
        path.parent.mkdir(parents=True,exist_ok=True)
        request=urllib.request.Request('https://api.polyhaven.com/files/'+asset,headers=HEADERS)
        path.write_bytes(urllib.request.urlopen(request,timeout=60).read())
    return json.loads(path.read_text(encoding='utf-8'))

if __name__=='__main__':
    records=[]
    for asset in ['rock_moss_set_01','large_castle_door']:
        entry=metadata(asset)['gltf']['1k']['gltf']
        records.append(fetch(entry,OUT/asset/(asset+'.gltf')))
        for name,record in entry['include'].items():
            destination=(OUT/asset/name).resolve()
            if not destination.is_relative_to(OUT.resolve()): raise ValueError('Unsafe dependency path')
            records.append(fetch(record,destination))
    for asset in ['cobblestone_floor_08','castle_brick_07','forest_ground_04']:
        files=metadata(asset)
        for channel in ['Diffuse','nor_gl','arm']:
            entry=files[channel]['2k']['jpg']
            records.append(fetch(entry,OUT/asset/(channel+'.jpg')))
    records.append(fetch(metadata('sunset_forest')['hdri']['2k']['hdr'],OUT/'sunset_forest.hdr'))
    MANIFEST.write_text(json.dumps({'license':'CC0-1.0','publisher':'Poly Haven',
        'license_url':'https://polyhaven.com/license','assets':PINNED.get('assets',{}),
        'files':records},indent=2)+'\n',encoding='utf-8')
    print('Verified',len(records),'CC0 source files; original pixels/geometry preserved.')
