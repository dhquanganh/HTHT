"""Trái Ác Quỷ (lua_forbiddenfruit) -> dist/devil-fruit.json.

Đọc nguyên từ cache HTTH:
  db_devil_fruit, db_devil_fruit_set, db_config_devilFruit (bảng dữ liệu),
  FFGenPoints.lua (chữ hiển thị của từng mã chỉ số và hệ số chia),
  mọi sprite trong bundle (fruitsmall/, fruitlarge/, ui/, images/) theo tên,
  các prefab FFRoot, FFCard, FFStarGroup, FFSetContent, FFSetName, FFGameItem, FFSetInfo, FFTotalInfo,
  FFUpgradePopup, FFPopupHeroView, FFHeroViewCell, FFPopupCheckIn, FFFruitView, FFPopupSummon,
  FFPopupShowBonusEffectFruit và nút Hoạt động (lua_silentring/ButtonFunctionActivity).
Inputs are read only; assets.json is merged.
"""
from pathlib import Path
import json, re, sys, runpy

web=Path(__file__).resolve().parents[1]
sys.argv=[sys.argv[0],'none']
m=runpy.run_path(str(web/'tools/export-mermaid.py'))
scope,prefab,files=m['scope'],m['prefab'],m['files']

def container(bundle):
    out={}
    for f in files[bundle]:
        for path,obj in getattr(f,'container',{}).items():out[path.lower()]=obj.deref() if hasattr(obj,'deref') else obj
    return out
ff=container('lua_forbiddenfruit')
def text(name):
    o=next(o for p,o in ff.items() if p.endswith('/'+name) and o.type.name=='TextAsset')
    s=o.read().m_Script
    return (s if isinstance(s,str) else bytes(s).decode('utf-8')).lstrip('\ufeff')

# ---- Bảng dữ liệu
fruits=json.loads(text('db_devil_fruit.txt'));sets=json.loads(text('db_devil_fruit_set.txt'));config=json.loads(text('db_config_devilfruit.json'))
pairs=lambda raw:(lambda v:[[v[i],v[i+1]] for i in range(0,len(v)-1,2)])(json.loads(raw))
fruit_rows=[{'id':int(r['id']),'name':r['name'],'rank':int(r['fruit_rank']),'base':pairs(r['base_point']),'special':pairs(r['special_point'])} for r in fruits]
set_rows=[{'id':int(r['id']),'name':r['name'],'fruits':json.loads(r['fruit_id']),'buff':[float(r['buff_2star']),float(r['buff_4star']),float(r['buff_6star'])]} for r in sets]

# ---- Chữ của mã chỉ số (FFGenPoints.getPointDesc): "{0}% Công", value / 10 cho chỉ số %.
src=text('ffgenpoints.lua.txt')
points={}
blocks=re.split(r'\n\s*\[(\d+)\]\s*=\s*function\(\)',src)
for i in range(1,len(blocks),2):
    body=blocks[i+1].split('end,')[0]
    div=re.search(r'value\s*=\s*value\s*/\s*([\d.]+)',body)
    fmt=re.search(r'strValue\s*=\s*CS\.System\.String\.Format\(LTr\([^,]+,\s*"([^"]*)"\)',body)
    attr=re.search(r'attribute\s*=\s*LTr\([^,]+,\s*"([^"]*)"\)',body)
    points[blocks[i]]={'text':fmt and fmt.group(1),'attribute':attr and attr.group(1),'div':float(div.group(1)) if div else 1,'percent':bool(div)}

# ---- Ảnh: mọi sprite trong bundle, khóa theo thư mục con + tên ("fruitsmall/1", "ui/rank-2", "popup_body")
art={}
for path,obj in ff.items():
    if obj.type.name!='Sprite':continue
    rel=path.split('/forbiddenfruit/images/')[-1] if '/forbiddenfruit/images/' in path else Path(path).name
    art[str(Path(rel).with_suffix('')).replace('\\','/')]=scope['save_image'](obj)

# ---- Prefab
roots=['FFRoot','FFCard','FFStarGroup','FFSetContent','FFSetName','FFGameItem','FFSetInfo','FFTotalInfo','FFUpgradePopup','FFPopupHeroView','FFHeroViewCell','FFPopupCheckIn','FFFruitView','FFPopupSummon','FFPopupShowBonusEffectFruit']
prefabs={}
for name in roots:
    try:prefabs[name]=prefab('lua_forbiddenfruit',name)
    except StopIteration:print('missing prefab',name,flush=True)
prefabs['ButtonFunctionActivity']=prefab('lua_silentring','ButtonFunctionActivity')

result={'fruits':fruit_rows,'sets':set_rows,'config':config,'points':points,'art':art,'prefabs':prefabs}
(web/'dist/devil-fruit.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
merged=json.loads((web/'dist/assets.json').read_text(encoding='utf-8'));merged.update(scope['assets'])
(web/'dist/assets.json').write_text(json.dumps(merged,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print('fruits',len(fruit_rows),'sets',len(set_rows),'points',len(points),'art',len(art),'prefabs',list(prefabs),flush=True)
