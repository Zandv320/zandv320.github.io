
/* ===================== multiplayer (PeerJS) =====================
   The first visitor claims a fixed lobby id and relays everything for the others.
   That lobby host also runs the monster simulation; everyone else follows its snapshots. */
const LOBBY_ID='zandv320-mmorpg-lobby-v1';
function loadScript(src){return new Promise((res,rej)=>{const s=document.createElement('script');s.src=src;s.onload=res;s.onerror=rej;document.head.appendChild(s)})}
function makePeerRoom(){
  const handlers={},peerFns=[],connFns=[],hostFns=[];const pres=new Map();let fails=0,me=null,myPres={},isHost=false,conns=new Map(),hostConn=null,connected=false,peerObj=null,retryT=null,closed=false;
  const opts=window.PEER_OPTS||{};
  const setConn=v=>{if(connected!==v){connected=v;connFns.forEach(f=>f(v))}};
  const snapshot=()=>{const arr=[];if(me)arr.push({peer:me,presence:myPres,isMe:true});for(const[peer,p]of pres)arr.push({peer,presence:p,isMe:false});return arr};
  const firePeers=left=>{const ch={peers:snapshot(),left:left||[]};peerFns.forEach(f=>{try{f(ch)}catch(e){console.error(e)}})};
  const fireTopic=(topic,data,from,self)=>{(handlers[topic]||[]).forEach(f=>{try{f({topic,data,peer:from,isMe:!!self})}catch(e){console.error(e)}})};
  const send=(c,m)=>{try{if(c&&c.open)c.send(m)}catch(e){}};
  const broadcast=(m,except)=>{for(const[id,c]of conns)if(id!==except)send(c,m)};
  let lastRx=0;const connRx=new Map();
  function onMsg(m,from){
    if(!m||typeof m!=='object')return;lastRx=Date.now();if(from)connRx.set(from,lastRx);
    if(isHost){
      if(m.k==='p'){pres.set(from,m.pr||{});broadcast({k:'p',from,pr:m.pr},from);firePeers()}
      else if(m.k==='e'){broadcast({k:'e',from,topic:m.topic,data:m.data},from);fireTopic(m.topic,m.data,from,false)}
    }else{
      if(m.k==='p'){if(m.from===me)return;pres.set(m.from,m.pr||{});firePeers()}
      else if(m.k==='all'){pres.clear();for(const[id,p]of m.list)if(id!==me)pres.set(id,p);firePeers()}
      else if(m.k==='l'){pres.delete(m.from);firePeers([m.from])}
      else if(m.k==='e'){if(m.from!==me)fireTopic(m.topic,m.data,m.from,false)}}}
  function reset(){try{peerObj&&peerObj.destroy()}catch(e){}peerObj=null;conns.clear();hostConn=null;const wasHost=isHost;isHost=false;const gone=[...pres.keys()];pres.clear();setConn(false);if(wasHost)hostFns.forEach(f=>f(false));firePeers(gone);clearTimeout(retryT);fails++;if(!closed)retryT=setTimeout(start,Math.min(30000,700*Math.pow(1.8,Math.min(fails,8)))+Math.random()*1500)}
  function asClient(){
    const p=new Peer(opts);peerObj=p;
    p.on('open',id=>{me=id;const c=p.connect(LOBBY_ID,{reliable:true});hostConn=c;
      const to=setTimeout(()=>{if(!c.open)reset()},9000);
      c.on('open',()=>{clearTimeout(to);fails=0;lastRx=Date.now();setConn(true);send(c,{k:'p',pr:myPres});firePeers()});
      c.on('data',m=>onMsg(m,null));c.on('close',reset);c.on('error',reset)});
    p.on('error',()=>reset())}
  function start(){
    if(typeof Peer==='undefined'||closed)return;
    const p=new Peer(LOBBY_ID,opts);peerObj=p;
    p.on('open',id=>{isHost=true;fails=0;me=id;setConn(true);hostFns.forEach(f=>f(true));firePeers()});
    p.on('connection',c=>{c.on('open',()=>{conns.set(c.peer,c);connRx.set(c.peer,Date.now());send(c,{k:'all',list:[[me,myPres],...pres]})});c.on('data',m=>onMsg(m,c.peer));
      const bye=()=>{if(!conns.has(c.peer))return;conns.delete(c.peer);pres.delete(c.peer);broadcast({k:'l',from:c.peer});firePeers([c.peer])};c.on('close',bye);c.on('error',bye)});
    p.on('error',e=>{if(e&&e.type==='unavailable-id'){try{p.destroy()}catch(_){}asClient()}else if(!isHost||e.type==='network'||e.type==='server-error'||e.type==='socket-error'){reset()}});
    p.on('disconnected',()=>{if(isHost){try{p.reconnect()}catch(e){reset()}}})}
  setInterval(()=>{if(closed||!connected)return;const now=Date.now();
    if(!isHost&&now-lastRx>8000){reset();return}
    if(isHost)for(const[id,c]of conns){const t=connRx.get(id)||0;if(t&&now-t>10000){try{c.close()}catch(e){}if(conns.has(id)){conns.delete(id);pres.delete(id);connRx.delete(id);broadcast({k:'l',from:id});firePeers([id])}}}},2000);
  addEventListener('pagehide',()=>{try{peerObj&&peerObj.destroy()}catch(e){}});
  start();
  return{
    onPeers(f){peerFns.push(f)},onConnection(f){connFns.push(f)},onHost(f){hostFns.push(f)},
    on(topic,f){(handlers[topic]=handlers[topic]||[]).push(f)},
    connected:()=>connected,isHost:()=>isHost&&connected,me:()=>me||'local',count:()=>pres.size+1,
    peers:()=>[...pres.keys()],
    close(){closed=true;clearTimeout(retryT);try{peerObj&&peerObj.destroy()}catch(e){}peerObj=null;conns.clear();pres.clear();setConn(false)},
    async emit(topic,data){if(isHost)broadcast({k:'e',from:me,topic,data});else send(hostConn,{k:'e',topic,data})},
    async presence(pr){myPres=pr;if(isHost)broadcast({k:'p',from:me,pr:myPres});else send(hostConn,{k:'p',pr:myPres})}}}


