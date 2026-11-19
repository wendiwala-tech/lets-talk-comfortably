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
  // A shared foundation keeps an unchosen move from looking like a low score.
  // The small lift records this route's choices; it does not estimate ability.
  function footprintRadii(counts = {}) {
    return dimensions.map(d => {
      const count = counts?.[d.id];
      const moves = Number.isFinite(count) ? Math.max(0, count) : 0;
      return 64 + Math.min(16, moves * 3);
    });
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
    description.textContent = 'Every direction begins with the same generous foundation. Your selected moves add a gentle outward lift. ' + dimensions.map(d => `${d.label}: ${data.counts[d.id] ? 'a move you practiced in this story' : 'room for another conversation'}`).join('. ') + '. This is a practice keepsake, not a score or a measure of personality or ability.';
    chart.append(title, description);
    [28, 56, 84].forEach(radius => chart.append(svgEl('polygon', {points:polygon(radius), class:'reward-grid'})));
    dimensions.forEach((d, index) => {
      const [x,y] = point(index,84);
      chart.append(svgEl('line',{x1:160,y1:129,x2:x,y2:y,class:'reward-axis'}));
    });
    const radii = footprintRadii(data.counts);
    chart.append(svgEl('polygon',{points:radii.map((radius,index) => point(index,radius).join(',')).join(' '),class:'reward-shape'}));
    dimensions.forEach((d,index) => {
      const [x,y] = point(index,radii[index]);
      chart.append(svgEl('circle',{cx:x,cy:y,r:3.5,class:'reward-dot'}));
    });
    const labelPositions = [[160,21,'middle'],[263,73,'middle'],[263,198,'middle'],[160,248,'middle'],[57,198,'middle'],[57,73,'middle']];
    dimensions.forEach((d,index) => {
      const [x,y,anchor] = labelPositions[index];
      const text = svgEl('text',{x,y,'text-anchor':anchor,class:'reward-axis-label'}); text.textContent=d.short;
      chart.append(text);
    });
    figure.append(chart, el('figcaption','Your conversation constellation','reward-caption'), el('p','Room to grow in every direction.','reward-chart-note'));
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
    keepsake.append(el('p','A little keepsake from today’s practice. Every conversation leaves room to grow.','reward-note'));
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
        explanation.append(el('p',`You made room for this move. A line you tried in round ${sample.round}:`),el('blockquote',`“${sample.label}”`));
      } else explanation.append(el('p','Room to explore, whenever you feel ready. Another story may give you a chance to try this move in your own way.'));
    }
    dimensions.forEach((d,index) => {
      const button = el('button',d.label,'reward-dimension'); button.type='button'; button.setAttribute('aria-pressed',String(index === active));
      button.addEventListener('click',() => showDimension(index)); controls.append(button);
    });
    showDimension(active);
    details.append(controls,explanation,el('p','Each direction starts with the same foundation. The moves you tried add a gentle outward lift. This shape celebrates your practice; it does not grade your skills.','reward-method'));
    section.append(details);
    return section;
  }
  window.ConversationReward = {render,summarize,dimensions,footprintRadii};
})();
