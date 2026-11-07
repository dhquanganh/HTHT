"""Copy the Win and Lose_op Spine of PopupBattleEnd into dist/assets. PopupBattleEnd loads them at runtime, so scene export misses them."""
from pathlib import Path
import json, shutil
from PIL import Image

web=Path(__file__).resolve().parents[1]
text=web/'extracted/original-assets/TextAsset';textures=web/'extracted/original-assets/Texture2D'
merged=json.loads((web/'dist/assets.json').read_text(encoding='utf-8'))
for name,out in [('Win','battle-win'),('Lose_op','battle-lose')]:
    shutil.copyfile(next(text.glob(f'*_1_{name}.json')),web/'dist/assets'/(out+'.json'))
    shutil.copyfile(next(text.glob(f'*_1_{name}.atlas.bytes')),web/'dist/assets'/(out+'.atlas'))
    image=Image.open(next(textures.glob(f'*_1_{name}.png'))).convert('RGBA')
    image.save(web/'dist/assets'/(out+'.webp'),'WEBP',quality=92,method=6)
    merged[out]={'name':out,'src':'assets/'+out+'.webp','width':image.width,'height':image.height}
(web/'dist/assets.json').write_text(json.dumps(merged,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print('ok')
