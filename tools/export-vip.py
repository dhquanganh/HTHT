"""VIP gốc: db_vip (database_ex) -> dist/vip.json.

  Mỗi cấp: point (EXP VIP cần, tích lũy), auto_battle (% thưởng treo máy thêm), hand_of_midas (% Beli khi mua Beli),
  hero_storage (ô thuyền viên), tavern_quest (lượt nhiệm vụ tổng bộ), event_raid_buy (lượt mua Chiến dịch), bonus (quà đạt cấp).
  bonus gồm các nhóm: [3, loại, id, số] vật phẩm (loại 1 = tiêu hao, 2 = mảnh, 3 = tiêu hao), [6, id tướng db_heroes, sao],
  [7, id ảnh đại diện, 1]. Tên tướng / avatar tra db_heroes, db_avatar.
Inputs are read only.
"""
from pathlib import Path
import json, UnityPy
web=Path(__file__).resolve().parents[1];cache=web.parent/'HTTH'
db=UnityPy.load(str(next(cache.rglob('database_ex/**/__data'))))
def table(name):
    r=next(p for n,p in db.container.items() if n.endswith('/'+name+'.txt')).read().m_Script;r=r if isinstance(r,str) else r.decode('utf-8');return json.loads(r[r.index('['):])
heroes={str(h['id']):h for h in table('db_heroes')}
levels=[]
for x in table('db_vip'):
    b=x['bonus'];i=0;bonus=[]
    while i<len(b):
        t=b[i]
        if t==3 and i+3<len(b):cat,iid,q=b[i+1:i+4];h=heroes.get(str(iid),{}) if cat==2 else {};bonus.append({'kind':'item','cat':cat,'id':iid,'quantity':q,**({'heroAvatar':str(h['avatar']),'heroName':h.get('name')} if h else {})});i+=4
        elif t==6 and i+2<len(b):h=heroes.get(str(b[i+1]),{});bonus.append({'kind':'hero','avatar':str(h.get('avatar','')),'name':h.get('name'),'stars':b[i+2]});i+=3
        elif t==7 and i+2<len(b):bonus.append({'kind':'avatar','id':b[i+1]});i+=4 if i+3<len(b) and b[i+3]==1 and len(b)==i+4 else 3
        else:i+=1
    levels.append({'level':x['level'],'point':x['point'],'autoBattle':x['auto_battle'],'midas':x['hand_of_midas'],'heroStorage':x['hero_storage'],'tavern':x['tavern_quest'],'raidBuy':x['event_raid_buy'],'bonus':bonus})
(web/'dist/vip.json').write_text(json.dumps({'levels':levels},ensure_ascii=False,indent=1),encoding='utf-8')
print([(l['level'],[b['kind']+':'+str(b.get('id') or b.get('name')) for b in l['bonus']]) for l in levels])
