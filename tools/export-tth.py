"""Tân Tứ Hoàng (bundle lua_bossserver, eventlua2/tantuhoang) -> dist/tth.json.

  Prefabs: B_TanTuHoang (đảo trên bản đồ thế giới, anchoredPosition (564,-116)), TTHHub (4 đảo boss), TTHLobby (bảng
  boss + XẾP HẠNG SÁT THƯƠNG), TTHRankCell, TTHPopupReward, TTHRewardCell, TTHPopupChest.
  Boss (TTHDb.BOSSES, thứ tự đảo trái-trên, phải-trên, trái-dưới, phải-dưới): heroKey 512 / 479 / 557 / 548 -> db_heroes
  (avatar, tên, hệ, nghề, hệ số Công/Máu/Giáp/Tốc gốc, kỹ năng active + passive1..3 -> db_hero_skill: tên, mô tả, icon).
  Huy chương hạng 1-3: icon_NO1..3. Hệ số chỉ số chia trung vị db_heroes như tools/export-guild.py.
Inputs are read only; assets.json and campaign.json (Spine boss) are merged.
"""
from pathlib import Path
import json, re, sys, runpy, statistics, UnityPy

web=Path(__file__).resolve().parents[1]
sys.argv=[sys.argv[0],'none']
m=runpy.run_path(str(web/'tools/export-mermaid.py'))
scope,prefab,files,container=m['scope'],m['prefab'],m['files'],m['container']
cache=web.parent/'HTTH'
db=UnityPy.load(str(next(cache.rglob('database_ex/**/__data'))))
def table(name):
    r=next(p for n,p in db.container.items() if n.endswith('/'+name+'.txt')).read().m_Script;r=r if isinstance(r,str) else r.decode('utf-8')
    r=re.sub(r'<color="(#[0-9A-Fa-f]+)">',r'<color=\1>',r);return json.loads(r[r.index('['):])
heroes={str(r['id']):r for r in table('db_heroes')};skills={str(r['id']):r for r in table('db_hero_skill')}
norm={k:statistics.median(float(h[k]) for h in heroes.values() if float(h.get(k) or 0)>0) for k in ['attack_scale_origin','hp_scale_origin','armor_scale_origin']}
icons={}
for name,ptr in UnityPy.load(str(next(cache.rglob('skillicon_ex/**/__data')))).container.items():
    if ptr.deref().type.name=='Sprite':icons[name.rsplit('/',1)[-1].split('.')[0]]=ptr
merged=json.loads((web/'dist/assets.json').read_text(encoding='utf-8'))
def icon(number):
    name='skill_'+str(number);key='skillicon-'+str(number)
    if name not in icons:return None
    if key not in merged:
        image=icons[name].read().image;path=web/'dist/assets'/(key+'.webp')
        if not path.exists():image.convert('RGBA').save(path,'WEBP',quality=88,method=6)
        merged[key]={'name':name,'src':'assets/'+key+'.webp','width':image.width,'height':image.height}
    return key
plain=lambda t:re.sub(r'\s+',' ',re.sub(r'<[^>]+>','',t or '')).strip()
# Spine boss: dùng visual() của export-guild (nạp Spine + đầu tướng còn thiếu vào campaign.json).
g=runpy.run_path(str(web/'tools/export-guild.py'),run_name='tth') if False else None
campaign=json.loads((web/'dist/campaign.json').read_text(encoding='utf-8'))
bosses=[]
for idx,(key,name) in enumerate([(512,'Luffy Yonko'),(479,'Buggy Yonko'),(557,'Shanks Yonko'),(548,'Blackbeard Yonko')]):
    h=heroes[str(key)];sk=[]
    for f in ['active','passive1','passive2','passive3']:
        s=skills.get(str(h.get(f)));
        if s:sk.append({'id':str(s['id']),'name':re.sub(r'\s*\[\d+\]\s*','',plain(s.get('name'))),'description':plain(s.get('description')),'active':f=='active','icon':icon(s.get('icon') or '')})
    bosses.append({'index':idx,'heroKey':key,'name':name,'avatar':str(h['avatar']),'heroName':h.get('name'),'faction':h.get('type','abyss'),'class':h.get('class','warrior'),
                   'scale':{'attack':round(float(h['attack_scale_origin'])/norm['attack_scale_origin'],4),'maxHp':round(float(h['hp_scale_origin'])/norm['hp_scale_origin'],4),
                            'defense':round(float(h['armor_scale_origin'])/norm['armor_scale_origin'],4),'speed':round(float(h['speed_origin'])/200,4)},'skills':sk,
                   'hasSpine':bool(campaign['visuals'].get(str(h['avatar']),{}).get('skeleton'))})
names=['B_TanTuHoang','TTHHub','TTHLobby','TTHRankCell','TTHPopupReward','TTHRewardCell','TTHPopupChest']
prefabs={n:prefab('lua_bossserver',n) for n in names}
medals={}
for n,a in list(merged.items())+list(scope['assets'].items()):
    if a.get('name') in('icon_NO1','icon_NO2','icon_NO3'):medals[a['name']]=n
merged.update(scope['assets'])
(web/'dist/assets.json').write_text(json.dumps(merged,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
(web/'dist/tth.json').write_text(json.dumps({'bosses':bosses,'prefabs':prefabs,'medals':medals},ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print('bosses',[(b['name'],b['avatar'],b['hasSpine'],len(b['skills'])) for b in bosses],'medals',medals,flush=True)
