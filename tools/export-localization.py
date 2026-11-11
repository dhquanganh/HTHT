"""Toàn bộ chữ gốc (I2 LanguageSource, ngôn ngữ đầu = tiếng Việt) -> dist/localization.json.

Quét mọi khóa dạng CHỮ_HOA_SỐ (không chỉ LBL_/MSG_/ERR_/TXT_/MISC_ như prepare_samples.py) nằm đúng ranh giới chuỗi
được tuần tự hóa: [độ dài][khóa] rồi TermType, mảng Languages [số ngôn ngữ][chuỗi tiếng Việt]...
Inputs are read only; khóa cũ trong localization.json được giữ nếu bản quét không thấy.
"""
from pathlib import Path
import json,re
scope={'__file__':str(Path(__file__).with_name('export_ui.py').resolve())}
exec(compile(Path(__file__).with_name('export_ui.py').read_text(encoding='utf-8').split('build=env.load_file')[0],'export_ui.py','exec'),scope)
env,cls,string,integer,DATA,ROOT=(scope[k] for k in ('env','cls','string','integer','DATA','ROOT'))
inv=json.loads((ROOT/'web-ui/extracted/inventory.json').read_text(encoding='utf-8'))
out=ROOT/'web-ui/dist/localization.json';old=json.loads(out.read_text(encoding='utf-8'))
found={}
# Bảng ngôn ngữ nằm trong MonoBehaviour của các tệp Data có nhiều khóa (level2, d079afba..., ...) chứ không chỉ I2Languages_*.
import os,UnityPy
pat=re.compile(rb'(?:LBL|MSG|MISC|ERR|TXT|LABEL|TITLE|ACTION)_[A-Z0-9_]{3,}')
candidates=[]
for name in os.listdir(DATA):
    path=DATA/name
    if path.is_file() and path.stat().st_size<8e6:
        b=path.read_bytes()
        if len(pat.findall(b))>=40 and (bytes([0xe1,0xbb]) in b or bytes([0xc3]) in b):candidates.append(path)
for path in candidates:
    for o in UnityPy.load(str(path)).objects:
        if o.type.name!='MonoBehaviour':continue
        raw=o.get_raw_data()
        for m in re.finditer(rb'[A-Z][A-Za-z0-9_]{2,80}',raw):
            start=m.start()-4
            if start<0 or start%4:continue
            try:
                term,off=string(raw,start)
                if term!=m.group().decode() or '_' not in term:continue
                count=integer(raw,off+4)
                if not 1<=count<=12:continue
                value,_=string(raw,off+8)
            except Exception:continue
            if value and term not in found and not value.isupper():found[term]=value.split('[i2s_Touch]')[0]
merged={**old,**found}
out.write_text(json.dumps(merged,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print('files',len(candidates),'old',len(old),'found',len(found),'new',len(merged)-len(old),'changed',sum(1 for k in old if k in found and found[k]!=old[k]))