/* Primary transport: a public MQTT broker over secure WebSockets relays all messages, so players on any network share one world.
   The oldest player online runs the monster simulation; if they leave, the next oldest takes over. */
const MQTT_URLS=window.MQTT_URLS||['wss://broker.hivemq.com:8884/mqtt','wss://broker.emqx.io:8084/mqtt','wss://test.mosquitto.org:8081/mqtt'];
const TOPIC='zandv320/velmora/world-v1/';
function makeMqttRoom(url){
  const handlers={},peerFns=[],connFns=[],hostFns=[];const pres=new Map(),seen=new Map();
  const me=(Date.now().toString(36).padStart(9,'0'))+'-'+Math.random().toString(36).slice(2,8);
  let connected=false,host=false,myPres={},closed=false;
  const fireTopic=(topic,data,from)=>{(handlers[topic]||[]).forEach(f=>{try{f({topic,data,peer:from,isMe:false})}catch(e){console.error(e)}})};
  const snapshot=()=>{const a=[{peer:me,presence:myPres,isMe:true}];for(const[id,p]of pres)a.push({peer:id,presence:p,isMe:false});return a};
  const firePeers=left=>{const ch={peers:snapshot(),left:left||[]};peerFns.forEach(f=>{try{f(ch)}catch(e){console.error(e)}})};
  const elect=()=>{let h=me;for(const id of pres.keys())if(id<h)h=id;const v=connected&&h===me;if(v!==host){host=v;hostFns.forEach(f=>f(v))}};
  const setConn=v=>{if(connected!==v){connected=v;connFns.forEach(f=>f(v));elect()}};
  const client=mqtt.connect(url,{clientId:'vel_'+me.replace(/[^a-z0-9]/g,''),clean:true,keepalive:20,reconnectPeriod:3000,connectTimeout:8000,
    will:{topic:TOPIC+'x',payload:JSON.stringify({f:me}),qos:0,retain:false}});
  client.on('connect',()=>{client.subscribe(TOPIC+'#',{qos:0},()=>{setConn(true);send('p',{f:me,p:myPres});firePeers()})});
  client.on('close',()=>{setConn(false)});client.on('offline',()=>setConn(false));client.on('error',()=>{});
  client.on('message',(topic,buf)=>{let m;try{m=JSON.parse(buf.toString())}catch(e){return}if(!m||typeof m!=='object'||m.f===me||typeof m.f!=='string')return;const k=topic.slice(TOPIC.length);seen.set(m.f,Date.now());
    if(k==='p'){const isNew=!pres.has(m.f);pres.set(m.f,m.p||{});if(isNew)elect();firePeers()}
    else if(k==='x'){if(pres.delete(m.f)){seen.delete(m.f);elect();firePeers([m.f])}}
    else if(k==='e'){if(!pres.has(m.f)){pres.set(m.f,{});elect()}if(m.to&&m.to!==me)return;fireTopic(m.t,m.d,m.f)}});
  function send(k,obj){if(client.connected)client.publish(TOPIC+k,JSON.stringify(obj),{qos:0})}
  const iv=setInterval(()=>{const now=Date.now();const gone=[];for(const[id,t]of seen)if(now-t>7000){seen.delete(id);if(pres.delete(id))gone.push(id)}if(gone.length){elect();firePeers(gone)}},1500);
  addEventListener('pagehide',()=>{try{send('x',{f:me});client.end(true)}catch(e){}});
  return{kind:'mqtt',onPeers(f){peerFns.push(f)},onConnection(f){connFns.push(f)},onHost(f){hostFns.push(f)},on(t,f){(handlers[t]=handlers[t]||[]).push(f)},
    connected:()=>connected,isHost:()=>host,me:()=>me,count:()=>pres.size+1,peers:()=>[...pres.keys()],
    close(){closed=true;clearInterval(iv);try{send('x',{f:me});client.end(true)}catch(e){}setConn(false)},
    async emit(t,d){send('e',{f:me,t,d})},async presence(p){myPres=p;send('p',{f:me,p})},client}}
