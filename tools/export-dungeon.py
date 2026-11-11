"""Đảo Bánh (Aspen Dungeon gốc) -> dist/dungeon.json + dist/assets/dungeon/.

  Cảnh DungeonScene (scene 23) và các popup ItemPotionDungeon (1072), PopupDungeonSmashItem (1170), PopupDungeonStageHero (1218),
  DungeonMerchantMen (1244), PopupDungeonBuyItem (1286), PopupHelp (1294), PopupSmashedMerchants (1323), PopupSmashedShop (1503)
  đã có trong dist/scenes. Tool này thêm phần không nằm trong prefab: Spine gian thương Thuongnhan_2 / Thuongnhan_3
  (prefab chỉ gắn Thuongnhan_1), ảnh button_skip_merchant, và bảng khóa ảnh (icon_lotion_1..6, img_merchant_*, merchant_*_stuff).
Inputs are read only (extracted/original-assets); assets.json is merged.
"""
from pathlib import Path
import json
from PIL import Image
web=Path(__file__).resolve().parents[1];src=web/'extracted/original-assets';out=web/'dist';sd=out/'assets/dungeon';sd.mkdir(parents=True,exist_ok=True)
assets=json.loads((out/'assets.json').read_text(encoding='utf-8'))
def find(folder,suffix):return next((src/folder).glob('*_1_'+suffix))
def image(name):
    p=find('Texture2D',name+'.png');key=p.name.split('_1_')[0]+'_2'
    if key not in assets:
        img=Image.open(p).convert('RGBA');dst=sd/(name+'.webp');img.save(dst,'WEBP',lossless=True,method=4)
        assets[key]={'name':name,'src':'assets/dungeon/'+name+'.webp','width':img.width,'height':img.height,'border':[0,0,0,0]}
    return key
def spine(name):
    (sd/(name+'.json')).write_bytes(find('TextAsset',name+'.json').read_bytes());(sd/(name+'.atlas')).write_bytes(find('TextAsset',name+'.atlas.bytes').read_bytes())
    p=find('Texture2D',name+'.png');key='dungeon-'+name;img=Image.open(p).convert('RGBA');img.save(sd/(name+'.webp'),'WEBP',lossless=True,method=4)
    assets[key]={'name':name,'src':'assets/dungeon/'+name+'.webp','width':img.width,'height':img.height,'border':[0,0,0,0]}
    return {'name':name+'_SkeletonData','skeleton':{'name':name,'src':'assets/dungeon/'+name+'.json'},'atlases':[{'atlas':{'name':name+'.atlas','src':'assets/dungeon/'+name+'.atlas'},'textures':[key]}]}
names=['icon_lotion_%d'%i for i in range(1,7)]+['img_merchant_%d'%i for i in range(1,4)]+['merchant_%d_stuff'%i for i in range(1,4)]+['frame_merchant','button_skip_merchant','dungeon_battle','dungeon_battle_inactive','dungeon_skip_shop']
images={n:image(n) for n in names}
spines={n:spine(n) for n in ['Thuongnhan_1','Thuongnhan_2','Thuongnhan_3']}
(out/'assets.json').write_text(json.dumps(assets,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
# Trợ giúp gốc: mục "Địa lao" trong db_help (Kiến trúc) mô tả tính năng này.
helpFile=next((src/'TextAsset').glob('*_1_db_help.bytes'));helpText=''
for sec in json.loads(helpFile.read_text(encoding='utf-8-sig'))['help_user']:
    for part in sec['content'].split(chr(10)*2):
        if part.startswith('Địa lao'):helpText=part.split(chr(10),1)[1]
(out/'dungeon.json').write_text(json.dumps({'help':helpText,'scenes':{'main':23,'potion':1072,'smashItem':1170,'stageHero':1218,'merchant':1244,'buyItem':1286,'help':1294,'smashedMerchants':1323,'smashedShop':1503},'images':images,'spines':spines},ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print(images);print(list(spines))
