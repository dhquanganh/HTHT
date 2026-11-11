// Ghi chữ gốc (dist/localization.json, I2 tiếng Việt) vào mọi node có Localize trong dữ liệu UI đã xuất
// (dist/scenes/*.json và dist/*.json chứa prefab). Unity: component Localize đặt Text theo khóa khi bật, nên chữ mẫu
// trong prefab ("Attack", "首次購買獎勵", "sdfasdf"...) không bao giờ hiện. Bản web dựng popup bằng PrefabDOM không qua
// bước đó, nên chạy tool này sau mỗi lần xuất. Khóa có tham số ({0}) được giữ chữ mẫu vì mã gán lại lúc chạy.
// Dùng: node tools/apply-localization.cjs [--check]
const fs=require('fs'),path=require('path');
const dist=path.join(__dirname,'..','dist'),loc=require(path.join(dist,'localization.json')),check=process.argv.includes('--check');
const files=[...fs.readdirSync(path.join(dist,'scenes')).filter(f=>f.endsWith('.json')).map(f=>'scenes/'+f),...fs.readdirSync(dist).filter(f=>f.endsWith('.json')&&f!=='localization.json'&&f!=='assets.json')];
let changed=0,touched=0;
const walk=n=>{let hit=0;if(!n||typeof n!=='object')return 0;if(Array.isArray(n)){for(const x of n)hit+=walk(x);return hit}
 if(Array.isArray(n.components)){const L=n.components.find(c=>c&&c.type==='Localize'),T=n.components.find(c=>c&&c.type==='Text');
  const v=L&&loc[L.term];if(T&&typeof v==='string'&&!/\{\d\}/.test(v)&&T.text!==v){T.text=v;hit++}}
 for(const k in n)if(k!=='components'&&n[k]&&typeof n[k]==='object')hit+=walk(n[k]);return hit};
for(const f of files){const p=path.join(dist,f),src=fs.readFileSync(p,'utf8');if(!src.includes('"Localize"'))continue;const j=JSON.parse(src),n=walk(j);if(n){changed+=n;touched++;if(!check)fs.writeFileSync(p,JSON.stringify(j))}}
console.log(`${check?'would change':'changed'} ${changed} texts in ${touched} files`);
