"""Export the original pirate NPCs for the battle presentation."""
from pathlib import Path
import json
scope = {'__file__': str(Path('tools/export_ui.py').resolve())}
exec(compile(Path('tools/export_ui.py').read_text(encoding='utf-8').split('build=env.load_file')[0], 'export_ui.py', 'exec'), scope)
f = scope['env'].load_file(str(scope['DATA']/'globalgamemanagers'))
resources = next(o.read() for o in f.objects.values() if o.type.name == 'ResourceManager')
paths = dict(resources.m_Container)
result = [scope['skeleton'](ptr) for name, ptr in resources.m_Container
          if name == '_pack/heroes4/237/hero_237_skeletondata']
assert result, 'Pirate skeletons missing'
hit_path = '_pack/herocommonskill/magichit_1'
hit = scope['skeleton'](paths[hit_path+'_skeletondata'])
heal_path = '_pack/effects/hpbuff/buff_mau'
heal = scope['skeleton'](paths[heal_path+'_skeletondata'])
battle_rows = json.loads(paths['_pack/db/db_battle_heroes'].read().m_Script)
luffy = next(row for row in battle_rows if row['key'] == '109')
enemy = next(row for row in battle_rows if row['key'] == '237')
manifest = {'enemies': result, 'effects': {'impact': {'resource': hit_path, 'skeleton': hit,
            'animation': 'Hit', 'scale': 0.6},'heal': {'resource':heal_path,'skeleton':heal,
            'animation':'animation','scale':0.6}},
            'combatAnimations': {'hero': {'attack': luffy['skills'][0], 'skill': luffy['skills'][1]},
                                 'enemy': {'attack': enemy['skills'][0]}}}
Path('dist/battle-reference.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
Path('dist/assets.json').write_text(json.dumps(scope['assets'], ensure_ascii=False, indent=2), encoding='utf-8')
print([r['name'] for r in result])
