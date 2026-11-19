'use strict';

// Run with `node check_rewards.cjs`. This checks data and reward summaries only;
// the browser preview verifies the DOM, animation, and responsive presentation.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = __dirname;
const sandbox = {window:{}};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT,'dist/assets/rewards.js'),'utf8'), sandbox, {filename:'rewards.js'});
const {summarize} = sandbox.window.ConversationReward;
assert.equal(typeof summarize,'function','The reward module must expose summarize().');

const dimensionIds = ['naming-needs','listening','boundaries','health-questions','clarifying','taking-time'];
const validTags = new Set(dimensionIds);
const slugs = ['consent-boundaries','protection','preferences','sexual-health'];
const stories = Object.fromEntries(slugs.map(slug => [slug,JSON.parse(fs.readFileSync(path.join(ROOT,'stories',slug+'.json'),'utf8'))]));
let failures = 0;
let checks = 0;
let completePaths = 0;

function test(label,run) {
  checks += 1;
  try { run(); console.log('PASS '+label); }
  catch (error) { failures += 1; console.error('FAIL '+label+'\n  '+error.message); }
}
function freezeDeep(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freezeDeep);
    Object.freeze(value);
  }
  return value;
}
function assertEmpty(result) {
  assert.equal(result.selected.length,0);
  assert.equal(result.keep,null);
  dimensionIds.forEach(id => { assert.equal(result.counts[id],0); assert.equal(result.examples[id].length,0); });
  assert.ok(result.encouragement.trim(),'A visitor still receives encouragement without tagged choices.');
}
function checkReferences(story,history,result) {
  const actualChoices = history.map(record => story.nodes[record.node].choices[record.choice]);
  const selectedLabels = new Set(actualChoices.map(choice => choice.label));
  assert.equal(result.selected.length,history.length);
  assert.deepEqual(Object.keys(result.counts).sort(),dimensionIds.slice().sort());
  result.selected.forEach(example => {
    assert.ok(selectedLabels.has(example.label),'A selected line must come from this route.');
    assert.equal(new Set(example.tags).size,example.tags.length,'A move cannot be counted twice for one choice.');
    example.tags.forEach(tag => assert.ok(validTags.has(tag),'Unknown reward dimension: '+tag));
  });
  dimensionIds.forEach(id => {
    const count = result.counts[id];
    assert.ok(Number.isInteger(count) && count >= 0 && count <= history.length,'Invalid move count: '+id);
    assert.equal(result.examples[id].length,count,'Each counted move must have an example.');
    result.examples[id].forEach(example => {
      assert.ok(history.some(record => {
        const node = story.nodes[record.node], choice = node.choices[record.choice];
        return node.round === example.round && choice.label === example.label && choice.moveTags.includes(id);
      }),'An example must be a selected, explicitly tagged line from this route.');
    });
  });
  if (result.keep) {
    assert.ok(actualChoices.some(choice => choice.label === result.keep.label && choice.moveTags.some(tag => validTags.has(tag))),
      'The keepsake must be a selected line with an explicit practice tag.');
  }
  assert.ok(result.encouragement.trim(),'Every completed story receives encouragement.');
}

for (const slug of slugs) {
  const story = stories[slug];
  test(slug+': optional tags are known and not duplicated',() => {
    Object.values(story.nodes).forEach(node => node.choices.forEach(choice => {
      assert.ok(Array.isArray(choice.moveTags));
      assert.equal(new Set(choice.moveTags).size,choice.moveTags.length);
      choice.moveTags.forEach(tag => assert.ok(validTags.has(tag),tag));
    }));
  });
  test(slug+': empty history is neutral and encouraging',() => assertEmpty(summarize({story,history:[]})));
  test(slug+': all six-round routes use only selected evidence',() => {
    const before = JSON.stringify(story);
    freezeDeep(story);
    function visit(id,history) {
      assert.ok(history.length <= 6,'A route exceeds six rounds.');
      if (story.endings[id]) {
        assert.equal(history.length,6,'A complete route must retain six rounds.');
        freezeDeep(history);
        const historyBefore = JSON.stringify(history);
        const result = summarize({story,history});
        checkReferences(story,history,result);
        assert.equal(JSON.stringify(history),historyBefore,'The reward must not mutate history.');
        completePaths += 1;
        return;
      }
      const node = story.nodes[id];
      assert.ok(node,'Missing story node '+id);
      node.choices.forEach((choice,index) => visit(choice.next,history.concat({node:id,choice:index})));
    }
    visit(story.entry,[]);
    assert.equal(JSON.stringify(story),before,'The reward must not mutate the story.');
  });
}

