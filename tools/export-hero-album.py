"""Build dist/hero-album.json and dist/hero-profiles.json from db_heroes and db_hero_skill.

A hero is listed only when its profile can be shown in full: card, large art, the four
base stats from `point`, and a name, description and icon for every skill it declares.
`point` holds attack, armor, HP and speed at the maximum of that row's star tier.

Inputs are read only. assets.json is merged, never replaced. Card art comes from the
herothumb_ex cache bundle, then from the textures extracted out of the APK.
"""
from pathlib import Path
import json, re, UnityPy
from PIL import Image

web=Path(__file__).resolve().parents[1]
cache=web.parent/'HTTH';output=web/'dist/assets';extracted=web/'extracted/original-assets/Texture2D'
merged=json.loads((web/'dist/assets.json').read_text(encoding='utf-8'))
database=UnityPy.load(str(next(cache.rglob('database_ex/**/__data'))))
def table(name):
    p=next(p for n,p in database.container.items() if n.endswith('/'+name+'.txt'))
    raw=p.read().m_Script
    if not isinstance(raw,str):raw=raw.decode('utf-8')
    return json.loads(raw[raw.index('[{'):])
def register(key,name,image):
    if key in merged:return key
    path=output/(key+'.webp')
    if not path.exists():image.convert('RGBA').save(path,'WEBP',quality=88,method=6)
    merged[key]={'name':name,'src':'assets/'+key+'.webp','width':image.width,'height':image.height}
    return key

inventory=json.loads((web/'extracted/inventory.json').read_text(encoding='utf-8'))
def packaged(name,size=None):
    entry=next((x for x in inventory if x['type']=='Texture2D' and x['name']==name and (size is None or (x['width'],x['height'])==size)),None)
    if not entry:return None
    png=extracted/f"{entry['file']}_{entry['id']}_{name}.png"
    return register(f"{entry['file']}_{entry['id']}",name,Image.open(png)) if png.exists() else None

thumbs={}
for ptr_name,ptr in UnityPy.load(str(next(cache.rglob('herothumb_ex/**/__data')))).container.items():
    if ptr.deref().type.name=='Sprite':thumbs[ptr_name.rsplit('/',1)[-1].split('.')[0]]=ptr
def card(avatar):
    if avatar in thumbs:return register('herothumb-'+avatar,avatar,thumbs[avatar].read().image)
    return packaged(avatar,(180,248))

def sprites(bundle):
    found={}
    for ptr_name,ptr in UnityPy.load(str(next(cache.rglob(bundle+'/**/__data')))).container.items():
        if ptr.deref().type.name=='Sprite':found[ptr_name.rsplit('/',1)[-1].split('.')[0]]=ptr
    return found
arts,icons=sprites('heroart_ex'),sprites('skillicon_ex')
def art(avatar):
    if avatar in arts:return register('heroart-'+avatar,avatar,arts[avatar].read().image)
    return packaged(avatar,(640,512))
def icon(number):
    name='skill_'+number
    if name in icons:return register('skillicon-'+number,name,icons[name].read().image)
    return packaged(name)
plain=lambda text:re.sub(r'\s+',' ',re.sub(r'<[^>]+>','',text or '')).strip()
skill_rows={str(r['id']):r for r in table('db_hero_skill')}
def skills(row):
    """Skills for a row, or None when a declared skill has no name, text or icon."""
    result=[]
    for slot in ['active','passive1','passive2','passive3']:
        skill_id=str(row.get(slot) or '')
        if skill_id in ('','0'):continue
        source=skill_rows.get(skill_id)
        if not source:return None
        name=plain(source.get('name'));description=plain(source.get('description'));key=icon(str(source.get('icon') or ''))
        if not name or not description or not key:return None
        level=re.search(r'\[(\d+)\]',name)
        result.append({'name':re.sub(r'\s*\[\d+\]\s*','',name),'level':int(level.group(1)) if level else 1,'passive':slot!='active','icon':key,'description':description})
    return result if result and not result[0]['passive'] else None
def profile(row):
    point=json.loads(row['point']) if row.get('point') else []
    picture=art(row['avatar']);learned=skills(row)
    if len(point)<4 or not all(point[:4]) or not picture or not learned:return None
    return {'art':picture,'star':int(row['star']),'stats':{'attack':point[0],'defense':point[1],'maxHp':point[2],'speed':point[3]},'skills':learned}

released={}
for row in table('db_heroes'):
    if row['release']==1 and int(row['id'])<10000:
        current=released.get(row['avatar'])
        if not current or int(row['star'])>int(current['star']):released[row['avatar']]=row
album,missing,profiles=[],[],{}
for avatar,row in released.items():
    key=card(avatar);details=profile(row)
    if not key or not details:missing.append(row['name']+' '+avatar);continue
    profiles[avatar]=details
    album.append({'id':int(row['id']),'avatar':avatar,'name':row['name'].rstrip('_ '),'faction':row['type'].lower(),'class':row['class'].lower(),'rank':int(row['rank']),'card':key})
album.sort(key=lambda hero:-hero['id'])
classes={name:packaged('class_'+name) for name in ['mage','priest']}

(web/'dist/assets.json').write_text(json.dumps(merged,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
(web/'dist/hero-profiles.json').write_text(json.dumps(profiles,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
(web/'dist/hero-album.json').write_text(json.dumps({'heroes':album,'classIcons':classes},ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print('DONE',len(album),'heroes;',len(missing),'without full data',missing,classes,flush=True)
