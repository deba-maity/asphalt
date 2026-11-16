"""Fast static checks: files, project-relative links, budget and release safety."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit,unquote
import json,re
ROOT=Path(__file__).resolve().parents[1]; SITE=ROOT/'site'
class Links(HTMLParser):
    def __init__(self): super().__init__(); self.urls=[]; self.images=[]
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        for key in ['href','src']:
            if a.get(key): self.urls.append(a[key])
        if tag=='img': self.images.append(a)
for page in SITE.glob('*.html'):
    parsed=Links(); text=page.read_text(encoding='utf-8'); parsed.feed(text)
    assert '<html lang="en">' in text and 'name="viewport"' in text,page
    for url in parsed.urls:
        part=urlsplit(url)
        if part.scheme: assert part.scheme=='https',url; continue
        assert not part.path.startswith('/'),'Root-relative URL breaks project Pages: '+url
        if part.path: assert (page.parent/unquote(part.path)).resolve().exists(),f'{page}: missing {url}'
    for img in parsed.images: assert 'alt' in img and 'width' in img and 'height' in img,img
assert sum(f.stat().st_size for f in SITE.rglob('*') if f.is_file() and '.preview' not in f.parts)<1500000,'Static site exceeds 1.5 MB budget.'
data=json.loads((SITE/'release-data.json').read_text())
assert data['published'] is False,'Local check expects unavailable download; verify public snapshot separately before deployment.'
assert not any(a.get('download_url') for a in data['artifacts'])
for p in (ROOT/'.github/workflows').glob('*.yml'):
    for action in re.findall(r'uses:\s*([^\s#]+)',p.read_text()): assert re.fullmatch(r'actions/[a-z-]+@[0-9a-f]{40}',action),(p,action)
print('PASS: relative local links, semantic image metadata, asset budget, unpublished release state, SHA-pinned actions.')
