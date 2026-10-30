/* Runeveld – multiplayer. Eerst via de eigen spelserver op Cloudflare (server/, een WebSocket per speler); lukt dat
   niet, dan via een publieke MQTT-broker. In beide gevallen stuurt iedereen zijn eigen positie en simuleert de speler
   die het langst online is ("host") de monsters. Zonder verbinding werkt het spel gewoon alleen.
   SERVER: de workers.dev-adres van de server; te overschrijven met localStorage 'runeveld.server' (leeg = geen server). */
export const SERVER='';
const URLS=['wss://broker.hivemq.com:8884/mqtt','wss://broker.emqx.io:8084/mqtt','wss://test.mosquitto.org:8081/mqtt'];
const TOPIC='zandv320/runeveld/v1/';
const MQTT_CDN='https://cdn.jsdelivr.net/npm/mqtt@5.10.1/dist/mqtt.min.js';

function laadScript(src){return new Promise((res,rej)=>{const s=document.createElement('script');s.src=src;s.onload=res;s.onerror=rej;document.head.appendChild(s)})}

export function maakNet(){
  const handlers={},spelers=new Map(),gezien=new Map();
  const me=Date.now().toString(36).padStart(9,'0')+'-'+Math.random().toString(36).slice(2,8);
  let client=null,verbonden=false,host=false,myPres={},gesloten=false,brokerUrl='';
  const hostFns=[],spelerFns=[],connFns=[];
  const fire=(t,d,f,isMe)=>(handlers[t]||[]).forEach(fn=>{try{fn(d,f,isMe)}catch(e){console.error(e)}});
  const elect=()=>{let h=me;for(const id of spelers.keys())if(id<h)h=id;const v=h===me;if(v!==host){host=v;hostFns.forEach(f=>f(v))}};
  const hostId=()=>{let h=me;for(const id of spelers.keys())if(id<h)h=id;return h};
  const setConn=v=>{if(verbonden!==v){verbonden=v;connFns.forEach(f=>f(v))}};
  const firePeers=(weg=[])=>spelerFns.forEach(f=>{try{f(spelers,weg)}catch(e){console.error(e)}});
  let ws=null;   /* de WebSocket naar de eigen server, als die er is */
  function publish(k,obj){
    if(ws&&ws.readyState===1){if(k==='p')ws.send(JSON.stringify({k:'p',p:obj.p}));else if(k==='e')ws.send(JSON.stringify({k:'e',t:obj.t,d:obj.d,to:obj.to}));return}
    if(client&&client.connected)client.publish(TOPIC+k,JSON.stringify(obj),{qos:0})}
  /* een bericht van een andere speler, uit welke bron ook: k = 'p' status, 'x' weg, 'e' gebeurtenis */
  function verwerk(k,m){
    if(!m||typeof m!=='object'||typeof m.f!=='string'||m.f===me)return;
    gezien.set(m.f,Date.now());
    if(k==='p'){const nieuw=!spelers.has(m.f);spelers.set(m.f,m.p||{});if(nieuw)elect();firePeers()}
    else if(k==='x'){if(spelers.delete(m.f)){gezien.delete(m.f);elect();firePeers([m.f])}}
    else if(k==='e'){if(!spelers.has(m.f)){spelers.set(m.f,{});elect();firePeers()}if(m.to&&m.to!==me)return;fire(m.t,m.d,m.f,false)}
  }
  const serverUrl=()=>{let u=SERVER;try{const o=localStorage.getItem('runeveld.server');if(o!==null)u=o}catch(e){}return u.replace(/\/$/,'')};
  /* de eigen server: verbinden, aanmelden, en bij een breuk opnieuw proberen met oplopende wachttijd */
  function verbindServer(url){return new Promise(res=>{
    let klaar=false;let s;try{s=new WebSocket(url.replace(/^http/,'ws')+'/ws?wereld=v1')}catch(e){return res(false)}
    const to=setTimeout(()=>{if(!klaar){klaar=true;try{s.close()}catch(e){}res(false)}},8000);
    s.onopen=()=>{ws=s;s.send(JSON.stringify({k:'hi',f:me,p:myPres}))};
    s.onmessage=ev=>{let m;try{m=JSON.parse(ev.data)}catch(e){return}if(!m||typeof m!=='object')return;
      if(m.k==='hallo'){if(!klaar){klaar=true;clearTimeout(to);res(true)}for(const sp of m.spelers||[])verwerk('p',{f:sp.f,p:sp.p});setConn(true)}
      else if(m.k==='p'||m.k==='x'||m.k==='e')verwerk(m.k,m)};
    const dicht=()=>{if(ws===s)ws=null;setConn(false);if(!klaar){klaar=true;clearTimeout(to);res(false)}else if(!gesloten)herverbind()};
    s.onclose=dicht;s.onerror=()=>{try{s.close()}catch(e){}};
  })}
  let wacht=2000;
  async function herverbind(){
    const url=serverUrl();if(!url)return;
    while(!gesloten&&!ws){await new Promise(r=>setTimeout(r,wacht));wacht=Math.min(30000,wacht*1.6);
      /* spelers die we kenden zijn weg tot ze zich opnieuw melden */
      const weg=[...spelers.keys()];spelers.clear();gezien.clear();if(weg.length){elect();firePeers(weg)}
      if(await verbindServer(url))wacht=2000}
  }

  function verbind(url){return new Promise(res=>{
    let klaar=false;const c=mqtt.connect(url,{clientId:'rv_'+me.replace(/[^a-z0-9]/g,''),clean:true,keepalive:20,reconnectPeriod:3000,connectTimeout:8000,
      will:{topic:TOPIC+'x',payload:JSON.stringify({f:me}),qos:0,retain:false}});
    const to=setTimeout(()=>{if(!klaar){klaar=true;try{c.end(true)}catch(e){}res(null)}},9000);
    c.on('connect',()=>{c.subscribe(TOPIC+'#',{qos:0},()=>{if(!klaar){klaar=true;clearTimeout(to);res(c)}setConn(true);publish('p',{f:me,p:myPres})})});
    c.on('close',()=>setConn(false));c.on('offline',()=>setConn(false));c.on('error',()=>{});
    c.on('message',(topic,buf)=>{let m;try{m=JSON.parse(buf.toString())}catch(e){return}verwerk(topic.slice(TOPIC.length),m)});
  })}

  (async function start(){
    elect(); /* alleen = host */
    const url=serverUrl();
    if(url){if(await verbindServer(url)){brokerUrl=url;return}herverbind();return}   /* eigen server: geen MQTT meer nodig */
    try{if(typeof mqtt==='undefined')await laadScript(MQTT_CDN)}catch(e){}
    while(!gesloten){
      if(typeof mqtt!=='undefined')for(const u of URLS){client=await verbind(u);if(client){brokerUrl=u;break}}
      if(client)return;
      await new Promise(r=>setTimeout(r,20000));
    }
  })();

  /* heartbeat + opruimen van stille spelers */
  setInterval(()=>{if(gesloten)return;publish('p',{f:me,p:myPres});
    const nu=Date.now(),weg=[];const stil=ws?25000:8000;for(const[id,t]of gezien)if(nu-t>stil){gezien.delete(id);if(spelers.delete(id))weg.push(id)}
    if(weg.length){elect();firePeers(weg)}},1500);
  /* de server beantwoordt pings zonder wakker te worden; zo blijft de verbinding open */
  setInterval(()=>{if(ws&&ws.readyState===1)ws.send('{"k":"ping"}')},20000);
  addEventListener('pagehide',()=>{gesloten=true;try{publish('x',{f:me});client&&client.end(true);ws&&ws.close(1000,'bye')}catch(e){}});

  return{
    me,spelers,broker:()=>brokerUrl,
    verbonden:()=>verbonden,isHost:()=>host,hostId,
    aantal:()=>spelers.size+1,
    onHost(f){hostFns.push(f)},onSpelers(f){spelerFns.push(f)},onVerbinding(f){connFns.push(f)},
    aan(t,f){(handlers[t]=handlers[t]||[]).push(f)},
    /* stuurt naar iedereen (of één speler) en verwerkt het bericht meteen ook lokaal */
    stuur(t,d,to){publish('e',{f:me,t,d,to});if(!to||to===me)fire(t,d,me,true)},
    presence(p,direct=false){myPres=p;if(direct)publish('p',{f:me,p})},
  };
}
