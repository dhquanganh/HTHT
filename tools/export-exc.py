"""Luyện hồn (EXC, bundle lua_ex/_pack2/eventlua2/exclusive) -> dist/exc.json.

  Resources/db_exc.json: open, unlockStar (10), serverDays, maxLevel (40), materials (Hải hồn 2201-2204),
      heroes (39 tướng: key = id db_heroes, tên kỹ năng, 4 bậc {unlock, text, stats}), levels 0-40
      {skill_level, material_level_up [3,1,id,n], point_level_data [[100 Công‰],[102 Máu‰],[3 Tốc]], fee_decay}.
  Prefabs/EXCPanelMain, EXCButton, EXCConsumeCostView, EXCPointView, EXCSkillDesc; Images/* (book, orb, ...);
  Images/Fire_eff (Spine Level0..Level4 trên nút). Nút dùng Spine Anim_thienphu (Button / Button2) của Thiên phú.
  db_heroes (database_ex): key -> avatar.
Inputs are read only; assets.json is merged.
"""
from pathlib import Path
import json, sys, runpy, UnityPy

web=Path(__file__).resolve().parents[1]
sys.argv=[sys.argv[0],'none']
m=runpy.run_path(str(web/'tools/export-mermaid.py'))
scope,prefab,files=m['scope'],m['prefab'],m['files']
cache=web.parent/'HTTH'
lua=UnityPy.load(str(next(cache.rglob('lua_ex/**/__data'))))
base='assets/resources/_pack2/eventlua2/exclusive/'
cont={p:o for p,o in lua.container.items() if p.startswith(base)}
def text(name):
    s=cont[base+name].read().m_Script;return (s if isinstance(s,str) else bytes(s).decode('utf-8')).lstrip('﻿')
db=json.loads(text('resources/db_exc.json'))
dbase=UnityPy.load(str(next(cache.rglob('database_ex/**/__data'))))
raw=next(p for n,p in dbase.container.items() if n.endswith('/db_heroes.txt')).read().m_Script
raw=raw if isinstance(raw,str) else raw.decode('utf-8');heroes={str(r['id']):r for r in json.loads(raw[raw.index('['):])}
for h in db['heroes']:h['avatar']=str(heroes[str(h['key'])]['avatar'])

ex=m['container']('lua_ex')
art={}
for path,obj in ex.items():
    if path.startswith(base+'images/') and obj.type.name=='Sprite':art[Path(path).stem]=scope['save_image'](obj)
# skeleton() nhận PPtr của SkeletonDataAsset trong môi trường đã nạp mọi bundle.
def skel_ptr(suffix):
    for f in files['lua_ex']:
        for path,ptr in getattr(f,'container',{}).items():
            if path.lower().endswith(suffix):return ptr
fire=scope['skeleton'](skel_ptr('exclusive/images/fire_eff_skeletondata.asset'))
prefabs={n:prefab('lua_ex',n) for n in ['EXCPanelMain','EXCButton','EXCConsumeCostView','EXCPointView','EXCSkillDesc']}
merged=json.loads((web/'dist/assets.json').read_text(encoding='utf-8'));merged.update(scope['assets'])
(web/'dist/assets.json').write_text(json.dumps(merged,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
out={**db,'art':art,'fire':fire,'prefabs':prefabs}
(web/'dist/exc.json').write_text(json.dumps(out,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print('heroes',len(db['heroes']),'levels',len(db['levels']),'art',sorted(art),'prefabs',list(prefabs),flush=True)
