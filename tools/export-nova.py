"""Đấu Trường Tân Tinh (bundle `lua_novaarena`) -> dist/nova.json.

Đọc nguyên từ cache HTTH: mọi sprite của novaarena/images (khóa theo tên), 24 prefab (NovaRoot, NovaBattle, NovaBracket,
NovaTop, các popup / ô) và Spine island_battle. Luật nằm ở server gốc (NOVA_*), client chỉ có giao diện: xem server/nova.mjs.
Inputs are read only; assets.json is merged.
"""
from pathlib import Path
import json, sys, runpy

web=Path(__file__).resolve().parents[1]
sys.argv=[sys.argv[0],'none']
m=runpy.run_path(str(web/'tools/export-mermaid.py'))
scope,prefab,files=m['scope'],m['prefab'],m['files']
bundle={}
for f in files['lua_novaarena']:
    for path,obj in getattr(f,'container',{}).items():bundle[path.lower()]=obj.deref() if hasattr(obj,'deref') else obj
art={Path(p).stem:scope['save_image'](o) for p,o in bundle.items() if o.type.name=='Sprite'}
names=sorted({o.read().m_Name for p,o in bundle.items() if p.endswith('.prefab')})
prefabs={n:prefab('lua_novaarena',n) for n in names}
class Ref:
    def __init__(s,o):s.o=o;s.m_PathID=o.path_id
    def deref(s):return s.o
spines={Path(p).name.replace('_skeletondata.asset',''):scope['skeleton'](Ref(o)) for p,o in bundle.items() if p.endswith('_skeletondata.asset')}
result={'art':art,'prefabs':prefabs,'spines':spines}
(web/'dist/nova.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
merged=json.loads((web/'dist/assets.json').read_text(encoding='utf-8'));merged.update(scope['assets'])
(web/'dist/assets.json').write_text(json.dumps(merged,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print('spines',list(spines),'art',len(art),'prefabs',list(prefabs),flush=True)
