"""Extract authored root displacement, not guessed lunge velocities, from CC0 UAL."""
from pathlib import Path
import json
import math
import numpy as np
from compile_performance_assets import Source, CACHE, OUT

curves = {}
for path in (CACHE / 'full-motion').glob('*_RM.glb'):
    source = Source(path)
    for animation in source.doc['animations']:
        name = animation['name'].removesuffix('_Loop')
        if not (name.startswith(('Jog_', 'Walk_', 'Sword_', 'Sprint', 'Dodge_', 'Turn90_')) or name == 'Roll'):
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
        if name.startswith('Turn90_'):
            for channel in animation['channels']:
                target = channel['target']
                if source.doc['nodes'][target['node']].get('name') != 'root' or target['path'] != 'rotation':
                    continue
                sampler = animation['samplers'][channel['sampler']]
                times = source.array(sampler['input']).flatten()
                rotations = source.array(sampler['output'])
                inverse = rotations[0].copy(); inverse[:3] *= -1
                yaw = []
                for q in rotations:
                    vector = q[3]*inverse[:3]+inverse[3]*q[:3]+np.cross(q[:3], inverse[:3])
                    scalar = q[3]*inverse[3]-np.dot(q[:3], inverse[:3])
                    yaw.append(2*math.atan2(float(vector[1]), float(scalar)))
                curves.setdefault(name, {'duration': float(times[-1]), 'distance': 0, 'keys': [[0, 0, 0, 0]]})
                curves[name]['yaw'] = [[round(float(t), 6), round(y, 6)] for t, y in zip(times, yaw)]
(OUT / 'root_motion.json').write_text(json.dumps(curves, separators=(',', ':')), encoding='utf-8')
print(f'Extracted {len(curves)} authored root curves')
