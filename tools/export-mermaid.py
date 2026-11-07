"""Mermaid Island (Đảo Người Cá), Album and Vực thẳm from the original Lua bundles.

Scenes:
  1700 MermaidIsland  = MerMaidBgr (event_daonguoica) + MerMaidCanvas (lua_ex)
  1701 PanelAlbumMain (imgalbum)
  1702 AbyssMainScene (event_abyss MainScene)
  1703 PopupAbyssEnemy (event_abyss)
Data: dist/album.json from db_album (+ albumpicture sprites), dist/abyss.json (art keys).
Inputs are read only; assets.json and catalog.json are merged.
"""
from pathlib import Path
import collections, json, UnityPy, sys

web=Path(__file__).resolve().parents[1]
scope={'__file__':str(web/'tools/export_ui.py')}
exec(compile((web/'tools/export_ui.py').read_text(encoding='utf-8').split('build=env.load_file')[0],'export_ui.py','exec'),scope)
env,component,image_ptr,skeleton=scope['env'],scope['component'],scope['image_ptr'],scope['skeleton']
cache=web.parent/'HTTH'
pack=lambda name:next(cache.rglob(name+'/**/__data'))
shared=next(cache.rglob('UnityCache/Shared'))
# Prefabs point at sprites in other cache bundles (common atlases): load every bundle so the pointers resolve.
bundles={d.name:env.load_file(str(next(d.rglob('__data')))) for d in sorted(shared.iterdir()) if d.is_dir() and any(d.rglob('__data'))}
files={name:[f for f in b.files.values() if hasattr(f,'objects')] for name,b in bundles.items()}
for fl in files.values():
    for f in fl:scope['scripts'].update({o.path_id:o.read().m_ClassName for o in f.objects.values() if o.type.name=='MonoScript'})

def prefab(bundle,root_name):
    nodes={};transforms={};monos=collections.defaultdict(list)
    file=next(f for f in files[bundle] if any(o.type.name=='GameObject' and o.read().m_Name==root_name for o in f.objects.values()))
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
    roots=[]
    for tid,n in by_transform.items():
        t=n['transform'];n['children']=[by_transform[p['m_PathID']] for p in t['m_Children'] if p['m_PathID'] in by_transform]
        n['transform']={k:v for k,v in t.items() if k not in('m_GameObject','m_Children','m_Father')}
        if not t['m_Father']['m_PathID']:roots.append(n)
    return next(n for n in roots if n['name'].lower()==root_name.lower())

def dump(n,depth=0,limit=5):
    comps=[c.get('type')+('!' if c.get('error') else '') for c in n['components']]
    text=[c.get('text') for c in n['components'] if c.get('text')]
    t=n['transform'];pos=t.get('m_AnchoredPosition',t.get('m_LocalPosition'));size=t.get('m_SizeDelta')
    if depth<=limit:print('  '*depth+n['name'],'' if n['active'] else '(off)',comps,text[:1],pos and (round(pos['x']),round(pos['y'])),size and (round(size['x']),round(size['y'])))
    for c in n['children']:dump(c,depth+1,limit)

if __name__=='__main__' and len(sys.argv)>2 and sys.argv[1]=='dump':
    for target in sys.argv[2:]:
        bundle,name,limit=target.split(':')
        print('=====',bundle,name);dump(prefab(bundle,name),0,int(limit))
    sys.exit()

