# Zandv320 Speelhal

Browsergames op [zandv320.github.io](https://zandv320.github.io), gebouwd met [Vite](https://vitejs.dev) en automatisch gepubliceerd via GitHub Actions.

## Spellen

- **Velmora** – fantasy-MMORPG (three.js, multiplayer via MQTT): `velmora/`
- **Eldoria: Chronicles of Magic** – top-down MMORPG in de stijl van Ragnarok Online; het startdorp heet Runeveld (2D-sprites in een 3D-wereld, multiplayer via een eigen server op Cloudflare): `runeveld/` en `server/`

## Lokaal werken

```bash
npm install
npm run dev        # ontwikkelserver op http://localhost:5173/velmora/
# Zonder Node (bijv. als npm een ddev-wrapper is): python3 -I runeveld/tools/dev_server.py  →  http://localhost:8765/runeveld/
npm run build      # productiebuild in dist/
npm run preview    # bekijk de productiebuild
```

## Hoe de code in elkaar zit

- `velmora/index.html` – pagina, CSS en HUD
- `velmora/src/*.js` – de spelcode in genummerde delen die samen één module vormen (zie `vite.config.js`):
  `1_core` data en regels · `2_world` wereld, licht, water · `2b_env` omgevingsmodellen + LOD · `3_models` procedurele modellen en animatie · `3b_gltf` glTF-karakters en -monsters · `4_game` spelsystemen · `4b_life` levensvaardigheden · `5_net` multiplayer · `6_ui` interface · `7_main` invoer, camera, hoofdlus
- `velmora/models/` – glTF-modellen (KayKit en Quaternius, CC0; zie de LICENSE-bestanden daar)
- `public/` – statische bestanden die ongewijzigd worden gekopieerd (Speelhal-startpagina, covers)

## Eldoria: Chronicles of Magic (map `runeveld/` en `server/`)

De code is Engels en volgt standaardconventies: Prettier voor JS, CSS en HTML (`.prettierrc.json`), ESLint
(`eslint.config.js`), en black + ruff voor de Python-tools (`pyproject.toml`). Zonder lokale Node draaien ze in Docker:

```
docker run --rm -v "$PWD":/w -w /w node:22-alpine npm run format      # of: npm run lint
docker run --rm -v "$PWD":/w -w /w python:3.12-slim sh -c "pip install -q black ruff && black runeveld/tools && ruff check runeveld/tools"
```

- `runeveld/index.html` en `runeveld/ui.css` – pagina, HUD en stijl
- `runeveld/src/` – ES-modules. Kern: `main.js` (opstarten en hoofdlus), `game-state.js`, `player.js`, `monsters.js`,
  `abilities.js` en `skill-effects.js` (skills en hun effecten), `bag.js`, `storage.js` (opslag in de browser, met de
  eenmalige omzetting van oude saves). Wereld: `world.js`, `builders.js` (pixel-3D-bouwsels), `forest.js`,
  `capital.js`, `regions.js`, `daylight.js`, `effects.js`, `sprites.js`, `sheets.js`, `appearance.js`. Interface:
  `ui.js`, `character-sheet.js`, `inventory.js`, `quest-log.js`, `dialogue.js`, `character-select.js`,
  `world-map.js`, `party.js`, `account.js`, `admin.js` (Ctrl+Shift+A), `icons.js` + `icon-index.js` (gegenereerd).
  Netwerk: `network.js`.
- `runeveld/src/rules/` – pure spelregels zonder browser- of netwerkcode (stats, skills, combat, quests, progression,
  legacy-migratie); de server draait precies deze regels
- `runeveld/sprites/` – de pixel-art, geknipt uit Craftpix-freebies door `runeveld/tools/build_sprites.py` (met
  `build_effects.py` voor de procedurele effecten) en `build_icons.py` voor de iconen; `sprites/smooth/` is dezelfde
  set 2× opgeschaald met Scale2x voor de gladde weergave
- `runeveld/_download/` – de gedownloade Craftpix-zips (niet gecommit); uitpakken en
  `python3 -I runeveld/tools/build_sprites.py <map-met-packs>` draaien om `sprites/` opnieuw te maken
- `server/` – de spelserver op Cloudflare Workers: `World` (wereld, monsters, party's), `HeroStore` (de helden per
  account) en `Accounts` (gebruikersnaam en wachtwoord), uitgerold door `.github/workflows/server.yml`

## Nieuwe items en uitrusting toevoegen

Alles wat een speler draagt wordt bepaald door twee tabellen in `velmora/src/3d_dress.js`: `GEAR_VIS` (per klasse en slot: welke onderdelen van het model aangaan en welke textuurvakken de itemkleur krijgen) en `WEAPON_VIS` (wapentype → onderdeel in het model). Een item is zichtbaar zolang het is uitgerust; zonder uitrusting draagt een speler alleen een onderbroek.

- **Nieuw uitrustingsstuk**: voeg de naam toe aan `BASE`/`MAT`/`SUFFIX` in `1_core.js`; het slot bepaalt het uiterlijk en de kleur volgt uit `gearCol` (klasse-palet + naam). Niets anders nodig.
- **Eigen uiterlijk voor één item**: zet op het item een `vis`-object: `{prop:'Spike_Shield'}` (ander onderdeel uit het model), `{c:0xff2200}` (vaste kleur) of `{glb:'models/extra/MijnZwaard.glb',scale:1,rot:[0,0,0]}` (eigen model in de handslot). Het `vis`-object reist mee met het item (opslag én netwerk).
- **Nieuw wapentype** (bijv. `speer`): voeg het toe aan `WEAP` in `1_core.js` en aan `WEAPON_VIS` met per klasse het onderdeel of een glb.
- Namen van onderdelen in een model vind je door de `.glb` te openen in bijv. https://gltf-viewer.donmccurdy.com.

## Publiceren

Elke push naar `master` bouwt de site en zet `dist/` live op GitHub Pages (workflow in `.github/workflows/deploy.yml`).
Bij **Settings → Pages** moet als bron **GitHub Actions** gekozen zijn.
