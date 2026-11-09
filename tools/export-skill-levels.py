"""Kỹ năng theo cấp [1]-[4] của từng tướng -> dist/skill-levels.json.

Bản gốc không nâng kỹ năng bằng sách: mỗi mức sao của tướng là một dòng db_heroes trỏ tới bản kỹ năng riêng
(active, passive1-3 -> db_hero_skill có tên "[n] ..."). Mẫu phổ biến: 5 sao [1], 6 sao [2], 10 sao [3].
Cấp [4] lấy từ dòng db_heroes có bản [4], nếu không có thì từ kỹ năng void (Germa, dist/germa.json).
Cấp thiếu được lấp bằng cấp thấp hơn gần nhất (hoặc cao hơn nếu không có).
Đầu ra theo thứ tự profile.skills: [Nộ, bị động 1, 2, 3]; mỗi ô là 4 bản {name, description, sourceId}.
Inputs are read only.
"""
from pathlib import Path
import json, re, UnityPy

web=Path(__file__).resolve().parents[1]
cache=web.parent/'HTTH'
env=UnityPy.load(str(next(cache.rglob('database_ex/**/__data'))))
def table(name):
    raw=next(o for n,o in env.container.items() if n.endswith('/'+name+'.txt')).read().m_Script
    raw=raw if isinstance(raw,str) else bytes(raw).decode('utf-8')
    raw=re.sub(r'<color="(#[0-9A-Fa-f]+)">',r'<color=\1>',raw)
    return json.loads(raw[raw.index('['):])
plain=lambda t:re.sub(r'\s+',' ',re.sub(r'<[^>]+>','',t or '')).strip()
heroes=table('db_heroes');skills={str(r['id']):r for r in table('db_hero_skill')}
profiles=json.loads((web/'dist/hero-profiles.json').read_text(encoding='utf-8'))
germa=json.loads((web/'dist/germa.json').read_text(encoding='utf-8'))['heroes']

def version(sid):
    r=skills.get(str(sid))
    if not r:return None
    name=plain(r.get('name'));m=re.search(r'\[(\d+)\]',name)
    if not m:return None
    return int(m.group(1)),{'name':re.sub(r'\s*\[\d+\]\s*','',name).strip(),'description':plain(r.get('description')),'sourceId':str(sid)}

slots=['active','passive1','passive2','passive3']
result={}
for avatar,profile in profiles.items():
    rows=[h for h in heroes if str(h['avatar'])==avatar and 'Maze' not in plain(h.get('name'))]
    out=[]
    for i,skill in enumerate(profile['skills'][:4]):
        found={}
        for row in sorted(rows,key=lambda r:int(r['star'])):
            v=version(row.get(slots[i]))
            if v:found.setdefault(v[0],v[1])
        if 4 not in found and avatar in germa:
            g=germa[avatar]['skills'][3 if i==0 else i-1]
            if g:found[4]={'name':g['name'],'description':g['description'],'sourceId':g['id'],'germa':True}
        if not found:found[3]={'name':skill['name'],'description':skill['description'],'sourceId':None}
        levels=[]
        for n in range(1,5):
            lower=[k for k in found if k<=n];pick=max(lower) if lower else min(found)
            levels.append({'level':n,**found[pick],'from':pick})
        out.append(levels)
    result[avatar]=out
(web/'dist/skill-levels.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
full=sum(1 for v in result.values() if all(len({l['from'] for l in s})==4 for s in v))
print('heroes',len(result),'with distinct [1]-[4] on every skill',full,flush=True)
