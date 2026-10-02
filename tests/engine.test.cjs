// Contract tests with a minimal Web Audio test double. Real DSP checks: audio-test.html.
const test = require('node:test');
const assert = require('node:assert/strict');
const Synth = require('../modular-synth.js');
const {Param,AudioNode,context}=require('./web-audio-mock.cjs');
function synth(){return new Synth({context:context()});}
function voice(s){s.create('oscillator',{},'osc');s.create('vca',{},'amp');s.create('envelope',{attack:.1,decay:.2,sustain:.4,release:.3},'env');s.create('output',{},'out');s.connect('osc','out','amp','in');s.connect('env','out','amp','gain');s.connect('amp','out','out','in');}
test('All 9 module types can be created, edited and disposed',async()=>{const s=synth();for(const type of Object.keys(Synth.definitions)){const m=s.create(type);for(const [k,d] of Object.entries(Synth.definitions[type].params))s.set(m.id,k,d.value);assert(m.nodes.length>0);}assert.equal(s.modules.size,9);const sources=[...s.modules.values()].flatMap(m=>m.sources);await s.destroy();assert.equal(s.modules.size,0);assert(sources.every(n=>n.stopped));assert.throws(()=>s.create('lfo'),/destroyed/);});
test('Parameter validation rejects non-finite, out-of-range and inherited keys',()=>{const s=synth();for(const p of [{frequency:NaN},{frequency:0},{frequency:Infinity},{wave:'pulse'},{oops:4},{constructor:2}])assert.throws(()=>s.create('oscillator',p));assert.throws(()=>s.create('toString'));const o=s.create('oscillator');assert.throws(()=>s.set(o.id,'frequency','440'));assert.equal(o.params.frequency,220);});
test('Port typing, duplicate cables and feedback cycle rejection',()=>{const s=synth();voice(s);assert.throws(()=>s.connect('osc','out','amp','gain'),/audio/);assert.throws(()=>s.connect('osc','out','amp','in'),/already/);assert.throws(()=>s.connect('amp','out','amp','in'),/cycles/);assert.throws(()=>s.connect('osc','toString','amp','in'));const f=s.create('filter',{},'f');s.connect('amp','out','f','in');assert.throws(()=>s.connect('f','out','amp','in'),/cycles/);});
test('Disconnect and module removal clean up the source-specific cable',()=>{const s=synth();voice(s);const cable=s.connections[0];assert.equal(s.disconnect(cable),true);assert.equal(s.disconnect(cable),false);assert.equal(cable.cable.links.length,0);s.remove('amp');assert.equal(s.connections.length,0);assert.equal(s.modules.size,3);});
test('Patch round trip preserves modules, routes and modulation amounts',()=>{const a=synth();voice(a);a.create('lfo',{depth:80},'lfo');a.connect('lfo','out','osc','pitch',.25);const patch=JSON.parse(JSON.stringify(a.toJSON()));const b=synth();b.loadPatch(patch);assert.deepEqual(b.toJSON(),patch);});
test('Invalid imports leave the existing patch intact',()=>{const s=synth();voice(s);const before=s.toJSON();for(const mutate of [p=>p.version='99',p=>p.modules.push(p.modules[0]),p=>p.connections[0].input='bad',p=>p.connections[0].input='toString',p=>p.connections[0].amount=Infinity,p=>p.connections.push({from:'amp',output:'out',to:'amp',input:'in',amount:1})]){const patch=structuredClone(before);mutate(patch);assert.throws(()=>s.loadPatch(patch));assert.deepEqual(s.toJSON(),before);}});
test('ADSR release during attack preserves the interrupted ramp',()=>{const s=synth();voice(s);s.noteOn(69,0);s.noteOff(69,.05);const env=s.get('env');assert.equal(s._envValue(env,.025),.25);assert.equal(s._envValue(env,.05),.5);assert(Math.abs(s._envValue(env,.2)-.25)<1e-9);assert.equal(s._envValue(env,.5),0);assert(env.envelope.events.some(e=>e[0]==='ramp'&&e[1]===.5&&e[2]===.05));});
test('Retrigger during release and last-note priority',()=>{const s=synth();voice(s);s.noteOn(60,0);s.noteOff(60,.4);s.noteOn(64,.55);assert(Math.abs(s._envValue(s.get('env'),.55)-.2)<1e-9);s.noteOn(67,.7);s.noteOff(67,.8);assert.deepEqual(s.held,[64]);assert.equal(s.get('osc').controls.frequency.value,Synth.midiToFrequency(64));});
test('Sequencer validates input and stops pending schedules and callbacks',async()=>{const s=synth();voice(s);assert.throws(()=>s.startSequencer({bpm:0}));assert.throws(()=>s.startSequencer({steps:[]}));assert.throws(()=>s.startSequencer({steps:[NaN]}));let calls=0;s.startSequencer({steps:[60,null,64],onStep:()=>calls++});s.stopSequencer();await new Promise(r=>setTimeout(r,45));assert.equal(calls,0);assert.equal(s.sequenceTimer,null);assert.deepEqual(s.sequenceEvents,[]);await s.destroy();});
test('Panic mutes output and a subsequent note unmutes it',()=>{const s=synth();voice(s);s.noteOn(60);s.panic();assert.equal(s.master.gain.value,0);assert.equal(s.get('env').envelope.value,0);s.noteOn(64);assert.equal(s.master.gain.value,1);});
test('MIDI conversion uses A4 = 440 Hz',()=>{assert.equal(Synth.midiToFrequency(69),440);assert.equal(Synth.midiToFrequency(81),880);assert.throws(()=>Synth.midiToFrequency(-1));});

