import {test} from 'node:test';
import assert from 'node:assert/strict';
import {starterPlayer,applyAction,tutorialCore,tutorialTips} from '../server/game.mjs';

test('finishing the intro starts the tutorial; steps advance in order and survive replays',()=>{
 const p=starterPlayer('Tut',{intro:true});applyAction(p,'intro',{step:'summon'});applyAction(p,'summon',{faction:'fortress',count:10});
 assert.equal(p.tutorial,undefined);applyAction(p,'intro',{step:'done'});assert.deepEqual(p.tutorial,{core:0,tips:[]});
 applyAction(p,'tutorial',{index:0});assert.equal(p.tutorial.core,1);
 applyAction(p,'tutorial',{index:0});assert.equal(p.tutorial.core,1,'replaying a finished step is harmless');
 applyAction(p,'tutorial',{index:5});assert.equal(p.tutorial.core,1,'cannot jump ahead');
 assert.throws(()=>applyAction(p,'tutorial',{index:tutorialCore}));
 applyAction(p,'tutorial',{tip:'pet'});applyAction(p,'tutorial',{tip:'pet'});assert.deepEqual(p.tutorial.tips,['pet']);
 assert.throws(()=>applyAction(p,'tutorial',{tip:'nope'}));
 applyAction(p,'tutorial',{skip:true});assert.equal(p.tutorial.core,tutorialCore);assert.deepEqual(p.tutorial.tips,tutorialTips);
});
test('old accounts have no tutorial',()=>{const p=starterPlayer('Old');assert.throws(()=>applyAction(p,'tutorial',{index:0}),/không có hướng dẫn/)});
