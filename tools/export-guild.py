"""Hạm đội (GuildScene gốc) -> dist/guild.json.

  db_guild_boss_2 (TextAsset APK, bản mới của db_guild_boss): 60 ải Đánh Boss — monster / monsterPos (đội quái, ô đứng 1-6),
      guildExp, gold, guildCoin (thưởng mỗi lượt đánh), killGold / killCoin (người hạ boss), final{1,2,3,10,15,20,30}{Gold,Coin}
      (thưởng xếp hạng sát thương khi hạ boss).
  db_quai: quái 4001-4112 -> link (id db_heroes), level, slevel (cấp kỹ năng), star.
  db_heroes: tên, avatar, hệ, nghề, attack/hp/armor_scale_origin, speed_origin của tướng gốc.
      Hệ số chỉ số của quái = scale_origin / trung vị của toàn bộ db_heroes (Công, Máu, Giáp), speed_origin / 200.
  Ảnh: guild_flag_1..31 (cờ hạm đội), Spine + đầu tướng cho các avatar quái chưa có trong campaign.json (gộp vào visuals).
Inputs are read only; assets.json and campaign.json are merged.
"""
from pathlib import Path
import json, re, statistics, UnityPy
from PIL import Image

web=Path(__file__).resolve().parents[1]
scope={'__file__':str(web/'tools/export_ui.py')}
exec(compile((web/'tools/export_ui.py').read_text(encoding='utf-8').split('build=env.load_file')[0],'export_ui.py','exec'),scope)
rm=next(o.read() for o in scope['env'].load_file(str(scope['DATA']/'globalgamemanagers')).objects.values() if o.type.name=='ResourceManager')
paths={}
for name,ptr in rm.m_Container: paths.setdefault(name,[]).append(ptr)
cache=UnityPy.load(str(next((web.parent/'HTTH').rglob('database_ex/**/__data'))))
def text(name):
    p=next(p for n,p in cache.container.items() if n.endswith('/'+name+'.txt'))
    raw=p.read().m_Script
    return (raw if isinstance(raw,str) else raw.decode('utf-8')).lstrip('\ufeff')
def table(name):
    raw=text(name);return json.loads(raw[raw.index('[{'):])
boss=json.loads(next((web/'extracted/original-assets/TextAsset').glob('*_db_guild_boss_2.json')).read_text(encoding='utf-8-sig'))
monsters={str(r['id']):r for r in table('db_quai')}
heroes={str(r['id']):r for r in table('db_heroes')}

median=lambda key:statistics.median(float(h[key]) for h in heroes.values() if float(h.get(key) or 0)>0)
norm={'attack':median('attack_scale_origin'),'hp':median('hp_scale_origin'),'armor':median('armor_scale_origin')}

campaign=json.loads((web/'dist/campaign.json').read_text(encoding='utf-8'))
visuals=campaign['visuals'];assets=scope['assets'];warnings=[]
def export_resource_image(resource):
    ptr=next((p for p in paths.get(resource,[]) if p.deref().type.name=='Sprite'),None)
    return scope['image_ptr'](ptr) if ptr else None
remote={}
def remote_paths():
    if remote:return remote
    for pack in ['herohead_ex','herospine2','herospine3','herospine4','herospine5','herospineupdate']:
        env=UnityPy.load(str(next((web.parent/'HTTH').rglob(pack+'/**/__data'))))
        for name,ptr in env.container.items():
            if ptr.deref().type.name in ['Sprite','MonoBehaviour']:remote.setdefault(name,ptr)
    return remote
