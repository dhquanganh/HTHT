"""Vòng quay gốc (bundle lua_ex, eventlua2/luckyspin) -> dist/casino.json.

  PopupLuckySpin (Nami + ếch, đĩa 8 ô quay, nút 1 / 10 / 100 lượt, Làm mới, Bắt buộc làm mới, ô kim cương + xu)
  PopupSuperLuckySpin (bạch tuộc + heo, đĩa tím).
  Spine (nami / octopus) nằm sẵn trong SkeletonGraphic của prefab, ảnh qua assets.json.
Inputs are read only; assets.json is merged.
"""
from pathlib import Path
import json, sys, runpy
web=Path(__file__).resolve().parents[1];out=web/'dist'
sys.argv=[sys.argv[0],'none']
m=runpy.run_path(str(web/'tools/export-mermaid.py'))
scope,prefab=m['scope'],m['prefab']
prefabs={n:prefab('lua_ex',n) for n in ['PopupLuckySpin','PopupSuperLuckySpin']}
# GameItem1..8 chứa mẫu mọi loại ô vật phẩm (ItemShardUI, ItemArtifactUI...): bản web vẽ ô quà riêng nên bỏ mẫu cho nhẹ.
def strip(n):
    if n['name'].startswith('GameItem'):n['children']=[]
    for k in n['children']:strip(k)
for v in prefabs.values():strip(v)
assets=json.loads((out/'assets.json').read_text(encoding='utf-8'));assets.update(scope['assets'])
(out/'assets.json').write_text(json.dumps(assets,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
(out/'casino.json').write_text(json.dumps({'prefabs':prefabs},ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print('prefabs',list(prefabs),'assets',len(scope['assets']))
