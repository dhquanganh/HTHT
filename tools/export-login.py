"""Màn tải game và đăng nhập gốc -> dist/login.json.

  APK: SplashScene (scene 0: SplashInit bgr_splash2 + logo, SplashTheme ace_logo / ace_title / logo) và LoginScene (scene 1:
  PanelInitData thanh "Loading", PanelLoadingAsset "Cập nhật dữ liệu", BoxLogin, BoxRegister, BoxServers, TextVersion,
  logo_18). Hai scene này đã có trong dist/scenes từ tools/export_ui.py.
  Cache: bundle bgr_login (loginbgr/backgroundlogin.prefab) là nền đăng nhập máy chủ đặt vào ThemeBgr của LoginScene:
  Background (BackgroundScaler 1400x644) + Spine splash_kaido + ImageLogo logo_login 412x280.
Inputs are read only; assets.json is merged.
"""
from pathlib import Path
import json, sys, runpy

web=Path(__file__).resolve().parents[1]
sys.argv=[sys.argv[0],'none']
m=runpy.run_path(str(web/'tools/export-mermaid.py'))
scope,prefab=m['scope'],m['prefab']
for scene in (0,1):assert (web/f'dist/scenes/{scene}.json').exists(),f'Thiếu scenes/{scene}.json: chạy python tools/export_ui.py'
theme=prefab('bgr_login','BackgroundLogin')
merged=json.loads((web/'dist/assets.json').read_text(encoding='utf-8'));merged.update(scope['assets'])
(web/'dist/assets.json').write_text(json.dumps(merged,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
# Màn tải hiện trước khi tải xong assets.json (1 MB): đưa sẵn các ảnh mà scene 0, scene 1 và nền đăng nhập cần.
used=set()
def collect(n):
    for c in n.get('components',[]):
        if isinstance(c.get('asset'),str):used.add(c['asset'])
        for t in (c.get('skeleton') or {}).get('atlases',[]):used.update(t['textures'])
    for k in n.get('children',[]):collect(k)
for scene in (0,1):
    for r in json.loads((web/f'dist/scenes/{scene}.json').read_text(encoding='utf-8'))['roots']:collect(r)
collect(theme)
subset={k:merged[k] for k in sorted(used) if k in merged}
(web/'dist/login.json').write_text(json.dumps({'splash':0,'login':1,'theme':theme,'assets':subset},ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print('assets',len(subset))
def walk(n,d=0):
    print('  '*d+n['name'],[c['type']+(':'+c['skeleton']['name']+'/'+str(c.get('animation')) if c.get('skeleton') else '') for c in n['components']])
    for k in n['children']:walk(k,d+1)
walk(theme)
