"""Tổng bộ (TarvenScene) -> nền dải sao theo số sao nhiệm vụ.

  TarvenQuestStar.m_ImageBackground đổi theo sao: bgr_star_1..7 (Texture2D gốc trong APK).
  Cảnh chỉ tham chiếu bgr_star_1, nên 2..7 được thêm vào assets.json (giữ viền 9 mảnh của bgr_star_1).
Inputs are read only; assets.json is merged.
"""
from pathlib import Path
import json
from PIL import Image

web=Path(__file__).resolve().parents[1];src=web/'extracted/original-assets'
manifest=json.loads((src/'manifest.json').read_text(encoding='utf-8'))
merged=json.loads((web/'dist/assets.json').read_text(encoding='utf-8'))
base=next(v for v in merged.values() if v.get('name')=='bgr_star_1')
for s in range(1,8):
    name='bgr_star_%d'%s;entry=next(e for e in manifest if e['type']=='Texture2D' and e['name']==name);key=entry['file']+'_2'
    if key not in merged:
        image=Image.open(web/entry['path'].replace(chr(92),'/')).convert('RGBA');out=web/'dist/assets'/(key+'.webp')
        if not out.exists():image.save(out,'WEBP',quality=92,method=6)
        merged[key]={**base,'name':name,'src':'assets/'+key+'.webp','width':image.width,'height':image.height}
    print(name,key,merged[key]['width'],merged[key]['height'])
(web/'dist/assets.json').write_text(json.dumps(merged,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
