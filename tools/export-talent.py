"""Thiên phú (HolyBlessing / HLB của bản gốc) -> dist/talent.json.

Đọc nguyên từ cache HTTH:
  lua_holyblessing: resources/db_talent_upgrade (50 cấp: phí nâng cấp, chỉ số Công/Máu/Tốc, mốc nâng sao),
                    resources/db_talent_table (3 bảng Cuồng Bạo / Thủ Ngự / Viện Trợ, 5 ô × 3 kỹ năng, phí đổi bảng
                    và cài lại), prefab HLBPanelMain / HLBPopupSelectTable / HLBPopupSelectSkill / HLBPanelSkillDetail /
                    HLBIconSkillView / HLBCellSelectSkill / HLBPointView / HLBConsumeCostView / HLBStarView, ảnh Images/*,
                    Spine anim_thienphu (Loop_red / Loop_blue / Loop_green),
  database_ex: db_hero_skill (tên, mô tả, icon kỹ năng 210001-210045), skillicon_ex: icon kỹ năng.
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
hlb=container('lua_holyblessing')
text=lambda suffix:read_text(next(o for p,o in hlb.items() if p.endswith(suffix) and o.type.name=='TextAsset'))

pairs=lambda raw:[[raw[i],raw[i+1]] for i in range(0,len(raw)-1,2)]
def bonus(raw):
    # [3,1,itemId,qty,...]: loại 3 = vật phẩm, 1 = số dòng; mỗi nhóm 4 số.
    v=json.loads(raw or '[]');return [{'itemId':'consumable:%d'%v[i+2],'quantity':v[i+3]} for i in range(0,len(v)-3,4)]
levels=[]
for r in json.loads(text('/resources/db_talent_upgrade.txt')):
    levels.append({'level':int(r['level']),'cost':bonus(r['material_level_up']),'points':json.loads(r['point_level_data']),
                   'starCost':bonus(r['material_star_up']),'copies':int(r['copy_hero_star']),'starNext':int(r['skill_unlock_hero_star']),
                   'heroLevelCap':int(r['add_level_star'])})
table=json.loads(text('/resources/db_talent_table.json'))

database=UnityPy.load(str(next(cache.rglob('database_ex/**/__data'))))
raw=next(p for n,p in database.container.items() if n.endswith('/db_hero_skill.txt')).read().m_Script
raw=raw if isinstance(raw,str) else raw.decode('utf-8')
raw=re.sub(r'<color="(#[0-9A-Fa-f]+)">',r'<color=\1>',raw)
skills_db={str(r['id']):r for r in json.loads(raw[raw.index('['):])}
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
skills={}
for group in ('atkSkill','defSkill','mixSkill'):
    for lot in table[group]:
        for sid in lot:
            r=skills_db[str(sid)]
            skills[str(sid)]={'id':sid,'name':re.sub(r'\s*\[\d+\]\s*','',plain(r.get('name'))),'description':plain(r.get('description')),
                              'rich':' '.join((r.get('description') or '').split()),'icon':icon(r.get('icon') or '')}
names={1:'Cuồng Bạo',2:'Thủ Ngự',3:'Viện Trợ'}
infos={1:'Kỹ năng loại sát thương, tăng cường mạnh khả năng công kích',2:'Kỹ năng loại chiến lược, tăng cường khả năng sinh tồn và hồi phục',3:'Kỹ năng loại kiểm soát, hướng chi viện và kiểm soát trận đánh'}
tables=[{'id':i,'name':names[i],'info':infos[i],'lots':table[g]} for i,g in ((1,'atkSkill'),(2,'defSkill'),(3,'mixSkill'))]

art={}
for path,obj in hlb.items():
    if obj.type.name=='Sprite' and '/holyblessing/images/' in path:art[Path(path).stem]=scope['save_image'](obj)
prefab_names=['HLBPanelMain','HLBPopupSelectTable','HLBPopupSelectSkill','HLBPanelSkillDetail','HLBIconSkillView','HLBCellSelectSkill',
              'HLBPointView','HLBConsumeCostView','HLBStarView','HLBIconSkillTableView','HLBMaterialHeroView']
prefabs={name:prefab('lua_holyblessing',name) for name in prefab_names}

# Spine anim_thienphu vẽ bằng shader additive (texture nền đen). Renderer canvas chỉ có alpha blend, nên nướng thêm bản
# texture có alpha = độ sáng (màu chia lại theo alpha) và trỏ SkeletonGraphic của Thiên phú sang bản đó.
from PIL import Image
def additive(key):
    out_key=key+'_additive'
    if out_key not in merged:
        src=web/'dist/assets'/(key+'.webp');im=Image.open(src).convert('RGBA');px=im.load();w,h=im.size
        for y in range(h):
            for x in range(w):
                r,g,b,a=px[x,y];m=max(r,g,b)*a//255
                px[x,y]=(min(255,r*255//m),min(255,g*255//m),min(255,b*255//m),m) if m else (0,0,0,0)
        im.save(web/'dist/assets'/(out_key+'.webp'),'WEBP',quality=90,method=6)
        merged[out_key]={**merged.get(key,{}),'name':'anim_thienphu_additive','src':'assets/'+out_key+'.webp','width':w,'height':h}
    return out_key
def remap(n):
    for c in n.get('components',[]):
        if c.get('type')=='SkeletonGraphic' and c.get('skeleton'):
            # Các SkeletonGraphic dùng chung một object skeleton: chỉ ánh xạ texture gốc một lần.
            for atlas in c['skeleton'].get('atlases',[]):atlas['textures']=[t if t.endswith('_additive') else additive(t) for t in atlas['textures']]
    for k in n.get('children',[]):remap(k)
merged.update(scope['assets'])
for p in prefabs.values():remap(p)

result={'levels':levels,'tables':tables,'skills':skills,'feeChangeTable':table['feeChangeTable'],'feeReset':table['feeReset'],
        'art':art,'prefabs':prefabs}
(web/'dist/talent.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
merged.update(scope['assets'])
(web/'dist/assets.json').write_text(json.dumps(merged,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print('levels',len(levels),'skills',len(skills),'art',len(art),'prefabs',list(prefabs),flush=True)
