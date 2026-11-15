"""Bữa tiệc Sanji (bundle `sanji_party`, _Pack2/EventLua2/EventSanji) -> dist/sanji.json.

Đọc nguyên từ cache HTTH: mọi sprite của gói (khóa theo tên), các prefab (PanelSanjiHome, GiveFoodPopup, Food, RankingPopup,
CellRanking, Gifts, GiftPopup, CellPopupShop, Hearts, Litmited, SoldOut, ItemBonusShowSanji) và Spine (bua tiec sanji,
Loading, Item_effect). Luật (EVENT_SANJI_* 800…807: tặng món, xếp hạng, quà mốc, cửa hàng bếp trưởng) nằm ở server gốc:
xem server/sanji.mjs. Inputs are read only; assets.json is merged.
"""
from pathlib import Path
import json, sys, runpy

web=Path(__file__).resolve().parents[1]
sys.argv=[sys.argv[0],'none']
m=runpy.run_path(str(web/'tools/export-mermaid.py'))
scope,prefab,files=m['scope'],m['prefab'],m['files']
B='sanji_party'
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
(web/'dist/sanji.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
merged=json.loads((web/'dist/assets.json').read_text(encoding='utf-8'));merged.update(scope['assets'])
(web/'dist/assets.json').write_text(json.dumps(merged,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print('art',len(art),'prefabs',list(prefabs),'spines',list(spines),flush=True)
