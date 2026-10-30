// Deterministic lifecycle tests: real game script, small DOM stub, virtual clock.
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
function setup(reducedMotion = false) {
  let now = 0, sequence = 0, draws = [];
  const intervals = new Map(), timeouts = new Map();
  class Element {
    constructor() {
      this.children = []; this.attrs = {}; this.events = {}; this.hidden = false;
      this.disabled = false; this.textContent = ''; this.className = '';
      this.style = {setProperty(k,v) {this[k] = v;}};
      const classes = new Set();
      this.classList = {add: (...c) => c.forEach(x => classes.add(x)), remove: (...c) => c.forEach(x => classes.delete(x)), toggle: (c,on) => on ? classes.add(c) : classes.delete(c), contains: c => classes.has(c)};
    }
    setAttribute(k,v) {this.attrs[k] = v;}
    appendChild(c) {c.parentElement = this; this.children.push(c);}
    querySelector(s) {return this.children.find(c => c.className.split(' ').includes(s.slice(1))) || null;}
    remove() {this.parentElement.children = this.parentElement.children.filter(c => c !== this);}
    replaceChildren() {this.children = [];}
    addEventListener(k,f) {this.events[k] = f;}
    focus() {}
    click() {if(!this.disabled) this.events.click?.();}
  }
  const ids = new Map();
  const get = id => {if(!ids.has(id)) ids.set(id,new Element()); return ids.get(id);};
  get('difficulty').value = 'normal';
  get('timer').parentElement = new Element();
  get('timer').parentElement.parentElement = new Element();
  const document = {getElementById:get,createElement:() => new Element(), events:{},addEventListener(k,f){this.events[k] = f;}, hidden:false};
  const math = Object.create(Math); math.random = () => draws.length ? draws.shift() : 0.1;
  const played = [];
  class Audio { constructor(src) {this.src=src;} play(){played.push(this.src);return Promise.resolve();} }
  const context = {Audio, document, Math:math, performance:{now:() => now},matchMedia:() => ({matches:reducedMotion}),setInterval:f => {intervals.set(++sequence,f); return sequence;},clearInterval:id => intervals.delete(id),setTimeout:f => {timeouts.set(++sequence,f); return sequence;},clearTimeout:id => timeouts.delete(id)};
  vm.runInNewContext(readFileSync(join(__dirname,'../script.js'),'utf8'), context);
  return {get,document,intervals,played, draws:values => {draws = values;}, advance:ms => {now += ms; [...intervals.values()].forEach(f => f());}, score:() => Number(get('score').textContent), clickTarget:() => get('board').children.find(c => c.classList.contains('is-can') || c.classList.contains('is-spill'))?.click(), key:(key,repeat=false) => document.events.keydown({key,repeat,preventDefault(){}})};
}
const g = setup();
assert.equal(g.get('board').children.length,9);
assert.equal(g.intervals.size,0);
g.draws([0,0.1]); g.get('start-game').click();
assert.equal(g.intervals.size,1);
g.clickTarget(); assert.equal(g.score(),10,'can gives ten points');
g.get('board').children[0].click(); assert.equal(g.score(),10,'consumed can cannot score twice');
g.draws([0,0.99]); g.advance(1200); g.clickTarget(); assert.equal(g.score(),5,'spill penalty');
g.draws([0,0.99]); g.advance(1200); g.clickTarget(); assert.equal(g.score(),0);
g.draws([0,0.99]); g.advance(1200); g.clickTarget(); assert.equal(g.score(),0,'floor at zero');
g.get('pause-game').click(); const frozen = g.get('timer').textContent;
g.advance(10000); g.key('1'); assert.equal(g.get('timer').textContent,frozen);assert.equal(g.score(),0);
g.get('start-game').click(); assert.equal(g.intervals.size,1);
g.draws([0,0.1]);g.advance(1200);g.key('1',true);assert.equal(g.score(),0,'ignore held keys');g.key('1');assert.equal(g.score(),10,'number keys collect');
g.get('reset-game').click();assert.equal(g.score(),0);assert.equal(Number(g.get('timer').textContent),30);assert.equal(g.intervals.size,1,'reset clears old loop');
g.document.hidden=true;g.document.events.visibilitychange();assert.equal(g.intervals.size,0,'hidden tab pauses');
g.document.hidden=false;g.document.events.visibilitychange();assert.equal(g.intervals.size,0,'return does not silently resume');
g.get('start-game').click();g.advance(30001);assert.equal(g.intervals.size,0);assert.equal(g.get('overlay-title').textContent,'Nice effort. Try again?');assert.equal(g.get('result-mission').hidden,false);
g.key('1');assert.equal(g.score(),0,'no score after timeout');
for(const reduced of [false,true]) {
 const win=setup(reduced);win.draws([0,0.1]);win.get('start-game').click();
 for(let i=0;i<10;i++){if(i){win.draws([0,0.1]);win.advance(1200);}win.clickTarget();}
 assert.equal(win.score(),100);assert.equal(win.get('overlay').hidden,true,'goal before timer end keeps playing');
 win.advance(30000);assert.equal(win.get('overlay-title').textContent,'Quest complete!');
 assert.ok(reduced ? win.get('confetti').classList.contains('static-celebration') : win.get('confetti').children.length===60,'win celebration');
 win.get('reset-game').click();assert.equal(win.get('confetti').children.length,0);assert.equal(win.get('confetti').classList.contains('static-celebration'),false);
}
const late=setup();late.get('start-game').click();late.advance(30000);late.clickTarget();assert.equal(late.score(),0);
const dropped=setup();dropped.get('start-game').click();
for(let i=0;i<10;i++){if(i)dropped.advance(1200);dropped.clickTarget();}
dropped.draws([0,0.99]);dropped.advance(1200);dropped.clickTarget();assert.equal(dropped.score(),95);dropped.advance(30000);assert.equal(dropped.get('overlay-title').textContent,'Nice effort. Try again?','final score determines win');
console.log('PASS: scoring, penalties, score floor, single-use targets, keyboard, pause/resume, reset cleanup, visibility, timeout, win/retry, and both celebration modes.');

