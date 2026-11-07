"""Export the original hero grades/title strips needed by the reference UI."""
import json
from pathlib import Path
import UnityPy
ROOT=Path(__file__).resolve().parents[1]
inventory=json.loads((ROOT/'extracted/inventory.json').read_text(encoding='utf-8'))
manifest=json.loads((ROOT/'dist/assets.json').read_text(encoding='utf-8'))
names={f'hero_quality_{i}' for i in range(1,8)}|{f'title_{i}' for i in range(1,8)}|{'skill_frame'}
for entry in inventory:
 if entry['type']!='Texture2D' or entry['name'] not in names:continue
 env=UnityPy.load(str(ROOT.parent/'assets/bin/Data'/entry['file']))
 obj=next(o for o in env.objects if o.path_id==entry['id'])
 data=obj.read();image=data.image;key=entry['file']+'_'+str(entry['id']);src='assets/'+key+'.webp'
 image.save(ROOT/'dist'/src,'WEBP',lossless=True)
 manifest[key]={'name':entry['name'],'src':src,'width':image.width,'height':image.height,'border':[0,0,0,0]}
(ROOT/'dist/assets.json').write_text(json.dumps(manifest,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print('Exported hero grade/title assets:',len(names))
