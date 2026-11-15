"""Peaks of Time (bundle `pot`, _Pack2/EventLua2/PeaksOfTime) -> dist/pot.json.

Đọc nguyên từ cache HTTH:
  * art: mọi sprite của gói (khóa theo tên, ví dụ dungeon_object_7, tile_fog_6, card_pot_front).
  * prefabs: UI gốc (PoTMain, PoTPanelListStage, PoTPanelMapPlayMenu, PoTPanelHeroIndicator, PoTPanelPlayerHeroes,
    PoTPanelPlayerRelics, PoTPanelSelectRelic, PoTPanelRelicDetail, PoTPanelMapObjectInfo, PoTCardRelicBig…) cho PrefabDOM.
  * maps: Datas/MapPoT_1, MapPoT_2 — từng Tilemap (TilemapBgr / Wall / Obstacle / Object / Fog) với ô, sprite, lật, thứ tự vẽ.
  * objects: prefab _MapObjects/* (SpriteRenderer: sprite, vị trí, tỉ lệ, thứ tự) để vẽ vật thể trên bản đồ.
  * spines: chibi_fuji (người chơi), pot_gate, itemsupport, Card, enemy_akainu (boss) nếu có SkeletonDataAsset.
  * relics: database_ex/db_pot_relic (tên, bậc, avatar, mô tả) + icon Images/Marineford/RelicIcon từ dist/freedom.json.
  * layouts: PoTMapData1/2 (vật thể thử nghiệm gốc trong PoTMapData.lua) — bố cục mặc định của server/pot.mjs.
Luật (di chuyển, tương tác, đánh quái / boss, di vật) nằm ở server gốc (POT_* 732…786): xem server/pot.mjs.
Inputs are read only; assets.json is merged.
"""
from pathlib import Path
import json, sys, runpy, re

web=Path(__file__).resolve().parents[1]
sys.argv=[sys.argv[0],'none']
m=runpy.run_path(str(web/'tools/export-mermaid.py'))
scope,prefab,files=m['scope'],m['prefab'],m['files']
pot=files['pot']
objs={}
for f in pot:
    for o in f.objects.values():objs[o.path_id]=o
bundle={}
for f in pot:
    for path,obj in getattr(f,'container',{}).items():bundle[path.lower()]=obj.deref() if hasattr(obj,'deref') else obj
art={}
for o in objs.values():
    if o.type.name=='Sprite':
        try:art.setdefault(o.read().m_Name,scope['save_image'](o))
        except Exception as e:print('sprite fail',e)
def tt(o):return o.read_typetree()
# Pivot (0..1) và PPU của từng sprite: đặt sprite đúng điểm neo như Unity.
pivots={}
for o in objs.values():
    if o.type.name=='Sprite':
        t=o.read_typetree();pivots[t['m_Name']]=[round(t['m_Pivot']['x'],4),round(t['m_Pivot']['y'],4),t['m_PixelsToUnits']]
def name_of(go_ptr):
    o=objs.get(go_ptr['m_PathID']);return o.read().m_Name if o else None
def go_components(go):
    t=tt(go);return [objs[c['component']['m_PathID']] for c in t['m_Component'] if c['component']['m_PathID'] in objs]
def transform_of(go):return next(c for c in go_components(go) if c.type.name in('Transform','RectTransform'))
def children(go):
    tr=tt(transform_of(go));return [objs[tt(objs[c['m_PathID']])['m_GameObject']['m_PathID']] for c in tr['m_Children'] if c['m_PathID'] in objs]
def find_go(name):return next(o for o in objs.values() if o.type.name=='GameObject' and o.read().m_Name==name)
def sprite_name(ptr):
    o=objs.get(ptr['m_PathID']) if ptr and ptr.get('m_PathID') else None
    if not o:return None
    k=scope['save_image'](o);n=o.read().m_Name;art.setdefault(n,k);return n

