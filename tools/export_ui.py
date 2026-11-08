"""Read original Unity UI hierarchies. Does not modify the APK inputs."""
from pathlib import Path
import UnityPy, json, struct, re, math, collections, sys

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT/'assets/bin/Data'
OUT = ROOT/'web-ui/dist'
ASSETS = OUT/'assets'
SCENES = OUT/'scenes'
for p in (ASSETS, SCENES): p.mkdir(parents=True, exist_ok=True)
env = UnityPy.Environment()
env.path = str(DATA)
for p in DATA.glob('*.split0'): env.load_file(str(p))
scripts = {o.path_id:o.read().m_ClassName for f in env.files.values() if hasattr(f,'objects') for o in f.objects.values() if o.type.name=='MonoScript'}
errors, assets, exported = [], {}, {}
if (OUT/'assets.json').exists(): assets=json.loads((OUT/'assets.json').read_text(encoding='utf-8'))

def integer(b,o): return struct.unpack_from('<i',b,o)[0]
def floats(b,o,n=1):
    vals = struct.unpack_from('<'+'f'*n,b,o)
    return [round(v,5) if math.isfinite(v) else 0 for v in vals] if n>1 else round(vals[0],5)
def string(b,o):
    n=integer(b,o)
    if n<0 or n>len(b)-o-4: return '',o+4
    return b[o+4:o+4+n].decode('utf-8',errors='replace'), (o+4+n+3)//4*4
def pointer(b,o,f):
    fi,pi=struct.unpack_from('<iq',b,o)
    return UnityPy.classes.PPtr(m_FileID=fi,m_PathID=pi,assetsfile=f)
def cls(o):
    d=o.read(check_read=False)
    return scripts.get(d.m_Script.m_PathID,'Unknown')
def key(o): return Path(o.assets_file.name).name+'_'+str(o.path_id)
def save_image(o):
    k=key(o)
    if k in assets: return k
    d=o.read()
    path='assets/'+k+'.webp'
    img=d.image
    if not (OUT/path).exists(): img.save(OUT/path,'WEBP',lossless=True,method=3)
    entry={'name':d.m_Name,'src':path,'width':img.width,'height':img.height}
    if o.type.name=='Sprite':
        entry['border']=[d.m_Border.x,d.m_Border.y,d.m_Border.z,d.m_Border.w]
    assets[k]=entry
    return k
def image_ptr(p):
    if not p.m_PathID: return None
    return save_image(p.deref())
def text_asset(p):
    o=p.deref();k=key(o)
    if k in exported: return exported[k]
    d=o.read();b=d.m_Script
    if isinstance(b,str): b=b.encode('utf-8',errors='surrogateescape')
    suffix='.atlas' if '.atlas' in d.m_Name.lower() else '.json' if b.lstrip().startswith(b'{') else '.skel'
    filename='assets/'+k+suffix
    (OUT/filename).write_bytes(b)
    exported[k]={'name':d.m_Name,'src':filename}
    return exported[k]
def skeleton(p):
    o=p.deref();k=key(o)
    if k in exported: return exported[k]
    raw=o.get_raw_data();name,off=string(raw,28)
    count=integer(raw,off);off+=4
    atlas_ptrs=[pointer(raw,off+i*12,o.assets_file) for i in range(count)]
    off+=count*12+4
    skel=text_asset(pointer(raw,off,o.assets_file))
    atlases=[]
    for ap in atlas_ptrs:
        ao=ap.deref();ar=ao.get_raw_data();an,off=string(ar,28)
        at=text_asset(pointer(ar,off,ao.assets_file))
        off+=12;n=integer(ar,off);off+=4
        textures=[]
        for j in range(n):
            mat=pointer(ar,off+j*12,ao.assets_file).read()
            for prop, val in mat.m_SavedProperties.m_TexEnvs:
                if prop=='_MainTex': textures.append(image_ptr(val.m_Texture))
        atlases.append({'atlas':at,'textures':textures})
    exported[k]={'name':name,'skeleton':skel,'atlases':atlases}
    return exported[k]
def font(p):
    if not p.m_PathID:return None
    o=p.deref();k=key(o)
    if k in exported:return exported[k]
    d=o.read();b=bytes(d.m_FontData)
    if not b:return None
    src='assets/'+k+'.ttf';(OUT/src).write_bytes(b)
    exported[k]={'name':d.m_Name,'src':src,'family':'font_'+k.replace('-','_')}
    return exported[k]
