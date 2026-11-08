"""Vành Đai Tĩnh Lặng (lua_silentring) -> dist/silent-ring.json.

Đọc nguyên từ cache HTTH:
  db_boss_silent (5 độ khó: hộ vệ 1/2, boss, cấp, kỹ năng đặc biệt theo máu hộ vệ, mốc sát thương, quà),
  db_quai + db_heroes + db_hero_skill + db_battle_heroes (Giant Squid 30006, Sea Cow 30001, Lord of the Coast 30000:
  chỉ số, kỹ năng, spine chiến đấu, hiệu ứng chiêu), mọi sprite và prefab của lua_silentring.
Inputs are read only; assets.json và hero-effects.json được gộp.
"""
from pathlib import Path
import json, sys, runpy

web=Path(__file__).resolve().parents[1]
# Dùng lại các hàm đọc bảng / spine / hiệu ứng của tools/export-beast.py (phần định nghĩa, trước vòng lặp boss).
src=(web/'tools/export-beast.py').read_text(encoding='utf-8').split('fx_store={};fx_heroes={};bosses=[]')[0]
g={'__file__':str(web/'tools/export-beast.py')};exec(compile(src,'export-beast.py','exec'),g)
table,heroes,skills,battle,monsters=g['table'],g['heroes'],g['skills'],g['battle'],g['monsters']
spine,head,skill,effect,scope=g['spine'],g['head'],g['skill'],g['effect'],g['scope']
g['fx_store']={};fx_store=g['fx_store']

sys.argv=[sys.argv[0],'none']
m=runpy.run_path(str(web/'tools/export-mermaid.py'))
ui_scope,prefab,files=m['scope'],m['prefab'],m['files']
def bundle_text(name):
    for bundle in ('lua_silentring','lua_pet'):
        for f in files[bundle]:
            for path,obj in getattr(f,'container',{}).items():
                o=obj.deref() if hasattr(obj,'deref') else obj
                if o.type.name=='TextAsset' and path.lower().endswith('/'+name+'.txt'):
                    t=o.read().m_Script;return (t if isinstance(t,str) else bytes(t).decode('utf-8')).lstrip('﻿')
rows=json.loads(bundle_text('db_boss_silent'))
parse=lambda s:json.loads('['+s.replace('\\','').strip()[1:-1]+']') if s.strip().startswith('[') else json.loads(s)
diffs=[]
for r in rows:
    diffs.append({'state':int(r['state']),'guards':[{'monsterId':r['monster1'],'level':int(r['level1'])},{'monsterId':r['monster2'],'level':int(r['level2'])}],
        'boss':{'monsterId':r['boss'],'level':int(r['level_boss'])},'skills1':json.loads(r['list_skill1']),'skills2':json.loads(r['list_skill2']),'hpSkill':json.loads(r['hp_skill']),
        'rankDmg':json.loads(r['rank_dmg']),'reward':json.loads(r['reward']),'seasonRankDmg':json.loads(r['rank_dmg_season']),'seasonReward':json.loads(r['season_reward'])})

def safe(f,*a):
    try:return f(*a)
    except StopIteration:print('missing',f.__name__,a,flush=True);return None
fx_heroes={};units={}
for avatar in ('30006','30001','30000'):
    base=heroes[avatar];point=json.loads(base['point']);combat=battle[avatar]['skills'][0]
    fx_heroes[avatar]={'animation':combat['animation'],'delay':float(combat.get('delay_cast_eff') or 0),'hits':[float(d.get('delay') or 0) for d in combat.get('split_dmgs') or []],
        'shake':[{'delay':float(x.get('delay') or 0),'duration':float(x.get('duration') or 0)} for x in combat.get('shake_cams') or [] if float(x.get('duration') or 0)>0],
        'cast':[e for e in map(effect,combat.get('cast_effs') or []) if e],'impact':[e for e in map(effect,combat.get('impact_effs') or []) if e]}
    units[avatar]={'avatar':avatar,'name':base['name'],'class':base['class'].lower(),'faction':base['type'].lower(),'rank':int(base['rank']),
        'point':{'attack':point[0],'armor':point[1],'hp':point[2],'speed':point[3]},
        'skills':[skill(base[k]) for k in ('active','passive1','passive2','passive3') if base.get(k) and base[k] in skills],
        'visual':{'avatar':avatar,'head':safe(head,avatar),'skeleton':safe(spine,f'{avatar}/hero_{avatar}'),'scale':float(battle[avatar]['scale']),'combat':{'skills':[{'animation':combat['animation'],'delay_cast_eff':combat.get('delay_cast_eff')}]}}}
monster_avatar={str(m['id']):heroes[m['link']]['avatar'] for m in monsters if 16000<=int(m['id'])<=16014}
special={str(i):skill(str(i)) for d in diffs for i in d['skills1']+d['skills2'] if str(i) in skills}

# ---- UI gốc
art={}
for f in files['lua_silentring']:
    for path,obj in getattr(f,'container',{}).items():
        o=obj.deref() if hasattr(obj,'deref') else obj
        if o.type.name=='Sprite':art[Path(path).stem.lower()]=ui_scope['save_image'](o)
names=['SilentRingStart','SilentRingHome','SilentRingMatch','SilentRingPopupAchievement','SilentRingPopupCheckIn','SilentRingPopupReward','SilentRingPopupSeasonReward','SilentRingAchItem','SilentRingRewItem']
prefabs={n:prefab('lua_silentring',n) for n in names}
prefabs['HeroHeadClickableForLua']=None
try:prefabs['HeroHeadClickableForLua']=prefab('lua_ex','HeroHeadClickableForLua')
except StopIteration:del prefabs['HeroHeadClickableForLua']

import re
plain=lambda t:re.sub(r'\s+',' ',re.sub(r'<[^>]+>','',t or '')).strip()
def clean(sk):
    if not sk:return sk
    name=plain(sk['name']);lv=re.search(r'\[(\d+)\]',name)
    return {**sk,'name':re.sub(r'\s*\[\d+\]\s*','',name),'level':int(lv.group(1)) if lv else None,'description':plain(sk['description'])}
for u in units.values():u['skills']=[clean(x) for x in u['skills']]
special={k:clean(v) for k,v in special.items()}
result={'diffs':diffs,'units':units,'monsters':monster_avatar,'special':special,'art':art,'prefabs':prefabs,'items':{'turns':5,'heroes':90,'minLevel':50}}
(web/'dist/silent-ring.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
merged=json.loads((web/'dist/assets.json').read_text(encoding='utf-8'));merged.update(scope['assets']);merged.update(ui_scope['assets'])
(web/'dist/assets.json').write_text(json.dumps(merged,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
fx=json.loads((web/'dist/hero-effects.json').read_text(encoding='utf-8'));fx['effects'].update(fx_store);fx['heroes'].update(fx_heroes)
(web/'dist/hero-effects.json').write_text(json.dumps(fx,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print('diffs',len(diffs),'units',list(units),'special',len(special),'art',len(art),'prefabs',list(prefabs),'effects',len(fx_store),flush=True)
