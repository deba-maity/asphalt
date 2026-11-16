"""Extract authored root displacement, not guessed lunge velocities, from CC0 UAL."""
from pathlib import Path
import json
import numpy as np
from compile_performance_assets import Source, CACHE, OUT

curves = {}
for path in (CACHE / 'full-motion').glob('*_RM.glb'):
    source = Source(path)
    for animation in source.doc['animations']:
        name = animation['name'].removesuffix('_Loop')
        if not (name.startswith(('Jog_', 'Walk_', 'Sword_', 'Sprint', 'Dodge_')) or name == 'Roll'):
            continue
        for channel in animation['channels']:
            target = channel['target']
            if source.doc['nodes'][target['node']].get('name') != 'root' or target['path'] != 'translation':
                continue
            sampler = animation['samplers'][channel['sampler']]
            times = source.array(sampler['input']).flatten()
            positions = source.array(sampler['output'])
            positions = positions - positions[0]
            # Asset forward is +Z. Figure's model container turns it through PI.
            positions[:, 0] *= -1
            positions[:, 2] *= -1
            curves[name] = {'duration': float(times[-1]),
                            'distance': float(np.linalg.norm(positions[-1, [0, 2]])),
                            'keys': [[round(float(t), 6)] + [round(float(v), 6) for v in p]
                                     for t, p in zip(times, positions)]}
(OUT / 'root_motion.json').write_text(json.dumps(curves, separators=(',', ':')), encoding='utf-8')
print(f'Extracted {len(curves)} authored root curves')
