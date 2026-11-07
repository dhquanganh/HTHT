"""Export the Đá hộ mệnh art (images/heroinfo/hero_stone_1..6, stone_lock_1..2) and dist/hero-stones.json from db_hero_stone."""
from pathlib import Path
import json, UnityPy

web=Path(__file__).resolve().parents[1]
scope={'__file__':str(web/'tools/export_ui.py')}
exec(compile((web/'tools/export_ui.py').read_text(encoding='utf-8').split('build=env.load_file')[0],'export_ui.py','exec'),scope)
rm=next(o.read() for o in scope['env'].load_file(str(scope['DATA']/'globalgamemanagers')).objects.values() if o.type.name=='ResourceManager')
paths={}
for name,ptr in rm.m_Container:paths.setdefault(name,[]).append(ptr)
art={}
for name in [f'hero_stone_{i}' for i in range(1,7)]+['stone_lock_1','stone_lock_2']:
    ptr=next(p for p in paths['images/heroinfo/'+name] if p.deref().type.name=='Sprite')
    art[name]=scope['image_ptr'](ptr)
merged=json.loads((web/'dist/assets.json').read_text(encoding='utf-8'));merged.update(scope['assets'])
(web/'dist/assets.json').write_text(json.dumps(merged,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
database=UnityPy.load(str(next((web.parent/'HTTH').rglob('database_ex/**/__data'))))
raw=next(p for n,p in database.container.items() if n.endswith('/db_hero_stone.txt')).read().m_Script
raw=raw if isinstance(raw,str) else raw.decode('utf-8')
rows=json.loads(raw[raw.index('[{'):])
num=lambda v:int(v or 0)
def groups(text):
    return [{'clazz':g['clazz'],'point':[[g['point'][i],g['point'][i+1]] for i in range(0,len(g['point']),2)]} for g in json.loads(text)] if text else []
stones=[{'id':num(r['id']),'name':r['name'],'type':num(r['type_stone']),'star':num(r['star']),'upgrade':{'gold':num(r['upgrade_cost_gold']),'dust':num(r['upgrade_cost_dust'])},'convert':{'gold':num(r['convert_cost_gold']),'dust':num(r['convert_cost_dust'])},'retain':num(r['gem_retain_effect']),'effects':[groups(r['effect1']),groups(r['effect2']),groups(r['effect3'])]} for r in rows]
(web/'dist/hero-stones.json').write_text(json.dumps({'stones':stones,'art':art},ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print(len(stones),'stones',art)
