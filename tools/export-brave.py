"""Luyện tập (Brave Trial gốc, bản mới) -> dist/brave.json.

  Cảnh BraveTrialScene2 (scene 41, bản đồ 15 ải, Tế đàn, phước lành) và popup PopupBravePlayerNew (1192), PopupAltarsOfTrial (1269),
  PopupBraveReward (1349), InformationBraveTrial (1027) đã có trong dist/scenes cùng Spine (Red_arrow_focus, Chest, nut...).
  Tool này ghi chữ trợ giúp gốc (mục "Luyện tập" trong db_help) và bảng số cảnh.
Inputs are read only.
"""
from pathlib import Path
import json
web=Path(__file__).resolve().parents[1];src=web/'extracted/original-assets/TextAsset';out=web/'dist'
help_text=''
for sec in json.loads(next(src.glob('*_1_db_help.bytes')).read_text(encoding='utf-8-sig'))['help_user']:
    for part in sec['content'].split(chr(10)*2):
        if part.startswith('Luyện tập:'):help_text=part.split(chr(10),1)[1]
(out/'brave.json').write_text(json.dumps({'help':help_text,'scenes':{'main':41,'stage':1192,'altar':1269,'reward':1349,'info':1027}},ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print(help_text[:80])
