"""Ảnh đại diện đặc biệt (PopupChangeAvatar tab "Ảnh đặc biệt") -> dist/avatars.json + dist/assets/avatar/N.webp.

  cache bundle avatar: assets/resources/_pack2/avatar/<id>.png; tên / mô tả từ db_avatar (database_ex).
  Tab "Ảnh tướng" dùng đầu tướng đã sở hữu (catalog.heroes[].visual.head), không cần xuất thêm.
Inputs are read only; assets.json is merged.
"""
from pathlib import Path
import json, re, UnityPy

web=Path(__file__).resolve().parents[1];out=web/'dist';ad=out/'assets/avatar';ad.mkdir(parents=True,exist_ok=True)
cache=web.parent/'HTTH'
db=UnityPy.load(str(next(cache.rglob('database_ex/**/__data'))))
r=next(p for n,p in db.container.items() if n.endswith('/db_avatar.txt')).read().m_Script;r=r if isinstance(r,str) else r.decode('utf-8')
rows={str(x['id']):x for x in json.loads(r[r.index('['):])}
bundle=UnityPy.load(str(next(cache.rglob('Shared/avatar/**/__data'))))
assets=json.loads((out/'assets.json').read_text(encoding='utf-8'));special=[]
for name,ptr in bundle.container.items():
    m=re.fullmatch(r'assets/resources/_pack2/avatar/(\d+)\.png',name)
    if not m or ptr.deref().type.name!='Texture2D':continue
    aid=m.group(1);img=ptr.read().image;path=ad/(aid+'.webp')
    if not path.exists():img.convert('RGBA').save(path,'WEBP',quality=92,method=5)
    key='avatar-'+aid;assets[key]={'name':'avatar_'+aid,'src':'assets/avatar/'+aid+'.webp','width':img.width,'height':img.height,'border':[0,0,0,0]}
    row=rows.get(aid,{});special.append({'id':int(aid),'key':key,'name':row.get('name','Avatar'),'desc':row.get('desc','')})
special.sort(key=lambda x:x['id'])
(out/'assets.json').write_text(json.dumps(assets,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
(out/'avatars.json').write_text(json.dumps({'special':special},ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print('special avatars',len(special))