test('Delay mix edits cancel both dry and wet future automation',()=>{
  const s=synth(),m=s.create('delay',{},'echo');
  s.set('echo','mix',1,10);s.set('echo','mix',.2,1);
  assert(!m.dry.events.some(e=>e[2]===10));assert(!m.wet.events.some(e=>e[2]===10));
  assert.equal(m.dry.value,.8);assert.equal(m.wet.value,.2);
});
test('Non-string module types cannot create silent, empty modules',()=>{
  const s=synth();assert.throws(()=>s.create(new String('oscillator')),/Unknown/);
  assert.throws(()=>s.create({toString:()=> 'oscillator'}),/Unknown/);
  assert.equal(s.modules.size,0);
});
test('Sparse sequencer arrays fail before replacing a running sequence',async()=>{
  const s=synth();voice(s);s.startSequencer({steps:[60,62]});const timer=s.sequenceTimer;
  assert.throws(()=>s.startSequencer({steps:new Array(2)}),/Step note/);
  assert.equal(s.sequenceTimer,timer);await s.destroy();
});
test('Sequencer owns a snapshot even when the original array is mutated',async()=>{
  const fs=require('node:fs'),vm=require('node:vm');let tick;
  const box={module:{exports:{}},setInterval:fn=>(tick=fn,1),clearInterval:()=>{},setTimeout:()=>1,clearTimeout:()=>{}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../modular-synth.js'),'utf8'),box);
  const c=context(),s=new box.module.exports({context:c});voice(s);
  const notes=[],originalPitch=s._pitch.bind(s);s._pitch=(note,time)=>{notes.push(note);originalPitch(note,time);};
  const steps=[60,62];s.startSequencer({steps,bpm:120});steps[1]=100;steps.push(127);
  c.currentTime=.1;tick();assert.deepEqual(notes,[60,62]);await s.destroy();
});
test('Native allocation failure leaves the original patch and nodes intact',async()=>{
  const s=synth();voice(s);const before=s.toJSON(),osc=s.get('osc');
  s.context.createOscillator=()=>{throw new Error('allocation failure');};
  assert.throws(()=>s.loadPatch({version:'1.0.0',modules:[{id:'newOsc',type:'oscillator',params:{}}],connections:[]}),/allocation failure/);
  assert.deepEqual(s.toJSON(),before);assert.equal(s.get('osc'),osc);assert(!osc.sources[0].stopped);
  await s.destroy();
});
test('Staging rollback stops successfully created temporary sources',async()=>{
  const s=synth();voice(s);const created=[];
  s.context.createOscillator=()=>{const n=new AudioNode();created.push(n);return n;};
  s.context.createBiquadFilter=()=>{throw new Error('filter allocation failure');};
  const before=s.toJSON();
  assert.throws(()=>s.loadPatch({version:'1.0.0',modules:[{id:'newOsc',type:'oscillator',params:{}},{id:'newFilter',type:'filter',params:{}}],connections:[]}),/filter allocation/);
  assert(created[0].stopped);assert.equal(created[0].links.length,0);assert.deepEqual(s.toJSON(),before);
  await s.destroy();
});
test('Failed native cable connection removes the temporary source link',async()=>{
  const s=synth();voice(s);const source=s.get('osc').outputs.out,links=source.links.length,connections=s.connections.length;
  s.context.createGain=()=>{const n=new AudioNode();n.connect=()=>{throw new Error('connect failed');};return n;};
  assert.throws(()=>s.connect('osc','out','out','in'),/connect failed/);
  assert.equal(source.links.length,links);assert.equal(s.connections.length,connections);await s.destroy();
});
test('Partial module creation failure disconnects allocated native nodes',()=>{
  const s=synth(),osc=new AudioNode();s.context.createOscillator=()=>osc;
  s.context.createGain=()=>{throw new Error('gain allocation failure');};
  assert.throws(()=>s.create('oscillator'),/gain allocation/);assert.equal(osc.links.length,0);assert.equal(s.modules.size,0);
});
test('Successful patch replacement disposes the old rack and preserves graph routing',async()=>{
  const s=synth();voice(s);const oldRack=s.rackOutput,oldOsc=s.get('osc'),patch=s.toJSON();
  s.loadPatch(patch);assert(oldOsc.sources[0].stopped);assert.equal(oldRack.links.length,0);
  assert(s.get('out').inputs.in.links.includes(s.rackOutput));assert(s.rackOutput.links.includes(s.master));
  assert.equal(s.rackOutput.gain.value,1);assert.deepEqual(s.toJSON(),patch);await s.destroy();
});
test('Panic uses a short release and cancels pending envelope gates',async()=>{
  const s=synth();voice(s);s.noteOn(60,0);s.noteOn(62,2);s.context.currentTime=.05;s.panic();
  const events=s.get('env').envelope.events;assert(!events.some(e=>e[2]>1));
  assert(events.some(e=>e[0]==='ramp'&&e[1]===0&&Math.abs(e[2]-.055)<1e-9));
  assert.equal(s.master.gain.value,0);await s.destroy();
});
test('Destroy leaves supplied contexts open and resume rejects closed contexts',async()=>{
  const c=context();let closed=false;c.close=async()=>{closed=true;};const s=new Synth({context:c});await s.destroy();assert(!closed);
  c.state='closed';assert.throws(()=>new Synth({context:c}),/closed/);
});
test('v1.0.1 runtime preserves the v1.0.0 patch format',()=>{
  const s=synth();assert.equal(Synth.version,'1.0.1');assert.equal(s.toJSON().version,'1.0.0');
  s.loadPatch({version:'1.0.0',modules:[],connections:[]});assert.equal(s.modules.size,0);
});
