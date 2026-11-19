(() => {
  'use strict';
  const dimensions = [
    {id:'naming-needs',label:'Naming your needs',short:'Needs'},
    {id:'listening',label:'Making room to listen',short:'Listening'},
    {id:'boundaries',label:'Respecting boundaries',short:'Boundaries'},
    {id:'health-questions',label:'Asking health questions',short:'Health'},
    {id:'clarifying',label:'Clearing things up',short:'Clarifying'},
    {id:'taking-time',label:'Taking your time',short:'Time'}
  ];
  const validTags = new Set(dimensions.map(d => d.id));
  const svgNS = 'http://www.w3.org/2000/svg';
  let serial = 0;
  function el(tag, text, cls) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (cls) node.className = cls;
    return node;
  }
  function svgEl(tag, attributes = {}) {
    const node = document.createElementNS(svgNS, tag);
    Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, String(value)));
    return node;
  }
  function summarize({story, history = []}) {
    const counts = Object.fromEntries(dimensions.map(d => [d.id, 0]));
    const examples = Object.fromEntries(dimensions.map(d => [d.id, []]));
    const selected = [];
    history.forEach(record => {
      if (!record || typeof record !== 'object') return;
      const node = story?.nodes?.[record.node];
      const choice = Number.isInteger(record.choice) ? node?.choices?.[record.choice] : null;
      if (!choice || typeof choice.label !== 'string') return;
      const tags = [...new Set(Array.isArray(choice.moveTags) ? choice.moveTags : [])].filter(tag => validTags.has(tag));
      const example = {round:node.round, label:choice.label, tags};
      selected.push(example);
      tags.forEach(tag => { counts[tag] += 1; examples[tag].push(example); });
    });
    const keep = selected.filter(item => item.tags.length).sort((a,b) => a.label.length - b.label.length)[0] || null;
    let encouragement = 'You explored a few ways a conversation can unfold. Keep the words that help, and revisit anything you want to try differently.';
    if (counts['taking-time']) encouragement = 'You practiced making room for time. A pause can be a thoughtful next step.';
    else if (counts.listening) encouragement = 'You practiced leaving room for another person’s answer while finding words for your own needs.';
    else if (counts['naming-needs']) encouragement = 'You practiced putting a need into words. It does not have to sound perfect to be worth saying.';
    return {counts, examples, keep, encouragement, selected};
  }
  function point(index, radius) {
    const angle = -Math.PI / 2 + index * Math.PI / 3;
    return [160 + Math.cos(angle) * radius, 129 + Math.sin(angle) * radius];
  }
  function polygon(radius) {
    return dimensions.map((_, index) => point(index, radius).join(',')).join(' ');
  }
  function render({story, history = [], slug = ''}) {
    const data = summarize({story, history});
    const uid = `conversation-reward-${++serial}`;
    const section = el('section', undefined, 'conversation-reward');
    section.dataset.story = slug;
    section.setAttribute('aria-labelledby', `${uid}-heading`);
    const eyebrow = el('p', 'A little encouragement, to keep', 'reward-eyebrow');
    const heading = el('h4', 'You showed up. That counts.', 'reward-heading');
    heading.id = `${uid}-heading`;
    section.append(eyebrow, heading, el('p', data.encouragement, 'reward-encouragement'));

    const body = el('div', undefined, 'reward-body');
    const figure = el('figure', undefined, 'reward-figure');
    const chart = svgEl('svg', {viewBox:'0 0 320 264', role:'img', 'aria-labelledby':`${uid}-chart-title ${uid}-chart-description`, class:'reward-chart'});
    const title = svgEl('title'); title.id = `${uid}-chart-title`; title.textContent = 'Your conversation constellation';
    const description = svgEl('desc'); description.id = `${uid}-chart-description`;
    description.textContent = dimensions.map(d => `${d.label}: ${data.counts[d.id] ? `${data.counts[d.id]} selected communication moves` : 'not explored in these choices'}`).join('. ') + '. The shape summarizes this story, not personality or ability.';
    chart.append(title, description);
    [28, 56, 84].forEach(radius => chart.append(svgEl('polygon', {points:polygon(radius), class:'reward-grid'})));
    dimensions.forEach((d, index) => {
      const [x,y] = point(index,84);
      chart.append(svgEl('line',{x1:160,y1:129,x2:x,y2:y,class:'reward-axis'}));
    });
    const radii = dimensions.map(d => data.counts[d.id] ? Math.min(80, 34 + data.counts[d.id] * 12) : 7);
    chart.append(svgEl('polygon',{points:radii.map((radius,index) => point(index,radius).join(',')).join(' '),class:'reward-shape'}));
    dimensions.forEach((d,index) => {
      const [x,y] = point(index,radii[index]);
      chart.append(svgEl('circle',{cx:x,cy:y,r:3.5,class:data.counts[d.id]?'reward-dot':'reward-dot reward-dot-empty'}));
    });
    const labelPositions = [[160,21,'middle'],[263,73,'middle'],[263,198,'middle'],[160,248,'middle'],[57,198,'middle'],[57,73,'middle']];
    dimensions.forEach((d,index) => {
      const [x,y,anchor] = labelPositions[index];
      const text = svgEl('text',{x,y,'text-anchor':anchor,class:'reward-axis-label'}); text.textContent=d.short;
      chart.append(text);
    });
    figure.append(chart, el('figcaption','Your conversation constellation','reward-caption'));
    const sparkle = el('span','✦','reward-sparkle'); sparkle.setAttribute('aria-hidden','true'); figure.append(sparkle);
    body.append(figure);

    const keepsake = el('details',undefined,'reward-keepsake');
    keepsake.open = typeof window.matchMedia === 'function' && window.matchMedia('(min-width: 651px)').matches;
    keepsake.append(el('summary','Keep a line you tried'));
    if (data.keep) {
      const quote = el('blockquote',`“${data.keep.label}”`,'reward-quote');
      const status = el('p','','reward-copy-status'); status.setAttribute('role','status');
      const copy = el('button','Copy this line','plain-button reward-copy'); copy.type='button';
      function selectLine() {
        const range = document.createRange(); range.selectNodeContents(quote);
        const selection = window.getSelection(); selection?.removeAllRanges(); selection?.addRange(range);
        status.textContent='The line is selected. Use your device’s Copy command to keep it.';
      }
      copy.addEventListener('click',async () => {
        try {
          if (!navigator.clipboard?.writeText) { selectLine(); return; }
          await navigator.clipboard.writeText(data.keep.label);
          status.textContent='Copied. Keep it, or make it sound like you.';
          copy.textContent='Copied ✓';
        } catch (_) { selectLine(); }
      });
      keepsake.append(quote,copy,status);
    } else {
      keepsake.append(el('p','More possibilities, whenever you want them','reward-small-label'),el('p','You can revisit a turn and try another way to say what matters to you.','reward-note'));
    }
    keepsake.append(el('p','A snapshot of today’s choices, not a personality score.','reward-note'));
    body.append(keepsake); section.append(body);

    const details = el('details',undefined,'reward-details');
    details.append(el('summary','See what shaped your map'));
    const controls = el('div',undefined,'reward-dimensions'); controls.setAttribute('role','group'); controls.setAttribute('aria-label','Explore the six communication moves');
    const explanation = el('div',undefined,'reward-dimension-detail'); explanation.setAttribute('role','status');
    let active = dimensions.findIndex(d => data.counts[d.id] > 0); if (active < 0) active = 0;
    function showDimension(index) {
      active = index;
      [...controls.children].forEach((button,i) => button.setAttribute('aria-pressed',String(i === index)));
      const dim = dimensions[index], examples = data.examples[dim.id];
      explanation.replaceChildren(el('h5',dim.label));
      if (examples.length) {
        const sample = examples[examples.length-1];
        explanation.append(el('p',`You practiced this in ${examples.length} ${examples.length === 1 ? 'choice' : 'choices'}. One example, from round ${sample.round}:`),el('blockquote',`“${sample.label}”`));
      } else explanation.append(el('p','Not explored in these choices. Every story and route is different; this does not mean a skill is missing.'));
    }
    dimensions.forEach((d,index) => {
      const button = el('button',d.label,'reward-dimension'); button.type='button'; button.setAttribute('aria-pressed',String(index === active));
      button.addEventListener('click',() => showDimension(index)); controls.append(button);
    });
    showDimension(active);
    details.append(controls,explanation,el('p','Longer directions mean more of your selected lines used that communication move. They are not grades. Not every topic explores every direction.','reward-method'));
    section.append(details);
    return section;
  }
  window.ConversationReward = {render,summarize,dimensions};
})();
