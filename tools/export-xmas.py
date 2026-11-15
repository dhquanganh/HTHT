"""Giáng sinh / Sinh nhật (bundle `event_xmas`, TabManagerEventXmas: Quà tất / Ông già Noel / Điều ước / Nhà bánh gừng /
Gói quà + PopupEventXmasBirthday) -> dist/xmas.json.

Đọc nguyên từ cache HTTH: sprite (khóa theo tên), các prefab PanelEventXmas* / Popup* và Spine (Bigmom_bd, Cake, Cake2,
Candles, Box, Bag, Band1, Band2, Btn, Cards, Star, Altar_hero, Hero_140event). Luật (dữ liệu sự kiện do server gốc trả qua
/events/type/12) được thiết kế lại ở server/xmas.mjs. Inputs are read only; assets.json is merged.
"""
from pathlib import Path
import json, sys, runpy

web=Path(__file__).resolve().parents[1]
sys.argv=[sys.argv[0],'none']
m=runpy.run_path(str(web/'tools/export-mermaid.py'))
scope,prefab,files=m['scope'],m['prefab'],m['files']
B='event_xmas'
objs={}
for f in files[B]:
    for o in f.objects.values():objs[o.path_id]=o
bundle={}
for f in files[B]:
    for path,obj in getattr(f,'container',{}).items():bundle[path.lower()]=obj.deref() if hasattr(obj,'deref') else obj
art={}
for o in objs.values():
    if o.type.name=='Sprite':
        try:art.setdefault(o.read().m_Name,scope['save_image'](o))
        except Exception as e:print('sprite',e)
names=sorted({o.read().m_Name for p,o in bundle.items() if p.endswith('.prefab')})
prefabs={}
for n in names:
    try:prefabs[n]=prefab(B,n)
    except Exception as e:print('prefab',n,e)
class Ref:
    def __init__(s,o):s.o=o;s.m_PathID=o.path_id
    def deref(s):return s.o
spines={}
for o in objs.values():
    if o.type.name=='MonoBehaviour':
        try:
            d=o.read();nm=getattr(d,'m_Name','')
            if nm.endswith('_SkeletonData'):spines[nm.replace('_SkeletonData','')]=scope['skeleton'](Ref(o))
        except Exception as e:print('spine',e)
result={'art':art,'prefabs':prefabs,'spines':spines}
(web/'dist/xmas.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
merged=json.loads((web/'dist/assets.json').read_text(encoding='utf-8'));merged.update(scope['assets'])
(web/'dist/assets.json').write_text(json.dumps(merged,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print('art',len(art),'prefabs',list(prefabs),'spines',list(spines),flush=True)
