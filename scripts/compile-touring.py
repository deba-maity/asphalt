"""Convert Mike Pan's licensed BMW27 scene into a bounded, articulated runtime asset.

Run Blender in background with --disable-autoexec. Source scripts are never run.
The adapted model is CC BY-SA 3.0; see public/assets/touring/LICENSE.txt.
"""
from pathlib import Path
import bpy, json, math
from mathutils import Matrix, Vector

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'artifacts/asset-sources/bmw-source.blend'
OUTPUT=ROOT/'public/assets/touring'
OUTPUT.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(SOURCE),load_ui=False,use_scripts=False)
for obj in bpy.data.objects:
    for mod in obj.modifiers:
        if mod.type=='SUBSURF':
            mod.levels=min(mod.levels,2 if obj.name=='carShell' else 1)
            mod.render_levels=mod.levels
bpy.context.view_layer.update()
deps=bpy.context.evaluated_depsgraph_get()
source_collection=bpy.data.collections['1M']
shell=bpy.data.objects['carShell']
evaluated=shell.evaluated_get(deps)
coordinates=[evaluated.matrix_world@v.co for v in evaluated.to_mesh().vertices]
low=min(v.x for v in coordinates);high=max(v.x for v in coordinates)
center=(low+high)/2
scale=4.7/(high-low)
# Local Blender -Y becomes glTF -Z. Source front is -X.
rotation=Matrix(((0,1,0,0),(-1,0,0,0),(0,0,1,0),(0,0,0,1)))
transform=Matrix.Scale(scale,4)@rotation@Matrix.Translation((-center,0,0))
export_collection=bpy.data.collections.new('NIGHTSHIFT_EXPORT');bpy.context.scene.collection.children.link(export_collection)
created=[]

def material(name,color,rough=.4,metal=0,emission=0):
    m=bpy.data.materials.new('NS_'+name);m.use_nodes=True
    bsdf=m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value=(*color,1)
    bsdf.inputs['Roughness'].default_value=rough;bsdf.inputs['Metallic'].default_value=metal
    if name=='paint': bsdf.inputs['Coat Weight'].default_value=.6;bsdf.inputs['Coat Roughness'].default_value=.18
    if emission: bsdf.inputs['Emission Color'].default_value=(*color,1);bsdf.inputs['Emission Strength'].default_value=emission
    return m

materials={
 'paint':material('paint',(.55,.55,.55),.28,.6),
 'rubber':material('rubber',(.018,.021,.026),.78),
 'trim':material('trim',(.022,.027,.035),.44,.15),
 'chrome':material('chrome',(.4,.45,.5),.25,.8),
 'glass':material('glass',(.021,.040,.054),.13,.45),
 'headlamp':material('headlamp',(.65,.83,1),.3,.1,2),
 'taillamp':material('taillamp',(.36,.007,.012),.26,.15,.8),
 'brake':material('brake',(.25,.035,.025),.45,.4),
}
def category(name):
    if name=='CarShellNew':return 'paint'
    if 'TireRubber' in name:return 'rubber'
    if name=='Tailight':return 'taillamp'
    if 'AngelEye' in name or name=='HeadLightGlass':return 'headlamp'
    if 'Glass' in name:return 'glass'
    if name=='Brake':return 'brake'
    if 'Chrome' in name or name=='BMWSilver':return 'chrome'
    return 'trim'

def group(name,position=Vector((0,0,0))):
    obj=bpy.data.objects.new(name,None);export_collection.objects.link(obj);obj.location=position;created.append(obj);return obj

body=group('Chassis')
def bake(original,matrix,parent,part_name):
    obj_eval=original.evaluated_get(deps)
    mesh=bpy.data.meshes.new_from_object(obj_eval,depsgraph=deps)
    conversion=Matrix.Translation(-parent.location)@transform@matrix
    mesh.transform(conversion)
    if conversion.determinant()<0:mesh.flip_normals()
    obj=bpy.data.objects.new(part_name,mesh);export_collection.objects.link(obj);obj.parent=parent
    # Replace Cycles-only node graphs with inexpensive glTF PBR materials.
    slots=[('chrome' if original.name=='brakeAssembly' else category(m.name)) if m else 'trim' for m in mesh.materials]
    mesh.materials.clear()
    for key in slots or ['trim']:mesh.materials.append(materials[key])
    created.append(obj)
    if len(mesh.vertices)>4000:
        bpy.context.view_layer.objects.active=obj;obj.select_set(True)
        decimate=obj.modifiers.new('Runtime mesh budget','DECIMATE');decimate.ratio=.6 if original.name=='carShell' else .32
        bpy.ops.object.modifier_apply(modifier=decimate.name);obj.select_set(False)
    return obj

