"""CPU mesh contact sheet from inspect_assets.gd, not an in-game screenshot."""
import json
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
samples = json.loads((ROOT / 'logs/asset-geometry.json').read_text())
image = Image.new('RGB', (1600, 1040), '#20272c')
pixels = np.array(image)
zbuffer = np.full((1040, 1600), -np.inf)
labels = []
light = np.array([-.5, .9, -.6]); light /= np.linalg.norm(light)
for row, eye in enumerate([(3, 1.7, -5), (-3, 1.7, 5)]):
    forward = np.array(eye, dtype=float); forward /= np.linalg.norm(forward)
    right = np.cross([0, 1, 0], forward); right /= np.linalg.norm(right)
    up = np.cross(forward, right)
    camera = np.array([right, up, forward]).T
    for column, sample in enumerate(samples):
        faces = []
        for part in sample['parts']:
            points = np.array(part['vertices'])
            indices = np.array(part['indices'], dtype=int)
            if not len(indices): indices = np.arange(len(points))
            tris = points[indices.reshape(-1, 3)]
            normal = -np.cross(tris[:, 1]-tris[:, 0], tris[:, 2]-tris[:, 0])
            norm = np.linalg.norm(normal, axis=1)
            normal /= np.maximum(norm[:, None], 1e-9)
            shade = np.clip(.42+.58*np.maximum(0, normal@light), 0, 1)
            projected = (tris-np.array([0, 1.0, 0]))@camera
            for i, triangle in enumerate(projected):
                if norm[i] < 1e-9: continue
                xy = [(column*400+200+p[0]*205, row*500+280-p[1]*205) for p in triangle]
                color = tuple(np.uint8(np.clip(np.array(part['color'])*shade[i]*255, 0, 255)))
                faces.append((triangle, xy, color))
        for triangle, xy, color in faces:
            coords = np.array(xy)
            lo = np.maximum(np.floor(coords.min(axis=0)).astype(int), [column*400, row*500+40])
            hi = np.minimum(np.ceil(coords.max(axis=0)).astype(int), [(column+1)*400-1, (row+1)*500-1])
            if np.any(hi < lo): continue
            yy, xx = np.mgrid[lo[1]:hi[1]+1, lo[0]:hi[0]+1]
            a, b, c = coords
            denominator = (b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1])
            if abs(denominator)<1e-8: continue
            wa=((b[1]-c[1])*(xx-c[0])+(c[0]-b[0])*(yy-c[1]))/denominator
            wb=((c[1]-a[1])*(xx-c[0])+(a[0]-c[0])*(yy-c[1]))/denominator
            wc=1-wa-wb
            z=wa*triangle[0,2]+wb*triangle[1,2]+wc*triangle[2,2]
            view=zbuffer[lo[1]:hi[1]+1,lo[0]:hi[0]+1]
            mask=(wa>=0)&(wb>=0)&(wc>=0)&(z>view)
            view[mask]=z[mask]
            pixels[lo[1]:hi[1]+1,lo[0]:hi[0]+1][mask]=color
        labels.append(((column*400+20,row*500+20),sample['pose'].upper()+(' / FRONT' if row==0 else ' / BACK')))
image=Image.fromarray(pixels)
draw=ImageDraw.Draw(image)
for point, label in labels: draw.text(point,label,fill='#d5d0bc')
draw.text((20, 1010), 'OFFLINE GEOMETRY INSPECTION - flat CPU shading; textures, game lighting and ground IK not represented', fill='#d5d0bc')
image.save(ROOT / 'logs/asset-contact-sheet.png')
print(ROOT / 'logs/asset-contact-sheet.png')
