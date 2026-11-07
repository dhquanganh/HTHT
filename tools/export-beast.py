"""Build dist/beast.json (Chiến Thần Thú) and scenes 53, 1600 from the original boss-of-world prefabs.

Sources: db_heroes, db_quai, db_hero_skill, db_battle_heroes and the lua_ex bundle. Inputs are read only.
assets.json, catalog.json and hero-effects.json are merged, never replaced.
"""
from pathlib import Path
import collections, json, UnityPy

web=Path(__file__).resolve().parents[1]
scope={'__file__':str(web/'tools/export_ui.py')}
exec(compile((web/'tools/export_ui.py').read_text(encoding='utf-8').split('build=env.load_file')[0],'export_ui.py','exec'),scope)
env,component,image_ptr,skeleton=scope['env'],scope['component'],scope['image_ptr'],scope['skeleton']
cache=web.parent/'HTTH'
rm=next(o.read() for o in env.load_file(str(scope['DATA']/'globalgamemanagers')).objects.values() if o.type.name=='ResourceManager')
apk={}
for name,ptr in rm.m_Container:apk.setdefault(name.lower(),[]).append(ptr)
pack=lambda name:next(cache.rglob(name+'/**/__data'))
database=UnityPy.load(str(pack('database_ex')))
def table(name):
    p=next(p for n,p in database.container.items() if n.endswith('/'+name+'.txt'))
    raw=p.read().m_Script
    if not isinstance(raw,str):raw=raw.decode('utf-8')
    return json.loads(raw[raw.index('[{'):])
heroes={r['id']:r for r in table('db_heroes')};skills={r['id']:r for r in table('db_hero_skill')}
battle={str(r['key']):r for r in table('db_battle_heroes')};monsters=table('db_quai')

# Building order of the prefab: Building_01..05 sit on these islands in the reference screen.
order=[('sea-king','30007'),('nola','30003'),('dragon-13','30005'),('oars','30008'),('smiley','30002')]
factions={'dark':'dark','light':'light','shadow':'shadow','abyss':'abyss','forest':'forest','fortress':'fortress'}
remote=UnityPy.load(str(pack('herospineupdate'))).container
def spine(path):
    return skeleton(next(p for n,p in remote.items() if n.endswith(path+'_skeletondata.asset')))
heads=UnityPy.load(str(pack('herohead_ex'))).container;icons=UnityPy.load(str(pack('skillicon_ex'))).container
def head(avatar):return image_ptr(next(p for n,p in heads.items() if n.endswith('/herohead/'+avatar+'.png')))
def icon(key):
    for n,p in icons.items():
        if n.endswith('/skillicon/skill_'+key+'.png'):return image_ptr(p)
    pointers=apk.get('_pack/skillicon/skill_'+key,[])
    return next((image_ptr(p) for p in pointers if p.deref().type.name=='Sprite'),None)
def skill(id):
    r=skills[id];return{'id':id,'name':r['name'],'description':r['description'],'icon':icon(r['icon'])}
def effect(row):
    if not row.get('path'):return None
    folder,stem=row['path'].lower().split('/')[-2:]
    ptr=next((p for n,p in remote.items() if n.endswith(f'{folder}/{stem}_skeletondata.asset')),None) or next(iter(apk.get(row['path'].lower()+'_skeletondata',[])),None)
    if not ptr:return None
    key=row['path'].replace('\\','/').lower();fx_store[key]=skeleton(ptr)
    n=lambda v,d=0.0:float(v) if v not in (None,'') else d
    return{'key':key,'animation':row.get('animation') or 'animation','delay':n(row.get('delay')),'x':n(row.get('offsetx')),'y':n(row.get('offsety')),'scale':n(row.get('scale'),1.0),'origin':str(row.get('origin_pos_type') or ''),'target':str(row.get('impact_pos') or '')}

fx_store={};fx_heroes={};bosses=[]
for index,(key,avatar) in enumerate(order):
    base=heroes[avatar];point=json.loads(base['point'])
    rows=[r for r in monsters if heroes.get(r['link'],{}).get('avatar')==avatar]
    variants=[]
    for row in rows:
        hero=heroes[row['link']]
        variants.append({'monsterId':row['id'],'heroId':hero['id'],'faction':hero['type'].lower(),'skills':[skill(hero['passive2']),skill(hero['passive1'])]})
    combat=battle[avatar]['skills'][0]
    fx_heroes[avatar]={'animation':combat['animation'],'delay':float(combat.get('delay_cast_eff') or 0),'hits':[float(d.get('delay') or 0) for d in combat.get('split_dmgs') or []],'cast':[e for e in map(effect,combat.get('cast_effs') or []) if e],'impact':[e for e in map(effect,combat.get('impact_effs') or []) if e]}
    bosses.append({'key':key,'index':index,'heroId':avatar,'avatar':avatar,'name':base['name'],'class':base['class'].lower(),'level':int(rows[0]['level']),'star':int(rows[0]['star']),'rank':int(base['rank']),
        'point':{'attack':point[0],'armor':point[1],'hp':point[2],'speed':point[3]},'active':skill(base['active']),'variants':variants,
        'visual':{'avatar':avatar,'head':head(avatar),'skeleton':spine(f'{avatar}/hero_{avatar}'),'scale':float(battle[avatar]['scale']),'combat':{'skills':[{'animation':combat['animation'],'delay_cast_eff':combat.get('delay_cast_eff')}]}}})
    print('Boss',key,len(variants),'variants',flush=True)

