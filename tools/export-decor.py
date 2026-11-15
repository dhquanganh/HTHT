"""Trang trí tàu / Nội Thất (bundle `shipdecor` + `ship_furniture`, LuaJob PanelShipDecorHome trong `lua_ex`) -> dist/decor.json.

Đọc nguyên từ cache HTTH:
  * furniture: db_furniture (94 món: tên, mô tả, vị trí đặt 1 sàn / 2 tường / 3 trần, ảnh = sprite ship_furniture/<image_id>).
  * points: db_furniture_point (5772 phiên bản: phẩm 1 tím / 2 vàng / 3 đỏ, hệ, nghề, tướng riêng, hiệu ứng chỉ số);
    hệ / nghề quy về tên của catalog, tướng (id db_heroes) quy về id tướng của catalog.
  * rooms: db_furniture_collection (7 phòng: nữ, nam, làm việc, nhạc, đọc sách, tắm, bếp — 18 món mỗi phòng).
  * heroSets: db_furniture_hero_collection (bộ 18 nội thất riêng của từng tướng, thưởng khi đặt 6 / 12 / 18 món).
  * art / prefabs / spines: sprite và prefab gốc của gói shipdecor (+ PanelShipDecorHome của lua_ex).
Luật ở server/decor.mjs. Inputs are read only; assets.json is merged.
"""
from pathlib import Path
import json, sys, runpy, glob, UnityPy

web=Path(__file__).resolve().parents[1]
sys.argv=[sys.argv[0],'none']
m=runpy.run_path(str(web/'tools/export-mermaid.py'))
scope,prefab,files=m['scope'],m['prefab'],m['files']
def objs_of(b):
    out={}
    for f in files[b]:
        for o in f.objects.values():out[o.path_id]=o
    return out
def text(o):
    b=o.read().m_Script
    return b.encode('utf-8','surrogateescape').decode('utf-8','replace') if isinstance(b,str) else bytes(b).decode('utf-8','replace')
tables={}
for o in objs_of('ship_furniture').values():
    if o.type.name=='TextAsset':tables[o.read().m_Name]=json.loads(text(o).lstrip('﻿'))
images={}
for o in objs_of('ship_furniture').values():
    if o.type.name=='Sprite':images[o.read().m_Name]=scope['save_image'](o)
# db_heroes: id → avatar.
heroes_db={}
for f in files['database_ex']:
    for o in f.objects.values():
        if o.type.name=='TextAsset' and o.read().m_Name=='db_heroes':
            t=text(o);heroes_db={h['id']:h for h in json.loads(t[t.index('['):])}
# Tướng ghi bằng avatar (server/decor.mjs đổi sang id tướng của catalog khi nạp).
def hero_id(key):
    h=heroes_db.get(str(key));return str(h['avatar']) if h else None
classes={1:'mage',2:'warrior',3:'priest',4:'ranger',5:'assassin'}
factions={1:'shadow',2:'abyss',3:'fortress',4:'forest',5:'dark',6:'light'}
furniture=[{'id':int(r['image_id']),'name':r['name'],'desc':r['desc'],'place':int(r['place_type']),'image':images.get(r['image_id'])} for r in tables['db_furniture']]
points=[]
for r in tables['db_furniture_point']:
    eff=[]
    for e in json.loads(r['effect']):
        p=e['point'];eff.append({'hero':hero_id(e['hero']) if e['hero'] else None,'clazz':classes.get(e['clazz']),'faction':factions.get(e['faction']),'point':[[p[i],p[i+1]] for i in range(0,len(p),2)]})
    points.append({'id':int(r['id']),'item':int(r['image_id']),'quality':int(r['quality']),'hero':hero_id(r['hero']) if r['hero']!='0' else None,'clazz':classes.get(int(r['clazz'])),'faction':factions.get(int(r['faction'])),'effect':eff})
rooms=[{'id':int(r['gallery_id']),'name':r['name'],'items':json.loads(r['item_set'])} for r in tables['db_furniture_collection']]
hero_sets=[]
for r in tables['db_furniture_hero_collection']:
    hid=hero_id(r['hero_key'])
    if not hid:continue
    bonus={}
    for n in (6,12,18):
        p=json.loads(r['point%d'%n])[0]['point'];bonus[n]=[[p[i],p[i+1]] for i in range(0,len(p),2)]
    hero_sets.append({'hero':hid,'name':r['hero_name'],'items':json.loads(r['collection']),'bonus':bonus})
# UI
art={}
for o in objs_of('shipdecor').values():
    if o.type.name=='Sprite':
        try:art.setdefault(o.read().m_Name,scope['save_image'](o))
        except Exception as e:print('sprite',e)
bundle={}
for f in files['shipdecor']:
    for path,obj in getattr(f,'container',{}).items():bundle[path.lower()]=obj.deref() if hasattr(obj,'deref') else obj
want=['PanelShopFurniture','StoreRoom','PanelShipRoomEditor','ShipDecorFloor','ShipDecorSpace','ItemFurniture','PanelItemDetail','PanelRecyleFurniture','PanelLegendaryOrder','PanelMythicOrder','PopupCreateNewItems','PanelShipCollection','PanelShipRoomCollectionDetail','PopupHeroRoomPower','TabFaction','BoxCountItem','ShipName','Wall','Floor1']
names={o.read().m_Name for p,o in bundle.items() if p.endswith('.prefab')}
prefabs={}
for n in sorted(names):
    if n in want or n.lower() in [w.lower() for w in want]:
        try:prefabs[n]=prefab('shipdecor',n)
        except Exception as e:print('prefab',n,e)
try:prefabs['PanelShipDecorHome']=prefab('lua_ex','PanelShipDecorHome')
except Exception as e:print('home',e)
class Ref:
    def __init__(s,o):s.o=o;s.m_PathID=o.path_id
    def deref(s):return s.o
spines={}
for o in objs_of('shipdecor').values():
    if o.type.name=='MonoBehaviour':
        try:
            d=o.read();nm=getattr(d,'m_Name','')
            if nm.endswith('_SkeletonData'):spines[nm.replace('_SkeletonData','')]=scope['skeleton'](Ref(o))
        except Exception as e:print('spine',e)
result={'spines':spines,'furniture':furniture,'points':points,'rooms':rooms,'heroSets':hero_sets,'art':art,'prefabs':prefabs}
(web/'dist/decor.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
merged=json.loads((web/'dist/assets.json').read_text(encoding='utf-8'));merged.update(scope['assets'])
(web/'dist/assets.json').write_text(json.dumps(merged,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print('spines',list(spines),'furniture',len(furniture),'images',len(images),'points',len(points),'rooms',len(rooms),'heroSets',len(hero_sets),'art',len(art),'prefabs',list(prefabs),'all prefab names',sorted(names),flush=True)
