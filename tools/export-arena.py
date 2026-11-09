"""Chiến trường (ArenaScene gốc) -> dist/arena.json.

Đọc nguyên TextAsset trong APK (extracted/original-assets/TextAsset, bản tiếng Việt khi có):
  db_arena_reward            daily_reward / season_reward (Đơn đấu - Giải thách đấu), trial_of_champion_reward (Liên đấu),
                             daily_time_up = 21 (giờ trao thưởng ngày, UTC/GMT 0 như MSG_ARENA_TITLE_REWARD).
                             diamonds -> kim cương, magic_dust -> Bụi ma thuật (consumable:3),
                             glory_coin -> Huy hiệu Chiến trường (consumable:19).
  db_allstars_point          Võ đấu: điểm mỗi giờ theo hạng vòng bảng.
  db_allstars_season_rewards Võ đấu: thưởng mùa theo điểm tích lũy.
  db_allstars_knockout_rewards Võ đấu: thưởng Vô song theo vòng bị loại.
  Mã thưởng Võ đấu: [1,n] vàng, [2,n] kim cương, [3,k,id,n,...] vật phẩm id (40 = Lệnh bài võ đấu),
  [8,1,id] khung/danh hiệu (bản web chưa có, bỏ qua).
Inputs are read only.
"""
from pathlib import Path
import json, re

web=Path(__file__).resolve().parents[1]
src=web/'extracted/original-assets/TextAsset'
def read(name,prefer=None):
    files=sorted(src.glob('*_'+name+'.*'))
    texts=[f.read_text(encoding='utf-8-sig') for f in files]
    if prefer:
        for t in texts:
            if prefer in t:return json.loads(t)
    return json.loads(texts[0])

def bracket(label):
    nums=[int(x) for x in re.findall(r'\d+',label)]
    return [nums[0],nums[-1]] if nums else None
def wallet(row):
    out=[]
    if row.get('diamonds'):out.append({'itemId':'diamonds','quantity':row['diamonds']})
    if row.get('magic_dust'):out.append({'itemId':'consumable:3','quantity':row['magic_dust']})
    if row.get('glory_coin'):out.append({'itemId':'consumable:19','quantity':row['glory_coin']})
    return out
arena=read('db_arena_reward')
ranks=lambda rows:[{'rank':r['rank'],'from':bracket(r['rank'])[0],'to':r['limit_rank'],'rewards':wallet(r)} for r in rows]

def code(raw):
    v=json.loads(raw);out=[];i=0
    while i<len(v):
        t=v[i]
        if t==1:out.append({'itemId':'gold','quantity':v[i+1]});i+=2
        elif t==2:out.append({'itemId':'diamonds','quantity':v[i+1]});i+=2
        elif t==3:
            k=v[i+1];i+=2
            for _ in range(k):out.append({'itemId':'consumable:%d'%v[i],'quantity':v[i+1]});i+=2
        elif t==8:i+=3   # khung avatar / danh hiệu: chưa có trong bản web
        else:raise ValueError(raw)
    return out
points=[{'rank':r['rank'],'from':bracket(r['rank'])[0],'to':bracket(r['rank'])[1],'perHour':r['point_per_hour']} for r in read('db_allstars_point')]
season=[]
for r in read('db_allstars_season_rewards','điểm'):
    nums=[int(x) for x in re.findall(r'\d+',r['point'])]
    season.append({'label':r['point'].replace('  ',' '),'min':nums[0],'rewards':code(r['rewards'])})
knockout=[{'label':r['rank'],'rewards':code(r['rewards'])} for r in read('db_allstars_knockout_rewards','Vô địch')]

# Ô xếp hạng theo hạng (CellTopArena): cell_arena_1/2/3 và huy hiệu tag_1/2/3 (Texture2D gốc trong APK).
from PIL import Image
manifest=json.loads((web/'extracted/original-assets/manifest.json').read_text(encoding='utf-8'))
merged=json.loads((web/'dist/assets.json').read_text(encoding='utf-8'))
sprites={}
for name,border in [('cell_arena_1',[12,12,12,45]),('cell_arena_2',[12,12,12,45]),('cell_arena_3',[12,12,12,45]),('tag_1',[0,0,0,0]),('tag_2',[0,0,0,0]),('tag_3',[0,0,0,0]),('attack_win',[0,0,0,0]),('attack_lose',[0,0,0,0]),('defend_win',[0,0,0,0]),('defend_lose',[0,0,0,0]),('rank_up',[0,0,0,0]),('rank_down',[0,0,0,0]),('rank_same',[0,0,0,0]),('icon_ticket_arena',[0,0,0,0])]:
    entry=next(e for e in manifest if e['type']=='Texture2D' and e['name']==name);key=entry['file']+'_2'
    if key not in merged:
        image=Image.open(web/entry['path'].replace('\\','/')).convert('RGBA');out=web/'dist/assets'/(key+'.webp')
        if not out.exists():image.save(out,'WEBP',quality=92,method=6)
        merged[key]={'name':name,'src':'assets/'+key+'.webp','width':image.width,'height':image.height,'border':border}
    sprites[name]=key
(web/'dist/assets.json').write_text(json.dumps(merged,ensure_ascii=False,separators=(',',':')),encoding='utf-8')

result={
 'sprites':sprites,
 'dailyHourUtc':arena['daily_time_up'],
 'solo':{'daily':ranks(arena['daily_reward']),'season':ranks(arena['season_reward'])},
 'league':{'season':ranks(arena['trial_of_champion_reward'])},
 'allstars':{'points':points,'season':season,'knockout':knockout},
}
(web/'dist/arena.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print('solo',len(result['solo']['daily']),len(result['solo']['season']),'league',len(result['league']['season']),'allstars',len(points),len(season),len(knockout))