# ---- Bản đồ ô
def tilemap_layer(go):
    comps=go_components(go);tm=next((c for c in comps if c.type.name=='Tilemap'),None)
    if not tm:return None
    t=tt(tm);ren=next((c for c in comps if c.type.name=='TilemapRenderer'),None);rt=tt(ren) if ren else {}
    sprites=[sprite_name(s['m_Data']) for s in t['m_TileSpriteArray']]
    mats=[e['m_Data'] for e in t['m_TileMatrixArray']]
    cells=[]
    for pos,info in t['m_Tiles']:
        si=info['m_TileSpriteIndex'];mi=info['m_TileMatrixIndex']
        sp=sprites[si] if si<len(sprites) else None
        mx=mats[mi] if mi<len(mats) else None
        flip=[1,1]
        if mx:flip=[-1 if mx['e00']<0 else 1,-1 if mx['e11']<0 else 1]
        cells.append([pos['x'],pos['y'],sp]+([flip] if flip!=[1,1] else []))
    tr=tt(transform_of(go))
    return{'name':go.read().m_Name,'order':rt.get('m_SortingOrder',0),'active':bool(tt(go)['m_IsActive']),'cells':cells,
           'offset':[tr['m_LocalPosition']['x'],tr['m_LocalPosition']['y']]}
maps={}
for n in (1,2):
    root=find_go(f'MapPoT_{n}');grid=next(c for c in children(root) if c.read().m_Name=='TileGrid')
    g=next((c for c in go_components(grid) if c.type.name=='Grid'),None);cell=tt(g)['m_CellSize'] if g else {'x':1,'y':1}
    layers=[l for l in (tilemap_layer(c) for c in children(grid)) if l]
    maps[n]={'cell':[cell['x'],cell['y']],'layers':layers}
# ---- Vật thể bản đồ (SpriteRenderer)
def walk_sprites(go,ox=0,oy=0,sx=1,sy=1,path=''):
    out=[];tr=tt(transform_of(go));p=tr['m_LocalPosition'];s=tr['m_LocalScale']
    x,y=ox+p['x']*sx,oy+p['y']*sy;nsx,nsy=sx*s['x'],sy*s['y']
    name=go.read().m_Name;here=(path+'/'+name).strip('/')
    for c in go_components(go):
        if c.type.name=='SpriteRenderer':
            r=tt(c);sp=sprite_name(r['m_Sprite'])
            out.append({'path':here,'sprite':sp,'x':round(x,3),'y':round(y,3),'sx':round(nsx,3),'sy':round(nsy,3),'order':r.get('m_SortingOrder',0),'active':bool(tt(go)['m_IsActive']),'flipX':bool(r.get('m_FlipX',0))})
    for ch in children(go):out+=walk_sprites(ch,x,y,nsx,nsy,here)
    return out
objects={}
for p,o in bundle.items():
    if '/_mapobjects/' in p and p.endswith('.prefab'):
        root=find_go(o.read().m_Name);objects[root.read().m_Name]=walk_sprites(root)
# ---- Animator: khung sprite của từng clip (Chest_Open, Ground_Hole, Switch_On/Off, Portal_Idle, Door_*…)
anims={}
for o in objs.values():
    if o.type.name=='AnimationClip':
        t=tt(o);frames=[]
        for ptr in t.get('m_ClipBindingConstant',{}).get('pptrCurveMapping',[]):
            fo=objs.get(ptr['m_PathID'])
            if fo and fo.type.name=='Sprite':frames.append(sprite_name({'m_PathID':fo.path_id}))
        anims[t['m_Name']]=frames
# ---- UI prefabs
ui=['PoTMain','PoTPanelListStage','PoTPanelMapListMenu','PoTPanelMapPlayMenu','PoTPanelHeroIndicator','PoTPanelPlayerHeroes','PoTPanelPlayerRelics','PoTPanelSelectRelic','PoTPanelRelicDetail','PoTPanelMapObjectInfo','PoTCardRelicBig','CellStage']
prefabs={}
for n in ui:
    try:prefabs[n]=prefab('pot',n)
    except Exception as e:print('prefab',n,e)
