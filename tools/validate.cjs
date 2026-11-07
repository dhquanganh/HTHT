const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'../dist');
let errors=[];
function check(src){if(!fs.existsSync(path.join(root,src)))errors.push('Missing file: '+src)}
const assets=JSON.parse(fs.readFileSync(path.join(root,'assets.json'),'utf8'));
for(const a of Object.values(assets))check(a.src);
const catalog=JSON.parse(fs.readFileSync(path.join(root,'catalog.json'),'utf8'));
let nodes=0;
function walk(n){nodes++;for(const c of n.components){if(c.asset&&!assets[c.asset])errors.push('Missing asset: '+c.asset);if(c.font)check(c.font.src);if(c.skeleton){check(c.skeleton.skeleton.src);for(const a of c.skeleton.atlases){check(a.atlas.src);for(const k of a.textures)if(!assets[k])errors.push('Missing atlas image: '+k)}}}n.children.forEach(walk)}
for(const s of catalog){check(s.path);JSON.parse(fs.readFileSync(path.join(root,s.path),'utf8')).roots.forEach(walk)}
for(const s of JSON.parse(fs.readFileSync(path.join(root,'samples.json'),'utf8'))){for(const k of ['card','head','art'])if(s[k]&&!assets[s[k]])errors.push('Missing sample '+s[k])}
const battleReference=JSON.parse(fs.readFileSync(path.join(root,'battle-reference.json'),'utf8'));
const campaign=JSON.parse(fs.readFileSync(path.join(root,'campaign.json'),'utf8'));
for(const ch of campaign.chapters)if(!assets[ch.islandKey])errors.push('Missing chapter image: '+ch.id);
for(const visual of Object.values(campaign.visuals)){if(visual.head&&!assets[visual.head])errors.push('Missing campaign avatar: '+visual.avatar);if(visual.skeleton){check(visual.skeleton.skeleton.src);for(const a of visual.skeleton.atlases){check(a.atlas.src);for(const key of a.textures)if(!assets[key])errors.push('Missing campaign texture: '+key)}}}
for(const stage of campaign.stages)for(const enemy of stage.enemies)if(!campaign.enemies[enemy.monsterId])errors.push('Missing stage enemy: '+enemy.monsterId);
for(const skill of JSON.parse(fs.readFileSync(path.join(root,'luffy-skills.json'),'utf8')))if(!assets[skill.assetKey])errors.push('Missing Luffy skill icon: '+skill.id);
const album=JSON.parse(fs.readFileSync(path.join(root,'hero-album.json'),'utf8'));
for(const hero of album.heroes)if(!assets[hero.card])errors.push('Missing album card: '+hero.name);
for(const key of Object.values(album.classIcons))if(!assets[key])errors.push('Missing class icon: '+key);
const profiles=JSON.parse(fs.readFileSync(path.join(root,'hero-profiles.json'),'utf8'));
for(const hero of album.heroes){const profile=profiles[hero.avatar];if(!profile){errors.push('Missing hero profile: '+hero.name);continue}if(!assets[profile.art])errors.push('Missing hero art: '+hero.name);for(const skill of profile.skills)if(!assets[skill.icon])errors.push('Missing skill icon: '+skill.name)}
for(const item of JSON.parse(fs.readFileSync(path.join(root,'items-extra.json'),'utf8')))if(!assets[item.assetKey])errors.push('Missing item art: '+item.id);
for(const [id,chest] of Object.entries(JSON.parse(fs.readFileSync(path.join(root,'chests.json'),'utf8'))))if(!chest.rewards.length)errors.push('Empty chest: '+id);
const heroEffects=JSON.parse(fs.readFileSync(path.join(root,'hero-effects.json'),'utf8'));
for(const [avatar,hero] of Object.entries(heroEffects.heroes))for(const effect of [...hero.cast,...hero.impact])if(!heroEffects.effects[effect.key])errors.push('Missing hero effect: '+avatar+' '+effect.key);
for(const skeleton of Object.values(heroEffects.effects)){check(skeleton.skeleton.src);for(const a of skeleton.atlases)check(a.atlas.src)}
const heroVisuals=JSON.parse(fs.readFileSync(path.join(root,'hero-visuals.json'),'utf8'));
for(const [avatar,visual] of Object.entries(heroVisuals)){if(!visual.head||!assets[visual.head])errors.push('Missing hero head: '+avatar);if(!visual.skeleton){errors.push('Missing hero skeleton: '+avatar);continue}check(visual.skeleton.skeleton.src);for(const a of visual.skeleton.atlases){check(a.atlas.src);for(const key of a.textures)if(!assets[key])errors.push('Missing hero texture: '+key)}}
const zoro=JSON.parse(fs.readFileSync(path.join(root,'zoro-king-of-hell.json'),'utf8'));
for(const key of ['head','card','art'])if(!assets[zoro.visual[key]])errors.push('Missing Zoro image: '+key);
for(const skill of zoro.skills)if(!assets[skill.assetKey])errors.push('Missing Zoro icon: '+skill.id);
for(const key of ['skeleton','cutscene','skillEffect']){const skeleton=zoro.visual[key];check(skeleton.skeleton.src);for(const a of skeleton.atlases){check(a.atlas.src);for(const image of a.textures)if(!assets[image])errors.push('Missing Zoro texture: '+image)}}
for(const skeleton of [...battleReference.enemies,...Object.values(battleReference.effects||{}).map(e=>e.skeleton)]){check(skeleton.skeleton.src);for(const atlas of skeleton.atlases){check(atlas.atlas.src);for(const key of atlas.textures)if(!assets[key])errors.push('Missing battle texture: '+key)}}
console.log(JSON.stringify({scenes:catalog.filter(x=>!x.prefab).length,prefabs:catalog.filter(x=>x.prefab).length,nodes,images:Object.keys(assets).length,errors},null,2));if(errors.length)process.exitCode=1;
