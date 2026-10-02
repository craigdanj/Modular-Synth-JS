// Test double only: no audio samples are rendered.
class Param {
  constructor(value=0){this.value=value;this.events=[];}
  setValueAtTime(v,t){this.events.push(['set',v,t]);this.value=v;}
  linearRampToValueAtTime(v,t){this.events.push(['ramp',v,t]);this.value=v;}
  setTargetAtTime(v,t,k){this.events.push(['target',v,t,k]);this.value=v;}
  cancelScheduledValues(t){this.events=this.events.filter(e=>e[2]<t);}
}
class AudioNode {
  constructor(){for(const p of ['gain','frequency','detune','Q','delayTime','offset','threshold','knee','ratio','attack','release'])this[p]=new Param();this.links=[];this.gain.value=1;}
  connect(to){this.links.push(to);return to;}
  disconnect(to){this.links=to?this.links.filter(x=>x!==to):[];}
  getFloatTimeDomainData(data){data.fill(0);}
  start(){this.started=true;}
  stop(){this.stopped=true;}
}
function context(){return {currentTime:0,sampleRate:44100,state:'running',destination:new AudioNode(),createGain:()=>new AudioNode(),createOscillator:()=>new AudioNode(),createBiquadFilter:()=>new AudioNode(),createConstantSource:()=>new AudioNode(),createDelay:()=>new AudioNode(),createBufferSource:()=>new AudioNode(),createDynamicsCompressor:()=>new AudioNode(),createAnalyser:()=>new AudioNode(),createBuffer:(channels,length)=>({getChannelData:()=>new Float32Array(length)}),resume:async()=>{},close:async()=>{}};}

module.exports={Param,AudioNode,context};
