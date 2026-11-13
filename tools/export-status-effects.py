"""Hiệu ứng trạng thái trong trận -> dist/status-effects.json + dist/assets.

  Spine gốc (TextAsset JSON + atlas + Texture2D trong APK) cho từng trạng thái, nhận diện theo tên vùng ảnh atlas:
    Stun (thieudot/new/stun) choáng · Freeze đóng băng · Stone hóa đá · Status_4 (silent) câm lặng · BurnSmoke thiêu đốt ·
    Status_2 (khói xanh) trúng độc · Status_1 (giọt đỏ) chảy máu · Status_7 (bóng mèo) uy hiếp · Status_3 (khói đen) hoảng loạn ·
    Xich_top (statusbattle/xich) phong ấn · ForceShield khiên · Status_13 (revide) hồi sinh.
  Biểu tượng buff / debuff chỉ số: icon_buff_* / icon_debuff_* theo bảng db_buffanddebuff gốc.
Inputs are read only; assets.json is merged.
"""
from pathlib import Path
import json
from PIL import Image

web=Path(__file__).resolve().parents[1];src=web/'extracted/original-assets';out=web/'dist'
manifest=json.loads((src/'manifest.json').read_text(encoding='utf-8'))
merged=json.loads((out/'assets.json').read_text(encoding='utf-8'))
def find(kind,name):return next(e for e in manifest if e['type']==kind and e['name']==name)
def path(e):return web/e['path'].replace(chr(92),'/')
def texture(name,key):
    if key not in merged:
        im=Image.open(path(find('Texture2D',name))).convert('RGBA');im.save(out/'assets'/(key+'.webp'),'WEBP',quality=92,method=6)
        merged[key]={'name':name,'src':'assets/'+key+'.webp','width':im.width,'height':im.height}
    return key
def spine(name):
    key='status-'+name
    (out/'assets'/(key+'.json')).write_bytes(path(find('TextAsset',name)).read_bytes())
    (out/'assets'/(key+'.atlas')).write_bytes(path(find('TextAsset',name+'.atlas')).read_bytes())
    return{'name':name+'_SkeletonData','skeleton':{'name':name,'src':'assets/'+key+'.json'},'atlases':[{'atlas':{'name':name+'.atlas','src':'assets/'+key+'.atlas'},'textures':[texture(name,key)]}]}
# anchor: head (trên đầu), body (giữa thân), feet (chân). scale theo cỡ nhân vật trong trận (hiệu chỉnh bằng ảnh chụp).
# Spine gốc dựng cho nhân vật cao ~250 đơn vị, gốc toạ độ ở chân (đo khung bao bằng runtime Spine): scale 1 = đúng cỡ gốc
# so với chiều cao nhân vật trong trận. anchor: feet (chân), body (giữa thân), head (đỉnh đầu); dx / dy theo px.
statuses={
 'stun':{'spine':'Stun','loop':'Loop','anchor':'head','scale':1.0},
 'freeze':{'spine':'Freeze','start':'Freeze_Start','loop':'Freeze_loop','anchor':'feet','scale':1.0},
 'petrify':{'spine':'Stone','start':'Stone_start','loop':'Stone_loop','anchor':'feet','scale':1.1},
 'silence':{'spine':'Status_4','start':'Cast','loop':'Loop','anchor':'head','scale':.8,'dx':42,'dy':6},
 'burn':{'spine':'BurnSmoke','loop':'Idle','anchor':'feet','scale':.75},
 'poison':{'spine':'Status_2','loop':'Idle','anchor':'feet','scale':1.0},
 'bleed':{'spine':'Status_1','loop':'Cast','anchor':'feet','scale':1.0},
 'frostbite':{'spine':'Freeze','loop':'Freeze_loop','anchor':'feet','scale':.6},
 'fear':{'spine':'Status_7','loop':'Loop','anchor':'feet','scale':1.0},
 'panic':{'spine':'Status_3','loop':'Idle','anchor':'feet','scale':.6},
 'seal':{'spine':'Xich_top','loop':'Loop','anchor':'body','scale':1.1,'dy':30},
 'shield':{'spine':'ForceShield','loop':'animation','anchor':'body','scale':1.1},
}
once={'revive':{'spine':'Status_13','animation':'Cast','anchor':'feet','scale':.8}}
spines={}
for cfg in [*statuses.values(),*once.values()]:
    if cfg['spine'] not in spines:spines[cfg['spine']]=spine(cfg['spine'])
# Thuộc tính chỉ số của trận -> tên biểu tượng gốc (db_buffanddebuff).
attr={'attack':'attack','damageDealt':'attack','defense':'armor','penResist':'armor','penetration':'armor_break','block':'block','controlResist':'controll_immune','controlPierce':'controll_immune',
 'critChance':'crit','critDamage':'crit_dmg','trueDamage':'holy_dmg','accuracy':'precision','damageReduction':'reduce_dmg','directReduction':'reduce_dmg','skillDamage':'skill_dmg','speed':'speed'}
table=json.loads(path(find('TextAsset','db_buffanddebuff')).read_text(encoding='utf-8-sig'))
names={r['Icon'] for r in table}
icons={}
for a,base in attr.items():
    buff='icon_buff_'+base;debuff=next(n for n in ['icon_debuff_'+base+'_new','icon_debuff_'+base] if n in names)
    icons[a]={'buff':texture(buff,'status-'+buff),'debuff':texture(debuff,'status-'+debuff)}
(out/'status-effects.json').write_text(json.dumps({'spines':spines,'statuses':statuses,'once':once,'icons':icons},ensure_ascii=False,separators=(',',':')),encoding='utf-8')
(out/'assets.json').write_text(json.dumps(merged,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print(len(spines),'spines',len(icons),'icon pairs')
