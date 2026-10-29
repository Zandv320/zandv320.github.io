/* Runeveld – skill- en spreukeffecten: geanimeerde billboards uit de Craftpix-effectsheets (sprites/fx/).
   Elk effect is één rij frames; fx.json (uit tools/maak_sprites.py) geeft framegrootte, aantal en tempo.
   speel() zet een effect op een plek in de wereld (of laat het een figuur volgen), update() laat het lopen en
   ruimt het op. Effecten tekenen altijd bovenop de scène, zodat ze nooit achter een sprite verdwijnen. */
import * as THREE from 'three';
import {laadTextuur} from './sprites.js';

export async function maakFx({scene}){
  const info=await (await fetch('sprites/fx/fx.json')).json();
  const tex={};
  await Promise.all(Object.keys(info).map(async k=>{const t=await laadTextuur('sprites/fx/'+k+'.png',{ruw:true});if(t){t.magFilter=THREE.NearestFilter;t.minFilter=THREE.NearestFilter;t.generateMipmaps=false}tex[k]=t}));
  const actief=[];
  /* naam: effect uit fx.json; x,z: plek; opties: grootte (hoogte in eenheden), y, tint (kleur), loop, volg ({x,z}),
     fps, voet (onderkant op de grond i.p.v. gecentreerd), additief, spiegel, vertraging (seconden), hoek (draai in het vlak, radialen) */
  function speel(naam,x,z,{grootte=2,y=0,tint=null,loop=false,volg=null,fps=null,voet=false,additief=false,spiegel=false,vertraging=0,hoek=0}={}){
    const i=info[naam],bron=tex[naam];if(!i||!bron)return null;
    const t=bron.clone();t.needsUpdate=true;t.repeat.set((spiegel?-1:1)/i.n,1);t.offset.set(spiegel?1/i.n:0,0);
    const h=grootte,w=grootte*i.fw/i.fh;
    const mat=new THREE.MeshBasicMaterial({map:t,transparent:true,alphaTest:.04,depthWrite:false,depthTest:false,blending:additief?THREE.AdditiveBlending:THREE.NormalBlending});
    if(tint)mat.color.set(tint);
    const geo=new THREE.PlaneGeometry(w,h);geo.translate(0,voet?h/2:0,0);
    const mesh=new THREE.Mesh(geo,mat);mesh.renderOrder=6;mesh.frustumCulled=false;mesh.visible=false;mesh.rotation.z=hoek;
    const g=new THREE.Group();g.add(mesh);g.position.set(x,y,z);scene.add(g);
    const e={g,mesh,t,mat,geo,i,fps:fps||i.fps,tijd:-vertraging,frame:-1,loop,volg,klaar:false,stop(){e.klaar=true}};
    actief.push(e);return e;
  }
  function update(dt,cam){
    for(let k=actief.length-1;k>=0;k--){const e=actief[k];
      e.tijd+=dt;
      if(e.tijd>=0){let f=Math.floor(e.tijd*e.fps);if(f>=e.i.n){if(e.loop)f%=e.i.n;else e.klaar=true}
        if(!e.klaar&&f!==e.frame){e.frame=f;e.t.offset.x=(e.t.repeat.x<0?(f+1):f)/e.i.n;e.mesh.visible=true}}
      if(e.volg){e.g.position.x=e.volg.x;e.g.position.z=e.volg.z}
      e.g.rotation.y=cam.yaw;e.mesh.rotation.x=-cam.tilt;
      if(e.klaar){scene.remove(e.g);e.mat.dispose();e.t.dispose();e.geo.dispose();actief.splice(k,1)}
    }
  }
  return{speel,update,info,aantal:()=>actief.length};
}
