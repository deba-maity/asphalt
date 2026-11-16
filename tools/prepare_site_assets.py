"""Optional source pipeline only: original vector icon and real historic captures.

Pillow is only required to regenerate the committed ICO/PNG/WebP assets.
No screenshots are invented or modified beyond resize/compression.
"""
from pathlib import Path
from PIL import Image,ImageDraw
import json

root=Path(__file__).resolve().parents[1]
branding=root/'game/assets/branding'; branding.mkdir(parents=True,exist_ok=True)
image=Image.new('RGB',(512,512),'#152327'); draw=ImageDraw.Draw(image)
draw.polygon([(98,386),(244,76),(268,76),(414,386),(357,386),(323,309),(189,309),(155,386)],fill='#e3c798')
draw.polygon([(210,260),(303,260),(257,152)],fill='#152327')
draw.polygon([(256,188),(269,313),(256,405),(243,313)],fill='#d27c4a')
draw.rectangle((196,335,316,348),fill='#d27c4a'); draw.ellipse((244,414,268,438),fill='#e3c798')
image.save(branding/'ashen-vow.png')
image.save(branding/'ashen-vow.ico',sizes=[(16,16),(32,32),(48,48),(64,64),(128,128),(256,256)])
assets=root/'site/assets'; assets.mkdir(parents=True,exist_ok=True)
catalog=[]
for source,title,description in [
 ('01_settlement.png','A reason to return','Rayan stands on Hearthmere’s road beside the family home.'),
 ('03_normal_combat.png','Bread and steel','A bandit winds up a sword attack on the woodland road.'),
 ('04_foreman.png','The road levy','Rayan confronts the foreman near the old kiln.')]:
    photo=Image.open(root/'docs/evidence'/source).convert('RGB')
    photo.thumbnail((1280,720))
    target=assets/(Path(source).stem+'.webp'); photo.save(target,quality=82,method=6)
    catalog.append({'file':'assets/'+target.name,'title':title,'alt':description,'provenance':'Actual pass-one Godot viewport capture; i7-1185G7 / Intel Iris Xe, 720p Compatibility. Historical build, not current-build or target-laptop evidence.'})
(assets/'screenshots.json').write_text(json.dumps(catalog,indent=2)+'\n',encoding='utf-8')
print('Prepared original icon and three accurately labelled historical screenshots.')
