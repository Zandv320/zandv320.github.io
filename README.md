# Zandv320 Speelhal

Browsergames op [zandv320.github.io](https://zandv320.github.io), gebouwd met [Vite](https://vitejs.dev) en automatisch gepubliceerd via GitHub Actions.

## Spellen

- **Velmora** – fantasy-MMORPG (three.js, multiplayer via MQTT): `velmora/`
- **Steel een Voertuig**: `public/steel-een-voertuig/` (statisch)

## Lokaal werken

```bash
npm install
npm run dev        # ontwikkelserver op http://localhost:5173/velmora/
npm run build      # productiebuild in dist/
npm run preview    # bekijk de productiebuild
```

## Hoe de code in elkaar zit

- `velmora/index.html` – pagina, CSS en HUD
- `velmora/src/*.js` – de spelcode in genummerde delen die samen één module vormen (zie `vite.config.js`):
  `1_core` data en regels · `2_world` wereld, licht, water · `2b_env` omgevingsmodellen + LOD · `3_models` procedurele modellen en animatie · `3b_gltf` glTF-karakters en -monsters · `4_game` spelsystemen · `4b_life` levensvaardigheden · `5_net` multiplayer · `6_ui` interface · `7_main` invoer, camera, hoofdlus
- `velmora/models/` – glTF-modellen (KayKit en Quaternius, CC0; zie de LICENSE-bestanden daar)
- `public/` – statische bestanden die ongewijzigd worden gekopieerd (Speelhal-startpagina, covers, Steel een Voertuig)

## Nieuwe items en uitrusting toevoegen

Alles wat een speler draagt wordt bepaald door twee tabellen in `velmora/src/3d_dress.js`: `GEAR_VIS` (per klasse en slot: welke onderdelen van het model aangaan en welke textuurvakken de itemkleur krijgen) en `WEAPON_VIS` (wapentype → onderdeel in het model). Een item is zichtbaar zolang het is uitgerust; zonder uitrusting draagt een speler alleen een onderbroek.

- **Nieuw uitrustingsstuk**: voeg de naam toe aan `BASE`/`MAT`/`SUFFIX` in `1_core.js`; het slot bepaalt het uiterlijk en de kleur volgt uit `gearCol` (klasse-palet + naam). Niets anders nodig.
- **Eigen uiterlijk voor één item**: zet op het item een `vis`-object: `{prop:'Spike_Shield'}` (ander onderdeel uit het model), `{c:0xff2200}` (vaste kleur) of `{glb:'models/extra/MijnZwaard.glb',scale:1,rot:[0,0,0]}` (eigen model in de handslot). Het `vis`-object reist mee met het item (opslag én netwerk).
- **Nieuw wapentype** (bijv. `speer`): voeg het toe aan `WEAP` in `1_core.js` en aan `WEAPON_VIS` met per klasse het onderdeel of een glb.
- Namen van onderdelen in een model vind je door de `.glb` te openen in bijv. https://gltf-viewer.donmccurdy.com.

## Publiceren

Elke push naar `master` bouwt de site en zet `dist/` live op GitHub Pages (workflow in `.github/workflows/deploy.yml`).
Bij **Settings → Pages** moet als bron **GitHub Actions** gekozen zijn.
