"""Losslessly share/compress the Knight's embedded PNGs after Blender export.

Pixel values, normals, skin weights and geometry are unchanged. External maps
avoid shipping two identical sets of 2K images for the two character palettes.
"""
from pathlib import Path
import copy
import io
import json
import struct
from PIL import Image
from compile_performance_assets import Builder, OUT


def optimize(path):
    raw=path.read_bytes();length=struct.unpack_from('<I',raw,12)[0]
    doc=json.loads(raw[20:20+length]);binary=raw[28+length:]
    image_views={image['bufferView'] for image in doc['images']}
    builder=Builder();mapping={}
    for index,view in enumerate(doc['bufferViews']):
        if index in image_views:continue
        start=view.get('byteOffset',0)
        new_index=builder.blob(binary[start:start+view['byteLength']]);mapping[index]=new_index
        for key in ('byteStride','target'):
            if key in view:builder.doc['bufferViews'][new_index][key]=view[key]
    for entry in doc['accessors']:
        assert 'sparse' not in entry
        if 'bufferView' in entry:entry['bufferView']=mapping[entry['bufferView']]
    for image in doc['images']:
        view=doc['bufferViews'][image.pop('bufferView')];start=view.get('byteOffset',0)
        pixels=Image.open(io.BytesIO(binary[start:start+view['byteLength']]))
        output=io.BytesIO();pixels.save(output,format='PNG',optimize=True)
        encoded=output.getvalue()
        assert Image.open(io.BytesIO(encoded)).tobytes()==pixels.tobytes()
        name='knight-'+image['name']+'.png'
        (OUT/'textures'/name).write_bytes(encoded)
        image.pop('mimeType',None);image['uri']='textures/'+name
    views=builder.doc['bufferViews'];builder.doc=doc;builder.doc['bufferViews']=views
    builder.doc['asset']['generator']='ASHEN VOW licensed Knight pipeline / Blender 4.5'
    builder.write(path)


if __name__=='__main__':
    for character in ('rayan','warden'):optimize(OUT/f'{character}.glb')
