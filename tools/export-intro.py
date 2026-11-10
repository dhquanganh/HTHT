"""Phần mở đầu cho tài khoản mới -> dist/intro.json + dist/assets/theme_story.mp3.

  TutorialStory (scene 1207): 3 tranh new_pt_01 / new_pt_03 / new_pt_02 xếp ngang (padding 88, cách 200, tranh 960x640 nên
  mỗi tranh nằm giữa khung 1136 khi dải dịch 1160), 5 dòng MISC_2_TUTORIAL_STORY_1..5 ở đáy, nút battle_skip góc phải dưới.
  PanelTutorial (1164): khung chữ rect_13 + Luffy help_1 + arrow_next. HandTutorial (1131): Spine Hand.
  Lời dẫn: MSG_TUTORIAL_ACTION_STORY_1..4 và MISC_2_DUMMY_HOME_SCENE_DESC_TUTORIAL (I2Languages, tiếng Việt).
  Nhạc: AudioClip theme_story (Vorbis 44.1 kHz, 29 giây) trong APK -> MP3.
Inputs are read only. Cần: UnityPy, soundfile (libsndfile có MP3).
"""
from pathlib import Path
import json, io, UnityPy, soundfile

web=Path(__file__).resolve().parents[1];data=web.parent/'assets/bin/Data';out=web/'dist'
music=out/'assets/theme_story.mp3'
if not music.exists():
    # AudioClip theme_story nằm trong file d499b9cb... của APK (assets/bin/Data).
    clip=next(o.read() for o in UnityPy.load(str(data/'d499b9cb7674c614aa0d74498577d60d')).objects if o.type.name=='AudioClip' and o.read().m_Name=='theme_story')
    wav=next(iter(clip.samples.values()));samples,rate=soundfile.read(io.BytesIO(wav))
    soundfile.write(str(music),samples,rate,format='MP3')
terms=json.loads((out/'localization.json').read_text(encoding='utf-8'));terms=terms.get('terms',terms)
t=lambda k:terms[k].replace('\\"','"').strip()
for scene in (1207,1164,1131):assert (out/f'scenes/{scene}.json').exists(),f'Thiếu scenes/{scene}.json: chạy python tools/export_ui.py --prefabs'
intro={
 'music':'assets/theme_story.mp3',
 'story':{'scene':1207,'step':1160,'panels':[{'image':'Image1','texts':['Text1','Text2']},{'image':'Image2','texts':['Text3']},{'image':'Image3','texts':['Text4','Text5']}],
          'lines':{f'Text{i}':t(f'MISC_2_TUTORIAL_STORY_{i}') for i in range(1,6)}},
 'guide':{'scene':1164,'hand':1131,
          'welcome':[t('MSG_TUTORIAL_ACTION_STORY_1'),t('MISC_2_DUMMY_HOME_SCENE_DESC_TUTORIAL')],
          'summon':[t('MSG_TUTORIAL_ACTION_STORY_2'),t('MSG_TUTORIAL_ACTION_STORY_3')],
          'done':t('MSG_TUTORIAL_ACTION_STORY_4')},
}
(out/'intro.json').write_text(json.dumps(intro,ensure_ascii=False,indent=1),encoding='utf-8')
print('intro.json',music.stat().st_size,'bytes mp3')