function tryMqtt(url){return new Promise(res=>{let done=false;const r=makeMqttRoom(url);const to=setTimeout(()=>{if(!done){done=true;r.close();res(null)}},9000);r.onConnection(v=>{if(v&&!done){done=true;clearTimeout(to);res(r)}})})}
async function startNet(){
  try{if(typeof mqtt==='undefined')await loadScript('https://cdn.jsdelivr.net/npm/mqtt@5.10.1/dist/mqtt.min.js')}catch(e){}
  if(typeof mqtt!=='undefined'&&!window.NO_MQTT){for(const u of MQTT_URLS){room=await tryMqtt(u);if(room)break}}
  if(!room){try{if(typeof Peer==='undefined')await loadScript('https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js')}catch(e){netStatus();return}room=makePeerRoom()}
  netStatus();room.onConnection(()=>netStatus());
  if(room.kind==='mqtt'&&room.connected()){setTimeout(()=>{if(!room.isHost())netEmit('msreq',{})},2500)}
  room.onConnection(v=>{netStatus();if(v){if(!room.isHost())netEmit('msreq',{});if(S.mode==='play')log('Connected to Velmora.','sys')}});
  room.onHost(v=>{if(v)fullSnap=true});
  room.onPeers(ch=>{
    const seen=new Set();
    for(const p of ch.peers){if(p.isMe)continue;seen.add(p.peer);const pr=p.presence||{};let r=REMOTES.get(p.peer);
      if(!pr.in){if(r){removeRemote(r)}continue}
      if(!r){r={kind:'pl',size:1,id:p.peer,x:pr.x,y:pr.y,z:pr.z,ry:pr.ry||0,inW:true,rig:null,lookKey:'',atk:-1,lastAc:pr.ac,joinedT:performance.now()};REMOTES.set(p.peer,r);if(S.mode==='play')log(esc(pr.n||'Someone')+' enters Velmora.','sys',true)}
      Object.assign(r,{n:String(pr.n||'Hero').slice(0,14),lvl:pr.l|0,race:RACES[pr.ra]?pr.ra:'mens',cls:CLASSES[pr.c]?pr.c:'krijger',hp:pr.hp|0,mhp:pr.mh|0,dead:!!pr.dd,tx:+pr.x||0,ty:+pr.y||0,tz:+pr.z||0,try:+pr.ry||0,mv:+pr.mv||0,cs:!!pr.cs,lf:ACT_ANIM[pr.lf]?pr.lf:'',mt:MOUNTS[pr.mt]?pr.mt:'',sh:!!pr.sh,g:pr.g||'',eqv:pr.e||[],pvp:!!pr.pv,honor:pr.ho|0,cb:!!pr.cb,co:pr.co|0});
      if(pr.ac!==r.lastAc){r.lastAc=pr.ac;r.atk=0;r.atkRanged=!!pr.rg}
      let look=null;if(pr.lk&&typeof pr.lk==='object'){look={};for(const[k,v]of Object.entries(pr.lk)){if(k.length<12&&(typeof v==='number'||typeof v==='boolean'||(typeof v==='string'&&v.length<12)))look[k]=v}
        /* uitrusting: alleen de velden die 3d_dress kent, met lengtes begrensd */const sanD=(d)=>{if(!d||typeof d!=='object')return null;const o={c:+d.c||0,r:clamp(d.r|0,0,4)};if(typeof d.p==='string'&&d.p.length<40&&/^[\w.-]+$/.test(d.p))o.p=d.p;if(typeof d.g==='string'&&d.g.length<120&&/^models\/[\w./-]+\.glb$/.test(d.g))o.g=d.g;if(typeof d.s==='number'&&d.s>0&&d.s<10)o.s=d.s;if(Array.isArray(d.ro)&&d.ro.length===3&&d.ro.every(x=>typeof x==='number'))o.ro=d.ro;return o};
        if(pr.lk.gear&&typeof pr.lk.gear==='object'){look.gear={};for(const sl of ['hoofd','borst','handen','benen','voeten'])look.gear[sl]=sanD(pr.lk.gear[sl])}look.wvis=sanD(pr.lk.wvis);look.race=r.race;
        /* outfits en wapenmodellen: alleen bekende namen */for(const k of['wm','sm','om'])look[k]=WMODEL_ALL.has(pr.lk[k])?pr.lk[k]:null;if(pr.lk.outfits&&typeof pr.lk.outfits==='object'){look.outfits={};for(const sl of['hoofd','borst','handen','benen']){const v=pr.lk.outfits[sl];if(OUTFITS[v])look.outfits[sl]=v}}if(!['zwaard','bijl','staf','boog','ak','none'].includes(look.wt))look.wt=CLASSES[r.cls].wt}
      if(!look)look=playerLook({race:r.race,cls:r.cls,hair:pr.h|0,eq:{wapen:r.eqv[0]?{wt:r.eqv[0],r:r.eqv[1]|0}:null,borst:r.eqv[2]>=0?{r:r.eqv[2]}:null,hoofd:r.eqv[3]?{}:null,handen:r.eqv[4]?{}:null}});
      r.wr=look.wr|0;const key=JSON.stringify(look);if(key!==r.lookKey){r.lookKey=key;if(r.rig)scene.remove(r.rig.g);r.rig=buildHumanoid(look);r.rig.g.userData.ent=r;r.rig.g.position.set(r.x,r.y,r.z);scene.add(r.rig.g)}}
    for(const r of[...REMOTES.values()])if(!seen.has(r.id))removeRemote(r,true);
    netStatus();refreshParty()});
  room.on('chat',m=>{const d=m.data||{};if(typeof d.t!=='string')return;const r=REMOTES.get(m.peer);const who=r?r.n:'Someone';
    if(d.g){if(!GROUP||GROUP.leader!==d.g)return;log('<span class="c-grp">[Group] '+esc(who)+': '+esc(d.t.slice(0,120))+'</span>','grp',true)}else log('<b>'+esc(who)+':</b> '+esc(d.t.slice(0,120)),'say',true);sfx('chat');
    if(r)r.bubble={t:d.t.slice(0,60),until:performance.now()+5000}});
  room.on('dmg',m=>{if(!isAuth())return;const d=m.data||{};const mon=MONMAP.get(d.m);if(!mon)return;authDamage(mon,clamp(+d.d||0,0,5000),m.peer,{root:clamp(+d.r||0,0,5),stun:clamp(+d.s||0,0,3),taunt:d.t?1:0})});
  room.on('msreq',()=>{if(room.isHost())fullSnap=true});
  room.on('ms',m=>{if(room.isHost())return;applySnap(m.data)});
  room.on('mdie',m=>{const d=m.data||{};const mon=MONMAP.get(d.id);if(!mon||!Array.isArray(d.taps))return;if(!mon.dead||!mon.lootDone){mon.lootDone=1;onMonDeath(mon,d.taps)}});
  room.on('pheal',m=>{const d=m.data||{};if(d.to!==myId())return;receiveHeal(d,m.peer)});
  room.on('mhit',m=>{const d=m.data||{};if(d.to!==myId())return;const mon=MONMAP.get(d.m);takeHit(clamp(+d.d||0,0,2000),mon||{lvl:P?P.level:1});if(+d.r>0&&!ME.dead)ME.root=Math.max(ME.root,clamp(+d.r,0,3))});
  room.on('pdmg',m=>{const d=m.data||{};if(d.to!==myId()||S.mode!=='play'||ME.dead)return;const r=REMOTES.get(m.peer);if(!r||!pvpHostile(r))return;
    takeHit(clamp(+d.d||0,0,3000)*.5,r);if(+d.s>0)ME.stun=Math.max(ME.stun,clamp(+d.s,0,2));if(+d.r>0)ME.root=Math.max(ME.root,clamp(+d.r,0,3))});
  room.on('pkill',m=>{const d=m.data||{};if(S.mode!=='play')return;const victim=esc(String(d.n||'Someone').slice(0,14));
    if(d.by===myId()){P.honor=(P.honor||0)+1;const r=REMOTES.get(m.peer);const g=Math.max(2,(r?r.lvl:1)*2);P.gold+=g;log('⚔ You defeated '+victim+' in combat! +1 honour, +'+g+' gold','sys',true);banner('Victory!',victim+' has been defeated',2);sfx('lvl');saveGame()}
    else{const k=REMOTES.get(d.by);log('⚔ '+(k?esc(k.n):'Someone')+' defeated '+victim+'.','err',true)}});
  room.on('bossmsg',m=>{const d=m.data||{};if(typeof d.t==='string'&&S.mode==='play'&&ME.pos.x>700&&(SANCTUM_BOSS[d.b]?(ME.pos.x>2800&&(ME.pos.x>3300)===!!SANCTUM_BOSS[d.b].raid):d.b==='silkmother'?(ME.pos.x>2200&&ME.pos.x<2800):d.b==='vyraxion'?(ME.pos.x>1700&&ME.pos.x<2200):d.b==='ignaroth'?(ME.pos.x>1250&&ME.pos.x<1700):ME.pos.x<1250))bossSay(d.t.slice(0,90),d.b)});
  room.on('fx',m=>{if(S.mode!=='play')return;const d=m.data||{};const r=REMOTES.get(m.peer);
    if(d.k==='p'&&Array.isArray(d.f)){const from=new THREE.Vector3(+d.f[0],+d.f[1],+d.f[2]);let tg=null;if(d.m)tg=MONMAP.get(d.m);else if(d.p)tg=d.p===myId()?'me':REMOTES.get(d.p);else if(d.x!=null)tg=[+d.x,groundH(+d.x,+d.z),+d.z];if(tg&&PCOL[d.t])proj(d.t,from,tg,d.t==='arrow'?46:d.t==='meteor'?34:d.t==='kogel'?95:22,null)}
    else if(d.k==='r'){const x=+d.x,z=+d.z,c=+d.c;if(c===0xdde6ff)whirlFx(x,groundH(x,z),z);else if(c===0x9ae0ff)novaFx(x,z);else if(c===0xffc040)shoutFx(x,groundH(x,z),z);else if(c===0xffd36a)rainFx(x,z);else ringFx(x,z,clamp(+d.r,1,12),c||0xffffff,.5)}
    else if(d.k==='tw'){const x=+d.x,z=+d.z;twirlFx(x,groundH(x,z)+1,z,0xc08aff);if(isFinite(+d.fx)&&Math.hypot(+d.fx-x,+d.fz-z)<20)blinkFx(+d.fx,groundH(+d.fx,+d.fz),+d.fz,x,groundH(x,z),z)}
    else if(d.k==='sl'&&isFinite(+d.x)){slamFx(+d.x,+d.y,+d.z,+d.r||0)}
    else if(d.k==='hl'&&isFinite(+d.x)){const x=+d.x,z=+d.z;healFx(x,groundH(x,z),z,0xffe9a0);if(d.big)beamFx(x,z,0xffe08a,.7,.9)}
    else if(d.k==='ci'&&isFinite(+d.x)){chargeImpactFx(+d.x,groundH(+d.x,+d.z),+d.z)}
    else if(drakeFxNet(d)){}
    else if(d.k==='tele')teleFx(+d.x,+d.z,clamp(+d.r,1,12),clamp(+d.d,.2,4));
    else if(d.k==='lvl'){beamFx(+d.x,+d.z,0xffd34d,1.6,1.5);lvlFx(+d.x,groundH(+d.x,+d.z),+d.z);if(r)log(esc(r.n)+' has gained a level!','sys',true)}});
  room.on('arena',m=>{if(S.mode!=='play')return;arenaNet(m.peer,m.data||{})});
  /* groups */
  room.on('ginv',m=>{const d=m.data||{};if(d.to!==myId()||S.mode!=='play')return;if(GROUP){netEmit('gdec',{to:m.peer,n:P.name,why:'is already in a group'});return}showInvite(m.peer,String(d.n||'Someone').slice(0,14))});
  room.on('gdec',m=>{const d=m.data||{};if(d.to===myId())log(esc(String(d.n||'Someone'))+' '+(d.why?esc(d.why):'declined your invitation')+'.','grp',true)});
  room.on('gacc',m=>{const d=m.data||{};if(d.to!==myId())return;if(GROUP&&GROUP.leader!==myId())return;if(!GROUP)GROUP={leader:myId(),members:[myId()]};if(GROUP.members.length>=5||GROUP.members.includes(m.peer))return;GROUP.members.push(m.peer);netEmit('gset',{leader:GROUP.leader,members:GROUP.members});const r=REMOTES.get(m.peer);log((r?esc(r.n):'Someone')+' joins your group.','grp',true);refreshParty()});
  room.on('gset',m=>{const d=m.data||{};if(!Array.isArray(d.members))return;const me=myId();
    if(d.members.includes(me)&&d.members.length>=2){const was=!!GROUP;GROUP={leader:d.leader,members:d.members.slice(0,5)};if(!was)log('You are now in a group.','grp')}
    else if(GROUP&&(GROUP.leader===m.peer||GROUP.leader===d.leader||GROUP.leader===d.old)){GROUP=null;log('The group has been disbanded.','grp')}refreshParty()});
  room.on('gleave',m=>{if(!GROUP||GROUP.leader!==myId())return;GROUP.members=GROUP.members.filter(x=>x!==m.peer);const r=REMOTES.get(m.peer);log((r?esc(r.n):'Someone')+' has left the group.','grp',true);
    if(GROUP.members.length<2){netEmit('gset',{leader:myId(),old:myId(),members:[]});GROUP=null}else netEmit('gset',{leader:GROUP.leader,members:GROUP.members});refreshParty()});
}
function removeRemote(r,left){if(r.rig)scene.remove(r.rig.g);dropRider(r);if(r.plate)r.plate.remove();REMOTES.delete(r.id);if(ME.target===r)setTarget(null);
  if(left&&S.mode==='play')log(esc(r.n||'Someone')+' has left Velmora.','sys',true);
  if(GROUP&&GROUP.members.includes(r.id)){const wasLeader=GROUP.leader===r.id;GROUP.members=GROUP.members.filter(x=>x!==r.id);if(GROUP.members.length<2)GROUP=null;else if(wasLeader){GROUP.leader=[...GROUP.members].sort()[0];if(GROUP.leader===myId())netEmit('gset',{leader:GROUP.leader,members:GROUP.members})}}refreshParty()}
