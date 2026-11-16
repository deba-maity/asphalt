"""Fetch only pinned Windows templates from the official template ZIP using ranges.

No package dependencies. ZipFile verifies CRC. No full 1.28 GB bundle is retained.
"""
from pathlib import Path
import io
import json
import urllib.request
import zipfile
import hashlib

ROOT = Path(__file__).resolve().parents[1]
VERSION = json.loads((ROOT / "engine-version.json").read_text())["version"]
URL = f"https://github.com/godotengine/godot-builds/releases/download/{VERSION}-stable/Godot_v{VERSION}-stable_export_templates.tpz"


class RemoteZip(io.RawIOBase):
    def __init__(self):
        self.pos = 0
        request = urllib.request.Request(URL, headers={"Range": "bytes=0-0"})
        with urllib.request.urlopen(request, timeout=90) as response:
            content_range = response.headers.get("Content-Range", "")
            if not content_range:
                raise RuntimeError("Server did not support ranges; install templates from Godot instead.")
            self.size = int(content_range.rsplit("/", 1)[1])
            self.url = response.geturl()

    def seekable(self):
        return True

    def tell(self):
        return self.pos

    def seek(self, offset, whence=0):
        self.pos = offset if whence == 0 else (self.pos + offset if whence == 1 else self.size + offset)
        return self.pos

    def read(self, count=-1):
        if count < 0:
            count = self.size - self.pos
        count = min(count, self.size - self.pos)
        if count <= 0:
            return b""
        request = urllib.request.Request(self.url, headers={"Range": f"bytes={self.pos}-{self.pos+count-1}"})
        with urllib.request.urlopen(request, timeout=120) as response:
            if response.status != 206:
                raise RuntimeError("Range request was not honored")
            data = response.read()
        self.pos += len(data)
        return data


def main():
    import argparse
    parser=argparse.ArgumentParser(); parser.add_argument('--android',action='store_true'); args=parser.parse_args()
    destination = ROOT / "tools/export_templates" / f"{VERSION}.stable"
    destination.mkdir(parents=True, exist_ok=True)
    files=['android_release.apk'] if args.android else ['windows_debug_x86_64.exe','windows_release_x86_64.exe']
    with zipfile.ZipFile(RemoteZip()) as archive:
        for filename in files:
            member = next(name for name in archive.namelist() if name.endswith('/'+filename))
            payload=archive.read(member)
            pin=json.loads((ROOT/'engine-version.json').read_text())
            if hashlib.sha256(payload).hexdigest()!=pin['template_sha256'][filename]: raise RuntimeError('Template SHA-256 does not match pinned member: '+filename)
            (destination/filename).write_bytes(payload)
            print(f'Verified ZIP CRC + SHA-256: {filename}: {len(payload)} bytes',flush=True)

if __name__=='__main__': main()
