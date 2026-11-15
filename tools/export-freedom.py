"""Đấu Trường Tự Do (bundle `arenafreedom`, LuaJobAddArenaFreedom / AFMain) -> dist/freedom.json.

Đọc nguyên từ cache HTTH: sprite của ArenaFreedom/Images (khóa theo tên), các prefab AF* (AFMain, AFPanelState*, AFStageBattle,
AFCardBonusStrength, AFCellHeroThumb, AFPopupReset, AFPopupListCard, AFPopupHeroDetail), bảng db_Buff (lựa chọn trợ giúp mỗi ải)
và thẻ Marineford (database_ex/db_mf_relic + Images/Marineford/RelicIcon) dùng làm thẻ trợ giúp.
Luật (vé, reset, đối thủ, thưởng) nằm ở server gốc (FREEDOM_ARENA_*): xem server/freedom.mjs.
Inputs are read only; assets.json is merged.
"""
from pathlib import Path
import json, sys, runpy, re

web=Path(__file__).resolve().parents[1]
sys.argv=[sys.argv[0],'none']
m=runpy.run_path(str(web/'tools/export-mermaid.py'))
scope,prefab,files=m['scope'],m['prefab'],m['files']
def container(name):
    out={}
    for f in files[name]:
        for path,obj in getattr(f,'container',{}).items():out[path.lower()]=obj.deref() if hasattr(obj,'deref') else obj
    return out
bundle=container('arenafreedom')
art={Path(p).stem:scope['save_image'](o) for p,o in bundle.items() if o.type.name=='Sprite'}
names=sorted({o.read().m_Name for p,o in bundle.items() if p.endswith('.prefab')})
prefabs={n:prefab('arenafreedom',n) for n in names}
def text(o):
    b=o.read().m_Script
    return b.encode('utf-8','surrogateescape').decode('utf-8','replace') if isinstance(b,str) else bytes(b).decode('utf-8','replace')
buff_src=next(text(o) for p,o in bundle.items() if p.endswith('db_buff.txt') or p.endswith('db_buff.bytes') or Path(p).stem=='db_buff')
# db_Buff gốc thiếu dấu phẩy giữa "hero_Id" và "card_Id": đọc bằng regex.
buffs=[{'id':int(a),'heroes':[int(x) for x in h.split(',') if x!='0'],'cards':[int(x) for x in c.split(',') if x!='0']}
       for a,h,c in re.findall(r'"id_Buff":\s*(\d+),\s*"hero_Id":\s*"([^"]*)"\s*,?\s*"card_Id":\s*"([^"]*)"',buff_src)]
# Thẻ Marineford + icon (Images/Marineford/RelicIcon/<avatar>) ở bất kỳ bundle nào.
relics=[];icons={}
for name in files:
    for f in files[name]:
        for path,obj in getattr(f,'container',{}).items():
            lp=path.lower()
            if '/relicicon/' in lp:
                o=obj.deref() if hasattr(obj,'deref') else obj
                if o.type.name=='Sprite':icons[Path(lp).stem]=scope['save_image'](o)
            if name=='database_ex' and (lp.endswith('db_mf_relic.txt') or lp.endswith('db_mf_relic.json') or Path(lp).stem=='db_mf_relic'):
                o=obj.deref() if hasattr(obj,'deref') else obj
                relics=json.loads(text(o).lstrip('﻿'))
# Icon thẻ nằm trong Resources của APK (globalgamemanagers / ResourceManager -> từng file trong assets/bin/Data).
if not icons:
    import UnityPy
    data=web.parent/'assets/bin/Data';genv=UnityPy.Environment();gg=genv.load_file(str(data/'globalgamemanagers'))
    rm=next(o for o in gg.objects.values() if o.type.name=='ResourceManager')
    for k,v in rm.read_typetree()['m_Container']:
        if '/relicicon/' not in k.lower() or Path(k).stem in icons:continue
        src=data/gg.externals[v['m_FileID']-1].path
        if not src.exists():continue
        rf=scope['env'].load_file(str(src))
        sp=next((o for o in getattr(rf,'objects',{}).values() if o.path_id==v['m_PathID'] and o.type.name=='Sprite'),None)
        if sp:icons[Path(k).stem]=scope['save_image'](sp)
strip=lambda s:re.sub(r'<[^>]+>','',s or '').strip()
cards=[{'id':int(r['id']),'rank':int(r['rrank']),'avatar':r['avatar'],'icon':icons.get(str(r['avatar'])),'name':r['name'],'description':strip(r['description']),
        'mode':int(r.get('game_mode') or 0),'special':int(r.get('special_type') or 0),'data':r.get('data'),'skill':r.get('skill_data')} for r in relics]
result={'art':art,'prefabs':prefabs,'buffs':buffs,'cards':cards}
(web/'dist/freedom.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
merged=json.loads((web/'dist/assets.json').read_text(encoding='utf-8'));merged.update(scope['assets'])
(web/'dist/assets.json').write_text(json.dumps(merged,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print('art',len(art),'prefabs',list(prefabs),'buffs',len(buffs),'cards',len(cards),'icons',len(icons),flush=True)
