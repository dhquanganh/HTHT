"""Chiến hạm (MonsterScene / PopupPet gốc) -> dist/ship.json + Spine / ảnh trong dist/assets/ship/.

Dữ liệu gốc:
  cache database_ex: db_pet (7 chiến hạm: tên, released, fee_unlock = Hồn chiến hạm để kích hoạt, active_skill, passive1..4
    30 cấp, chỉ số mỗi cấp), db_pet_ruin_scale (Phế tích: HP / Công / Tốc mỗi cấp), db_hero_skill (kỹ năng chủ động theo cấp:
    id = active_skill + cấp - 1), db_battle_pets (spine_id, hoạt ảnh đánh, hiệu ứng trúng).
  APK: db_pet_level_upgrade (cấp 1-180: Beli + Hồn chiến hạm; cột evolve ở cấp 30/60/90 = nâng phẩm),
    db_pet_ruin_upgrade (Phế tích cấp 1-59: Beli + Đá hỗn độn).
  cache lua_ex (_Pack2/EventLuaMisc/Resources): db_monster_up_level (cấp 181-240: Beli + Hồn + Gỗ Quý 2143),
    db_monster_scale (Phế tích trên 60). ShipFixUpgradeRuin.lua giới hạn Phế tích ở 60 (math.min(60, ...)).
  Spine: APK Ship_1..Ship_4 (hình chiến hạm ở MonsterScene / PopupPet theo spine_id), cache petspine_ex
    monster/ship5/ship_5, ship6/ship_6, shipN/ship_battleN (vào trận), shipN/ship_hitN (trúng), ship6/black_bgr.
  Ảnh: pet_N (đầu 100x100), pet_thumb_N / _ia (thẻ chọn chiến hạm), skill_petN_active, skill_pet_passive_1..3.
Kỹ năng chủ động được đọc từ mô tả gốc thành dữ liệu trận (sát thương, số mục tiêu, khống chế, DoT, hồi máu, Nộ, tăng / giảm chỉ số).
Inputs are read only.
"""
from pathlib import Path
import json, re, io, UnityPy

web=Path(__file__).resolve().parents[1];root=web.parent;data=root/'assets/bin/Data';out=web/'dist';sd=out/'assets/ship';sd.mkdir(parents=True,exist_ok=True)
cache=root/'HTTH'
def bundle(name):return UnityPy.load(str(next(cache.rglob(name+'/**/__data'))))
db=bundle('database_ex')
def table(name):
    r=next(p for n,p in db.container.items() if n.endswith('/'+name+'.txt')).read().m_Script;r=r if isinstance(r,str) else r.decode('utf-8')
    return json.loads(r[r.index('['):])
def apk_text(prefix,name):
    for f in data.glob(prefix+'*'):
        for o in UnityPy.load(str(f)).objects:
            if o.type.name=='TextAsset':
                d=o.read()
                if d.m_Name==name:b=d.m_Script;return b if isinstance(b,(bytes,bytearray)) else b.encode('utf-8','surrogateescape')
    raise SystemExit('missing '+name)
def apk_image(prefix,name):
    for f in data.glob(prefix+'*'):
        for o in UnityPy.load(str(f)).objects:
            if o.type.name=='Texture2D' and o.read().m_Name==name:return o.read().image
    raise SystemExit('missing image '+name)
assets=json.loads((out/'assets.json').read_text(encoding='utf-8'))
def save_image(key,image,quality=None):
    path=sd/(key+'.webp')
    if not path.exists():
        img=image.convert('RGBA');img.save(path,'WEBP',lossless=quality is None,quality=quality or 100,method=4)
    assets['ship-'+key]={'name':key,'src':'assets/ship/'+key+'.webp','width':image.width,'height':image.height,'border':[0,0,0,0]}
    return 'ship-'+key
def spine(key,skel,atlas,image):
    suffix='.json' if skel.lstrip()[:1]==b'{' else '.skel'
    (sd/(key+suffix)).write_bytes(skel);(sd/(key+'.atlas')).write_bytes(atlas)
    tex=save_image(key+'-tex',image)
    return {'name':key,'skeleton':{'name':key,'src':'assets/ship/'+key+suffix},'atlases':[{'atlas':{'name':key+'.atlas','src':'assets/ship/'+key+'.atlas'},'textures':[tex]}]}

