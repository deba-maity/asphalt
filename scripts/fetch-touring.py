"""Fetch the pinned public Blender demo; extract one known member, never scripts."""
from pathlib import Path
import hashlib, io, urllib.request, zipfile

ROOT=Path(__file__).resolve().parents[1]
URL='https://download.blender.org/demo/test/BMW27_2.blend.zip'
SHA256='74f5dc6d718fc565e0ff50e355be7f8b1a58983cc9ae79775608d8905c269ee4'
CACHE=ROOT/'artifacts/asset-sources'
ARCHIVE=CACHE/'BMW27_2.blend.zip'
MEMBER='bmw27/bmw27_cpu.blend'

def main():
    CACHE.mkdir(parents=True,exist_ok=True)
    if ARCHIVE.exists(): data=ARCHIVE.read_bytes()
    else:
        with urllib.request.urlopen(URL, timeout=60) as response:
            data=response.read(8_000_001)
        if len(data)>8_000_000: raise ValueError('Source exceeds the expected download budget')
    if hashlib.sha256(data).hexdigest()!=SHA256:
        raise ValueError('Pinned source SHA-256 mismatch; nothing was extracted')
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        entry=archive.getinfo(MEMBER)
        if entry.file_size!=3_149_021: raise ValueError('Unexpected Blender source size')
        payload=archive.read(MEMBER) # ZipFile verifies CRC before returning.
    ARCHIVE.write_bytes(data)
    target=CACHE/'bmw-source.blend';target.write_bytes(payload)
    print('Verified source:',target)
    print('License and attribution: public/assets/touring/LICENSE.txt')

if __name__=='__main__': main()
