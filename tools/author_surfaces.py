"""Bake original, seamless material maps. Offline only; no downloaded assets.

Run: python tools/author_surfaces.py (requires numpy and Pillow).
Deterministic periodic noise, masonry joints, grain, and woven threads.
"""
from pathlib import Path
import numpy as np
from PIL import Image

OUT = Path(__file__).resolve().parents[1] / 'game/assets/surfaces'
SIZE = 512
rng = np.random.default_rng(85171)
y, x = np.mgrid[:SIZE, :SIZE] / SIZE


def noise():
    field = np.zeros((SIZE, SIZE))
    for frequency, amplitude in [(2, .20), (5, .13), (13, .065), (37, .025), (103, .012)]:
        for _ in range(5):
            a, b = rng.integers(-frequency, frequency + 1, 2)
            field += np.cos(2*np.pi*(a*x+b*y)+rng.random()*2*np.pi)*amplitude/5
    return field


def save(name, height, tint, contrast=.5, normal_strength=6):
    diffuse = np.clip((.73 + height[..., None]*contrast)*np.array(tint), 0, 255).astype('uint8')
    Image.fromarray(diffuse).save(OUT / f'{name}.png')
    dx = (np.roll(height, -1, 1)-np.roll(height, 1, 1))*normal_strength
    dy = (np.roll(height, -1, 0)-np.roll(height, 1, 0))*normal_strength
    normals = np.stack([-dx, dy, np.ones_like(dx)], -1)
    normals /= np.linalg.norm(normals, axis=-1, keepdims=True)
    Image.fromarray(np.uint8(np.clip(normals*.5+.5, 0, 1)*255)).save(OUT / f'{name}_normal.png')


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    n = noise()
    save('earth', n + noise()*.5, (215, 207, 187), .9, 10)
    rows = np.floor(y*8)
    u = (x*4 + (rows % 2)*.5) % 1
    v = y*8 % 1
    joints = np.minimum(np.minimum(u, 1-u)*.7, np.minimum(v, 1-v))
    bevel = np.clip(joints/.06, 0, 1)
    stone = bevel*.30-.23+n*.7 + np.sin(np.floor(u*4)+rows*31)*.025
    save('stone', stone, (225, 224, 212), .85, 5)
    grain = np.sin(2*np.pi*(x*29 + .3*np.sin(y*2*np.pi) + n))*.035
    grain += np.sin(2*np.pi*(x*97+n))*.015
    seams = np.minimum(x*6 % 1, 1-x*6 % 1)
    save('wood', n*.45 + grain - np.exp(-seams*120)*.18, (212, 191, 162), 1.2, 7)
    weave = (np.cos(x*2*np.pi*128)*np.cos(y*2*np.pi*128))*.035
    save('cloth', n*.35 + weave, (233, 230, 219), .8, 2)
    pores = rng.random((SIZE, SIZE))*.04
    save('leather', n*.4+pores, (220, 208, 187), 1.1, 4)
    save('plaster', n*.8+pores, (238, 233, 218), .65, 3)
    save('steel', n*.25 + np.sin(x*2*np.pi*187)*.009, (231, 235, 239), .5, 2)
    print(f'Authored 14 seamless color/normal maps in {OUT}')


if __name__ == '__main__':
    main()
