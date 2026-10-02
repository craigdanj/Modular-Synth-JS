// A minimal DOM harness for event/state regressions. It does not perform layout or render audio.
const fs=require('node:fs'),vm=require('node:vm');
const Synth=require('../modular-synth.js');
const {context}=require('./web-audio-mock.cjs');
class Element {
  constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.attributes={};this.dataset={};this.style={};this.className='';this._text='';this._value=null;this.listeners={};}
  append(...nodes){for(const node of nodes){node.parent=this;this.children.push(node);}}
  replaceChildren(...nodes){this.children=[];this.append(...nodes);}
  setAttribute(name,value){this.attributes[name]=String(value);if(['id','class','value','type'].includes(name)){if(name==='class')this.className=String(value);else this[name]=String(value);}}
  getAttribute(name){return this.attributes[name];}
  get textContent(){return this._text+this.children.map(x=>x.textContent).join('');}
  set textContent(value){this._text=String(value);this.children=[];}
  get value(){if(this._value!==null)return this._value;if(this.tagName==='SELECT'){const options=this.children.filter(x=>x.tagName==='OPTION');return (options.find(x=>x.attributes.selected!==undefined)||options[0])?.value||'';}return '';}
  set value(v){this._value=String(v);}
  get classList(){const el=this;return {contains(c){return el.className.split(/\s+/).includes(c);},add(c){if(!this.contains(c))el.className=(el.className+' '+c).trim();},remove(c){el.className=el.className.split(/\s+/).filter(x=>x!==c).join(' ');},toggle(c,force){const on=force??!this.contains(c);if(on)this.add(c);else this.remove(c);return on;}};}
  matches(selector){if(selector.startsWith('.'))return selector.slice(1).split('.').every(x=>this.classList.contains(x));return this.tagName===selector.toUpperCase();}
  querySelectorAll(selector){const out=[];for(const c of this.children){if(c.matches(selector))out.push(c);out.push(...c.querySelectorAll(selector));}return out;}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  getBoundingClientRect(){return {left:0,top:0,width:20,height:20};}
  getContext(){return new Proxy({}, {get:()=>()=>{},set:()=>true});}
  setPointerCapture(){}
  click(){return this.onclick?.({target:this});}
  addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);}
  emit(type,event={}){return Promise.all((this.listeners[type]||[]).map(fn=>fn(event)));}
}
function parse(html){
  const root=new Element('document'),stack=[root];const voids=new Set(['META','LINK','INPUT','BR','HR']);
  for(const token of html.match(/<[^>]+>|[^<]+/g)||[]){
    if(token.startsWith('<!'))continue;
    if(token.startsWith('</')){if(stack.length>1)stack.pop();continue;}
    if(token.startsWith('<')){
      const tag=token.match(/^<([^\s>]+)/)?.[1];if(!tag)continue;const e=new Element(tag);
      const attrs=token.slice(tag.length+1,-1);for(const match of attrs.matchAll(/([\w-]+)(?:="([^"]*)")?/g))e.setAttribute(match[1],match[2]??'');
      stack.at(-1).append(e);if(!voids.has(e.tagName))stack.push(e);
    }else stack.at(-1)._text+=token;
  }
  root.createElement=tag=>new Element(tag);root.createElementNS=(_ns,tag)=>new Element(tag);
  root.getElementById=id=>{const walk=e=>e.id===id?e:e.children.map(walk).find(Boolean);return walk(root)||null;};
  root.hidden=false;root.body=root.querySelector('body');return root;
}
function harness(){
  const document=parse(fs.readFileSync(require.resolve('../index.html'),'utf8')),window=new Element('window');
  const c=context();c.addEventListener=()=>{};let resumeResolve=null,synth,starts=0,destroyed=0,downloads=0;
  const frames=new Map();let frame=0;
  class Engine extends Synth {
    constructor(){super({context:c});synth=this;}
    startSequencer(options){starts++;return super.startSequencer(options);}
    async destroy(){destroyed++;return super.destroy();}
  }
  const box={document,window,ModularSynth:Engine,console,Float32Array,Blob,
    ResizeObserver:class {observe(){}disconnect(){}},
    requestAnimationFrame:fn=>(frames.set(++frame,fn),frame),cancelAnimationFrame:id=>frames.delete(id),
    setTimeout,clearTimeout,URL:{createObjectURL:()=>{downloads++;return 'blob:test';},revokeObjectURL:()=>{}}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../demo.js'),'utf8'),box);
  return {document,window,synth,c,frames,get starts(){return starts;},get destroyed(){return destroyed;},get downloads(){return downloads;},
    $:id=>document.getElementById(id),
    suspend(){c.state='suspended';c.resume=()=>new Promise(resolve=>{resumeResolve=()=>{c.state='running';resolve();};});},
    resume(){resumeResolve?.();},
    close(){return synth.destroy();}};
}
module.exports={harness};
