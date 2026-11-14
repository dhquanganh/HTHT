"""Ngọc Vega (bundle `gem` + GemMain của lua_ex) -> dist/gem.json.

Đọc nguyên từ cache HTTH:
  db_set_name (31 bộ ngọc + chỉ số kích bộ), db_debuff (38 debuff Boss ngọc), db_material_number_require (phí chế tạo),
  db_config_open_boss (ngày mở 3 boss), mọi sprite trong gem/images (khóa theo thư mục con + tên),
  mọi prefab của bundle gem, GemMain (lua_ex) và ảnh _pack2/eventlua/image/*gem*,
  các Spine của gem/spine (boss 51176/51180/51184, vòng phép, hiệu ứng ngọc…).
Inputs are read only; assets.json is merged.
"""
from pathlib import Path
import json, sys, runpy

web=Path(__file__).resolve().parents[1]
sys.argv=[sys.argv[0],'none']
m=runpy.run_path(str(web/'tools/export-mermaid.py'))
scope,prefab,files=m['scope'],m['prefab'],m['files']

def container(bundle):
    out={}
    for f in files[bundle]:
        for path,obj in getattr(f,'container',{}).items():out[path.lower()]=obj.deref() if hasattr(obj,'deref') else obj
    return out
gem=container('gem');lua_ex=container('lua_ex')
def text(name):
    o=next(o for p,o in gem.items() if p.endswith('/'+name) and o.type.name=='TextAsset')
    s=o.read().m_Script
    s=s.encode('utf-8','surrogateescape').decode('utf-8','replace') if isinstance(s,str) else bytes(s).decode('utf-8','replace')
    return s.lstrip('\ufeff')

# ---- Bảng dữ liệu
def loose(raw):
    try:return json.loads(raw)
    except ValueError:return None  # vài dòng skill_data gốc hỏng JSON: bỏ qua, luật trận dùng mô tả
def pairs(raw):
    v=json.loads(raw)[0]['point'];return [[v[i],v[i+1]] for i in range(0,len(v)-1,2)]
sets=[{'id':int(r['id']),'name':r['name'],'effect':r['effect_desc'],'points':pairs(r['data_effect']),
       'material':r['need_set_material']=='1','release':r['release']=='1'} for r in json.loads(text('db_set_name.txt'))]
debuffs=[{'id':int(r['id']),'name':r['name'],'description':r['description'],'skill':loose(r['skill_data']),
          'release':r['open_debuff']=='1','point':int(r['point'])} for r in json.loads(text('db_debuff.txt'))]
materials=[{'item':int(r['id_material']),'amount':int(r['number_require'])} for r in json.loads(text('db_material_number_require.txt'))]
bosses=[{'id':int(r['idCardBoss']),'days':[int(x) for x in r['dateOpen'].split(',')],'debuffOpen':int(r['debuffOpen'])} for r in json.loads(text('db_config_open_boss.txt'))]

# ---- Ảnh: sprite trong gem/images ("icongem/set_1", "boss/51176_open", "frame") + ảnh GemMain của lua_ex
art={}
for path,obj in gem.items():
    if obj.type.name!='Sprite' or '/gem/images/' not in path:continue
    rel=path.split('/gem/images/')[-1]
    art[str(Path(rel).with_suffix('')).replace('\\','/')]=scope['save_image'](obj)
for path,obj in lua_ex.items():
    if obj.type.name=='Sprite' and '/eventlua/image/' in path and 'gem' in path:
        art['main/'+Path(path).stem]=scope['save_image'](obj)

# ---- Spine (SkeletonDataAsset): con trỏ giả để dùng lại scope['skeleton'] như component SkeletonGraphic
class Ref:
    def __init__(s,o):s.o=o;s.m_PathID=o.path_id
    def deref(s):return s.o
spines={}
for path,obj in gem.items():
    if path.endswith('_skeletondata.asset'):
        name=Path(path).name.replace('_skeletondata.asset','')
        try:spines[name]=scope['skeleton'](Ref(obj))
        except Exception as ex:print('spine',name,ex,flush=True)

# ---- Prefab
prefabs={}
names=sorted({o.read().m_Name for p,o in gem.items() if p.endswith('.prefab')})
for name in names:
    try:prefabs[name]=prefab('gem',name)
    except StopIteration:print('missing prefab',name,flush=True)
