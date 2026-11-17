"""Blender background build of piacenti's CC-BY-3.0 Knight on a CC0 motion rig.

Run with --background --factory-startup --disable-autoexec and the verified
armor.blend source. See assets/performance/KNIGHT_LICENSE.txt for provenance.
Only the named mesh and four armor maps are exported; no source scene scripts,
cameras, lights, shield or unrelated packed photographs enter the game.
"""
import bpy
import bmesh
import json
import math
from pathlib import Path
from mathutils import Matrix, Vector

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'game/assets/performance'
reference=json.loads((ROOT/'tools/art/knight_rig_reference.json').read_text())
body=bpy.data.objects['Group61487']
for ob in list(bpy.data.objects):
    if ob!=body: bpy.data.objects.remove(ob,do_unlink=True)
bpy.context.view_layer.objects.active=body
body.select_set(True)
bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)

# The shield is a disconnected island inside the artist's main object.
bm=bmesh.new();bm.from_mesh(body.data)
unvisited=set(bm.verts);islands=[]
while unvisited:
    first=unvisited.pop();stack=[first];island=[]
    while stack:
        v=stack.pop();island.append(v)
        for edge in v.link_edges:
            other=edge.other_vert(v)
            if other in unvisited: unvisited.remove(other);stack.append(other)
    islands.append(island)
shield=[group for group in islands if len(group)==930]
assert len(shield)==1, 'Unexpected source topology: shield must be reviewed'
bmesh.ops.delete(bm,geom=shield[0],context='VERTS')
bm.to_mesh(body.data);bm.free()
floor=min(v.co.z for v in body.data.vertices)
scale=1.85/(max(v.co.z for v in body.data.vertices)-floor)
for v in body.data.vertices:
    v.co=Vector((v.co.x*scale,v.co.y*scale,(v.co.z-floor)*scale))

# Fit landmarks in the artist's A pose, then transform the mesh into a T bind
# pose. The animation source uses T-pose arms; this avoids baking an A-pose
# shoulder offset into every sword clip.
a_heads={
    'root':(0,0,0),'pelvis':(0,.025,1.00),
    'spine_01':(0,0,1.10),'spine_02':(0,0,1.22),
    'spine_03':(0,0,1.35),'neck_01':(0,.015,1.565),
    'Head':(0,.01,1.64),
}
t_heads=dict(a_heads)
a_rot={};t_rot={}
for name,item in reference.items():
    a_rot[name]=Matrix(item['matrix']).to_3x3()
    t_rot[name]=a_rot[name].copy()
for side,sign in [('l',1),('r',-1)]:
    a_heads.update({
        'clavicle_'+side:(sign*.04,0,1.49),
        'upperarm_'+side:(sign*.245,.01,1.445),
        'lowerarm_'+side:(sign*.455,.015,1.275),
        'hand_'+side:(sign*.603,.01,1.135),
        'thigh_'+side:(sign*.145,.025,.995),
        'calf_'+side:(sign*.173,.01,.565),
        'foot_'+side:(sign*.183,.055,.14),
        'ball_'+side:(sign*.183,-.10,.045),
        'ball_leaf_'+side:(sign*.183,-.19,.045),
    })
    t_heads.update({n:p for n,p in a_heads.items() if n.endswith('_'+side)})
    lengths=[(Vector(a_heads['upperarm_'+side])-Vector(a_heads['lowerarm_'+side])).length,(Vector(a_heads['lowerarm_'+side])-Vector(a_heads['hand_'+side])).length]
    t_heads['lowerarm_'+side]=(sign*(.245+lengths[0]),.015,1.445)
    t_heads['hand_'+side]=(sign*(.245+sum(lengths)),.01,1.445)
    for stem,child in [('upperarm','lowerarm'),('lowerarm','hand')]:
        name=stem+'_'+side
        src=Vector(reference[child+'_'+side]['head'])-Vector(reference[name]['head'])
        dst=Vector(a_heads[child+'_'+side])-Vector(a_heads[name])
        a_rot[name]=src.rotation_difference(dst).to_matrix()@t_rot[name]
    hand='hand_'+side
    hand_turn=Matrix.Rotation(sign*math.radians(54),3,'Y')
    a_rot[hand]=hand_turn@t_rot[hand]
    for name,item in reference.items():
        if not name.endswith('_'+side) or name.split('_')[0] not in ('index','middle','ring','pinky','thumb'): continue
        offset=(Vector(item['head'])-Vector(reference[hand]['head']))*.75
        a_heads[name]=Vector(a_heads[hand])+hand_turn@offset
        t_heads[name]=Vector(t_heads[hand])+offset
        a_rot[name]=hand_turn@t_rot[name]

def transform(rotation,position):
    result=rotation.to_4x4();result.translation=Vector(position);return result
a_matrices={n:transform(a_rot[n],a_heads[n]) for n in reference}
t_matrices={n:transform(t_rot[n],t_heads[n]) for n in reference}
corrections={n:t_matrices[n]@a_matrices[n].inverted() for n in reference}

def smooth(a,b,value):
    t=max(0,min(1,(value-a)/(b-a)));return t*t*(3-2*t)

def mix_weights(first,second,weight):
    return {first:1-weight,second:weight}

def segment_distance(p,a,b):
    d=b-a;u=max(0,min(1,(p-a).dot(d)/max(1e-9,d.length_squared)))
    return (p-a-d*u).length

