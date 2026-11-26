(() => {
  'use strict';
  const appearance=document.getElementById('appearance');
  if(appearance){appearance.value=document.documentElement.dataset.theme||'warm';appearance.addEventListener('change',()=>{document.documentElement.dataset.theme=appearance.value;try{localStorage.setItem('reading-style',appearance.value);}catch(_){}});}
  const raw=document.getElementById('scenario-data'),root=document.getElementById('exercise'),path=window.PracticePath;
  if(!raw||!root||!path)return;
  const scenario=JSON.parse(raw.textContent),support=scenario.support;
  let story=path.personalize(scenario.story);
  const state={node:story.entry,history:[],pending:null,paused:false,reflection:null,after:null,before:path.read().baseline,showLevels:false,showRelationships:false,micro:{}};
  const el=path.el,btn=path.button;
  let speaker=story.characters[0].name,partner=story.characters[1].name;
  function currentLevel(){return path.read().level||1;}
  function focus(title,move){
    title.tabIndex=-1;
    if(!move)return;
    title.focus({preventScroll:true});
    // Keep the exercise in place between replies; only recover an off-screen heading.
    if(typeof title.getBoundingClientRect==='function'){
      const rect=title.getBoundingClientRect(),height=window.innerHeight;
      if(height&&(rect.top<12||rect.top>height-100))root.scrollIntoView({block:'start',behavior:'auto'});
    }
  }
  function firstSentence(text){return text.match(/^(.+?[.!?])(?:\s|$)/)?.[1]||text;}
  function more(label,...children){const d=el('details',undefined,'practice-details');d.append(el('summary',label),...children);return d;}
  function contextDetails(node){
    const d=more('Scene, coaching & a tiny side quest',el('p',node.situation,'story-situation'));
    d.append(el('p',support[node.round-1].hint,'coach-hint'),microDetails(node));return d;
  }
  function setNode(node){state.node=node;state.pending=null;state.reflection=null;render();}
  function restart(){Object.assign(state,{node:story.entry,history:[],pending:null,paused:false,reflection:null,after:null,before:path.read().baseline,micro:{},showLevels:false});render();}
  function rewind(index){const rec=state.history[index];state.node=rec.node;state.history=state.history.slice(0,index);state.pending=null;state.reflection=null;state.after=null;state.micro={};render();}
  function speech(who,line,cls=''){const d=el('div',undefined,'story-speech '+cls);d.append(el('span',who,'speaker-name'),el('p',line));return d;}
  function illustratedSpeech(node,choice=null){
    if(!window.ConversationComic)return speech(partner,choice?choice.response:node.partner);
    const settings=path.read();
    return window.ConversationComic.render({slug:scenario.slug,story,node,choice,phase:choice?'feedback':'choice',relationship:settings.relationship,mixedRole:settings.mixedRole,selfName:speaker,partnerName:partner});
  }
  function feedback(title,body){const box=el('section',undefined,'feedback story-feedback');box.append(el('h4',title),el('p',body));return box;}
  function historyPanel(){
    if(!state.history.length)return null;
    const d=el('details',undefined,'story-history');d.append(el('summary',`Review your conversation (${state.history.length} ${state.history.length===1?'choice':'choices'})`));
    state.history.forEach((rec,i)=>{const node=story.nodes[rec.node],choice=node.choices[rec.choice];const article=el('article');article.append(el('h4',`Round ${node.round} · ${node.title}`));if(node.partner)article.append(speech(partner,node.partner));article.append(speech(speaker,choice.label,'self'),speech(partner,choice.response),el('p',choice.explanation,'history-explanation'),btn('Change this choice',()=>rewind(i),'plain-button'));d.append(article);});return d;
  }
  function levelBanner(target=root){
    const level=path.levels[currentLevel()-1],wrap=el('div',undefined,'level-banner');wrap.append(el('strong',`Level ${level.id} · ${level.name}`),btn(state.showLevels?'Close settings':'Change level',()=>{state.showLevels=!state.showLevels;render(false);root.querySelector(state.showLevels?'.level-picker .level-card[aria-pressed="true"]':'.level-banner button')?.focus({preventScroll:true});},'plain-button'));
    wrap.append(btn(state.showRelationships?'Close characters':'Change characters',()=>{state.showRelationships=!state.showRelationships;render(false);root.querySelector(state.showRelationships?'.relationship-choice[aria-pressed="true"]':'.level-banner button:last-child')?.focus({preventScroll:true});},'plain-button'));
    target.append(wrap);if(state.showRelationships)target.append(path.relationshipPicker(kind=>{render(false);root.querySelector(kind==='role'?'.role-choice[aria-pressed="true"]':'.relationship-choice[aria-pressed="true"]')?.focus({preventScroll:true});}));if(state.showLevels){const panel=el('div',undefined,'level-picker');panel.append(path.picker(currentLevel(),id=>{path.setLevel(id);state.showLevels=false;render(false);root.querySelector('.level-banner button')?.focus({preventScroll:true});}),el('p','Your place in the story stays the same.','path-note'));target.append(panel);}
  }
  function progress(node){
    const block=el('div',undefined,'story-progress'),top=el('div',undefined,'progress-label');const round=node?.round||6;
    top.append(el('span',node?`Round ${round} of 6`:'Six-round story complete'),el('span',node?.phase||'Reflection'));
    const bar=el('progress');bar.max=6;bar.value=node?Math.max(0,round-1):6;bar.setAttribute('aria-label','Story progress');block.append(top,bar);return block;
  }
  function microCard(node){
    const item=support[node.round-1],card=el('section',undefined,'micro-card');card.append(el('p','A tiny side quest','micro-kicker'),el('h4',item.title,'micro-title'),el('p',item.prompt,'micro-prompt'));
    const options=el('div',undefined,'micro-options'),response=el('p','','micro-response');response.setAttribute('role','status');const selected=state.micro[state.node];
    item.choices.forEach((choice,i)=>{const b=btn(choice.label,()=>{state.micro[state.node]=i;for(const child of options.children)child.setAttribute('aria-pressed','false');b.setAttribute('aria-pressed','true');response.textContent=choice.response;},'micro-choice');b.setAttribute('aria-pressed',String(selected===i));options.append(b);});if(selected!==undefined)response.textContent=item.choices[selected].response;card.append(options,response);return card;
  }
  function microDetails(node){const d=el('details',undefined,'micro-toggle');d.append(el('summary','Try a tiny side quest 🎲'),microCard(node));return d;}
  function afterCheckin(){
    const box=el('section',undefined,'after-checkin');box.append(el('h4','An optional check-out'),el('p','No target feeling. Notice where you are now.','path-note'));
    const result=el('p','','checkin-result');result.setAttribute('role','status');
    function update(v){state.after=v;for(const b of box.querySelectorAll('.checkin-choice'))b.setAttribute('aria-pressed','false');const i=path.feelings.findIndex(f=>f.value===v);box.querySelectorAll('.checkin-choice')[i].setAttribute('aria-pressed','true');const now=path.feelings[i].label;const before=path.feelings.find(f=>f.value===state.before)?.label;result.textContent=before?`Before: ${before}. Now: ${now}. This is your own check-in; take the next step at your pace.`:`Right now: ${now}. You can repeat this level or try a different amount of support.`;}
    box.append(path.checkin({selected:state.after,onSelect:update,prompt:'How does starting this conversation feel after practicing?'}),result);if(state.after)update(state.after);return box;
  }
  function clickReflection(){
    const box=el('section',undefined,'click-reflection');box.append(el('h4','What would you like to keep practicing?'),el('p','Pick one small focus. No essay required. 📝✨','path-note'));
    const items=[['Getting the first words out','Try an opening from this story again. A short, clear first sentence is enough to begin.'],['Clearing up a misunderstanding','Revisit round three and explore another way to explain what you mean.'],['Respecting different needs','Revisit round four. Notice how a pause or different plans can still be a useful outcome.']];const options=el('div',undefined,'reflection-options'),response=el('p','','reflection-response');response.setAttribute('role','status');items.forEach(([label,text],i)=>{const b=btn(label,()=>{state.reflection=i;for(const child of options.children)child.setAttribute('aria-pressed','false');b.setAttribute('aria-pressed','true');response.textContent=text;},'reflection-choice');b.setAttribute('aria-pressed',String(state.reflection===i));options.append(b);});if(state.reflection!==null)response.textContent=items[state.reflection][1];box.append(options,response);return box;
  }
  function render(move=true){
    story=path.personalize(scenario.story);speaker=story.characters[0].name;partner=story.characters[1].name;path.updateIllustrations();
    const setting=document.querySelector('[data-story-setting]'),cast=document.getElementById('practice-cast'),pair=path.profile();if(setting)setting.textContent=story.setting;if(cast&&pair)cast.textContent=`Your character: ${speaker} (${pair.self.pronouns}) · Partner: ${partner} (${pair.partner.pronouns})`;
    root.replaceChildren();let title;
    root.dataset.stage=state.paused?'paused':story.endings[state.node]?'complete':state.pending!==null?'feedback':'choice';
    if(state.paused){title=el('h3','Take a moment.','stage-title');root.append(title,el('p','No countdown, no lost points. Your conversation will be here when you are ready. ☕','stage-copy'));const actions=el('div',undefined,'exercise-actions');actions.append(btn('Resume practice',()=>{state.paused=false;render();},'button primary'));const a=el('a','Find support','button secondary');a.href='#support';actions.append(a);root.append(actions);focus(title,move);return;}
    const node=story.nodes[state.node],ending=story.endings[state.node];if(!ending)levelBanner();root.append(progress(node));
    if(ending){
      path.complete(scenario.slug);title=el('h3','Story complete. Something to keep.','stage-title ending-title');root.append(title);
      const endingNotes=el('section',undefined,'ending-overview');endingNotes.append(el('h4','Your ending: '+ending.title),el('p',ending.summary,'ending-summary'));
      const take=el('section',undefined,'ending-takeaways');take.append(el('h4','What to take from this conversation'));const ul=el('ul');ending.takeaways.forEach(t=>ul.append(el('li',t)));take.append(ul);
      // Put the outcome and learning in view before the optional keepsake and check-out.
      root.append(endingNotes,take,clickReflection());
      if(window.ConversationReward)root.append(window.ConversationReward.render({story,history:state.history,slug:scenario.slug}));
      root.append(more('Optional check-out: notice how you feel',afterCheckin()));
      const next=el('section',undefined,'next-level-box');next.append(el('h4',currentLevel()<3?'Ready for a little less support?':'Keep the conversation going.'));next.append(el('p',currentLevel()<3?'Try the next level when you feel ready, or repeat this one. Finishing a story is practice, not a test of readiness.':'Try another topic, revisit a tricky turn, or return to a more guided level.'));
      const a=el('a',currentLevel()<3?`Explore stories at Level ${currentLevel()+1}`:'Explore another story','button primary');a.href='/#scenarios';a.addEventListener('click',()=>{if(currentLevel()<3)path.setLevel(currentLevel()+1);});next.append(a);root.append(next);
      const settings=more('Characters & practice support');settings.open=state.showRelationships||state.showLevels;levelBanner(settings);root.append(settings);
      const history=historyPanel();if(history)root.append(history);const actions=el('div',undefined,'exercise-actions');actions.append(btn('Try another ending',()=>rewind(state.history.length-1),'button secondary'),btn('Restart this story',restart,'button secondary'));const resources=el('a','Explore campus resources','button secondary');resources.href='#support';actions.append(resources);root.append(actions);focus(title,move);return;
    }
    if(state.pending!==null){
      const choice=node.choices[state.pending];title=el('h3','See how the conversation shifts.','stage-title');root.append(title,illustratedSpeech(node,choice));
      if(currentLevel()!==3)root.append(feedback('What this choice does',firstSentence(choice.explanation)));
      root.append(el('p',support[node.round-1].humor,'micro-humor'));
      const actions=el('div',undefined,'exercise-actions');actions.append(btn(story.endings[choice.next]?'See this ending':'Continue the conversation',()=>{state.history.push({node:state.node,choice:state.pending});setNode(choice.next);},'button primary'),btn('Try different wording',()=>{state.pending=null;render();},'button secondary'));root.append(actions);
      root.append(more(currentLevel()===3?'Unpack this choice 🔍':'Your wording & the full explanation',speech(speaker,choice.label,'self'),feedback('Why this wording matters',choice.explanation),microDetails(node)));
    }else{
      title=el('h3',node.title,'stage-title');root.append(title);if(node.partner)root.append(illustratedSpeech(node));
      if(currentLevel()===1){root.append(el('p',firstSentence(support[node.round-1].hint),'coach-preview'));}
      else if(currentLevel()===2){const d=el('details',undefined,'micro-toggle');d.append(el('summary','A hint, please 💡'),el('p',support[node.round-1].hint,'coach-hint'));root.append(d);}
      else root.append(el('p','Your turn. Pick a reply, then explore what it does. 🎯','path-note'));
      root.append(el('p',node.prompt,'choice-prompt'));const choices=el('div',undefined,'choices');node.choices.forEach((choice,i)=>choices.append(btn(choice.label,()=>{state.pending=i;render();},'choice')));root.append(choices);
      root.append(contextDetails(node));
    }
    const history=historyPanel();if(history)root.append(history);root.append(btn('Pause practice',()=>{state.paused=true;render();},'plain-button'));focus(title,move);
  }
  render(false);
})();
