"""Seed view-only content for lists Unity normally populates at runtime."""
from pathlib import Path
import json,re,subprocess
scope={'__file__':str(Path(__file__).with_name('export_ui.py').resolve())}
source=Path(__file__).with_name('export_ui.py').read_text(encoding='utf-8').split('build=env.load_file')[0]
exec(compile(source,'export_ui.py','exec'),scope)
globals().update({k:v for k,v in scope.items() if not k.startswith('__')})
inv=json.loads((ROOT/'web-ui/extracted/inventory.json').read_text(encoding='utf-8'))
db=next(x for x in inv if x['type']=='TextAsset' and x['name']=='db_heroes')
heroes=json.loads(next(iter(UnityPy.load(str(DATA/db['file'])).objects)).read().m_Script)
ids=['109','164','174','161','176','107']
unique=[];seen=set()
for x in heroes:
 if x['avatar'] not in seen and int(x['id'])<10000:
  seen.add(x['avatar']);unique.append(x)
selected=[next(x for x in unique if x['avatar']==i) for i in ids]
selected+= [x for x in unique if x['avatar'] not in ids][:24]
result=[]
for hero in selected:
 av=hero['avatar'];entry={k:hero[k] for k in ['id','name','avatar','type','star','class']}
 for category,size in [('card',(180,248)),('head',(100,100)),('art',(640,512))]:
  matches=[x for x in inv if x['type']=='Texture2D' and x['name']==av and (x['width'],x['height'])==size]
  if matches:
   x=matches[0];f=env.load_file(str(DATA/x['file']));entry[category]=save_image(f.objects[x['id']])
 if av in ids:
  pattern='Hero_'+av+'_SkeletonData'
  files=subprocess.run(['rg','-a','-l','--fixed-strings',pattern,str(DATA)],capture_output=True,text=True).stdout.splitlines()
  for filename in files:
   f=env.load_file(filename)
   for o in f.objects.values():
    if o.type.name=='MonoBehaviour':
     name=string(o.get_raw_data(),28)[0]
     if name==pattern:
      p=UnityPy.classes.PPtr(m_FileID=0,m_PathID=o.path_id,assetsfile=f)
      entry['skeleton']=skeleton(p)
      break
 result.append(entry)
localization={}
langfiles=set(x['file'] for x in inv if x['type']=='GameObject' and x['name'].startswith('I2Languages'))
for filename in langfiles:
 f=env.load_file(str(DATA/filename))
 for o in f.objects.values():
  if o.type.name!='MonoBehaviour':continue
  if cls(o)!='LanguageSource':continue
  raw=o.get_raw_data()
  # Scan aligned serialized term strings; only export the first language (Vietnamese).
  for match in re.finditer(rb'(?:LBL_|MSG_|ERR_|TXT_|MISC_)[A-Z0-9_]+',raw):
   pos=match.start();start=pos-4
   if start<0 or start%4:continue
   term,off=string(raw,start)
   if term!=match.group().decode():continue
   try:
    count=integer(raw,off+4)
    if 1<=count<=12:
     value,_=string(raw,off+8)
     if value:localization[term]=value.split('[i2s_Touch]')[0]
   except Exception:pass
rmfile=env.load_file(str(DATA/'globalgamemanagers'))
resource_manager=next(o.read() for o in rmfile.objects.values() if o.type.name=='ResourceManager')
equipment=[]
for resource,p in resource_manager.m_Container:
 if re.match(r'^_pack/itemequipment/(?:[1-9]|[1-3][0-9])$',resource) and p.m_PathID==2:
  equipment.append({'name':resource.rsplit('/',1)[-1],'asset':image_ptr(p)})
(OUT/'items.json').write_text(json.dumps(equipment,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
(OUT/'samples.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
(OUT/'localization.json').write_text(json.dumps(localization,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
(OUT/'assets.json').write_text(json.dumps(assets,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print('samples',len(result),'localization',len(localization),'images',len(assets))
