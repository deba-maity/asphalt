"""Fetch the pinned CC-BY-3.0 art source; never execute embedded Blender scripts."""
from pathlib import Path
import hashlib
import urllib.request
import zipfile

ROOT=Path(__file__).resolve().parents[1]
CACHE=ROOT/'tools/cache/duel-reference'
URL='https://opengameart.org/sites/default/files/armored%20knight.zip'
SHA256='edea99305ea1dfffbe56434498693e325d909cf638845f1a473c6d0993aca100'


def main():
    CACHE.mkdir(parents=True,exist_ok=True)
    archive=CACHE/'armored-knight.zip'
    if not archive.exists():
        temporary=archive.with_suffix('.download')
        with urllib.request.urlopen(URL,timeout=60) as response,temporary.open('wb') as output:
            size=0
            while chunk:=response.read(1024*1024):
                size+=len(chunk)
                if size>20*1024*1024:raise ValueError('Unexpected source archive size')
                output.write(chunk)
        if hashlib.sha256(temporary.read_bytes()).hexdigest()!=SHA256:
            raise ValueError('Source checksum changed; do not use without reviewing provenance')
        temporary.replace(archive)
    if hashlib.sha256(archive.read_bytes()).hexdigest()!=SHA256:
        raise ValueError('Cached source checksum mismatch')
    with zipfile.ZipFile(archive) as package:
        entry=package.getinfo('armor.blend')
        if entry.file_size>100*1024*1024:raise ValueError('Unexpected Blender source size')
        # Exact member only: no extractall, paths, backup blend or sample images.
        payload=package.read(entry)
        destination=CACHE/'armor.blend'
        temporary=destination.with_suffix('.download');temporary.write_bytes(payload);temporary.replace(destination)
    print('Verified source SHA-256 and ZIP CRC; extracted armor.blend only.')
    print('Build with Blender --background --factory-startup --disable-autoexec --python-exit-code 1')


if __name__=='__main__':main()
