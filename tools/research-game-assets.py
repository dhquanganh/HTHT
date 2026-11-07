"""Export resource-identified inventory sprites and battle backgrounds only.

This intentionally does not modify app.js or the existing assets.json manifest.
"""
from pathlib import Path
import json, re, UnityPy

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'assets/bin/Data'
WEB = ROOT / 'web-ui/dist'
OUT = WEB / 'assets'
OUT.mkdir(parents=True, exist_ok=True)
env = UnityPy.Environment()
env.path = str(DATA)
for p in DATA.glob('*.split0'):
    env.load_file(str(p))
global_file = env.load_file(str(DATA / 'globalgamemanagers'))
resource_manager = next(o.read() for o in global_file.objects.values() if o.type.name == 'ResourceManager')
resource_paths = {}
for name, ptr in resource_manager.m_Container:
    resource_paths.setdefault(name, []).append(ptr)

def database(name):
    ptr = resource_paths['_pack/db/' + name][0]
    return json.loads(ptr.read().m_Script)

tables = {
    'equipment': database('db_item_equipment'),
    'consumable': database('db_item_consumable'),
    'artifact': database('db_item_baovat'),
    'shard': database('db_item_manh'),
}
skill_table = database('db_hero_skill')
skill_lookup = {}
for skill in skill_table:
    skill_lookup.setdefault(str(skill.get('icon','')),skill)
tables['skill'] = skill_table
lookup = {kind: {str(x['id']): x for x in rows} for kind, rows in tables.items()}
categories = {'itemequipment':'equipment','itemconsumable':'consumable','itemartifact':'artifact','itemshard':'shard','skillicon':'skill'}
prefix_names = {'equipment':'Trang bị', 'consumable':'Vật phẩm', 'artifact':'Bảo vật', 'shard':'Mảnh thuyền viên','skill':'Kỹ năng'}
items, backgrounds, assets, warnings = [], [], {}, []
existing_assets = json.loads((WEB/'assets.json').read_text(encoding='utf-8'))

def export_sprite(ptr):
    obj = ptr.deref()
    data = obj.read()
    key = Path(obj.assets_file.name).name + '_' + str(obj.path_id)
    target = OUT / (key + '.webp')
    if not target.exists():
        data.image.save(target, 'WEBP', lossless=True, method=3)
    image = data.image
    entry = {'key':key, 'name':data.m_Name, 'src':'assets/' + target.name,
             'width':image.width, 'height':image.height}
    if obj.type.name == 'Sprite':
        border=data.m_Border
        entry['border']=[border.x,border.y,border.z,border.w]
    assets[key] = entry
    return entry

for resource, pointers in resource_paths.items():
    match = re.match(r'^_pack/(itemequipment|itemconsumable|itemartifact|itemshard|skillicon)/([^/]+)$', resource)
    is_background = re.match(r'^images/battle/battlearena\d+$', resource)
    if not match and not is_background:
        continue
    sprite_ptr = next((p for p in pointers if p.m_PathID == 2), None)
    if not sprite_ptr:
        warnings.append(resource + ': no sprite')
        continue
    try:
        visual = export_sprite(sprite_ptr)
    except Exception as ex:
        warnings.append(resource + ': ' + str(ex))
        continue
    if is_background:
        backgrounds.append({'id':resource.rsplit('/',1)[-1], 'resource':resource, 'visual':visual})
        continue
    category = categories[match.group(1)]
    legacy_id = match.group(2).removeprefix('skill_')
    metadata = skill_lookup.get(legacy_id,{}) if category=='skill' else lookup[category].get(legacy_id, {})
    name = metadata.get('name') or prefix_names[category]+' '+legacy_id
    name = re.sub(r'<[^>]+>','',name).strip()
    name = re.sub(r'^\[\d+\]\s*','',name)
    slot = {'0':'pants','1':'armor','2':'boots','3':'helmet'}.get(str(metadata.get('type'))) if category=='equipment' else 'accessory' if category=='artifact' else None
    stars = max(1,int(metadata.get('star',1))) if str(metadata.get('star',1)).lstrip('-').isdigit() else 1
    rarity = metadata.get('color') or {'1':'blue','2':'yellow','3':'purple','4':'red'}.get(str(metadata.get('quality')),'green')
    rarity_rank={'grey':1,'white':1,'green':2,'blue':3,'yellow':4,'purple':5,'red':6}.get(rarity,2)
    stats={}
    if category=='equipment':
        try:
            points=json.loads(metadata.get('point_desc','[]'))
            for rule in points:
                point=rule.get('point',[])
                if len(point)<2:continue
                stat={0:'attack',1:'defense',2:'hp',3:'speed'}.get(int(point[0]))
                if stat:
                    maximum={'attack':180,'defense':120,'hp':1500,'speed':15}[stat]
                    stats[stat]=max(1,min(maximum,round(float(point[1]))))
        except (ValueError,TypeError):pass
    elif category=='artifact':
        stats={'attack':5+rarity_rank*3,'hp':30+rarity_rank*20}
    items.append({'id':category + ':' + legacy_id,'legacyId':legacy_id,
                  'category':category,'name':name,'slot':slot,'type':metadata.get('type'),
                  'rarity':rarity,'rarityRank':rarity_rank,'stars':stars,
                  'assetKey':visual['key'],'resource':resource,'visual':visual,
                  'stats':stats,'description':re.sub(r'<[^>]+>','',metadata.get('desc') or metadata.get('description') or metadata.get('short_desc') or name),
                  'sellPrice':max(0,int(metadata.get('sell_price',0))) if str(metadata.get('sell_price',0)).lstrip('-').isdigit() else 0,
                  'originalMetadata':metadata})