function inviteToGroup(r){if(!room||!room.connected())return toast('You are not online');if(GROUP&&GROUP.leader!==myId())return toast('Only the group leader can invite');if(GROUP&&GROUP.members.length>=5)return toast('Your group is full');if(GROUP&&GROUP.members.includes(r.id))return toast(r.n+' is already in your group');netEmit('ginv',{to:r.id,n:P.name});log('You have '+esc(r.n)+' invited to your group.','grp',true)}
function leaveGroup(){if(!GROUP)return;const me=myId();if(GROUP.leader===me){const rest=GROUP.members.filter(x=>x!==me);if(rest.length>=2)netEmit('gset',{leader:rest[0],old:me,members:rest});else netEmit('gset',{leader:rest[0]||me,old:me,members:[]})}else netEmit('gleave',{});GROUP=null;log('You have left the group.','grp');refreshParty()}
let invitePeer=null;
function showInvite(peer,n){invitePeer=peer;const b=$('#dBody');$('#dName').textContent='Group invitation';b.innerHTML='<p><b>'+esc(n)+'</b> invites you to go adventuring together.</p><div class="row"><button class="btn" id="gAcc">Accept</button><button class="btn alt" id="gDec">Decline</button></div>';openPanel('pDialog');sfx('quest');
  $('#gAcc').onclick=()=>{netEmit('gacc',{to:invitePeer});closePanel('pDialog')};$('#gDec').onclick=()=>{netEmit('gdec',{to:invitePeer,n:P.name});closePanel('pDialog')}}