def sprite_renderers(bundle,root_name):
    """World-space background (SpriteRenderer) of MerMaidBgr: [(path,sprite_ptr,x,y,sx,sy,order)]."""
    file=next(f for f in files[bundle] if any(o.type.name=='GameObject' and o.read().m_Name==root_name for o in f.objects.values()))
    tr={};names={};out=[]
    for o in file.objects.values():
        if o.type.name=='GameObject':names[o.path_id]=o.read().m_Name
        elif o.type.name=='Transform':
            t=o.read_typetree();tr[t['m_GameObject']['m_PathID']]=t
    parent={}
    by_tid={}
    for o in file.objects.values():
        if o.type.name=='Transform':by_tid[o.path_id]=o.read_typetree()
    def world(go):
        t=tr[go];x=y=0;sx=sy=1
        chain=[]
        while t:
            chain.append(t);p=t['m_Father']['m_PathID'];t=by_tid.get(p) if p else None
        for t in reversed(chain):
            lp=t['m_LocalPosition'];ls=t['m_LocalScale'];x+=lp['x']*sx;y+=lp['y']*sy;sx*=ls['x'];sy*=ls['y']
        return x,y,sx,sy
    for o in file.objects.values():
        if o.type.name=='SpriteRenderer':
            d=o.read_typetree();go=d['m_GameObject']['m_PathID']
            if not d.get('m_Enabled',1):continue
            out.append((names.get(go),d['m_Sprite'],*world(go),d.get('m_SortingOrder',0),o))
    return out
if __name__=='__main__' and len(sys.argv)>1 and sys.argv[1]=='sprites':
    for name,sp,x,y,sx,sy,order,o in sprite_renderers('event_daonguoica','MerMaidBgr'):
        ptr=o.read().m_Sprite
        try:s=ptr.deref().read();r=s.m_Rect;print(name,round(x,2),round(y,2),round(sx,2),round(sy,2),order,s.m_Name,round(r.width),round(r.height),s.m_PixelsToUnits)
        except Exception as e:print(name,'ERR',e)
    sys.exit()

def container(bundle):
    out={}
    for f in files[bundle]:
        for path,obj in getattr(f,'container',{}).items():out[path.lower()]=obj.deref() if hasattr(obj,'deref') else obj
    return out
def art_folder(bundle,folder):
    """Every sprite in a bundle folder, by file stem: {stem: asset key}."""
    art={}
    for path,obj in container(bundle).items():
        if obj.type.name=='Sprite' and folder in path:art[Path(path).stem]=scope['save_image'](obj)
    return art
def photo(obj):
    """Album pictures are large jpgs: lossy webp instead of the lossless default."""
    k=scope['key'](obj);d=obj.read();path='assets/'+k+'.webp';img=d.image
    if not (web/'dist'/path).exists():img.convert('RGB').save(web/'dist'/path,'WEBP',quality=86,method=4)
    scope['assets'][k]={'name':d.m_Name,'src':path,'width':img.width,'height':img.height};return k
def find(n,name):
    if n['name']==name:return n
    for c in n['children']:
        r=find(c,name)
        if r:return r
counter=[1700500]
def node(name,x,y,w,h,comps=(),children=()):
    counter[0]+=1
    return {'id':counter[0],'name':name,'active':True,'components':list(comps),'children':list(children),'transform':{'m_LocalRotation':{'x':0,'y':0,'z':0,'w':1},'m_LocalPosition':{'x':0,'y':0,'z':0},'m_LocalScale':{'x':1,'y':1,'z':1},'m_AnchorMin':{'x':.5,'y':.5},'m_AnchorMax':{'x':.5,'y':.5},'m_AnchoredPosition':{'x':x,'y':y},'m_SizeDelta':{'x':w,'y':h},'m_Pivot':{'x':.5,'y':.5}}}