# ---- Spine
class Ref:
    def __init__(s,o):s.o=o;s.m_PathID=o.path_id
    def deref(s):return s.o
spines={}
for o in objs.values():
    if o.type.name=='MonoBehaviour':
        try:
            d=o.read();nm=getattr(d,'m_Name','')
            if nm.endswith('_SkeletonData'):spines[nm.replace('_SkeletonData','').lower()]=scope['skeleton'](Ref(o))
        except Exception as e:print('spine',e)
# ---- Di vật (db_pot_relic, tiếng Việt) + icon
relics=[]
for f in files.get('database_ex',[]):
    for path,obj in getattr(f,'container',{}).items():
        if Path(path.lower()).stem=='db_pot_relic':
            o=obj.deref() if hasattr(obj,'deref') else obj;b=o.read().m_Script
            s=b.encode('utf-8','surrogateescape').decode('utf-8','replace') if isinstance(b,str) else bytes(b).decode('utf-8','replace')
            relics=json.loads(s.lstrip('﻿'))
icons={c['avatar']:c['icon'] for c in json.loads((web/'dist/freedom.json').read_text(encoding='utf-8'))['cards'] if c.get('icon')}
strip=lambda s:re.sub(r'<[^>]+>','',s or '').strip()
relics=[{'id':int(r['id']),'rank':int(r['rrank']),'avatar':r['avatar'],'icon':icons.get(str(r['avatar'])),'name':r['name'],'description':strip(r['description'])} for r in relics]
# ---- Bố cục vật thể gốc (PoTMapData.lua)
lua=next(o for p,o in bundle.items() if p.endswith('potmapdata.lua.txt')).read().m_Script
lua=lua.encode('utf-8','surrogateescape').decode('utf-8','replace') if isinstance(lua,str) else bytes(lua).decode('utf-8','replace')
def lua_table(src):
    s=re.sub(r'--[^\n]*','',src)
    s=re.sub(r'(\w+)\s*=',r'"\1":',s).replace(';',',')
    s=re.sub(r':\s*\{\{(.*?)\}\}',lambda m:':[{'+m.group(1)+'}]',s)
    s=s.replace("'",'"')
    # mảng {a,b} → [a,b]
    s=re.sub(r'\{\s*([0-9\-]+(?:\s*,\s*[0-9\-]+)*)\s*\}',r'[\1]',s)
    return s
layouts={}
for mm in re.finditer(r'PoTMapData(\d+)\s*=\s*(\{.*?\n\})',lua,re.S):
    body=mm.group(2)
    js=lua_table(body)
    js=re.sub(r',\s*([}\]])',r'\1',js)
    # danh sách objects: {...},{...} trong objects = { ... }
    js=re.sub(r'"objects":\s*\{','"objects":[',js)
    js=re.sub(r'\}\s*\}\s*$',']}',js.strip())
    try:layouts[int(mm.group(1))]=json.loads(js)
    except Exception as e:print('layout parse',mm.group(1),e);(web.parent/f'pot_layout_{mm.group(1)}.txt').write_text(js,encoding='utf-8')
result={'art':art,'pivots':pivots,'prefabs':prefabs,'maps':maps,'objects':objects,'anims':anims,'spines':spines,'relics':relics,'layouts':layouts}
(web/'dist/pot.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
merged=json.loads((web/'dist/assets.json').read_text(encoding='utf-8'));merged.update(scope['assets'])
(web/'dist/assets.json').write_text(json.dumps(merged,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print('anims',{k:len(v) for k,v in anims.items()},'art',len(art),'prefabs',list(prefabs),'maps',{k:[(l['name'],len(l['cells'])) for l in v['layers']] for k,v in maps.items()},'objects',list(objects),'spines',list(spines),'relics',len(relics),'layouts',list(layouts),flush=True)
