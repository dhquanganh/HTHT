"""Extract King Of Hell's original assets from an Android Unity download cache.

Usage: python tools/export-zoro-cache.py <HTTH directory>
The cache is read only. Export names are scoped to avoid APK path-ID collisions.
"""
from pathlib import Path
import argparse, json, re, zipfile
import UnityPy

parser = argparse.ArgumentParser()
parser.add_argument('cache', type=Path)
args = parser.parse_args()
web = Path(__file__).resolve().parents[1]
out = web / 'dist/game-assets/zoro-king-of-hell'
out.mkdir(parents=True, exist_ok=True)
assets = json.loads((web/'dist/assets.json').read_text(encoding='utf-8'))
sources, bundles, exported = [], {}, {}

def bundle(name):
    if name not in bundles:
        path = next(args.cache.rglob(name+'/**/__data'))
        bundles[name] = UnityPy.load(str(path))
    return bundles[name]

def resource(name, suffix):
    matches = [(k,p) for k,p in bundle(name).container.items() if k.endswith(suffix)]
    if len(matches)>1 and suffix.endswith('.png'):
        matches = [(k,p) for k,p in matches if p.deref().type.name=='Sprite']
    assert len(matches) == 1, (name,suffix,len(matches))
    sources.append({'bundle':name, 'resource':matches[0][0]})
    return matches[0][1]

def raw_text(ptr):
    value = ptr.read().m_Script
    return value.encode('utf-8', errors='surrogateescape') if isinstance(value,str) else value

def text(ptr):
    d = ptr.read(); data = raw_text(ptr)
    suffix = '.atlas' if '.atlas' in d.m_Name.lower() else '.json' if data.lstrip().startswith(b'{') else '.skel'
    file = out/(d.m_Name.split('.')[0]+suffix)
    file.write_bytes(data)
    return {'name':d.m_Name,'src':file.relative_to(web/'dist').as_posix()}

def image(ptr, label=None):
    obj = ptr.deref(); d = obj.read()
    identity = (obj.assets_file.name, obj.path_id)
    if identity in exported: return exported[identity]
    key = 'htth-zoro-'+(label or d.m_Name.lower())
    img = d.image
    file = out/(key+'.webp'); img.save(file,'WEBP',lossless=True,method=4)
    assets[key] = {'name':d.m_Name,'src':file.relative_to(web/'dist').as_posix(),'width':img.width,'height':img.height}
    # Keep a native-size PNG for reviewing and other original-asset workflows.
    img.save(out/(key+'.png'))
    exported[identity] = key
    return key

def skeleton(ptr):
    d = ptr.read(); atlases = []
    for ap in d.atlasAssets:
        a = ap.read(); textures = []
        for mp in a.materials:
            for prop, value in mp.read().m_SavedProperties.m_TexEnvs:
                if prop == '_MainTex': textures.append(image(value.m_Texture))
        atlases.append({'atlas':text(a.atlasFile),'textures':textures})
    return {'name':d.m_Name,'skeleton':text(d.skeletonJSON),'atlases':atlases}

def database(name):
    data = raw_text(resource('database_ex','/'+name+'.txt')).decode('utf-8')
    # This cache's hero table contains a SQL query prefix before the JSON array.
    return json.loads(data[data.index('[{'):])

heroes = [r for r in database('db_heroes') if r['avatar']=='576']
skills = {r['id']:r for r in database('db_hero_skill')}
combat = next(r for r in database('db_battle_heroes') if r['key']=='576')
visual = {'avatar':'576'}
for category,pack in [('art','heroart_ex'),('head','herohead_ex'),('card','herothumb_ex')]:
    visual[category] = image(resource(pack,'/576.png'),category)
for category,prefix in [('skeleton','hero'),('cutscene','cuts'),('skillEffect','skill')]:
    visual[category] = skeleton(resource('herospineupdate',f'/576/{prefix}_576_skeletondata.asset'))
definitions=[]
ids=['hiryu-jigoku','enma','conqueror-haki','decisive-strike']
for index,field in enumerate(['active','passive1','passive2','passive3']):
    tiers=[]
    for level,h in enumerate(heroes,1):
        s=skills[h[field]]
        tiers.append({'level':level,'sourceId':s['id'],'name':s['name'],'description':re.sub(r'<[^>]+>','',s['description'])})
    s=skills[heroes[-1][field]]
    definitions.append({'id':ids[index],'name':re.sub(r'\s*\[\d+\]','',s['name']),
        'iconId':s['icon'],'assetKey':image(resource('skillicon_ex','/skill_'+s['icon']+'.png'),'skill-icon-'+s['icon']),
        'passive':index>0,'energy':100 if index==0 else 0,'cooldown':0,
        'animation':'skill' if index==0 else 'idling','description':tiers[-1]['description'],'levels':tiers})
metadata={}
for path,ptr in bundle('herospineupdate').container.items():
    if '/576/' not in path: continue
    obj=ptr.deref()
    if obj.type.name in ('Material','MonoBehaviour'):
        metadata[path]={'type':obj.type.name,'data':obj.read_typetree()}
    else:
        metadata[path]={'type':obj.type.name}
(out/'source-metadata.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2),encoding='utf-8')
result={'id':'zoro-king-of-hell','name':'Zoro King Of Hell','avatar':'576','faction':'light','class':'mage','grade':'SS',
    'visual':visual,'skills':definitions,'sourceHeroes':heroes,'combat':combat,'sources':sources}
(web/'dist/zoro-king-of-hell.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
(web/'dist/assets.json').write_text(json.dumps(assets,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
package=web/'outputs/zoro-king-of-hell-assets.zip'
package.parent.mkdir(exist_ok=True)
with zipfile.ZipFile(package,'w',zipfile.ZIP_DEFLATED) as archive:
    for file in sorted(out.iterdir()):
        archive.write(file,file.relative_to(web/'dist').as_posix())
    archive.writestr('assets.json',json.dumps({k:assets[k] for k in exported.values()},ensure_ascii=False,indent=2))
    archive.write(web/'dist/zoro-king-of-hell.json','zoro-king-of-hell.json')
    readme=web/'docs/ZORO-KING-OF-HELL.md'
    if readme.exists(): archive.write(readme,'README.md')
print(json.dumps({'hero':result['name'],'assetCount':len(exported),'sources':len(sources),'output':str(out)},ensure_ascii=True))
