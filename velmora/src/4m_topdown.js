/* ===================== Top-down camera (Diablo style) =====================
   An option in the menu (Camera: Third-person / Top-down). Top-down:
   - the camera hangs at a fixed angle above the hero; Q/E or right-drag turn it, the wheel/pinch zooms
   - click the ground (or hold the mouse) to walk there; click an enemy to attack it (you walk up to it if it is out of
     range); click an NPC, a loot bag or a resource to walk up to it and use it. WASD and the joystick keep working.
   - cutaway: whatever stands between the camera and the hero (roofs, tree crowns, walls) dissolves in a circle around him.
     This is done in the shaders: every built-in material gets two uniforms; fragments inside the circle that are well in
     front of the hero are discarded with a dither, so it fades instead of popping. Shadow maps don't use it.
   - performance: there is no horizon, so the world only has to be drawn close to the hero: trees/rocks, static batches,
     monsters and NPCs get much smaller draw radii, the shadow area is tighter, sky and clouds are skipped and the camera's
     far plane is short. */
const TD={on:(()=>{try{return localStorage.getItem('velmora-cam')==='top'}catch(e){return false}})(),pitch:.98,dist:26,tdist:26,
  goto:null,chase:null,hold:null,ap:null,cut:{x:0,y:0,z:0,w:0},cutB:{x:.15,y:1000,z:3.4,w:0}};
/* ---- the cutaway in every built-in material ---- */
(function(){const C=THREE.ShaderChunk;
  C.clipping_planes_pars_fragment='uniform vec4 cutA;\nuniform vec4 cutB;\n'+C.clipping_planes_pars_fragment;
  TD.CUT=`if(cutA.w>0.){float cdd=length(gl_FragCoord.xy-cutA.xy);if(cdd<cutA.w){float fzz=gl_FragCoord.z*2.-1.;
  float vzz=2.*cutB.x*cutB.y/(cutB.y+cutB.x-fzz*(cutB.y-cutB.x));float kcut=smoothstep(cutA.w,cutA.w*.6,cdd)*smoothstep(0.,2.5,cutA.z-cutB.z-vzz);
  float ncut=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))));if(kcut>ncut*.98+.01)discard;}}\n`;TD.CLIP0=C.clipping_planes_fragment;
  /* the cutaway code (with its discard) is only compiled in while the top-down camera is on: a shader with a discard
     loses the GPU's early depth test, and the third-person camera shouldn't pay for that */
  const _ck=THREE.Material.prototype.customProgramCacheKey;THREE.Material.prototype.customProgramCacheKey=function(){return _ck.call(this)+(TD.on?'|td':'')};tdChunk();
  /* shadow-map materials (depth/distance) keep the uniform at zero: shadows stay whole */
  for(const k in THREE.ShaderLib){if(/^(depth|distanceRGBA|distance)$/.test(k))continue;const u=THREE.ShaderLib[k].uniforms;if(u){u.cutA={value:TD.cut};u.cutB={value:TD.cutB}}}})();
/* only the main camera's render uses the cutaway (not the item icons or the passes) */
{const _r=renderer.render.bind(renderer);renderer.render=(s,c,...x)=>{if(c===camera||!TD.cut.w)return _r(s,c,...x);const w=TD.cut.w;TD.cut.w=0;try{return _r(s,c,...x)}finally{TD.cut.w=w}}}
function tdChunk(){THREE.ShaderChunk.clipping_planes_fragment=(TD.on?TD.CUT:'')+TD.CLIP0;const ch=TD.chunk!==TD.on;TD.chunk=TD.on;return ch}
function tdSet(on){TD.on=!!on;try{localStorage.setItem('velmora-cam',TD.on?'top':'third')}catch(e){}TD.goto=TD.chase=TD.hold=null;if(typeof resize==='function')resize()}
/* switch the scene settings that differ between the two cameras */
function tdApply(){if(tdChunk())scene.traverse(o=>{if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.needsUpdate=true)});const s=sun.shadow.camera,e=TD.on?30:42;s.left=-e;s.right=e;s.top=e;s.bottom=-e;s.updateProjectionMatrix();if(!TD.on){sky.visible=true}lodAcc=-1}
/* the field of view of each camera (set in resize) */
function tdFov(top){const f=top?camera.userData.ft:camera.userData.f3;const far=top?170:1000;if(f&&(camera.fov!==f||camera.far!==far)){camera.fov=f;camera.far=far;camera.updateProjectionMatrix()}}
const _tdv=new THREE.Vector3(),_tds=new THREE.Vector2();
function tdCamera(dt){if(TD.ap!==TD.on){TD.ap=TD.on;tdApply()}
  if(!TD.on){TD.cut.w=0;tdFov(false);return false}tdFov(true);
  TD.dist=lerp(TD.dist,TD.tdist,clamp(dt*8,0,1));
  const tx=ME.pos.x,ty=ME.pos.y+1+(ME.mounted&&MOUNTS[ME.mounted]?(MOUNTS[ME.mounted].fly?1.6:.5):0),tz=ME.pos.z;if(snapCam){camTarget.set(tx,ty,tz);snapCam=false}else camTarget.lerp(_tdv.set(tx,ty,tz),clamp(dt*14,0,1));
  /* in the dungeons a little steeper and closer, so you look into the halls and not past their walls */const inD=camTarget.x>700;TD.pk=lerp(TD.pk||TD.pitch,inD?1.12:TD.pitch,clamp(dt*3,0,1));const D=Math.min(TD.dist,inD?20:99),pt=TD.pk;
  const cp=Math.cos(pt);camera.position.set(camTarget.x+Math.sin(cam.yaw)*cp*D,camTarget.y+Math.sin(pt)*D,camTarget.z+Math.cos(cam.yaw)*cp*D);
  const gh=groundH(camera.position.x,camera.position.z)+1;if(camera.position.y<gh)camera.position.y=gh;camera.lookAt(camTarget);camera.updateMatrixWorld();
  /* the cutaway circle: the hero's place on screen (in drawing-buffer pixels) and his distance to the camera */
  _tdv.set(ME.pos.x,ME.pos.y+1.1,ME.pos.z);const d0=_tdv.distanceTo(camera.position);_tdv.project(camera);renderer.getDrawingBufferSize(_tds);
  const ppm=_tds.y/(2*Math.tan(camera.fov*Math.PI/360)*d0);
  TD.cut.x=(_tdv.x*.5+.5)*_tds.x;TD.cut.y=(_tdv.y*.5+.5)*_tds.y;TD.cut.z=d0;TD.cut.w=ME.dead?0:5.6*ppm;TD.cutB.x=camera.near;TD.cutB.y=camera.far;return true}
