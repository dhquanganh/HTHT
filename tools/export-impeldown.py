"""Vượt Ngục Impel Down (bundle `impeldown`) -> dist/impeldown.json.

Đọc nguyên từ cache HTTH: mọi sprite trong impledown/images (khóa theo tên) và các prefab EventMain (màn chính:
tháp 7 tầng, lưới 36 ô, popup quà thành tựu / quà mở ô), Gift (một dòng quà thành tựu), GiftOpenTile (một dòng quà ô).
Luật nằm ở server gốc (EVENT_IMPLE_DOWN_*), client chỉ có giao diện: xem server/impeldown.mjs.
Inputs are read only; assets.json is merged.
"""
from pathlib import Path
import json, sys, runpy

web=Path(__file__).resolve().parents[1]
sys.argv=[sys.argv[0],'none']
m=runpy.run_path(str(web/'tools/export-mermaid.py'))
scope,prefab,files=m['scope'],m['prefab'],m['files']
bundle={}
for f in files['impeldown']:
    for path,obj in getattr(f,'container',{}).items():bundle[path.lower()]=obj.deref() if hasattr(obj,'deref') else obj
art={Path(p).stem:scope['save_image'](o) for p,o in bundle.items() if o.type.name=='Sprite'}
names=sorted({o.read().m_Name for p,o in bundle.items() if p.endswith('.prefab')})
prefabs={n:prefab('impeldown',n) for n in names}
result={'art':art,'prefabs':prefabs}
(web/'dist/impeldown.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
merged=json.loads((web/'dist/assets.json').read_text(encoding='utf-8'));merged.update(scope['assets'])
(web/'dist/assets.json').write_text(json.dumps(merged,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print('art',len(art),'prefabs',list(prefabs),flush=True)
