(() => {
  const appearance = document.getElementById('appearance');
  if (appearance) {
    appearance.value = document.documentElement.dataset.theme || 'warm';
    appearance.addEventListener('change', () => {
      document.documentElement.dataset.theme = appearance.value;
      try {localStorage.setItem('reading-style', appearance.value);} catch (_) {}
    });
  }
  const raw = document.getElementById('scenario-data');
  const root = document.getElementById('exercise');
  if (!raw || !root) return;
  const scenario = JSON.parse(raw.textContent);
  const state = {step:0,opening:null,response:null,followup:null};
  const el = (tag,text,cls) => {const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
  const button = (label,action,cls='choice') => {const b=el('button',label,cls);b.type='button';b.addEventListener('click',action);return b;};
  function note(title,body){const n=el('div',undefined,'feedback');n.append(el('h4',title),el('p',body));return n;}
  function transcript(items){const ul=el('ul',undefined,'transcript');items.forEach(([who,line])=>{const li=el('li');li.append(el('small',who),el('p',line));ul.append(li);});return ul;}
  function render(moveFocus=true){
    root.replaceChildren();
    const steps=el('ol',undefined,'steps');steps.setAttribute('aria-label','Practice progress');
    ['Choose an opening','Explore a response','Find your next words'].forEach((label,i)=>{const li=el('li',`${i+1}. ${label}`,state.step===i?'current':state.step>i?'done':'');if(state.step===i)li.setAttribute('aria-current','step');steps.append(li);});root.append(steps);
    let title;
    if(state.step===0){
      title=el('h3','How might you begin?','stage-title');root.append(title,el('p','Choose an opening to explore. Both are examples you can adapt.','stage-copy'));
      const choices=el('div',undefined,'choices');scenario.practice.openings.forEach((o,i)=>choices.append(button(o.label,()=>{state.opening=i;state.step=1;render();})));root.append(choices);
    }else if(state.step===1){
      const opening=scenario.practice.openings[state.opening];title=el('h3','Explore a possible response.','stage-title');root.append(title,transcript([['Your opening',opening.label]]),note('What this opening does',opening.note),el('p','Choose what to explore next. An opening does not guarantee a particular reaction.','stage-copy'));
      const choices=el('div',undefined,'choices');scenario.practice.responses.forEach((r,i)=>choices.append(button(r.label,()=>{state.response=i;state.step=2;render();})));root.append(choices,button('Choose another opening',()=>{state.step=0;render();},'plain-button'));
    }else if(state.step===2){
      const r=scenario.practice.responses[state.response];title=el('h3','What could you say next?','stage-title');root.append(title,transcript([['Your opening',scenario.practice.openings[state.opening].label],['A possible partner response',r.reply]]),el('p','Choose a follow-up to read why the wording may be useful.','stage-copy'));
      const choices=el('div',undefined,'choices');r.followups.forEach((f,i)=>choices.append(button(f.label,()=>{state.followup=i;state.step=3;render();})));root.append(choices,button('Explore the other partner response',()=>{state.step=1;render();},'plain-button'));
    }else{
      const r=scenario.practice.responses[state.response],f=r.followups[state.followup];root.append(el('p','Practice complete','completed'));title=el('h3','A conversation to reflect on.','stage-title');root.append(title,transcript([['Your opening',scenario.practice.openings[state.opening].label],['A possible partner response',r.reply],['Your follow-up',f.label]]),note('Why this wording may help',f.feedback),el('p','There is no score. Keep the language that fits you, and leave what does not.','stage-copy'));
      const actions=el('div',undefined,'exercise-actions');actions.append(button('Try another follow-up',()=>{state.step=2;render();},'button secondary'));const a=el('a','Find campus resources','button primary');a.href='#support';actions.append(a);root.append(actions,button('Start this scenario again',()=>{state.step=0;state.opening=state.response=state.followup=null;render();},'plain-button'));
    }
    title.tabIndex=-1;
    if(moveFocus)title.focus();
  }
  render(false);
})();
