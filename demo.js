/* Interactive demo for Modular Synth JS. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id), defs=ModularSynth.definitions;
  const names=['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
  const noteName=n=>names[n%12]+(Math.floor(n/12)-1);
  const presetPatch=kind=>{
    if(kind==='blank')return {version:'1.0.0',modules:[{id:'output',type:'output',params:{volume:.35}}],connections:[]};
    const soft=kind==='soft', space=kind==='space';
    const modules=[
      {id:'osc',type:'oscillator',params:{wave:soft?'triangle':'sawtooth',level:.55,detune:0,frequency:130.81}},
      {id:'filter',type:'filter',params:{cutoff:soft?1500:space?750:350,resonance:soft?1:space?4:8}},
      {id:'amp',type:'vca',params:{gain:0}},
      {id:'env',type:'envelope',params:{attack:soft?.12:space?.3:.008,decay:soft?.6:.22,sustain:soft?.65:space?.75:.2,release:soft?.8:space?1.8:.16,amount:.8}},
      {id:'lfo',type:'lfo',params:{rate:soft?.3:space?.17:2.2,depth:soft?150:space?450:90}},
      {id:'output',type:'output',params:{volume:.45}}
    ];
    const connections=[{from:'osc',output:'out',to:'filter',input:'in',amount:1},{from:'filter',output:'out',to:'amp',input:'in',amount:1},{from:'env',output:'out',to:'amp',input:'gain',amount:1},{from:'lfo',output:'out',to:'filter',input:'cutoff',amount:1},{from:'amp',output:'out',to:'output',input:'in',amount:1}];
    if(!soft&&!space){modules.push({id:'sweep',type:'envelope',params:{attack:.003,decay:.18,sustain:0,release:.1,amount:2200}});connections.push({from:'sweep',output:'out',to:'filter',input:'cutoff',amount:1});}
    if(space){modules.push({id:'echo',type:'delay',params:{time:.375,feedback:.5,mix:.35}});connections.pop();connections.push({from:'amp',output:'out',to:'echo',input:'in',amount:1},{from:'echo',output:'out',to:'output',input:'in',amount:1});}
    return {version:'1.0.0',modules,connections};
  };
  let synth, selected=null, playing=false, starting=false, base=48, playRequest=0, patchRequest=0;
  const pointers=new Map(), heldKeys=new Map();
  function message(text,error=false){$('message').textContent=text;$('message').classList.toggle('error',error);}
  function run(fn){try{return fn();}catch(e){message(e.message,true);}}
  async function enable(){if(!synth)throw new Error('Web Audio is unavailable');await synth.resume();$('power').textContent='Audio enabled';$('audio-status').textContent='Audio running';$('audio-status').classList.add('running');}
  async function safelyEnable(){try{await enable();return true;}catch(e){message(e.message,true);return false;}}
  function stop(){playRequest++;starting=false;if(!synth)return;synth.stopSequencer();playing=false;$('play').textContent='▶ Play';document.querySelectorAll('.step.active').forEach(x=>x.classList.remove('active'));}
  function releaseAll(){heldKeys.clear();pointers.clear();if(synth)synth.noteOff();document.querySelectorAll('.key.down').forEach(x=>x.classList.remove('down'));}
  function ports(m,dir){const column=document.createElement('div');column.className='ports-col';for(const [name,type] of Object.entries(defs[m.type][dir==='input'?'inputs':'outputs'])){const b=document.createElement('button');b.type='button';b.className=`port ${dir} ${type}`;b.dataset.id=m.id;b.dataset.port=name;b.dataset.dir=dir;b.setAttribute('aria-label',`${m.id} ${name} ${dir}, ${type}`);const jack=document.createElement('span');jack.className='jack';const label=document.createElement('span');label.textContent=name; b.append(jack,label);b.onclick=()=>patchPort(b);column.append(b);}return column;}
  const logarithmic=new Set(['frequency','cutoff','attack','decay','release','rate','amount','depth']);
  function sliderValue(value,d,log){
    if(!log)return value;
    return 1000*(d.min>0?Math.log(value/d.min)/Math.log(d.max/d.min):Math.log1p(value)/Math.log1p(d.max));
  }
  function parameterValue(value,d,log){
    if(!log)return Number(value);
    const raw=d.min>0?d.min*Math.pow(d.max/d.min,value/1000):Math.expm1(value/1000*Math.log1p(d.max));
    const precision=Math.max(0,(String(d.step).split('.')[1]||'').length);
    return Math.min(d.max,Math.max(d.min,Number(raw.toFixed(precision))));
  }
  function validateDemoState(d){
    if(!d || typeof d!=='object' || !Array.isArray(d.steps) || d.steps.length!==16 || Array.from(d.steps).some(n=>n!==null&&(!Number.isInteger(n)||n<36||n>84)))throw new Error('Use 16 steps with notes from C2 to C6 or rests.');
    if(!Number.isFinite(d.bpm)||d.bpm<30||d.bpm>300)throw new Error('Tempo must be between 30 and 300 BPM.');
    if(!Number.isFinite(d.gate)||d.gate<.05||d.gate>.95)throw new Error('Gate must be between 5% and 95%.');
    return d;
  }
  function demoState(){return validateDemoState({steps:[...$('steps').querySelectorAll('select')].map(e=>e.value==='rest'?null:Number(e.value)),bpm:Number($('bpm').value),gate:Number($('gate').value)});}
  function render(){
    selected=null;const host=$('modules');host.replaceChildren();
    for(const m of synth.modules.values()){
      const card=document.createElement('article');card.className='module';card.dataset.type=m.type;card.dataset.module=m.id;
      const head=document.createElement('div');head.className='module-head';const title=document.createElement('div');const h=document.createElement('h2');h.textContent=defs[m.type].label;const id=document.createElement('span');id.className='module-id';id.textContent=m.id;title.append(h,id);const remove=document.createElement('button');remove.className='remove';remove.textContent='×';remove.setAttribute('aria-label',`Remove ${m.id}`);remove.onclick=()=>run(()=>{synth.remove(m.id);render();});head.append(title,remove);card.append(head);
      const controls=document.createElement('div');controls.className='controls';
      for(const [key,d] of Object.entries(defs[m.type].params)){
        const row=document.createElement('div');row.className='control';const top=document.createElement('div');top.className='control-top';
        const label=document.createElement('label');label.htmlFor=`${m.id}-${key}`;label.id=`${m.id}-${key}-label`;
        const name=()=>key==='resonance'?`resonance (${['lowpass','highpass'].includes(m.params.type)?'dB':'Q'})`:(d.unit?`${key} (${d.unit})`:key);
        label.textContent=name();top.append(label);
        const input=document.createElement(d.values?'select':'input');input.id=`${m.id}-${key}`;
        if(d.values){
          for(const value of d.values){const o=document.createElement('option');o.value=value;o.textContent=value;input.append(o);}
          input.value=m.params[key];input.onchange=()=>run(()=>{synth.set(m.id,key,input.value);if(m.type==='filter'&&key==='type')$(`${m.id}-resonance-label`).textContent=`resonance (${['lowpass','highpass'].includes(input.value)?'dB':'Q'})`;});
        }else{
          const log=logarithmic.has(key);input.type='range';input.min=log?0:d.min;input.max=log?1000:d.max;input.step=log?'any':d.step;
          const number=document.createElement('input');number.type='number';number.className='param-number';number.min=d.min;number.max=d.max;number.step='any';number.id=`${m.id}-${key}-number`;
          number.setAttribute('aria-label',`${m.id} ${key}${d.unit?' in '+d.unit:''}`);number.title=`${d.min}–${d.max}${d.unit?' '+d.unit:''}`;
          const sync=()=>{number.value=m.params[key];input.value=sliderValue(m.params[key],d,log);input.setAttribute('aria-valuetext',`${m.params[key]}${d.unit?' '+d.unit:''}`);};
          input.oninput=()=>{run(()=>synth.set(m.id,key,parameterValue(Number(input.value),d,log)));sync();};
          number.onchange=()=>{run(()=>{if(number.value.trim()==='')throw new Error(`Enter a number for ${key}.`);synth.set(m.id,key,Number(number.value));});sync();};
          number.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();number.onchange();}};
          sync();top.append(number);
        }
        row.append(top,input);controls.append(row);
      }
      const desc=document.createElement('p');desc.className='module-desc';desc.textContent=defs[m.type].description;
      const portRow=document.createElement('div');portRow.className='ports';portRow.append(ports(m,'input'),ports(m,'output'));card.append(controls,desc,portRow);host.append(card);
    }
    $('rack-count').textContent=`${synth.modules.size} MODULES / ${synth.connections.length} CABLES`;renderConnections();requestAnimationFrame(drawCables);
  }
  function patchPort(button){
    if(!selected){selected=button;button.classList.add('selected');message(`Selected ${button.dataset.id}.${button.dataset.port}. Choose a matching ${button.dataset.dir==='output'?'input':'output'} port. Escape cancels.`);return;}
    if(selected===button){selected.classList.remove('selected');selected=null;message('Connection cancelled.');return;}
    if(selected.dataset.dir===button.dataset.dir){selected.classList.remove('selected');selected=button;button.classList.add('selected');return;}
    const a=selected.dataset.dir==='output'?selected:button,b=a===selected?button:selected;
    run(()=>{synth.connect(a.dataset.id,a.dataset.port,b.dataset.id,b.dataset.port);message(`Connected ${a.dataset.id}.${a.dataset.port} → ${b.dataset.id}.${b.dataset.port}`);});
    selected.classList.remove('selected');selected=null;renderConnections();drawCables();
  }
  function portFor(id,name,dir){return [...document.querySelectorAll('.port')].find(e=>e.dataset.id===id&&e.dataset.port===name&&e.dataset.dir===dir);}
  function renderConnections(){
    const host=$('connections');host.replaceChildren();document.querySelectorAll('.port').forEach(x=>x.classList.remove('connected'));
    synth.connections.forEach(c=>{const row=document.createElement('div');row.className='connection';const text=document.createElement('span');text.textContent=`${c.from}.${c.output} → ${c.to}.${c.input} × ${c.amount}`;const del=document.createElement('button');del.textContent='×';del.setAttribute('aria-label',`Disconnect ${c.from} to ${c.to}`);del.onclick=()=>run(()=>{synth.disconnect(c);renderConnections();drawCables();});row.append(text,del);host.append(row);portFor(c.from,c.output,'output')?.classList.add('connected');portFor(c.to,c.input,'input')?.classList.add('connected');});
    if(!synth.connections.length)host.textContent='No connections. Start with an oscillator → filter → VCA → output.';
    $('connection-count').textContent=`(${synth.connections.length})`;$('rack-count').textContent=`${synth.modules.size} MODULES / ${synth.connections.length} CABLES`;
  }
  function drawCables(){
    if(!synth)return;const svg=$('cables'),rect=$('rack').getBoundingClientRect();svg.replaceChildren();svg.setAttribute('viewBox',`0 0 ${rect.width} ${rect.height}`);
    synth.connections.forEach((c,i)=>{const a=portFor(c.from,c.output,'output')?.querySelector('.jack'),b=portFor(c.to,c.input,'input')?.querySelector('.jack');if(!a||!b)return;const ar=a.getBoundingClientRect(),br=b.getBoundingClientRect();const x1=ar.left+ar.width/2-rect.left,y1=ar.top+ar.height/2-rect.top,x2=br.left+br.width/2-rect.left,y2=br.top+br.height/2-rect.top;const bend=Math.min(70,20+Math.abs(x2-x1)*.13)+(i%3)*6;const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',`M${x1},${y1} C${x1+25},${y1+bend} ${x2-25},${y2+bend} ${x2},${y2}`);path.setAttribute('stroke',defs[synth.get(c.from).type].outputs[c.output]==='cv'?'#f0bc77':'#82d7c0');path.setAttribute('class','cable');svg.append(path);});
  }
  const initialSteps=[48,48,55,null,48,60,55,null,46,46,53,null,46,58,53,null];
  initialSteps.forEach((n,i)=>{const cell=document.createElement('div');cell.className='step';const label=document.createElement('label');label.textContent=String(i+1).padStart(2,'0');label.htmlFor=`step-${i}`;const input=document.createElement('select');input.id=`step-${i}`;input.setAttribute('aria-label',`Step ${i+1} note`);for(const value of [null,...Array.from({length:49},(_,j)=>j+36)]){const o=document.createElement('option');o.value=value===null?'rest':value;o.textContent=value===null?'—':noteName(value);input.append(o);}input.value=n===null?'rest':n;cell.append(label,input);$('steps').append(cell);});
  function updateKey(note,down){const el=[...document.querySelectorAll('.key')].find(x=>Number(x.dataset.note)===note);if(el)el.classList.toggle('down',down);}
  function keyboard(){
    releaseAll();const host=$('keyboard');host.replaceChildren();const white=[0,2,4,5,7,9,11,12],black=[{n:1,x:1},{n:3,x:2},{n:6,x:4},{n:8,x:5},{n:10,x:6}];
    for(const n of [...white,...black.map(x=>x.n)]){const b=document.createElement('button');b.className='key';b.dataset.note=base+n;b.setAttribute('aria-label',`Play ${noteName(base+n)}`);if(black.some(x=>x.n===n)){b.classList.add('black');b.style.left=`${black.find(x=>x.n===n).x*12.5-3.5}%`;}const label=document.createElement('span');label.textContent=noteName(base+n);b.append(label);
      b.onpointerdown=async e=>{e.preventDefault();b.setPointerCapture(e.pointerId);const token={note:base+n};pointers.set(e.pointerId,token);if(await safelyEnable() && pointers.get(e.pointerId)===token){if(playing||starting)stop();synth.noteOn(token.note);updateKey(token.note,true);}};
      const off=e=>{const token=pointers.get(e.pointerId);if(!token)return;pointers.delete(e.pointerId);if(![...pointers.values()].some(t=>t.note===token.note)&&![...heldKeys.values()].some(t=>t.note===token.note)){run(()=>synth.noteOff(token.note));updateKey(token.note,false);}};
      b.onpointerup=off;b.onpointercancel=off;b.onlostpointercapture=off;host.append(b);
    }
  }
  const keyMap={a:0,w:1,s:2,e:3,d:4,f:5,t:6,g:7,y:8,h:9,u:10,j:11,k:12};
  window.addEventListener('keydown',async e=>{
    if(e.key==='Escape'){if(selected){selected.classList.remove('selected');selected=null;message('Connection cancelled.');}return;}
    if(e.repeat||e.ctrlKey||e.metaKey||e.altKey||/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName))return;
    const key=e.key.toLowerCase();if(keyMap[key]===undefined||heldKeys.has(key))return;e.preventDefault();const token={note:base+keyMap[key]};heldKeys.set(key,token);
    if(await safelyEnable()&&heldKeys.get(key)===token){if(playing||starting)stop();synth.noteOn(token.note);updateKey(token.note,true);}
  });
  window.addEventListener('keyup',e=>{const key=e.key.toLowerCase(),token=heldKeys.get(key);if(!token)return;heldKeys.delete(key);if(![...heldKeys.values()].some(t=>t.note===token.note)&&![...pointers.values()].some(t=>t.note===token.note)){run(()=>synth.noteOff(token.note));updateKey(token.note,false);}});
  window.addEventListener('blur',()=>{releaseAll();stop();});document.addEventListener('visibilitychange',()=>{if(document.hidden){releaseAll();stop();}});
  $('power').onclick=safelyEnable;$('panic').onclick=()=>run(()=>{stop();releaseAll();synth.panic();message('Output muted. Play a note or start the sequencer to resume.');});
  $('add').onclick=()=>run(()=>{if(synth.modules.size>=64)throw new Error('Maximum 64 modules');synth.create($('module-type').value);render();message('Module added. Patch its ports to connect it.');});
  $('load-preset').onclick=()=>run(()=>{patchRequest++;stop();releaseAll();synth.loadPatch(presetPatch($('preset').value));render();message('Patch loaded. Enable audio and play the keyboard or sequencer.');});
  $('play').onclick=async()=>{
    if(playing||starting){stop();return;}
    const request=++playRequest;starting=true;$('play').textContent='■ Cancel';
    if(!await safelyEnable()){if(request===playRequest)stop();return;}
    if(request!==playRequest)return;
    try{releaseAll();synth.startSequencer({...demoState(),onStep:i=>document.querySelectorAll('.step').forEach((e,j)=>e.classList.toggle('active',i===j))});starting=false;playing=true;$('play').textContent='■ Stop';}
    catch(error){stop();message(error.message,true);}
  };
  $('gate').oninput=()=>{$('gate-value').textContent=Math.round(Number($('gate').value)*100)+'%';};$('octave').onchange=()=>{base=Number($('octave').value);keyboard();};
  $('save').onclick=()=>run(()=>{const settings=demoState(),patch=synth.toJSON();patch.demo=settings;const url=URL.createObjectURL(new Blob([JSON.stringify(patch,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='modular-synth-patch.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);message('Patch exported as JSON.');});
  $('import').onclick=()=>$('file').click();
  $('file').onchange=async e=>{
    const file=e.target.files[0];if(!file)return;const request=++patchRequest;
    try{
      if(file.size>1024*1024)throw new Error('Patch file is too large (maximum 1 MB)');
      const text=await file.text();if(request!==patchRequest)return;
      const patch=JSON.parse(text);ModularSynth.validatePatch(patch);
      if(patch.demo!==undefined)validateDemoState(patch.demo);
      stop();releaseAll();synth.loadPatch(patch);
      if(patch.demo){patch.demo.steps.forEach((n,i)=>{$(`step-${i}`).value=n===null?'rest':n;});$('bpm').value=patch.demo.bpm;$('gate').value=patch.demo.gate;$('gate').oninput();}
      render();message('Patch imported.');
    }catch(error){if(request===patchRequest)message(error.message,true);}
    finally{if(request===patchRequest)e.target.value='';}
  };
  for(const [type,def] of Object.entries(defs)){const o=document.createElement('option');o.value=type;o.textContent=def.label;$('module-type').append(o);}
  try{synth=new ModularSynth();synth.loadPatch(presetPatch('bass'));synth.context.addEventListener('statechange',()=>{$('audio-status').textContent=synth.context.state==='running'?'Audio running':'Audio sleeping';$('audio-status').classList.toggle('running',synth.context.state==='running');$('power').textContent=synth.context.state==='running'?'Audio enabled':'Enable audio';});render();keyboard();}catch(e){message(e.message,true);document.querySelectorAll('button').forEach(x=>x.disabled=true);}
  const rackObserver=typeof ResizeObserver==='function'?new ResizeObserver(drawCables):null;
  rackObserver?.observe($('rack'));window.addEventListener('resize',drawCables);
  const canvas=$('scope'),ctx=canvas.getContext('2d'),data=new Float32Array(2048);
  let scopeFrame;
  function scope(){
    ctx.clearRect(0,0,canvas.width,canvas.height);ctx.strokeStyle='#223639';ctx.lineWidth=1;ctx.beginPath();for(let i=1;i<8;i++){const x=i*canvas.width/8;ctx.moveTo(x,0);ctx.lineTo(x,canvas.height);}for(let i=1;i<4;i++){const y=i*canvas.height/4;ctx.moveTo(0,y);ctx.lineTo(canvas.width,y);}ctx.stroke();
    if(synth)synth.analyser.getFloatTimeDomainData(data);ctx.strokeStyle='#82d7c0';ctx.lineWidth=1.8;ctx.beginPath();let peak=0;for(let i=0;i<data.length;i++){const x=i/(data.length-1)*canvas.width,y=canvas.height/2-data[i]*canvas.height*.43;peak=Math.max(peak,Math.abs(data[i]));if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.stroke();$('peak').textContent=peak>.98?'HIGH LEVEL':peak<.0001?'SILENT':`${(20*Math.log10(peak)).toFixed(1)} dBFS`;$('peak').classList.toggle('hot',peak>.98);scopeFrame=requestAnimationFrame(scope);
  }scope();
  window.addEventListener('pagehide',e=>{patchRequest++;stop();releaseAll();cancelAnimationFrame(scopeFrame);if(!e.persisted){rackObserver?.disconnect();synth?.destroy();}});
  window.addEventListener('pageshow',e=>{if(e.persisted){drawCables();scope();}});
})();
