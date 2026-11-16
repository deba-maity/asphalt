"""Build-time release snapshot. No API calls or credentials in the website."""
from pathlib import Path
import argparse, hashlib, json, re, urllib.request

ROOT=Path(__file__).resolve().parents[1]

def get(url):
    request=urllib.request.Request(url,headers={'User-Agent':'AshenVow-release-verifier','Accept':'application/vnd.github+json'})
    return urllib.request.urlopen(request,timeout=120)

def remote(repository,tag):
    if not re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+',repository): raise SystemExit('Use the actual OWNER/REPOSITORY, obtained from GitHub Code > HTTPS.')
    if not re.fullmatch(r'v[0-9][A-Za-z0-9.+-]*',tag): raise SystemExit('Expected a version tag beginning with v.')
    with get(f'https://api.github.com/repos/{repository}/releases/tags/{tag}') as response: release=json.load(response)
    if release['draft']: raise SystemExit('Draft releases are not public downloads.')
    assets={a['name']:a for a in release['assets']}
    if not {'release.json','SHA256SUMS.txt'}<=assets.keys(): raise SystemExit('Release metadata/checksum assets missing.')
    with get(assets['release.json']['browser_download_url']) as response: data=json.load(response)
    if 'v'+data['version']!=tag or data['source_dirty']: raise SystemExit('Version mismatch or dirty source build.')
    if data['tests'].get('fresh_zip')!='passed': raise SystemExit('Published candidate must have passed fresh-ZIP checks.')
    with get(assets['SHA256SUMS.txt']['browser_download_url']) as response: sums=response.read().decode('ascii')
    for artifact in data['artifacts']:
        name=artifact['filename']
        if name not in assets: raise SystemExit('Missing release asset: '+name)
        asset=assets[name]
        if asset['size']!=artifact['size_bytes']: raise SystemExit('Remote size mismatch: '+name)
        h=hashlib.sha256(); size=0
        with get(asset['browser_download_url']) as response:
            while chunk:=response.read(1024*1024): h.update(chunk); size+=len(chunk)
        if size!=artifact['size_bytes'] or h.hexdigest()!=artifact['sha256']: raise SystemExit('Remote SHA-256 mismatch: '+name)
        if artifact['sha256']+'  '+name not in sums.splitlines(): raise SystemExit('Checksum manifest mismatch: '+name)
        artifact['download_url']=asset['browser_download_url']
    data.update(published=True,repository_url=f'https://github.com/{repository}',release_url=release['html_url'],checksum_url=assets['SHA256SUMS.txt']['browser_download_url'])
    return data

def main():
    p=argparse.ArgumentParser(); p.add_argument('--release',type=Path); p.add_argument('--repository'); p.add_argument('--tag'); p.add_argument('--output',type=Path,default=ROOT/'site/release-data.json'); args=p.parse_args()
    if args.repository or args.tag:
        if not args.repository or not args.tag: p.error('--repository and --tag are required together')
        data=remote(args.repository,args.tag)
    elif args.release:
        data=json.loads(args.release.read_text(encoding='utf-8'))
        data['published']=False
        data.update(repository_url=None,release_url=None,checksum_url=None)
        for artifact in data['artifacts']: artifact['download_url']=None
    else:
        config=json.loads((ROOT/'release-config.json').read_text())
        data={'version':config['version'],'status':'candidate','published':False,'artifacts':[],'android':{'status':'unavailable'},'tests':{'target_laptop':'not_run'}}
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(data,indent=2)+'\n',encoding='utf-8')
    print('Site snapshot: '+str(args.output)+'; public download '+('verified' if data['published'] else 'unavailable'))

if __name__=='__main__': main()
