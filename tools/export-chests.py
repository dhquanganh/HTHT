"""Build dist/chests.json from the `preview` column of db_item_consumable.

`preview` is a flat token list: 1,N gold; 2,N diamonds; 3,kind,id,N item (kind 1 consumable,
2 hero shard, 3 artifact shard); 5,id hero; 7,id,level,N artifact. Item type 2 gives one random
entry, type 3 lets the player pick one. Entries the game cannot deliver (pets and other systems
missing here) are dropped; a chest left with nothing is reported and skipped.
"""
from pathlib import Path
import json, re, UnityPy, collections

web=Path(__file__).resolve().parents[1]
cache=web.parent/'HTTH'
read=lambda name:json.loads((web/'dist'/name).read_text(encoding='utf-8'))
database=UnityPy.load(str(next(cache.rglob('database_ex/**/__data'))))
def table(name):
    p=next(p for n,p in database.container.items() if n.endswith('/'+name+'.txt'))
    raw=p.read().m_Script
    if not isinstance(raw,str):raw=raw.decode('utf-8')
    return json.loads(raw[raw.index('[{'):])
items={x['id'] for x in read('game-catalog.json')['items'] if x['category']!='skill'}|{x['id'] for x in read('items-extra.json')}
heroes={str(r['id']):str(r['avatar']) for r in table('db_heroes')}
album={h['avatar'] for h in read('hero-album.json')['heroes']}
unknown=collections.Counter()
def tokens(preview):
    text=str(preview or '').strip()
    if not text.startswith('['):return []
    if not text.endswith(']'):text=text[:text.rfind(',')]+']'
    try:return json.loads(text)
    except ValueError:return []
def parse(values):
    rewards=[];i=0
    while i<len(values):
        kind=values[i]
        if kind in (1,2):
            if i+1<len(values):rewards.append({'kind':'gold' if kind==1 else 'diamonds','quantity':values[i+1]})
            i+=2
        elif kind==3:
            if i+3>=len(values):break
            group,item,quantity=values[i+1:i+4];i+=4
            item_id={1:'consumable:',2:'shard:',3:'shard:'}.get(group,'?:')+str(item)
            if item_id in items:rewards.append({'kind':'item','itemId':item_id,'quantity':quantity})
            else:unknown[item_id]+=1
        elif kind==5:
            if i+1>=len(values):break
            avatar=heroes.get(str(values[i+1]));i+=2
            if avatar in album:rewards.append({'kind':'hero','avatar':avatar,'quantity':1})
            else:unknown['hero:'+str(avatar)]+=1
        elif kind==7:
            if i+3>=len(values):break
            item_id='artifact:'+str(values[i+1]);quantity=values[i+3];i+=4
            if item_id in items:rewards.append({'kind':'item','itemId':item_id,'quantity':quantity})
            else:unknown[item_id]+=1
        else:
            unknown['token:'+str(kind)]+=1;break
    return rewards
chests={};empty=[];partial=0
for row in table('db_item_consumable'):
    item_id='consumable:'+str(row['id']);mode={'2':'random','3':'choice'}.get(str(row['type']))
    if not mode or item_id not in items or item_id in ('consumable:53','consumable:54'):continue
    values=tokens(row.get('preview'))
    if not values:continue
    rewards=[r for r in parse(values) if r['quantity']>0]
    if not rewards:empty.append(item_id+' '+row['name']);continue
    chests[item_id]={'mode':mode,'rewards':rewards}
    draws=re.search(r'(\d+)\s*(?:phần thưởng|vật phẩm|phần quà|món)',str(row.get('desc') or ''))
    if mode=='random' and draws and 1<int(draws.group(1))<=20:chests[item_id]['draws']=int(draws.group(1))
(web/'dist/chests.json').write_text(json.dumps(chests,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
modes=collections.Counter(c['mode'] for c in chests.values())
kinds=collections.Counter(r['kind'] for c in chests.values() for r in c['rewards'])
print('DONE',len(chests),'chests',dict(modes),dict(kinds),'empty',len(empty),empty[:12],'unknown',unknown.most_common(14),flush=True)
