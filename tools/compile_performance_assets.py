"""Compile CC0 characters and motion into GLBs with shared external textures.

Source archives are cached by fetch_performance_assets.py. No Blender or art tools
are required at runtime. Keeps original image pixels; Godot controls import size.
"""
from pathlib import Path
import copy
import json
import struct
import hashlib
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / 'tools/cache/art-pipeline'
OUT = ROOT / 'game/assets/performance'
DTYPES = {5120: 'i1', 5121: 'u1', 5122: '<i2', 5123: '<u2', 5125: '<u4', 5126: '<f4'}
WIDTHS = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}


class Source:
    def __init__(self, path):
        self.path = path
        raw = path.read_bytes()
        if path.suffix == '.glb':
            length = struct.unpack_from('<I', raw, 12)[0]
            self.doc = json.loads(raw[20:20+length])
            self.buffers = [raw[28+length:]]
        else:
            self.doc = json.loads(raw)
            self.buffers = [(path.parent/b['uri']).read_bytes() for b in self.doc['buffers']]

    def array(self, index):
        a = self.doc['accessors'][index]
        v = self.doc['bufferViews'][a['bufferView']]
        dtype = np.dtype(DTYPES[a['componentType']]); width = WIDTHS[a['type']]
        offset = v.get('byteOffset', 0)+a.get('byteOffset', 0)
        stride = v.get('byteStride', width*dtype.itemsize)
        result = np.ndarray((a['count'], width), dtype, buffer=self.buffers[v.get('buffer', 0)], offset=offset, strides=(stride, dtype.itemsize)).copy()
        if a.get('normalized'):
            result = result.astype(np.float32)/np.iinfo(dtype).max
        return result

    def image(self, index):
        entry = self.doc['images'][index]
        if 'uri' in entry:
            path = self.path.parent/entry['uri']
            return path.read_bytes(), 'image/jpeg' if path.suffix.lower() in ('.jpg', '.jpeg') else 'image/png'
        view = self.doc['bufferViews'][entry['bufferView']]
        start = view.get('byteOffset', 0)
        return self.buffers[view.get('buffer', 0)][start:start+view['byteLength']], entry['mimeType']


class Builder:
    def __init__(self):
        self.binary = bytearray()
        self.doc = dict(asset={'version': '2.0', 'generator': 'ASHEN VOW CC0 asset compiler'}, buffers=[], bufferViews=[], accessors=[], materials=[], textures=[], images=[], samplers=[])

    def blob(self, data):
        while len(self.binary) % 4: self.binary.append(0)
        index = len(self.doc['bufferViews'])
        self.doc['bufferViews'].append(dict(buffer=0, byteOffset=len(self.binary), byteLength=len(data)))
        self.binary.extend(data)
        return index

    def array(self, array, kind=None, component=5126):
        array = np.asarray(array, dtype=DTYPES[component])
        width = array.shape[1] if array.ndim > 1 else 1
        kind = kind or {1: 'SCALAR', 2: 'VEC2', 3: 'VEC3', 4: 'VEC4', 16: 'MAT4'}[width]
        entry = dict(bufferView=self.blob(array.tobytes()), componentType=component, count=len(array), type=kind)
        if kind in ('SCALAR', 'VEC3') and len(array):
            entry.update(min=array.reshape(len(array), -1).min(axis=0).tolist(), max=array.reshape(len(array), -1).max(axis=0).tolist())
        self.doc['accessors'].append(entry)
        return len(self.doc['accessors'])-1

    def materials(self, source):
        image_offset = len(self.doc['images']); texture_offset = len(self.doc['textures']); material_offset = len(self.doc['materials'])
        for i in range(len(source.doc.get('images', []))):
            data, mime = source.image(i)
            name=hashlib.sha256(data).hexdigest()[:20]+('.jpg' if mime=='image/jpeg' else '.png')
            (OUT/'textures').mkdir(exist_ok=True)
            (OUT/'textures'/name).write_bytes(data)
            self.doc['images'].append(dict(uri='textures/'+name, name=source.doc['images'][i].get('name', source.path.stem+str(i))))
        for texture in source.doc.get('textures', []):
            self.doc['textures'].append(dict(source=texture['source']+image_offset))
        for material in source.doc.get('materials', []):
            m = copy.deepcopy(material)
            for key in ('normalTexture', 'occlusionTexture', 'emissiveTexture'):
                if key in m: m[key]['index'] += texture_offset
            for key in ('baseColorTexture', 'metallicRoughnessTexture'):
                if key in m.get('pbrMetallicRoughness', {}): m['pbrMetallicRoughness'][key]['index'] += texture_offset
            self.doc['materials'].append(m)
        return material_offset

    def write(self, path):
        while len(self.binary) % 4: self.binary.append(0)
        self.doc['buffers'] = [dict(byteLength=len(self.binary))]
        data = json.dumps(self.doc, separators=(',', ':')).encode()
        data += b' '*((-len(data)) % 4)
        total = 12+8+len(data)+8+len(self.binary)
        path.write_bytes(struct.pack('<III', 0x46546c67, 2, total)+struct.pack('<II', len(data), 0x4e4f534a)+data+struct.pack('<II', len(self.binary), 0x004e4942)+self.binary)
        print(path.name, total, 'bytes')


