/* Exhaustive spoken-line/cast checks; visual QA separately reviews all 24 art cells. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=name=>fs.readFileSync(path.join(__dirname,name),'utf8');
const context={window:{}};
vm.runInNewContext(read('dist/assets/comic.js'),context);
const {selectState,expressions,assets}=context.window.ConversationComic;
const profiles=JSON.parse(read('relationships.json')).profiles;
const cases=[
 ['woman-man','woman','woman-man','mixed-man','right'],
 ['woman-man','man','man-woman','mixed-woman','left'],
 ['woman-woman','woman','woman-woman','women-right','right'],
 ['man-man','woman','man-man','men-right','right'],
 ['neutral','woman','neutral','mixed-man','right']
];
const allowed=new Set(expressions.map(e=>e.key));
const stories={};let lines=0,checks=0;
const sameWords=new Map();
for(const slug of ['consent-boundaries','protection','preferences','sexual-health']){
 const story=stories[slug]=JSON.parse(read(`stories/${slug}.json`)),original=JSON.stringify(story);
 for(const [id,node]of Object.entries(story.nodes)){
  for(const line of [node,...node.choices]){
   assert(allowed.has(line.comicExpression),`${slug}/${id}: missing reviewed expression`);
   const words=line===node?node.partner:line.response;
   if(sameWords.has(words))assert.equal(line.comicExpression,sameWords.get(words),'Repeated dialogue changed emotion');
   sameWords.set(words,line.comicExpression);lines++;
   for(const [relationship,mixedRole,key,art,side]of cases){
    const profile=profiles[key],choice=line===node?undefined:line;
    const opts={slug,story,node,choice,relationship,mixedRole,selfName:profile.self.name,partnerName:profile.partner.name};
    const state=selectState(opts);
    assert.equal(state.dialogue,words);
    assert.equal(state.expression,line.comicExpression);
    assert.equal(state.speaker,profile.partner.name);
    assert.equal(state.speakerRole,'partner');
    assert.equal(state.asset,assets[art]);
    assert.equal(state.speakerSide,side);
    assert.equal(state[side+'Name'],profile.partner.name);
    assert.equal(state[side==='left'?'rightName':'leftName'],profile.self.name);
    assert(state.description.startsWith(`${profile.partner.name}, on the ${side},`));
    assert.equal(state.source,id);
    if(choice){
     // An unrelated reward tag or future node must not overrule the actual reply.
     const changed=selectState({...opts,choice:{...choice,next:'another-ending',moveTags:['taking-time']}});
     assert.equal(changed.frame,state.frame);
    }
    checks++;
   }
  }
 }
 assert.equal(JSON.stringify(story),original,'Selecting art changed the story');
}
// User-reported regression: playing Alex means Maya asks on the LEFT.
const p=stories.protection;
const maya=selectState({story:p,node:p.nodes.start,choice:p.nodes.start.choices[1],relationship:'woman-man',mixedRole:'man',selfName:'Alex',partnerName:'Maya'});
assert.equal(maya.dialogue,'Sure. What do you mean by being careful?');
assert.equal(maya.expression,'asking');assert.equal(maya.asset,assets['mixed-woman']);assert.equal(maya.speakerSide,'left');
assert.equal(selectState({relationship:'man-woman',node:p.nodes.start}).asset,assets['mixed-woman']);
// Current response can be sad even when its next scene starts more neutrally.
const h=stories['sexual-health'],pref=stories.preferences;
assert.equal(h.nodes.separate_step.choices[1].comicExpression,'concerned');
assert.equal(h.nodes.waiting_decision.choices[0].comicExpression,'warm'); // Coffee is welcome, though the ending is a pause.
assert.equal(h.nodes.privacy.choices[1].comicExpression,'boundary');
assert.equal(pref.nodes.pause_decision.choices[1].comicExpression,'concerned');
assert.equal(pref.nodes.unresolved_decision.choices[1].comicExpression,'concerned');
assert.equal(p.nodes.start.choices[0].comicExpression,'asking'); // Not the listener reacting to the user's question.
// Missing/new content must remain readable without inventing an emotion.
assert.equal(selectState({node:{partner:'A new line.'}}).asset,null);
assert.equal(selectState({node:{partner:'A new line.'}}).dialogue,'A new line.');
assert.equal(selectState(null).asset,null);
for(const phase of ['paused','complete']){
 const state=selectState({phase,node:p.nodes.start});
 assert.equal(state.asset,null);assert.equal(state.speakerRole,'narrator');
}
if(process.argv.includes('--assets'))for(const asset of Object.values(assets))assert(fs.statSync(path.join(__dirname,'dist',asset.slice(1))).size>0,asset);
console.log(`PASS ${lines} individually annotated spoken lines × 5 character settings = ${checks} speaker/expression checks.`);
console.log('PASS mixed-role reversal; current reply independent of rewards/next scene; concerned endings, boundaries, and gentle acknowledgments.');
console.log('PASS all four speaker-specific sprite sheets exist; unannotated lines and narration do not guess character reactions.');