/* snapshots */
let fullSnap=true,snapTick=0;
function sendSnap(){
  if(!room||!room.isHost()||room.count()<2)return;snapTick++;const full=fullSnap||snapTick%20===0;fullSnap=false;const l=[];
  for(const m of MONS){const fl=(m.dead?1:0)|(m.evade?2:0)|(m.root>0||m.slow>0?4:0);const s=m.sent;
    if(!full&&s&&Math.abs(s[0]-m.x)<.05&&Math.abs(s[1]-m.z)<.05&&s[2]===m.hp&&s[3]===fl&&s[4]===m.ac&&s[5]===m.mv&&s[6]===m.tgt&&s[7]===(m.flyH|0))continue;
    m.sent=[m.x,m.z,m.hp,fl,m.ac,m.mv,m.tgt,m.flyH|0];
    const e=[m.id,Math.round(m.x*100)/100,Math.round(m.z*100)/100,Math.round(m.ry*100)/100,Math.max(0,Math.round(m.hp)),fl,m.ac,m.mv,(m.t.boss||m.add)?m.mhp:0,m.add?m.type:0,m.add?m.lvl:0,m.tgt||0,Math.round((m.flyH||0)*10)/10];l.push(e)}
  if(l.length||full)netEmit('ms',{f:full?1:0,l})}
