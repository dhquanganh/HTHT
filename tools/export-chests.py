"""Build dist/chests.json from the `preview` column of db_item_consumable.

`preview` is a flat token list: 1,N gold; 2,N diamonds; 3,kind,id,N item (kind 1 consumable,
2 hero shard, 3 artifact shard); 5,id hero; 6,id,N equipment; 7,id,level,N artifact; 8,1,id special avatar.
Item type 2 gives one random entry, type 3 lets the player pick one. The description refines the mode:
"nhận tất cả" gives every entry, "Chọn chỉ định" is a pick, "1 set" draws one whole equipment set (`groups`).
Chests whose preview is empty are filled from their description (rules at the end): pet bags / pet shard chests
(db pet names), devil fruits and fruit shards (the FFMain wheel `fakeitem` rows). Entries the game cannot deliver
are dropped; a chest left with nothing is reported and skipped.
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
# Mảnh tướng chỉ có cho tướng chơi được (heroshard:<avatar> do server/catalog.mjs tạo); hỏi thẳng catalog để khớp.
import subprocess
hero_shards=set(json.loads(subprocess.run(['node','-e',"import('./server/catalog.mjs').then(m=>console.log(JSON.stringify([...m.itemById.keys()].filter(k=>k.startsWith('heroshard:')))))"],cwd=web,capture_output=True,text=True,check=True).stdout))
equipment=read('equipment.json')
pets=read('pet.json')['pets'];fruits=read('devil-fruit.json')
unknown=collections.Counter()
def tokens(preview):
    text=str(preview or '').strip()
    if not text.startswith('['):return []
    if not text.endswith(']'):text=text[:text.rfind(',')]+']'
    text=re.sub(r',\s*\]$',']',text)  # bảng gốc có dòng kết thúc bằng ",]"
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
            # Nhóm 2 với id tướng (< 10000): mảnh của chính tướng đó.
            if group==2 and item<10000 and 'heroshard:'+str(heroes.get(str(item))) in hero_shards:item_id='heroshard:'+heroes[str(item)]
            if item_id in items or item_id in hero_shards:rewards.append({'kind':'item','itemId':item_id,'quantity':quantity})
            else:unknown[item_id]+=1
        elif kind==5:
            if i+1>=len(values):break
            avatar=heroes.get(str(values[i+1]));i+=2
            if avatar in album:rewards.append({'kind':'hero','avatar':avatar,'quantity':1})
            else:unknown['hero:'+str(avatar)]+=1
        elif kind==6:
            if i+2>=len(values):break
            item_id='equipment:'+str(values[i+1]);quantity=values[i+2];i+=3
            if item_id in items:rewards.append({'kind':'item','itemId':item_id,'quantity':quantity})
            else:unknown[item_id]+=1
        elif kind==8:
            if i+2>=len(values):break
            rewards.append({'kind':'avatar','id':values[i+2],'quantity':1});i+=3
        elif kind==7:
            if i+3>=len(values):break
            item_id='artifact:'+str(values[i+1]);quantity=values[i+3];i+=4
            if item_id in items:rewards.append({'kind':'item','itemId':item_id,'quantity':quantity})
            else:unknown[item_id]+=1
        else:
            unknown['token:'+str(kind)]+=1;break
    return rewards
def set_groups(rewards):
    '''Mỗi bộ = 4 món liên tiếp trong preview (mũ / áo / quần / giày, xếp theo bộ như bảng gốc);
    chỉ nhận khi cụm nào cũng đủ 4 ô khác nhau. equipment.json chỉ có tên bộ cho một phần nên không dùng nó để ghép.'''
    if len(rewards)%4 or any(r['kind']!='item' for r in rewards):return None
    slot=lambda r:equipment['items'].get(r['itemId'],{}).get('slot')
    groups=[list(range(i,i+4)) for i in range(0,len(rewards),4)]
    return groups if all(len({slot(rewards[i]) for i in g}-{None})==4 for g in groups) else None
norm=lambda t:re.sub(r'[^0-9a-zà-ỹđ]','',t.lower())
pets_by_rank=lambda rank:[p for p in pets if p['rank']==rank]
def named_pets(text):
    '''Thú cưng có tên nằm trong đoạn mô tả (bỏ dấu cách / ngoặc); tên dài khớp trước để "Cá Ngựa (Lão)" không ăn nhầm.'''
    t=norm(text);found=[]
    for p in sorted(pets,key=lambda p:-len(norm(p['name']))):
        key=norm(p['name'])
        if key and key in t:found.append(p);t=t.replace(key,'|')
    return found
# FFMain: fakeitem 103-105 = trái A / S / SS, 106-114 = mảnh tiểu (1) / trung (5) / đại (10) cùng bậc; values = các trái.
fruit_rows={}
for row in fruits['config']['summonNormal']+fruits['config']['summonSpecial']:fruit_rows.setdefault(row['fakeitem'],row)
fruit_by_rank=lambda rank:[f['id'] for f in fruits['fruits'] if f['rank']==rank]
def described(item_id,name,desc):
    n=int(item_id.split(':')[1])
    if 103<=n<=114:
        tier=(n-103)%3;rank=tier+1;row=fruit_rows.get(n) or next((r for r in fruit_rows.values() if r['rank']==rank and r['type']==(1 if n<=105 else 2)),None)
        pool=row['values'] if row else fruit_by_rank(rank)
        if n<=105:return [{'kind':'fruit','id':f,'quantity':1} for f in pool]
        return [{'kind':'fruitShard','id':f,'quantity':[1,5,10][(n-106)//3]} for f in pool]
    if 4001<=n<=4099:
        f=next((f for f in fruits['fruits'] if f['id']==n-4000),None)
        return [{'kind':'fruitShard','id':f['id'],'quantity':10}] if f else []
    amount=re.search(r'nhận\s+(\d+)\s+mảnh',desc,re.I)
    if re.search(r'thú cưng|^rương mảnh',name+' '+desc,re.I):
        listed=named_pets(desc.split(':',1)[1] if ':' in desc else desc.replace('Thú Cưng',''))
        if not listed and re.search(r'\bSS\b',name):listed=pets_by_rank(6)
        if amount:return [{'kind':'petShard','id':p['id'],'quantity':int(amount.group(1))} for p in listed]
        return [{'kind':'pet','id':p['id'],'quantity':1} for p in listed]
    return []
chests={};empty=[];partial=0
for row in table('db_item_consumable'):
    item_id='consumable:'+str(row['id']);mode={'2':'random','3':'choice'}.get(str(row['type']))
    if not mode or item_id not in items or item_id in ('consumable:53','consumable:54'):continue
    desc=str(row.get('desc') or '');values=tokens(row.get('preview'))
    rewards=[r for r in parse(values) if r['quantity']>0] if values else described(item_id,row['name'],desc)
    if not rewards:
        if values:empty.append(item_id+' '+row['name'])
        continue
    if re.search(r'nhận tất cả',desc,re.I):mode='all'
    elif re.match(r'\s*chọn chỉ định',desc,re.I):mode='choice'
    chests[item_id]={'mode':mode,'rewards':rewards}
    if mode=='random' and re.search(r'\b1 set\b',desc,re.I):
        groups=set_groups(rewards)
        if groups:chests[item_id]['groups']=groups
    draws=re.search(r'(\d+)\s*(?:phần thưởng|vật phẩm|phần quà|món)',desc)
    if mode=='random' and draws and 1<int(draws.group(1))<=20:chests[item_id]['draws']=int(draws.group(1))
(web/'dist/chests.json').write_text(json.dumps(chests,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
# Tên + ảnh cho các loại quà không phải vật phẩm (thú cưng / trái ác quỷ / avatar) để client vẽ ô mà không tải pet.json,
# devil-fruit.json (vài MB). Chỉ ghi những id có trong rương.
used=collections.defaultdict(set)
for c in chests.values():
    for r in c['rewards']:
        if r['kind'] in ('pet','petShard'):used['pet'].add(r['id'])
        elif r['kind'] in ('fruit','fruitShard'):used['fruit'].add(r['id'])
        elif r['kind']=='avatar':used['avatar'].add(r['id'])
pet_art=read('pet.json')['art'];avatars={a['id']:a for a in read('avatars.json')['special']}
art={'pet':{p['id']:{'name':p['name'],'key':pet_art.get('petresources/'+str(p['id'])),'rank':p['rank']} for p in pets if p['id'] in used['pet']},
     'fruit':{f['id']:{'name':f['name'],'key':fruits['art'].get('fruitsmall/'+str(f['id'])),'rank':f['rank']} for f in fruits['fruits'] if f['id'] in used['fruit']},
     'avatar':{i:{'name':avatars[i]['name'],'key':avatars[i]['key']} for i in sorted(used['avatar']) if i in avatars}}
(web/'dist/chest-art.json').write_text(json.dumps(art,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
modes=collections.Counter(c['mode'] for c in chests.values())
kinds=collections.Counter(r['kind'] for c in chests.values() for r in c['rewards'])
print('DONE',len(chests),'chests',dict(modes),dict(kinds),'empty',len(empty),empty[:12],'unknown',unknown.most_common(14),flush=True)
