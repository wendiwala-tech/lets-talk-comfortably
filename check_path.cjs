const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const nodePath=require('node:path');
const source=fs.readFileSync(nodePath.join(__dirname,'dist/assets/levels.js'),'utf8');
const relationshipData=fs.readFileSync(nodePath.join(__dirname,'relationships.json'),'utf8');
const store=new Map();
function boot(blocked=false){const ctx={window:{},document:{getElementById(id){return id==='relationship-data'?{textContent:relationshipData}:null;},querySelectorAll(){return[];}},sessionStorage:{getItem:k=>{if(blocked)throw Error('blocked');return store.get(k);},setItem:(k,v)=>{if(blocked)throw Error('blocked');store.set(k,v);},removeItem:k=>{if(blocked)throw Error('blocked');store.delete(k);}}};vm.runInNewContext(source,ctx);return ctx.window.PracticePath;}
let path=boot();assert.equal(path.read().level,null);
assert.equal(path.read().relationship,'neutral');assert.equal(path.read().mixedRole,'woman');
for(const [v,l] of [[1,3],[2,2],[3,2],[4,1],[5,1]]){path.setBaseline(v);assert.equal(path.read().level,l);assert.equal(path.read().baseline,v);}
path.setLevel(3);path.complete('protection');path.complete('protection');assert.equal(path.read().completed.length,1);
path.setRelationship('woman-man');path.setMixedRole('man');
path=boot();assert.equal(path.read().level,3);assert.equal(path.read().baseline,5);assert.equal(path.read().completed[0],'protection');assert.equal(path.read().relationship,'woman-man');assert.equal(path.read().mixedRole,'man');assert.equal(path.profile().self.name,'Alex');
assert.deepEqual(Object.keys(JSON.parse([...store.values()][0])).sort(),['baseline','completed','level','mixedRole','relationship']);
path.clear();assert.equal(store.size,0);assert.equal(path.read().level,null);assert.equal(path.read().completed.length,0);assert.equal(path.read().relationship,'neutral');assert.equal(path.read().mixedRole,'woman');
store.set('conversation-practice-path-v1','broken-json');assert.equal(boot().read().level,null);
store.set('conversation-practice-path-v1',JSON.stringify({level:2,baseline:3,completed:['preferences','not-a-topic'],relationship:'unknown',mixedRole:'unknown'}));path=boot();assert.equal(path.read().relationship,'neutral');assert.equal(path.read().mixedRole,'woman');assert.deepEqual(Array.from(path.read().completed),['preferences']);
path=boot(true);path.setBaseline(4);path.setLevel(2);path.setRelationship('woman-woman');assert.equal(path.read().level,2);assert.equal(path.profile().partner.name,'Jules');path.clear();assert.equal(path.read().relationship,'neutral');
console.log('PASS path behavior: all rating mappings, manual override, unique completion, level/relationship persistence, exact stored fields, clear, corrupt/legacy storage and blocked storage.');
