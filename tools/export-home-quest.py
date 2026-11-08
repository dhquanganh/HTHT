"""Build dist/home-quest.json (nhiệm vụ chính ở sảnh, PanelHome2Quest) from db_home_quest + db_home_quest_template.

db_home_quest is one long chain (1333 rows, in id order). quest_type picks the template:
  1 Vượt qua tháp {0}            data [floor]
  2 Sở hữu {0} thuyền viên đạt cấp {1}   data [count, level]
  3 Vượt ải {0}                  data [stage id]  (shown as the stage code, e.g. 35 -> 4-5)
  4 Đạt cấp {0}                  data [level]
  5 Nâng {0} lần đá hộ mệnh      data [times]
  6 Nâng {0} lần kỹ năng băng    data [times]   (guild skills: not in the web build)
  7 Viễn chinh đảo trời {0} lần  data [times]   (sky island: not in the web build)
bonus is the usual token list (see export-chests.py): 1,N gold; 2,N diamonds; 3,kind,id,N item with
kind 1 consumable, 2 hero shard (db_heroes id), 3 artifact shard; 6,id,N equipment. Tokens the web build cannot deliver are
dropped and counted. Inputs are read only.
"""
from pathlib import Path
import json, collections, UnityPy

web=Path(__file__).resolve().parents[1]
cache=web.parent/'HTTH'
read=lambda name:json.loads((web/'dist'/name).read_text(encoding='utf-8'))
database=UnityPy.load(str(next(cache.rglob('database_ex/**/__data'))))
def table(name):
    p=next(p for n,p in database.container.items() if n.endswith('/'+name+'.txt'))
    raw=p.read().m_Script
    if not isinstance(raw,str):raw=raw.decode('utf-8')
    start=raw.find('[')
    return json.loads(raw[start:])
catalog=read('game-catalog.json')
items={x['id'] for x in catalog['items'] if x['category']!='skill'}|{x['id'] for x in read('items-extra.json')}
heroes={str(r['id']):str(r['avatar']) for r in table('db_heroes')}
album={h['avatar'] for h in read('hero-album.json')['heroes']}
unknown=collections.Counter()

def rewards_of(values):
    out=[];i=0
    while i<len(values):
        kind=values[i]
        if kind in (1,2):
            out.append({'itemId':'gold' if kind==1 else 'diamonds','quantity':values[i+1]});i+=2
        elif kind==3:
            group,item,quantity=values[i+1:i+4];i+=4
            if group==2:
                # A real hero gives its own shards; ids 10000+ are the generic "Mảnh tướng N sao" shard items.
                avatar=heroes.get(str(item))
                item_id='heroshard:'+avatar if avatar in album else 'shard:'+str(item)
                if avatar in album or item_id in items:out.append({'itemId':item_id,'quantity':quantity})
                else:unknown[item_id]+=1
                continue
            item_id={1:'consumable:',3:'shard:'}.get(group,'?:')+str(item)
            if item_id in items:out.append({'itemId':item_id,'quantity':quantity})
            else:unknown[item_id]+=1
        elif kind==6:
            # Only quest 14 ("Giúp Usopp bảo vệ làng") uses it: [6,70,3] read as 3 x equipment 70 (Mũ Đi Biển 1).
            item_id='equipment:'+str(values[i+1]);quantity=values[i+2];i+=3
            if item_id in items:out.append({'itemId':item_id,'quantity':quantity})
            else:unknown[item_id]+=1
        else:
            unknown['token:'+str(kind)]+=1;break
    return out

templates={str(t['type']):t['desc'] for t in table('db_home_quest_template')}
quests=[]
for row in sorted(table('db_home_quest'),key=lambda r:int(r['id'])):
    quests.append({'id':int(row['id']),'type':int(row['quest_type']),'data':json.loads(row['data']),'title':row['title'],'rewards':rewards_of(json.loads(row['bonus']))})
empty=[q['id'] for q in quests if not q['rewards']]
(web/'dist/home-quest.json').write_text(json.dumps({'templates':templates,'quests':quests},ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print(len(quests),'quests',dict(collections.Counter(q['type'] for q in quests)),'no reward:',len(empty),'dropped:',dict(unknown))
