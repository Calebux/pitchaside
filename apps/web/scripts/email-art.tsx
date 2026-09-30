/**
 * Renders the header artwork for PitchAside's emails from the app's own
 * illustration components, into public/email/ (served at /email/*).
 *
 * Email apps can't show inline SVG or CSS animation, so each banner is a PNG
 * at 2x, and the one celebratory banner (payment received) is an animated GIF.
 * The files are committed; re-run this only when the illustrations change:
 *
 *   npm run email:art --workspace=apps/web
 *   npm run email:art --workspace=apps/web -- stadium paid   # only these
 *
 * Needs Google Chrome (set CHROME to its path if it isn't in the usual place)
 * and ffmpeg on this machine.
 */
import { execFileSync } from 'child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Ball, KitLine, KittyJar, NightStadium, Player, Sparkle, TacticsBoard, Trophy, palette, skins } from '../src/components/illustrations';

/** Banner size in email pixels; rendered at twice that for sharp screens. */
const WIDTH = 520;
const HEIGHT = 150;
const VOLT_300 = '#e3fb6c';
/** How far down the stadium scene (scaled to banner width) the banner starts. */
const STADIUM_TOP = 308;

const chrome =
  process.env.CHROME ??
  ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(existsSync);
if (!chrome) throw new Error('Google Chrome not found — set CHROME to its path');

const outDir = join(__dirname, '..', 'public', 'email');
const work = mkdtempSync(join(tmpdir(), 'email-art-'));
mkdirSync(outDir, { recursive: true });

/** The app's chalk-dot texture over volt, as used on its welcome hero. */
const voltBand = `background:${VOLT_300};background-image:radial-gradient(rgb(15 26 20 / 0.09) 1px, transparent 1px);background-size:18px 18px;`;

function page(background: string, art: ReactElement) {
  return `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@800&display=block">
<style>
  :root { --font-heading: 'Bricolage Grotesque'; }
  html, body { margin: 0; width: ${WIDTH}px; height: ${HEIGHT}px; overflow: hidden; }
  body { ${background} display: flex; align-items: flex-end; justify-content: center; }
  svg { display: block; }
</style></head><body>${renderToStaticMarkup(art)}</body></html>`;
}

function screenshot(html: string, png: string) {
  const file = join(work, 'page.html');
  writeFileSync(file, html);
  const args = [
    '--headless',
    '--disable-gpu',
    '--hide-scrollbars',
    '--force-device-scale-factor=2',
    `--window-size=${WIDTH},${HEIGHT}`,
    '--virtual-time-budget=4000',
    `--screenshot=${png}`,
    `file://${file}`,
  ];
  // Headless Chrome occasionally never exits; give each shot a time limit and a few tries.
  for (let attempt = 1; ; attempt++) {
    try {
      execFileSync(chrome!, args, { stdio: 'ignore', timeout: 30_000, killSignal: 'SIGKILL' });
      return;
    } catch (err) {
      if (attempt === 3) throw err;
    }
  }
}

/** A spot illustration sitting on the volt band. */
const spot = (Art: (p: { className?: string }) => ReactElement, height = HEIGHT - 10) => (
  <div style={{ height, display: 'flex' }}>
    <style>{`svg { height: ${height}px; width: auto; }`}</style>
    <Art />
  </div>
);

const banners: { name: string; background: string; art: ReactElement }[] = [
  {
    // Account emails and anything without its own artwork.
    name: 'stadium',
    background: `background:${palette.night};`,
    art: (
      // The scene is portrait; show the strip with the goal and the players rather than its middle.
      <div style={{ width: WIDTH, height: HEIGHT, overflow: 'hidden', alignSelf: 'flex-start' }}>
        <style>{`svg { width: ${WIDTH}px; height: ${(WIDTH * 720) / 600}px; margin-top: -${STADIUM_TOP}px; }`}</style>
        <NightStadium />
      </div>
    ),
  },
  { name: 'kitty', background: voltBand, art: spot(KittyJar) },
  { name: 'squad', background: voltBand, art: spot(KitLine, HEIGHT - 22) },
  { name: 'tactics', background: voltBand, art: spot(TacticsBoard) },
  { name: 'trophy', background: voltBand, art: spot(Trophy) },
];

/** Names given on the command line; none means everything. */
const only = process.argv.slice(2);
const wanted = (name: string) => only.length === 0 || only.includes(name);

for (const b of banners.filter((b) => wanted(b.name))) {
  screenshot(page(b.background, b.art), join(outDir, `${b.name}.png`));
  console.log(`wrote ${b.name}.png`);
}

// ── Payment received: the app's celebration, with the ball actually bouncing ──

const FRAMES = 18;
const FRAME_MS = 55;

function celebration(t: number) {
  // One bounce per loop; a full turn of the ball so the last frame meets the first.
  const lift = 4 * t * (1 - t) * 70;
  return (
    <svg viewBox="0 0 520 150" width={WIDTH} height={HEIGHT}>
      <circle cx="238" cy="92" r="76" fill={palette.volt} opacity="0.55" />
      <circle cx="238" cy="92" r="52" fill={palette.volt} opacity="0.75" />
      <Player x={234} y={148} scale={0.86} pose="cheer" kit={palette.kit} skin={skins[0]} hair="afro" number={9} numberColor={palette.white} />
      <ellipse cx="318" cy="142" rx={13 - lift / 12} ry="3" fill={palette.ink} opacity={0.18 - lift / 600} />
      <Ball x={318} y={128 - lift} r={13} spin={t * 360} />
      <Sparkle x={128} y={34} s={1.1} color={palette.kit} />
      <Sparkle x={396} y={30} s={0.9} color={palette.ink} />
      <Sparkle x={420} y={104} s={0.7} color={palette.kit} />
      <Sparkle x={104} y={112} s={0.7} color={palette.ink} />
    </svg>
  );
}

for (let i = 0; wanted('paid') && i < FRAMES; i++) {
  screenshot(page(voltBand, celebration(i / FRAMES)), join(work, `frame-${String(i).padStart(2, '0')}.png`));
}
if (wanted('paid')) execFileSync(
  'ffmpeg',
  [
    '-y',
    '-loglevel', 'error',
    '-framerate', String(1000 / FRAME_MS),
    '-i', join(work, 'frame-%02d.png'),
    // One shared palette keeps the flat colours clean and the file small.
    '-filter_complex', '[0:v]split[a][b];[a]palettegen=max_colors=48:stats_mode=diff[p];[b][p]paletteuse=dither=none',
    '-loop', '0',
    join(outDir, 'paid.gif'),
  ],
  { stdio: 'inherit' },
);
if (wanted('paid')) console.log('wrote paid.gif');

rmSync(work, { recursive: true, force: true });
