"""Build dist/hero-effects.json: the original skill presentation of every hero except Luffy Gear 2 and Zoro.

Reads cast_effs, impact_effs and split_dmgs from db_battle_heroes and exports each referenced Spine
once. Inputs are read only. assets.json is merged, never replaced, and is saved as it goes so a long
run can be resumed: skeletons already listed in dist/hero-effects.json are not exported again.
"""
from pathlib import Path
import json, re, UnityPy

web=Path(__file__).resolve().parents[1]
scope={'__file__':str(web/'tools/export_ui.py')}
exec(compile((web/'tools/export_ui.py').read_text(encoding='utf-8').split('build=env.load_file')[0],'export_ui.py','exec'),scope)
rm=next(o.read() for o in scope['env'].load_file(str(scope['DATA']/'globalgamemanagers')).objects.values() if o.type.name=='ResourceManager')
apk={}
for name,ptr in rm.m_Container:apk.setdefault(name.lower(),[]).append(ptr)
cache=web.parent/'HTTH'
database=UnityPy.load(str(next(cache.rglob('database_ex/**/__data'))))
def table(name):
    p=next(p for n,p in database.container.items() if n.endswith('/'+name+'.txt'))
    raw=p.read().m_Script
    if not isinstance(raw,str):raw=raw.decode('utf-8')
    return json.loads(raw[raw.index('[{'):])
battle={str(r['key']):r for r in table('db_battle_heroes')}
album=json.loads((web/'dist/hero-album.json').read_text(encoding='utf-8'))['heroes']
out=web/'dist/hero-effects.json'
previous=json.loads(out.read_text(encoding='utf-8')) if out.exists() else {'effects':{}}
effects=previous['effects'];missing=set();failed={}
remote={}
for pack in ['herospine2','herospine3','herospine4','herospine5','herospineupdate','herobodyeffect']:
    for name,ptr in UnityPy.load(str(next(cache.rglob(pack+'/**/__data')))).container.items():
        if name.lower().endswith('_skeletondata.asset'):remote['/'.join(name.lower().split('/')[-2:])]=ptr
def locate(path):
    folder,stem=path.split('/')[-2:]
    return remote.get(f'{folder}/{stem}_skeletondata.asset') or next(iter(apk.get(path+'_skeletondata',[])),None)
def save():
    merged=json.loads((web/'dist/assets.json').read_text(encoding='utf-8'));merged.update(scope['assets'])
    (web/'dist/assets.json').write_text(json.dumps(merged,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
def skeleton(path):
    path=path.replace('\\','/').lower()
    if path in effects:return path
    if path in failed or path in missing:return None
    ptr=locate(path)
    if not ptr:missing.add(path);return None
    try:effects[path]=scope['skeleton'](ptr)
    except Exception as ex:failed[path]=str(ex)[:120];return None
    if len(effects)%25==0:
        save();out.write_text(json.dumps({'effects':effects,'heroes':{}},ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    print('Effect',len(effects),path,flush=True);return path
def number(value,default=0.0):
    try:return float(value)
    except (TypeError,ValueError):return default
def effect(row):
    key=skeleton(row['path']) if row.get('path') else None
    if not key:return None
    # order = offset_layer: âm là vẽ sau nhân vật (Bgr_hit -1000/-10000), dương là vẽ trước.
    return {'key':key,'animation':row.get('animation') or 'animation','delay':number(row.get('delay')),'x':number(row.get('offsetx')),'y':number(row.get('offsety')),'scale':number(row.get('scale')),'origin':str(row.get('origin_pos_type') or ''),'target':str(row.get('impact_pos') or ''),'layer':row.get('sorting_layer') or '','order':number(row.get('offset_layer'))}
# shake_cams: rung camera {delay, duration} tính từ lúc tung chiêu.
shakes_of=lambda skill:[{'delay':number(s.get('delay')),'duration':number(s.get('duration'))} for s in skill.get('shake_cams') or [] if number(s.get('duration'))>0]
pick=lambda skills:next((s for s in skills if re.search('skill',str(s.get('animation')),re.I)),skills[1] if len(skills)>1 else None)
heroes={};shakes={}
for hero in album:
    avatar=hero['avatar']
    if avatar not in battle:continue
    skills=battle[avatar].get('skills') or []
    skill=pick(skills)
    if not skill:continue
    # Luffy Gear 2 và Zoro King Of Hell có hoạt cảnh riêng; chỉ lấy lịch rung màn hình của chiêu.
    if avatar in ('109','576'):shakes[avatar]=shakes_of(skill);continue
    heroes[avatar]={'animation':skill.get('animation'),'delay':number(skill.get('delay_cast_eff')),'hits':[number(d.get('delay')) for d in skill.get('split_dmgs') or []],'shake':shakes_of(skill),'cast':[e for e in map(effect,skill.get('cast_effs') or []) if e],'impact':[e for e in map(effect,skill.get('impact_effs') or []) if e]}
# _Pack/HeroCommonSkill/Hit_223 và Hit_236 có material với _MainTex rỗng và Hit_223.png / Hit_236.png không có trong
# APK lẫn cache HTTH (bản gốc tải lúc chạy), nên hai hiệu ứng này giữ texture null và client bỏ qua (fxUsable).
save()
out.write_text(json.dumps({'effects':effects,'heroes':heroes,'shakes':shakes},ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print('DONE',len(heroes),'heroes;',len(effects),'effects; missing',sorted(missing),'failed',failed,flush=True)
