import {defineConfig} from 'vite';
import fs from 'node:fs';
import path from 'node:path';

/* De spelcode staat in velmora/src/*.js als losse delen die samen één module vormen (gedeelde scope).
   Deze plugin plakt ze in volgorde aan elkaar als virtuele module; Vite bundelt daarna three.js mee en minificeert alles. */
const PARTS=['1_core','1b_talents','2_world','2b_env','2c_arena','2d_drake','2e_visual','2f_craft','2g_elvia','2h_hollow','3_models','3b_gltf','3d_dress','3e_outfit','3f_shoulder','3g_helm','3h_cloak','3i_paladin','4f_perf','4_game','4b_life','4c_arena','4d_fx','4e_talents','4g_drake','4h_mount','4q_drake','4i_enchant','4j_paladin','4k_hands','4l_sets','4m_topdown','4n_world','4o_ambience','4p_react','5_net','6_ui','6b_map','6c_admin','7_main'];
function velmoraGame(){
  const id='virtual:velmora-game',rid='\0'+id;
  const dir=path.resolve(__dirname,'velmora/src');
  return{
    name:'velmora-game',
    resolveId(s){if(s===id)return rid},
    load(i){if(i!==rid)return;const files=PARTS.map(p=>path.join(dir,p+'.js'));for(const f of files)this.addWatchFile(f);
      return files.map(f=>fs.readFileSync(f,'utf8')).join('\n')},
    /* de glTF-modellen worden als statische bestanden naast de pagina gezet */
    closeBundle(){for(const d of ['models','ui','fx']){const src=path.resolve(__dirname,'velmora/'+d),dst=path.resolve(__dirname,'dist/velmora/'+d);if(fs.existsSync(src))fs.cpSync(src,dst,{recursive:true})}}
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
