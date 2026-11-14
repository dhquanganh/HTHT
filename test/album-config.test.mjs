import {test,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {applyAlbumConfig,albumAdminView,validateAlbumConfig,checkArt} from '../server/album-config.mjs';
import {pictures,rollAlbum,albumGroups,albumRates} from '../server/album.mjs';
import {starterPlayer} from '../server/game.mjs';
afterEach(()=>applyAlbumConfig(null));
const base=()=>{const v=albumAdminView();return{fee:v.fee,successRate:v.successRate,duplicateRate:v.duplicateRate,pictures:structuredClone(v.pictures).map(({custom,...p})=>p)}};
const ready=()=>{const p=starterPlayer('A');p.account.level=999;return p};
const seq=list=>{let i=0;return n=>list[i++%list.length]%n};
test('defaults: 120 original pictures, always succeed, never duplicate',()=>{
 const v=albumAdminView();assert.equal(v.pictures.length,120);assert.equal(v.successRate,100);assert.equal(v.duplicateRate,0);
 const p=ready();for(let i=0;i<4;i++)assert.ok(!rollAlbum(p,{album:1,image:1},()=>{},()=>{}).duplicate);assert.equal(p.album.pieces['1-1'].length,4);
});
test('success and duplicate rates change the roll outcome',()=>{
 const cfg=base();cfg.successRate=0;applyAlbumConfig(validateAlbumConfig(cfg,new Set()));
 const p=ready();const r=rollAlbum(p,{album:1,image:1},()=>{},()=>{});assert.equal(r.failed,true);assert.equal((p.album.pieces['1-1']||[]).length,0);
 cfg.successRate=100;cfg.duplicateRate=100;applyAlbumConfig(validateAlbumConfig(cfg,new Set()));
 rollAlbum(p,{album:1,image:1},()=>{},()=>{});const d=rollAlbum(p,{album:1,image:1},()=>{},()=>{});assert.equal(d.duplicate,true);assert.equal(p.album.pieces['1-1'].length,1);
 assert.equal(albumRates.duplicateRate,100);
 assert.throws(()=>validateAlbumConfig({...cfg,successRate:150},new Set()),/0 đến 100/);
});
test('edit picture stats and add a new uploaded picture',()=>{
 const cfg=base();cfg.pictures[0].points=[[0,1234],[100,50]];
 const id='a'.repeat(24);cfg.pictures.push({album:15,image:1,name:'Tranh mới',rows:3,cols:3,points:[[2,5000]],requireImage:0,requireLevel:1,art:'album-upload-'+id,artSrc:`/album-art/${id}.webp`});
 assert.throws(()=>validateAlbumConfig(cfg,new Set()),/không hợp lệ/);
 applyAlbumConfig(validateAlbumConfig(cfg,new Set([id])));assert.equal(pictures.length,121);
 const p=ready();for(let i=0;i<9;i++)rollAlbum(p,{album:15,image:1},()=>{},()=>{});
 assert.ok(albumGroups(p).some(g=>g.point.some(([k,v])=>k===2&&v===5000)));
 const dup=base();dup.pictures.push({...dup.pictures[0]});assert.throws(()=>validateAlbumConfig(dup,new Set([id])),/Trùng mã/);
});
test('uploaded art must be a WebP of reasonable size',()=>{
 const webp=Buffer.concat([Buffer.from('RIFF'),Buffer.alloc(4),Buffer.from('WEBPVP8 '),Buffer.alloc(30)]);
 assert.equal(checkArt(webp),webp);assert.throws(()=>checkArt(Buffer.from('<svg onload=1></svg>'.padEnd(40))),/WebP/);assert.throws(()=>checkArt(Buffer.alloc(1600000)),/quá lớn/);
});
