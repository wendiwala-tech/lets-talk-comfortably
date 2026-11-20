/* Logic and lightweight DOM integration checks; does not replace browser QA. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=name=>fs.readFileSync(path.join(__dirname,name),'utf8');
const config=JSON.parse(read('relationships.json'));
const support=JSON.parse(read('practice-support.json'));
const topics=['consent-boundaries','protection','preferences','sexual-health'];
const levelsSource=read('dist/assets/levels.js');
const storySource=read('dist/assets/story-app.js');
const comicSource=read('dist/assets/comic.js');
const storageKey='conversation-practice-path-v1';
const profiles=[
  {key:'woman-man',relationship:'woman-man',role:'woman'},
  {key:'man-woman',relationship:'woman-man',role:'man'},
  {key:'woman-woman',relationship:'woman-woman',role:'woman'},
  {key:'man-man',relationship:'man-man',role:'woman'},
  {key:'neutral',relationship:'neutral',role:'woman'}
];
const plain=value=>JSON.parse(JSON.stringify(value));

// Only the DOM operations used by these two scripts are implemented here.
class Element {
  constructor(tag,owner){this.tagName=tag.toUpperCase();this.owner=owner;this.children=[];this.attrs={};this.dataset={};this.style={};this.listeners={};this._text='';this.className='';this.parentNode=null;}
  get textContent(){return this._text+this.children.map(x=>x.textContent).join('');}
  set textContent(value){this._text=String(value);this.children=[];}
  append(...items){for(const item of items){assert(item instanceof Element,'Unexpected non-element DOM append');item.parentNode=this;this.children.push(item);}}
  replaceChildren(...items){for(const child of this.children)child.parentNode=null;this.children=[];this._text='';this.append(...items);}
  setAttribute(name,value){this.attrs[name]=String(value);if(name==='class')this.className=String(value);}
  getAttribute(name){return name==='class'?this.className:(this.attrs[name]??null);}
  get classList(){return{contains:name=>this.className.split(/\s+/).includes(name)};}
  addEventListener(type,callback){(this.listeners[type]??=[]).push(callback);}
  click(){assert(!this.disabled,'Attempted to click a disabled control');for(const fn of this.listeners.click||[])fn({target:this});}
  focus(){this.owner.activeElement=this;}
  querySelectorAll(selector){return descendants(this).filter(node=>matchesSelector(node,selector));}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
}
function descendants(node){return node.children.flatMap(child=>[child,...descendants(child)]);}
function matchesSimple(node,selector){
  const tag=selector.match(/^[a-z][a-z0-9-]*/i)?.[0];
  if(tag&&node.tagName!==tag.toUpperCase())return false;
  for(const [,name]of selector.matchAll(/\.([a-z0-9_-]+)/gi))if(!node.classList.contains(name))return false;
  for(const [,name,value]of selector.matchAll(/\[([a-z0-9_-]+)(?:="([^"]*)")?\]/gi)){
    const actual=node.getAttribute(name);if(actual===null||(value!==undefined&&actual!==value))return false;
  }
  if(selector.includes(':last-child')&&node.parentNode?.children.at(-1)!==node)return false;
  return true;
}
function matchesSelector(node,selector){
  const parts=selector.trim().split(/\s+/);if(!matchesSimple(node,parts.pop()))return false;
  let ancestor=node.parentNode;
  while(parts.length){const part=parts.pop();while(ancestor&&!matchesSimple(ancestor,part))ancestor=ancestor.parentNode;if(!ancestor)return false;ancestor=ancestor.parentNode;}
  return true;
}
function boot({store=new Map(),slug}={}){
  const document={activeElement:null,ids:{},createElement(tag){return new Element(tag,this);},getElementById(id){return this.ids[id]||null;},querySelectorAll(selector){return roots.flatMap(root=>[root,...descendants(root)]).filter(node=>matchesSelector(node,selector));},querySelector(selector){return this.querySelectorAll(selector)[0]||null;}};
  const roots=[];
  const make=(tag,id,text)=>{const n=document.createElement(tag);if(id)document.ids[id]=n;if(text!==undefined)n.textContent=text;roots.push(n);return n;};
  make('script','relationship-data',JSON.stringify(config));
  const images=['hero',...topics].map(topic=>{const n=make('img');n.dataset.topic=topic;n.setAttribute('data-topic',topic);n.setAttribute('src','/assets/initial.webp');return n;});
  let exercise,story;
  if(slug){story=JSON.parse(read(`stories/${slug}.json`));make('script','scenario-data',JSON.stringify({slug,story,support:support[slug]}));exercise=make('div','exercise');const setting=make('p');setting.setAttribute('data-story-setting','');make('p','practice-cast');}
  const ctx={window:{},document,sessionStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},localStorage:{setItem(){}}};
  vm.createContext(ctx);vm.runInContext(levelsSource,ctx);vm.runInContext(comicSource,ctx);
  return{api:ctx.window.PracticePath,ctx,document,exercise,images,store,story,start(){vm.runInContext(storySource,ctx);}};
}
function select(api,p){api.setRelationship(p.relationship);api.setMixedRole(p.role);}
function graph(s){return{entry:s.entry,nodeIDs:Object.keys(s.nodes),endingIDs:Object.keys(s.endings),nodes:Object.fromEntries(Object.entries(s.nodes).map(([id,n])=>[id,{round:n.round,phase:n.phase,next:n.choices.map(c=>c.next)}]))};}
function allStrings(value,location='$',result=[]){if(typeof value==='string')result.push([location,value]);else if(value&&typeof value==='object')for(const [k,v]of Object.entries(value))allStrings(v,`${location}.${k}`,result);return result;}
function verifyPaths(story){
  const paths=[];
  function visit(id,route=[]){if(story.endings[id]){assert.equal(route.length,6);paths.push([...route,id]);return;}assert(story.nodes[id],`Missing node ${id}`);assert(!route.includes(id),'Cycle');for(const c of story.nodes[id].choices)visit(c.next,[...route,id]);}
  visit(story.entry);return paths;
}