# ---------- bảng ----------
pets=table('db_pet');ruin_scale={int(r['pet_id']):r for r in table('db_pet_ruin_scale')}
skills={int(s['id']):s for s in table('db_hero_skill') if str(s['id']).isdigit()}
battle={int(b['pet_id']):b for b in table('db_battle_pets')}
lvl=json.loads(apk_text('295caa8bbacae4dcb930fe0621e8a025','db_pet_level_upgrade'))
ruin=json.loads(apk_text('0d65bd36f2af8624d893666f2e500173','db_pet_ruin_upgrade'))
lua=bundle('lua_ex')
def lua_table(name):
    b=next(p for n,p in lua.container.items() if n.endswith('/'+name+'.txt')).read().m_Script;return json.loads(b if isinstance(b,str) else b.decode('utf-8'))
up_level=lua_table('db_monster_up_level');monster_scale={int(r['pet_id']):r for r in lua_table('db_monster_scale')}
# Phí lên cấp: levels[L] = phí từ cấp L lên L+1. 1-179 theo db_pet_level_upgrade, 180-239 theo db_monster_up_level (dòng L+1).
levels={r['level']:{'gold':r['gold_upgrade'],'soul':r['soul_stone_upgrade']} for r in lvl if r['gold_upgrade']}
for r in up_level:levels[r['level']-1]={'gold':r['gold'],'soul':r['numItem21Need'],'wood':r['numItem11Need']}
evolve={r['level']:{'gold':r['gold_evolve'],'soul':r['soul_stone_evolve']} for r in lvl if r['gold_evolve']}
ruins={r['level']:{'gold':r['gold'],'chaos':r['chaos_stone']} for r in ruin}