for (const [name, seconds, goal, spawn, penalty, chance] of [['easy',40,80,1500,5,.9],['normal',30,100,1200,5,.8],['hard',25,140,850,10,.7]]) {
  const m = setup(); m.get('difficulty').value=name; m.get('difficulty').events.change();
  assert.equal(Number(m.get('timer').textContent),seconds);
  assert.ok(m.get('win-rule').textContent.includes(String(goal)));
  m.get('start-game').click(); assert.equal(m.get('difficulty').disabled,true);
  for(let i=0;i<goal/10;i++) {if(i)m.advance(spawn); m.clickTarget();}
  assert.equal(m.score(),goal);assert.ok(m.get('milestone').textContent.includes('100% milestone'));
  m.draws([0,chance+.01]);m.advance(spawn);m.clickTarget();assert.equal(m.score(),goal-penalty);
  m.advance(seconds*1000); assert.equal(m.get('overlay-title').textContent,'Nice effort. Try again?');
  assert.equal(m.get('difficulty').disabled,false);
  m.get('difficulty').value='normal';m.get('difficulty').events.change();assert.equal(m.score(),0);assert.equal(m.get('overlay-title').textContent,'Ready for a little good?');
  m.get('reset-game').click();assert.equal(Number(m.get('timer').textContent),30);
}
const audio = setup();audio.get('start-game').click();audio.clickTarget();assert.equal(audio.played.length,0,'sound starts off');
audio.get('sound-toggle').click();assert.equal(audio.get('sound-toggle').attrs['aria-pressed'],'true');
audio.advance(1200);audio.clickTarget();assert.ok(audio.played.includes('audio/collect.wav'));
audio.draws([0,.99]);audio.advance(1200);audio.clickTarget();assert.ok(audio.played.includes('audio/spill.wav'));
for(let i=0;i<10;i++){audio.advance(1200);audio.clickTarget();}audio.advance(30000);assert.ok(audio.played.includes('audio/win.wav'));
audio.get('sound-toggle').click();const prior=audio.played.length;audio.get('reset-game').click();audio.clickTarget();assert.equal(audio.played.length,prior);
const milestones=setup();milestones.get('start-game').click();for(let i=0;i<3;i++){if(i)milestones.advance(1200);milestones.clickTarget();}
assert.ok(milestones.get('milestone').textContent.includes('25% milestone'));
milestones.draws([0,.99]);milestones.advance(1200);milestones.clickTarget();milestones.advance(1200);milestones.clickTarget();
assert.ok(milestones.get('milestone').textContent.includes('25% milestone'));
milestones.get('reset-game').click();assert.ok(milestones.get('milestone').textContent.includes('Your milestones'));
console.log('PASS: all difficulty modes, mode locking and switching, dynamic rules, milestones, sound opt-in and effects.');