hero = next(h for h in database('db_heroes') if h['id'] == '109')
hero_battle = next(h for h in database('db_battle_heroes') if h.get('key') == '109')
skill_ids = [hero['active'],hero['passive1'],hero['passive2'],hero['passive3']]
skills = [s for s in skill_table if s['id'] in skill_ids]
samples=json.loads((WEB/'samples.json').read_text(encoding='utf-8'))
# Numeric asset names are not globally unique: e.g. artifact/109 and herohead/109
# are both named "109" and both 100 x 100. Always resolve by resource namespace.
for hero_sample in samples:
    resource='_pack/herohead/'+str(hero_sample['avatar'])
    head_ptr=next((ptr for ptr in resource_paths.get(resource,[]) if ptr.m_PathID==2),None)
    if head_ptr:
        hero_sample['head']=export_sprite(head_ptr)['key']
(WEB/'samples.json').write_text(json.dumps(samples,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
sample = next(s for s in samples if str(s.get('avatar'))=='109')
skeleton = json.loads((WEB/sample['skeleton']['skeleton']['src']).read_text(encoding='utf-8'))
def max_time(node):
    if isinstance(node,dict):
        return max([float(node.get('time',0))] + [max_time(v) for v in node.values()])
    if isinstance(node,list):
        return max([0]+[max_time(v) for v in node])
    return 0

report = {
    'items': items,
    'backgrounds': sorted(backgrounds,key=lambda b:int(re.search(r'\d+',b['id']).group())),
    'assets':assets,
    'luffy':{'sample':sample,'originalHero':hero,'originalBattle':hero_battle,'skills':skills,
             'animations':{name:round(max_time(data),4) for name,data in skeleton['animations'].items()}},
    'stageData':database('db_vuotai')[:30],
    'enemyData':database('db_quai')[:100],
    'warnings':warnings,
}
(WEB/'game-catalog.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
world_map_layers=[]
for suffix in ('1','2','3'):
    resource='images/home/world_bgr_'+suffix
    ptr=next((p for p in resource_paths.get(resource,[]) if p.m_PathID==2),None)
    if ptr:
        visual=export_sprite(ptr)
        world_map_layers.append({'assetKey':visual['key'],'width':visual['width'],'height':visual['height'],'resource':resource})
skill_asset_keys={item['legacyId']:item['assetKey'] for item in items if item['category']=='skill'}
visuals={
    'luffy':sample,
    'battleBackgrounds':report['backgrounds'],
    'map':{'assetKey':world_map_layers[0]['assetKey'],'sceneId':18,'width':world_map_layers[0]['width'],'height':640,'layers':world_map_layers,'layerLayout':'horizontal','originalOceanAssetKey':'08e46ae9ccdbb0b44b2f2bcd1c4a95d2_2'},
    'campaign':{'assetKey':'329fb2ec2a8defe4e8c0e5401fb6e8f5_2','sceneId':34,'width':1280,'height':640},
    'enemies':[{'id':'npc-'+str(i+1),'name':name,'skeleton':s['skeleton'],'head':s.get('head'),'art':s.get('art'),'card':s.get('card'),'scale':1} for i,(name,s) in enumerate(zip(['Kiếm sĩ hải tặc','Võ sĩ hải tặc','Hoa tiêu hải tặc'],samples[1:4]))],
    'skillIcons':{s['id']:{'assetKey':next((item['assetKey'] for item in items if item['category']=='skill' and item['legacyId']==str(s['icon'])),None),'iconId':s['icon'],'name':re.sub(r'<[^>]+>','',s['name'])} for s in skills},
    'luffyAnimations':{'idle':'idling','attack':'beat','skill':'skill3','damage':'damage','dead':'dead','run':'run','win':'win','attackImpact':0.36,'skillImpact':0.73},
    'luffySkillIcons':{'jetPistol':skill_asset_keys['685'],'jetGatling':skill_asset_keys['14']},
    'luffySkills':[
        {'id':'jetPistol','name':'Gomu Gomu no Jet Pistol','assetKey':skill_asset_keys['685'],'animation':'beat','impactAt':0.36,'resource':'_pack/skillicon/skill_685','originalName':'Roi Cao Su'},
        {'id':'jetGatling','name':'Gomu Gomu no Jet Gatling','assetKey':skill_asset_keys['14'],'animation':'skill3','impactAt':0.73,'resource':'_pack/skillicon/skill_14','originalName':'Súng Cao Su'},
    ],
    'starterItems':['equipment:1','equipment:22','artifact:1'],
    'equipmentSlots':['pants','armor','boots','helmet','accessory'],
}
(WEB/'game-visuals.json').write_text(json.dumps(visuals,ensure_ascii=False,indent=2),encoding='utf-8')
existing_assets.update({k:{key:value for key,value in visual.items() if key!='key'} for k,visual in assets.items()})
(WEB/'assets.json').write_text(json.dumps(existing_assets,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print(json.dumps({'items':len(items),'backgrounds':len(backgrounds),'warnings':warnings,
                  'animations':report['luffy']['animations']},ensure_ascii=False),flush=True)
