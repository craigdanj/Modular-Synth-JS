/* Modular Synth JS v1.0.1 | MIT License */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ModularSynth = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = '1.0.1';
  const PATCH_VERSION = '1.0.0'; // File format stays compatible with existing patches.
  const number = (value, min, max, label) => {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max)
      throw new RangeError(`${label} must be a finite number between ${min} and ${max}`);
    return value;
  };
  const range = (value, min, max, step = .01, unit = '') => ({value, min, max, step, unit});
  const choice = (value, values) => ({value, values});
  const definitions = {
    oscillator: {label:'Oscillator', description:'Pitched audio source', params:{wave:choice('sawtooth',['sine','triangle','sawtooth','square']), frequency:range(220,20,20000,1,'Hz'), detune:range(0,-2400,2400,1,'ct'), level:range(.5,0,1)}, inputs:{fm:'cv', pitch:'cv'}, outputs:{out:'audio'}},
    noise: {label:'Noise', description:'White noise source', params:{level:range(.15,0,1)}, inputs:{}, outputs:{out:'audio'}},
    filter: {label:'Filter', description:'Resonant tone shaping', params:{type:choice('lowpass',['lowpass','highpass','bandpass','notch']), cutoff:range(1600,20,20000,1,'Hz'), resonance:range(1,.1,24,.1)}, inputs:{in:'audio', cutoff:'cv', resonance:'cv'}, outputs:{out:'audio'}},
    vca: {label:'VCA', description:'Voltage-controlled amplifier', params:{gain:range(0,0,1)}, inputs:{in:'audio', gain:'cv'}, outputs:{out:'audio'}},
    envelope: {label:'Envelope', description:'ADSR · triggered by note events', params:{attack:range(.015,.001,4,.001,'s'), decay:range(.2,.001,4,.001,'s'), sustain:range(.5,0,1), release:range(.35,.001,8,.001,'s'), amount:range(1,0,10000,.01)}, inputs:{}, outputs:{out:'cv'}},
    lfo: {label:'LFO', description:'Bipolar modulation source', params:{wave:choice('sine',['sine','triangle','sawtooth','square']), rate:range(4,.01,40,.01,'Hz'), depth:range(20,0,10000,.01)}, inputs:{}, outputs:{out:'cv'}},
    mixer: {label:'Mixer', description:'Three audio inputs', params:{a:range(.7,0,1), b:range(.7,0,1), c:range(.7,0,1)}, inputs:{a:'audio',b:'audio',c:'audio'}, outputs:{out:'audio'}},
    delay: {label:'Delay', description:'Echo with internal feedback', params:{time:range(.25,.01,2,.01,'s'), feedback:range(.3,0,.9), mix:range(.25,0,1)}, inputs:{in:'audio'}, outputs:{out:'audio'}},
    output: {label:'Output', description:'Master · compressor · scope', params:{volume:range(.35,0,1)}, inputs:{in:'audio'}, outputs:{}}
  };
  function validateParams(type, params = {}) {
    const def = definitions[type];
    if (typeof type !== 'string' || !Object.hasOwn(definitions,type)) throw new TypeError(`Unknown module type: ${type}`);
    if (!params || typeof params !== 'object' || Array.isArray(params)) throw new TypeError('Parameters must be an object');
    const result = Object.fromEntries(Object.entries(def.params).map(([k,d]) => [k,d.value]));
    for (const [key,value] of Object.entries(params)) {
      const d = def.params[key];
      if (!Object.hasOwn(def.params,key)) throw new TypeError(`Unknown parameter: ${type}.${key}`);
      if (d.values ? !d.values.includes(value) : (number(value,d.min,d.max,key), false)) throw new RangeError(`Invalid ${key}`);
      result[key] = value;
    }
    return result;
  }
  const validId = id => typeof id === 'string' && /^[a-zA-Z][\w-]{0,63}$/.test(id);
  class ModularSynth {
    constructor(options = {}) {
      if (!options || typeof options !== 'object' || Array.isArray(options)) throw new TypeError('Options must be an object');
      const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!options.context && !AudioContextClass) throw new Error('Web Audio is unavailable in this environment');
      this.context = options.context || new AudioContextClass();
      this.ownsContext = !options.context;
      if (this.context.state === 'closed') throw new Error('Audio context is closed');
      this.modules = new Map(); this.connections = []; this.counter = 0; this.destroyed = false;
      this.held = []; this.sequenceTimer = null; this.sequenceGeneration = 0; this.sequenceEvents = [];
      this.master = this.context.createGain(); this.master.gain.value = 1;
      this.rackOutput = this.context.createGain(); this.rackOutput.connect(this.master);
      this.compressor = this.context.createDynamicsCompressor();
      this.compressor.threshold.value = -8; this.compressor.knee.value = 6;
      this.compressor.ratio.value = 12; this.compressor.attack.value = .003; this.compressor.release.value = .15;
      this.analyser = this.context.createAnalyser(); this.analyser.fftSize = 2048;
      this.master.connect(this.compressor); this.compressor.connect(this.analyser);
      this.analyser.connect(options.destination || this.context.destination);
    }
    _alive() { if (this.destroyed) throw new Error('Synth has been destroyed'); }
    async resume() { this._alive(); if (this.context.state === 'closed') throw new Error('Audio context is closed'); if (this.context.state !== 'running') await this.context.resume(); this._alive(); return this; }
    create(type, params = {}, id) {
      this._alive(); const p = validateParams(type,params); if(this.modules.size>=64) throw new RangeError('Maximum 64 modules');
      if (id === undefined) { do { id = `m${++this.counter}`; } while (this.modules.has(id)); }
      if (!validId(id) || this.modules.has(id)) throw new TypeError('Module ID must be unique and use letters, numbers, underscores or hyphens');
      const c = this.context, nodes = [], sources = [], inputs = {}, outputs = {}, controls = {};
      const node = n => (nodes.push(n), n);
      const gain = value => { const n = node(c.createGain()); n.gain.value = value; return n; };
      const m = {id,type,params:p,nodes,sources,inputs,outputs,controls, envelopeEvents:[]};
      try {
      if (type === 'oscillator' || type === 'lfo') {
        const osc = node(c.createOscillator()), amp = gain(type === 'lfo' ? p.depth : p.level);
        osc.type = p.wave; osc.frequency.value = type === 'lfo' ? p.rate : p.frequency;
        osc.connect(amp); outputs.out = amp; controls.wave = osc;
        controls[type === 'lfo' ? 'rate' : 'frequency'] = osc.frequency;
        controls[type === 'lfo' ? 'depth' : 'level'] = amp.gain;
        if (type === 'oscillator') { osc.detune.value = p.detune; inputs.fm = osc.frequency; inputs.pitch = osc.detune; controls.detune = osc.detune; }
        sources.push(osc); osc.start();
      } else if (type === 'noise') {
        const source = node(c.createBufferSource()), amp = gain(p.level), buffer = c.createBuffer(1,c.sampleRate*2,c.sampleRate);
        const data = buffer.getChannelData(0); for (let i=0;i<data.length;i++) data[i] = Math.random()*2-1;
        source.buffer = buffer; source.loop = true; source.connect(amp); sources.push(source); source.start();
        outputs.out = amp; controls.level = amp.gain;
      } else if (type === 'filter') {
        const f = node(c.createBiquadFilter()); f.type = p.type; f.frequency.value = p.cutoff; f.Q.value = p.resonance;
        inputs.in = f; inputs.cutoff = f.frequency; inputs.resonance = f.Q; outputs.out = f;
        controls.type = f; controls.cutoff = f.frequency; controls.resonance = f.Q;
      } else if (type === 'vca') {
        const amp = gain(p.gain); inputs.in = amp; inputs.gain = amp.gain; outputs.out = amp; controls.gain = amp.gain;
      } else if (type === 'envelope') {
        const source = node(c.createConstantSource()), amp = gain(p.amount); source.offset.value = 0;
        source.connect(amp); sources.push(source); source.start(); outputs.out = amp;
        m.envelope = source.offset; controls.amount = amp.gain;
      } else if (type === 'mixer') {
        const out = gain(1); outputs.out = out;
        for (const key of ['a','b','c']) { const amp = gain(p[key]); amp.connect(out); inputs[key] = amp; controls[key] = amp.gain; }
      } else if (type === 'delay') {
        const input = gain(1), dry = gain(1-p.mix), wet = gain(p.mix), out = gain(1);
        const echo = node(c.createDelay(2)), feedback = gain(p.feedback); echo.delayTime.value = p.time;
        input.connect(dry); dry.connect(out); input.connect(echo); echo.connect(wet); wet.connect(out);
        echo.connect(feedback); feedback.connect(echo);
        inputs.in = input; outputs.out = out; controls.time = echo.delayTime; controls.feedback = feedback.gain;
        m.dry = dry.gain; m.wet = wet.gain;
      } else if (type === 'output') {
        const amp = gain(p.volume); inputs.in = amp; amp.connect(this.rackOutput); controls.volume = amp.gain;
      }
      this.modules.set(id,m); return m;
      } catch (error) {
        this._disposeModule(m);
        throw error;
      }
    }
    set(id, key, value, time = this.context.currentTime) {
      this._alive(); const m = this.get(id); validateParams(m.type,{[key]:value});
      number(time,0,Number.MAX_VALUE,'time'); time=Math.max(time,this.context.currentTime);
      m.params[key] = value; const target = m.controls[key];
      if (key === 'wave') target.type = value;
      else if (m.type === 'filter' && key === 'type') target.type = value;
      else if (m.type === 'delay' && key === 'mix') {
        m.dry.cancelScheduledValues(time); m.wet.cancelScheduledValues(time);
        m.dry.setTargetAtTime(1-value,time,.01); m.wet.setTargetAtTime(value,time,.01);
      } else if (target) { target.cancelScheduledValues(time); target.setTargetAtTime(value,time,.01); }
      return this;
    }
    get(id) { const m = this.modules.get(id); if (!m) throw new Error(`Module not found: ${id}`); return m; }
    connect(from, output, to, input, amount = 1) {
      this._alive(); number(amount,-10000,10000,'Connection amount'); if(this.connections.length>=256) throw new RangeError('Maximum 256 connections');
      const a = this.get(from), b = this.get(to), outType = definitions[a.type].outputs[output], inType = definitions[b.type].inputs[input];
      if (!Object.hasOwn(definitions[a.type].outputs,output) || !Object.hasOwn(definitions[b.type].inputs,input) || outType !== inType) throw new TypeError('Connect audio to audio, or CV to CV');
      if (this.connections.some(x=>x.from===from && x.output===output && x.to===to && x.input===input)) throw new Error('Connection already exists');
      // User patch cycles are rejected; Delay owns a controlled internal feedback loop.
      const visits = new Set();
      const reaches = id => { if (id === from) return true; if (visits.has(id)) return false; visits.add(id); return this.connections.filter(x=>x.from===id).some(x=>reaches(x.to)); };
      if (reaches(to)) throw new Error('Feedback patch cycles are unsupported; use the Delay module');
      const cable = this.context.createGain(); cable.gain.value = amount;
      try {
        a.outputs[output].connect(cable); cable.connect(b.inputs[input]);
      } catch (error) {
        try { a.outputs[output].disconnect(cable); } catch (_) {}
        cable.disconnect();
        throw error;
      }
      const connection = {from,output,to,input,amount,cable}; this.connections.push(connection); return connection;
    }
    disconnect(connection) {
      const index = this.connections.indexOf(connection); if (index < 0) return false;
      this.get(connection.from).outputs[connection.output].disconnect(connection.cable);
      connection.cable.disconnect(); this.connections.splice(index,1); return true;
    }
    _disposeModule(m) {
      for (const source of m.sources) { try { source.stop(); } catch (_) {} }
      for (const node of m.nodes) node.disconnect();
    }
    remove(id) {
      this._alive(); const m = this.get(id);
      for (const cable of [...this.connections]) if (cable.from === id || cable.to === id) this.disconnect(cable);
      this._disposeModule(m); this.modules.delete(id); return this;
    }
    _envValue(m,time) {
      let value = 0;
      for (const event of m.envelopeEvents) {
        if (event.time > time) break;
        const dt = time-event.time;
        if (event.kind === 'off') value = event.from * Math.max(0,1-dt/event.release);
        else if (dt < event.attack) value = event.from+(1-event.from)*dt/event.attack;
        else if (dt < event.attack+event.decay) value = 1+(event.sustain-1)*(dt-event.attack)/event.decay;
        else value = event.sustain;
      }
      return value;
    }
    _gate(on,time) {
      for (const m of this.modules.values()) if (m.envelope) {
        const p=m.params, level=this._envValue(m,time), param=m.envelope;
        // Analytic value keeps retriggers continuous even without cancelAndHoldAtTime.
        param.cancelScheduledValues(time); param.linearRampToValueAtTime(level,time);
        m.envelopeEvents = m.envelopeEvents.filter(x=>x.time<time);
        m.envelopeEvents.push({time,kind:on?'on':'off',from:level,...p});
        if (m.envelopeEvents.length > 256) m.envelopeEvents = m.envelopeEvents.slice(-128);
        if (on) { param.linearRampToValueAtTime(1,time+p.attack); param.linearRampToValueAtTime(p.sustain,time+p.attack+p.decay); }
        else param.linearRampToValueAtTime(0,time+p.release);
      }
    }
    _pitch(note,time) {
      const hz = ModularSynth.midiToFrequency(note);
      for (const m of this.modules.values()) if (m.type === 'oscillator') {
        const param=m.controls.frequency; param.cancelScheduledValues(time); param.setTargetAtTime(hz,time,.003);
      }
    }
    noteOn(note, time = this.context.currentTime) {
      this._alive(); number(note,0,127,'MIDI note'); number(time,0,Number.MAX_VALUE,'time'); time=Math.max(time,this.context.currentTime);
      this.unmute(); this.held = this.held.filter(n=>n!==note); this.held.push(note); this._pitch(note,time); this._gate(true,time); return this;
    }
    noteOff(note, time = this.context.currentTime) {
      this._alive(); if (note !== undefined) number(note,0,127,'MIDI note'); number(time,0,Number.MAX_VALUE,'time'); time=Math.max(time,this.context.currentTime);
      const active=this.held.at(-1); this.held = note === undefined ? [] : this.held.filter(n=>n!==note);
      if (note === undefined || note === active) {
        if (this.held.length) this._pitch(this.held.at(-1),time); else this._gate(false,time);
      }
      return this;
    }
    panic() {
      this._alive(); this.stopSequencer(); this.held=[]; const time=this.context.currentTime;
      for (const m of this.modules.values()) {
        if (m.envelope) {
          const level=this._envValue(m,time);
          m.envelope.cancelScheduledValues(time); m.envelope.linearRampToValueAtTime(level,time);
          m.envelope.linearRampToValueAtTime(0,time+.005);
          m.envelopeEvents=[{kind:'off',time,from:level,release:.005}];
        }
        if (m.type==='oscillator') m.controls.frequency.cancelScheduledValues(time);
      }
      // Mute continuous patches and echo tails until the next note or sequencer run.
      this.master.gain.cancelScheduledValues(time); this.master.gain.setTargetAtTime(0,time,.003); return this;
    }
    unmute() { this._alive(); this.master.gain.cancelScheduledValues(this.context.currentTime); this.master.gain.setTargetAtTime(1,this.context.currentTime,.005); return this; }
    startSequencer({steps=[48,48,55,null,48,60,55,null,46,46,53,null,46,58,53,null], bpm=110, gate=.65, onStep}={}) {
      this._alive(); number(bpm,30,300,'BPM'); number(gate,.05,.95,'Gate');
      if (!Array.isArray(steps) || !steps.length || steps.length>64) throw new TypeError('Use 1–64 sequencer steps');
      steps=Array.from(steps); // Own a dense snapshot; edits cannot corrupt a running scheduler.
      steps.forEach(n=>{if(n!==null) number(n,0,127,'Step note');});
      if (onStep !== undefined && typeof onStep !== 'function') throw new TypeError('onStep must be a function');
      this.stopSequencer(); this.unmute(); const generation=++this.sequenceGeneration;
      let index=0, next=this.context.currentTime+.03; const duration=60/bpm/4;
      const schedule = () => {
        if (generation !== this.sequenceGeneration || this.destroyed) return;
        if (this.context.state !== 'running') { next=this.context.currentTime+.03; return; }
        if (next < this.context.currentTime) next=this.context.currentTime+.01;
        while(next < this.context.currentTime+.1) {
          const step=index%steps.length, note=steps[step], time=next;
          if (note !== null) { this._pitch(note,time); this._gate(true,time); this._gate(false,time+duration*gate); }
          if (onStep) { const timer=setTimeout(()=>{this.sequenceEvents=this.sequenceEvents.filter(t=>t!==timer); if(generation===this.sequenceGeneration && this.context.state==='running') onStep(step);},Math.max(0,(time-this.context.currentTime)*1000)); this.sequenceEvents.push(timer); }
          index++; next+=duration;
        }
      };
      this.sequenceTimer=setInterval(schedule,25); schedule(); return this;
    }
    stopSequencer() {
      clearInterval(this.sequenceTimer); this.sequenceTimer=null; this.sequenceGeneration++;
      this.sequenceEvents.forEach(clearTimeout); this.sequenceEvents=[];
      if (!this.destroyed) {
        const t=this.context.currentTime;
        for(const m of this.modules.values()) if(m.type==='oscillator') m.controls.frequency.cancelScheduledValues(t);
        this.held=[]; this._gate(false,t);
      }
      return this;
    }
    toJSON() { return {version:PATCH_VERSION, modules:[...this.modules.values()].map(({id,type,params})=>({id,type,params:{...params}})),connections:this.connections.map(({from,output,to,input,amount})=>({from,output,to,input,amount}))}; }
    static validatePatch(patch) {
      if (!patch || typeof patch!=='object' || patch.version!==PATCH_VERSION || !Array.isArray(patch.modules) || !Array.isArray(patch.connections)) throw new TypeError('Invalid patch or unsupported version');
      if(patch.modules.length>64 || patch.connections.length>256) throw new RangeError('Patch limit: 64 modules / 256 connections');
      const map=new Map();
      for(const m of patch.modules) { if(!m || !validId(m.id) || map.has(m.id)) throw new TypeError('Invalid or duplicate module ID'); validateParams(m.type,m.params); map.set(m.id,m); }
      const edges=[], keys=new Set();
      for(const x of patch.connections) {
        if(!x || !map.has(x.from) || !map.has(x.to)) throw new TypeError('Connection references a missing module');
        const a=definitions[map.get(x.from).type].outputs[x.output], b=definitions[map.get(x.to).type].inputs[x.input];
        if(!Object.hasOwn(definitions[map.get(x.from).type].outputs,x.output) || !Object.hasOwn(definitions[map.get(x.to).type].inputs,x.input) || a!==b) throw new TypeError('Invalid connection ports'); number(x.amount,-10000,10000,'Connection amount');
        const key=JSON.stringify([x.from,x.output,x.to,x.input]); if(keys.has(key)) throw new Error('Duplicate connection'); keys.add(key);
        const seen=new Set(); const reaches=id=>{if(id===x.from)return true;if(seen.has(id))return false;seen.add(id);return edges.filter(e=>e.from===id).some(e=>reaches(e.to));};
        if(reaches(x.to))throw new Error('Feedback patch cycles are unsupported'); edges.push(x);
      }
      return patch;
    }
    loadPatch(patch) {
      this._alive(); ModularSynth.validatePatch(patch);
      // Build an isolated rack first. Native node/allocation failures keep the current patch alive.
      const staged=Object.create(ModularSynth.prototype);
      Object.assign(staged,{context:this.context,modules:new Map(),connections:[],counter:this.counter,destroyed:false});
      staged.rackOutput=this.context.createGain(); staged.rackOutput.gain.value=0;
      try {
        for(const m of patch.modules)staged.create(m.type,m.params,m.id);
        for(const x of patch.connections)staged.connect(x.from,x.output,x.to,x.input,x.amount);
        staged.rackOutput.connect(this.master);
      } catch (error) {
        for(const id of [...staged.modules.keys()])staged.remove(id);
        staged.rackOutput.disconnect();
        throw error;
      }
      this.stopSequencer();
      for(const id of [...this.modules.keys()])this.remove(id);
      this.rackOutput.disconnect();
      this.modules=staged.modules; this.connections=staged.connections;
      this.rackOutput=staged.rackOutput; this.counter=staged.counter;
      this.rackOutput.gain.setValueAtTime(1,this.context.currentTime);
      this.unmute(); return this;
    }
    async destroy() {
      if(this.destroyed)return; this.stopSequencer(); for(const id of [...this.modules.keys()])this.remove(id);
      this.rackOutput.disconnect(); this.master.disconnect(); this.compressor.disconnect(); this.analyser.disconnect(); this.destroyed=true;
      if(this.ownsContext && this.context.state!=='closed') await this.context.close();
    }
    static midiToFrequency(note) { number(note,0,127,'MIDI note'); return 440*Math.pow(2,(note-69)/12); }
    static get version() { return VERSION; }
    static get definitions() { return JSON.parse(JSON.stringify(definitions)); }
  }
  return ModularSynth;
});