if __name__=='__main__' and len(sys.argv)==1:
    # ---- Album: db_album + the picture of every image
    raw=next(o for p,o in container('imgalbum').items() if p.endswith('db_album.txt')).read().m_Script
    raw=raw if isinstance(raw,str) else bytes(raw).decode('utf-8')
    rows=json.loads(raw[raw.index('[{'):])
    pics={Path(p).stem:o for p,o in container('albumpicture').items() if o.type.name=='Sprite'}
    pictures=[]
    for r in rows:
        a,i=int(r['album_id']),int(r['image_id']);buff=json.loads(r['buff_data'])
        pictures.append({'album':a,'image':i,'name':r['name'],'rows':int(r['split_row']),'cols':int(r['split_col']),
            'points':[[g['point'][k],g['point'][k+1]] for g in buff for k in range(0,len(g['point']),2)],
            'requireImage':int(r['required_image_id'] or 0),'requireLevel':int(r['required_level'] or 0),
            'art':photo(pics[f'{a}_{i}']) if f'{a}_{i}' in pics else None})
    album_art=art_folder('imgalbum','/imgalbum/images/')
    frag=prefab('imgalbum','Fragment');opener=next(c for n in [find(frag,'OpenFragement')] for ch in n['children'] for c in ch['components'] if c['type']=='SkeletonGraphic')
    (web/'dist/album.json').write_text(json.dumps({'material':'consumable:100045','fee':50,'pictures':pictures,'art':album_art,'openSpine':{'skeleton':opener['skeleton'],'animation':opener.get('animation') or 'animation'}},ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    print('album',len(pictures),'pictures',sum(1 for p in pictures if p['art']),'with art',flush=True)
    # ---- Abyss: map sprites; checkpoint and dot positions from the MainScene prefab
    abyss_art=art_folder('event_abyss','/abyss/images/')
    main=prefab('event_abyss','MainScene')
    pos=lambda n:(n['transform']['m_AnchoredPosition']['x'],n['transform']['m_AnchoredPosition']['y'])
    points=[[round(v) for v in pos(p)] for p in find(main,'ListCheckPoint')['children'] if p['name'].startswith('Point')]
    dots=[[round(pos(g)[0]+pos(c)[0]),round(pos(g)[1]+pos(c)[1])] for g in find(main,'Dots')['children'] for c in g['children']]
    def spine_of(n,name):
        hit=find(n,name)
        return next((c for c in hit['components'] if c['type']=='SkeletonGraphic'),None) if hit else None
    chest=spine_of(prefab('event_abyss','PopupAbyssEnemy'),'ChestSpine')
    (web/'dist/abyss.json').write_text(json.dumps({'points':points,'dots':dots,'art':abyss_art,'chestSpine':{'skeleton':chest['skeleton'],'animation':chest.get('animation') or 'animation'}},ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    print('abyss',len(points),'points',len(dots),'dots',len(abyss_art),'sprites',flush=True)
    # ---- Mermaid Island: world-space background (64px per unit, orthographic size 5) + MerMaidCanvas UI
    mermaid_art=art_folder('event_daonguoica','/mermaid/images/')
    mermaid_art['fix_icon_mermaidisland']=next(scope['save_image'](o) for p,o in container('lua_ex').items() if p.endswith('fix_icon_mermaidisland.png') and o.type.name=='Sprite')
    unit=64;layers=[]
    for name,sp,x,y,sx,sy,order,o in sorted(sprite_renderers('event_daonguoica','MerMaidBgr'),key=lambda r:r[6]):
        if name not in('BgrSky','BgrStart','BgrEnd','WeedImage'):continue
        s=o.read().m_Sprite.deref();d=s.read();k=scope['save_image'](s)
        layers.append(node(name,x*unit,y*unit,d.m_Rect.width/d.m_PixelsToUnits*sx*unit,d.m_Rect.height/d.m_PixelsToUnits*sy*unit,[{'type':'Image','asset':k,'color':[1,1,1,1]}]))
    background=node('MermaidWorld',0,0,1136,640,[],layers)
    ui=prefab('lua_ex','MerMaidCanvas')
    identity={'m_LocalRotation':{'x':0,'y':0,'z':0,'w':1},'m_LocalPosition':{'x':0,'y':0,'z':0},'m_LocalScale':{'x':1,'y':1,'z':1}}
    canvas={'id':1700001,'name':'Canvas','active':True,'components':[{'type':'Canvas','sorting':0,'override':False},{'type':'CanvasScaler','resolution':[1136,640],'match':.5}],'transform':{**identity,'m_AnchorMin':{'x':0,'y':0},'m_AnchorMax':{'x':0,'y':0},'m_AnchoredPosition':{'x':568,'y':320},'m_SizeDelta':{'x':1136,'y':640},'m_Pivot':{'x':.5,'y':.5}},'children':[background,ui]}
    (web/'dist/scenes/1700.json').write_text(json.dumps({'id':1700,'name':'MermaidIsland','prefab':False,'width':1136,'height':640,'roots':[canvas]},ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    count=[0]
    def walk(n):
        count[0]+=1
        for c in n['children']:walk(c)
    walk(canvas)
    catalog=json.loads((web/'dist/catalog.json').read_text(encoding='utf-8'))
    catalog=[x for x in catalog if x['id']!=1700]+[{'id':1700,'name':'MermaidIsland','prefab':False,'nodes':count[0],'path':'scenes/1700.json'}]
    (web/'dist/catalog.json').write_text(json.dumps(sorted(catalog,key=lambda x:x['id']),ensure_ascii=False,indent=2),encoding='utf-8')
    # Spines of the island (MerMaidBgr decor, the mermaids of GroupBot, Chopper of MermaidHeroMuaKeoBong) with world
    # position, scale and the SkeletonDataAsset scale, so the client can draw them at the original size.
    spines=[];file=next(f for f in files['event_daonguoica'] if any(o.type.name=='GameObject' and o.read().m_Name=='MerMaidBgr' for o in f.objects.values()))
    names={};tr={};by_tid={}
    for o in file.objects.values():
        if o.type.name=='GameObject':names[o.path_id]=o.read().m_Name
        elif o.type.name in('Transform','RectTransform'):t=o.read_typetree();tr[t['m_GameObject']['m_PathID']]=t;by_tid[o.path_id]=t
    def world(go):
        t=tr[go];chain=[]
        while t:chain.append(t);p=t['m_Father']['m_PathID'];t=by_tid.get(p) if p else None
        x=y=0;sx=sy=1;path=[]
        for t in reversed(chain):
            lp=t['m_LocalPosition'];ls=t['m_LocalScale'];x+=lp['x']*sx;y+=lp['y']*sy;sx*=ls['x'];sy*=ls['y'];path.append(names.get(t['m_GameObject']['m_PathID']))
        return x,y,sx,'/'.join(path)
    for o in file.objects.values():
        if o.type.name!='MonoBehaviour' or scope['cls'](o)!='SkeletonAnimation':continue
        d=o.read();go=d.m_GameObject.m_PathID
        if go not in tr:continue
        x,y,s,path=world(go)
        if not(path.startswith('MerMaidBgr/') or path.startswith('MermaidHeroMuaKeoBong')):continue
        ptr=d.skeletonDataAsset
        if not ptr.m_PathID:continue
        tt=ptr.deref().read_typetree();sk=skeleton(ptr)
        spines.append({'name':path.split('/')[-1] if 'GroupBot' not in path else path.split('/')[-3],'path':path,'x':round(x,3),'y':round(y,3),'scale':round(s,3),'dataScale':tt.get('scale',0.01),'loop':bool(getattr(d,'loop',1)),'skeleton':sk})
    bounds={l['name']:l['transform']['m_AnchoredPosition']['x']/unit for l in layers}
    raw=next(o for p,o in container('event_daonguoica').items() if p.endswith('db_daonguoica_bot_quest.txt')).read().m_Script
    raw=raw if isinstance(raw,str) else bytes(raw).decode('utf-8')
    says=json.loads(raw.lstrip('﻿'))
    print('spines',[(s['name'],s['dataScale']) for s in spines],flush=True)
    (web/'dist/mermaid.json').write_text(json.dumps({'art':mermaid_art,'spines':spines,'heroScale':1.5,'unit':unit,'minX':bounds['BgrStart'],'maxX':bounds['BgrEnd'],'playerAvatar':'190','says':says},ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    merged=json.loads((web/'dist/assets.json').read_text(encoding='utf-8'));merged.update(scope['assets'])
    (web/'dist/assets.json').write_text(json.dumps(merged,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    print('DONE mermaid nodes',count[0],'art',len(mermaid_art),'layers',[l['name'] for l in layers],'errors',len(scope.get('errors',[])))
