import {test} from 'node:test';
import assert from 'node:assert/strict';
import {heroAlbum,heroDefinitions,publicCatalog} from '../server/catalog.mjs';

test('album lists every released hero once, newest first, with valid factions and classes',()=>{
 const {heroes}=heroAlbum;assert.equal(heroes.length,236);assert.equal(new Set(heroes.map(h=>h.avatar)).size,heroes.length);
 for(let i=1;i<heroes.length;i++)assert.ok(heroes[i-1].id>heroes[i].id);
 for(const h of heroes){assert.ok(['fortress','abyss','forest','shadow','dark','light'].includes(h.faction),h.name);assert.ok(['warrior','mage','priest','ranger','assassin'].includes(h.class),h.name);assert.ok(h.rank>=1&&h.rank<=6,h.name);assert.ok(h.card,h.name)}
 assert.deepEqual(heroes.filter(h=>h.faction==='abyss').slice(0,8).map(h=>h.name),['Phoenix Marco','Black Maria','Punk-02 Lilith','Basil Hawkins','Zephyr','Akainu Sakazuki','Brook Wano','Bullet']);
});

test('every playable hero maps to an album entry so it never shows as unowned',()=>{
 for(const hero of heroDefinitions)assert.ok(heroAlbum.heroes.some(h=>h.avatar===hero.avatar),hero.name);
});

test('public catalog carries the album for the client',()=>{assert.equal(publicCatalog().album.heroes.length,236);assert.ok(publicCatalog().album.classIcons.priest)});
