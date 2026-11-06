from pathlib import Path
import json,re,UnityPy
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'web-ui/extracted/original-assets'
DATA=ROOT/'assets/bin/Data'
entries,errors,skipped=[],[],[]
files=[p for p in DATA.iterdir() if p.is_file() and (not p.suffix or p.suffix in ('.assets','.split0'))]
for i,p in enumerate(files):
 try:
  env=UnityPy.load(str(p))
  for o in env.objects:
   typ=o.type.name
   if typ not in ('Texture2D','TextAsset','Font'):continue
   try:
    d=o.read();name=d.m_Name;safe=re.sub(r'[^\w.\- ]','_',name)[:100];folder=OUT/typ;folder.mkdir(parents=True,exist_ok=True)
    if typ=='Texture2D' and (d.m_Width==0 or d.m_Height==0):
     skipped.append({'file':p.name,'id':o.path_id,'name':name,'reason':'Empty runtime-generated texture (0 x 0); no stored image payload.'})
     continue
    target=folder/(p.name+'_'+str(o.path_id)+'_'+safe)
    if typ=='Texture2D':
     target=target.with_name(target.name+'.png')
     if not target.exists():d.image.save(target)
    elif typ=='TextAsset':
     b=d.m_Script
     if isinstance(b,str):b=b.encode('utf-8',errors='surrogateescape')
     target=target.with_name(target.name+('.json' if b.lstrip().startswith(b'{') else '.bytes'))
     if not target.exists():target.write_bytes(b)
    else:
     b=bytes(d.m_FontData)
     if not b:continue
     target=target.with_name(target.name+'.ttf');target.write_bytes(b)
    entries.append({'file':p.name,'id':o.path_id,'type':typ,'name':name,'path':str(target.relative_to(ROOT/'web-ui'))})
   except Exception as ex:errors.append({'file':p.name,'id':o.path_id,'error':str(ex)})
 except Exception as ex:errors.append({'file':p.name,'error':str(ex)})
 if i%1000==0:print(i,len(entries),'exported',len(errors),'warnings',flush=True)
(OUT/'manifest.json').write_text(json.dumps(entries,ensure_ascii=False,indent=2),encoding='utf-8')
(OUT/'errors.json').write_text(json.dumps(errors,ensure_ascii=False,indent=2),encoding='utf-8')
(OUT/'skipped.json').write_text(json.dumps(skipped,ensure_ascii=False,indent=2),encoding='utf-8')
print('DONE',len(entries),'exported',len(errors),'warnings',flush=True)
