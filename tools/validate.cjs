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
console.log(JSON.stringify({scenes:catalog.filter(x=>!x.prefab).length,prefabs:catalog.filter(x=>x.prefab).length,nodes,images:Object.keys(assets).length,errors},null,2));if(errors.length)process.exitCode=1;
