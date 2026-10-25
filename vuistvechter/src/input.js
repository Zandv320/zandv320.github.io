// Toetsenbord + muis. Muisbeweging wordt per frame opgeteld en door de game uitgelezen.

const OPSLAG = 'vuistvechter-instellingen';

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.locked = false;
    this.mouseDown = false;
    this.aimDown = false;       // rechtermuisknop: richten
    this.jumpPressed = false;   // wordt door de game "geconsumeerd"
    this.punchPressed = false;
    this.edges = new Set();     // toetsen die deze frame zijn ingedrukt
    this.wheel = 0;
    this.settings = { gevoeligheid: 1, volume: 0.8 };
    try {
      const s = JSON.parse(localStorage.getItem(OPSLAG) || '{}');
      Object.assign(this.settings, s);
    } catch (_) {}

    addEventListener('keydown', e => {
      if (e.code === 'Space') { if (!e.repeat) this.jumpPressed = true; e.preventDefault(); }
      if (!e.repeat && this.locked) this.edges.add(e.code);
      this.keys.add(e.code);
    });
    addEventListener('keyup', e => this.keys.delete(e.code));
    addEventListener('blur', () => { this.keys.clear(); this.mouseDown = false; this.aimDown = false; });

    addEventListener('mousemove', e => {
      if (!this.locked) return;
      // sommige browsers geven bij het vastzetten een enorme sprong; die negeren we
      if (Math.abs(e.movementX) > 400 || Math.abs(e.movementY) > 400) return;
      this.mouseDX += e.movementX;
      this.mouseDY += e.movementY;
    });
    addEventListener('mousedown', e => {
      if (!this.locked) return;
      if (e.button === 2) { this.aimDown = true; return; }
      if (e.button !== 0) return;
      this.mouseDown = true; this.punchPressed = true;
    });
    addEventListener('contextmenu', e => { if (this.locked) e.preventDefault(); });
    addEventListener('wheel', e => { if (this.locked) this.wheel += Math.sign(e.deltaY); }, { passive: true });
    addEventListener('mouseup', e => { if (e.button === 0) this.mouseDown = false; if (e.button === 2) this.aimDown = false; });

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
      if (!this.locked) { this.keys.clear(); this.mouseDown = false; this.aimDown = false; }
      this.onLockChange?.(this.locked);
    });
  }

  lock() {
    // ruwe muisinput (zonder versnelling van het OS) waar de browser dat ondersteunt
    const fallback = () => { try { const p = this.canvas.requestPointerLock(); p?.catch?.(() => {}); } catch (_) {} };
    try {
      const p = this.canvas.requestPointerLock({ unadjustedMovement: true });
      if (p && p.catch) p.catch(fallback); else if (!p) {/* oude browsers: synchroon */}
    } catch (_) { fallback(); }
  }

  save() {
    try { localStorage.setItem(OPSLAG, JSON.stringify(this.settings)); } catch (_) {}
  }

  down(...codes) { return codes.some(c => this.keys.has(c)); }

  pressed(code) { return this.edges.has(code); }
  endFrame() { this.edges.clear(); this.wheel = 0; }

  takeMouse() {
    const d = [this.mouseDX, this.mouseDY];
    this.mouseDX = this.mouseDY = 0;
    return d;
  }
}