let stringChecks=0,pathChecks=0;
for(const slug of topics){
  const original=JSON.parse(read(`stories/${slug}.json`)),snapshot=JSON.stringify(original),originalStrings=allStrings(original),routes=verifyPaths(original);
  for(const p of profiles){
    const {api}=boot();select(api,p);const pair=config.profiles[p.key],copy=api.personalize(original);
    assert.notEqual(copy,original);assert.equal(JSON.stringify(original),snapshot,'Personalization mutated shared source');
    assert.deepEqual(plain(copy.characters.map(c=>c.name)),[pair.self.name,pair.partner.name]);
    assert.deepEqual(plain(graph(copy)),graph(original),`${slug}/${p.key}: graph changed`);
    const names=new Map(original.characters.map((c,i)=>[c.name,i===0?pair.self.name:pair.partner.name]));
    const actualStrings=new Map(allStrings(copy));
    for(const [location,text]of originalStrings){
      const expected=text.replace(/\b[A-Za-z]+\b/g,word=>names.get(word)??word);
      assert.equal(actualStrings.get(location),expected,`${slug}/${p.key}: wrong text at ${location}`);stringChecks++;
    }
    assert.deepEqual(verifyPaths(copy),routes);pathChecks+=routes.length;
  }
}

const expectedArt={
  'woman-man':new Set(['conversation-3d.webp','consent-3d.webp','protection-3d.webp','health-woman-man.webp']),
  'woman-woman':new Set(['preferences-3d.webp','consent-woman-woman.webp','protection-woman-woman.webp','health-woman-woman.webp']),
  'man-man':new Set(['health-3d.webp','consent-man-man.webp','protection-man-man.webp','preferences-man-man.webp'])
};
for(const [pair,art]of Object.entries(config.art)){
  assert(expectedArt[pair],`Unexpected art group ${pair}`);assert.deepEqual(Object.keys(art).sort(),['hero',...topics].sort());
  for(const file of Object.values(art)){assert(/^[a-z0-9-]+\.webp$/.test(file),`Unsafe filename ${file}`);assert(expectedArt[pair].has(file),`${pair}: wrong-pair art ${file}`);}
}
assert.deepEqual(Object.keys(config.art).sort(),Object.keys(expectedArt).sort());
for(const p of profiles){
  const run=boot(),{api}=run;select(api,p);api.setBaseline(4);api.setLevel(3);api.complete('preferences');api.updateIllustrations();
  const group=p.relationship==='neutral'?'woman-man':p.relationship;
  for(const img of run.images)assert.equal(img.getAttribute('src'),'/assets/'+config.art[group][img.dataset.topic]);
  const restored=boot({store:run.store}).api;assert.deepEqual(plain(restored.read()),plain(api.read()));assert.deepEqual(plain(restored.profile()),config.profiles[p.key]);
  assert.deepEqual(Object.keys(JSON.parse(run.store.get(storageKey))).sort(),['baseline','completed','level','mixedRole','relationship']);
  restored.clear();assert.equal(run.store.size,0);assert.equal(restored.read().relationship,'neutral');assert.equal(restored.read().mixedRole,'woman');assert.equal(restored.read().level,null);
}

