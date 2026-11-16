"""CPU textured contact sheet from inspect_performance.gd, not a game screenshot."""
import json
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
samples = json.loads((ROOT / 'logs/performance-geometry.json').read_text(encoding="utf-8"))
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
            indices = indices.reshape(-1, 3)
            tris = points[indices]
            normals=np.array(part['normals'])[indices]
            uvs=np.array(part['uv'])[indices]
            texture=np.array(Image.open(ROOT/'logs'/part['texture']).convert('RGB')) if part['texture'] else None
            normal = -np.cross(tris[:, 1]-tris[:, 0], tris[:, 2]-tris[:, 0])
            norm = np.linalg.norm(normal, axis=1)
            normal /= np.maximum(norm[:, None], 1e-9)
            shade = np.clip(.42+.58*np.maximum(0, normal@light), 0, 1)
            projected = (tris-np.array([0, 1.0, 0]))@camera
            for i, triangle in enumerate(projected):
                if norm[i] < 1e-9: continue
                xy = [(column*400+200+p[0]*205, row*500+280-p[1]*205) for p in triangle]
                color = tuple(np.uint8(np.clip(np.array(part['color'])*shade[i]*255, 0, 255)))
                faces.append((triangle, xy, color, normals[i], uvs[i], texture, np.array(part["color"]), part.get("palette",[])))
        for triangle, xy, color, normals, uv, texture, tint, palette in faces:
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
            weights=np.stack([wa,wb,wc],axis=-1)
            normal=weights@normals
            normal/=np.maximum(np.linalg.norm(normal,axis=-1)[...,None],1e-9)
            shade=(.52+.48*np.maximum(0,normal@light))[...,None]
            color=np.broadcast_to(tint*255, (*wa.shape,3))
            if texture is not None:
                texcoords=weights@uv
                tx=((texcoords[...,0]%1)*(texture.shape[1]-1)).astype(int)
                ty=((texcoords[...,1]%1)*(texture.shape[0]-1)).astype(int)
                color=texture[ty,tx]*tint
            if palette:
                linear=(color/255)**2.2
                green=(linear[...,1]-np.maximum(linear[...,0],linear[...,2]))/np.maximum(.005,linear[...,1])
                cloth_mask=np.clip((green-.12)/.23,0,1)
                cloth_mask=cloth_mask*cloth_mask*(3-2*cloth_mask)
                luminance=linear@np.array([.2126,.7152,.0722])
                cloth=np.array(palette)**2.2*np.clip(luminance/.22,.15,2)[...,None]
                linear=linear*(1-cloth_mask[...,None])+cloth*cloth_mask[...,None]
                color=np.clip(linear,0,1)**(1/2.2)*255
            color=np.uint8(np.clip(color*shade,0,255))
            pixels[lo[1]:hi[1]+1,lo[0]:hi[0]+1][mask]=color[mask]
        labels.append(((column*400+20,row*500+20),sample['pose'].upper()+(' / FRONT' if row==0 else ' / BACK')))
image=Image.fromarray(pixels)
draw=ImageDraw.Draw(image)
for point, label in labels: draw.text(point,label,fill='#d5d0bc')
draw.text((20, 1010), 'ISOLATED ASSET INSPECTION - CPU albedo + smooth shading; NOT a game screenshot. Game lighting and floor IK absent.', fill='#d5d0bc')
image.save(ROOT / 'logs/performance-contact-sheet.png')
print(ROOT / 'logs/performance-contact-sheet.png')