def visual(avatar):
    if visuals.get(avatar,{}).get('skeleton'):return
    head=export_resource_image('_pack/herohead/'+avatar)
    matches=[p for name,ptrs in paths.items() if re.search(r'/'+avatar+r'/hero_'+avatar+r'_skeletondata$',name) for p in ptrs]
    skel=None
    if matches:
        try:skel=scope['skeleton'](matches[0])
        except Exception as ex:warnings.append(avatar+': '+str(ex)[:100])
    if not skel or not head:
        for name,ptr in remote_paths().items():
            if not skel and name.endswith('/'+avatar+'/hero_'+avatar+'_skeletondata.asset'):
                try:skel=scope['skeleton'](ptr)
                except Exception as ex:warnings.append(avatar+': '+str(ex)[:100])
            if not head and name.endswith('/herohead/'+avatar+'.png'):head=scope['image_ptr'](ptr)
    old=visuals.get(avatar,{})
    visuals[avatar]={**old,'avatar':avatar,'head':old.get('head') or head,'skeleton':skel or old.get('skeleton')}
    if not skel:warnings.append('No skeleton for avatar '+avatar)

stages=[]
for i,ids in enumerate(boss['monster']):
    team=[]
    for k,mid in enumerate(ids):
        m=monsters[str(mid)];h=heroes.get(str(m['link']),{});avatar=str(h.get('avatar',m['link']));visual(avatar)
        team.append({'monsterId':mid,'heroId':str(m['link']),'avatar':avatar,'name':h.get('name','Quái '+str(mid)),'level':int(m['level']),'skillLevel':int(m['slevel']),
                     'stars':int(m['star']),'faction':h.get('type','abyss'),'class':h.get('class','warrior'),'position':boss['monsterPos'][i][k],
                     'scale':{'attack':round(float(h.get('attack_scale_origin',norm['attack']))/norm['attack'],4),'maxHp':round(float(h.get('hp_scale_origin',norm['hp']))/norm['hp'],4),
                              'defense':round(float(h.get('armor_scale_origin',norm['armor']))/norm['armor'],4),'speed':round(float(h.get('speed_origin',200))/200,4)}})
    final={str(n):{'gold':boss['final%dGold'%n][i],'coin':boss['final%dCoin'%n][i]} for n in (1,2,3,10,15,20,30)}
    stages.append({'stage':i+1,'monsters':team,'guildExp':boss['guildExp'][i],'gold':boss['gold'][i],'guildCoin':boss['guildCoin'][i],
                   'killGold':boss['killGold'][i],'killCoin':boss['killCoin'][i],'final':final})

manifest=json.loads((web/'extracted/original-assets/manifest.json').read_text(encoding='utf-8'))
flags=[]
for n in range(1,32):
    e=next(x for x in manifest if x['type']=='Texture2D' and x['name']=='guild_flag_%d'%n);key=e['file']+'_2'
    if key not in assets:
        image=Image.open(web/e['path'].replace('\\','/')).convert('RGBA');out=web/'dist/assets'/(key+'.webp')
        if not out.exists():image.save(out,'WEBP',quality=92,method=6)
        assets[key]={'name':'guild_flag_%d'%n,'src':'assets/'+key+'.webp','width':image.width,'height':image.height,'border':[0,0,0,0]}
    flags.append(key)

# Icon kỹ năng hạm đội (PopupGuildSkill: <nghề>_<chỉ số>) và biểu tượng nghề tech_<nghề>.
icons={}
for e in manifest:
    if e['type']!='Texture2D' or not re.fullmatch(r'(warrior|mage|ranger|assassin|priest|tech)_[a-z_]+',e['name']):continue
    key=e['file']+'_2'
    if key not in assets:
        image=Image.open(web/e['path'].replace('\\','/')).convert('RGBA');out=web/'dist/assets'/(key+'.webp')
        if not out.exists():image.save(out,'WEBP',quality=92,method=6)
        assets[key]={'name':e['name'],'src':'assets/'+key+'.webp','width':image.width,'height':image.height,'border':[0,0,0,0]}
    icons[e['name']]=key
result={'stages':stages,'flags':flags,'icons':icons,'normalization':norm,'sources':['database_ex: db_guild_boss_2, db_quai, db_heroes','APK Texture2D guild_flag_1..31']}
(web/'dist/guild.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
(web/'dist/campaign.json').write_text(json.dumps(campaign,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
(web/'dist/assets.json').write_text(json.dumps(assets,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print('stages',len(stages),'flags',len(flags),'norm',norm,'warnings',warnings,flush=True)
