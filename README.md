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

## Publiceren

Elke push naar `master` bouwt de site en zet `dist/` live op GitHub Pages (workflow in `.github/workflows/deploy.yml`).
Bij **Settings → Pages** moet als bron **GitHub Actions** gekozen zijn.