# ---------- đọc mô tả kỹ năng chủ động ----------
N=r'(\d+(?:\.\d+)?)(?!\d)\.?'
def parse(desc):
    t=re.sub(r'<[^>]+>','',desc).replace('\\%','%');t=re.sub(r'\s+',' ',t);s={}
    m=(re.search(r'Gây (?:ra )?(?:sát thương )?'+N+r' ?(?:sát thương )?(?:lên|cho|đối với)? ?'+N+r' ?kẻ địch',t) or re.search(r'Gây sát thương '+N+r' ngẫu nhiên '+N+r' kẻ địch',t))
    if m:s['damage'],s['targets']=float(m.group(1)),int(float(m.group(2)))
    else:
        m=re.search(r'ngẫu nhiên '+N+r' mục tiêu với '+N+r' ?sát thương',t)
        if m:s['targets'],s['damage']=int(float(m.group(1))),float(m.group(2))
        else:
            m=re.search(r'Gây '+N+r' sát thương ngẫu nhiên với '+N,t)
            if m:s['targets'],s['damage']=int(float(m.group(1))),float(m.group(2))
            else:
                m=re.search(r'Gây (?:sát thương|ra) ?'+N+r' ?(?:lên )?(?:sát thương )?(?:lên )?kẻ địch',t) or re.search(r'Gây sát thương '+N+r' kẻ địch hàng trước',t)
                if m:s['damage'],s['targets']=float(m.group(1)),1
    if 'hàng trước' in t:s['front']=True
    for word,kind in (('hóa đá','petrify'),('choáng','stun'),('câm lặng','silence')):
        m=re.search(N+r'% cơ hội (?:để )?(?:gây )?'+word+r'[^,.]*?trong ?(\d*) ?lượt',t)
        if m:s['status']={'kind':kind,'chance':float(m.group(1))/100,'turns':int(m.group(2) or 1)}
    for word,kind in (('chảy máu|cháy máu','bleed'),('độc','poison')):
        m=re.search(r'(?:'+word+r')[^,.]*?, ?gây (?:thêm )?(?:sát thương )?'+N+r' (?:sát thương )?mỗi vòng trong '+N+' lượt',t)
        if m:s['dot']={'kind':kind,'amount':float(m.group(1)),'turns':int(float(m.group(2)))}
    m=re.search(r'hồi (?:phục|máu) cho '+N+r' (?:đồng đội|đồng minh|đồng mình)(?: ngẫu nhiên)? '+N+'%',t) or re.search(r'hồi phục cho '+N+r' đồng đội ngẫu nhiên '+N+r'% Máu',t)
    if m:s['heal']={'count':int(float(m.group(1))),'ratio':float(m.group(2))/100}
    m=re.search(r'hồi '+N+r'% máu cho '+N,t)
    if m:s['heal']={'count':int(float(m.group(2))),'ratio':float(m.group(1))/100}
    m=re.search(r'(?:hồi phục|phục hồi) cho '+N+r' (?:đồng đội|đồng minh|đồng mình)(?: ngẫu nhiên)? +'+N+' Nộ',t)
    if m:s['energy']={'count':int(float(m.group(1))),'amount':float(m.group(2))}
    m=re.search(r'giảm '+N+r'% Thủ(?: ?,'+N+r' Tốc độ)?[^.]*? trong '+N+' lượt',t)
    if m:s['debuff']={'defense':-float(m.group(1))/100,**({'speedFlat':-float(m.group(2))} if m.group(2) else {}),'turns':int(float(m.group(3)))}
    buffs=[]
    m=re.search(r'cho (?:họ |'+N+r' đồng (?:minh|mình)(?: ngẫu nhiên)? )?'+N+r'% Sát thương chí mạng',t) or re.search(r'tăng '+N+r'% Sát thương chí mạng cho '+N,t)
    if 'chí mạng' in t:
        m=re.search(r'tăng '+N+r'% Sát thương chí mạng cho '+N+r' đồng minh(?: trong (\d+) lượt)?',t)
        if m:buffs.append({'attr':'critDamage','value':float(m.group(1))/100,'count':int(float(m.group(2))),'turns':int(m.group(3) or 1)})
        m=re.search(r'cho '+N+r' đồng minh ngẫu nhiên '+N+r'% Sát thương chí mạng trong '+N+' lượt',t)
        if m:buffs.append({'attr':'critDamage','value':float(m.group(2))/100,'count':int(float(m.group(1))),'turns':int(float(m.group(3)))})
    if 'Sát thương chuẩn' in t:
        m=re.search(r'tăng '+N+r'% Sát thương chuẩn cho '+N+r' đồng minh ngẫu nhiên trong '+N,t) or re.search(r'cho '+N+r' đồng minh ngẫu nhiên '+N+r'% Sát thương chuẩn trong '+N,t)
        if m:
            a,b=float(m.group(1)),float(m.group(2))
            value,count=(a,b) if 'tăng '+m.group(1) in m.group(0) else (b,a)
            buffs.append({'attr':'trueDamage','value':value/100,'count':int(count),'turns':int(float(m.group(3)))})
    m=re.search(r'tăng cho '+N+r' đồng (?:minh|mình)(?: ngẫu nhiên)? '+N+r'% Công trong '+N,t)
    if m:buffs.append({'attr':'attack','value':float(m.group(2))/100,'count':int(float(m.group(1))),'turns':int(float(m.group(3)))})
    m=re.search(r'tăng (?:cho họ )?(?:Thủ )?'+N+r' ?%\s*(?:thủ|Thủ)?\s*(?:(?:,|và)\s*(?:Công |công )?'+N+r' ?%(?: công)?)?\s*trong '+N,t) if 'hồi' in t and ('Thủ' in t or 'thủ' in t) else None
    if m and 'heal' in s:
        buffs.append({'attr':'defense','value':float(m.group(1))/100,'count':s['heal']['count'],'turns':int(float(m.group(3)))})
        if m.group(2):buffs.append({'attr':'attack','value':float(m.group(2))/100,'count':s['heal']['count'],'turns':int(float(m.group(3)))})
    m=re.search(r'cho '+N+r' đồng minh ngẫu nhiên(?: với)? '+N+r'% sát thương (?:với|đối với)',t) or re.search(r'cho '+N+r' đồng minh ngẫu nhiên '+N+r'% sát thương với mục tiêu',t)
    if m:
        turns=re.search(r'trong '+N+r' (?:vòng|lượt)\W*$',t);buffs.append({'attr':'damageDealt','value':float(m.group(2))/100,'count':int(float(m.group(1))),'turns':int(float(turns.group(1))) if turns else 2})
    if buffs:s['buffs']=buffs
    return s

