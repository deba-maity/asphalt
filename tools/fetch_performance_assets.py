"""Reproduce the CC0 source cache using pinned hashes. Never needs credentials.

The two free character archives come from the publisher's public itch.io download
flow. Motion comes from a public CC0 redistribution pinned to an immutable commit.
Normal setup/build uses the committed compiled assets and does not run this tool.
"""
from pathlib import Path, PurePosixPath
import hashlib
import http.cookiejar
import json
import re
import urllib.parse
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / 'tools/cache/art-pipeline'
PROVENANCE = ROOT / 'game/assets/performance/provenance.json'


def digest(path):
    with path.open('rb') as source:
        return hashlib.file_digest(source, 'sha256').hexdigest()


def free_archive_url(page):
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    html = opener.open(page, timeout=60).read().decode()
    csrf = re.search(r'<meta[^>]*name="csrf_token"[^>]*content="([^"]+)"', html)
    data = urllib.parse.urlencode({'csrf_token': csrf.group(1)} if csrf else {}).encode()
    headers = {'Referer': page, 'X-Requested-With': 'XMLHttpRequest'}
    response = opener.open(urllib.request.Request(page+'/download_url', data=data, headers=headers), timeout=60)
    download_page = json.load(response)['url']
    html = opener.open(download_page, timeout=60).read().decode()
    upload = re.search(r'data-upload_id="(\d+)"', html)
    if not upload:
        raise RuntimeError('Publisher free download page changed; inspect it before updating this tool.')
    request = urllib.request.Request(page+'/file/'+upload.group(1)+'?source=game_download&as_props=1', data=b'', headers=headers)
    return opener, json.load(opener.open(request, timeout=60))['url']


def obtain(record):
    destination = CACHE / ('full-motion' if not record['file'].endswith('.zip') else '') / record['file']
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists() and digest(destination) == record['sha256']:
        print('Verified', destination.name)
        return destination
    if destination.exists():
        raise RuntimeError(f'Hash mismatch in existing cache: {destination}. Preserve/inspect it before retrying.')
    if record['file'].endswith('.zip'):
        opener, url = free_archive_url(record['url'])
    else:
        opener, url = urllib.request.build_opener(), record['url']
    temporary = destination.with_suffix(destination.suffix+'.download')
    with opener.open(url, timeout=120) as response, temporary.open('wb') as output:
        while chunk := response.read(1024*1024):
            output.write(chunk)
    if digest(temporary) != record['sha256']:
        raise RuntimeError(f'Download changed: {destination.name}. Do not use it without reviewing provenance.')
    temporary.replace(destination)
    print('Downloaded and verified', destination.name)
    return destination


def extract_models(archive, names):
    destination = (CACHE/'extracted').resolve()
    with zipfile.ZipFile(archive) as source:
        members = source.namelist()

        def write(member, relative=None):
            target = (destination/(relative or member)).resolve()
            if not target.is_relative_to(destination):
                raise ValueError('Unsafe archive path')
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(source.read(member))

        for basename in names:
            matches = [name for name in members if PurePosixPath(name).name == basename]
            # Both archives contain only one Godot glTF variant of each selection.
            if len(matches) != 1:
                raise ValueError(f'Ambiguous/missing model: {basename}')
            member = matches[0]
            write(member)
            document = json.loads(source.read(member))
            for entry in document.get('buffers', [])+document.get('images', []):
                uri = entry.get('uri')
                if not uri:
                    continue
                relative = str(PurePosixPath(member).parent/uri)
                actual = relative
                if actual not in members:
                    # Publisher's base export references T_Eye_Normal_png.png;
                    # its supplied image is named T_Eye_Normal.png.
                    filename = PurePosixPath(uri).name.replace('_png.png', '.png')
                    candidates = [name for name in members if PurePosixPath(name).name == filename]
                    if not candidates:
                        raise ValueError(f'Missing dependency: {relative}')
                    actual = candidates[0]
                write(actual, relative)


if __name__ == '__main__':
    for record in json.loads(PROVENANCE.read_text(encoding='utf-8'))['sources']:
        obtain(record)
    extract_models(CACHE/'universal-base-characters.zip', ['Superhero_Male_FullBody.gltf', 'Superhero_Female_FullBody.gltf'])
    extract_models(CACHE/'modular-character-outfits-fantasy.zip', ['Male_Ranger.gltf', 'Female_Ranger.gltf'])
    print('Verified sources ready for compile_performance_assets.py')
