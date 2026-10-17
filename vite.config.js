import {defineConfig} from 'vite';
import fs from 'node:fs';
import path from 'node:path';

/* De spelcode staat in velmora/src/*.js als losse delen die samen één module vormen (gedeelde scope).
   Deze plugin plakt ze in volgorde aan elkaar als virtuele module; Vite bundelt daarna three.js mee en minificeert alles. */
const PARTS=['1_core','2_world','2b_env','3_models','3b_gltf','3d_dress','4_game','4b_life','5_net','6_ui','7_main'];
function velmoraGame(){
  const id='virtual:velmora-game',rid='\0'+id;
  const dir=path.resolve(__dirname,'velmora/src');
  return{
    name:'velmora-game',
    resolveId(s){if(s===id)return rid},
    load(i){if(i!==rid)return;const files=PARTS.map(p=>path.join(dir,p+'.js'));for(const f of files)this.addWatchFile(f);
      return files.map(f=>fs.readFileSync(f,'utf8')).join('\n')},
    /* de glTF-modellen worden als statische bestanden naast de pagina gezet */
    closeBundle(){const src=path.resolve(__dirname,'velmora/models'),dst=path.resolve(__dirname,'dist/velmora/models');if(fs.existsSync(src))fs.cpSync(src,dst,{recursive:true})}
  }}

export default defineConfig({
  base:'/',
  appType:'mpa',
  plugins:[velmoraGame()],
  build:{
    target:'es2022',
    rollupOptions:{input:{velmora:path.resolve(__dirname,'velmora/index.html')}},
    chunkSizeWarningLimit:1500
  },
  server:{port:5173,open:'/velmora/'}
});