# ---------- tài nguyên hình ----------
apk_spines={1:('e69256bd0d584455c8e30af80574cbf4','31f3fd23b8e7c42849f900bdae8a2349','6f36ae658f5614a87b5bd316db9bfb6a','Ship_1'),2:('8e94393c0884844d39028e95dd60a020','39b2b62e987e5462cbe5b1403ddcb9f5','f7f6c0c9531b94c4ab9f3a233ec110e8','Ship_2'),
            3:('8ae2e2e1376bd42458ecdb2500dbcc40','9320965bfe401433a88d2543608c2c63','ee4dbfbe18f06446db4ee96270ea059d','Ship_3'),4:('3f92281cf777349a39d5b3b93fae0f0a','9658d476ef5064beaaba1785f323ab93','661517df78e5c46a1889edbac34817bc','Ship_4')}
pspine=bundle('petspine_ex')
def cache_spine(path,key):
    items={n:p for n,p in pspine.container.items() if '/monster/'+path in n}
    def get(suffix):return next(p for n,p in items.items() if n.endswith(suffix))
    try:skel=get('.json').read().m_Script
    except StopIteration:skel=get('.skel.bytes').read().m_Script
    skel=skel if isinstance(skel,(bytes,bytearray)) else skel.encode('utf-8','surrogateescape')
    atlas=get('.atlas.txt').read().m_Script;atlas=atlas if isinstance(atlas,(bytes,bytearray)) else atlas.encode('utf-8')
    return spine(key,bytes(skel),bytes(atlas),get('.png').read().image)
display={}
for sid,(fs,fa,ft,name) in apk_spines.items():display[sid]=spine('ship-home-'+str(sid),apk_text(fs[:12],name),apk_text(fa[:12],name+'.atlas'),apk_image(ft[:12],name))
display[5]=cache_spine('ship5/ship_5.','ship-home-5');display[6]=cache_spine('ship6/ship_6.','ship-home-6')
battle_spine={i:cache_spine(f'ship{i}/ship_battle{i}.','ship-battle-'+str(i)) for i in range(1,7)}
hit_spine={i:cache_spine(f'ship{i}/ship_hit{i}.','ship-hit-'+str(i)) for i in range(1,5)}
black=cache_spine('ship6/black_bgr.','ship-black')
images={1:'d0fc2922d8cfb48d7a0734ed24889cec',2:'5e2a7bde931a94618a77ddc7bcf10a6e',3:'d40893089c1474b2fbf9e072a70c3532',4:'f2ce9114f629747a78f6d72275cd7e23',5:'c7f7a6d02b2364c97ac218e83cfc6965',6:'bbd0b571632e74ed2a27a3b438db679c',7:'142cadb5a04a64ef1b10571868804a67'}
thumbs={4:('fbadb0f65b92941299643bf4689460a0','2dc98000d2ac94614ab9a624c322a544'),5:('0fa5c35a11ced4ceba7f234c4bb0e3dc','ac410c1b3b1984c0ba1806418b430233'),6:('09dbb03476d9f46b2b7387bf5168210d','64a2f2111b3244b41bc984082e66221e'),7:('79ecf90f4d5794bb38364d1ccc330c56','6c0e260bedec341d582e1dde8560ff99')}
actives={4:'98c2c8ffe65584b4abb7e806c8dee128',5:'8f096de3c577947d2a2dc94365d32952',6:'86d9bbb224af24489b3cefc3efeea05d',7:'0df7bd3e9de4947b29f3bcc617bcc91c'}
passive_icons=[save_image('skill-pet-passive-'+str(i),apk_image(f,'skill_pet_passive_'+str(i))) for i,f in ((1,'8a73fd4a4224b449497750248f569ff9'),(2,'43f1ca4f965044427b92135ec4c5b29e'),(3,'043ea8dae260e4dd7bacbd5704c6c0b0'))]
icons=bundle('skillicon_ex')
def skill_icon(number):
    for n,p in icons.container.items():
        if n.rsplit('/',1)[-1].split('.')[0]=='skill_'+str(number) and p.deref().type.name=='Sprite':return save_image('skill-'+str(number),p.read().image)
    return None

