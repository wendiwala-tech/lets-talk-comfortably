(() => {
  'use strict';

  const expressions = [
    {key:'opening', description:'getting ready to begin, with a little nervousness'},
    {key:'listening', description:'listening attentively while leaving each other space'},
    {key:'uncertain', description:'pausing with a gentle, questioning expression'},
    {key:'clarifying', description:'calmly explaining and making room for questions'},
    {key:'pause', description:'respecting a pause and leaving a little more space'},
    {key:'acknowledging', description:'acknowledging the conversation without assuming what happens next'}
  ];
  const positions = ['0% 0%','100% 0%','0% 50%','100% 50%','0% 100%','100% 100%'];
  const assets = {
    mixed:'/assets/comic-pair-mixed.webp',
    women:'/assets/comic-pair-women.webp',
    men:'/assets/comic-pair-men.webp'
  };
  // These states describe this story moment. A concerned response is not a verdict
  // on either person's character or on whether an earlier request was valid.
  const nodeFrames = {
    'consent-boundaries': {
      earlier_yes:2, reassurance_misread:2, guessing_repair:2, vague_checkin:2,
      uncertain_needs:4, plan_space:4, decision_space:4,
      plan_talk:1, decision_talk:1, decision_later:3
    },
    protection: {
      vague_question:2, trust_misunderstanding:2, judgment_repair:2,
      agreement_assumed:2, missing_supplies:2,
      plan_no_sex:4, decision_space:4, plan_information:3,
      decision_plan:3, decision_company:1
    },
    preferences: {
      repair_opening:2, misread:2, silence:2, pressure:2, unresolved_decision:2,
      take_space:4, pause_decision:4, try_plan:3, shared_decision:3
    },
    'sexual-health': {
      trust:2, privacy:2, uncertain_agreement:2, repair_pressure:2,
      separate_step:4, waiting_decision:4, unresolved_decision:2,
      information_decision:3, resource_step:3
    }
  };
  const pauseEndings = {
    'consent-boundaries':new Set(['ending_space','ending_later']),
    protection:new Set(['ending_pause']),
    preferences:new Set(['pause','different_needs']),
    'sexual-health':new Set(['pause','different_needs'])
  };
  const phaseFrames = {Opening:0,Clarifying:1,Misunderstanding:2,'Different needs':1,'Next steps':3,Decision:5};

  function pairFor(relationship) {
    if(relationship === 'woman-woman' || relationship === 'women')return 'women';
    if(relationship === 'man-man' || relationship === 'men')return 'men';
    return 'mixed';
  }
  function nodeKey(story,node) {
    if(!node || typeof node !== 'object')return '';
    if(typeof node.id === 'string')return node.id;
    return Object.keys(story?.nodes || {}).find(key => story.nodes[key] === node ||
      (story.nodes[key].round === node.round && story.nodes[key].title === node.title)) || '';
  }
  function endingKey(story,ending) {
    if(typeof ending === 'string')return ending;
    if(!ending || typeof ending !== 'object')return '';
    return Object.keys(story?.endings || {}).find(key => story.endings[key] === ending ||
      story.endings[key].title === ending.title) || '';
  }
  function selectState(options = {}) {
    const {slug='',story,node,choice,phase=choice?'feedback':'choice',relationship='neutral',ending,selfName,partnerName} = options || {};
    const pair = pairFor(relationship);
    const self = selfName || story?.characters?.[0]?.name || 'Your character';
    const partner = partnerName || story?.characters?.[1]?.name || 'Partner';
    const source = nodeKey(story,node);
    const tags = Array.isArray(choice?.moveTags) ? choice.moveTags : [];
    let frame = nodeFrames[slug]?.[source] ?? phaseFrames[node?.phase] ?? 0;
    let dialogue = typeof node?.partner === 'string' ? node.partner : '';
    let speaker = partner;
    let destination = '';

    if(phase === 'paused') {
      frame = 4;
      speaker = 'Take your time';
      dialogue = 'This conversation can wait until you are ready.';
    } else if(phase === 'complete') {
      destination = endingKey(story,ending) || choice?.next || '';
      frame = pauseEndings[slug]?.has(destination) ? 4 : 5;
      speaker = 'A place to finish';
      dialogue = frame === 4 ? 'Taking space can be a complete next step.' : 'A conversation can finish without deciding everything.';
    } else if(phase === 'feedback' && choice && typeof choice === 'object') {
      dialogue = typeof choice.response === 'string' ? choice.response : dialogue;
      destination = typeof choice.next === 'string' ? choice.next : '';
      if(Array.isArray(choice.moveTags) && choice.moveTags.length === 0)frame = 2;
      else if(tags.includes('taking-time'))frame = 4;
      else if(story?.endings?.[destination])frame = pauseEndings[slug]?.has(destination) ? 4 : 5;
      else if(nodeFrames[slug]?.[destination] !== undefined)frame = nodeFrames[slug][destination];
      else if(story?.nodes?.[destination]?.phase === 'Misunderstanding')frame = 2;
      else if(tags.includes('clarifying'))frame = 3;
      else if(tags.includes('listening'))frame = 1;
      else if(tags.includes('boundaries'))frame = 3;
      else frame = 1;
    }
    const expression = expressions[frame];
    return {
      frame, expression:expression.key, pair, asset:assets[pair], position:positions[frame],
      source, destination, dialogue, speaker,
      description:`${self} and ${partner}, ${expression.description}.`
    };
  }
  function el(tag,text,cls) {
    const element = document.createElement(tag);
    if(text !== undefined)element.textContent = text;
    if(cls)element.className = cls;
    return element;
  }
  function render(options = {}) {
    const state = selectState(options);
    const section = el('section',undefined,'conversation-comic');
    section.dataset.frame = String(state.frame);
    section.dataset.expression = state.expression;
    section.dataset.relationship = state.pair;
    section.dataset.artStatus = 'loading';
    section.setAttribute('aria-label','A moment in the conversation');

    const bubble = el('div',undefined,'story-speech comic-bubble');
    const art = el('div',undefined,'comic-art');
    art.setAttribute('role','img');
    art.setAttribute('aria-label',state.description);
    art.style.backgroundImage = `url("${state.asset}")`;
    art.style.backgroundPosition = state.position;
    const image = el('img',undefined,'comic-load-check');
    image.alt = '';
    image.hidden = true;
    image.addEventListener('load',() => {section.dataset.artStatus = 'ready';});
    image.addEventListener('error',() => {
      section.dataset.artStatus = 'missing';
      art.hidden = true;
    });
    image.src = state.asset;
    art.append(image);
    bubble.append(art,el('span',state.speaker,'speaker-name'),el('p',state.dialogue));
    section.append(bubble);
    return section;
  }

  window.ConversationComic = {render,selectState,pairFor,expressions,assets};
})();
