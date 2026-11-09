"""Bảng Haki (E-skill gốc: PanelHeroESkill / PopupHeroESkill) -> dist/haki.json.

Đọc nguyên từ cache HTTH:
  database_ex: db_e_skill (15 Haki, 5 bậc × 3 lựa chọn; hero_level 11-15 = L1-L5 của hệ sao cũ),
  skillicon_ex: icon skill_e_1 .. skill_e_15.
Prefab lấy từ dist/scenes đã xuất: PopupHeroESkill (1455) và nhánh PanelESkill của PanelHeroInfo (1156).
Inputs are read only; assets.json is merged.
"""
from pathlib import Path
import json, re, UnityPy

web=Path(__file__).resolve().parents[1]
cache=web.parent/'HTTH'

def bundle(name):return UnityPy.load(str(next(cache.rglob(name+'/**/__data'))))
database=bundle('database_ex')
raw=next(p for n,p in database.container.items() if n.endswith('/db/db_e_skill.txt')).read().m_Script
raw=raw if isinstance(raw,str) else bytes(raw).decode('utf-8')
# Bản cache viết rich text không thoát dấu nháy: <color="#C0C0C0"> -> <color=#C0C0C0>.
raw=re.sub(r'<color="(#[0-9A-Fa-f]+)">',r'<color=\1>',raw)
rows=json.loads(raw[raw.index('['):])
plain=lambda t:' '.join(re.sub(r'<[^>]+>','',t).split())

icons={n.rsplit('/',1)[-1].split('.')[0]:p for n,p in bundle('skillicon_ex').container.items()}
merged=json.loads((web/'dist/assets.json').read_text(encoding='utf-8'))
def icon(i):
    key='skillicon-e_%d'%i
    if key not in merged:
        image=icons['skill_e_%d'%i].read().image;path=web/'dist/assets'/(key+'.webp')
        if not path.exists():image.convert('RGBA').save(path,'WEBP',quality=90,method=6)
        merged[key]={'name':'skill_e_%d'%i,'src':'assets/'+key+'.webp','width':image.width,'height':image.height}
    return key

# Bậc theo hero_level gốc (11..15), thứ tự trong bậc theo `order`.
tiers=[]
for level in sorted({r['hero_level'] for r in rows}):
    options=sorted((r for r in rows if r['hero_level']==level),key=lambda r:r['order'])
    tiers.append({'tier':level-10,'options':[{'id':r['e_skill_id'],'name':r['new_name'].strip(),'desc':' '.join(r['desc'].split()),
        'plain':re.sub(r'^\[\d+\]\s*','',plain(r['new_name'])),'plainDesc':plain(r['desc']),'icon':icon(r['e_skill_id'])} for r in options]})

def scene(i):return json.loads((web/'dist/scenes'/('%d.json'%i)).read_text(encoding='utf-8'))
def find(n,name):
    if n['name']==name:return n
    for c in n.get('children',[]):
        r=find(c,name)
        if r:return r
info=scene(1156)['roots'][0]
prefabs={'PanelESkill':find(info,'PanelESkill'),'BoxInfo':{k:v for k,v in find(info,'BoxInfo').items() if k!='children'},'PopupHeroESkill':scene(1455)['roots'][0]}

result={'title':'Bảng Haki','tiers':tiers,'prefabs':prefabs}
(web/'dist/haki.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
(web/'dist/assets.json').write_text(json.dumps(merged,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print('tiers',[[o['id'] for o in t['options']] for t in tiers],flush=True)