def skin_weights(p):
    x,y,z=p;side='l' if x>=0 else 'r';ax=abs(x)
    # Helm, cuirass and greaves retain rigid plate surfaces. Deformation is
    # confined to the chainmail/joint bands rather than bending entire plates.
    if z>1.59 and ax<.19:return {'Head':1}
    if z>1.51 and ax<.145:return mix_weights('spine_03','Head',smooth(1.51,1.60,z))
    if ax>.16 and z>1.43 and ax<.43:
        return {'clavicle_'+side:.7,'upperarm_'+side:.3}
    if ax>.27 and z>1.01:
        upper='upperarm_'+side;lower='lowerarm_'+side;hand='hand_'+side
        wrist=Vector(a_heads[hand]);elbow=Vector(a_heads[lower]);direction=(wrist-elbow).normalized()
        along=(p-wrist).dot(direction)
        if along>-.025:
            candidates=[hand]+[n for n in reference if n.endswith('_'+side) and n.split('_')[0] in ('index','middle','ring','pinky','thumb') and 'leaf' not in n]
            distances=[]
            for n in candidates:
                children=[c for c,i in reference.items() if i['parent']==n]
                end=Vector(a_heads[children[0]]) if children else Vector(a_heads[n])+a_rot[n].col[1]*.02
                distances.append((segment_distance(p,Vector(a_heads[n]),end),n))
            distances.sort();chosen=distances[:2]
            weights={n:1/max(.008,d)**4 for d,n in chosen};total=sum(weights.values())
            return {n:w/total for n,w in weights.items()}
        toward=Vector(a_heads[lower])-Vector(a_heads[upper])
        joint=(p-elbow).dot(toward.normalized())
        return mix_weights(upper,lower,smooth(-.035,.035,joint))
    if z>=1.23:return {'spine_03':1}
    if z>=1.16:return mix_weights('spine_02','spine_03',smooth(1.16,1.23,z))
    if z>=1.07:return {'spine_02':1}
    if z>=.94:return mix_weights('pelvis','spine_02',smooth(1.03,1.09,z))
    if z>=.82:return mix_weights('thigh_'+side,'pelvis',smooth(.82,.94,z))
    if z>=.58:return {'thigh_'+side:1}
    if z>=.50:return mix_weights('calf_'+side,'thigh_'+side,smooth(.50,.58,z))
    if z>=.22:return {'calf_'+side:1}
    if z>=.13:return mix_weights('foot_'+side,'calf_'+side,smooth(.13,.22,z))
    return {'foot_'+side:1}

groups={n:body.vertex_groups.new(name=n) for n in reference}
for vertex in body.data.vertices:
    p=vertex.co.copy();weights=skin_weights(p)
    vertex.co=sum((corrections[n]@p*w for n,w in weights.items()),Vector())
    for name,weight in weights.items():
        if weight>1e-7:groups[name].add([vertex.index],weight,'REPLACE')
body.data.update()
body.name='Knight_Armor'

arm=bpy.data.objects.new('KnightRig',bpy.data.armatures.new('KnightSkeleton'))
bpy.context.scene.collection.objects.link(arm)
bpy.ops.object.select_all(action='DESELECT');arm.select_set(True);bpy.context.view_layer.objects.active=arm
bpy.ops.object.mode_set(mode='EDIT')
for name,item in reference.items():
    bone=arm.data.edit_bones.new(name);bone.head=t_heads[name]
    bone.tail=bone.head+t_rot[name].col[1]*max(.025,(Vector(item['tail'])-Vector(item['head'])).length)
    bone.matrix=t_matrices[name]
for name,item in reference.items():
    if item['parent']:arm.data.edit_bones[name].parent=arm.data.edit_bones[item['parent']]
bpy.ops.object.mode_set(mode='OBJECT')
modifier=body.modifiers.new('ArmorSkin','ARMATURE');modifier.object=arm;body.parent=arm

mat=bpy.data.materials.new('Knight_ForgedSteel');mat.use_nodes=True
nodes=mat.node_tree.nodes;links=mat.node_tree.links;bs=nodes.get('Principled BSDF')
for image_name,socket in [('armor_default_color.png','Base Color'),('armor_default_metalness.png','Metallic'),('armor_default_rough.png','Roughness'),('armor_default_nmap.png','Normal')]:
    texture=nodes.new('ShaderNodeTexImage');texture.image=bpy.data.images[image_name]
    if socket!='Base Color':texture.image.colorspace_settings.name='Non-Color'
    if socket=='Normal':
        normal=nodes.new('ShaderNodeNormalMap');links.new(texture.outputs['Color'],normal.inputs['Color']);links.new(normal.outputs['Normal'],bs.inputs[socket])
    else:links.new(texture.outputs['Color'],bs.inputs[socket])
body.data.materials.clear();body.data.materials.append(mat)
for polygon in body.data.polygons:polygon.use_smooth=True
bpy.ops.object.select_all(action='DESELECT');body.select_set(True);arm.select_set(True)
for character in ('rayan','warden'):
    bpy.ops.export_scene.gltf(filepath=str(OUT/f'{character}.glb'),export_format='GLB',use_selection=True,export_animations=False,export_yup=True,export_apply=False,export_skins=True,export_all_influences=False)
print('KNIGHT BUILD: vertices',len(body.data.vertices),'bones',len(arm.data.bones),'shield excluded; four licensed surface maps')