def character(gender, destination):
    outfit = Source(next((CACHE/'extracted').rglob(gender+'_Ranger.gltf')))
    base = Source(next((CACHE/'extracted').rglob('Superhero_'+gender+'_FullBody.gltf')))
    b = Builder(); b.doc['nodes'] = copy.deepcopy(outfit.doc['nodes']); b.doc['scenes'] = copy.deepcopy(outfit.doc['scenes']); b.doc['scene'] = 0
    skin = copy.deepcopy(outfit.doc['skins'][0]); skin['inverseBindMatrices'] = b.array(outfit.array(skin['inverseBindMatrices']), 'MAT4'); b.doc['skins'] = [skin]
    b.doc['meshes'] = []
    target_bones = {outfit.doc['nodes'][node]['name']: i for i, node in enumerate(outfit.doc['skins'][0]['joints'])}
    source_names = [base.doc['nodes'][node]['name'] for node in base.doc['skins'][0]['joints']]
    bone_map = np.array([target_bones[name] for name in source_names], dtype=np.uint16)
    source_bind = base.array(base.doc['skins'][0]['inverseBindMatrices']).reshape(-1, 4, 4).transpose(0, 2, 1)
    target_bind = outfit.array(outfit.doc['skins'][0]['inverseBindMatrices']).reshape(-1, 4, 4).transpose(0, 2, 1)
    corrections = np.linalg.inv(target_bind[bone_map])@source_bind
    for source in (outfit, base):
        material_offset = b.materials(source)
        for mesh in source.doc['meshes']:
            result = dict(name=mesh.get('name', 'Head'), primitives=[])
            for primitive in mesh['primitives']:
                arrays = {name: source.array(index) for name, index in primitive['attributes'].items()}
                indices = source.array(primitive['indices']).reshape(-1).astype(np.uint32)
                if source is base:
                    joints = arrays['JOINTS_0'].astype(int); weights = arrays['WEIGHTS_0']
                    head_bones = [i for i, name in enumerate(source_names) if name in ('Head', 'neck_01')]
                    head_weight = (np.isin(joints, head_bones)*weights).sum(axis=1)
                    triangles = indices.reshape(-1, 3)
                    indices = triangles[(head_weight[triangles]>.65).all(axis=1)].reshape(-1)
                    if not len(indices): continue
                    points = np.concatenate([arrays['POSITION'], np.ones((len(joints), 1))], axis=1)
                    matrices = corrections[joints]
                    arrays['POSITION'] = (np.einsum('nkij,nj->nki', matrices, points)*weights[..., None]).sum(axis=1)[:, :3]
                    if 'NORMAL' in arrays:
                        normals = (np.einsum('nkij,nj->nki', matrices[:, :, :3, :3], arrays['NORMAL'])*weights[..., None]).sum(axis=1)
                        arrays['NORMAL'] = normals/np.maximum(np.linalg.norm(normals, axis=1, keepdims=True), 1e-8)
                    if 'TANGENT' in arrays:
                        tangents = (np.einsum('nkij,nj->nki', matrices[:, :, :3, :3], arrays['TANGENT'][:, :3])*weights[..., None]).sum(axis=1)
                        arrays['TANGENT'][:, :3] = tangents/np.maximum(np.linalg.norm(tangents, axis=1, keepdims=True), 1e-8)
                    arrays['JOINTS_0'] = bone_map[joints]
                used, remapped = np.unique(indices, return_inverse=True)
                attributes = {name: b.array(array[used], component=5123 if name.startswith('JOINTS') else 5126) for name, array in arrays.items()}
                result['primitives'].append(dict(attributes=attributes, indices=b.array(remapped, component=5125), material=primitive.get('material', 0)+material_offset))
            if not result['primitives']: continue
            mesh_id = len(b.doc['meshes']); b.doc['meshes'].append(result)
            if source is base:
                node = len(b.doc['nodes']); b.doc['nodes'].append(dict(name='Head_'+str(mesh_id), mesh=mesh_id, skin=0))
                b.doc['nodes'][b.doc['scenes'][0]['nodes'][0]]['children'].append(node)
    b.write(OUT/destination)


