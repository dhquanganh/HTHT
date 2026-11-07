"""Build dist/equipment.json from the cached db_item_equipment, db_equipment_set and db_point_view.

The cache is the newest data the game shipped, so its numbers replace those in game-catalog.json.
db_equipment_set is not in the cache: it comes from the APK. Inputs are read only.
"""
from pathlib import Path
import json, re, UnityPy

web=Path(__file__).resolve().parents[1]
database=UnityPy.load(str(next((web.parent/'HTTH').rglob('database_ex/**/__data'))))
def raw(name):
    p=next(p for n,p in database.container.items() if n.endswith('/'+name+'.txt'))
    text=p.read().m_Script
    return text if isinstance(text,str) else text.decode('utf-8')
def table(name):
    text=raw(name);return json.loads(text[text.index('[{'):])
text_assets=web/'extracted/original-assets/TextAsset'
sets=[]
for path in text_assets.glob('*_db_equipment_set.bytes'):
    rows=re.sub(r'\\"','"',path.read_text(encoding='utf-8',errors='replace'))
    rows=re.sub(r'"effect":\s*"?\[','"effect":[',rows);rows=re.sub(r'\]"?,(\s*)"set"',r'],\1"set"',rows)
    data=json.loads(rows[rows.index('['):])
    if any(any('À'<=c for c in row['name']) for row in data):sets=data;break
assert len(sets)==12,len(sets)

# The database colour is a server label. The art shows the real tier: blue rows are grey, yellow rows green, and so on.
tiers={'blue':(1,'gray'),'yellow':(2,'green'),'purple':(3,'blue'),'green':(4,'purple'),'red':(5,'yellow'),'orange':(6,'red')}
slots={'0':'pants','1':'armor','2':'boots','3':'helmet'}
items={}
for row in table('db_item_equipment'):
    tier,rarity=tiers[row['color']];cost=int(row['forge_cost']);material=row['forge_material']
    points=[{'clazz':p['clazz'],'point':[[p['point'][i],p['point'][i+1]] for i in range(0,len(p['point']),2)]} for p in json.loads(row['point_desc'])]
    items['equipment:'+row['id']]={'name':row['name'],'slot':slots[row['type']],'heroClass':row['class'] or None,'tier':tier,'rarity':rarity,'stars':int(row['star']),'points':points,'sellPrice':int(row['sell_price']),
        'forge':{'material':'equipment:'+material,'count':int(row['material_number']),'gold':cost} if cost>=0 else None}
views={}
for row in table('db_point_view'):views[row['id_point']]={'name':row['description'],'rate':float(row['num_rate']),'percent':row['text_values']=='%'}
used={str(id) for item in items.values() for group in item['points'] for id,_ in group['point']}|{str(id) for row in sets for e in row['effect'] for id in e['point'][::2]}
result={'items':items,'sets':[{'id':row['id'],'name':row['name'],'items':['equipment:'+str(id) for id in row['set']],'effects':[[[e['point'][i],e['point'][i+1]] for i in range(0,len(e['point']),2)] for e in row['effect']]} for row in sets],'points':{id:views[id] for id in sorted(used,key=int)}}
(web/'dist/equipment.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print(len(items),'items;',len(result['sets']),'sets; points',{k:v['name'] for k,v in result['points'].items()})
print(sum(1 for i in items.values() if i['forge']),'recipes')
