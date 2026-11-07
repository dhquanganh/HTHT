"""Export the banners and icons of the event screens from the event_ex bundle into dist/assets.

assets.json is merged, never replaced. Names stay as in the bundle so game code finds them with GameView.findAsset.
"""
from pathlib import Path
import json, UnityPy

web=Path(__file__).resolve().parents[1]
wanted='banner_event icon_event_recruit icon_tichtieu event_chieu_mo_dac_biet_big event_tich_tieu_kim_cuong_big event_luyen_tuong_big event_46_big event_vong_quay_big banner_dauthan banner_chienthanthu lehoi_banner1_88 event_chien_truong_big banner_co4la event_than_khi_big inform_goiuudai_big banner_shophangio icon_skchieumo icon_dauthan icon_boss_2 icon_lehoitrangbi icon_chieumodacbiet icon_hoandoi icon_tichluyvipexp icon_shophangio'.split()
env=UnityPy.load(str(next((web.parent/'HTTH').rglob('event_ex/**/__data'))))
sprites={n.rsplit('/',1)[-1].rsplit('.',1)[0]:p for n,p in env.container.items() if p.deref().type.name=='Sprite'}
merged=json.loads((web/'dist/assets.json').read_text(encoding='utf-8'))
for name in wanted:
    image=sprites[name].read().image;key='event-'+name
    image.convert('RGBA').save(web/'dist/assets'/(key+'.webp'),'WEBP',quality=90,method=4)
    merged[key]={'name':name,'src':'assets/'+key+'.webp','width':image.width,'height':image.height}
(web/'dist/assets.json').write_text(json.dumps(merged,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print(len(wanted),'images')