def motions():
    wanted = {'Idle_Loop', 'Sword_Idle', 'Sprint_Enter', 'Sprint_Loop', 'Sprint_Exit', 'Roll', 'Dodge_Left', 'Dodge_Right', 'Death01', 'Hit_Chest', 'Hit_Head', 'Hit_Shoulder_L', 'Hit_Shoulder_R', 'Drink', 'Idle_Talking_Loop', 'Turn90_L', 'Turn90_R', 'Sword_Block', 'Shield_OneShot', 'Sword_Heavy_A', 'Sword_Heavy_A_Rec', 'Sword_Regular_A', 'Sword_Regular_A_Rec', 'Sword_Regular_B', 'Sword_Regular_B_Rec', 'Sword_Regular_C', 'Sword_Light_A', 'Sword_Light_A_Rec', 'Sword_Dash'}
    wanted.update('Jog_'+d+'_Loop' for d in ('Fwd', 'Bwd', 'Left', 'Right', 'Fwd_L', 'Fwd_R', 'Bwd_L', 'Bwd_R'))
    wanted.update('Walk_'+d+'_Loop' for d in ('Fwd', 'Bwd', 'L', 'R', 'Fwd_L', 'Fwd_R', 'Bwd_L', 'Bwd_R'))
    inventory=[]
    for number in (1, 2):
        source=Source(CACHE/'full-motion'/f'UAL{number}-UAL{number}.glb')
        b=Builder(); b.doc['nodes']=copy.deepcopy(source.doc['nodes']); b.doc['scenes']=copy.deepcopy(source.doc['scenes']); b.doc['scene']=0
        # Animation sources retain their skeleton hierarchy but omit mannequin geometry.
        for node in b.doc['nodes']: node.pop('mesh', None); node.pop('skin', None)
        # Keep a tiny skinned triangle so Godot imports a Skeleton3D consistently.
        skin=copy.deepcopy(source.doc['skins'][0]); skin['inverseBindMatrices']=b.array(source.array(skin['inverseBindMatrices']), 'MAT4'); b.doc['skins']=[skin]
        attributes={'POSITION':b.array([[0,0,0],[.001,0,0],[0,.001,0]]),'JOINTS_0':b.array([[0,0,0,0]]*3, component=5123),'WEIGHTS_0':b.array([[1,0,0,0]]*3)}
        b.doc['meshes']=[dict(primitives=[dict(attributes=attributes,indices=b.array([0,1,2],component=5123))])]
        node=len(b.doc['nodes']);b.doc['nodes'].append(dict(name='RigMarker',mesh=0,skin=0));b.doc['nodes'][b.doc['scenes'][0]['nodes'][0]]['children'].append(node)
        b.doc['animations']=[]
        for animation in source.doc.get('animations',[]):
            if animation['name'] not in wanted:continue
            result=copy.deepcopy(animation)
            for sampler in result['samplers']:
                for field in ('input','output'):sampler[field]=b.array(source.array(sampler[field]))
            b.doc['animations'].append(result)
            length=max(float(source.array(s['input']).max()) for s in animation['samplers'])
            inventory.append(dict(name=animation['name'],seconds=length,source=f'UAL{number}'))
        b.write(OUT/f'motion_source_{number}.glb')
    (OUT/'clip_inventory.json').write_text(json.dumps(inventory,indent=2)+'\n',encoding='utf-8')


if __name__ == '__main__':
    import argparse
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--legacy-characters',action='store_true',help='Explicitly rebuild the earlier ranger characters, replacing the current Knight assets')
    options=parser.parse_args()
    OUT.mkdir(parents=True,exist_ok=True)
    if options.legacy_characters:
        character('Male','rayan.glb')
        character('Female','warden.glb')
    motions()
