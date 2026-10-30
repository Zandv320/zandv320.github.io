/* Runeveld – accounts op het selectiescherm: inloggen, registreren en herstellen bij de server (server/src/accounts.js).
   Het account koppelt een naam en wachtwoord aan het heldentoken van deze browser; inloggen op een ander apparaat
   haalt dat token op, waarna de helden daar ook staan. Zonder account speel je als gast op een token. */
import {SERVER,token,zetToken} from './net.js';
const $=s=>document.querySelector(s);
const ACC='runeveld.account';
export const accountNaam=()=>{try{return localStorage.getItem(ACC)||''}catch(e){return ''}};

export function maakAccount({toonScherm,herlaad}){
  let stand='login';
  const url=()=>{let u=SERVER;try{const o=localStorage.getItem('runeveld.server');if(o!==null)u=o}catch(e){}return u.replace(/\/$/,'')};
  async function post(pad,body){
    const u=url();if(!u)return{ok:false,fout:'No server configured.'};
    try{const r=await fetch(u+'/account/'+pad,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});return await r.json()}
    catch(e){return{ok:false,fout:'The server did not answer. Try again in a moment.'}}
  }
  function status(){
    const n=accountNaam();
    $('#acc-status').innerHTML=n?`Logged in as <b>${n.replace(/[<>&]/g,'')}</b>`:'Guest account · heroes live in this browser only';
    $('#acc-knop').textContent=n?'Log out':'Log in';
  }
  function zetStand(s){
    stand=s;document.querySelectorAll('.acctabs .ktab').forEach(b=>b.classList.toggle('actief',b.dataset.acc===s));
    $('#acc-code-rij').hidden=s!=='herstel';$('#acc-ww-label').textContent=s==='login'?'Password':'New password';
    $('#acc-ww').autocomplete=s==='login'?'current-password':'new-password';
    $('#acc-ok').textContent=s==='login'?'Log in':s==='registreer'?'Create account':'Set new password';
    $('#acc-uitleg').textContent=s==='login'?'Log in to play with the heroes of your account on this device.':s==='registreer'?'Your current heroes become the heroes of this account. You get a recovery code: keep it safe, there is no e-mail reset.':'Lost your password? Enter your recovery code to set a new one.';
    $('#acc-fout').textContent='';$('#acc-form').hidden=false;$('#acc-klaar').hidden=true;
  }
  function open(){zetStand('login');$('#acc-naam').value='';$('#acc-ww').value='';$('#acc-code').value='';toonScherm('account');$('#acc-naam').focus()}
  document.querySelectorAll('.acctabs .ktab').forEach(b=>b.onclick=()=>zetStand(b.dataset.acc));
  $('#acc-terug').onclick=()=>toonScherm('sel');
  $('#acc-knop').onclick=()=>{
    if(!accountNaam()){open();return}
    if(!confirm('Log out? This browser goes back to a guest account without heroes until you log in again.'))return;
    try{localStorage.removeItem(ACC);localStorage.removeItem('runeveld.chars.v1');localStorage.removeItem('runeveld.token')}catch(e){}
    token();herlaad();
  };
  let bezig=false,uitkomst=null;
  $('#acc-form').onsubmit=async e=>{
    e.preventDefault();if(bezig)return;bezig=true;$('#acc-ok').disabled=true;$('#acc-fout').textContent='';
    const naam=$('#acc-naam').value.trim(),ww=$('#acc-ww').value;
    const r=stand==='login'?await post('login',{naam,ww}):stand==='registreer'?await post('registreer',{naam,ww,token:token()}):await post('herstel',{naam,ww,code:$('#acc-code').value});
    bezig=false;$('#acc-ok').disabled=false;
    if(!r||!r.ok){$('#acc-fout').textContent=(r&&r.fout)||'Something went wrong.';return}
    uitkomst=r;
    if(r.herstelcode){$('#acc-form').hidden=true;$('#acc-klaar').hidden=false;$('#acc-klaar-tekst').textContent=stand==='registreer'?`Welcome, ${r.naam}! Your account is ready.`:`Password changed for ${r.naam}.`;$('#acc-herstelcode').textContent=r.herstelcode}
    else klaar();
  };
  $('#acc-door').onclick=klaar;
  /* het token van het account overnemen; de lokale kopie van de helden vervalt (de server heeft ze) */
  function klaar(){
    const r=uitkomst;if(!r)return;
    try{localStorage.setItem(ACC,r.naam);if(r.token&&r.token!==token()){localStorage.removeItem('runeveld.chars.v1');zetToken(r.token)}}catch(e){}
    herlaad();
  }
  status();
  return{status};
}
