"""Nâng cấp bảo vật (PopupUpgradeArtifact) -> dist/artifact-upgrade.json + khung ItemArtifactUI theo phẩm.

  db_artifact_upgrade_data (TextAsset trong APK): theo quality 1-6
    base_value   EXP bảo vật cho khi làm nguyên liệu (1 sao),
    upgrade_cost EXP cần cho mỗi sao,
    max_star     sao tối đa.
  bgr_equipment_1..6 / border_equipment_1..6: nền và viền ô vật phẩm theo phẩm (Texture2D gốc), thêm vào assets.json.
Inputs are read only; assets.json is merged.
"""
from pathlib import Path
import json
from PIL import Image

web=Path(__file__).resolve().parents[1]
src=web/'extracted/original-assets'
table=json.loads(next((src/'TextAsset').glob('*_db_artifact_upgrade_data.bytes')).read_text(encoding='utf-8'))
upgrade={str(r['quality']):{'baseValue':r['base_value'],'upgradeCost':r['upgrade_cost'],'maxStar':r['max_star']} for r in table}

manifest=json.loads((src/'manifest.json').read_text(encoding='utf-8'))
merged=json.loads((web/'dist/assets.json').read_text(encoding='utf-8'))
frames={}
for kind in ['bgr_equipment','border_equipment']:
    for q in range(1,7):
        name='%s_%d'%(kind,q);entry=next(e for e in manifest if e['type']=='Texture2D' and e['name']==name)
        key=entry['file']+'_2'
        if key not in merged:
            image=Image.open(web/entry['path'].replace('\\','/')).convert('RGBA');out=web/'dist/assets'/(key+'.webp')
            if not out.exists():image.save(out,'WEBP',quality=92,method=6)
            merged[key]={'name':name,'src':'assets/'+key+'.webp','width':image.width,'height':image.height,'border':[0,0,0,0]}
        frames.setdefault(kind,{})[str(q)]=key
(web/'dist/artifact-upgrade.json').write_text(json.dumps({'upgrade':upgrade,'frames':frames,'materialSlots':8},ensure_ascii=False,separators=(',',':')),encoding='utf-8')
(web/'dist/assets.json').write_text(json.dumps(merged,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print(upgrade,frames)
