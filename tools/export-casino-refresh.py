"""Hiệu ứng "Làm mới" vòng quay gốc: Spine Refresh_spin (extracted/original-assets) -> dist/assets/casino/ và casino.json.spines.refresh.
Inputs are read only; assets.json and casino.json are merged.
"""
from pathlib import Path
import json
from PIL import Image
root=Path(__file__).resolve().parents[2];data=root/'assets/bin/Data';out=root/'web-ui/dist';sd=out/'assets/casino';sd.mkdir(parents=True,exist_ok=True)
src=root/'web-ui/extracted/original-assets'
skel=(src/'TextAsset/95e3a6a90b7721348bb125069fd03cf9_1_Refresh_spin.json').read_bytes();atlas=(src/'TextAsset/b5cf6e2aa31bcfe4c9b6f3e97c4574f4_1_Refresh_spin.atlas.bytes').read_bytes()
suffix='.json' if skel.lstrip()[:1]==b'{' else '.skel'
(sd/('refresh_spin'+suffix)).write_bytes(skel);(sd/'refresh_spin.atlas').write_bytes(atlas)
img=Image.open(src/'Texture2D/b47a904b55807e54da451bcdd39e938a_1_Refresh_spin.png').convert('RGBA');img.save(sd/'refresh_spin.webp','WEBP',lossless=True,method=4)
assets=json.loads((out/'assets.json').read_text(encoding='utf-8'))
assets['casino-refresh_spin']={'name':'Refresh_spin','src':'assets/casino/refresh_spin.webp','width':img.width,'height':img.height,'border':[0,0,0,0]}
(out/'assets.json').write_text(json.dumps(assets,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
c=json.loads((out/'casino.json').read_text(encoding='utf-8'))
c['spines']={'refresh':{'name':'Refresh_spin','skeleton':{'name':'Refresh_spin','src':'assets/casino/refresh_spin'+suffix},'atlases':[{'atlas':{'name':'Refresh_spin.atlas','src':'assets/casino/refresh_spin.atlas'},'textures':['casino-refresh_spin']}]}}
(out/'casino.json').write_text(json.dumps(c,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print(suffix,len(skel));print(atlas.decode()[:300])