STAT={'hp':'maxHpFlat','atk':'attackFlat','spd':'speedFlat','armP':'penetration','hit':'accuracy','miss':'dodgeChance','crit':'critChance','critTime':'critDamage','sklP':'skillDamage','brk':'block','trueAtk':'trueDamage'}
LABEL={'hp':'Máu','atk':'Công','spd':'Tốc độ','armP':'Xuyên thủ','hit':'Chính xác','miss':'Né tránh','crit':'Chí mạng','critTime':'ST chí mạng','sklP':'ST kỹ năng','brk':'Chặn','trueAtk':'ST chuẩn'}
def stat_value(s):return s['num'] if s['type'] in ('hp','atk','spd','armP') else s['num']/1000
ships=[];unparsed=[]
for p in pets:
    pid=int(p['id']);b=battle.get(pid,{});sid=int(b.get('spine_id') or 1);base=int(p['active_skill'])
    active=[]
    for lv in range(1,241):
        s=skills.get(base+lv-1)
        if not s:break
        parsed=parse(s['description'])
        if 'damage' not in parsed:unparsed.append((pid,lv,s['description']))
        active.append({'desc':re.sub(r'\s+',' ',re.sub(r'<[^>]+>','',s['description'])).strip(),**parsed})
    first=skills[base]
    passives=[[[{'type':STAT[s['type']],'label':LABEL[s['type']],'num':s['num'],'value':stat_value(s)} for s in level] for level in json.loads(p['passive'+str(i)])] for i in range(1,5)]
    thumb=thumbs.get(pid)
    ships.append({'id':pid,'name':p['name'],'released':p['released']=='1','unlock':int(p['fee_unlock']),'scale':{'attack':int(p['scale_attack']),'hp':int(p['scale_hp']),'speed':int(p['scale_speed'])},
      'ruinScale':{k:int(ruin_scale[pid][k+'_scale']) for k in ('hp','attack','speed')},'ruinScale2':{k:int(monster_scale[pid][k+'_scale']) for k in ('hp','attack','speed')},
      'skillName':re.sub(r'<[^>]+>','',first['name']).strip(),'skillIcon':save_image('pet-active-'+str(pid),apk_image(actives[pid],'skill_pet'+str(pid)+'_active')) if pid in actives else skill_icon(first.get('icon')),
      'active':active,'passives':passives,
      'head':save_image('pet-'+str(pid),apk_image(images[pid],'pet_'+str(pid))),
      'card':save_image('pet-thumb-'+str(pid),apk_image(thumb[0],'pet_thumb_'+str(pid))) if thumb else None,
      'cardOff':save_image('pet-thumb-ia-'+str(pid),apk_image(thumb[1],'pet_thumb_'+str(pid)+'_ia')) if thumb else None,
      'spine':display.get(sid),'battle':{'spine':battle_spine.get(sid),'hit':hit_spine.get(sid),'animation':(b.get('skill') or {}).get('animation') or 'Fire','jumpout':b.get('jumpout_after_skill')=='true'}})
(out/'assets.json').write_text(json.dumps(assets,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
doc={'ships':ships,'levels':levels,'evolve':evolve,'ruins':ruins,'maxLevel':max(levels)+1,'ruinMax':60,'passiveIcons':passive_icons,'black':black,
     'items':{'soul':'icon_monster_soul','chaos':'icon_monster_chaos','wood':'consumable:2143','metal':'consumable:2142'}}
(out/'ship.json').write_text(json.dumps(doc,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print('ships',[(s['name'],s['released'],len(s['active'])) for s in ships],'levels',len(levels),'unparsed',len(unparsed))
for u in unparsed[:8]:print('UNPARSED',u)
import collections
print(collections.Counter(tuple(sorted(k for k in a if k!='desc')) for s in ships for a in s['active']).most_common(40))
