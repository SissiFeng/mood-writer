# Mood Writer

*Write into the rain.*

An atmospheric writing surface where your words shape the weather. Type your thoughts into the center of the screen and the rain, fog, and light around you shift in response to mood — backed by procedural ambient audio and mechanical keystroke sounds.

## What's inside

- **Mood-driven shader parameters** — character count, typing speed, and a small bilingual (zh/en) keyword lexicon map live text to rain intensity, fog density, refraction, and flow speed.
- **4 switchable scenes** — Heartfelt Rain (refracting raindrops), Rainy Street (neon bokeh on a wet windshield), Ripples (raindrops rippling an image), Abstract Warp (IQ-style painterly FBM noise).
- **Procedural ambient audio** — pink-noise rain with a slow LFO breathing pattern, plus a synthesized mechanical keyboard with per-key profiles (letters / space / return / backspace). No audio assets, all Web Audio.
- **Background media** — drop in any image or video as the scene's substrate.
- **Save as Markdown** — export the current note as `.md` with YAML frontmatter (date, mood, char count). Keyboard shortcut `⌘S` / `Ctrl+S`.

## Run locally

```
npm install
npm run dev
```

Open the URL printed by Vite (default `http://localhost:3000`). No API keys required.

## Build for production

```
npm run build
```

Outputs a static bundle to `dist/`. Deploy the folder to any static host — Cloudflare Pages, Vercel, Netlify, or GitHub Pages all work without configuration.

## Stack

React 19 · TypeScript · Vite · Tailwind CSS 4 · Motion (Framer) · WebGL 2.0 / GLSL ES 3.00 · Web Audio API

## Shader credits

- **Heartfelt** — Martijn Steinrucken (BigWings), 2017
- **Rainy Lights** — Martijn Steinrucken (BigWings)
- **Painted Flow / Domain Warping** — Inigo Quilez
- **Raindrop Ripples** — Shadertoy community