// Exercise real story handlers: changing characters keeps current round, pending
// reply and accumulated history; the displayed ending adopts the chosen cast.
const find=(root,selector,text)=>{const result=root.querySelectorAll(selector).find(n=>text===undefined||n.textContent===text);assert(result,`Missing ${selector}: ${text}`);return result;};
function switchCast(run,p){
  const {exercise,api}=run;
  if(!exercise.querySelector('.relationship-picker'))find(exercise,'button','Change characters').click();
  find(exercise,'.relationship-choice',config.options.find(o=>o.id===p.relationship).label+config.options.find(o=>o.id===p.relationship).description).click();
  if(p.relationship==='woman-man')find(exercise,'.role-choice',p.role==='man'?'The man':'The woman').click();
  assert.equal(api.profile().self.name,config.profiles[p.key].self.name);
}
for(const slug of topics){
  const run=boot({slug});run.api.setLevel(2);run.start();assert(run.exercise.textContent.includes('Round 1 of 6'));assert.equal(run.exercise.querySelectorAll('.relationship-picker').length,0);assert.equal(run.exercise.querySelectorAll('.checkin-fieldset').length,0);
  let id=run.story.entry;const history=[];
  for(const p of profiles){
    switchCast(run,p);
    const comic=find(run.exercise,'.conversation-comic');
    assert.equal(comic.dataset.speakerSide,p.key==='man-woman'?'left':'right');
    assert.equal(find(comic,'.is-speaking').textContent,config.profiles[p.key].partner.name+'speaking');
    assert.equal(comic.dataset.expression,run.story.nodes[id].comicExpression);
  }
  // If a sprite fails, neither the empty illustration nor misleading cast labels remain.
  const failedComic=find(run.exercise,'.conversation-comic');
  for(const onerror of find(failedComic,'.comic-load-check').listeners.error)onerror();
  assert.equal(failedComic.dataset.artStatus,'missing');
  assert.equal(find(failedComic,'.comic-figure').hidden,true);
  assert(failedComic.textContent.includes(run.story.nodes[id].partner));
  for(let round=1;round<=2;round++){
    find(run.exercise,'.choice').click();history.push({id,index:0});id=run.story.nodes[id].choices[0].next;find(run.exercise,'button','Continue the conversation').click();
  }
  find(run.exercise,'.choice').click();
  for(const p of profiles){
    switchCast(run,p);
    assert(run.exercise.textContent.includes('Round 3 of 6'),`${slug}: cast change moved the round`);
    assert(run.exercise.textContent.includes('See how the conversation shifts.'),`${slug}: cast change lost pending reply`);
    const personalized=run.api.personalize(run.story);
    const comic=find(run.exercise,'.conversation-comic');
    const side=p.key==='man-woman'?'left':'right';
    assert.equal(comic.dataset.speakerSide,side,`${slug}/${p.key}: wrong person is speaking after role switch`);
    assert.equal(find(comic,'.speaker-name').textContent,config.profiles[p.key].partner.name,'Bubble name must be the partner');
    assert.equal(find(comic,'.is-speaking').textContent,config.profiles[p.key].partner.name+'speaking','Active figure must match the bubble');
    assert.equal(comic.dataset.expression,personalized.nodes[id].choices[0].comicExpression,'Pending reply must keep its expression');
    assert.equal(find(run.exercise,'.story-speech.self').textContent,personalized.characters[0].name+personalized.nodes[id].choices[0].label);
    const articles=run.exercise.querySelectorAll('.story-history article');assert.equal(articles.length,2);
    history.forEach((rec,i)=>{const c=personalized.nodes[rec.id].choices[rec.index];assert(articles[i].textContent.includes(c.label));assert(articles[i].textContent.includes(c.response));});
    assert.equal(run.document.querySelector('[data-story-setting]').textContent,personalized.setting);
  }
  id=run.story.nodes[id].choices[0].next;find(run.exercise,'button','Continue the conversation').click();
  while(run.story.nodes[id]){const n=run.story.nodes[id];find(run.exercise,'.choice').click();id=n.choices[0].next;find(run.exercise,'button',run.story.endings[id]?'See this ending':'Continue the conversation').click();}
  for(const p of profiles){switchCast(run,p);const personalized=run.api.personalize(run.story);assert.equal(find(run.exercise,'.ending-summary').textContent,personalized.endings[id].summary);assert.equal(run.exercise.querySelectorAll('.story-history article').length,6);assert(run.exercise.textContent.includes('Six-round story complete'));}
  assert.deepEqual(Array.from(run.api.read().completed),[slug]);
}

const missing=[...new Set(Object.values(config.art).flatMap(art=>Object.values(art)))].filter(file=>!fs.existsSync(path.join(__dirname,'dist/assets',file)));
if(process.argv.includes('--assets'))assert.deepEqual(missing,[],'Missing final relationship art; copy assets before final verification');
console.log(`PASS relationships: 4 topics × 5 profiles; ${stringChecks} nested strings; ${pathChecks} six-round paths unchanged.`);
console.log('PASS runtime cast changes: setting, pending reply, history and ending update; round, route, level and completion remain intact.');
console.log('PASS relationship persistence/reset and all 3 pair-art maps (hero + all 4 topics).');
console.log(missing.length?`Asset copy pending (${missing.length}); rerun with --assets after integration.`:'PASS all referenced relationship image files exist.');