function applySnap(d){if(!d||!Array.isArray(d.l))return;const now=performance.now();const ids=d.f?new Set():null;
  for(const e of d.l){if(!Array.isArray(e))continue;let m=MONMAP.get(e[0]);if(ids)ids.add(e[0]);
    if(!m){if(e[9]&&MON[e[9]]&&!(e[5]&1)){m=makeMon({id:e[0],type:e[9],lvl:e[10]|0||8,x:+e[1],z:+e[2]});burst(m.x,1,m.z,0x7aff5a,30,4)}else continue}
    m.nx=+e[1];m.nz=+e[2];m.nry=+e[3];const hp=+e[4];if(!(now<m.predUntil&&hp>m.hp))m.hp=hp;const dead=!!(e[5]&1);
    if(m.dead&&!dead){respawnMon(m);m.lootDone=0}if(!m.dead&&dead){m.lootDone=0}m.dead=dead;m.evade=!!(e[5]&2);
    if(e[6]!==m.ac){m.ac=e[6];m.atk=0}m.mv=+e[7];if(e[8])m.mhp=+e[8];m.tgt=e[11]||null;m.flyH=clamp(+e[12]||0,0,20);m.seen=now}
  if(ids)for(const m of[...MONS])if(m.add&&!ids.has(m.id))removeMon(m)}
