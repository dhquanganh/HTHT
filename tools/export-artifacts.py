"""Build dist/artifacts.json (bảo vật) from db_item_baovat and db_point_view.

db_item_baovat: quality 1-6 (bậc, cùng thang màu với trang bị: xám, xanh lá, xanh dương, tím, vàng, đỏ),
effect1..effect6 = chỉ số cộng thêm ở cấp 1..6, mỗi cấp là danh sách {faction, clazz, point:[id,value,...]}:
faction 0 = mọi hệ, 1..6 = Sinh Khí, Bền Bỉ, Nhanh Nhẹn, Chính xác, Thông Minh, Minh Mẫn (thứ tự mảnh 2000x);
clazz 0 = mọi nghề, 1..5 như trang bị. sell_price là giá bán theo cấp. Một số dòng có số kiểu "00" nên được sửa
trước khi đọc JSON. Inputs are read only.
"""
from pathlib import Path
import json, re, UnityPy

web=Path(__file__).resolve().parents[1]
database=UnityPy.load(str(next((web.parent/'HTTH').rglob('database_ex/**/__data'))))
def table(name):
    p=next(p for n,p in database.container.items() if n.endswith('/'+name+'.txt'))
    raw=p.read().m_Script
    if not isinstance(raw,str):raw=raw.decode('utf-8')
    return json.loads(raw[raw.find('['):])
def parse(text):
    if not text:return None
    # ĐIỂU SƯ cấp 2 ghi "00,130" giữa các cấp "100,110" / "100,150": lỗi gõ của mã 100 (Công %).
    text=re.sub(r'(?<=[\[,])00(?=,)','100',text)
    return [{'faction':int(e.get('faction') or 0),'clazz':int(e.get('clazz') or 0),'point':[[e['point'][i],e['point'][i+1]] for i in range(0,len(e['point'])-1,2)]} for e in json.loads(text)]
views={str(r['id_point']):{'name':r['description'],'rate':float(r['num_rate']),'percent':r['text_values']=='%'} for r in table('db_point_view')}
items={};used=set()
for row in table('db_item_baovat'):
    levels=[parse(row['effect%d'%i]) for i in range(1,7)]
    levels=[l for l in levels if l]
    for level in levels:
        for g in level:used.update(str(i) for i,_ in g['point'])
    items['artifact:'+row['id']]={'name':(row['name'] or '').strip(),'quality':int(row['quality']),'release':row['release']=='1','levels':levels,'sellPrices':json.loads(row['sell_price'] or '[]')}
result={'points':{k:views[k] for k in sorted(used,key=int) if k in views},'items':items}
(web/'dist/artifacts.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print(len(items),'artifacts; points',{k:v['name'] for k,v in result['points'].items()},'missing',sorted(used-set(views)))
