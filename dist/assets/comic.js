(() => {
  'use strict';

  // Expressions describe this exact spoken line, never the user's score or next round.
  const expressions = [
    {key:'hesitant', description:'speaking hesitantly, with a hand near their chest'},
    {key:'asking', description:'asking a question, with a small palm-up gesture'},
    {key:'concerned', description:'speaking with a concerned expression and hands resting low'},
    {key:'explaining', description:'calmly explaining with a low open-palm gesture'},
    {key:'boundary', description:'calmly setting a limit, with a small upright open palm'},
    {key:'warm', description:'responding warmly, with a small smile'}
  ];
  const positions = ['0% 0%','100% 0%','0% 50%','100% 50%','0% 100%','100% 100%'];
  const assets = {
    'mixed-woman':'/assets/comic-speaker-mixed-woman.webp',
    'mixed-man':'/assets/comic-speaker-mixed-man.webp',
    'women-right':'/assets/comic-speaker-women-right.webp',
    'men-right':'/assets/comic-speaker-men-right.webp'
  };
  function castFor(relationship='neutral',mixedRole='woman') {
    if(relationship === 'woman-woman')return {pair:'women',art:'women-right',side:'right'};
    if(relationship === 'man-man')return {pair:'men',art:'men-right',side:'right'};
    // PracticePath stores woman-man plus mixedRole, not man-woman.
    if(relationship === 'man-woman' || (relationship === 'woman-man' && mixedRole === 'man'))
      return {pair:'mixed',art:'mixed-woman',side:'left'};
    return {pair:'mixed',art:'mixed-man',side:'right'};
  }
  function selectState(options = {}) {
    const {story,node,choice,phase=choice?'feedback':'choice',relationship='neutral',mixedRole='woman',selfName,partnerName} = options || {};
    const cast=castFor(relationship,mixedRole);
    const self=selfName || story?.characters?.[0]?.name || 'Your character';
    const partner=partnerName || story?.characters?.[1]?.name || 'Partner';
    const narration=phase==='paused'||phase==='complete';
    const line=phase==='feedback'&&choice?choice:node;
    // Unmapped lines keep their text, without inventing a reaction. Validation
    // requires every production utterance to have an explicit editorial mapping.
    const frame=expressions.findIndex(expression=>expression.key===line?.comicExpression);
    const expression=expressions[frame];
    const source=Object.keys(story?.nodes||{}).find(key=>story.nodes[key]===node ||
      (story.nodes[key].round===node?.round && story.nodes[key].title===node?.title))||'';
    const dialogue=narration
      ? (phase==='paused'?'This conversation can wait until you are ready.':'A conversation can finish without deciding everything.')
      : (phase==='feedback'&&choice ? choice.response : node?.partner) || '';
    return {
      frame:narration?-1:frame, expression:narration?'narration':expression?.key||'unmapped',
      pair:cast.pair, asset:!narration&&expression?assets[cast.art]:null,
      position:positions[frame], speakerSide:cast.side,
      leftName:cast.side==='left'?partner:self,
      rightName:cast.side==='right'?partner:self,
      source, destination:choice?.next||'', dialogue,
      speaker:narration?'Take your time':partner,
      speakerRole:narration?'narrator':'partner',
      description:expression&&!narration
        ? `${partner}, on the ${cast.side}, is ${expression.description}. ${self} listens with hands resting.`
        : ''
    };
  }
  function el(tag,text,cls) {
    const element=document.createElement(tag);
    if(text!==undefined)element.textContent=text;
    if(cls)element.className=cls;
    return element;
  }
  function render(options = {}) {
    const state=selectState(options);
    const section=el('section',undefined,'conversation-comic');
    section.dataset.frame=String(state.frame);
    section.dataset.expression=state.expression;
    section.dataset.relationship=state.pair;
    section.dataset.speakerSide=state.speakerSide;
    section.dataset.speakerRole=state.speakerRole;
    section.dataset.artStatus=state.asset?'loading':'none';
    section.setAttribute('aria-label','A moment in the conversation');
    const bubble=el('div',undefined,'story-speech comic-bubble');
    if(state.asset){
      const figure=el('div',undefined,'comic-figure');
      const art=el('div',undefined,'comic-art');
      art.setAttribute('role','img');
      art.setAttribute('aria-label',state.description);
      art.style.backgroundImage=`url("${state.asset}")`;
      art.style.backgroundPosition=state.position;
      const names=el('div',undefined,'comic-cast');
      names.setAttribute('aria-hidden','true');
      for(const [side,name]of [['left',state.leftName],['right',state.rightName]]){
        const active=side===state.speakerSide;
        const label=el('span',name,active?'comic-person is-speaking':'comic-person');
        if(active)label.append(el('small','speaking'));
        names.append(label);
      }
      const image=el('img',undefined,'comic-load-check');
      image.alt='';image.hidden=true;
      image.addEventListener('load',()=>{section.dataset.artStatus='ready';});
      image.addEventListener('error',()=>{section.dataset.artStatus='missing';figure.hidden=true;});
      image.src=state.asset;
      art.append(image);figure.append(art,names);bubble.append(figure);
    }
    bubble.append(el('span',state.speaker,'speaker-name'),el('p',state.dialogue));
    section.append(bubble);
    return section;
  }
  window.ConversationComic={render,selectState,castFor,expressions,assets};
})();
