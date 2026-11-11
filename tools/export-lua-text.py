"""Chữ gốc ngoài bảng I2: bảng ngôn ngữ Lua và thông báo máy chủ trong UnityCache (HTTH) -> gộp vào dist/localization.json.

  - LTr('KHÓA', 'chữ tiếng Việt') trong mọi tệp .lua.txt (mã sự kiện Lua gắn chữ Việt làm dự phòng).
  - language_*.txt ([{key, en, vi}]: mermaid, superdice, shipdecor, void/ép sao).
  - serverlocalization/server_message_vi.txt (khóa=giá trị) với tiền tố SERVER:.
Khóa I2 đã có không bị ghi đè. Sau đó chạy: node tools/apply-localization.cjs
"""
from pathlib import Path
import json,re,UnityPy
web=Path(__file__).resolve().parents[1];out=web/'dist/localization.json'
loc=json.loads(out.read_text(encoding='utf-8'));extra={}
ltr=re.compile(r"""LTr\(\s*['"]([A-Za-z0-9_.]+)['"]\s*,\s*(['"])((?:\.|(?!\2).)*)\2""")
def text(o):
    s=o.read().m_Script;return (s if isinstance(s,(bytes,bytearray)) else s.encode('utf-8','surrogateescape')).decode('utf-8','replace').lstrip('\ufeff')
for d in sorted(next((web.parent/'HTTH').rglob('UnityCache/Shared')).iterdir()):
    for f in d.rglob('__data'):
        try:b=UnityPy.load(str(f))
        except Exception:continue
        for n,o in b.container.items():
            name=n.rsplit('/',1)[-1]
            if name.endswith('.lua.txt'):
                for k,_,v in ltr.findall(text(o)):extra.setdefault(k,v.replace("\'","'").replace('\\"','"').replace('\n','\n'))
            elif re.match(r'language_\w+\.txt$',name):
                try:rows=json.loads(re.sub(r',\s*([\]}])',r'\1',text(o)))
                except Exception as e:print('skip',n,e);continue
                for r in rows:
                    if r.get('key') and r.get('vi') and not r['key'].startswith('TEST_KEY'):extra.setdefault(r['key'],r['vi'])
            elif name=='server_message_vi.txt':
                for line in text(o).splitlines():
                    if '=' in line:k,v=line.split('=',1);extra.setdefault('SERVER:'+k.strip(),v.strip().replace('\n','\n'))
new={k:v for k,v in extra.items() if k not in loc}
out.write_text(json.dumps({**loc,**new},ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print('found',len(extra),'added',len(new))