# ---- Prefabs from the Lua bundle become ordinary scenes for the canvas renderer.
bundle=env.load_file(str(pack('lua_ex')))
files=[f for f in bundle.files.values() if hasattr(f,'objects')]
for f in files:scope['scripts'].update({o.path_id:o.read().m_ClassName for o in f.objects.values() if o.type.name=='MonoScript'})
def prefab(root_name,sprites):
    nodes={};transforms={};monos=collections.defaultdict(list);seen={}
    file=next(f for f in files if any(o.type.name=='GameObject' and o.read().m_Name==root_name for o in f.objects.values()))
    for o in file.objects.values():
        if o.type.name=='GameObject':
            d=o.read();nodes[o.path_id]={'id':o.path_id,'name':d.m_Name,'active':bool(d.m_IsActive),'components':[]}
        elif o.type.name in('RectTransform','Transform'):transforms[o.path_id]=o.read_typetree()
        elif o.type.name=='MonoBehaviour':
            d=o.read(check_read=False)
            if d.m_GameObject.m_PathID:
                try:c=component(o)
                except Exception as ex:c={'type':scope['cls'](o),'error':str(ex)[:160]};print('component',c)
                if d.m_Enabled:monos[d.m_GameObject.m_PathID].append(c)
        elif o.type.name=='CanvasGroup':
            d=o.read_typetree();monos[d['m_GameObject']['m_PathID']].append({'type':'CanvasGroup','alpha':d.get('m_Alpha',1)})
    by_transform={}
    for tid,t in transforms.items():
        n=nodes.get(t['m_GameObject']['m_PathID'])
        if n:n['transform']=t;n['components']=monos[n['id']];by_transform[tid]=n
    root=None
    for tid,n in by_transform.items():
        t=n['transform'];n['children']=[by_transform[p['m_PathID']] for p in t['m_Children'] if p['m_PathID'] in by_transform]
        n['transform']={k:v for k,v in t.items() if k not in('m_GameObject','m_Children','m_Father')}
        if n['name']==root_name and not t['m_Father']['m_PathID']:root=n
    return root
def scene(id,name,root):
    identity={'m_LocalRotation':{'x':0,'y':0,'z':0,'w':1},'m_LocalPosition':{'x':0,'y':0,'z':0},'m_LocalScale':{'x':1,'y':1,'z':1}}
    canvas={'id':id*1000+1,'name':'Canvas','active':True,'components':[{'type':'Canvas','sorting':0,'override':False},{'type':'CanvasScaler','resolution':[1136,640],'match':.5}],'transform':{**identity,'m_AnchorMin':{'x':0,'y':0},'m_AnchorMax':{'x':0,'y':0},'m_AnchoredPosition':{'x':568,'y':320},'m_SizeDelta':{'x':1136,'y':640},'m_Pivot':{'x':.5,'y':.5}},'children':[root]}
    (web/f'dist/scenes/{id}.json').write_text(json.dumps({'id':id,'name':name,'prefab':False,'width':1136,'height':640,'roots':[canvas]},ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    count=0
    def walk(n):
        nonlocal count;count+=1
        for c in n['children']:walk(c)
    walk(canvas);return{'id':id,'name':name,'prefab':False,'nodes':count,'path':f'scenes/{id}.json'}
entries=[scene(53,'BossOfWorldScene',prefab('PopupBossOfWorld',None)),scene(1600,'PopupTopBoss',prefab('PopupTopBoss',None))]

catalog=json.loads((web/'dist/catalog.json').read_text(encoding='utf-8'))
catalog=[x for x in catalog if x['id'] not in(53,1600)]+entries
(web/'dist/catalog.json').write_text(json.dumps(sorted(catalog,key=lambda x:x['id']),ensure_ascii=False,indent=2),encoding='utf-8')
merged=json.loads((web/'dist/assets.json').read_text(encoding='utf-8'));merged.update(scope['assets'])
(web/'dist/assets.json').write_text(json.dumps(merged,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
fx=json.loads((web/'dist/hero-effects.json').read_text(encoding='utf-8'));fx['effects'].update(fx_store);fx['heroes'].update(fx_heroes)
(web/'dist/hero-effects.json').write_text(json.dumps(fx,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
(web/'dist/beast.json').write_text(json.dumps({'bosses':bosses},ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print('DONE',len(bosses),'bosses',[len(b['variants']) for b in bosses],'effects',len(fx_store),'errors',len(scope.get('errors',[])))

# ---- Icons the reference screens use by name.
data=json.loads((web/'dist/beast.json').read_text(encoding='utf-8'))
lua=bundle
ui={}
for path,ptr in UnityPy.load(str(pack('lua_ex'))).container.items():
    stem=path.split('/')[-1].lower()
    if stem in('icon_no1.png','icon_no2.png','icon_no3.png') or stem=='icon_no1.png':ui[stem[:-4]]=image_ptr(ptr)
merged=json.loads((web/'dist/assets.json').read_text(encoding='utf-8'));merged.update(scope['assets'])
(web/'dist/assets.json').write_text(json.dumps(merged,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
by_name={}
for k,v in merged.items():by_name.setdefault(v['name'],k)
for name,file in [('gold','icon_gold'),('diamonds','icon_gem')]:
    ui[name]=by_name.get(file)
data['ui']={k:v and {'key':v,'src':merged[v]['src']} for k,v in ui.items()}
(web/'dist/beast.json').write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print('UI',data['ui'])