let presT=0,lastPres='',presSkip=0;
function sendPresence(dt){if(!room||!room.connected())return;presT-=dt;if(presT>0)return;presT=.1;
  let pr;if(S.mode==='play'&&P){const e=P.eq;pr={in:1,n:P.name,ra:P.race,c:P.cls,h:P.hair|0,l:P.level,x:Math.round(ME.pos.x*100)/100,y:Math.round(ME.pos.y*100)/100,z:Math.round(ME.pos.z*100)/100,ry:Math.round(ME.ry*100)/100,hp:Math.round(P.hp),mh:ST.maxhp,mv:Math.round(ME.spd*10)/10,lf:actAnim()||'',mt:ME.mounted||'',sh:ME.sheathed?1:0,ac:ME.ac||0,rg:ME.atkRanged?1:0,cs:ME.cast?1:0,dd:ME.dead?1:0,cb:(ME.combat>0||isEnemy(ME.target))?1:0,co:ME.combo||0,pv:P.pvp?1:0,ho:P.honor|0,lk:ME.look||null,g:GROUP?GROUP.leader:'',e:[e.wapen?e.wapen.wt:'',e.wapen?e.wapen.r:0,e.borst?e.borst.r:-1,e.hoofd?1:0,e.handen?1:0]}}else pr={in:0};
  const s=JSON.stringify(pr);if(s===lastPres&&++presSkip<10)return;presSkip=0;lastPres=s;room.presence(pr)}
function netStatus(){const el=$('#net');const on=room&&room.connected();const n=on?room.count():0;const playing=on?[...REMOTES.values()].filter(r=>r.inW).length+(S.mode==='play'?1:0):0;
  if(el){el.classList.toggle('on',!!on);const nt=on?(n<=1?'Online · you are the only one in Velmora right now':'Online · '+n+' players in Velmora'):(typeof Peer==='undefined'&&room===null?'Offline · playing solo':'Connecting to Velmora…');const sp=el.querySelector('span');if(sp.textContent!==nt)sp.textContent=nt}
  const o=$('#online');const ot=on?(playing+' player'+(playing===1?'':'s')+' in Velmora'):'Offline · playing solo';if(o&&o.textContent!==ot)o.textContent=ot}
