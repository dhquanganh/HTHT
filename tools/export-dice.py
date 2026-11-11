"""Đổ xúc xắc (bundle luadice, eventlua2/superdice) -> dist/dice.json + Spine trong dist/assets/dice/.

  Prefabs: PanelEventDice (bàn 22 ô + ô xuất phát, DiceTable, nút miễn phí, sao, vòng), DiceTile, PanelDiceSelectNumber
  (xúc xắc may mắn chọn số), PanelDiceSelectCard + DiceTarotCard (3 lá bài), PanelDiceReward (mốc sao).
  Spine: dice_rolling (GreenRoll / RedRoll), chibi_fuji (nhân vật đi trên bàn), dice_lvlup_slot (Lvlup / Lvlup2), card2 (lật bài).
  Luật đọc từ PanelDiceEvent.lua / DiceTileUI.lua / PanelDiceSelectCard.lua (xem server/dice.mjs).
Inputs are read only; assets.json is merged.
"""
from pathlib import Path
import json, sys, runpy, UnityPy

web=Path(__file__).resolve().parents[1];out=web/'dist';sd=out/'assets/dice';sd.mkdir(parents=True,exist_ok=True)
sys.argv=[sys.argv[0],'none']
m=runpy.run_path(str(web/'tools/export-mermaid.py'))
scope,prefab=m['scope'],m['prefab']
names=['PanelEventDice','DiceTile','PanelDiceSelectNumber','PanelDiceSelectCard','DiceTarotCard','PanelDiceReward']
prefabs={n:prefab('luadice',n) for n in names}
bundle=UnityPy.load(str(next((web.parent/'HTTH').rglob('Shared/luadice/**/__data'))))
assets=json.loads((out/'assets.json').read_text(encoding='utf-8'));assets.update(scope['assets'])
def spine(name):
    items={n.rsplit('/',1)[-1]:p for n,p in bundle.container.items() if '/spines/'+name+'.' in n or n.endswith('/spines/'+name+'.png')}
    def raw(k):
        d=items[k].read().m_Script;return bytes(d if isinstance(d,(bytes,bytearray)) else d.encode('utf-8','surrogateescape'))
    skel_key=name+'.skel.bytes' if name+'.skel.bytes' in items else name+'.json';suffix='.skel' if skel_key.endswith('bytes') else '.json'
    (sd/(name+suffix)).write_bytes(raw(skel_key));(sd/(name+'.atlas')).write_bytes(raw(name+'.atlas.txt'))
    img=items[name+'.png'].read().image;key='dice-'+name;path=sd/(name+'.webp')
    if not path.exists():img.convert('RGBA').save(path,'WEBP',lossless=True,method=4)
    assets[key]={'name':name,'src':'assets/dice/'+name+'.webp','width':img.width,'height':img.height,'border':[0,0,0,0]}
    return {'name':name,'skeleton':{'name':name,'src':'assets/dice/'+name+suffix},'atlases':[{'atlas':{'name':name+'.atlas','src':'assets/dice/'+name+'.atlas'},'textures':[key]}]}
spines={n:spine(n) for n in ['dice_rolling','chibi_fuji','dice_lvlup_slot','card2']}
# Ảnh riêng của bundle (icon sao, xúc xắc, lá bài) để dùng ngoài prefab.
images={}
for n,p in bundle.container.items():
    if '/images/' in n and n.endswith('.png'):
        nm=n.rsplit('/',1)[-1][:-4];o=p.deref()
        if o.type.name!='Texture2D':continue
        img=o.read().image;path=sd/(nm+'.webp')
        if not path.exists():img.convert('RGBA').save(path,'WEBP',lossless=True,method=4)
        key='dice-img-'+nm;assets[key]={'name':nm,'src':'assets/dice/'+nm+'.webp','width':img.width,'height':img.height,'border':[0,0,0,0]};images[nm]=key
(out/'assets.json').write_text(json.dumps(assets,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
(out/'dice.json').write_text(json.dumps({'prefabs':prefabs,'spines':spines,'images':images},ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print('prefabs',list(prefabs),'spines',list(spines),'images',len(images))
