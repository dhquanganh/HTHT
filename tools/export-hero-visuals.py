"""Build dist/hero-visuals.json: head and Spine for every album hero, so each one can fight.

Inputs are read only. assets.json is merged, never replaced. Avatars already exported for the
campaign or the tower are reused from those files.
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
battle={str(r['key']):r for r in table('db_battle_heroes')}
read=lambda name:json.loads((web/'dist'/name).read_text(encoding='utf-8'))
known={**read('campaign.json')['visuals'],**read('tower.json')['visuals']}

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
for hero in read('hero-album.json')['heroes']:
    avatar=hero['avatar'];current=known.get(avatar) or {}
    if current.get('skeleton') and current.get('head'):continue
    head=current.get('head') or image('_pack/herohead/'+avatar);skel=current.get('skeleton')
    if not skel:
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
    print('Visual',avatar,bool(skel),bool(head),len(visuals),flush=True)
    if not skel or not head:warnings.append('Missing art for '+hero['name']+' '+avatar)
merged=read('assets.json');merged.update(scope['assets'])
(web/'dist/assets.json').write_text(json.dumps(merged,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
(web/'dist/hero-visuals.json').write_text(json.dumps(visuals,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print('DONE',len(visuals),'avatars exported;',warnings,flush=True)
