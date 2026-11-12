"""Export the banners and icons of the event screens from the event_ex bundle into dist/assets.

assets.json is merged, never replaced. Names stay as in the bundle so game code finds them with GameView.findAsset.
"""
from pathlib import Path
import json, UnityPy

web=Path(__file__).resolve().parents[1]
wanted='banner_event icon_event_recruit icon_tichtieu event_chieu_mo_dac_biet_big event_tich_tieu_kim_cuong_big event_luyen_tuong_big event_46_big event_vong_quay_big banner_dauthan banner_chienthanthu lehoi_banner1_88 event_chien_truong_big banner_co4la event_than_khi_big inform_goiuudai_big banner_shophangio icon_skchieumo icon_dauthan icon_boss_2 icon_lehoitrangbi icon_chieumodacbiet icon_hoandoi icon_tichluyvipexp event_ruong_bau_big banner_xuquaysieucap banner-chieu-mo-hai-tac_big event_chieu_mo_dung_tuong_big banner_nhanpham banner_nvchientruong banner_luyentap event_tuu_quan_big banner_nhiemvu event_tuan_big event_len_cap_big event_quy_truong_thanh_big banner_thuctinh bannertichvip event_dau_danh_trang_big event_thong_linh_big banner_haihon banner_hoandoi event_thang_big banner-sieu-khuyen-mai_big banner_uu_dai_chieu_hoi banner_discount icon_khobauhuyenthoai icon_xuquaysieucap icon_chieumodaihaitac icon_summon_new icon_nhanpham icon_chientruong icon_sengoku icon_ngay7 icon_home icon_ghepchu icon_gem icon_thuctinh icon_top_kc icon_suu_tap_tuong icon_nuocmat icon_nonluffy icon_2_9_2 icon_cola icon_socola icon_xuvongquay icon_shophangio'.split()
env=UnityPy.load(str(next((web.parent/'HTTH').rglob('event_ex/**/__data'))))
sprites={n.rsplit('/',1)[-1].rsplit('.',1)[0]:p for n,p in env.container.items() if p.deref().type.name=='Sprite'}
merged=json.loads((web/'dist/assets.json').read_text(encoding='utf-8'))
for name in wanted:
    image=sprites[name].read().image;key='event-'+name
    image.convert('RGBA').save(web/'dist/assets'/(key+'.webp'),'WEBP',quality=90,method=4)
    merged[key]={'name':name,'src':'assets/'+key+'.webp','width':image.width,'height':image.height}
# Banner chỉ có trong APK (Texture2D gốc): Thuyền Cỏ Mượn Tên (event_thuyen_co_muon_ten), Đá Quý (event_39).
from PIL import Image
manifest=json.loads((web/'extracted/original-assets/manifest.json').read_text(encoding='utf-8'))
for name in ['event_thuyen_co_muon_ten','event_39']:
    entry=next(e for e in manifest if e['type']=='Texture2D' and e['name']==name);image=Image.open(web/entry['path'].replace(chr(92),'/')).convert('RGBA');key='event-'+name
    image.save(web/'dist/assets'/(key+'.webp'),'WEBP',quality=90,method=4);merged[key]={'name':name,'src':'assets/'+key+'.webp','width':image.width,'height':image.height}
(web/'dist/assets.json').write_text(json.dumps(merged,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print(len(wanted),'images')
