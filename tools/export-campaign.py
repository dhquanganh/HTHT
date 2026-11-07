"""Build the campaign catalog from Unity's db_vuotai/db_quai and original art.

Inputs are read only. Source row IDs, enemy positions and rewards are retained.
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

rows=table('db_vuotai');monsters={str(r['id']):r for r in table('db_quai')}
heroes={str(r['id']):r for r in table('db_heroes')}
battle={str(r['key']):r for r in table('db_battle_heroes')}
localization=json.loads((web/'dist/localization.json').read_text(encoding='utf-8'))
assets=scope['assets'];existing=json.loads((web/'dist/game-catalog.json').read_text(encoding='utf-8'))['items']
item_ids={r['id'] for r in existing};visuals={};warnings=[]
def image_name(name):
    return next((k for k,a in assets.items() if a['name']==name),None)
def export_resource_image(resource):
    pointers=paths.get(resource,[])
    ptr=next((p for p in pointers if p.deref().type.name=='Sprite'),None)
    return scope['image_ptr'](ptr) if ptr else None
cache_pointers={}
def remote_paths():
    if cache_pointers:return cache_pointers
    for pack in ['herohead_ex','herospine2','herospine3','herospine4','herospine5','herospineupdate']:
        env=UnityPy.load(str(next((web.parent/'HTTH').rglob(pack+'/**/__data'))))
        for name,ptr in env.container.items():
            if ptr.deref().type.name in ['Sprite','MonoBehaviour']:cache_pointers.setdefault(name,ptr)
    return cache_pointers
def visual(avatar):
    if avatar in visuals:return
    head=export_resource_image('_pack/herohead/'+avatar)
    matches=[p for name,ptrs in paths.items() if re.search(r'/'+avatar+r'/hero_'+avatar+r'_skeletondata$',name) for p in ptrs]
    skel=None
    if matches:
        try:skel=scope['skeleton'](matches[0])
        except Exception as ex:warnings.append(avatar+': '+str(ex)[:100])
    if not skel or not head:
        for name,ptr in remote_paths().items():
            if not skel and name.endswith('/'+avatar+'/hero_'+avatar+'_skeletondata.asset'):
                try:skel=scope['skeleton'](ptr)
                except Exception as ex:warnings.append(avatar+': '+str(ex)[:100])
            if not head and name.endswith('/herohead/'+avatar+'.png'):head=scope['image_ptr'](ptr)
    visuals[avatar]={'avatar':avatar,'head':head,'skeleton':skel,'combat':battle.get(avatar)}
    if not skel:warnings.append('No animation packaged for avatar '+avatar)

used=sorted({str(i) for row in rows for i in json.loads(row['monster_id'])},key=int)
enemy_rows={}
for i,mid in enumerate(used):
    m=monsters[mid];hero=heroes.get(str(m['link']),{});avatar=str(hero.get('avatar',m['link']));visual(avatar)
    enemy_rows[mid]={'sourceId':mid,'heroId':str(m['link']),'avatar':avatar,'name':hero.get('name','Đối thủ '+str(m['link'])),
        'level':int(m['level']),'scaleLevel':int(m['slevel']),'stars':int(m['star']),
        'faction':hero.get('type','abyss'),'class':hero.get('class','warrior'),'sourcePoint':json.loads(hero.get('point','[]'))[:4]}
    if i%70==0:print('Enemies',i,'/',len(used),flush=True)

stages=[];chapters={}
for row in rows:
    sid=int(row['id']);chapter,number=map(int,row['stage'].split('-'));win=json.loads(row['win_reward']);ids=json.loads(row['monster_id']);positions=json.loads(row['monster_position']);drops=[]
    for field,category in [('itemId','equipment'),('itemShardId','shard')]:
        if win.get(field) and category+':'+str(win[field]) in item_ids:drops.append({'itemId':category+':'+str(win[field]),'quantity':1})
    stages.append({'id':sid,'code':row['stage'],'chapter':chapter,'number':number,'name':'Ải '+row['stage'],
        'requireLevel':int(row['require_level']),'recommendedPower':int(row.get('power') or 0),'enemyPower':int(row.get('power_monster') or 0),
        'enemies':[{'monsterId':str(mid),'position':int(pos)} for mid,pos in zip(ids,positions)],'enemyCount':len(ids),
        'rewards':{'gold':int(win.get('gold',0)),'diamonds':0,'accountExp':int(win.get('exp',0)),'heroExp':int(win.get('spirit',0))},
        'firstClear':{'diamonds':0,'starShards':0},'drops':drops,'idleOutput':row.get('output',''),'sourceReward':win})
    if chapter not in chapters:
        term='MISC_2_CAMPAIGN_MAP_1' if chapter==1 else 'MISC_2_CAMPAIGN_MAP_INFO_'+str(chapter)
        chapters[chapter]={'id':chapter,'name':localization.get(term,'Hải trình '+str(chapter)),'nameTerm':term if term in localization else None,
            'islandKey':image_name('gate_'+str(1+(chapter-1)%7)),'stageIds':[]}
    chapters[chapter]['stageIds'].append(sid)

scene=json.loads((web/'dist/scenes/34.json').read_text(encoding='utf-8'))
def walk(nodes):
    for n in nodes:
        yield n
        yield from walk(n['children'])
chest=next(c['skeleton'] for n in walk(scene['roots']) for c in n['components'] if c.get('skeleton',{}).get('name')=='LootChest_3_SkeletonData')
decor=[]
part=json.loads((web/'dist/scenes/1381.json').read_text(encoding='utf-8'))
for node in part['roots'][0]['children']:
    if node['name']!='Terrain1':continue
    parent=node['transform']['m_AnchoredPosition']
    for child in node['children']:
        component=next((c for c in child['components'] if c['type']=='Image'),None)
        if not component:continue
        pos=child['transform']['m_AnchoredPosition'];size=child['transform']['m_SizeDelta']
        x=parent['x']+pos['x']+1660;y=367-parent['y']-pos['y']
        if -100<x<1236:decor.append({'assetKey':component['asset'],'x':x,'y':y,'width':size['x'],'height':size['y']})

result={'version':1,'sources':['UnityCache/Shared/database_ex: db_vuotai, db_quai, db_heroes, db_battle_heroes','I2Languages_campaign','CampaignMapPart','CampaignScene','PopupFormation'],
    'chapters':list(chapters.values()),'stages':stages,'enemies':enemy_rows,'visuals':visuals,
    'ui':{'ocean':image_name('campaign_map'),'deck':image_name('bgr_auto'),'rail':image_name('bgr_island'),'lootChest':chest,'decor':decor},'warnings':warnings}
(web/'dist/campaign.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
(web/'dist/assets.json').write_text(json.dumps(assets,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
(web/'extracted/campaign-export-report.json').write_text(json.dumps({'chapters':len(chapters),'stages':len(stages),'monsters':len(enemy_rows),'avatars':len(visuals),'warnings':warnings},ensure_ascii=False,indent=2),encoding='utf-8')
print('DONE',len(stages),'stages;',len(chapters),'chapters;',len(visuals),'avatars;',len(warnings),'warnings',flush=True)
