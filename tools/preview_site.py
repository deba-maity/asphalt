"""Local HTTP preview that also exercises GitHub project Pages subpaths."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import unquote,urlsplit
import argparse

ROOT=Path(__file__).resolve().parents[1]/'site'
p=argparse.ArgumentParser(); p.add_argument('--port',type=int,default=4173); p.add_argument('--base',default='/ashen-vow/'); args=p.parse_args()
base='/'+args.base.strip('/')+'/' if args.base.strip('/') else '/'
class Handler(SimpleHTTPRequestHandler):
    def translate_path(self,path):
        relative=unquote(urlsplit(path).path)
        if not relative.startswith(base): return str(ROOT/'__not_found__')
        target=(ROOT/relative[len(base):]).resolve()
        return str(target) if target.is_relative_to(ROOT) else str(ROOT/'__not_found__')
    def end_headers(self):
        self.send_header('Cache-Control','no-store')
        super().end_headers()
print(f'Preview http://127.0.0.1:{args.port}{base} (Ctrl+C stops)',flush=True)
ThreadingHTTPServer(('127.0.0.1',args.port),Handler).serve_forever()
