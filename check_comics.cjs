/* State/branch checks for reaction art. Browser QA checks the actual assets. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const base=__dirname;
const context={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(base,'dist/assets/comic.js'),'utf8'),context);
const {selectState,pairFor,assets}=context.window.ConversationComic;
const topics=['consent-boundaries','protection','preferences','sexual-health'];
const pairs={'woman-man':'mixed','man-woman':'mixed','woman-woman':'women','man-man':'men',neutral:'mixed'};
let count=0;
for(const [relationship,expected]of Object.entries(pairs)){
 assert.equal(pairFor(relationship),expected);
 assert.equal(selectState({relationship}).asset,assets[expected]);
 count++;
}
for(const slug of topics){
 const story=JSON.parse(fs.readFileSync(path.join(base,'stories',slug+'.json'),'utf8'));
 const original=JSON.stringify(story);
 const entry=story.nodes[story.entry];
 assert.equal(selectState({slug,story,node:entry}).frame,0);
 for(const [id,node]of Object.entries(story.nodes)){
  for(const relationship of Object.keys(pairs)){
   const choiceState=selectState({slug,story,node,relationship,selfName:'Sam',partnerName:'Lee'});
   assert.equal(choiceState.dialogue,node.partner);
   assert.equal(choiceState.speaker,'Lee');
   assert(choiceState.description.startsWith('Sam and Lee,'));
   assert(choiceState.frame>=0&&choiceState.frame<=5);
  }
  for(const choice of node.choices){
   const state=selectState({slug,story,node,choice,phase:'feedback',partnerName:'Lee'});
   assert.equal(state.dialogue,choice.response,slug+'/'+id+': feedback must keep the actual response');
   assert.equal(state.destination,choice.next);
   if(choice.moveTags.length===0)assert.equal(state.frame,2,'Pressure/guessing needs a questioning panel');
   else if(choice.moveTags.includes('taking-time'))assert.equal(state.frame,4,'A chosen pause must leave room');
   count++;
  }
 }
 for(const [key,ending]of Object.entries(story.endings)){
  const state=selectState({slug,story,ending,phase:'complete'});
  const explicitPause=(slug==='consent-boundaries'&&['ending_space','ending_later'].includes(key))||
   (slug==='protection'&&key==='ending_pause')||
   (['preferences','sexual-health'].includes(slug)&&['pause','different_needs'].includes(key));
  assert.equal(state.frame,explicitPause?4:5,slug+'/'+key+': ending should respect the actual outcome');
  assert(!/kiss|hug|romance|win/i.test(state.dialogue));
  count++;
 }
 assert.equal(JSON.stringify(story),original,'State selection must not change the story');
}
const health=JSON.parse(fs.readFileSync(path.join(base,'stories/sexual-health.json'),'utf8'));
assert.equal(selectState({slug:'sexual-health',story:health,node:health.nodes.start,choice:health.nodes.start.choices[0],phase:'feedback'}).frame,1);
assert.equal(selectState({slug:'sexual-health',story:health,node:health.nodes.start,choice:health.nodes.start.choices[1],phase:'feedback'}).frame,2);
assert.equal(selectState({phase:'paused'}).frame,4);
assert.equal(selectState(null).pair,'mixed');
assert.equal(selectState({relationship:'unknown'}).pair,'mixed');
console.log(`PASS comic state mapping: ${count} pair, branch and ending cases across all four topics.`);
console.log('PASS original dialogue preserved; actual next responses change reactions; pauses and pressure are not romantic wins.');
if(process.argv.includes('--assets')){
 for(const asset of Object.values(assets))assert(fs.statSync(path.join(base,'dist',asset.slice(1))).size>0,`Missing sprite: ${asset}`);
 console.log('PASS all three reaction sprite sheets exist.');
}