test('All four original stories retain 256 complete routes',() => assert.equal(completePaths,256));

test('Pressure and guessing options do not earn positive move tags',() => {
  const cases = [
    ['sexual-health','trust',1],
    ['sexual-health','privacy',1],
    ['sexual-health','uncertain_agreement',1],
    ['preferences','try_plan',1],
    ['consent-boundaries','vague_checkin',1],
    ['protection','specific_question',1]
  ];
  cases.forEach(([slug,node,choice]) => {
    const story = stories[slug];
    assert.equal(story.nodes[node].choices[choice].moveTags.length,0,slug+'/'+node);
    const result = summarize({story,history:[{node,choice}]});
    dimensionIds.forEach(id => assert.equal(result.counts[id],0,slug+'/'+node+'/'+id));
    assert.equal(result.keep,null,'An untagged line must not become the keepsake.');
    assert.ok(result.encouragement.trim());
  });
});

test('Malformed records are ignored without producing examples',() => {
  const story = stories['sexual-health'];
  const history = [null,undefined,'bad record',7,{},
    {node:'missing',choice:0},{node:story.entry,choice:-1},{node:story.entry,choice:999},
    {node:story.entry,choice:0.5},{node:story.entry,choice:'0'}];
  freezeDeep(history);
  assertEmpty(summarize({story,history}));
});

test('Duplicate and unknown tags are filtered without changing the source',() => {
  const fixture = {nodes:{only:{round:1,choices:[{label:'Could we pause and listen?',moveTags:['listening','listening','not-a-move',null,{},'taking-time']}]}}};
  const before = JSON.stringify(fixture);
  freezeDeep(fixture);
  const result = summarize({story:fixture,history:[{node:'only',choice:0}]});
  assert.equal(result.selected.length,1);
  assert.equal(result.selected[0].tags.length,2);
  assert.equal(result.counts.listening,1);
  assert.equal(result.counts['taking-time'],1);
  assert.equal(result.examples.listening.length,1);
  assert.equal(result.examples['taking-time'].length,1);
  assert.equal(Object.values(result.counts).reduce((sum,count) => sum+count,0),2);
  assert.equal(JSON.stringify(fixture),before);
});

test('Missing or non-array tags do not invent a move',() => {
  const fixture = {nodes:{only:{round:1,choices:[{label:'One line without metadata.'},{label:'A string is not a tag array.',moveTags:'listening'}]}}};
  [0,1].forEach(choice => {
    const result = summarize({story:fixture,history:[{node:'only',choice}]});
    assert.equal(result.selected.length,1);
    assert.equal(result.keep,null);
    assert.equal(Object.values(result.counts).reduce((sum,count) => sum+count,0),0);
  });
});

test('Rewinding history recomputes the map without carrying later choices',() => {
  const story = stories['sexual-health'];
  const history = [];
  let id = story.entry;
  while (!story.endings[id]) {
    history.push({node:id,choice:0});
    id = story.nodes[id].choices[0].next;
  }
  const before = JSON.stringify(history);
  const full = summarize({story,history});
  const prefix = freezeDeep(history.slice(0,2));
  const rewound = summarize({story,history:prefix});
  checkReferences(story,prefix,rewound);
  assert.equal(rewound.selected.length,2);
  dimensionIds.forEach(id => assert.ok(rewound.counts[id] <= full.counts[id]));
  assert.ok(Object.values(rewound.counts).reduce((a,b) => a+b,0) < Object.values(full.counts).reduce((a,b) => a+b,0),
    'Later moves must disappear after a rewind.');
  assertEmpty(summarize({story,history:[]}));
  const repeated = summarize({story,history:prefix});
  assert.equal(JSON.stringify(repeated),JSON.stringify(rewound),'Summaries must not accumulate across calls.');
  assert.equal(JSON.stringify(history),before);
});

console.log(`\n${checks-failures}/${checks} reward checks passed; ${completePaths} complete routes inspected.`);
if (failures) process.exitCode = 1;
