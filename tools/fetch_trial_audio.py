"""Reproduce the trial's licensed audio from publisher downloads; no account.

Runtime files are committed. Normal setup never contacts the publishers.
Kenney's free download flow now issues temporary links; only the stable page,
archive digest and selected member names are retained as provenance.
"""
from pathlib import Path
import hashlib
import http.cookiejar
import json
import re
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / 'tools/cache/foley'
OUT = ROOT / 'game/assets/trial_audio'
PACKS = {
    'rpg-audio': ('6dbeaf8544da958d8f2adcb4a4a4b76c1ade34a05f8ab9edccd327da7375f38b',
                  ['knifeSlice', 'knifeSlice2', 'cloth1', 'cloth2', 'cloth3', 'drawKnife1']),
    'impact-sounds': ('029d734af1582474edf3a694d1b0cebc97c1c152f2f39fa34d4c2bafc5de77f8',
                      [f'{kind}_{i:03}' for kind in ['footstep_concrete', 'impactPunch_heavy', 'impactMetal_medium'] for i in range(3)]
                      + ['impactMetal_heavy_000', 'impactSoft_heavy_000']),
}


def digest(data):
    return hashlib.sha256(data).hexdigest()


def main():
    CACHE.mkdir(parents=True, exist_ok=True); OUT.mkdir(parents=True, exist_ok=True)
    records = []
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    for pack, (sha, names) in PACKS.items():
        page = 'https://kenney.nl/assets/'+pack
        path = CACHE/(pack+'.zip')
        if not path.exists():
            html = opener.open(page, timeout=60).read().decode()
            identifier = re.search(r"data-download-id='([^']+)'", html).group(1)
            request = urllib.request.Request('https://kenney.nl/download-link/'+identifier, headers={'Referer': page})
            link = json.load(opener.open(request, timeout=60))['url']
            data = opener.open(link, timeout=60).read()
            if digest(data) != sha: raise RuntimeError('Publisher archive changed: '+pack)
            path.write_bytes(data)
        if digest(path.read_bytes()) != sha: raise RuntimeError('Cache digest mismatch: '+pack)
        with zipfile.ZipFile(path) as archive:
            if archive.testzip() is not None: raise RuntimeError('ZIP CRC failure')
            files = []
            for name in names:
                member = 'Audio/'+name+'.ogg'
                data = archive.read(member)
                (OUT/(name+'.ogg')).write_bytes(data)
                files.append({'file': name+'.ogg', 'member': member, 'sha256': digest(data)})
            (OUT/(pack+'-LICENSE.txt')).write_bytes(archive.read('License.txt'))
        records.append({'source': page, 'author': 'Kenney', 'license': 'CC0-1.0', 'archive_sha256': sha, 'files': files})
    (OUT/'provenance.json').write_text(json.dumps(records, indent=2)+'\n', encoding='utf-8')
    print('Verified and compiled', sum(len(r['files']) for r in records), 'trial audio assets')


if __name__ == '__main__': main()