omitted={'RoundelBack','RoundelFront','MStreak','plate','lightsGlass'}
for obj in source_collection.objects:
    if obj.type=='MESH' and obj.name not in omitted:
        bake(obj,obj.evaluated_get(deps).matrix_world.copy(),body,obj.name)

wheel_metadata=[]
wheel_source=bpy.data.objects['Tire3']
brake_source=bpy.data.objects['Brake3']
base_wheel=wheel_source.matrix_world.copy()
base_brake=brake_source.matrix_world.copy()
wheel_centers={i:bpy.data.objects['Tire'+str(i)].matrix_world.translation.copy() for i in range(1,5)}
for index in range(1,5):
    inst=bpy.data.objects['Tire'+str(index)]
    center_world=wheel_centers[index]
    position=transform@center_world
    # The showcase rig has steered front wheels. Reuse its straight rear-wheel
    # assembly and mirror the complete left side, including spoke orientation.
    reflection=Matrix.Diagonal((1,-1 if center_world.y>0 else 1,1,1))
    placement=Matrix.Translation(center_world)@reflection@Matrix.Translation(-base_wheel.translation)
    name=['Wheel_FL','Wheel_FR','Wheel_RR','Wheel_RL'][index-1]
    pivot=group(name,position)
    for source in wheel_source.instance_collection.objects:
        if source.name=='TireRoundel':continue
        matrix=placement@base_wheel@Matrix.Translation(-wheel_source.instance_collection.instance_offset)@source.matrix_world
        bake(source,matrix,pivot,name+'_'+source.name)
    fixed=group(name+'_Brake',position)
    for source in brake_source.instance_collection.objects:
        matrix=placement@base_brake@Matrix.Translation(-brake_source.instance_collection.instance_offset)@source.matrix_world
        bake(source,matrix,fixed,name+'_'+source.name)
    # Keep the caliper on the steering pivot; only tyre/rim geometry spins.
    fixed.parent=pivot;fixed.location=Vector((0,0,0))
    wheel_metadata.append(dict(name=name,position=[position.x,position.z,-position.y],front=index<=2,radius=.47*scale))

# Put the tyre contact plane on zero. Keep pivot axes uniform for runtime spin.
bpy.context.view_layer.update()
lowest=min((o.matrix_world@v.co).z for o in created if o.type=='MESH' for v in o.data.vertices)
for obj in created:
    if obj.parent is None:obj.location.z-=lowest
for wheel in wheel_metadata:wheel['position'][1]-=lowest
bpy.context.view_layer.update()
for obj in bpy.context.scene.objects:obj.select_set(False)
for obj in created:obj.select_set(True)
bpy.context.view_layer.objects.active=body
bpy.ops.export_scene.gltf(filepath=str(OUTPUT/'touring.glb'),export_format='GLB',use_selection=True,
    export_apply=True,export_animations=False,export_cameras=False,export_lights=False,
    export_copyright='BMW 1 Series M by Mike Pan; NIGHTSHIFT adaptation CC BY-SA 3.0; https://blendswap.com/blend/4066')
stats={'length':4.7,'wheels':wheel_metadata,'vertices':sum(len(o.data.vertices) for o in created if o.type=='MESH'),
       'scope':'Single car; rescaled, rematerialed, badge meshes omitted, wheel pivots separated; no source scripts executed'}
(OUTPUT/'rig.json').write_text(json.dumps(stats,indent=2)+'\n',encoding='utf-8')
print('NIGHTSHIFT TOURING',json.dumps(stats))

# The second representation retains the same pivots and silhouette but spends
# fewer vertices on cars beyond close inspection distance. No texture atlases
# or extra render passes are needed for the transition.
for obj in created:
    if obj.type!='MESH' or len(obj.data.vertices)<120: continue
    bpy.context.view_layer.objects.active=obj
    decimate=obj.modifiers.new('Distance detail','DECIMATE');decimate.ratio=.22
    bpy.ops.object.modifier_apply(modifier=decimate.name)
bpy.ops.export_scene.gltf(filepath=str(OUTPUT/'touring-low.glb'),export_format='GLB',use_selection=True,
    export_apply=True,export_animations=False,export_cameras=False,export_lights=False,
    export_copyright='BMW 1 Series M by Mike Pan; NIGHTSHIFT adaptation CC BY-SA 3.0; https://blendswap.com/blend/4066')
stats['distance_vertices']=sum(len(o.data.vertices) for o in created if o.type=='MESH')
(OUTPUT/'rig.json').write_text(json.dumps(stats,indent=2)+'\n',encoding='utf-8')
print('NIGHTSHIFT DISTANCE DETAIL',stats['distance_vertices'])
