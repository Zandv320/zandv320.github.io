/* Eldoria – accounts: gebruikersnaam en wachtwoord bij het heldentoken. Eén Durable Object ("main") houdt alle accounts.
   Het token blijft de sleutel van de helden in de wereld; een account koppelt er een naam en wachtwoord aan, zodat je op
   een ander apparaat kunt inloggen en het token terugkrijgt. Wachtwoorden: PBKDF2-SHA256 met zout; er is geen e-mail,
   dus bij registratie krijg je één keer een herstelcode te zien waarmee je een nieuw wachtwoord kunt zetten.
   HTTP, JSON:  POST /account/registreer {naam, ww, token}   → {ok, naam, herstelcode}
                POST /account/login      {naam, ww}          → {ok, naam, token}
                POST /account/herstel    {naam, code, ww}    → {ok, naam, token, herstelcode}
                POST /account/wie        {token}             → {ok, naam|null}
                POST /account/verwijder  {naam, ww}          → {ok, naam, token}   (helden blijven bij het token) */
const ITER = 60000, MAX_POGINGEN = 6, VENSTER = 10 * 60 * 1000;
const enc = new TextEncoder();
const hex = buf => Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');
const random = n => hex(crypto.getRandomValues(new Uint8Array(n)));
async function hash(ww, saltHex) {
  const salt = new Uint8Array(saltHex.match(/../g).map(h => parseInt(h, 16)));
  const key = await crypto.subtle.importKey('raw', enc.encode(ww), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITER}, key, 256));
}
function gelijk(a, b) { if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }
const geldigeNaam = n => typeof n === 'string' && /^[A-Za-z0-9_]{3,16}$/.test(n);
const geldigWw = w => typeof w === 'string' && w.length >= 6 && w.length <= 72;
const geldigToken = t => typeof t === 'string' && /^[a-z0-9]{20,48}$/.test(t);
/* een leesbare herstelcode: 4 groepen van 4 */
const maakCode = () => random(8).toUpperCase().match(/.{4}/g).join('-');
const json = (obj, status = 200) => new Response(JSON.stringify(obj), {status, headers: {'content-type': 'application/json'}});

export class Accounts {
  constructor(ctx, env) { this.ctx = ctx; this.env = env; this.pogingen = new Map(); }
  teVaak(naam) { const p = this.pogingen.get(naam); if (!p) return false; if (Date.now() - p.t > VENSTER) { this.pogingen.delete(naam); return false; } return p.n >= MAX_POGINGEN; }
  mislukt(naam) { const p = this.pogingen.get(naam); if (p && Date.now() - p.t <= VENSTER) p.n++; else this.pogingen.set(naam, {n: 1, t: Date.now()}); }
  async fetch(req) {
    if (req.method !== 'POST') return json({ok: false, fout: 'POST verwacht'}, 405);
    let b; try { b = await req.json(); } catch (e) { return json({ok: false, fout: 'geen JSON'}, 400); }
    const pad = new URL(req.url).pathname.replace(/^\/account\//, '');
    const naam = typeof b.naam === 'string' ? b.naam.trim() : '';
    const sleutel = 'acc:' + naam.toLowerCase();
    if (pad === 'wie') { if (!geldigToken(b.token)) return json({ok: true, naam: null}); const n = await this.ctx.storage.get('tok:' + b.token); return json({ok: true, naam: n || null}); }
    if (!geldigeNaam(naam)) return json({ok: false, fout: 'A username has 3 to 16 letters, digits or underscores.'});
    if (pad === 'registreer') {
      if (!geldigWw(b.ww)) return json({ok: false, fout: 'A password has at least 6 characters.'});
      if (!geldigToken(b.token)) return json({ok: false, fout: 'No hero token.'});
      if (await this.ctx.storage.get(sleutel)) return json({ok: false, fout: 'That username is taken.'});
      if (await this.ctx.storage.get('tok:' + b.token)) return json({ok: false, fout: 'These heroes already belong to an account. Log out first.'});
      const salt = random(16), code = maakCode(), codeSalt = random(16);
      const acc = {naam, salt, hash: await hash(b.ww, salt), token: b.token, codeSalt, codeHash: await hash(code, codeSalt), gemaakt: Date.now()};
      await this.ctx.storage.put(sleutel, acc); await this.ctx.storage.put('tok:' + b.token, naam);
      return json({ok: true, naam, token: b.token, herstelcode: code});
    }
    if (pad === 'login') {
      if (this.teVaak(sleutel)) return json({ok: false, fout: 'Too many attempts. Try again in ten minutes.'});
      const acc = await this.ctx.storage.get(sleutel);
      if (!acc || !geldigWw(b.ww) || !gelijk(await hash(b.ww, acc.salt), acc.hash)) { this.mislukt(sleutel); return json({ok: false, fout: 'Unknown username or wrong password.'}); }
      this.pogingen.delete(sleutel); return json({ok: true, naam: acc.naam, token: acc.token});
    }
    if (pad === 'herstel') {
      if (this.teVaak(sleutel)) return json({ok: false, fout: 'Too many attempts. Try again in ten minutes.'});
      const acc = await this.ctx.storage.get(sleutel), code = typeof b.code === 'string' ? b.code.trim().toUpperCase() : '';
      if (!acc || !code || !gelijk(await hash(code, acc.codeSalt), acc.codeHash)) { this.mislukt(sleutel); return json({ok: false, fout: 'Unknown username or wrong recovery code.'}); }
      if (!geldigWw(b.ww)) return json({ok: false, fout: 'A password has at least 6 characters.'});
      const nieuw = maakCode(); acc.salt = random(16); acc.hash = await hash(b.ww, acc.salt); acc.codeSalt = random(16); acc.codeHash = await hash(nieuw, acc.codeSalt);
      await this.ctx.storage.put(sleutel, acc); this.pogingen.delete(sleutel);
      return json({ok: true, naam: acc.naam, token: acc.token, herstelcode: nieuw});
    }
    if (pad === 'verwijder') {   /* account opheffen; de helden blijven bij het token, dat daarna weer vrij is voor een nieuw account */
      if (this.teVaak(sleutel)) return json({ok: false, fout: 'Too many attempts. Try again in ten minutes.'});
      const acc = await this.ctx.storage.get(sleutel);
      if (!acc || !geldigWw(b.ww) || !gelijk(await hash(b.ww, acc.salt), acc.hash)) { this.mislukt(sleutel); return json({ok: false, fout: 'Unknown username or wrong password.'}); }
      await this.ctx.storage.delete(sleutel); await this.ctx.storage.delete('tok:' + acc.token);
      return json({ok: true, naam: acc.naam, token: acc.token});
    }
    return json({ok: false, fout: 'onbekend'}, 404);
  }
}