def component(o):
    name=cls(o);raw=o.get_raw_data();f=o.assets_file
    c={'type':name}
    if name in ('Image','Text','RawImage','SkeletonGraphic'):
        c['color']=floats(raw,44,4)
    if name=='Image':
        c.update(asset=image_ptr(pointer(raw,88,f)),mode=integer(raw,100),preserve=bool(integer(raw,104)),fill=floats(raw,116))
    elif name=='RawImage':
        c.update(asset=image_ptr(pointer(raw,88,f)),uv=floats(raw,100,4))
    elif name=='Text':
        c.update(font=font(pointer(raw,88,f)),size=integer(raw,100),style=integer(raw,104),bestFit=bool(integer(raw,108)),minSize=integer(raw,112),maxSize=integer(raw,116),align=integer(raw,120),rich=bool(integer(raw,128)),overflow=integer(raw,132),lineSpacing=floats(raw,140),text=string(raw,144)[0])
    elif name=='Localize':c['term']=string(raw,32)[0]
    elif name in ('Outline','Shadow'):c.update(color=floats(raw,32,4),distance=floats(raw,48,2))
    elif name=='CanvasScaler': c.update(resolution=floats(raw,44,2),match=floats(raw,56))
    elif name in ('HorizontalLayoutGroup','VerticalLayoutGroup','GridLayoutGroup'):
        c.update(padding=[integer(raw,x) for x in (32,36,40,44)],align=integer(raw,48))
        if name!='GridLayoutGroup':c.update(spacing=floats(raw,52),**{k:bool(raw[56+4*i]) if len(raw)>56+4*i else False for i,k in enumerate(('forceWidth','forceHeight','controlWidth','controlHeight','scaleWidth','scaleHeight','reverse'))})  # mỗi bool được căn 4 byte
        else:c.update(cell=floats(raw,60,2),spacing=floats(raw,68,2),constraint=integer(raw,76),constraintCount=integer(raw,80))
    elif name=='LayoutElement': c.update(ignore=bool(raw[32]),minWidth=floats(raw,36),minHeight=floats(raw,40),preferredWidth=floats(raw,44),preferredHeight=floats(raw,48),flexibleWidth=floats(raw,52),flexibleHeight=floats(raw,56))
    elif name=='ContentSizeFitter': c.update(horizontal=integer(raw,32),vertical=integer(raw,36))
    elif name=='CanvasGroup': pass
    elif name=='Mask': c['showGraphic']=bool(raw[32])
    elif name=='SkeletonGraphic':
        if pointer(raw,88,f).m_PathID:
            c['skeleton']=skeleton(pointer(raw,88,f))
            c['skin'],off=string(raw,100)
            c['animation'],off=string(raw,off+8)
            c['loop']=bool(integer(raw,off))
    return c

build=env.load_file(str(DATA/'globalgamemanagers'))
scene_names=next(o.read_typetree()['scenes'] for o in build.objects.values() if o.type.name=='BuildSettings')
catalog=[]
sources=[(i,p,DATA/f'level{i}',False) for i,p in enumerate(scene_names)]
if '--prefabs' in sys.argv:
    inv=json.loads((ROOT/'web-ui/extracted/inventory.json').read_text(encoding='utf-8'))
    prefab_files=sorted(set(x['file'] for x in inv if x['type']=='GameObject' and not x['file'].startswith('level')))
    sources += [(1000+i,p,DATA/p,True) for i,p in enumerate(prefab_files)]
for index,scene_path,source_path,is_prefab in sources:
    name=Path(scene_path).stem
    f=env.load_file(str(source_path))
    nodes={};transforms={};monos=collections.defaultdict(list)
    for o in f.objects.values():
        try:
            if o.type.name=='GameObject':
                d=o.read();nodes[d.m_Name+':'+str(o.path_id)]={'id':o.path_id,'name':d.m_Name,'active':bool(d.m_IsActive),'components':[]}
            elif o.type.name in ('RectTransform','Transform'):
                transforms[o.path_id]=o.read_typetree()
            elif o.type.name=='MonoBehaviour':
                d=o.read(check_read=False)
                if d.m_GameObject.m_PathID:
                    try: c=component(o)
                    except Exception as ex:
                        c={'type':cls(o),'error':str(ex)[:200]};errors.append({'scene':index,'object':o.path_id,**c})
                    if d.m_Enabled:monos[d.m_GameObject.m_PathID].append(c)
            elif o.type.name=='Canvas':
                d=o.read_typetree();monos[d['m_GameObject']['m_PathID']].append({'type':'Canvas','sorting':d.get('m_SortingOrder',0),'override':d.get('m_OverrideSorting',False)})
            elif o.type.name=='CanvasGroup':
                d=o.read_typetree();monos[d['m_GameObject']['m_PathID']].append({'type':'CanvasGroup','alpha':d.get('m_Alpha',1)})
            elif o.type.name=='SpriteRenderer':
                d=o.read();monos[d.m_GameObject.m_PathID].append({'type':'SpriteRenderer','asset':image_ptr(d.m_Sprite),'color':[d.m_Color.r,d.m_Color.g,d.m_Color.b,d.m_Color.a],'sorting':d.m_SortingOrder})
        except Exception as ex:errors.append({'scene':index,'object':o.path_id,'error':str(ex)[:200]})
    by_id={n['id']:n for n in nodes.values()}
    by_transform={}
    for tid,t in transforms.items():
        n=by_id.get(t['m_GameObject']['m_PathID'])
        if n:
            n['transform']=t;n['components']=monos[n['id']];by_transform[tid]=n
    roots=[]
    for tid,n in by_transform.items():
        t=n['transform'];n['children']=[by_transform[p['m_PathID']] for p in t['m_Children'] if p['m_PathID'] in by_transform]
        n['transform']={k:v for k,v in t.items() if k not in ('m_GameObject','m_Children','m_Father')}
        if not t['m_Father']['m_PathID']:roots.append(n)
    if is_prefab:
        name=', '.join(n['name'] for n in roots)
    result={'id':index,'name':name,'prefab':is_prefab,'width':1136,'height':640,'roots':roots}
    (SCENES/f'{index}.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    catalog.append({'id':index,'name':name,'prefab':is_prefab,'nodes':len(nodes),'path':f'scenes/{index}.json'})
    print(f'{index}: {name}, {len(nodes)} nodes; {len(assets)} images; {len(errors)} warnings',flush=True)
(OUT/'assets.json').write_text(json.dumps(assets,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
(OUT/'catalog.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2),encoding='utf-8')
(ROOT/'web-ui/extracted/export-errors.json').write_text(json.dumps(errors,ensure_ascii=False,indent=2),encoding='utf-8')
print('COMPLETE',len(assets),'images',len(errors),'warnings',flush=True)
