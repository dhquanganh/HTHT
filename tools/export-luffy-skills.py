"""Match Luffy's four requested icons and skill tiers to the original APK database."""
from pathlib import Path
import json,re,UnityPy
web=Path(__file__).resolve().parents[1];data=web.parent/'assets/bin/Data'
env=UnityPy.Environment();env.path=str(data)
for p in data.glob('*.split0'):env.load_file(str(p))
f=env.load_file(str(data/'globalgamemanagers'))
resources=next(o.read() for o in f.objects.values() if o.type.name=='ResourceManager')
paths=dict(resources.m_Container)
rows=json.loads(paths['_pack/db/db_hero_skill'].read().m_Script)
by_id={str(r['id']):r for r in rows}
items=json.loads((web/'dist/game-catalog.json').read_text(encoding='utf-8'))['items']
icons={x['legacyId']:x['assetKey'] for x in items if x['category']=='skill'}
definitions=[
 ('rubber-whip','Roi Cao Su','685',['938','1033','1135'],'jet-gatling',False,
  [{'damage':2.5,'heal':1.8,'attackBuff':0},{'damage':2.8,'heal':2.5,'attackBuff':0},{'damage':3.2,'heal':5.6,'attackBuff':.6}]),
 ('polish','Mài Dũa','140',['84','218','362'],'jet-pistol',True,
  [{'critReduction':.09},{'critReduction':.15},{'critReduction':.18}]),
 ('armament-haki','Haki Vũ Trang','183',['83','217','361'],'gear-second',True,
  [{'armor':.32,'hp':.2},{'armor':.32,'hp':.3},{'armor':.4,'hp':.4}]),
 ('desperation','Tuyệt Cảnh','160',['85','219','363'],None,True,
  [{'armor':.6},{'armor':1.0},{'armor':1.2}]),
]
result=[]
for id,name,icon,source_ids,legacy,passive,values in definitions:
 levels=[]
 for index,(source_id,params) in enumerate(zip(source_ids,values),1):
  source=by_id[source_id];assert str(source['icon'])==icon
  description=re.sub(r'<[^>]+>','',source['description'])
  levels.append({'level':index,'sourceId':source_id,'description':description,'values':params})
 result.append({'id':id,'name':name,'iconId':icon,'assetKey':icons[icon],'legacySkillId':legacy,
                'passive':passive,'energy':0 if passive else 80,'cooldown':0 if passive else 2,
                'animation':'idling' if passive else 'skill3','description':levels[0]['description'],'levels':levels})
(web/'dist/luffy-skills.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print([(s['name'],s['iconId'],s['levels'][-1]['description']) for s in result])
