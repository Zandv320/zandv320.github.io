/* Runeveld – multiplayer via een publieke MQTT-broker (zoals Velmora).
   Iedereen stuurt zijn eigen positie; de speler die het langst online is ("host") simuleert de monsters.
   Zonder verbinding werkt het spel gewoon alleen. */
const URLS=['wss://broker.hivemq.com:8884/mqtt','wss://broker.emqx.io:8084/mqtt','wss://test.mosquitto.org:8081/mqtt'];
const TOPIC='zandv320/runeveld/v1/';
const MQTT_CDN='https://cdn.jsdelivr.net/npm/mqtt@5.10.1/dist/mqtt.min.js';

function laadScript(src){return new Promise((res,rej)=>{const s=document.createElement('script');s.src=src;s.onload=res;s.onerror=rej;document.head.appendChild(s)})}

export function maakNet(){
  const handlers={},spelers=new Map(),gezien=new Map();
  const me=Date.now().toString(36).padStart(9,'0')+'-'+Math.random().toString(36).slice(2,8);
  let client=null,verbonden=false,host=false,myPres={},gesloten=false;
  const hostFns=[],spelerFns=[],connFns=[];
  const fire=(t,d,f,isMe)=>(handlers[t]||[]).forEach(fn=>{try{fn(d,f,isMe)}catch(e){console.error(e)}});
  const elect=()=>{let h=me;for(const id of spelers.keys())if(id<h)h=id;const v=h===me;if(v!==host){host=v;hostFns.forEach(f=>f(v))}};
  const hostId=()=>{let h=me;for(const id of spelers.keys())if(id<h)h=id;return h};
  const setConn=v=>{if(verbonden!==v){verbonden=v;connFns.forEach(f=>f(v))}};
  const firePeers=(weg=[])=>spelerFns.forEach(f=>{try{f(spelers,weg)}catch(e){console.error(e)}});
  function publish(k,obj){if(client&&client.connected)client.publish(TOPIC+k,JSON.stringify(obj),{qos:0})}

  function verbind(url){return new Promise(res=>{
    let klaar=false;const c=mqtt.connect(url,{clientId:'rv_'+me.replace(/[^a-z0-9]/g,''),clean:true,keepalive:20,reconnectPeriod:3000,connectTimeout:8000,
      will:{topic:TOPIC+'x',payload:JSON.stringify({f:me}),qos:0,retain:false}});
    const to=setTimeout(()=>{if(!klaar){klaar=true;try{c.end(true)}catch(e){}res(null)}},9000);
    c.on('connect',()=>{c.subscribe(TOPIC+'#',{qos:0},()=>{if(!klaar){klaar=true;clearTimeout(to);res(c)}setConn(true);publish('p',{f:me,p:myPres})})});
    c.on('close',()=>setConn(false));c.on('offline',()=>setConn(false));c.on('error',()=>{});
    c.on('message',(topic,buf)=>{let m;try{m=JSON.parse(buf.toString())}catch(e){return}
      if(!m||typeof m!=='object'||typeof m.f!=='string'||m.f===me)return;
      const k=topic.slice(TOPIC.length);gezien.set(m.f,Date.now());
      if(k==='p'){const nieuw=!spelers.has(m.f);spelers.set(m.f,m.p||{});if(nieuw)elect();firePeers()}
      else if(k==='x'){if(spelers.delete(m.f)){gezien.delete(m.f);elect();firePeers([m.f])}}
      else if(k==='e'){if(!spelers.has(m.f)){spelers.set(m.f,{});elect();firePeers()}if(m.to&&m.to!==me)return;fire(m.t,m.d,m.f,false)}});
  })}

  (async function start(){
    elect(); /* alleen = host */
    try{if(typeof mqtt==='undefined')await laadScript(MQTT_CDN)}catch(e){}
    while(!gesloten){
      if(typeof mqtt!=='undefined')for(const u of URLS){client=await verbind(u);if(client)break}
      if(client)return;
      await new Promise(r=>setTimeout(r,20000));
    }
  })();

  /* heartbeat + opruimen van stille spelers */
  setInterval(()=>{if(gesloten)return;publish('p',{f:me,p:myPres});
    const nu=Date.now(),weg=[];for(const[id,t]of gezien)if(nu-t>8000){gezien.delete(id);if(spelers.delete(id))weg.push(id)}
    if(weg.length){elect();firePeers(weg)}},1500);
  addEventListener('pagehide',()=>{try{publish('x',{f:me});client&&client.end(true)}catch(e){}});

  return{
    me,spelers,
    verbonden:()=>verbonden,isHost:()=>host,hostId,
    aantal:()=>spelers.size+1,
    onHost(f){hostFns.push(f)},onSpelers(f){spelerFns.push(f)},onVerbinding(f){connFns.push(f)},
    aan(t,f){(handlers[t]=handlers[t]||[]).push(f)},
    /* stuurt naar iedereen (of één speler) en verwerkt het bericht meteen ook lokaal */
    stuur(t,d,to){publish('e',{f:me,t,d,to});if(!to||to===me)fire(t,d,me,true)},
    presence(p,direct=false){myPres=p;if(direct)publish('p',{f:me,p})},
  };
}