prefabs['GemMain']=prefab('lua_ex','GemMain')

# ---- Boss ngọc: db_heroes "Boss Douglas Bullet I..VI", "Boss Wadatsumi …", "Boss Pica …" (chỉ số, 4 kỹ năng),
# db_hero_skill (tên / mô tả / biểu tượng), db_battle_heroes + Spine trận đấu và ảnh đầu của avatar bậc I.
import re, UnityPy
database=UnityPy.load(str(next((web.parent/'HTTH').rglob('database_ex/**/__data'))))
def table(name):
    p=next(p for n,p in database.container.items() if n.endswith('/'+name+'.txt'))
    raw=p.read().m_Script
    if not isinstance(raw,str):raw=raw.decode('utf-8')
    return json.loads(raw[raw.index('[{'):])
plain=lambda s:re.sub(r'\s+',' ',re.sub(r'<[^>]+>','',str(s or ''))).strip()
skill_rows={str(r['id']):r for r in table('db_hero_skill')}
battle_rows={str(r['key']):r for r in table('db_battle_heroes')}
roman={'I':1,'II':2,'III':3,'IV':4,'V':5,'VI':6}
boss_heroes={}
for r in table('db_heroes'):
    mt=re.match(r'^Boss (Douglas Bullet|Wadatsumi|Pica) (I|II|III|IV|V|VI)$',r['name'])
    if not mt:continue
    pts=json.loads(r['point'])
    skills=[]
    for i,key in enumerate([r['active'],r['passive1'],r['passive2'],r['passive3']]):
        s=skill_rows.get(str(key))
        if s:skills.append({'id':int(key),'name':plain(s['name']),'description':plain(s['description']),'icon':str(s['icon']),'passive':i>0})
    boss_heroes[r['id']]={'id':r['id'],'avatar':r['avatar'],'name':r['name'],'boss':mt.group(1),'tier':roman[mt.group(2)],'class':r['class'],'faction':r['type'],
        'star':int(r['star']),'point':{'attack':pts[0],'defense':pts[1],'hp':pts[2],'speed':pts[3]},'skills':skills}
remote={}
for pack in ['herohead_ex','herospineupdate']:
    for name,ptr in UnityPy.load(str(next((web.parent/'HTTH').rglob(pack+'/**/__data')))).container.items():remote[name]=ptr
visuals={}
for avatar in ['51176','51180','51184']:
    skel=next((scope['skeleton'](p) for n,p in remote.items() if n.endswith('/'+avatar+'/hero_'+avatar+'_skeletondata.asset')),None)
    head=next((scope['image_ptr'](p) for n,p in remote.items() if n.endswith('/herohead/'+avatar+'.png')),None)
    visuals[avatar]={'avatar':avatar,'head':head,'skeleton':skel,'combat':battle_rows.get(avatar)}
# Biểu tượng kỹ năng boss (heroskill_ex / skillicon_ex) nếu bản web chưa có.
icons={}
for pack in ['skillicon_ex','heroskill_ex']:
    for name,ptr in UnityPy.load(str(next((web.parent/'HTTH').rglob(pack+'/**/__data')))).container.items():
        stem=Path(name).stem.replace('skill_','')
        if ptr.deref().type.name=='Sprite' and any(stem==s['icon'] for b in boss_heroes.values() for s in b['skills']) and stem not in icons:
            icons[stem]=scope['image_ptr'](ptr)

result={'sets':sets,'debuffs':debuffs,'materials':materials,'bosses':bosses,'bossHeroes':boss_heroes,'visuals':visuals,'skillIcons':icons,'art':art,'spines':spines,'prefabs':prefabs}
(web/'dist/gem.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
merged=json.loads((web/'dist/assets.json').read_text(encoding='utf-8'));merged.update(scope['assets'])
(web/'dist/assets.json').write_text(json.dumps(merged,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print('bossHeroes',len(boss_heroes),'visuals',{k:bool(v['skeleton']) and bool(v['head']) for k,v in visuals.items()},'icons',len(icons));print('sets',len(sets),'debuffs',len(debuffs),'art',len(art),'spines',list(spines),'prefabs',list(prefabs),flush=True)
