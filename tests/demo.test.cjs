const test=require('node:test'),assert=require('node:assert/strict');
const {harness}=require('./demo-harness.cjs');
function setup(t){const e=harness();t.after(()=>e.close());return e;}
test('Demo loads a connected preset, 16 steps, and 13 keyboard keys',t=>{
  const e=setup(t);assert.equal(e.synth.modules.size,7);assert.equal(e.synth.connections.length,6);
  assert.equal(e.$('steps').querySelectorAll('select').length,16);assert.equal(e.$('keyboard').querySelectorAll('button').length,13);
  assert.equal(e.$('env-amount-number').value,'0.8');assert.equal(e.$('filter-resonance-label').textContent,'resonance (dB)');
});
test('Cancel while audio resumes cannot start a stale sequencer request',async t=>{
  const e=setup(t);e.suspend();const pending=e.$('play').click();assert.equal(e.$('play').textContent,'■ Cancel');
  await e.$('play').click();e.resume();await pending;
  assert.equal(e.starts,0);assert.equal(e.$('play').textContent,'▶ Play');
});
test('Panic while audio resumes keeps the master muted',async t=>{
  const e=setup(t);e.suspend();const pending=e.$('play').click();e.$('panic').click();e.resume();await pending;
  assert.equal(e.starts,0);assert.equal(e.synth.master.gain.value,0);
});
test('Preset replacement cancels a pending Play request',async t=>{
  const e=setup(t);e.suspend();const pending=e.$('play').click();e.$('preset').value='blank';e.$('load-preset').click();e.resume();await pending;
  assert.equal(e.starts,0);assert.equal(e.synth.modules.size,1);
});
test('Releasing a key before audio resumes does not leave a stuck note',async t=>{
  const e=setup(t);e.suspend();const pending=e.window.emit('keydown',{key:'a',target:e.document.body,preventDefault(){}});
  await e.window.emit('keyup',{key:'a'});e.resume();await pending;assert.deepEqual(e.synth.held,[]);
});
test('Precise numeric controls validate and reset invalid edits',t=>{
  const e=setup(t),number=e.$('env-amount-number');number.value='.45';number.onkeydown({key:'Enter',preventDefault(){}});assert.equal(e.synth.get('env').params.amount,.45);
  number.value='-1';number.onchange();assert.equal(e.synth.get('env').params.amount,.45);assert.equal(number.value,'0.45');
  number.value='';number.onchange();assert.equal(e.synth.get('env').params.amount,.45);
  e.$('filter-type').value='bandpass';e.$('filter-type').onchange();assert.equal(e.$('filter-resonance-label').textContent,'resonance (Q)');
});
test('Logarithmic modulation slider can address small VCA gain amounts',t=>{
  const e=setup(t),slider=e.$('env-amount');slider.value=1000*Math.log1p(.2)/Math.log1p(10000);slider.oninput();
  assert.equal(e.synth.get('env').params.amount,.2);assert.equal(e.$('env-amount-number').value,'0.2');
});
test('Invalid tempo prevents both playback and exporting an unloadable patch',async t=>{
  const e=setup(t);e.$('bpm').value='0';e.$('save').click();assert.equal(e.downloads,0);
  await e.$('play').click();assert.equal(e.starts,0);assert.equal(e.$('play').textContent,'▶ Play');
  assert.match(e.$('message').textContent,/Tempo/);
});
test('An older pending import cannot replace a subsequently loaded preset',async t=>{
  const e=setup(t);let resolve;const text=new Promise(r=>{resolve=r;});
  const patch=e.synth.toJSON();e.$('file').files=[{size:100,text:()=>text}];const pending=e.$('file').onchange({target:e.$('file')});
  e.$('preset').value='blank';e.$('load-preset').click();resolve(JSON.stringify(patch));await pending;
  assert.equal(e.synth.modules.size,1);
});
test('Invalid imported sequencer data leaves the current rack intact',async t=>{
  const e=setup(t),before=e.synth.toJSON(),patch={version:'1.0.0',modules:[],connections:[],demo:{steps:Array(16).fill(200),bpm:110,gate:.65}};
  e.$('file').files=[{size:100,text:async()=>JSON.stringify(patch)}];await e.$('file').onchange({target:e.$('file')});
  assert.deepEqual(e.synth.toJSON(),before);
});
test('Back-forward cache navigation preserves the synth and restarts drawing',async t=>{
  const e=setup(t);await e.window.emit('pagehide',{persisted:true});assert.equal(e.destroyed,0);assert(!e.synth.destroyed);
  const count=e.frames.size;await e.window.emit('pageshow',{persisted:true});assert(e.frames.size>count);
  await e.window.emit('pagehide',{persisted:false});assert.equal(e.destroyed,1);assert(e.synth.destroyed);
});
