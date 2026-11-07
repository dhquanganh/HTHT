"""Build dist/items-extra.json: every item from the cached db_item_* tables missing from game-catalog.json.

Inputs are read only. assets.json is merged, never replaced. Rows without a name or any art are
reported and skipped: they are counters such as quest statistics, not items.
"""
from pathlib import Path
import json, re, UnityPy

web=Path(__file__).resolve().parents[1]
cache=web.parent/'HTTH';output=web/'dist/assets'
merged=json.loads((web/'dist/assets.json').read_text(encoding='utf-8'))
existing=json.loads((web/'dist/game-catalog.json').read_text(encoding='utf-8'))['items']
known={x['id']:x for x in existing}
database=UnityPy.load(str(next(cache.rglob('database_ex/**/__data'))))
def table(name):
    p=next(p for n,p in database.container.items() if n.endswith('/'+name+'.txt'))
    raw=p.read().m_Script
    if not isinstance(raw,str):raw=raw.decode('utf-8')
    return json.loads(raw[raw.index('[{'):])
def sprites(bundle):
    found={}
    for name,ptr in UnityPy.load(str(next(cache.rglob(bundle+'/**/__data')))).container.items():
        if ptr.deref().type.name=='Sprite':found[name.rsplit('/',1)[-1].split('.')[0]]=ptr
    return found
def register(key,name,ptr):
    if key not in merged:
        image=ptr.read().image;path=output/(key+'.webp')
        if not path.exists():image.convert('RGBA').save(path,'WEBP',quality=90,method=4)
        merged[key]={'name':name,'src':'assets/'+key+'.webp','width':image.width,'height':image.height}
    return key
plain=lambda text:re.sub(r'\s+',' ',re.sub(r'<[^>]+>','',str(text or ''))).strip()
ranks={'green':2,'blue':3,'yellow':4,'purple':5,'red':6}
qualities={'1':'blue','2':'yellow','3':'purple','4':'red','5':'red','6':'red'}
extras=[];skipped=[]
for category,name,bundle in [('consumable','db_item_consumable','itemconsumable_ex'),('artifact','db_item_baovat','itemartifact_ex'),('shard','db_item_manh','itemshard_ex')]:
    art=sprites(bundle)
    for row in table(name):
        legacy=str(row['id']);item_id=category+':'+legacy
        if item_id in known:continue
        label=plain(row.get('name'))
        key=register(f'item{category}-{legacy}',legacy,art[legacy]) if legacy in art else None
        # The six faction-specific 3-star shards ship without art of their own.
        if not key and category=='shard' and 10001<=int(legacy)<=10006:key=known['shard:10000']['assetKey']
        if not label or not key:skipped.append(f'{item_id} {label}');continue
        rarity=qualities.get(str(row.get('quality')),'green') if category=='artifact' else 'green'
        rank=ranks[rarity]
        extras.append({'id':item_id,'legacyId':legacy,'category':category,'name':label,'slot':'accessory' if category=='artifact' else None,'type':row.get('type'),'rarity':rarity,'rarityRank':rank,'stars':1,'assetKey':key,'stats':{'attack':5+rank*3,'hp':30+rank*20} if category=='artifact' else {},'description':plain(row.get('desc') or row.get('short_desc')) or label})
(web/'dist/assets.json').write_text(json.dumps(merged,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
(web/'dist/items-extra.json').write_text(json.dumps(extras,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print('DONE',len(extras),'items;',len(skipped),'skipped',skipped,flush=True)
