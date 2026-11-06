from pathlib import Path
import UnityPy, json, collections, time

root = Path(__file__).resolve().parents[2]
out = root / 'web-ui' / 'extracted'
out.mkdir(parents=True, exist_ok=True)
files = [p for p in (root / 'assets/bin/Data').iterdir() if p.is_file() and (not p.suffix or p.suffix == '.assets')]
entries, errors = [], []
counts = collections.Counter()
for i,p in enumerate(files):
    try:
        env = UnityPy.load(str(p))
        for obj in env.objects:
            typ = obj.type.name
            counts[typ] += 1
            if typ in ('Texture2D','Sprite','TextAsset','Font','GameObject','MonoScript','AssetBundle'):
                try:
                    data = obj.read()
                    entry = {'file':p.name,'id':obj.path_id,'type':typ,'name':getattr(data,'m_Name','')}
                    if typ == 'Texture2D':
                        entry.update(width=data.m_Width,height=data.m_Height,format=int(data.m_TextureFormat))
                    entries.append(entry)
                except Exception as ex:
                    errors.append({'file':p.name,'id':obj.path_id,'error':str(ex)[:200]})
    except Exception as ex:
        errors.append({'file':p.name,'error':str(ex)[:200]})
    if i % 500 == 0:
        print(f'{i}/{len(files)} files, {len(entries)} named objects',flush=True)
        (out/'inventory.json').write_text(json.dumps(entries,ensure_ascii=False),encoding='utf-8')
(out/'inventory.json').write_text(json.dumps(entries,ensure_ascii=False),encoding='utf-8')
(out/'summary.json').write_text(json.dumps({'counts':counts,'errors':errors},ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'counts':counts,'errors':len(errors)}),flush=True)
