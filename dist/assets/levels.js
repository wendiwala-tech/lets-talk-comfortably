(() => {
  'use strict';
  const key='conversation-practice-path-v1';
  const levels=[
    {id:1,name:'Warm up',description:'A little backup: see a coaching tip before each reply.',emoji:'🌱'},
    {id:2,name:'Find your flow',description:'Choose your words, with a hint nearby if you want it.',emoji:'💬'},
    {id:3,name:'Try it solo',description:'Make your choice first. Unpack the reasoning afterward.',emoji:'✨'}
  ];
  const feelings=[
    {value:1,emoji:'🙂',label:'Pretty comfortable'},
    {value:2,emoji:'😅',label:'A little awkward'},
    {value:3,emoji:'🙃',label:'Getting tongue-tied'},
    {value:4,emoji:'🫣',label:'Hard to start'},
    {value:5,emoji:'🫠',label:'Words are buffering'}
  ];
  const relationshipData=JSON.parse(document.getElementById('relationship-data')?.textContent||'{"options":[],"profiles":{},"art":{}}');
  const validRelationships=['woman-man','woman-woman','man-man','neutral'];
  const blank=()=>({level:null,baseline:null,completed:[],relationship:'neutral',mixedRole:'woman'});
  let memory=blank();
  try{const s=JSON.parse(sessionStorage.getItem(key)||'null');if(s&&[1,2,3,null].includes(s.level)&&[1,2,3,4,5,null].includes(s.baseline)&&Array.isArray(s.completed))memory={relationship:validRelationships.includes(s.relationship)?s.relationship:'neutral',mixedRole:s.mixedRole==='man'?'man':'woman',level:s.level,baseline:s.baseline,completed:s.completed.filter(x=>['consent-boundaries','protection','preferences','sexual-health'].includes(x))};}catch(_){}
  const read=()=>({...memory,completed:[...memory.completed]});
  const write=value=>{memory=value;try{sessionStorage.setItem(key,JSON.stringify(memory));}catch(_){}return read();};
  const recommend=v=>v>=4?1:v>=2?2:3;
  const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
  const button=(text,action,cls)=>{const b=el('button',text,cls);b.type='button';b.addEventListener('click',action);return b;};
  function emoji(text,cls='checkin-emoji'){const span=el('span',text,cls);span.setAttribute('aria-hidden','true');return span;}
  function checkin({selected,onSelect,prompt='How awkward does starting a sexual-health conversation feel right now?'}){
    const field=el('fieldset',undefined,'checkin-fieldset');field.append(el('legend',prompt));const scale=el('div',undefined,'checkin-scale');
    feelings.forEach(f=>{const b=button('',()=>onSelect(f.value),'checkin-choice');b.setAttribute('aria-pressed',String(selected===f.value));b.append(emoji(f.emoji),el('strong',f.label));scale.append(b);});field.append(scale);return field;
  }
  function picker(selected,onSelect){const wrap=el('div',undefined,'level-grid');levels.forEach(l=>{const b=button('',()=>onSelect(l.id),'level-card');b.setAttribute('aria-pressed',String(l.id===selected));b.append(el('span',`Level ${l.id}`,'level-number'),el('strong',`${l.emoji} ${l.name}`,'level-name'),el('span',l.description,'level-description'));if(l.id===selected)b.append(el('span','Your current choice','level-status'));wrap.append(b);});return wrap;}
  function profile(){const p=read();const key=p.relationship==='woman-man'&&p.mixedRole==='man'?'man-woman':p.relationship;return relationshipData.profiles[key];}
  function relationshipPicker(onChange){
    const p=read(),box=el('section',undefined,'relationship-picker');box.append(el('h4','Who is in this conversation?'),el('p','Choose the characters you want to practice with. Every option works in every topic.','relationship-note'));
    const grid=el('div',undefined,'relationship-options');relationshipData.options.forEach(option=>{const b=button('',()=>{api.setRelationship(option.id);onChange('relationship');},'relationship-choice');b.setAttribute('aria-pressed',String(option.id===p.relationship));b.append(el('strong',option.label),el('span',option.description));grid.append(b);});box.append(grid);
    if(p.relationship==='woman-man'){const group=el('fieldset',undefined,'character-role');group.append(el('legend','Which character would you like to play?'));for(const role of ['woman','man']){const b=button(role==='woman'?'The woman':'The man',()=>{api.setMixedRole(role);onChange('role');},'role-choice');b.setAttribute('aria-pressed',String(role===p.mixedRole));group.append(b);}box.append(group);}
    const pair=profile();if(pair)box.append(el('p',`${pair.self.name} (${pair.self.pronouns}) is your character. ${pair.partner.name} (${pair.partner.pronouns}) is the partner.`,'relationship-summary'));return box;
  }
  function updateIllustrations(){
    const selected=read().relationship,group=selected==='neutral'?'woman-man':selected,art=relationshipData.art[group];if(!art)return;
    document.querySelectorAll('img[data-topic]').forEach(img=>{const topic=img.dataset.topic,file=art[topic];if(!file)return;const src='/assets/'+file;if(img.getAttribute('src')!==src)img.setAttribute('src',src);const square=file==='conversation-3d.webp';img.width=square?1254:1400;img.height=square?1254:933;img.style.objectPosition='center top';if(!img.classList.contains('scenario-thumb')){const who=selected==='woman-woman'?'Two women':selected==='man-man'?'Two men':selected==='woman-man'?'A woman and a man':'Two adult characters';img.alt=`3D illustration: ${who} having a conversation.`;}});
  }
  function personalize(source){
    const pair=profile();if(!pair)return source;
    const original=source.characters.map(c=>c.name),names=[pair.self.name,pair.partner.name];const pattern=new RegExp('\\b('+original.join('|')+')\\b','g');
    function convert(value){if(typeof value==='string')return value.replace(pattern,name=>names[original.indexOf(name)]);if(Array.isArray(value))return value.map(convert);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,convert(v)]));return value;}
    const result=convert(source);result.characters[0].name=pair.self.name;result.characters[1].name=pair.partner.name;return result;
  }
  const api={levels,feelings,read,recommend,checkin,picker,el,button,profile,relationshipPicker,updateIllustrations,personalize,
    setRelationship:r=>write({...read(),relationship:validRelationships.includes(r)?r:'neutral'}),
    setMixedRole:r=>write({...read(),mixedRole:r==='man'?'man':'woman'}),
    setLevel:l=>write({...read(),level:l}),
    setBaseline:v=>write({...read(),baseline:v,level:recommend(v)}),
    complete:slug=>write({...read(),completed:[...new Set([...read().completed,slug])]}),
    clear:()=>{memory=blank();try{sessionStorage.removeItem(key);}catch(_){}}
  };
  window.PracticePath=api;
  const home=document.getElementById('practice-path');
  function renderHome(){
    if(!home)return;home.replaceChildren();const p=read();updateIllustrations();
    home.append(relationshipPicker(kind=>{renderHome();home.querySelector(kind==='role'?'.role-choice[aria-pressed="true"]':'.relationship-choice[aria-pressed="true"]')?.focus({preventScroll:true});}));
    home.append(checkin({selected:p.baseline,onSelect:v=>{api.setBaseline(v);renderHome();home.querySelector('.checkin-choice[aria-pressed="true"]')?.focus({preventScroll:true});}}));
    const result=el('p',p.baseline?`A place to start: Level ${recommend(p.baseline)}. Pick any level that feels useful today.`:'Pick a feeling for a suggested starting point, or choose a level below.','checkin-result');result.setAttribute('role','status');home.append(result,picker(p.level,l=>{api.setLevel(l);renderHome();home.querySelector('.level-card[aria-pressed="true"]')?.focus({preventScroll:true});}));
    home.append(el('p','These are practice settings. You can change them whenever you like.','path-note'));
    const actions=el('div',undefined,'path-actions');const a=el('a',p.level?`Explore stories at Level ${p.level}`:'Explore the four stories','button primary');a.href='#scenarios';actions.append(a);if(p.level||p.completed.length||p.relationship!=='neutral')actions.append(button('Clear my practice path',()=>{api.clear();renderHome();home.querySelector('.checkin-choice')?.focus({preventScroll:true});},'plain-button path-reset'));home.append(actions);
    home.append(el('p',`${p.completed.length} of 4 stories explored in this tab. Your selections are not uploaded.`,'path-progress'));
  }
  renderHome();
  updateIllustrations();
})();
