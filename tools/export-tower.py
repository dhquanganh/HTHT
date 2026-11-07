"""Build dist/tower.json (Leo đậu thần, chế độ Đơn) from db_tower, db_quai and db_heroes.

Inputs are read only. assets.json is merged, never replaced. Skeletons already exported for
the campaign are reused; only avatars the tower adds are exported here.
"""
from pathlib import Path
import json, re, UnityPy

web=Path(__file__).resolve().parents[1]
scope={'__file__':str(web/'tools/export_ui.py')}
exec(compile((web/'tools/export_ui.py').read_text(encoding='utf-8').split('build=env.load_file')[0],'export_ui.py','exec'),scope)
rm=next(o.read() for o in scope['env'].load_file(str(scope['DATA']/'globalgamemanagers')).objects.values() if o.type.name=='ResourceManager')
paths={}
for name,ptr in rm.m_Container: paths.setdefault(name,[]).append(ptr)
cache=UnityPy.load(str(next((web.parent/'HTTH').rglob('database_ex/**/__data'))))
def table(name):
    p=next(p for n,p in cache.container.items() if n.endswith('/'+name+'.txt'))
    raw=p.read().m_Script
    if not isinstance(raw,str):raw=raw.decode('utf-8')
    return json.loads(raw[raw.index('[{'):])

tower=table('db_tower');monsters={str(r['id']):r for r in table('db_quai')};heroes={str(r['id']):r for r in table('db_heroes')}
battle={str(r['key']):r for r in table('db_battle_heroes')}
campaign=json.loads((web/'dist/campaign.json').read_text(encoding='utf-8'))
items={x['id'] for x in json.loads((web/'dist/game-catalog.json').read_text(encoding='utf-8'))['items']}

pointers={}
def remote():
    if pointers:return pointers
    for pack in ['herohead_ex','herospine2','herospine3','herospine4','herospine5','herospineupdate']:
        for name,ptr in UnityPy.load(str(next((web.parent/'HTTH').rglob(pack+'/**/__data')))).container.items():
            if ptr.deref().type.name in ['Sprite','MonoBehaviour']:pointers.setdefault(name,ptr)
    return pointers
def image(resource):
    ptr=next((p for p in paths.get(resource,[]) if p.deref().type.name=='Sprite'),None)
    return scope['image_ptr'](ptr) if ptr else None
visuals={};warnings=[]
def visual(avatar):
    if avatar in visuals or campaign['visuals'].get(avatar,{}).get('skeleton'):return
    head=image('_pack/herohead/'+avatar);skel=None
    for name,ptrs in paths.items():
        if re.search(r'/'+avatar+r'/hero_'+avatar+r'_skeletondata$',name):
            try:skel=scope['skeleton'](ptrs[0]);break
            except Exception as ex:warnings.append(avatar+': '+str(ex)[:100])
    if not skel or not head:
        for name,ptr in remote().items():
            if not skel and name.endswith('/'+avatar+'/hero_'+avatar+'_skeletondata.asset'):
                try:skel=scope['skeleton'](ptr)
                except Exception as ex:warnings.append(avatar+': '+str(ex)[:100])
            if not head and name.endswith('/herohead/'+avatar+'.png'):head=scope['image_ptr'](ptr)
    visuals[avatar]={'avatar':avatar,'head':head,'skeleton':skel,'combat':battle.get(avatar)}
    if skel:print('Skeleton',avatar,len(visuals),flush=True)
    else:warnings.append('No animation packaged for avatar '+avatar)

def number(value):
    return int(value) if value and str(value).isdigit() else 0
def drops(row):
    multiplier=re.match(r'(\d+)x$',str(row.get('other') or ''))
    found=[]
    for item_id,quantity in [('equipment:'+str(row['item']),int(multiplier.group(1)) if multiplier else 1) if row.get('item') else (None,0),
                             ('consumable:'+str(row['item_use']),int(multiplier.group(1)) if multiplier else number(row.get('item_use_number'))) if row.get('item_use') else (None,0),
                             ('shard:'+str(row['shard']),number(row.get('shard_number'))) if row.get('shard') else (None,0)]:
        if not item_id or not quantity:continue
        if item_id in items:found.append({'itemId':item_id,'quantity':quantity})
        else:unknown.add(item_id)
    # hero_shard_id is a hero, not an item. `other` says 1x because 60 shards merge into one hero.
    if row.get('hero_shard_id'):found.append({'itemId':'heroshard:'+str(row['hero_shard_id']),'quantity':number(row.get('hero_shard_num'))})
    return found

unknown=set();enemies={};floors=[];skipped=0
for row in tower:
    slots=[]
    for position in range(1,7):
        monster_id=str(row['slot%d_id'%position]);monster=monsters.get(monster_id)
        hero=heroes.get(str(monster['link'])) if monster else None
        if not hero:skipped+=1;continue
        avatar=str(hero['avatar']);visual(avatar)
        if not (visuals.get(avatar) or campaign['visuals'].get(avatar,{})).get('skeleton'):skipped+=1;continue
        enemies.setdefault(monster_id,{'sourceId':monster_id,'heroId':str(monster['link']),'avatar':avatar,'name':hero.get('name','Đối thủ'),'level':int(row['monster_level']),'stars':int(monster['star']),'faction':str(hero.get('type','abyss')).lower(),'class':str(hero.get('class','warrior')).lower()})
        slots.append({'monsterId':monster_id,'position':position})
    floors.append({'floor':int(row['id']),'level':int(row['monster_level']),'power':int(row['power']),'gold':number(row['gold']),'stones':number(row['promostone']),'drops':drops(row),'enemies':slots})

merged=json.loads((web/'dist/assets.json').read_text(encoding='utf-8'));merged.update(scope['assets'])
(web/'dist/assets.json').write_text(json.dumps(merged,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
(web/'dist/tower.json').write_text(json.dumps({'floors':floors,'enemies':enemies,'visuals':visuals},ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print('DONE',len(floors),'floors;',len(enemies),'monsters;',len(visuals),'new avatars;',skipped,'slots skipped;',sorted(unknown)[:20],warnings[:20],flush=True)
