/* Runeveld – geluid: korte effecten, live gesynthetiseerd met WebAudio (geen bestanden nodig).
   Alles gaat via één hoofdvolume; 'runeveld.geluid'='0' in localStorage zet het uit. */
let ctx=null,hoofd=null,ruisBuf=null;
let aan=(()=>{try{return localStorage.getItem('runeveld.geluid')!=='0'}catch(e){return true}})();

/* na de eerste klik/toets mag de browser geluid afspelen */
export function wek(){
  if(ctx){if(ctx.state==='suspended')ctx.resume();return}
  const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
  ctx=new AC();hoofd=ctx.createGain();hoofd.gain.value=aan?.5:0;hoofd.connect(ctx.destination);
  ruisBuf=ctx.createBuffer(1,ctx.sampleRate*.5,ctx.sampleRate);const d=ruisBuf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
}
export const isAan=()=>aan;
export function zetAan(v){aan=v;try{localStorage.setItem('runeveld.geluid',v?'1':'0')}catch(e){}if(hoofd)hoofd.gain.setTargetAtTime(v?.5:0,ctx.currentTime,.02)}

const klaar=()=>ctx&&aan&&ctx.state==='running';
/* een toon: type, frequentie (begin→eind), duur, volume, met korte aanzet en uitloop */
function toon(type,f0,f1,duur,vol=.3,start=0){
  const t=ctx.currentTime+start,o=ctx.createOscillator(),g=ctx.createGain();
  o.type=type;o.frequency.setValueAtTime(f0,t);if(f1!==f0)o.frequency.exponentialRampToValueAtTime(Math.max(1,f1),t+duur);
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+.008);g.gain.exponentialRampToValueAtTime(.001,t+duur);
  o.connect(g);g.connect(hoofd);o.start(t);o.stop(t+duur+.02);
}
/* ruis door een filter: voor zwaaien, klappen en gekraak */
function ruis(duur,vol=.3,{f0=1200,f1=300,type='bandpass',q=1,start=0}={}){
  const t=ctx.currentTime+start,s=ctx.createBufferSource(),fl=ctx.createBiquadFilter(),g=ctx.createGain();
  s.buffer=ruisBuf;fl.type=type;fl.Q.value=q;fl.frequency.setValueAtTime(f0,t);if(f1!==f0)fl.frequency.exponentialRampToValueAtTime(Math.max(1,f1),t+duur);
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+.005);g.gain.exponentialRampToValueAtTime(.001,t+duur);
  s.connect(fl);fl.connect(g);g.connect(hoofd);s.start(t);s.stop(t+duur+.02);
}

export const G={
  zwaai(){if(!klaar())return;ruis(.12,.18,{f0:1800,f1:400,q:.8})},
  raak(crit){if(!klaar())return;toon('triangle',180,55,.14,.35);ruis(.06,.25,{f0:2500,f1:800,q:.6});
    if(crit){toon('square',660,330,.12,.12,.02);toon('sine',1320,1320,.18,.12,.04);ruis(.18,.2,{f0:3000,f1:600})}},
  mis(){if(!klaar())return;ruis(.16,.1,{f0:900,f1:200,q:1.5})},
  pijn(){if(!klaar())return;toon('sawtooth',140,70,.16,.22);ruis(.08,.2,{f0:600,f1:150,type:'lowpass'})},
  dood(){if(!klaar())return;toon('sawtooth',220,40,.6,.25);ruis(.4,.2,{f0:800,f1:100,type:'lowpass'})},
  monsterDood(){if(!klaar())return;toon('square',300,90,.22,.14);ruis(.2,.18,{f0:1500,f1:200})},
  buit(){if(!klaar())return;toon('square',880,880,.07,.12);toon('square',1320,1320,.12,.12,.07)},
  drank(){if(!klaar())return;toon('sine',420,900,.18,.18);toon('sine',640,1200,.16,.12,.08)},
  levelUp(){if(!klaar())return;[523,659,784,1047].forEach((f,i)=>toon('square',f,f,.22,.12,i*.09));toon('triangle',1047,2093,.5,.12,.36)},
  quest(){if(!klaar())return;[659,880,1319].forEach((f,i)=>toon('triangle',f,f,.25,.16,i*.11))},
  skill(){if(!klaar())return;toon('sawtooth',200,900,.22,.14);ruis(.25,.22,{f0:400,f1:3000,q:.5})},
  klik(){if(!klaar())return;toon('square',1200,1200,.03,.06)},
};
