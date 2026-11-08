"""Ép Sao / Germa (EventEpSao, "Void") -> dist/germa.json.

Đọc nguyên từ cache HTTH:
  germa bundle: Db/UpgradeVoid (16 nút: 12 nút chỉ số + 4 nút kỹ năng, phí Nước mắt Mansherry, phí kỹ năng),
                Db/UpgradeVoidIconMap, Db/UpgradeVoidSkillData_vi (kỹ năng Germa cấp 4 theo mã tướng 10 sao),
  lua_ex bundle: Scripts/Language_Void (tên + mô tả nút), prefab PanelEpSao / PopupEpSaoUpgradeLevel /
                 PopupEpSaoUpgradeSkill và ảnh Images/*,
  database_ex: db_heroes (mã tướng -> avatar), db_hero_skill (tên, mô tả, icon kỹ năng),
  skillicon_ex: icon kỹ năng.
Inputs are read only; assets.json is merged.
"""
from pathlib import Path
import json, re, sys, runpy, UnityPy

web=Path(__file__).resolve().parents[1]
sys.argv=[sys.argv[0],'none']
m=runpy.run_path(str(web/'tools/export-mermaid.py'))
scope,prefab,files=m['scope'],m['prefab'],m['files']
cache=web.parent/'HTTH'

def container(bundle):
    out={}
    for f in files[bundle]:
        for path,obj in getattr(f,'container',{}).items():out[path.lower()]=obj.deref() if hasattr(obj,'deref') else obj
    return out
def read_text(obj):
    s=obj.read().m_Script
    return (s if isinstance(s,str) else bytes(s).decode('utf-8')).lstrip('﻿')
germa=container('germa');lua=container('lua_ex')
def text(c,suffix):return read_text(next(o for p,o in c.items() if p.endswith(suffix) and o.type.name=='TextAsset'))

void=json.loads(text(germa,'/db/upgradevoid.txt'))
icon_map={r['id']:r['icon_name'] for r in json.loads(text(germa,'/db/upgradevoidiconmap.txt'))}
skill_rows=json.loads(text(germa,'/db/upgradevoidskilldata_vi.txt'))
language={r['key']:r['vi'].strip() for r in json.loads(text(lua,'/scripts/language_void.txt'))}

# 16 nút theo PanelEpSaoData: nút 4, 8, 12, 16 là kỹ năng (passive1, passive2, passive3, active); còn lại void1..15.
nodes=[];level_index=0;skill_index=0
for i in range(1,17):
    if i%4==0:
        skill_index+=1
        cost_item=void['costItem'][skill_index-1]
        nodes.append({'node':i,'type':'skill','skill':skill_index,'heroes':void['costHero'][skill_index-1],
            'item':{'itemId':'consumable:%d'%cost_item[2],'quantity':cost_item[3]} if cost_item else None,
            'bonus':{'itemId':'consumable:%d'%void['costItemBonus'][skill_index-1][2],'quantity':void['costItemBonus'][skill_index-1][3]} if void['costItemBonus'][skill_index-1] else None})
    else:
        level_index+=1;row=void['void%d'%i]
        buff=[dict(zip(b[0::2],b[1::2])) for b in row['buff']]
        nodes.append({'node':i,'type':'level','index':level_index,'name':language.get('NODE_VOID_NAME_%d'%level_index),'desc':language.get('NODE_VOID_DESC_%d'%level_index),
            'icon':icon_map[level_index],'cost':row['cost'],'buff':[{str(k):v for k,v in b.items()} for b in buff]})

# ---- Kỹ năng Germa: mã tướng 10 sao -> avatar, mô tả từ db_hero_skill
database=UnityPy.load(str(next(cache.rglob('database_ex/**/__data'))))
def table(name):
    p=next(p for n,p in database.container.items() if n.endswith('/'+name+'.txt'))
    raw=p.read().m_Script
    if not isinstance(raw,str):raw=raw.decode('utf-8')
    return json.loads(raw[raw.index('[{'):])
heroes={str(r['id']):r for r in table('db_heroes')}
skills_db={str(r['id']):r for r in table('db_hero_skill')}
icons={}
for name,ptr in UnityPy.load(str(next(cache.rglob('skillicon_ex/**/__data')))).container.items():
    if ptr.deref().type.name=='Sprite':icons[name.rsplit('/',1)[-1].split('.')[0]]=ptr
merged=json.loads((web/'dist/assets.json').read_text(encoding='utf-8'))
def icon(number):
    name='skill_'+str(number)
    if name not in icons:return None
    key='skillicon-'+str(number)
    if key not in merged:
        image=icons[name].read().image;path=web/'dist/assets'/(key+'.webp')
        if not path.exists():image.convert('RGBA').save(path,'WEBP',quality=88,method=6)
        merged[key]={'name':name,'src':'assets/'+key+'.webp','width':image.width,'height':image.height}
    return key
plain=lambda t:re.sub(r'\s+',' ',re.sub(r'<[^>]+>','',t or '')).strip()
def skill(sid):
    r=skills_db.get(str(sid))
    if not r:return None
    name=plain(r.get('name'));level=re.search(r'\[(\d+)\]',name)
    return {'id':str(sid),'name':re.sub(r'\s*\[\d+\]\s*','',name),'level':int(level.group(1)) if level else 4,'icon':icon(r.get('icon') or ''),'description':plain(r.get('description'))}
hero_skills={}
for row in skill_rows:
    hero=heroes.get(str(row['id']))
    if not hero:continue
    entry={'heroKey':row['id'],'name':plain(hero.get('name')),
           'skills':[skill(row['void_passive1']),skill(row['void_passive2']),skill(row['void_passive3']),skill(row['void_active'])]}
    if all(entry['skills']):hero_skills[str(hero['avatar'])]=entry

# ---- Ảnh + prefab
art={}
for path,obj in lua.items():
    if obj.type.name=='Sprite' and '/eventepsao/images/' in path:art[Path(path).stem]=scope['save_image'](obj)
prefabs={name:prefab('lua_ex',name) for name in ['PanelEpSao','PopupEpSaoUpgradeLevel','PopupEpSaoUpgradeSkill']}

result={'unlockItem':'consumable:200019','resetPrice':100,'nodes':nodes,'heroes':hero_skills,'art':art,'prefabs':prefabs}
(web/'dist/germa.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
merged.update(scope['assets'])
(web/'dist/assets.json').write_text(json.dumps(merged,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print('nodes',len(nodes),'heroes',len(hero_skills),'of',len(skill_rows),'art',len(art),'prefabs',list(prefabs),flush=True)