/* per frame after the world's fog and sky: the camera is further away, so the fog moves back with it */
function tdWorld(){if(!TD.on)return;scene.fog.near+=TD.dist*.8;scene.fog.far+=TD.dist*.8;clouds.visible=false;sky.visible=false}
/* ---- clicking the ground ---- */
function tdGround(cx,cy){_ndc.set(cx/innerWidth*2-1,-(cy/innerHeight)*2+1);ray.setFromCamera(_ndc,camera);const o=ray.ray.origin,d=ray.ray.direction;let prev=0;
  for(let t=2;t<160;t+=1.5){const x=o.x+d.x*t,y=o.y+d.y*t,z=o.z+d.z*t;if(y<groundH(x,z)){let a=prev,b=t;for(let i=0;i<8;i++){const m=(a+b)/2;if(o.y+d.y*m<groundH(o.x+d.x*m,o.z+d.z*m))b=m;else a=m}return{x:o.x+d.x*b,z:o.z+d.z*b}}prev=t}return null}
function tdWalk(cx,cy,mark){const g=tdGround(cx,cy);if(!g)return;TD.chase=null;TD.goto={x:g.x,z:g.z,r:.45};if(mark&&typeof runeCircle==='function')runeCircle(g.x,g.z,.7,0xffe08a,.35)}
/* walk up to something and then use it */
function tdWalkTo(x,z,r,then){TD.chase=null;TD.goto={x,z,r,then}}
/* WASD/joystick in camera space for the click-to-move and chase */
function tdInput(x,y){if(!TD.on)return null;if(Math.abs(x)+Math.abs(y)>.05){TD.goto=TD.chase=null;return null}
  if(TD.hold&&performance.now()-TD.hold.t>220&&!ME.dead){const g=tdGround(TD.hold.x,TD.hold.y);if(g){TD.chase=null;TD.goto={x:g.x,z:g.z,r:.45}}}
  let wx=0,wz=0;
  if(TD.goto){const G=TD.goto;wx=G.x-ME.pos.x;wz=G.z-ME.pos.z;const d=Math.hypot(wx,wz);if(d<G.r||ME.dead){TD.goto=null;if(G.then&&!ME.dead)G.then();return null}wx/=d;wz/=d}
  else if(TD.chase){const e=TD.chase;if(e!==ME.target||e.dead||!isEnemy(e)){TD.chase=null;return null}if(ME.cast)return null;
    const C=CLASSES[P.cls],ak=!!(P.eq.wapen&&P.eq.wapen.wt==='ak');const d=distTo(e)-e.size*.6;if(d<=(ak?AK_RANGE:C.range)*.9)return null;wx=e.x-ME.pos.x;wz=e.z-ME.pos.z;const L=Math.hypot(wx,wz)||1;wx/=L;wz/=L}
  else return null;
  const fx=-Math.sin(cam.yaw),fz=-Math.cos(cam.yaw),rx=Math.cos(cam.yaw),rz=-Math.sin(cam.yaw);return{x:wx*rx+wz*rz,y:wx*fx+wz*fz}}
function tdIsOn(){try{return TD.on}catch(e){return false}}
