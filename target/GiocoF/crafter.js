// ============================================================
//  CRAFTER.JS — Racing Giulio Kart — v4
//  Disegno libero col mouse, UI semplice, GIOCA funzionante
// ============================================================
(function () {
"use strict";

// ── DRAW CONSTANTS (da draw.html) ──────────────────────
const DRAW_SAMPLE_DIST      = 20;  // min px tra punti registrati — più alto = meno zig-zag
const DRAW_CLOSE_RADIUS     = 44;  // px — prossimità al punto iniziale per chiudere
const DRAW_CONTINUE_RADIUS  = 28;  // px — distanza massima per continuare il segmento esistente
const DRAW_MIN_POINTS       = 24;  // punti minimi prima di poter chiudere
const DRAW_TRACK_WIDTH      = 28;  // larghezza visuale del tracciato nel canvas di disegno

const ROAD_COLOR   = { montagna:"#c8c8c8", citta:"#232323", deserto:"#8a5c20" };
const SAND_COLOR   = { montagna:"#ffffff", citta:"#474847", deserto:"#12690f" };
const RUMBLE_COLOR = { montagna:"#ffffff", citta:"#ffffff", deserto:"#844c07" };
const BG_COLOR     = { montagna:"#4A90E2", citta:"#E24A4A", deserto:"#E2B54A" };
const BG_IMG       = { montagna:"img2/montagna.png", citta:"img3/città.png", deserto:"img/salsal.png" };

const OBSTACLES_DEF = [
  { id:"sparaneve", label:"Sparaneve", src:"img/sparaneve.png", gameSrc:"img/sparaneve.png", x:0,    scale:0.25 },
  { id:"blocco",    label:"Blocco",    src:"img/blocco.png",    gameSrc:"img/blocco.png",    x:-0.5, scale:1.0  },
  { id:"tronco",    label:"Tronco",    src:"img/tronco.png",    gameSrc:"img/tronco.png",    x:0,    scale:0.6  },
];
const SCENERY_DEF = {
  montagna:[
    { id:"albero2",   label:"Abete",    src:"img2/albero2.png",   gameSrc:"img2/albero2.png",   xL:-2.5, xR:2.3 },
    { id:"albero3",   label:"Pino",     src:"img2/albero3.png",   gameSrc:"img2/albero3.png",   xL:-2.5, xR:2.3 },
    { id:"funivia3",  label:"Funivia",  src:"img2/funivia3.png",  gameSrc:"img2/funivia3.png",  xL:-2.5, xR:1.0 },
    { id:"montagne3", label:"Montagne", src:"img2/montagne3.png", gameSrc:"img2/montagne3.png", xL:-2.2, xR:2.2 },
  ],
  citta:[
    { id:"lampione",    label:"Lampione",  src:"img3/lampione.png",    gameSrc:"img3/lampione.png",    xL:-2.5, xR:1.0 },
    { id:"edifici1_10", label:"Palazzo A", src:"img3/edifici1.10.png", gameSrc:"img3/edifici1.10.png", xL:-3.0, xR:0.4 },
    { id:"edifici2_3",  label:"Palazzo B", src:"img3/edifici2.3.png",  gameSrc:"img3/edifici2.3.png",  xL:-1.5, xR:1.8 },
  ],
  deserto:[
    { id:"albero10", label:"Pino",   src:"img/albero10.png", gameSrc:"img/albero10.png", xL:-2.2, xR:1.2 },
    { id:"albero9",  label:"Pino 2", src:"img/albero9.png",  gameSrc:"img/albero9.png",  xL:-2.2, xR:1.2 },
    { id:"rocciag2", label:"Roccia", src:"img/rocciag2.png", gameSrc:"img/rocciag2.png", xL:-2.6, xR:1.2 },
  ],
};

const S = {
  name:"Mio Circuito", mappa:"montagna",
  rawPath:[], smoothPath:[], drawSegments:[],
  obstacles:[], scenery:[],
  saved:[],
  tool:"draw",
  deleteMode:false,
  selObstacle:null, selScenery:null, selSide:"L", sceneryTheme:"montagna",
  drawing:false, lastPt:null, isClosed:false,
  ox:0, oy:0, zoom:1, panning:false, panStart:null,
  // Colori personalizzati
  colAsfalto:"#c8c8c8", colBordo:"#ffffff", colErba:"#1a6010",
  // Larghezza pista (3000 = default gioco)
  roadW: 3000,
  // Avversari
  opponents: true,
  // Vista preview
  previewMode:"2d",
  customBgImg:null,   // HTMLImageElement o null
  // 3D camera (shared tra panel e modal)
  cam3dAngle:0, cam3dSegPos:0,
  cam3dDragging:false, cam3dLast:null,
  cam3dAutoRotate:false,
  cam3dZoom:1,
  cam3dPitch:1.1,      // angolo verticale: 0.4=obliquo laterale, 1.4=zenitale — 1.1=isometrico come foto
  // Modal 3D
  modal3dOpen:false,
  modal3dDragging:false, modal3dLast:null,
  modal3dPovMode:false,   // POV in-pista invece di orbita
};

const IC = {};
function getImg(src){ if(!IC[src]){IC[src]=new Image();IC[src].src=src;} return IC[src]; }
[...OBSTACLES_DEF,...Object.values(SCENERY_DEF).flat()].forEach(d=>getImg(d.src));
// Pre-carica le immagini sfondo dei temi
Object.values(BG_IMG).forEach(src=>getImg(src));

let root, drawCanvas, drawCtx, previewCanvas, previewCtx, modal3dCanvas, modal3dCtx;

function init(){
  injectCSS();
  injectHTML();
  root=document.getElementById("gkCrafter");
  drawCanvas=document.getElementById("gkDrawCanvas");
  drawCtx=drawCanvas.getContext("2d");
  previewCanvas=document.getElementById("gkPreviewCanvas");
  previewCtx=previewCanvas.getContext("2d");
  modal3dCanvas=document.getElementById("gk3dModalCanvas");
  modal3dCtx=modal3dCanvas.getContext("2d");
  loadSaved();
  bindEvents();
  renderLoop();
}

function injectCSS(){
  const s=document.createElement("style");
  s.textContent=`
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Rajdhani:wght@400;500;600;700&display=swap');

/* ── CSS VARIABLES ──────────────────────────────────────────── */
#gkCrafter{
  --gk-orange:#ff7b00;
  --gk-orange-dim:#ff7b0033;
  --gk-orange-glow:0 0 12px rgba(255,123,0,.55);
  --gk-red:#ff2244;
  --gk-green:#00ff88;
  --gk-blue:#1a6eff;
  --gk-bg:#090909;
  --gk-bg2:#0f0f0f;
  --gk-bg3:#141414;
  --gk-border:#1e1e1e;
  --gk-border2:#282828;
  --gk-text:#e0e0e0;
  --gk-text-dim:#666;
  --gk-radius:10px;
  --gk-font:'Rajdhani',sans-serif;
  --gk-font-title:'Orbitron',monospace;
}

/* ── BASE ─────────────────────────────────────────────────── */
#gkCrafter{
  position:fixed;inset:0;top:44px;z-index:9000;display:none;
  flex-direction:column;
  background:var(--gk-bg);
  font-family:var(--gk-font);
  color:var(--gk-text);
  /* Subtle grid texture */
  background-image:
    linear-gradient(rgba(255,123,0,.025) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,123,0,.025) 1px, transparent 1px);
  background-size:40px 40px;
}
#gkCrafter.on{display:flex;}

/* ── TOPBAR ───────────────────────────────────────────────── */
#gkTop{
  display:flex;align-items:center;gap:10px;
  padding:0 16px;
  height:52px;
  background:linear-gradient(180deg,#111 0%,#0d0d0d 100%);
  border-bottom:1px solid var(--gk-border2);
  box-shadow:0 1px 0 rgba(255,123,0,.15), 0 2px 20px rgba(0,0,0,.6);
  flex-shrink:0;
  position:relative;
  z-index:10;
}
/* accent line at very top */
#gkTop::before{
  content:'';position:absolute;top:0;left:0;right:0;height:2px;
  background:linear-gradient(90deg,transparent,#ff7b00 30%,#ffd700 50%,#ff7b00 70%,transparent);
}
#gkTop h1{
  margin:0;
  font-family:var(--gk-font-title);
  font-size:.75em;
  font-weight:900;
  letter-spacing:4px;
  color:transparent;
  background:linear-gradient(90deg,#ff7b00,#ffd700,#ff7b00);
  background-clip:text;
  -webkit-background-clip:text;
  flex:1;
  text-shadow:none;
}
#gkNameIn{
  padding:6px 12px;
  background:#0a0a0a;
  border:1.5px solid #2a2a2a;
  color:var(--gk-text);
  border-radius:6px;
  width:160px;
  font-size:.85em;
  font-family:var(--gk-font);
  outline:none;
  transition:border-color .2s, box-shadow .2s;
  letter-spacing:.5px;
}
#gkNameIn:focus{
  border-color:var(--gk-orange);
  box-shadow:0 0 0 3px rgba(255,123,0,.15);
}
#gkNameIn.required{border-color:var(--gk-red);animation:gkShake .3s ease;}
#gkNameIn::placeholder{color:#666;}
@keyframes gkShake{0%,100%{transform:translateX(0)}25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}

/* ── BUTTONS ──────────────────────────────────────────────── */
.gkBtn{
  padding:7px 15px;
  border-radius:7px;
  cursor:pointer;
  font-size:.75em;
  letter-spacing:.8px;
  border:none;
  transition:all .15s;
  font-family:var(--gk-font);
  font-weight:600;
  white-space:nowrap;
  text-transform:uppercase;
  position:relative;
  overflow:hidden;
}
.gkBtn::after{
  content:'';position:absolute;inset:0;
  background:linear-gradient(180deg,rgba(255,255,255,.06) 0%,transparent 100%);
  pointer-events:none;
}
.gkBtnOr{
  background:linear-gradient(135deg,#ff7b00,#ff9a00);
  color:#000;font-weight:700;
  box-shadow:0 2px 12px rgba(255,123,0,.4);
}
.gkBtnOr:hover{background:linear-gradient(135deg,#ff9a00,#ffbb00);box-shadow:0 2px 18px rgba(255,150,0,.6);transform:translateY(-1px);}
.gkBtnOr:active{transform:translateY(0);}
.gkBtnGo{
  background:linear-gradient(135deg,#ffd700,#ff8800);
  color:#000;font-weight:800;font-size:.82em;
  box-shadow:0 2px 16px rgba(255,200,0,.45);
  letter-spacing:1.5px;
}
.gkBtnGo:hover{filter:brightness(1.15);transform:translateY(-1px);box-shadow:0 4px 24px rgba(255,200,0,.6);}
.gkBtnGo:active{transform:translateY(0);}
.gkBtnGh{
  background:#111;
  color:#ccc;
  border:1px solid #2a2a2a;
}
.gkBtnGh:hover{background:#1a1a1a;color:#ddd;border-color:#444;}

/* ── LAYOUT ───────────────────────────────────────────────── */
#gkBody{display:flex;flex:1;overflow:hidden;}

/* ── SIDEBAR ──────────────────────────────────────────────── */
#gkSide{
  width:290px;flex-shrink:0;
  background:var(--gk-bg2);
  border-right:1px solid var(--gk-border2);
  display:flex;flex-direction:column;overflow:hidden;
  position:relative;
}
/* subtle inner shadow on right edge */
#gkSide::after{
  content:'';position:absolute;right:0;top:0;bottom:0;width:1px;
  background:linear-gradient(180deg,transparent,rgba(255,123,0,.2) 50%,transparent);
  pointer-events:none;
}

/* ── TABS ─────────────────────────────────────────────────── */
.gkTabs{
  display:flex;
  border-bottom:1px solid var(--gk-border);
  background:#0a0a0a;
  flex-shrink:0;
}
.gkTab{
  flex:1;
  padding:14px 2px 12px;
  text-align:center;
  font-size:.72em;
  letter-spacing:.6px;
  cursor:pointer;
  color:#999;
  border-bottom:2px solid transparent;
  transition:all .2s;
  text-transform:uppercase;
  font-family:var(--gk-font);
  font-weight:700;
  position:relative;
}
.gkTab.on{
  color:var(--gk-orange);
  border-bottom-color:var(--gk-orange);
  background:rgba(255,123,0,.04);
}
.gkTab.on::after{
  content:'';position:absolute;bottom:-1px;left:25%;right:25%;height:2px;
  background:var(--gk-orange);
  box-shadow:var(--gk-orange-glow);
  border-radius:2px 2px 0 0;
}
.gkTab:hover:not(.on){color:#888;background:rgba(255,255,255,.02);}

/* ── PANEL ────────────────────────────────────────────────── */
.gkPanel{display:none;flex-direction:column;flex:1;overflow-y:auto;padding:14px 12px;}
.gkPanel.on{display:flex;}
.gkPanel::-webkit-scrollbar{width:3px;}
.gkPanel::-webkit-scrollbar-track{background:transparent;}
.gkPanel::-webkit-scrollbar-thumb{background:rgba(255,123,0,.25);border-radius:2px;}
.gkPanel::-webkit-scrollbar-thumb:hover{background:rgba(255,123,0,.5);}

/* ── LABELS ───────────────────────────────────────────────── */
.gkLbl{
  font-family:var(--gk-font-title);
  font-size:.65em;
  letter-spacing:2px;
  color:var(--gk-orange);
  margin-bottom:10px;
  text-transform:uppercase;
  opacity:.9;
  display:flex;
  align-items:center;
  gap:6px;
}
.gkLbl::after{
  content:'';flex:1;height:1px;
  background:linear-gradient(90deg,rgba(255,123,0,.3),transparent);
}

/* ── MAP / TOOL BUTTONS ───────────────────────────────────── */
.gkMapRow{display:flex;gap:7px;margin-bottom:14px;}
.gkMapBtn{
  flex:1;padding:14px 6px;
  border-radius:var(--gk-radius);
  border:1.5px solid var(--gk-border2);
  background:var(--gk-bg3);
  color:#bbb;
  cursor:pointer;
  font-size:.95em;
  font-family:var(--gk-font);
  font-weight:700;
  text-align:center;
  transition:all .2s;
  line-height:1.7;
  letter-spacing:.3px;
}
.gkMapBtn.on{
  border-color:var(--gk-orange);
  color:var(--gk-orange);
  background:rgba(255,123,0,.08);
  box-shadow:inset 0 0 14px rgba(255,123,0,.1),0 0 0 1px rgba(255,123,0,.25);
}
.gkMapBtn:hover:not(.on){border-color:#3a3a3a;color:#ddd;background:#161616;}

.gkToolRow{display:flex;gap:7px;margin-bottom:14px;}
.gkToolBtn{
  flex:1;padding:14px 6px;
  border-radius:var(--gk-radius);
  border:1.5px solid var(--gk-border2);
  background:var(--gk-bg3);
  color:#bbb;
  cursor:pointer;
  font-size:.95em;
  font-family:var(--gk-font);
  font-weight:700;
  text-align:center;
  transition:all .2s;
  line-height:1.7;
  letter-spacing:.3px;
}
.gkToolBtn.on{
  border-color:var(--gk-orange);
  color:var(--gk-orange);
  background:rgba(255,123,0,.08);
  box-shadow:inset 0 0 14px rgba(255,123,0,.1);
}
.gkToolBtn:hover:not(.on){border-color:#3a3a3a;color:#ddd;background:#161616;}

/* ── BG IMAGE UPLOAD ─────────────────────────────────────── */
#gkBgImgLbl:hover{border-color:var(--gk-orange)!important;color:var(--gk-orange)!important;background:#1a1400!important;}

/* ── HELP BOX ─────────────────────────────────────────────── */
.gkHelp{
  background:rgba(255,123,0,.04);
  border:1px solid rgba(255,123,0,.2);
  border-left:3px solid rgba(255,123,0,.6);
  border-radius:0 var(--gk-radius) var(--gk-radius) 0;
  padding:10px 12px;
  font-size:.74em;
  color:#cc9944;
  line-height:1.8;
  margin-bottom:14px;
  font-family:var(--gk-font);
}
.gkHelp b{color:#ffaa44;font-weight:700;}

/* ── ITEM GRID (obstacles / scenery) ─────────────────────── */
.gkItemGrid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:12px;}
.gkItem{
  padding:10px 4px 8px;
  border-radius:var(--gk-radius);
  border:1.5px solid var(--gk-border);
  background:var(--gk-bg3);
  cursor:pointer;
  text-align:center;
  transition:all .15s;
}
.gkItem:hover{
  border-color:var(--gk-orange);
  background:rgba(255,123,0,.05);
  transform:translateY(-1px);
  box-shadow:0 4px 12px rgba(0,0,0,.4);
}
.gkItem.on{
  border-color:var(--gk-red);
  background:rgba(255,34,68,.06);
  box-shadow:0 0 12px rgba(255,34,68,.2),inset 0 0 8px rgba(255,34,68,.05);
}
.gkItem img{
  width:44px;height:44px;
  object-fit:contain;
  image-rendering:pixelated;
  display:block;margin:0 auto 5px;
  filter:drop-shadow(0 2px 4px rgba(0,0,0,.5));
  transition:transform .15s;
}
.gkItem:hover img{transform:scale(1.08);}
.gkItem .ilbl{font-size:.74em;color:#aaa;font-family:var(--gk-font);font-weight:700;letter-spacing:.3px;}
.gkItem.on .ilbl{color:#ff8855;}

/* ── SIDE BUTTONS (pairs) ─────────────────────────────────── */
.gkSideRow{display:flex;gap:7px;margin-bottom:12px;}
.gkSideBtn{
  flex:1;padding:12px 8px;
  border-radius:8px;
  border:1.5px solid var(--gk-border2);
  background:var(--gk-bg3);
  color:#bbb;
  cursor:pointer;
  font-size:.95em;
  font-family:var(--gk-font);
  font-weight:700;
  transition:all .2s;
  letter-spacing:.3px;
  text-align:center;
}
.gkSideBtn.on{
  border-color:var(--gk-orange);
  color:var(--gk-orange);
  background:rgba(255,123,0,.08);
  box-shadow:inset 0 0 10px rgba(255,123,0,.08);
}
.gkSideBtn:hover:not(.on){border-color:#3a3a3a;color:#ddd;}

/* ── SAVED LIST ───────────────────────────────────────────── */
.gkSavedList{display:flex;flex-direction:column;gap:6px;}
.gkSavedItem{
  display:flex;align-items:flex-start;gap:8px;
  padding:10px 12px;
  border-radius:var(--gk-radius);
  border:1px solid var(--gk-border);
  background:var(--gk-bg3);
  cursor:pointer;
  transition:all .2s;
  position:relative;
  overflow:visible;
  flex-wrap:nowrap;
}
.gkSavedItem::before{
  content:'';position:absolute;left:0;top:0;bottom:0;width:3px;
  background:var(--gk-orange);
  opacity:0;
  transition:opacity .2s;
}
.gkSavedItem:hover{
  border-color:#2e2e2e;
  background:#161616;
  transform:translateX(2px);
}
.gkSavedItem:hover::before{opacity:1;}
.gkSavedItem .sname{flex:1;font-size:.84em;color:#fff;font-family:var(--gk-font);font-weight:600;}
.gkSavedItem .smeta{font-size:.66em;color:#888;font-family:var(--gk-font);}
.gkSavedItem .sdel{
  background:none;border:none;color:#f44;cursor:pointer;
  font-size:.9em;opacity:.25;transition:opacity .2s,transform .15s;
  padding:2px 4px;
}
.gkSavedItem .sdel:hover{opacity:1;transform:scale(1.2);}
#gkNoSaved{
  color:#555;font-size:.78em;text-align:center;padding:32px 12px;
  font-family:var(--gk-font-title);letter-spacing:1px;
}

/* ── MAIN AREA ────────────────────────────────────────────── */
#gkMain{flex:1;display:flex;flex-direction:column;overflow:hidden;}
#gkCanvasRow{flex:1;display:flex;overflow:hidden;}

/* ── DRAW CANVAS ──────────────────────────────────────────── */
#gkDrawWrap{
  flex:0 0 340px;min-width:120px;max-width:80%;
  position:relative;overflow:hidden;
  background:#060606;
  /* Checkerboard hint */
  background-image:
    radial-gradient(circle at 50% 100%, rgba(255,123,0,.04) 0%, transparent 70%),
    linear-gradient(rgba(255,255,255,.015) 1px,transparent 1px),
    linear-gradient(90deg,rgba(255,255,255,.015) 1px,transparent 1px);
  background-size:100% 100%, 24px 24px, 24px 24px;
}
#gkDrawCanvas{position:absolute;inset:0;width:100%;height:100%;cursor:crosshair;touch-action:none;}
#gkDrawLabel{
  position:absolute;top:10px;left:50%;transform:translateX(-50%);
  background:rgba(0,0,0,.88);
  border:1px solid rgba(255,123,0,.35);
  border-radius:20px;
  padding:5px 16px;
  font-size:.68em;
  font-family:var(--gk-font);
  font-weight:600;
  color:#ff9a44;
  pointer-events:none;white-space:nowrap;
  letter-spacing:.5px;
  box-shadow:0 2px 12px rgba(0,0,0,.6);
}
#gkDrawActions{
  position:absolute;bottom:14px;left:50%;transform:translateX(-50%);
  display:flex;gap:8px;
}

/* ── RESIZER ──────────────────────────────────────────────── */
#gkResizer{
  width:5px;flex-shrink:0;
  background:var(--gk-border);
  cursor:col-resize;
  position:relative;
  transition:background .15s;
  z-index:10;
}
#gkResizer:hover,#gkResizer.dragging{background:var(--gk-orange);}
#gkResizer::after{
  content:'';position:absolute;
  top:50%;left:50%;transform:translate(-50%,-50%);
  width:2px;height:50px;border-radius:2px;
  background:rgba(255,123,0,.3);
  transition:background .15s,height .15s;
}
#gkResizer:hover::after,#gkResizer.dragging::after{
  background:var(--gk-orange);
  box-shadow:var(--gk-orange-glow);
  height:60px;
}

/* ── PREVIEW AREA ─────────────────────────────────────────── */
#gkPreviewWrap{
  flex:1;min-width:100px;
  position:relative;
  background:#050505;
  overflow:hidden;
}
#gkPreviewCanvas{position:absolute;inset:0;width:100%;height:100%;touch-action:none;}
#gkPreviewLabel{
  position:absolute;top:8px;left:50%;transform:translateX(-50%);
  background:rgba(0,0,0,.88);
  border:1px solid rgba(255,123,0,.3);
  border-radius:14px;
  padding:5px 16px;
  font-size:.68em;
  font-family:var(--gk-font);
  font-weight:600;
  letter-spacing:.5px;
  color:var(--gk-orange);
  pointer-events:none;
  box-shadow:0 2px 12px rgba(0,0,0,.5);
}

/* ── ZOOM BUTTONS ─────────────────────────────────────────── */
#gkZoom{position:absolute;bottom:14px;right:12px;display:flex;flex-direction:column;gap:5px;}
.gkZBtn{
  width:32px;height:32px;
  border-radius:8px;
  background:rgba(10,10,10,.9);
  border:1.5px solid rgba(255,123,0,.3);
  color:var(--gk-orange);
  font-size:1.1em;
  cursor:pointer;
  display:flex;align-items:center;justify-content:center;
  transition:all .15s;
  backdrop-filter:blur(4px);
}
.gkZBtn:hover{
  background:rgba(255,123,0,.15);
  border-color:var(--gk-orange);
  box-shadow:var(--gk-orange-glow);
  transform:scale(1.1);
}

/* ── STATS BAR ────────────────────────────────────────────── */
#gkStats{
  background:#060606;
  border-top:1px solid var(--gk-border);
  padding:5px 18px;
  display:flex;gap:22px;
  font-size:.65em;
  font-family:var(--gk-font-title);
  color:#888;
  flex-shrink:0;
  letter-spacing:.5px;
}
#gkStats span{color:#ff7b00;font-weight:700;}

/* ── TOAST ────────────────────────────────────────────────── */
#gkToast{
  position:fixed;bottom:30px;left:50%;transform:translateX(-50%) translateY(20px);
  background:#ff8000;
  color:#000;font-weight:800;
  padding:14px 32px;border-radius:40px;
  font-size:1.05em;font-family:var(--gk-font);
  letter-spacing:.5px;
  z-index:9999;opacity:0;
  transition:opacity .2s, transform .35s cubic-bezier(.175,.885,.32,1.275);
  pointer-events:none;
  box-shadow:0 8px 32px rgba(255,120,0,.65), 0 2px 10px rgba(0,0,0,.5);
  white-space:nowrap;
}
#gkToast.on{opacity:1;transform:translateX(-50%) translateY(0);}

/* ── CLOSE TOOLTIP ────────────────────────────────────────── */
@keyframes gkPulse{from{opacity:0.6;box-shadow:0 0 10px rgba(0,255,128,.3);}to{opacity:1;box-shadow:0 0 24px rgba(0,255,128,.7);}}
#gkCloseTooltip{
  position:absolute;top:22px;left:50%;transform:translateX(-50%);
  background:rgba(0,255,128,0.08);
  border:1.5px solid rgba(0,255,128,0.5);
  color:#00ff80;
  padding:9px 28px;
  font-size:.78em;font-weight:700;
  font-family:var(--gk-font-title);
  letter-spacing:2.5px;text-transform:uppercase;
  pointer-events:none;display:none;
  border-radius:4px;
  text-shadow:0 0 12px #00ff80;
  animation:gkPulse .9s ease-in-out infinite alternate;
  white-space:nowrap;z-index:10;
}
#gkUndoBtn{}

/* ── COLOR PANEL ──────────────────────────────────────────── */
.gkColorRow{display:flex;flex-direction:column;gap:10px;margin-bottom:14px;}
.gkColorItem{
  display:flex;align-items:center;gap:10px;
  padding:7px 10px;
  background:var(--gk-bg3);
  border:1px solid var(--gk-border);
  border-radius:8px;
  transition:border-color .2s;
}
.gkColorItem:hover{border-color:var(--gk-border2);}
.gkColorItem label{font-size:.72em;color:#ccc;flex:1;font-family:var(--gk-font);font-weight:600;}
.gkColorItem input[type=color]{
  width:38px;height:26px;
  border:none;border-radius:5px;cursor:pointer;
  background:none;padding:0;
  outline:none;
}
.gkColorPreview{
  display:flex;gap:0;margin-top:8px;
  border-radius:8px;overflow:hidden;height:30px;
  box-shadow:0 2px 8px rgba(0,0,0,.5);
}
.gkColorPreview div{flex:1;}

/* ── PREVIEW TOGGLE ───────────────────────────────────────── */
#gkPvToggle{
  position:absolute;top:10px;left:50%;transform:translateX(-50%);
  display:flex;
  border:1.5px solid rgba(255,123,0,.5);
  border-radius:10px;overflow:hidden;
  z-index:20;
  box-shadow:0 0 20px rgba(255,123,0,.3),0 4px 12px rgba(0,0,0,.5);
  backdrop-filter:blur(6px);
}
.gkPvBtn{
  flex:1;padding:9px 24px;
  font-size:.78em;letter-spacing:1px;font-weight:700;
  background:rgba(10,10,10,.92);
  color:#444;border:none;cursor:pointer;
  transition:all .2s;
  font-family:var(--gk-font);
  white-space:nowrap;
  text-transform:uppercase;
}
.gkPvBtn:hover:not(.on){background:rgba(255,123,0,.1);color:#ff9a44;}
.gkPvBtn.on{
  background:linear-gradient(135deg,#ff7b00,#ff9a00);
  color:#000;font-weight:800;
}
#gkPvToggle .gkPvBtn:first-child{border-right:1px solid rgba(255,123,0,.25);}

/* ── 3D CONTROLS ──────────────────────────────────────────── */
#gk3dControls{
  position:absolute;bottom:12px;left:50%;transform:translateX(-50%);
  display:flex;gap:6px;z-index:10;
}
#gkPitchSlider{
  position:absolute;right:12px;top:56px;
  display:none;flex-direction:column;align-items:center;gap:5px;z-index:20;
}
#gkPitchSlider.on{display:flex;}
#gkPitchSlider label{
  font-size:.58em;color:var(--gk-orange);
  font-family:var(--gk-font-title);letter-spacing:.5px;
}
#gkPitchSlider input{
  writing-mode:vertical-lr;direction:rtl;
  width:22px;height:90px;accent-color:var(--gk-orange);cursor:pointer;
}
.gk3dBtn{
  padding:5px 11px;
  border-radius:7px;
  border:1px solid #2a2a2a;
  background:rgba(5,5,5,.88);
  color:var(--gk-orange);
  cursor:pointer;
  font-size:.7em;
  font-family:var(--gk-font);
  font-weight:600;
  transition:all .2s;
  backdrop-filter:blur(4px);
  letter-spacing:.3px;
}
.gk3dBtn:hover{background:rgba(255,123,0,.15);border-color:rgba(255,123,0,.5);}
.gk3dBtn.on{
  background:rgba(255,123,0,.2);
  border-color:var(--gk-orange);
  box-shadow:var(--gk-orange-glow);
}
#gk3dSlider{
  display:none;position:absolute;bottom:42px;left:50%;transform:translateX(-50%);
  width:160px;accent-color:var(--gk-orange);
}
#gk3dSlider.on{display:block;}

/* ── MODAL 3D ─────────────────────────────────────────────── */
#gk3dModal{position:fixed;inset:0;z-index:9200;display:none;flex-direction:column;background:#000;}
#gk3dModal.on{display:flex;}
#gk3dModalTop{
  display:flex;align-items:center;gap:10px;
  padding:10px 18px;
  background:#060606;
  border-bottom:1px solid var(--gk-border2);
  box-shadow:0 1px 0 rgba(255,123,0,.2);
  flex-shrink:0;z-index:10;
  position:relative;
}
#gk3dModalTop::before{
  content:'';position:absolute;top:0;left:0;right:0;height:2px;
  background:linear-gradient(90deg,transparent,#ff7b00 30%,#ffd700 50%,#ff7b00 70%,transparent);
}
#gk3dModalTitle{
  flex:1;
  font-family:var(--gk-font-title);
  font-size:.78em;letter-spacing:2.5px;
  color:var(--gk-orange);font-weight:700;
}
.gk3dMBtn{
  padding:6px 14px;
  border-radius:7px;
  border:1.5px solid #2a2a2a;
  background:rgba(20,20,20,.9);
  color:var(--gk-orange);
  cursor:pointer;
  font-size:.72em;
  font-family:var(--gk-font);
  font-weight:600;
  transition:all .2s;
  white-space:nowrap;
  letter-spacing:.3px;
}
.gk3dMBtn:hover{background:rgba(255,123,0,.18);border-color:rgba(255,123,0,.5);}
.gk3dMBtn.on{background:rgba(255,123,0,.28);border-color:var(--gk-orange);color:#ffcc66;}
#gk3dModalCanvas{flex:1;width:100%;display:block;cursor:ew-resize;touch-action:none;}
#gk3dModalBottom{
  display:flex;align-items:center;justify-content:center;gap:14px;
  padding:8px 18px;
  background:#060606;
  border-top:1px solid var(--gk-border);
  flex-shrink:0;
}
#gk3dModalHint{font-size:.66em;color:#888;pointer-events:none;font-family:var(--gk-font);letter-spacing:.3px;}
#gk3dModalPosWrap{display:flex;align-items:center;gap:8px;}
#gk3dModalPosWrap label{font-size:.66em;color:#aaa;font-family:var(--gk-font);}
#gk3dModalPos{width:140px;accent-color:var(--gk-orange);cursor:pointer;}
`;
  document.head.appendChild(s);
}

function injectHTML(){
  const d=document.createElement("div");
  d.id="gkCrafter";
  d.innerHTML=`
<div id="gkTop">
  <button class="gkBtn gkBtnGh" id="gkBack">← MAPPE</button>
  <h1>⚙ CIRCUIT CRAFTER</h1>
  <input id="gkNameIn" placeholder="Nome circuito..." maxlength="28"/>
  <button class="gkBtn gkBtnGh" id="gkNew">🗋 Nuovo</button>
  <button class="gkBtn gkBtnOr" id="gkSave">💾 Salva</button>
  <button class="gkBtn gkBtnGo" id="gkPlay">▶ GIOCA!</button>
</div>
<div id="gkBody">
  <div id="gkSide">
    <div class="gkTabs">
      <div class="gkTab on"  data-tab="disegna">✏️ Disegna</div>
      <div class="gkTab"     data-tab="elementi">🎯 Elementi</div>
      <div class="gkTab"     data-tab="colori">🎨 Colori</div>
      <div class="gkTab"     data-tab="salvati">📁 Salvati</div>
    </div>
    <div class="gkPanel on" id="gkTab-disegna">
      <div class="gkLbl">Tema mappa</div>
      <div class="gkMapRow">
        <div class="gkMapBtn on" data-mappa="montagna">⛰️<br>Montagna</div>
        <div class="gkMapBtn"    data-mappa="citta">🏙️<br>Città</div>
        <div class="gkMapBtn"    data-mappa="deserto">🌲<br>Foresta</div>
      </div>
      <div class="gkHelp">
        <b>Come disegnare:</b><br>
        🖱 <b>Tieni premuto</b> e trascina per disegnare.<br>
        🟢 Per chiudere: <b>rilascia sul punto verde</b> di partenza.<br>
        ✂️ <b>Annulla</b> → attiva modalità cancellazione, poi clicca sul tracciato.<br>
        <b>CANCELLA</b> per ricominciare · <b>APPLICA</b> per lisciare.
      </div>
      <div class="gkLbl">🛣 Larghezza pista</div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
        <span style="font-size:.62em;color:#aaa;">Stretta</span>
        <input type="range" id="gkRoadW" min="1000" max="6000" step="100" value="3000"
          style="flex:1;accent-color:#ff7b00;cursor:pointer;">
        <span style="font-size:.62em;color:#aaa;">Larga</span>
      </div>
      <div style="text-align:center;font-size:.7em;color:#ff9a44;margin-bottom:12px;">
        Valore: <span id="gkRoadWVal" style="font-weight:bold;">3000</span>
      </div>
      <div class="gkLbl">🏎 Avversari</div>
      <div class="gkSideRow" style="margin-bottom:12px;">
        <button class="gkSideBtn on" id="gkOppOn">✓ Attivi</button>
        <button class="gkSideBtn"    id="gkOppOff">✗ Disattivi</button>
      </div>
      <div class="gkLbl">🖼 Sfondo panorama</div>
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:14px;">
        <label id="gkBgImgLbl" style="flex:1;padding:12px 10px;border-radius:8px;border:1.5px dashed #2a2a2a;background:#141414;color:#bbb;font-size:.82em;font-family:var(--gk-font);font-weight:600;cursor:pointer;text-align:center;transition:all .2s;display:block;" title="Carica immagine di sfondo per la vista 360°">
          📷 Carica foto sfondo…
          <input type="file" id="gkBgImgInput" accept="image/*" style="display:none;">
        </label>
        <button class="gkSideBtn" id="gkBgImgClear" style="flex:0 0 auto;padding:12px 14px;" title="Rimuovi immagine">✕</button>
      </div>
    </div>
    <div class="gkPanel" id="gkTab-elementi">
      <div id="gkPlacingBanner" style="display:none;align-items:center;gap:8px;background:#1a2a00;border:1.5px solid #7bff00;border-radius:8px;padding:8px 10px;margin-bottom:8px;font-size:.72em;color:#aaff44;">
        <span style="flex:1"></span>
        <button style="background:none;border:none;color:#ff4444;cursor:pointer;font-size:1em;padding:0 2px;">✕</button>
      </div>
      <div class="gkLbl">Strumento</div>
      <div class="gkToolRow">
        <div class="gkToolBtn on" data-tool="obstacle">🚧<br>Ostacoli</div>
        <div class="gkToolBtn"    data-tool="scenery">🌲<br>Scenografia</div>
      </div>
      <div id="gkObsPanel">
        <div class="gkHelp">Seleziona ostacolo poi <b>clicca sull'anteprima</b> vicino al percorso.</div>
        <div class="gkLbl">Tipo ostacolo</div>
        <div class="gkItemGrid" id="gkObsGrid"></div>
      </div>
      <div id="gkScePanel" style="display:none;">
        <div class="gkHelp">Seleziona elemento e lato poi <b>clicca sull'anteprima</b>.</div>
        <div class="gkLbl">Tema</div>
        <div class="gkMapRow" id="gkSceTheme">
          <div class="gkMapBtn on" data-theme="montagna">⛰️</div>
          <div class="gkMapBtn"    data-theme="citta">🏙️</div>
          <div class="gkMapBtn"    data-theme="deserto">🌲</div>
        </div>
        <div class="gkLbl">Lato</div>
        <div class="gkSideRow">
          <button class="gkSideBtn on" data-side="L">◀ Sinistra</button>
          <button class="gkSideBtn"    data-side="R">Destra ▶</button>
        </div>
        <div class="gkLbl">Elemento</div>
        <div class="gkItemGrid" id="gkSceGrid"></div>
      </div>
      <div style="margin-top:8px;">
        <div class="gkLbl">Posizionati (<span id="gkPlacedCount">0</span>)</div>
        <button class="gkBtn gkBtnGh" id="gkClearPlaced" style="width:100%;font-size:.68em;">🗑 Rimuovi tutti</button>
      </div>
    </div>
    <div class="gkPanel" id="gkTab-colori">
      <div class="gkLbl">Colori Asfalto</div>
      <div class="gkColorRow">
        <div class="gkColorItem">
          <label>🛣 Asfalto</label>
          <input type="color" id="gkColAsfalto" value="#c8c8c8">
        </div>
        <div class="gkColorItem">
          <label>⬜ Bordi / Rumble</label>
          <input type="color" id="gkColBordo" value="#ffffff">
        </div>
        <div class="gkColorItem">
          <label>🌿 Fuori pista</label>
          <input type="color" id="gkColErba" value="#1a6010">
        </div>
      </div>
      <div class="gkLbl">Anteprima colori</div>
      <div class="gkColorPreview">
        <div id="gkCpErba"></div>
        <div id="gkCpBordo" style="flex:.15;"></div>
        <div id="gkCpAsfalto"></div>
        <div id="gkCpBordo2" style="flex:.15;"></div>
        <div id="gkCpErba2"></div>
      </div>
      <div style="margin-top:14px;">
        <div class="gkLbl">Preset rapidi</div>
        <div class="gkMapRow" style="flex-wrap:wrap;gap:4px;" id="gkColorPresets"></div>
      </div>
    </div>
    <div class="gkPanel" id="gkTab-salvati">
      <div style="display:flex;gap:6px;margin-bottom:10px;">
      </div>
      <div class="gkSavedList" id="gkSavedList"><div id="gkNoSaved">Nessun circuito salvato</div></div>
      <div style="margin-top:16px;border-top:1px solid rgba(255,255,255,0.1);padding-top:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <span style="font-size:0.85em;color:#ffcc00;font-weight:bold;">☁️ DATABASE</span>
          <button onclick="window.CrafterAPI&&window.CrafterAPI.loadSavedMapsFromDatabase()" style="background:rgba(255,204,0,0.15);border:1px solid #ffcc00;color:#ffcc00;border-radius:5px;padding:3px 8px;cursor:pointer;font-size:0.75em;">🔄</button>
        </div>
        <div id="gkDbList"><p style="color:#aaa;font-size:0.8em;text-align:center;">Caricamento...</p></div>

      </div>
    </div>
  </div>
  <div id="gkMain">
    <div id="gkCanvasRow">
      <div id="gkDrawWrap">
        <canvas id="gkDrawCanvas"></canvas>
        <div id="gkDrawLabel">🖱 Tieni premuto e trascina per disegnare il circuito</div>
        <div id="gkCloseTooltip">⟳ Circuito chiuso!</div>
        <div id="gkDrawActions">
          <button class="gkBtn gkBtnGh" id="gkUndoBtn">↩ Annulla</button>
          <button class="gkBtn gkBtnGh" id="gkClearDraw">🗑 Cancella</button>
          <button class="gkBtn gkBtnOr" id="gkSmooth">✨ Applica</button>
        </div>
      </div>
      <div id="gkResizer" title="Trascina per ridimensionare"></div>
      <div id="gkPreviewWrap">
        <canvas id="gkPreviewCanvas"></canvas>
        <div id="gkPvToggle">
          <button class="gkPvBtn on" id="gkPv2d">🗺 2D</button>
          <button class="gkPvBtn"    id="gkPv3d">🔄 360°</button>
        </div>
        <div id="gk3dControls" style="display:none;">
          <button class="gk3dBtn on" id="gk3dAuto">⟳ Auto</button>
          <button class="gk3dBtn" id="gk3dPosBtn">📍 Pos</button>
          <button class="gk3dBtn" id="gk3dMoveBtn" title="Deseleziona elemento e torna a ruotare">✋ Muovi</button>
        </div>
        <div id="gkPitchSlider">
          <label>Alto</label>
          <input type="range" id="gkPitchRange" min="30" max="140" value="65" orient="vertical">
          <label>Obliquo</label>
        </div>
        <input type="range" id="gk3dSlider" min="0" max="100" value="0">
        <div id="gkZoom">
          <button class="gkZBtn" id="gkZIn">+</button>
          <button class="gkZBtn" id="gkZOut">−</button>
        </div>
        <button id="gkDeselectBtn" title="Deseleziona e torna a muovere" onclick="window._gkCancelPlace()" style="display:none;position:absolute;top:55px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,.82);border:2px solid #ff7b00;color:#ff9a44;border-radius:20px;padding:6px 18px;font-size:.78em;cursor:pointer;white-space:nowrap;z-index:20;font-family:inherit;">✋ Fine posizionamento</button>
      </div>
    </div>
    <div id="gkStats">
      Punti: <span id="gkStatPts">0</span> &nbsp;
      Lungh.: <span id="gkStatLen">0</span> seg &nbsp;
      Ostacoli: <span id="gkStatObs">0</span> &nbsp;
      Scenogr.: <span id="gkStatSce">0</span>
    </div>
  </div>
</div>
<div id="gkToast"></div>
<div id="gk3dModal">
  <div id="gk3dModalTop">
    <span id="gk3dModalTitle">🎮 ANTEPRIMA 3D — 360°</span>
    <button class="gk3dMBtn on" id="gk3dMAutoBtn">⟳ Auto-rotazione</button>
    <button class="gk3dMBtn" id="gk3dMPovBtn">👁 In pista</button>
    <button class="gk3dMBtn" style="color:#ff5555;border-color:#ff5555;" id="gk3dMClose">✕ Chiudi</button>
  </div>
  <canvas id="gk3dModalCanvas"></canvas>
  <div id="gk3dModalBottom">
    <span id="gk3dModalHint">⟵ Trascina per ruotare · Rotella per zoom</span>
    <div id="gk3dModalPosWrap">
      <label>📍 Posizione:</label>
      <input type="range" id="gk3dModalPos" min="0" max="100" value="0">
    </div>
  </div>
</div>`;
  document.body.appendChild(d);
}

// ── Distanza minima dal punto p alla polilinea path (punto-segmento) ─────────
function distToPath(p, path){
  if(!path||path.length<2) return Infinity;
  let minD=Infinity;
  for(let i=0;i<path.length-1;i++){
    const A=path[i], B=path[i+1];
    const dx=B.x-A.x, dy=B.y-A.y;
    const lenSq=dx*dx+dy*dy;
    if(lenSq===0){ minD=Math.min(minD,Math.hypot(p.x-A.x,p.y-A.y)); continue; }
    const t=Math.max(0,Math.min(1,((p.x-A.x)*dx+(p.y-A.y)*dy)/lenSq));
    minD=Math.min(minD,Math.hypot(p.x-(A.x+t*dx),p.y-(A.y+t*dy)));
  }
  // Chiudi il loop
  if(path.length>2){
    const A=path[path.length-1], B=path[0];
    const dx=B.x-A.x, dy=B.y-A.y;
    const lenSq=dx*dx+dy*dy;
    if(lenSq>0){
      const t=Math.max(0,Math.min(1,((p.x-A.x)*dx+(p.y-A.y)*dy)/lenSq));
      minD=Math.min(minD,Math.hypot(p.x-(A.x+t*dx),p.y-(A.y+t*dy)));
    }
  }
  return minD;
}

// ── Rimuove il punto del rawPath più vicino a p, ricostruisce drawSegments ───
function removeNearestPoint(p){
  if(!S.rawPath.length) return;
  let bestIdx=0, bestD=Infinity;
  S.rawPath.forEach((pt,i)=>{
    const d=Math.hypot(p.x-pt.x,p.y-pt.y);
    if(d<bestD){bestD=d;bestIdx=i;}
  });
  const newPath=S.rawPath.slice();
  newPath.splice(bestIdx,1);
  S.drawSegments=newPath.length>0?[newPath.slice()]:[];
  rebuildRawPath();
  if(S.rawPath.length>3){ S.smoothPath=[]; applySmooth(); }
  else S.smoothPath=[];
  updateDrawLabel(); updateStats();
  toast("✂️ Punto rimosso");
}

function bindEvents(){
  document.getElementById("gkBack").onclick = hide;
  document.getElementById("gkNew").onclick  = newCircuit;
  document.getElementById("gkSave").onclick = saveCircuit;
  document.getElementById("gkPlay").onclick = playCircuit;
  



  // TABS — disabilita draw canvas quando non nel tab disegna
  document.querySelectorAll(".gkTab").forEach(t=>{
    t.onclick=()=>{
      document.querySelectorAll(".gkTab").forEach(x=>x.classList.remove("on"));
      t.classList.add("on");
      document.querySelectorAll(".gkPanel").forEach(p=>p.classList.remove("on"));
      document.getElementById("gkTab-"+t.dataset.tab).classList.add("on");
      // Disabilita eventi sul draw canvas se non nel tab disegna
      drawCanvas.style.pointerEvents = t.dataset.tab==="disegna" ? "auto" : "none";
    };
  });

  // MAPPA
  document.querySelectorAll(".gkMapBtn").forEach(b=>{
    b.onclick=()=>{
      if(!b.dataset.mappa) return;
      document.querySelectorAll(".gkMapBtn").forEach(x=>x.classList.remove("on"));
      b.classList.add("on");
      S.mappa=b.dataset.mappa;
      // Se c'era una foto custom, la rimuove — ha scelto il tema
      if(S.customBgImg){
        S.customBgImg=null;
        document.getElementById("gkBgImgInput").value="";
        const lbl=document.getElementById("gkBgImgLbl");
        lbl.childNodes[0].textContent="📷 Carica foto sfondo… ";
        lbl.style.borderColor=""; lbl.style.color="";
      }
    };
  });

  // TOOL — mostra/nasconde pannelli
  document.querySelectorAll(".gkToolBtn").forEach(b=>{
    b.onclick=()=>{
      document.querySelectorAll(".gkToolBtn").forEach(x=>x.classList.remove("on"));
      b.classList.add("on");
      S.tool=b.dataset.tool;
      document.getElementById("gkObsPanel").style.display=S.tool==="obstacle"?"block":"none";
      document.getElementById("gkScePanel").style.display=S.tool==="scenery"?"block":"none";
      if(S.tool==="obstacle") S.selScenery=null;
      else S.selObstacle=null;
      updatePlacingBanner();
    };
  });

  // OBSTACLE GRID
  const og=document.getElementById("gkObsGrid");
  OBSTACLES_DEF.forEach(d=>{
    const el=document.createElement("div");
    el.className="gkItem";
    el.innerHTML=`<img src="${d.src}"><div class="ilbl">${d.label}</div>`;
    el.onclick=()=>{
      og.querySelectorAll(".gkItem").forEach(x=>x.classList.remove("on"));
      document.getElementById("gkSceGrid").querySelectorAll(".gkItem").forEach(x=>x.classList.remove("on"));
      el.classList.add("on");
      S.selObstacle=d; S.selScenery=null; S.tool="obstacle";
      updatePlacingBanner();
      toast("🚧 "+d.label+" selezionato — ora clicca sull'anteprima a destra!");
    };
    og.appendChild(el);
  });

  // SCENERY THEME
  document.querySelectorAll("#gkSceTheme .gkMapBtn").forEach(b=>{
    b.onclick=()=>{
      document.querySelectorAll("#gkSceTheme .gkMapBtn").forEach(x=>x.classList.remove("on"));
      b.classList.add("on"); S.sceneryTheme=b.dataset.theme;
      buildSceGrid();
    };
  });
  buildSceGrid();

  // SIDE
  document.querySelectorAll(".gkSideBtn").forEach(b=>{
    b.onclick=()=>{
      document.querySelectorAll(".gkSideBtn").forEach(x=>x.classList.remove("on"));
      b.classList.add("on"); S.selSide=b.dataset.side;
      updatePlacingBanner();
    };
  });

  // DRAW CANVAS
  const dc=drawCanvas;
  function resizeDraw(){
    const wr=document.getElementById("gkDrawWrap");
    dc.width=wr.clientWidth||340; dc.height=wr.clientHeight||500;
  }
  setTimeout(resizeDraw,60);
  window.addEventListener("resize",()=>{ resizeDraw(); resizePrev(); });

  dc.addEventListener("pointerdown",e=>{
    const activeTab=document.querySelector(".gkTab.on");
    if(!activeTab||activeTab.dataset.tab!=="disegna") return;
    // In modalità cancellazione: non avviare il disegno, gestire solo il click
    if(S.deleteMode){
      dc.setPointerCapture(e.pointerId);
      S._clickStartPt=dcPos(e);
      S._didDrag=false;
      S.drawing=false;
      return;
    }
    if(S.isClosed) return;
    dc.setPointerCapture(e.pointerId);
    S._clickStartPt=dcPos(e);
    S._didDrag=false;
    S.drawing=false;
  });

  dc.addEventListener("pointermove",e=>{
    if(!S._clickStartPt) return;
    // In modalità cancellazione non si disegna
    if(S.deleteMode){
      S._didDrag=true; // segna che si è mosso (non è un click puro)
      return;
    }
    if(S.isClosed){ S._clickStartPt=null; return; }
    const p=dcPos(e);
    const dx=p.x-S._clickStartPt.x, dy=p.y-S._clickStartPt.y;
    if(!S._didDrag && dx*dx+dy*dy < DRAW_SAMPLE_DIST*DRAW_SAMPLE_DIST) return;

    if(!S._didDrag){
      S._didDrag=true;
      S.drawing=true;
      const start=S._clickStartPt;
      const lastSegment=S.drawSegments[S.drawSegments.length-1];
      const canContinue=lastSegment&&lastSegment.length&&Math.hypot(start.x-lastSegment[lastSegment.length-1].x,start.y-lastSegment[lastSegment.length-1].y)<=DRAW_CONTINUE_RADIUS;
      if(canContinue){ lastSegment.push(start); }
      else { S.drawSegments.push([start]); }
      rebuildRawPath();
      S.lastPt=start;
    }

    if(!S.drawing) return;
    const p2=dcPos(e);
    const dx2=p2.x-S.lastPt.x, dy2=p2.y-S.lastPt.y;
    if(dx2*dx2+dy2*dy2 < DRAW_SAMPLE_DIST*DRAW_SAMPLE_DIST) return;
    const lastSegment=S.drawSegments[S.drawSegments.length-1];
    if(lastSegment){ lastSegment.push(p2); }
    rebuildRawPath();
    S.lastPt=p2;
  });

  dc.addEventListener("pointerup",e=>{
    const startPt=S._clickStartPt;
    const wasDrag=S._didDrag;
    S._clickStartPt=null;
    S._didDrag=false;

    // ── Modalità cancellazione ──────────────────────────────────────────
    if(S.deleteMode){
      // Solo click puro (nessun drag significativo) → tenta cancellazione
      if(!wasDrag && startPt && S.rawPath && S.rawPath.length>=2){
        const HIT_RADIUS=DRAW_TRACK_WIDTH/2+6;
        const dist=distToPath(startPt,S.rawPath);
        if(dist<=HIT_RADIUS){
          removeNearestPoint(startPt);
        }
      }
      S.drawing=false;
      return;
    }

    // ── Modalità disegno normale ────────────────────────────────────────
    if(wasDrag){
      S.drawing=false;
      rebuildRawPath();
      if(!S.isClosed && S.rawPath.length>=DRAW_MIN_POINTS){
        const start=S.rawPath[0], last=S.rawPath[S.rawPath.length-1];
        if(Math.hypot(last.x-start.x,last.y-start.y)<=DRAW_CLOSE_RADIUS){ closeDraw(); return; }
      }
      if(!S.isClosed && S.rawPath.length>3){ S.smoothPath=[]; applySmooth(); }
      updateDrawLabel();
      return;
    }

    // Click puro in modalità disegno: non fa nulla
    S.drawing=false;
  });

  dc.addEventListener("pointerleave",()=>{
    if(S.drawing){
      S.drawing=false;
      S._clickStartPt=null;
      S._didDrag=false;
      rebuildRawPath();
      if(!S.isClosed && S.rawPath.length>3){ S.smoothPath=[]; applySmooth(); }
      updateDrawLabel();
    }
  });

  document.getElementById("gkUndoBtn").onclick=()=>toggleDeleteMode();
  document.getElementById("gkClearDraw").onclick=()=>{
    S.drawSegments=[]; S.rawPath=[]; S.smoothPath=[]; S.obstacles=[]; S.scenery=[];
    S.isClosed=false;
    const tip=document.getElementById("gkCloseTooltip"); if(tip) tip.style.display='none';
    updateDrawLabel(); renderDraw(); updateStats();
  };
  document.getElementById("gkSmooth").onclick=()=>applySmooth();

  // PREVIEW CANVAS
  const pc=previewCanvas;
  function resizePrev(){
    const wr=document.getElementById("gkPreviewWrap");
    pc.width=wr.clientWidth||600; pc.height=wr.clientHeight||500;
  }
  setTimeout(resizePrev,60);

  pc.addEventListener("contextmenu",e=>{
    e.preventDefault();
    const pos=pvPos(e);
    deleteAtPos(pos);
  });

  pc.addEventListener("pointerdown",e=>{
    pc.setPointerCapture(e.pointerId);
    const pos=pvPos(e);
    const hasObs = S.selObstacle!=null;
    const hasSce = S.selScenery!=null;
    if(hasObs || hasSce){
      if(S.smoothPath.length<5){
        toast("⚠️ Prima disegna e applica un percorso nel tab Disegna!");
        return;
      }
      if(hasObs) placeOnPath(pos,"obstacle");
      else placeOnPath(pos,"scenery");
      return;
    }
    // Click sinistro senza selezione: prova a cancellare elemento sotto il cursore
    if(e.button===0 && deleteAtPos(pos)) return;
    S.panning=true;
    S.panStart={mx:e.clientX,my:e.clientY,ox:S.ox,oy:S.oy};
  });
  pc.addEventListener("pointermove",e=>{
    if(!S.panning) return;
    S.ox=S.panStart.ox+(e.clientX-S.panStart.mx);
    S.oy=S.panStart.oy+(e.clientY-S.panStart.my);
  });
  pc.addEventListener("pointerup",()=>{ S.panning=false; });
  pc.addEventListener("wheel",e=>{
    e.preventDefault();
    if(S.previewMode==="3d"){
      S.cam3dZoom=Math.max(0.3,Math.min(4,S.cam3dZoom*(e.deltaY>0?0.88:1.14)));
    } else {
      S.zoom=Math.max(.1,Math.min(8,S.zoom*(e.deltaY>0?.88:1.14)));
    }
  },{passive:false});

  document.getElementById("gkZIn").onclick =()=>{
    if(S.previewMode==="3d") S.cam3dZoom=Math.min(4,S.cam3dZoom*1.25);
    else S.zoom=Math.min(8,S.zoom*1.25);
  };
  document.getElementById("gkZOut").onclick=()=>{
    if(S.previewMode==="3d") S.cam3dZoom=Math.max(0.3,S.cam3dZoom/1.25);
    else S.zoom=Math.max(.1,S.zoom/1.25);
  };

  // RESIZER — drag per ridimensionare disegno/anteprima
  (function(){
    const resizer=document.getElementById("gkResizer");
    const drawWrap=document.getElementById("gkDrawWrap");
    let dragging=false, startX=0, startW=0;
    resizer.addEventListener("pointerdown",e=>{
      dragging=true;
      startX=e.clientX;
      startW=drawWrap.getBoundingClientRect().width;
      resizer.classList.add("dragging");
      resizer.setPointerCapture(e.pointerId);
      document.body.style.cursor="col-resize";
      document.body.style.userSelect="none";
    });
    resizer.addEventListener("pointermove",e=>{
      if(!dragging) return;
      const row=document.getElementById("gkCanvasRow");
      const rowW=row.getBoundingClientRect().width;
      const newW=Math.max(120,Math.min(rowW-100,startW+(e.clientX-startX)));
      drawWrap.style.flex="0 0 "+newW+"px";
      resizeDraw(); resizePrev();
    });
    resizer.addEventListener("pointerup",()=>{
      dragging=false;
      resizer.classList.remove("dragging");
      document.body.style.cursor="";
      document.body.style.userSelect="";
    });
  })();

  document.getElementById("gkClearPlaced").onclick=()=>{
    S.obstacles=[]; S.scenery=[]; updateStats(); toast("Elementi rimossi");
  };

  document.addEventListener("keydown",e=>{
    if(!document.getElementById("gkCrafter").classList.contains("on")) return;
    if(e.key==="Escape"){ S.selObstacle=null; S.selScenery=null; document.querySelectorAll(".gkItem").forEach(x=>x.classList.remove("on")); if(typeof updatePlacingBanner==="function") updatePlacingBanner(); }
    if((e.ctrlKey||e.metaKey)&&e.key==="s"){ e.preventDefault(); saveCircuit(); }
  });

  // COLOR PICKERS
  function syncColorPreviews(){
    document.getElementById("gkCpAsfalto").style.background=S.colAsfalto;
    document.getElementById("gkCpErba").style.background=S.colErba;
    document.getElementById("gkCpErba2").style.background=S.colErba;
    document.getElementById("gkCpBordo").style.background=S.colBordo;
    document.getElementById("gkCpBordo2").style.background=S.colBordo;
  }
  document.getElementById("gkColAsfalto").oninput=e=>{S.colAsfalto=e.target.value;syncColorPreviews();};
  document.getElementById("gkColBordo").oninput=e=>{S.colBordo=e.target.value;syncColorPreviews();};
  document.getElementById("gkColErba").oninput=e=>{S.colErba=e.target.value;syncColorPreviews();};

  // COLOR PRESETS
  const PRESETS=[
    {label:"Default",   asfalto:"#c8c8c8",bordo:"#ffffff",erba:"#1a6010"},
    {label:"Notte",     asfalto:"#1a1a2e",bordo:"#e040fb",erba:"#0d1b0d"},
    {label:"Deserto",   asfalto:"#c8a060",bordo:"#e8c080",erba:"#a07828"},
    {label:"Neve",      asfalto:"#dde8f0",bordo:"#ffffff",erba:"#b8d8e8"},
    {label:"Città",     asfalto:"#232323",bordo:"#ffffff",erba:"#383838"},
    {label:"Fuoco",     asfalto:"#3a1a08",bordo:"#ff6600",erba:"#1a0500"},
  ];
  const presetsEl=document.getElementById("gkColorPresets");
  PRESETS.forEach(p=>{
    const btn=document.createElement("div");
    btn.className="gkMapBtn";
    btn.style.cssText="flex:none;width:auto;padding:5px 9px;font-size:.62em;";
    btn.innerHTML=`<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.asfalto};margin-right:4px;vertical-align:middle;"></span>${p.label}`;
    btn.onclick=()=>{
      S.colAsfalto=p.asfalto; S.colBordo=p.bordo; S.colErba=p.erba;
      document.getElementById("gkColAsfalto").value=p.asfalto;
      document.getElementById("gkColBordo").value=p.bordo;
      document.getElementById("gkColErba").value=p.erba;
      syncColorPreviews();
    };
    presetsEl.appendChild(btn);
  });
  syncColorPreviews();

  // SFONDO FOTO PERSONALIZZATA
  document.getElementById("gkBgImgInput").onchange=e=>{
    const file=e.target.files[0]; if(!file) return;
    const url=URL.createObjectURL(file);
    const img=new Image();
    img.onload=()=>{
      S.customBgImg=img;
      const lbl=document.getElementById("gkBgImgLbl");
      lbl.childNodes[0].textContent="🖼 "+file.name.slice(0,22)+(file.name.length>22?"…":"")+" ";
      lbl.style.borderColor="#ff7b00"; lbl.style.color="#ff9a44";
      toast("🖼 Sfondo caricato!");
    };
    img.src=url;
  };
  document.getElementById("gkBgImgClear").onclick=()=>{
    S.customBgImg=null;
    document.getElementById("gkBgImgInput").value="";
    const lbl=document.getElementById("gkBgImgLbl");
    lbl.childNodes[0].textContent="📷 Carica foto sfondo… ";
    lbl.style.borderColor=""; lbl.style.color="";
    toast("🗑 Sfondo rimosso");
  };

  // ROAD WIDTH SLIDER
  document.getElementById("gkRoadW").oninput = e => {
    S.roadW = parseInt(e.target.value);
    document.getElementById("gkRoadWVal").textContent = S.roadW;
  };

  // OPPONENTS TOGGLE
  document.getElementById("gkOppOn").onclick = () => {
    S.opponents = true;
    document.getElementById("gkOppOn").classList.add("on");
    document.getElementById("gkOppOff").classList.remove("on");
    toast("🏎 Avversari attivati");
  };
  document.getElementById("gkOppOff").onclick = () => {
    S.opponents = false;
    document.getElementById("gkOppOff").classList.add("on");
    document.getElementById("gkOppOn").classList.remove("on");
    toast("🚫 Avversari disattivati");
  };

  // 2D / 3D TOGGLE
  document.getElementById("gkPv2d").onclick=()=>{
    S.previewMode="2d";
    document.getElementById("gkPv2d").classList.add("on");
    document.getElementById("gkPv3d").classList.remove("on");
    document.getElementById("gk3dControls").style.display="none";
    document.getElementById("gk3dSlider").classList.remove("on");
    document.getElementById("gkPitchSlider").classList.remove("on");
    previewCanvas.style.cursor="grab";
  };
  document.getElementById("gkPv3d").onclick=()=>{
    S.previewMode="3d";
    // Pitch default isometrico obliquo (come nelle foto del circuito)
    if(!S._pitchSet){ S.cam3dPitch=1.1; S._pitchSet=true; }
    S.cam3dAutoRotate=true;
    document.getElementById("gk3dAuto").classList.add("on");
    document.getElementById("gkPv3d").classList.add("on");
    document.getElementById("gkPv2d").classList.remove("on");
    document.getElementById("gk3dControls").style.display="flex";
    document.getElementById("gkPitchSlider").classList.add("on");
    document.getElementById("gkPitchRange").value=Math.round(S.cam3dPitch*100);
    previewCanvas.style.cursor="ew-resize";
  };

  // PITCH SLIDER (angolo verticale della vista 360°)
  document.getElementById("gkPitchRange").oninput=e=>{
    S.cam3dPitch=parseInt(e.target.value)/100;
    S._pitchSet=true;
  };

  // 3D auto-rotate toggle
  document.getElementById("gk3dAuto").onclick=function(){
    S.cam3dAutoRotate=!S.cam3dAutoRotate;
    this.classList.toggle("on",S.cam3dAutoRotate);
  };
  S.cam3dAutoRotate=true; // start auto

  // 3D position slider
  document.getElementById("gk3dPosBtn").onclick=function(){
    const sl=document.getElementById("gk3dSlider");
    sl.classList.toggle("on");
  };

  // 3D move button: deseleziona elemento attivo e torna alla rotazione
  document.getElementById("gk3dMoveBtn").onclick=function(){
    S.selObstacle=null; S.selScenery=null;
    document.querySelectorAll(".gkItem").forEach(x=>x.classList.remove("on"));
    updatePlacingBanner();
    this.classList.add("on");
    setTimeout(()=>this.classList.remove("on"), 600);
    toast("✋ Modalità rotazione — trascina per ruotare");
  };
  document.getElementById("gk3dSlider").oninput=e=>{
    S.cam3dSegPos=parseInt(e.target.value)/100;
  };

  // 3D drag on preview for manual rotation
  previewCanvas.addEventListener("pointerdown",e=>{
    if(S.previewMode!=="3d") return;
    // Se c'è un elemento selezionato da piazzare, non avviare il drag
    if(S.selObstacle!=null || S.selScenery!=null) return;
    S.cam3dDragging=true;
    S.cam3dLast={x:e.clientX, y:e.clientY};
    S.cam3dAutoRotate=false;
    document.getElementById("gk3dAuto").classList.remove("on");
    e.stopPropagation();
  },{capture:true});
  previewCanvas.addEventListener("pointermove",e=>{
    // hover su elementi per mostrare cursore cancella
    if(!S.selObstacle && !S.selScenery && S.previewMode==="2d"){
      const pos=pvPos(e);
      const HIT=Math.max(18,22*S.zoom);
      let found=false;
      [...S.obstacles,...S.scenery].forEach(el=>{
        const sp=el.side!==undefined ? elementScreenPos(el.t,el.side) : elementScreenPos(el.t);
        if(sp && Math.hypot(pos.x-sp.x,pos.y-sp.y)<HIT) found=true;
      });
      previewCanvas.style.cursor=found?"crosshair":"grab";
      S.hoverDelPos=found?pos:null;
    }
    if(!S.cam3dDragging||S.previewMode!=="3d") return;
    S.cam3dAngle+=(e.clientX-S.cam3dLast.x)*0.01;
    S.cam3dPitch = Math.max(0.30, Math.min(1.55, S.cam3dPitch - (e.clientY-S.cam3dLast.y)*0.008));
    S.cam3dLast={x:e.clientX, y:e.clientY};
    // Sync pitch slider
    const ps=document.getElementById("gkPitchRange");
    if(ps) ps.value=Math.round(S.cam3dPitch*100);
  },{capture:true});
  previewCanvas.addEventListener("pointerup",()=>{ S.cam3dDragging=false; },{capture:true});

  // ── MODAL 3D EVENTS ──────────────────────────────────────────
  document.getElementById("gk3dMClose").onclick=close3DModal;

  document.getElementById("gk3dMAutoBtn").onclick=function(){
    S.cam3dAutoRotate=!S.cam3dAutoRotate;
    this.classList.toggle("on",S.cam3dAutoRotate);
    updateModalHint();
  };

  document.getElementById("gk3dMPovBtn").onclick=function(){
    S.modal3dPovMode=!S.modal3dPovMode;
    this.classList.toggle("on",S.modal3dPovMode);
    if(S.modal3dPovMode){
      S.cam3dAutoRotate=false;
      S.cam3dAngle=0;  // resetta l'offset di rotazione manuale → guarda dritto avanti
      document.getElementById("gk3dMAutoBtn").classList.remove("on");
    }
    updateModalHint();
  };

  document.getElementById("gk3dModalPos").oninput=e=>{
    S.cam3dSegPos=parseInt(e.target.value)/100;
  };

  modal3dCanvas.addEventListener("pointerdown",e=>{
    S.modal3dDragging=true;
    S.modal3dLast={x:e.clientX, y:e.clientY};
    S.cam3dAutoRotate=false;
    document.getElementById("gk3dMAutoBtn").classList.remove("on");
    modal3dCanvas.setPointerCapture(e.pointerId);
    updateModalHint();
  });
  modal3dCanvas.addEventListener("pointermove",e=>{
    if(!S.modal3dDragging) return;
    const dx=e.clientX-S.modal3dLast.x;
    const dy=e.clientY-S.modal3dLast.y;
    S.cam3dAngle += dx*0.008;
    S.cam3dPitch  = Math.max(0.30, Math.min(1.55, S.cam3dPitch - dy*0.006));
    S.modal3dLast={x:e.clientX, y:e.clientY};
  });
  modal3dCanvas.addEventListener("pointerup",()=>{ S.modal3dDragging=false; });

  // Pinch/wheel per zoom (modifica distanza camera)
  modal3dCanvas.addEventListener("wheel",e=>{
    e.preventDefault();
    S.cam3dZoom=Math.max(0.3,Math.min(3.0,S.cam3dZoom*(e.deltaY>0?0.9:1.11)));
  },{passive:false});

  // Resize modale
  window.addEventListener("resize",()=>{
    if(S.modal3dOpen){
      modal3dCanvas.width=window.innerWidth;
      modal3dCanvas.height=window.innerHeight-80;
    }
  });

  // Chiudi con ESC
  document.addEventListener("keydown",e2=>{
    if(e2.key==="Escape" && S.modal3dOpen){ close3DModal(); }
  });
} // end bindEvents

function buildSceGrid(){
  const sg=document.getElementById("gkSceGrid"); sg.innerHTML="";
  (SCENERY_DEF[S.sceneryTheme]||[]).forEach(d=>{
    const el=document.createElement("div");
    el.className="gkItem";
    el.innerHTML=`<img src="${d.src}"><div class="ilbl">${d.label}</div>`;
    el.onclick=()=>{
      sg.querySelectorAll(".gkItem").forEach(x=>x.classList.remove("on"));
      document.getElementById("gkObsGrid").querySelectorAll(".gkItem").forEach(x=>x.classList.remove("on"));
      el.classList.add("on");
      S.selScenery=d; S.selObstacle=null; S.tool="scenery";
      updatePlacingBanner();
      toast("🌲 "+d.label+" selezionato — ora clicca sull'anteprima a destra!");
    };
    sg.appendChild(el);
  });
}

function updatePlacingBanner(){
  const banner=document.getElementById("gkPlacingBanner");
  const floatBtn=document.getElementById("gkDeselectBtn");
  if(!banner) return;
  if(S.selObstacle){
    banner.style.display="flex";
    banner.innerHTML=`<span>🚧 <b>${S.selObstacle.label}</b> attivo — clicca sull'anteprima per piazzarlo</span><button onclick="window._gkCancelPlace()">✕ Fine</button>`;
    if(floatBtn) floatBtn.style.display="block";
  } else if(S.selScenery){
    const side=S.selSide==="L"?"◀ Sinistra":"Destra ▶";
    banner.style.display="flex";
    banner.innerHTML=`<span>🌲 <b>${S.selScenery.label}</b> (${side}) — clicca sull'anteprima</span><button onclick="window._gkCancelPlace()">✕ Fine</button>`;
    if(floatBtn) floatBtn.style.display="block";
  } else {
    banner.style.display="none";
    if(floatBtn) floatBtn.style.display="none";
  }
}
window._gkCancelPlace=()=>{
  S.selObstacle=null; S.selScenery=null;
  document.querySelectorAll(".gkItem").forEach(x=>x.classList.remove("on"));
  updatePlacingBanner();
  toast("✋ Modalità spostamento attiva");
};

function dcPos(e){
  const r=drawCanvas.getBoundingClientRect();
  return {x:e.clientX-r.left,y:e.clientY-r.top};
}
function pvPos(e){
  const r=previewCanvas.getBoundingClientRect();
  return {x:e.clientX-r.left,y:e.clientY-r.top};
}

function rebuildRawPath(){
  S.rawPath = S.drawSegments.flat();
}

function applySmooth(){
  if(S.rawPath.length<3){ toast("Disegna prima un percorso!"); return; }
  const src = S.rawPath;
  const n   = src.length;

  // ── Step 1: smooth leggero circolare (solo tremore mano, 3 passate finestra 3) ──
  // Finestra piccola = rimuove solo micro-oscillazioni pixel, non le curve intenzionali
  const HALF = 1, PASSES = 3;
  let smoothed = src.map(p => ({...p}));
  for (let pass = 0; pass < PASSES; pass++) {
    const tmp = smoothed.slice();
    for (let i = 0; i < n; i++) {
      let sx = 0, sy = 0;
      for (let d = -HALF; d <= HALF; d++) {
        const j = (i + d + n) % n;
        sx += tmp[j].x; sy += tmp[j].y;
      }
      const cnt = HALF * 2 + 1;
      smoothed[i] = { x: sx / cnt, y: sy / cnt };
    }
  }

  // ── Step 2: catmull-rom che rispetta gli angoli netti ──────────────────
  S.smoothPath = catmullRomSharp(smoothed, 32);
  updateStats();
}

// Catmull-Rom che rileva gli angoli netti e li preserva.
// Un angolo è "netto" se la variazione di direzione supera CORNER_THRESHOLD.
// Ai corner: usa tensione = 0 (spline passa esattamente per il punto)
// e duplica il punto così la curva non "tira" verso gli adiacenti.
function catmullRom(pts, steps){
  return catmullRomSharp(pts, steps);
}

function catmullRomSharp(pts, steps){
  if(pts.length<2) return pts;
  const out=[];
  const n=pts.length;

  // Soglia angolo netto: oltre 35° = corner da preservare
  const CORNER_THRESHOLD = 35 * Math.PI / 180;

  // Calcola l'angolo di svolta in ogni punto
  function turnAngle(i){
    const p0 = pts[(i-1+n)%n];
    const p1 = pts[i];
    const p2 = pts[(i+1)%n];
    const a1 = Math.atan2(p1.y-p0.y, p1.x-p0.x);
    const a2 = Math.atan2(p2.y-p1.y, p2.x-p1.x);
    let da = a2 - a1;
    while(da >  Math.PI) da -= 2*Math.PI;
    while(da < -Math.PI) da += 2*Math.PI;
    return Math.abs(da);
  }

  const isCorner = new Array(n).fill(false);
  for(let i=0; i<n; i++){
    if(turnAngle(i) > CORNER_THRESHOLD) isCorner[i] = true;
  }

  for(let i=0; i<n; i++){
    const p1 = pts[i];
    const p2 = pts[(i+1)%n];

    // Se il punto corrente O il prossimo è un corner, usa interpolazione lineare
    // (mantiene l'angolo netto senza arrotondarlo)
    if(isCorner[i] || isCorner[(i+1)%n]){
      for(let s=0; s<steps; s++){
        const tt = s/steps;
        out.push({ x: p1.x + (p2.x-p1.x)*tt, y: p1.y + (p2.y-p1.y)*tt });
      }
      continue;
    }

    // Tratto normale: catmull-rom standard
    const p0 = pts[(i-1+n)%n];
    const p3 = pts[(i+2)%n];
    for(let s=0; s<steps; s++){
      const tt=s/steps, t2=tt*tt, t3=t2*tt;
      out.push({
        x:.5*((2*p1.x)+(-p0.x+p2.x)*tt+(2*p0.x-5*p1.x+4*p2.x-p3.x)*t2+(-p0.x+3*p1.x-3*p2.x+p3.x)*t3),
        y:.5*((2*p1.y)+(-p0.y+p2.y)*tt+(2*p0.y-5*p1.y+4*p2.y-p3.y)*t2+(-p0.y+3*p1.y-3*p2.y+p3.y)*t3),
      });
    }
  }
  return out;
}

// Coordinate centrate per l'anteprima
function scaledPath(W,H){
  if(!S.smoothPath.length) return [];
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  S.smoothPath.forEach(p=>{
    if(p.x<minX)minX=p.x; if(p.x>maxX)maxX=p.x;
    if(p.y<minY)minY=p.y; if(p.y>maxY)maxY=p.y;
  });
  const cx=(minX+maxX)/2,cy=(minY+maxY)/2;
  const sc=Math.min((W*.82)/Math.max(1,maxX-minX),(H*.82)/Math.max(1,maxY-minY));
  return S.smoothPath.map(p=>({x:(p.x-cx)*sc,y:(p.y-cy)*sc}));
}

// Ritorna la posizione schermo di un elemento posizionato (ostacolo o scenografia)
function elementScreenPos(t, side){
  const W=previewCanvas.width,H=previewCanvas.height;
  const ox=W/2+S.ox,oy=H/2+S.oy,z=S.zoom;
  const pts=scaledPath(W,H);
  if(!pts.length) return null;
  const idx=Math.floor(t*pts.length)%pts.length;
  const p=pts[idx];
  const sx=ox+p.x*z, sy=oy+p.y*z;
  if(side===undefined) return {x:sx,y:sy}; // ostacolo: sulla strada
  // scenografia: fuori dalla strada
  const pn=pts[(idx+1)%pts.length];
  const rw=Math.max(6,22*z);
  const ang=Math.atan2((oy+pn.y*z)-sy,(ox+pn.x*z)-sx);
  const off=rw*(side==="L"?-1:1);
  return {x:sx+Math.cos(ang+Math.PI/2)*off, y:sy+Math.sin(ang+Math.PI/2)*off};
}

// Tenta di cancellare l'elemento più vicino al click — ritorna true se trovato
function deleteAtPos(pos){
  const HIT=Math.max(18,22*S.zoom); // raggio hit in px
  let bestDist=HIT, bestType=null, bestIdx=-1;

  S.obstacles.forEach((ob,i)=>{
    const sp=elementScreenPos(ob.t);
    if(!sp) return;
    const d=Math.hypot(pos.x-sp.x,pos.y-sp.y);
    if(d<bestDist){bestDist=d;bestType="obstacle";bestIdx=i;}
  });

  S.scenery.forEach((sc,i)=>{
    const sp=elementScreenPos(sc.t,sc.side);
    if(!sp) return;
    const d=Math.hypot(pos.x-sp.x,pos.y-sp.y);
    if(d<bestDist){bestDist=d;bestType="scenery";bestIdx=i;}
  });

  if(bestType==="obstacle"){
    const name=OBSTACLES_DEF.find(d=>d.id===S.obstacles[bestIdx].defId)?.label||"Ostacolo";
    S.obstacles.splice(bestIdx,1);
    updateStats(); toast("🗑 "+name+" rimosso");
    return true;
  }
  if(bestType==="scenery"){
    const defs=SCENERY_DEF[S.scenery[bestIdx].theme]||[];
    const name=defs.find(d=>d.id===S.scenery[bestIdx].defId)?.label||"Elemento";
    S.scenery.splice(bestIdx,1);
    updateStats(); toast("🗑 "+name+" rimosso");
    return true;
  }
  return false;
}

function placeOnPath(click,type){
  const W=previewCanvas.width,H=previewCanvas.height;

  // ── Modalità 3D: proietta i punti con la stessa camera ──
  if(S.previewMode==="3d"){
    const rawPts=S.smoothPath, N3=rawPts.length;
    let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
    rawPts.forEach(p=>{if(p.x<minX)minX=p.x;if(p.x>maxX)maxX=p.x;if(p.y<minY)minY=p.y;if(p.y>maxY)maxY=p.y;});
    const cx=(minX+maxX)/2,cy=(minY+maxY)/2;
    const trackSize=Math.max(maxX-minX,maxY-minY)||1;
    const zoom=S.cam3dZoom||1;
    const pitch=Math.max(0.4,Math.min(1.4,S.cam3dPitch!=null?S.cam3dPitch:1.1));
    const camAngle=S.cam3dAngle;
    const dist=trackSize*1.5/zoom;
    const ex=cx+dist*Math.cos(pitch)*Math.cos(camAngle);
    const ey=dist*Math.sin(pitch);
    const ez=cy+dist*Math.cos(pitch)*Math.sin(camAngle);
    const flx=cx-ex,fly=-ey,flz=cy-ez;
    const fl=Math.hypot(flx,fly,flz)||1;
    const fx=flx/fl,fy=fly/fl,fz=flz/fl;
    const nearZenith=pitch>1.2;
    const wux=nearZenith?Math.cos(camAngle):0,wuy=nearZenith?0:1,wuz=nearZenith?-Math.sin(camAngle):0;
    let rx2=fy*wuz-fz*wuy,ry2=fz*wux-fx*wuz,rz2=fx*wuy-fy*wux;
    const rl=Math.hypot(rx2,ry2,rz2)||1;
    rx2/=rl;ry2/=rl;rz2/=rl;
    const ux2=ry2*fz-rz2*fy,uy2=rz2*fx-rx2*fz,uz2=rx2*fy-ry2*fx;
    const fovPx=Math.min(W,H)*1.2;
    let best=-1,bd=80;
    rawPts.forEach((p,i)=>{
      const dx=p.x-ex,dy=0-ey,dz=p.y-ez;
      const depth=dx*fx+dy*fy+dz*fz;
      if(depth<=0.01) return;
      const scale=fovPx/depth;
      const sx=W/2+(dx*rx2+dy*ry2+dz*rz2)*scale;
      const sy=H/2-(dx*ux2+dy*uy2+dz*uz2)*scale;
      const d=Math.hypot(click.x-sx,click.y-sy);
      if(d<bd){bd=d;best=i;}
    });
    if(best<0){toast("Clicca più vicino al percorso!"); return;}
    const t=best/N3;
    if(type==="obstacle"){
      S.obstacles.push({defId:S.selObstacle.id,t});
      toast("✅ "+S.selObstacle.label+" posizionato");
    } else {
      S.scenery.push({defId:S.selScenery.id,theme:S.sceneryTheme,t,side:S.selSide});
      toast("✅ "+S.selScenery.label+" "+(S.selSide==="L"?"◀ Sx":"Dx ▶"));
    }
    updateStats();
    return;
  }

  // ── Modalità 2D ──
  const ox=W/2+S.ox,oy=H/2+S.oy;
  const pts=scaledPath(W,H);
  let best=-1,bd=50;
  pts.forEach((p,i)=>{
    const sx=ox+p.x*S.zoom,sy=oy+p.y*S.zoom;
    const d=Math.hypot(click.x-sx,click.y-sy);
    if(d<bd){bd=d;best=i;}
  });
  if(best<0){toast("Clicca più vicino al percorso!"); return;}
  const t=best/pts.length;
  if(type==="obstacle"){
    S.obstacles.push({defId:S.selObstacle.id,t});
    toast("✅ "+S.selObstacle.label+" posizionato");
  } else {
    S.scenery.push({defId:S.selScenery.id,theme:S.sceneryTheme,t,side:S.selSide});
    toast("✅ "+S.selScenery.label+" "+(S.selSide==="L"?"◀ Sx":"Dx ▶"));
  }
  updateStats();
}

// RENDER DRAW — sfondo scuro originale + rendering potenziato da draw.html
function renderDraw(){
  const ctx=drawCtx, W=drawCanvas.width, H=drawCanvas.height;
  ctx.clearRect(0,0,W,H);

  // Sfondo scuro originale
  ctx.fillStyle="#0c0c0c"; ctx.fillRect(0,0,W,H);
  // Griglia originale
  ctx.strokeStyle="#161616"; ctx.lineWidth=1;
  for(let x=0;x<W;x+=32){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
  for(let y=0;y<H;y+=32){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}

  const pts=S.rawPath;
  if(pts.length<2){
    if(pts.length===1) drawStartDotInDraw();
    else drawHintInDraw();
    return;
  }

  // Costruisci curva smooth per il canvas di disegno
  const toSmooth = S.isClosed ? [...pts, pts[0]] : pts;
  const smoothed  = catmullRomForDraw(toSmooth);

  // Ombra drop
  ctx.save();
  ctx.shadowColor='rgba(0,0,0,0.65)';
  ctx.shadowBlur=20; ctx.shadowOffsetX=5; ctx.shadowOffsetY=5;
  strokeDrawPath(smoothed,'#000',DRAW_TRACK_WIDTH+16);
  ctx.restore();

  // Bordo / rumble strip
  strokeDrawPath(smoothed, S.colBordo, DRAW_TRACK_WIDTH+7);

  // Asfalto
  strokeDrawPath(smoothed, S.colAsfalto, DRAW_TRACK_WIDTH);

  // Tratteggio centrale
  ctx.save();
  ctx.strokeStyle='rgba(255,255,255,0.2)';
  ctx.lineWidth=2; ctx.lineCap='round';
  ctx.setLineDash([16,12]);
  drawPolylineInDraw(smoothed);
  ctx.setLineDash([]);
  ctx.restore();

  // Anello verde zona chiusura
  if(!S.isClosed && pts.length >= DRAW_MIN_POINTS){
    const p=pts[0];
    ctx.save();
    ctx.strokeStyle='rgba(0,255,128,0.4)';
    ctx.lineWidth=2; ctx.setLineDash([5,5]);
    ctx.beginPath(); ctx.arc(p.x,p.y,DRAW_CLOSE_RADIUS,0,Math.PI*2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  // Linea del traguardo se circuito chiuso
  if(S.isClosed) drawFinishLineInDraw();

  // Start dot (sempre sopra)
  drawStartDotInDraw();

  // ── Overlay modalità cancellazione ─────────────────────────────────────
  if(S.deleteMode){
    const t=Date.now()/400;
    const alpha=0.35+0.25*Math.sin(t);
    ctx.save();
    ctx.strokeStyle=`rgba(255,34,68,${alpha})`;
    ctx.lineWidth=3;
    ctx.setLineDash([8,6]);
    ctx.strokeRect(3,3,W-6,H-6);
    ctx.setLineDash([]);
    ctx.restore();
  }
}

function strokeDrawPath(pts, color, width){
  const ctx=drawCtx;
  ctx.strokeStyle=color; ctx.lineWidth=width;
  ctx.lineCap='round'; ctx.lineJoin='round';
  drawPolylineInDraw(pts);
}

function drawPolylineInDraw(pts){
  const ctx=drawCtx;
  if(pts.length<2) return;
  ctx.beginPath();
  ctx.moveTo(pts[0].x,pts[0].y);
  for(let i=1;i<pts.length;i++) ctx.lineTo(pts[i].x,pts[i].y);
  ctx.stroke();
}

function drawHintInDraw(){
  const ctx=drawCtx, W=drawCanvas.width, H=drawCanvas.height;
  ctx.fillStyle='rgba(255,255,255,0.12)';
  ctx.font='bold 15px Arial';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('Tieni premuto e disegna il circuito',W/2,H/2);
}

function drawStartDotInDraw(){
  if(!S.rawPath.length) return;
  const ctx=drawCtx, p=S.rawPath[0];
  ctx.save();
  ctx.shadowColor='#00ff80'; ctx.shadowBlur=22;
  ctx.strokeStyle='#00ff80'; ctx.lineWidth=2.5;
  ctx.beginPath(); ctx.arc(p.x,p.y,14,0,Math.PI*2); ctx.stroke();
  ctx.restore();
  ctx.fillStyle='#00ff80';
  ctx.beginPath(); ctx.arc(p.x,p.y,9,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#000';
  ctx.font='bold 9px Arial'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('S',p.x,p.y);
}

function drawFinishLineInDraw(){
  const ctx=drawCtx, pts=S.rawPath;
  if(pts.length<2) return;
  const p0=pts[0], p1=pts[1];
  const dx=p1.x-p0.x, dy=p1.y-p0.y;
  const len=Math.sqrt(dx*dx+dy*dy)||1;
  const nx=-dy/len, ny=dx/len;
  const hw=DRAW_TRACK_WIDTH/2+5, sq=9;
  const count=Math.ceil(hw*2/sq);
  for(let i=0;i<count;i++){
    const t=-hw+i*sq;
    const x=p0.x+nx*t, y=p0.y+ny*t;
    const fx=dx/len*sq, fy=dy/len*sq;
    ctx.fillStyle=i%2===0?'#fff':'#111';
    ctx.fillRect(x,y,sq,sq);
    ctx.fillStyle=i%2===0?'#111':'#fff';
    ctx.fillRect(x+fx,y+fy,sq,sq);
  }
  ctx.save();
  ctx.fillStyle='#fff'; ctx.font='bold 11px Arial';
  ctx.textAlign='center'; ctx.textBaseline='bottom';
  ctx.shadowColor='#000'; ctx.shadowBlur=5;
  ctx.fillText('START / FINISH',p0.x,p0.y-20);
  ctx.restore();
}

// Catmull-Rom NON chiuso per il canvas di disegno (clamp invece di wrap)
function catmullRomForDraw(pts){
  if(pts.length<2) return pts;
  const out=[], n=pts.length, steps=8;
  for(let i=0;i<n-1;i++){
    const p0=pts[Math.max(0,i-1)];
    const p1=pts[i];
    const p2=pts[i+1];
    const p3=pts[Math.min(n-1,i+2)];
    for(let s=0;s<steps;s++){
      const t=s/steps, t2=t*t, t3=t2*t;
      out.push({
        x:0.5*((2*p1.x)+(-p0.x+p2.x)*t+(2*p0.x-5*p1.x+4*p2.x-p3.x)*t2+(-p0.x+3*p1.x-3*p2.x+p3.x)*t3),
        y:0.5*((2*p1.y)+(-p0.y+p2.y)*t+(2*p0.y-5*p1.y+4*p2.y-p3.y)*t2+(-p0.y+3*p1.y-3*p2.y+p3.y)*t3),
      });
    }
  }
  out.push(pts[n-1]);
  return out;
}

// Chiudi il circuito automaticamente (da draw.html)
function closeDraw(){
  S.drawing=false;
  S.isClosed=true;
  S.smoothPath=[];
  applySmooth();
  updateDrawLabel();
  updateStats();
  // Mostra tooltip
  const tip=document.getElementById("gkCloseTooltip");
  if(tip){ tip.style.display='block'; setTimeout(()=>tip.style.display='none',1800); }
  toast("🏁 Circuito chiuso — pronto per giocare!");
}

// Undo (da draw.html)
function undoDraw(){
  if(S.isClosed){
    S.isClosed=false;
    S.smoothPath=[];
    updateDrawLabel(); updateStats();
    return;
  }
  if(S.drawSegments.length === 0) return;
  const lastSegment = S.drawSegments[S.drawSegments.length-1];
  if(lastSegment.length > 12){
    lastSegment.splice(Math.max(0,lastSegment.length-12));
  } else {
    S.drawSegments.pop();
  }
  rebuildRawPath();
  if(S.rawPath.length>3){ S.smoothPath=[]; applySmooth(); }
  else S.smoothPath=[];
  updateStats();
}

// Toggle modalità cancellazione tracciato
function toggleDeleteMode(){
  S.deleteMode=!S.deleteMode;
  const btn=document.getElementById("gkUndoBtn");
  if(btn){
    if(S.deleteMode){
      btn.textContent="✂️ Cancella ON";
      btn.style.background="linear-gradient(135deg,#ff2244,#ff6600)";
      btn.style.color="#fff";
      btn.style.border="none";
    } else {
      btn.textContent="↩ Annulla";
      btn.style.background="";
      btn.style.color="";
      btn.style.border="";
    }
  }
  drawCanvas.style.cursor=S.deleteMode?"crosshair":"crosshair";
  if(S.deleteMode){
    toast("✂️ Modalità cancellazione attiva — clicca sul tracciato per rimuovere punti");
  } else {
    toast("✏️ Modalità disegno attiva");
  }
  updateDrawLabel();
}

// Aggiorna la label del draw canvas in base allo stato
function updateDrawLabel(){
  const el=document.getElementById("gkDrawLabel");
  if(!el) return;
  if(S.deleteMode){
    el.style.color='#ff4466';
    el.textContent='✂️ Modalità cancellazione — clicca sul tracciato per rimuovere punti · clicca Annulla per uscire';
    return;
  }
  const n=S.rawPath.length;
  if(S.isClosed){
    el.style.color='#00ff80';
    el.textContent='✓ Circuito chiuso — premi ▶ GIOCA! o ✂️ Annulla per modificare';
  } else if(n>=DRAW_MIN_POINTS){
    el.style.color='#ffa500';
    el.textContent='🟠 Riporta il tracciato sul punto verde per chiudere';
  } else {
    el.style.color='#ff9a44';
    el.textContent=n===0?'🖱 Tieni premuto e trascina per disegnare il circuito':'Continua a disegnare…';
  }
}

// RENDER PREVIEW — dispatches to 2D or 3D
function renderPreview(){
  if(S.previewMode==="3d"){ render3D(); return; }
  render2D();
}

function render2D(){
  const ctx=previewCtx,W=previewCanvas.width,H=previewCanvas.height;
  if(!W||!H) return;
  ctx.clearRect(0,0,W,H);
  const bgC={montagna:["#0c1828","#1a3050"],citta:["#0c0508","#200a12"],deserto:["#080b04","#162210"]};
  const bc=bgC[S.mappa]||bgC.montagna;
  const gr=ctx.createLinearGradient(0,0,0,H);
  gr.addColorStop(0,bc[0]); gr.addColorStop(1,bc[1]);
  ctx.fillStyle=gr; ctx.fillRect(0,0,W,H);

  if(!S.smoothPath.length){
    ctx.fillStyle="rgba(255,123,0,.12)"; ctx.font="12px 'Segoe UI'"; ctx.textAlign="center";
    ctx.fillText("Disegna il percorso →",W/2,H/2);
    return;
  }

  const pts=scaledPath(W,H);
  const ox=W/2+S.ox,oy=H/2+S.oy,z=S.zoom;
  const sx=p=>ox+p.x*z, sy=p=>oy+p.y*z;
  const rw=Math.max(6,22*z);

  // Erba (colore custom)
  ctx.strokeStyle=S.colErba; ctx.lineWidth=rw*2.4;
  ctx.lineCap="round"; ctx.lineJoin="round";
  ctx.beginPath(); pts.forEach((p,i)=>i?ctx.lineTo(sx(p),sy(p)):ctx.moveTo(sx(p),sy(p)));
  ctx.closePath(); ctx.stroke();

  // Bordo/rumble strips alternati
  ctx.strokeStyle=S.colBordo; ctx.lineWidth=rw*1.15;
  ctx.setLineDash([rw*1.1,rw*1.1]);
  ctx.beginPath(); pts.forEach((p,i)=>i?ctx.lineTo(sx(p),sy(p)):ctx.moveTo(sx(p),sy(p)));
  ctx.closePath(); ctx.stroke(); ctx.setLineDash([]);

  // Asfalto (colore custom)
  ctx.strokeStyle=S.colAsfalto; ctx.lineWidth=rw;
  ctx.beginPath(); pts.forEach((p,i)=>i?ctx.lineTo(sx(p),sy(p)):ctx.moveTo(sx(p),sy(p)));
  ctx.closePath(); ctx.stroke();

  // Tratteggio centrale
  ctx.strokeStyle="rgba(255,255,255,.35)"; ctx.lineWidth=Math.max(1,1.5*z); ctx.setLineDash([6*z,8*z]);
  ctx.beginPath(); pts.forEach((p,i)=>i?ctx.lineTo(sx(p),sy(p)):ctx.moveTo(sx(p),sy(p)));
  ctx.closePath(); ctx.stroke(); ctx.setLineDash([]);

  // Frecce
  const step=Math.max(1,Math.floor(pts.length/7));
  for(let i=step;i<pts.length;i+=step){
    const p=pts[i],pn=pts[(i+1)%pts.length];
    const ang=Math.atan2(sy(pn)-sy(p),sx(pn)-sx(p));
    ctx.save(); ctx.translate(sx(p),sy(p)); ctx.rotate(ang);
    ctx.fillStyle="rgba(255,200,40,.75)"; ctx.font=`${Math.max(8,12*z)}px Arial`;
    ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText("▶",0,0); ctx.restore();
  }

  // START
  const p0=pts[0];
  for(let row=0;row<2;row++) for(let col=0;col<4;col++){
    ctx.fillStyle=(row+col)%2===0?"#000":"#fff";
    const cr=Math.max(3,7*z);
    ctx.fillRect(sx(p0)-cr*2+col*cr,sy(p0)-cr*1.2+row*cr,cr,cr);
  }

  // OSTACOLI
  S.obstacles.forEach(ob=>{
    const def=OBSTACLES_DEF.find(d=>d.id===ob.defId); if(!def) return;
    const idx=Math.floor(ob.t*pts.length)%pts.length;
    const p=pts[idx];
    const im=getImg(def.src);
    const sz=Math.max(10,20*z);
    if(im.complete&&im.naturalWidth>0) ctx.drawImage(im,sx(p)-sz/2,sy(p)-sz/2,sz,sz);
    else{ctx.fillStyle="#f80";ctx.fillRect(sx(p)-sz/2,sy(p)-sz/2,sz,sz);}
  });

  // SCENOGRAFIA
  S.scenery.forEach(sc=>{
    const defs=SCENERY_DEF[sc.theme]||[];
    const def=defs.find(d=>d.id===sc.defId); if(!def) return;
    const idx=Math.floor(sc.t*pts.length)%pts.length;
    const p=pts[idx],pn=pts[(idx+1)%pts.length];
    const ang=Math.atan2(sy(pn)-sy(p),sx(pn)-sx(p));
    const off=rw;
    const dirMult=sc.side==="L"?-1:1;
    const ex=sx(p)+Math.cos(ang+Math.PI/2)*off*dirMult;
    const ey=sy(p)+Math.sin(ang+Math.PI/2)*off*dirMult;
    const im=getImg(def.src);
    const sz=Math.max(10,22*z);
    if(im.complete&&im.naturalWidth>0) ctx.drawImage(im,ex-sz/2,ey-sz,sz,sz);
    else{ctx.fillStyle="#0a8";ctx.fillRect(ex-sz/2,ey-sz,sz,sz);}
  });

  // place mode border
  if((S.tool==="obstacle"&&S.selObstacle)||(S.tool==="scenery"&&S.selScenery)){
    const t=Date.now()/500;
    ctx.strokeStyle=`rgba(255,59,59,${.5+.4*Math.sin(t)})`; ctx.lineWidth=2; ctx.setLineDash([4,4]);
    ctx.strokeRect(2,2,W-4,H-4); ctx.setLineDash([]);
    ctx.fillStyle="rgba(255,80,80,.85)"; ctx.font="bold 10px 'Segoe UI'"; ctx.textAlign="center";
    ctx.fillText("🎯 Clicca sul percorso",W/2,14);
  }

  // hover delete highlight — cerchio rosso sull'elemento sotto il cursore
  if(!S.selObstacle && !S.selScenery && S.hoverDelPos){
    const HIT=Math.max(18,22*S.zoom);
    const hp=S.hoverDelPos;
    // trova l'elemento più vicino
    let bestSp=null, bestD=HIT;
    [...S.obstacles,...S.scenery].forEach(el=>{
      const sp=el.side!==undefined ? elementScreenPos(el.t,el.side) : elementScreenPos(el.t);
      if(!sp) return;
      const d=Math.hypot(hp.x-sp.x,hp.y-sp.y);
      if(d<bestD){bestD=d;bestSp=sp;}
    });
    if(bestSp){
      const r=Math.max(14,18*S.zoom);
      ctx.beginPath(); ctx.arc(bestSp.x,bestSp.y,r,0,Math.PI*2);
      ctx.strokeStyle="rgba(255,50,50,.9)"; ctx.lineWidth=2.5; ctx.stroke();
      ctx.fillStyle="rgba(255,0,0,.18)"; ctx.fill();
      ctx.fillStyle="#ff4444"; ctx.font=`bold ${Math.max(12,14*S.zoom)}px Arial`;
      ctx.textAlign="center"; ctx.textBaseline="middle";
      ctx.fillText("🗑",bestSp.x,bestSp.y);
    }
  }
}

// ──────────── 3D RENDERER ────────────────────────────────────
function render3D(){
  // Auto-rotate (solo quando il modale non è aperto — evita doppio avanzamento)
  if(S.cam3dAutoRotate && !S.modal3dOpen) S.cam3dAngle+=0.008;
  render3DCore(previewCtx, previewCanvas.width, previewCanvas.height, S.cam3dAngle, S.cam3dSegPos, false);
  // HUD hint
  const ctx=previewCtx, W=previewCanvas.width, H=previewCanvas.height;
  ctx.fillStyle="rgba(255,255,255,.35)"; ctx.font="10px 'Segoe UI'"; ctx.textAlign="center";
  // Modalità posizionamento: bordo pulsante + istruzione
  if((S.selObstacle!=null)||(S.selScenery!=null)){
    const t=Date.now()/500;
    ctx.strokeStyle=`rgba(255,59,59,${.5+.4*Math.sin(t)})`; ctx.lineWidth=2; ctx.setLineDash([4,4]);
    ctx.strokeRect(2,2,W-4,H-4); ctx.setLineDash([]);
    ctx.fillStyle="rgba(255,80,80,.9)"; ctx.font="bold 11px 'Segoe UI'"; ctx.textAlign="center";
    ctx.fillText("🎯 Clicca sul percorso per posizionare",W/2,18);
  } else {
    ctx.fillText(S.cam3dAutoRotate?"⟳ Rotazione automatica · Rotella=zoom":"⟵⟶ Trascina · Rotella=zoom · Barra destra=inclina",W/2,H-8);
  }
}

function render3DCore(ctx, W, H, camAngle, camSegPos, povMode){
  if(!W||!H) return;
  ctx.clearRect(0,0,W,H);

  const rawPts=S.smoothPath;
  if(!rawPts.length){
    ctx.fillStyle="#f0f0f0"; ctx.fillRect(0,0,W,H);
    ctx.fillStyle="rgba(0,0,0,.35)"; ctx.font="16px 'Segoe UI'"; ctx.textAlign="center";
    ctx.fillText("Disegna prima il percorso nel tab Disegna",W/2,H/2);
    return;
  }

  // Ricampiona a risoluzione alta per bordi lisci
  const pts = catmullRom(rawPts, 6);
  const N = pts.length;

  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  pts.forEach(p=>{ if(p.x<minX)minX=p.x;if(p.x>maxX)maxX=p.x;if(p.y<minY)minY=p.y;if(p.y>maxY)maxY=p.y; });
  const cx=(minX+maxX)/2, cy=(minY+maxY)/2;
  const trackSize=Math.max(maxX-minX,maxY-minY)||1;
  const zoom = S.cam3dZoom||1;

  // Pitch: 1.1 = isometrico dall'alto come nelle foto di riferimento
  const pitch = Math.max(0.4, Math.min(1.4, S.cam3dPitch!=null ? S.cam3dPitch : 1.1));

  const dist = trackSize * 1.5 / zoom;
  const ex = cx + dist * Math.cos(pitch) * Math.cos(camAngle);
  const ey =      dist * Math.sin(pitch);
  const ez = cy + dist * Math.cos(pitch) * Math.sin(camAngle);

  const flx=cx-ex, fly=-ey, flz=cy-ez;
  const fl=Math.hypot(flx,fly,flz)||1;
  const fx=flx/fl, fy=fly/fl, fz=flz/fl;

  const nearZenith = pitch > 1.2;
  const wux = nearZenith ? Math.cos(camAngle) : 0;
  const wuy = nearZenith ? 0 : 1;
  const wuz = nearZenith ? -Math.sin(camAngle) : 0;

  let rx2=fy*wuz-fz*wuy, ry2=fz*wux-fx*wuz, rz2=fx*wuy-fy*wux;
  const rl=Math.hypot(rx2,ry2,rz2)||1;
  rx2/=rl; ry2/=rl; rz2/=rl;
  const ux2=ry2*fz-rz2*fy, uy2=rz2*fx-rx2*fz, uz2=rx2*fy-ry2*fx;

  const fovPx = Math.min(W,H) * 1.2;

  function project(wx,wy,wz){
    const dx=wx-ex, dy=wy-ey, dz=wz-ez;
    const depth = dx*fx + dy*fy + dz*fz;
    if(depth <= 0.01) return null;
    const scale = fovPx / depth;
    return {
      sx: W/2 + (dx*rx2 + dy*ry2 + dz*rz2)*scale,
      sy: H/2 - (dx*ux2 + dy*uy2 + dz*uz2)*scale,
      depth, scale
    };
  }

  // ── Sfondo: foto custom o colore tema ──
  if(S.customBgImg && S.customBgImg.complete && S.customBgImg.naturalWidth>0){
    const iw=S.customBgImg.naturalWidth, ih=S.customBgImg.naturalHeight;
    // Scala per coprire l'altezza, poi ripeti orizzontalmente per il panorama
    const scaleH = H / ih;
    const dw = iw * scaleH;
    const dh = H;
    // Offset orizzontale basato sull'angolo camera (panorama 360°)
    const norm = ((camAngle % (Math.PI*2)) + Math.PI*2) % (Math.PI*2); // 0..2π
    const totalW = dw * 2; // raddoppiamo per seamless wrap
    const offsetX = -(norm / (Math.PI*2)) * dw;
    // Disegna due copie per il wrap seamless
    ctx.drawImage(S.customBgImg, offsetX, 0, dw, dh);
    ctx.drawImage(S.customBgImg, offsetX + dw, 0, dw, dh);
    // Se l'immagine non copre tutta la larghezza, riempi con il bordo
    if(dw < W) ctx.drawImage(S.customBgImg, offsetX + dw*2, 0, dw, dh);
  } else {
    // Usa l'immagine del tema come sfondo panoramico
    const themeSrc = BG_IMG[S.mappa]||BG_IMG.montagna;
    const themeImg = getImg(themeSrc);
    if(themeImg.complete && themeImg.naturalWidth>0){
      const iw=themeImg.naturalWidth, ih=themeImg.naturalHeight;
      const scaleH = H / ih;
      const dw = iw * scaleH;
      const dh = H;
      const norm = ((camAngle % (Math.PI*2)) + Math.PI*2) % (Math.PI*2);
      const offsetX = -(norm / (Math.PI*2)) * dw;
      ctx.drawImage(themeImg, offsetX, 0, dw, dh);
      ctx.drawImage(themeImg, offsetX + dw, 0, dw, dh);
      if(dw < W) ctx.drawImage(themeImg, offsetX + dw*2, 0, dw, dh);
    } else {
      // Fallback colore mentre l'immagine carica
      const skyC={montagna:["#b8d0f0","#e8f0ff"],citta:["#d0b0c0","#f0d8e0"],deserto:["#e8d090","#fff0c0"]};
      const sc2=skyC[S.mappa]||skyC.montagna;
      const skyGr2=ctx.createLinearGradient(0,0,0,H*0.55);
      skyGr2.addColorStop(0,sc2[0]); skyGr2.addColorStop(1,sc2[1]);
      ctx.fillStyle=skyGr2; ctx.fillRect(0,0,W,H);
      // Ricarica se non pronta
      themeImg.onload=()=>{};
    }
  }

  // ── Erba: riempie l'intera area sotto l'orizzonte proiettato ──
  // Troviamo la Y dell'orizzonte (punto a distanza infinita sul piano y=0)
  // e riempiamo da lì in giù con il colore erba
  const grassColor = S.colErba || "#4a9e28";
  // Proietta i 4 angoli del piano erba
  const PAD = trackSize * 2.5;
  const gc = [
    project(cx-PAD,0,cy-PAD), project(cx+PAD,0,cy-PAD),
    project(cx+PAD,0,cy+PAD), project(cx-PAD,0,cy+PAD),
  ];
  // Disegna il piano erba solo se tutti i punti sono visibili
  const gcValid = gc.every(Boolean);
  if(gcValid){
    ctx.beginPath();
    ctx.moveTo(gc[0].sx,gc[0].sy); ctx.lineTo(gc[1].sx,gc[1].sy);
    ctx.lineTo(gc[2].sx,gc[2].sy); ctx.lineTo(gc[3].sx,gc[3].sy);
    ctx.closePath();
    ctx.fillStyle=grassColor; ctx.fill();
  } else {
    // Fallback: riempi tutta la metà inferiore con erba
    ctx.fillStyle=grassColor; ctx.fillRect(0,H/3,W,H*2/3);
  }

  // ── Larghezze pista ──
  const ROAD_W = trackSize * 0.052;
  const KERB_W = trackSize * 0.058;  // kerb sottile: solo 6pt più largo dell'asfalto

  const COL_ASFALTO = S.colAsfalto || "#b0b0b0";
  const COL_KERB_A  = "#ff8800";
  const COL_KERB_B  = "#ffffff";
  const COL_LINE    = "rgba(255,255,255,0.9)";

  // ── Proietta tutti i punti ──
  const Lroad=[], Rroad=[], Lkerb=[], Rkerb=[], valid=[];
  for(let i=0;i<N;i++){
    const p=pts[i], pn=pts[(i+1)%N];
    const ang=Math.atan2(pn.y-p.y, pn.x-p.x);
    const nx=Math.cos(ang+Math.PI/2), ny=Math.sin(ang+Math.PI/2);
    const la=project(p.x+nx*ROAD_W, 0, p.y+ny*ROAD_W);
    const ra=project(p.x-nx*ROAD_W, 0, p.y-ny*ROAD_W);
    const lk=project(p.x+nx*KERB_W, 0, p.y+ny*KERB_W);
    const rk=project(p.x-nx*KERB_W, 0, p.y-ny*KERB_W);
    Lroad.push(la); Rroad.push(ra);
    Lkerb.push(lk); Rkerb.push(rk);
    valid.push(!!(la&&ra&&lk&&rk));
  }

  // ── Helper: traccia polyline su array di punti proiettati ──
  function polyline(arr, vld){
    let started=false;
    for(let i=0;i<N;i++){
      if(!vld[i]||!arr[i]) continue;
      if(!started){ ctx.moveTo(arr[i].sx,arr[i].sy); started=true; }
      else ctx.lineTo(arr[i].sx,arr[i].sy);
    }
    // Chiudi il loop
    for(let i=0;i<N;i++){
      if(!vld[i]||!arr[i]) continue;
      ctx.lineTo(arr[i].sx,arr[i].sy); break;
    }
  }

  // ── 1. Kerb arancione/bianco: due band continue alternando colore ogni 12 seg ──
  const KSEG=12;
  for(let s=0;s<N;s+=KSEG){
    const e=Math.min(s+KSEG,N);
    const col=Math.floor(s/KSEG)%2===0 ? COL_KERB_A : COL_KERB_B;
    // Lato sinistro
    ctx.beginPath();
    let ok=false;
    for(let i=s;i<e;i++){ if(!valid[i]||!Lkerb[i]) continue; if(!ok){ctx.moveTo(Lkerb[i].sx,Lkerb[i].sy);ok=true;}else ctx.lineTo(Lkerb[i].sx,Lkerb[i].sy); }
    for(let i=e-1;i>=s;i--){ if(!valid[i]||!Lroad[i]) continue; ctx.lineTo(Lroad[i].sx,Lroad[i].sy); }
    ctx.closePath(); ctx.fillStyle=col; ctx.fill();
    // Lato destro
    ctx.beginPath(); ok=false;
    for(let i=s;i<e;i++){ if(!valid[i]||!Rkerb[i]) continue; if(!ok){ctx.moveTo(Rkerb[i].sx,Rkerb[i].sy);ok=true;}else ctx.lineTo(Rkerb[i].sx,Rkerb[i].sy); }
    for(let i=e-1;i>=s;i--){ if(!valid[i]||!Rroad[i]) continue; ctx.lineTo(Rroad[i].sx,Rroad[i].sy); }
    ctx.closePath(); ctx.fillStyle=col; ctx.fill();
  }

  // ── 2. Asfalto (nastro unico continuo) ──
  ctx.beginPath();
  polyline(Lroad, valid);
  // Torna indietro sul lato destro
  let started2=false;
  for(let i=N-1;i>=0;i--){
    if(!valid[i]||!Rroad[i]) continue;
    if(!started2){ ctx.lineTo(Rroad[i].sx,Rroad[i].sy); started2=true; }
    else ctx.lineTo(Rroad[i].sx,Rroad[i].sy);
  }
  ctx.closePath(); ctx.fillStyle=COL_ASFALTO; ctx.fill();

  // ── 3. Linee bianche bordo asfalto ──
  ctx.beginPath(); polyline(Lroad, valid);
  ctx.strokeStyle=COL_LINE; ctx.lineWidth=1.5; ctx.stroke();
  ctx.beginPath(); polyline(Rroad, valid);
  ctx.strokeStyle=COL_LINE; ctx.lineWidth=1.5; ctx.stroke();

  // ── 4. Tratteggio centrale ──
  for(let i=0;i<N;i+=40){
    const end=Math.min(i+20,N);
    ctx.beginPath(); let ok=false;
    for(let j=i;j<end;j++){
      if(!valid[j]||!Lroad[j]||!Rroad[j]) continue;
      const mx=(Lroad[j].sx+Rroad[j].sx)/2, my=(Lroad[j].sy+Rroad[j].sy)/2;
      if(!ok){ctx.moveTo(mx,my);ok=true;}else ctx.lineTo(mx,my);
    }
    ctx.strokeStyle="rgba(255,255,255,0.8)"; ctx.lineWidth=1.2; ctx.stroke();
  }

  // ── 5. Start/finish ──
  if(valid[0]&&Lroad[0]&&Rroad[0]){
    const A=Lroad[0], B=Rroad[0];
    for(let c=0;c<8;c++){
      const t0=c/8, t1=(c+1)/8;
      const x0=A.sx+(B.sx-A.sx)*t0, y0=A.sy+(B.sy-A.sy)*t0;
      const x1=A.sx+(B.sx-A.sx)*t1, y1=A.sy+(B.sy-A.sy)*t1;
      ctx.fillStyle=c%2===0?"#fff":"#111";
      ctx.fillRect(Math.min(x0,x1)-1,Math.min(y0,y1)-3,Math.max(2,Math.abs(x1-x0)+2),6);
    }
  }

  // ── 6. Ostacoli e scenografia in 3D ──
  // Usa rawPts (smoothPath originale) per mappare t → posizione mondo
  const RN = rawPts.length;
  const spriteItems = [];

  S.obstacles.forEach(ob => {
    const def = OBSTACLES_DEF.find(d => d.id === ob.defId); if (!def) return;
    const idx = Math.floor(ob.t * RN) % RN;
    const p = rawPts[idx];
    const proj = project(p.x, 0, p.y);
    if (!proj) return;
    spriteItems.push({ proj, def, type: 'obstacle' });
  });

  S.scenery.forEach(sc => {
    const defs = SCENERY_DEF[sc.theme] || [];
    const def = defs.find(d => d.id === sc.defId); if (!def) return;
    const idx = Math.floor(sc.t * RN) % RN;
    const p = rawPts[idx];
    const pn = rawPts[(idx + 1) % RN];
    // Offset laterale oltre il bordo pista
    const ang = Math.atan2(pn.y - p.y, pn.x - p.x);
    const side = sc.side === 'L' ? 1 : -1;
    const offDist = ROAD_W * 1.4 * side;
    const wx = p.x + Math.cos(ang + Math.PI/2) * offDist;
    const wz = p.y + Math.sin(ang + Math.PI/2) * offDist;
    const proj = project(wx, 0, wz);
    if (!proj) return;
    spriteItems.push({ proj, def, type: 'scenery' });
  });

  // Ordina per profondità decrescente (painter's algorithm: lontani prima)
  spriteItems.sort((a, b) => b.proj.depth - a.proj.depth);

  spriteItems.forEach(item => {
    const { proj, def } = item;
    // Prova prima def.src, poi def.gameSrc come fallback
    let im = getImg(def.src);
    if ((!im.complete || !im.naturalWidth) && def.gameSrc) im = getImg(def.gameSrc);

    const worldH = item.type === 'obstacle' ? ROAD_W * 1.2 : ROAD_W * 2.8;
    const screenH = worldH * proj.scale;
    if (screenH < 2) return;

    if (im.complete && im.naturalWidth) {
      const aspect = im.naturalWidth / im.naturalHeight;
      const screenW = screenH * aspect;
      ctx.drawImage(im, proj.sx - screenW / 2, proj.sy - screenH, screenW, screenH);
    } else {
      // Fallback: rettangolo colorato con etichetta (utile per debug e prime visualizzazioni)
      const sw = screenH * 0.8;
      ctx.fillStyle = item.type === 'obstacle' ? 'rgba(255,100,0,0.85)' : 'rgba(0,180,80,0.85)';
      ctx.fillRect(proj.sx - sw/2, proj.sy - screenH, sw, screenH);
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.max(8, screenH * 0.25)}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(item.type === 'obstacle' ? '🚧' : '🌲', proj.sx, proj.sy - screenH/2);
    }
  });
}

// ──── MODAL 3D ────────────────────────────────────────────────
function open3DModal(){
  if(!S.smoothPath.length){ toast("⚠️ Disegna prima un percorso!"); return; }
  S.modal3dOpen=true;
  S.cam3dAutoRotate=true;
  S.modal3dPovMode=false;
  const modal=document.getElementById("gk3dModal");
  modal.classList.add("on");
  // Size canvas to full window
  modal3dCanvas.width=window.innerWidth;
  modal3dCanvas.height=window.innerHeight-80; // minus top+bottom bars
  document.getElementById("gk3dMAutoBtn").classList.add("on");
  document.getElementById("gk3dMPovBtn").classList.remove("on");
  updateModalHint();
}
function close3DModal(){
  S.modal3dOpen=false;
  document.getElementById("gk3dModal").classList.remove("on");
}
function updateModalHint(){
  const el=document.getElementById("gk3dModalHint");
  if(!el) return;
  if(S.modal3dPovMode) el.textContent="👁 Vista in pista — trascina ⟵⟶ per ruotare";
  else el.textContent=S.cam3dAutoRotate?"⟳ Rotazione automatica":"⟵⟶ Ruota  ↑↓ Inclina  🖱 Rotella = zoom";
}
function renderModal3D(){
  if(!S.modal3dOpen) return;
  const W=modal3dCanvas.width, H=modal3dCanvas.height;
  if(!W||!H) return;
  // Auto-rotate: update shared angle
  if(S.cam3dAutoRotate) S.cam3dAngle+=0.006;
  if(S.modal3dPovMode){
    renderPov3D(modal3dCtx, W, H);
  } else {
    render3DCore(modal3dCtx, W, H, S.cam3dAngle, S.cam3dSegPos, false);
    // Modal HUD
    modal3dCtx.fillStyle="rgba(255,123,0,.5)"; modal3dCtx.font="13px 'Segoe UI'";
    modal3dCtx.textAlign="center";
    modal3dCtx.fillText(S.cam3dAutoRotate?"⟳ Rotazione automatica":"⟵ Trascina per ruotare · Rotella per zoom",W/2,H-10);
  }
}

// POV (in-pista): camera sul percorso che guarda avanti
function renderPov3D(ctx, W, H){
  const pts=S.smoothPath;
  if(!pts.length){ ctx.fillStyle="#000"; ctx.fillRect(0,0,W,H); return; }
  const N=pts.length;

  // Avanza la posizione lungo il percorso
  S.cam3dSegPos=(S.cam3dSegPos+0.0012)%1;
  const idx=Math.floor(S.cam3dSegPos*N)%N;
  const nxt=(idx+1)%N;
  const frac=(S.cam3dSegPos*N)-Math.floor(S.cam3dSegPos*N);
  const camX=pts[idx].x+(pts[nxt].x-pts[idx].x)*frac;
  const camZ=pts[idx].y+(pts[nxt].y-pts[idx].y)*frac;

  // Direzione avanti nel percorso + offset manuale di rotazione
  const ahead=Math.floor(S.cam3dSegPos*N+8)%N;
  const baseAngle=Math.atan2(pts[ahead].y-camZ, pts[ahead].x-camX);
  const lookAngle=baseAngle + S.cam3dAngle*0.4;

  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  pts.forEach(p=>{ if(p.x<minX)minX=p.x;if(p.x>maxX)maxX=p.x;if(p.y<minY)minY=p.y;if(p.y>maxY)maxY=p.y; });
  const trackSize=Math.max(maxX-minX,maxY-minY)||1;
  const ROAD_W=trackSize*0.05;

  const camY=8;  // altezza occhi (piccola rispetto al tracciato)
  const fov=W*1.1;
  const horizonY=H*0.45;

  const cosL=Math.cos(-lookAngle), sinL=Math.sin(-lookAngle);

  function projectPov(wx, wy, wz){
    const dx=wx-camX, dy=wy-camY, dz=wz-camZ;
    const rx= dx*cosL - dz*sinL;
    const rz= dx*sinL + dz*cosL;
    if(rz<=1) return null;
    const scale=fov/rz;
    return {sx:W/2+rx*scale, sy:horizonY+(camY-wy)*scale, depth:rz, scale};
  }

  // Sky — custom image o gradiente tema
  if(S.customBgImg && S.customBgImg.complete && S.customBgImg.naturalWidth>0){
    const iw=S.customBgImg.naturalWidth, ih=S.customBgImg.naturalHeight;
    // Mostra solo la metà superiore dell'immagine come cielo
    const scale=Math.max(W/iw, (horizonY*2)/ih);
    const dw=iw*scale, dh=ih*scale;
    ctx.save();
    ctx.beginPath(); ctx.rect(0,0,W,horizonY+2); ctx.clip();
    ctx.drawImage(S.customBgImg,(W-dw)/2,(H/2-dh)/2,dw,dh);
    ctx.restore();
  } else {
    const skyColors={montagna:["#0a1020","#1a3060"],citta:["#080010","#1a0520"],deserto:["#080a04","#1a2810"]};
    const sc=skyColors[S.mappa]||skyColors.montagna;
    const skyGr=ctx.createLinearGradient(0,0,0,horizonY);
    skyGr.addColorStop(0,sc[0]); skyGr.addColorStop(1,sc[1]);
    ctx.fillStyle=skyGr; ctx.fillRect(0,0,W,horizonY+2);
  }
  const gndGr=ctx.createLinearGradient(0,horizonY,0,H);
  gndGr.addColorStop(0,S.colErba); gndGr.addColorStop(1,darken(S.colErba,0.4));
  ctx.fillStyle=gndGr; ctx.fillRect(0,horizonY,W,H-horizonY);

  const roadSegs=[];
  for(let i=0;i<N;i++){
    const p=pts[i], pn=pts[(i+1)%N];
    const ang=Math.atan2(pn.y-p.y,pn.x-p.x);
    const px_=Math.cos(ang+Math.PI/2)*ROAD_W;
    const py_=Math.sin(ang+Math.PI/2)*ROAD_W;
    const A=projectPov(p.x+px_,0,p.y+py_);
    const B=projectPov(p.x-px_,0,p.y-py_);
    const C=projectPov(pn.x-px_,0,pn.y-py_);
    const D=projectPov(pn.x+px_,0,pn.y+py_);
    if(A&&B&&C&&D){
      roadSegs.push({A,B,C,D,depth:(A.depth+B.depth)/2,i});
    }
  }
  roadSegs.sort((a,b)=>b.depth-a.depth);
  const maxD=trackSize*2;
  roadSegs.forEach(({A,B,C,D,depth,i})=>{
    const rumble=Math.floor(i/8)%2===0;
    const bd=Math.max(0.15,Math.min(1,1-depth/maxD));
    const BUMP=1.08;
    ctx.beginPath();
    ctx.moveTo(A.sx*BUMP+(W/2)*(1-BUMP),A.sy); ctx.lineTo(D.sx*BUMP+(W/2)*(1-BUMP),D.sy);
    ctx.lineTo(C.sx*BUMP+(W/2)*(1-BUMP),C.sy); ctx.lineTo(B.sx*BUMP+(W/2)*(1-BUMP),B.sy);
    ctx.closePath(); ctx.fillStyle=rumble?S.colBordo:S.colErba; ctx.fill();
    ctx.beginPath();
    ctx.moveTo(A.sx,A.sy); ctx.lineTo(D.sx,D.sy); ctx.lineTo(C.sx,C.sy); ctx.lineTo(B.sx,B.sy);
    ctx.closePath(); ctx.fillStyle=fog(S.colAsfalto,bd); ctx.fill();
    if(i%12<6){
      const mA=midpt(A,B), mD=midpt(D,C);
      ctx.beginPath(); ctx.moveTo(mA.sx,mA.sy); ctx.lineTo(mD.sx,mD.sy);
      ctx.strokeStyle=`rgba(255,255,255,${0.7*bd})`; ctx.lineWidth=Math.max(1,A.scale*3); ctx.stroke();
    }
  });
  ctx.fillStyle="rgba(255,123,0,.5)"; ctx.font="13px 'Segoe UI'"; ctx.textAlign="center";
  ctx.fillText("👁 Vista in pista — trascina ⟵⟶ per inclinare la visuale",W/2,H-10);
}

function midpt(a,b){ return {sx:(a.sx+b.sx)/2,sy:(a.sy+b.sy)/2}; }

// Convert hex to rgb with fog (blend toward dark at distance)
function fog(hex,brightness){
  const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
  const f=Math.max(0.1,brightness);
  return `rgb(${Math.round(r*f)},${Math.round(g*f)},${Math.round(b*f)})`;
}
function darken(hex,f){
  const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
  return `rgb(${Math.round(r*f)},${Math.round(g*f)},${Math.round(b*f)})`;
}

function renderLoop(){
  renderDraw();
  renderPreview();
  renderModal3D();
  requestAnimationFrame(renderLoop);
}

// ── Lunghezza percorso in pixel (smoothPath) ──────────────
function calcPathLenPx(path){
  let len=0;
  for(let i=1;i<path.length;i++){
    const dx=path[i].x-path[i-1].x;
    const dy=path[i].y-path[i-1].y;
    len+=Math.sqrt(dx*dx+dy*dy);
  }
  return len;
}
// ── Numero segmenti del circuito — identico a playCircuit ──
function calcCircuitLen(path){
  const SEG_PER_PX=1.5;
  return Math.max(400,Math.min(4000,Math.round(calcPathLenPx(path)*SEG_PER_PX)));
}

function updateStats(){
  document.getElementById("gkStatPts").textContent=S.smoothPath.length;
  document.getElementById("gkStatLen").textContent=calcCircuitLen(S.smoothPath);
  document.getElementById("gkStatObs").textContent=S.obstacles.length;
  document.getElementById("gkStatSce").textContent=S.scenery.length;
  document.getElementById("gkPlacedCount").textContent=S.obstacles.length+S.scenery.length;
}

// SAVE/LOAD
function loadSaved(){
  try{S.saved=JSON.parse(localStorage.getItem("gjk_v4")||"[]");}catch{S.saved=[];}
  refreshSavedList();
}
async function saveCircuit(silent){
  // Se non loggato, il salvataggio nel DB non è possibile — mostra il modal login
  const userId = window._utenteLoggato ? true : null; // usa sessione server-side
  if (!userId) {
    toast("⚠️ Devi essere loggato per salvare il circuito!");
    setTimeout(() => {
      if (typeof apriAuthModal === 'function') apriAuthModal('login.html');
    }, 600);
    return false;
  }

  // Blocca salvataggio se non c'è un percorso disegnato
  if(!S.smoothPath || S.smoothPath.length < 3){
    toast("⚠️ Disegna prima un percorso prima di salvare!");
    return false;
  }

  const inp=document.getElementById("gkNameIn");
  const name=inp.value.trim();
  if(!name){
    inp.classList.remove("required");
    void inp.offsetWidth;
    inp.classList.add("required");
    inp.focus();
    toast("⚠️ Inserisci un nome per il circuito!");
    setTimeout(()=>inp.classList.remove("required"),600);
    return false;
  }
  S.name=name;
  const data={name,mappa:S.mappa,rawPath:S.rawPath,smoothPath:S.smoothPath,obstacles:S.obstacles,scenery:S.scenery,colAsfalto:S.colAsfalto,colBordo:S.colBordo,colErba:S.colErba,roadW:S.roadW,opponents:S.opponents};
  const idx=S.saved.findIndex(c=>c.name===name);
  if(idx>=0) S.saved[idx]=data; else S.saved.push(data);
  try{localStorage.setItem("gjk_v4",JSON.stringify(S.saved));}catch{toast("❌ Errore salvataggio localStorage");return false;}
  refreshSavedList();

  // Salva nel DB (userId già verificato sopra)
  try {
    const params = new URLSearchParams();
    params.append('nome', name);
    // Usa lo stesso oggetto "data" (formato pulito) già costruito sopra per localStorage.
    // NON usare {…S} perché include HTMLImageElement (customBgImg → serializzato come {})
    // e altri campi non serializzabili che corrompono il JSON nel DB.
    params.append('mapData', JSON.stringify(data));
    if (window.customMapDbId) params.append('mapId', window.customMapDbId);
    const res = await fetch('/GiocoF/SalvaMappaPersonalizzata', {
      method:'POST', credentials:'include', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body:params.toString()
    });
    const dbData = await res.json();
    if (dbData.ok && (dbData.id || dbData.mapId)) {
      window.customMapDbId = dbData.id || dbData.mapId;
      await loadSavedMapsFromDatabase();
      if(!silent) toast('💾 "'+name+'" — salvato!', 3200);
    } else {
      if(!silent) toast('⚠️ Errore salvataggio nel DB', 3200);
    }
  } catch(e) {
    if(!silent) toast('⚠️ Errore di connessione', 3200);
  }
  return true;
}

function refreshSavedList(){
  const el=document.getElementById("gkSavedList");
  if(!S.saved.length){el.innerHTML='<div id="gkNoSaved">Nessun circuito salvato</div>';return;}
  el.innerHTML="";
  S.saved.forEach((c,i)=>{
    const item=document.createElement("div");
    item.className="gkSavedItem";
    item.innerHTML=`<div style="flex:1"><div class="sname">${c.name}</div><div class="smeta">${c.mappa||"montagna"} · ${(c.smoothPath||[]).length} pt</div></div><button class="sdel">🗑</button>`;
    item.onclick=e=>{
      if(e.target.classList.contains("sdel")) return;
      S.name=c.name; S.mappa=c.mappa||"montagna";
      S.rawPath=c.rawPath||[]; S.smoothPath=c.smoothPath||[];
      S.obstacles=c.obstacles||[]; S.scenery=c.scenery||[];
      if(c.colAsfalto){ S.colAsfalto=c.colAsfalto; document.getElementById("gkColAsfalto").value=c.colAsfalto; }
      if(c.colBordo)  { S.colBordo=c.colBordo;   document.getElementById("gkColBordo").value=c.colBordo; }
      if(c.colErba)   { S.colErba=c.colErba;     document.getElementById("gkColErba").value=c.colErba; }
      if(c.roadW!=null){
        S.roadW=c.roadW;
        const sl=document.getElementById("gkRoadW");
        if(sl){ sl.value=c.roadW; document.getElementById("gkRoadWVal").textContent=c.roadW; }
      }
      if(c.opponents!=null){
        S.opponents=c.opponents;
        document.getElementById("gkOppOn").classList.toggle("on",c.opponents);
        document.getElementById("gkOppOff").classList.toggle("on",!c.opponents);
      }
      document.getElementById("gkNameIn").value=c.name;
      document.querySelectorAll(".gkMapBtn[data-mappa]").forEach(b=>b.classList.toggle("on",b.dataset.mappa===S.mappa));
      updateStats(); toast('📂 "'+c.name+'" caricato');
    };
    item.querySelector(".sdel").onclick=e=>{
      e.stopPropagation(); S.saved.splice(i,1);
      try{localStorage.setItem("gjk_v4",JSON.stringify(S.saved));}catch{}
      refreshSavedList();
    };
    el.appendChild(item);
  });
}
function newCircuit(){
  S.rawPath=[]; S.smoothPath=[]; S.obstacles=[]; S.scenery=[];
  S.name="Nuovo Circuito"; document.getElementById("gkNameIn").value=S.name;
  updateStats(); toast("🗋 Nuovo circuito");
}

// PLAY
// ─── Rende le curve della giunzione loop C1-continue ─────────────────────────
function smoothCurveLoop(arr) {
  if (!arr || arr.length < 8) return arr;
  const n = arr.length;
  const out = arr.slice();

  // Pass 1: moving average leggero (finestra 5, 2 passate) sull'intero array
  for (let pass = 0; pass < 2; pass++) {
    const tmp = out.slice();
    for (let i = 0; i < n; i++) {
      const a = tmp[(i - 2 + n) % n];
      const b = tmp[(i - 1 + n) % n];
      const c = tmp[i];
      const d = tmp[(i + 1) % n];
      const e = tmp[(i + 2) % n];
      out[i] = (a + b * 2 + c * 2 + d * 2 + e) / 8;
    }
  }

  // Pass 2: crossfade coseno nella zona di giunzione (15% del circuito)
  const W = Math.max(60, Math.min(200, Math.floor(n * 0.15)));
  for (let i = 0; i < W; i++) {
    const alpha = 0.5 - 0.5 * Math.cos(Math.PI * (i / W));
    const valStart = out[i];
    const valEnd   = out[n - W + i];
    const seam     = (valStart + valEnd) * 0.5;
    out[i]         = seam * (1 - alpha) + valStart * alpha;
    out[n - W + i] = seam * (1 - alpha) + valEnd   * alpha;
  }

  return out;
}

async function playCircuit(){
  if(S.smoothPath.length<10){ toast("⚠️ Disegna prima un percorso!"); return; }
  // Usa il nome corrente senza obbligare il salvataggio
  S.name = (document.getElementById("gkNameIn").value.trim()) || S.name || "Circuito";

  // Usa la stessa formula di updateStats per coerenza
  const CIRCUIT_LEN = calcCircuitLen(S.smoothPath);

  const curvePerSegment = pathToPerSegmentCurves(S.smoothPath, CIRCUIT_LEN);
  const smoothedCurves  = smoothCurveLoop(curvePerSegment);

  // Trova il segmento piu dritto (curvatura media minima su finestra 20)
  const WIN = 20;
  let bestSeg = 0, bestScore = Infinity;
  for (let i = 0; i < CIRCUIT_LEN; i++) {
    let score = 0;
    for (let w = 0; w < WIN; w++) score += Math.abs(smoothedCurves[(i + w) % CIRCUIT_LEN]);
    if (score < bestScore) { bestScore = score; bestSeg = i; }
  }

  // Usa foto custom se disponibile, altrimenti il tema
  const bgImmagine = (S.customBgImg && S.customBgImg.src)
    ? S.customBgImg.src
    : (BG_IMG[S.mappa]||"img2/montagna.png");

  const mappaCustom={
    nome:S.name,
    colore:BG_COLOR[S.mappa]||"#4A90E2",
    immagine:bgImmagine,
    coloreSfondo:BG_COLOR[S.mappa]||"#4A90E2",
    coloriStrada:{sand:S.colErba+"ff",rumble:S.colBordo+"ff",road:S.colAsfalto+"ff"},
    curve:[],
    curvePerSegment: smoothedCurves,
    length: CIRCUIT_LEN,
    altezza:0,
    roadW: S.roadW,
    startSegment: bestSeg,
  };

  if(typeof MAPPE!=="undefined") MAPPE.crafter=mappaCustom;
  else{ window.MAPPE=window.MAPPE||{}; window.MAPPE.crafter=mappaCustom; }

  patchObstacleSet(buildCrafterSprites(CIRCUIT_LEN));

  // Salva la mappa nel DB SOLO se l'utente è loggato
  window.isCustomMap = true;
  window.customMapDbId = null; // reset — verrà impostato solo se loggato e salvataggio ok
  const userId = window._utenteLoggato ? true : null; // usa sessione server-side
  if (userId) {
    try {
      const params = new URLSearchParams();
      params.append('nome', S.name);
      // Usa formato pulito (stesso di saveCircuit) — NON {…S} che include HTMLImageElement
      const cleanData = {name:S.name,mappa:S.mappa,rawPath:S.rawPath,smoothPath:S.smoothPath,obstacles:S.obstacles,scenery:S.scenery,colAsfalto:S.colAsfalto,colBordo:S.colBordo,colErba:S.colErba,roadW:S.roadW,opponents:S.opponents};
      params.append('mapData', JSON.stringify(cleanData));
      const res = await fetch('/GiocoF/SalvaMappaPersonalizzata', {
        method:'POST', credentials:'include', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body:params.toString()
      });
      const data = await res.json();
      if (data.ok && data.id) {
        window.customMapDbId = data.id;
        console.log('✅ Mappa salvata/aggiornata nel DB, ID:', data.id);
      }
    } catch(e) { console.warn('⚠️ Errore salvataggio mappa:', e); }
  }

  hide();
  setTimeout(()=>{
    if(typeof window.selezionaMappa==="function"){
      window.selezionaMappa("crafter");
    }
  },80);
}

// Converte il percorso in curve per-segmento fedeli al disegno
function pathToPerSegmentCurves(pts, numSegments) {
  const N = pts.length;
  if (N < 3) return new Array(numSegments).fill(0);

  // Calcola la variazione d'angolo (curvatura) in ogni punto del path
  const angleDelta = new Array(N);
  for (let i = 0; i < N; i++) {
    const p0 = pts[(i - 1 + N) % N];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % N];
    let a1 = Math.atan2(p1.y - p0.y, p1.x - p0.x);
    let a2 = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    let da = a2 - a1;
    // Normalizza a [-π, π]
    while (da >  Math.PI) da -= 2 * Math.PI;
    while (da < -Math.PI) da += 2 * Math.PI;
    angleDelta[i] = da;
  }

  // Scala calibrata: 90° su 10% del circuito (160 seg) → curve ≈ 0.9
  const SCALE = 92;

  const result = [];
  for (let i = 0; i < numSegments; i++) {
    // Posizione interpolata sul path
    const t    = (i / numSegments) * N;
    const idx  = Math.floor(t) % N;
    const frac = t - Math.floor(t);
    const next = (idx + 1) % N;
    // Interpolazione lineare tra angoli adiacenti
    const da = angleDelta[idx] * (1 - frac) + angleDelta[next] * frac;
    result.push(da * SCALE);
  }
  return result;
}

function buildCrafterSprites(circuitLen, externalData){
  const sprites=[];
  const CLEN=circuitLen||1600;
  // Usa dati esterni se forniti (es. da playDatabaseMap), altrimenti usa S corrente
  const data = externalData || S;
  const obstacles = data.obstacles || [];
  const scenery   = data.scenery   || [];
  const opponents = data.opponents !== undefined ? data.opponents : S.opponents;
  const name      = data.name || S.name || "circuit";

  obstacles.forEach(ob=>{
    const def=OBSTACLES_DEF.find(d=>d.id===ob.defId); if(!def) return;
    sprites.push({src:def.gameSrc,x:def.x,Z:Math.floor(ob.t*CLEN),speed:0,lcw:0.45,rcw:0.5,collidable:true,scale:def.scale});
  });
  scenery.forEach(sc=>{
    const defs=SCENERY_DEF[sc.theme]||[];
    const def=defs.find(d=>d.id===sc.defId); if(!def) return;
    const x=sc.side==="L"?(def.xL||(-2.5)):(def.xR||2.3);
    sprites.push({src:def.gameSrc,x,Z:Math.floor(sc.t*CLEN),speed:0,lcw:0.06,rcw:0.06,collidable:false,scale:1.0});
  });

  // ── Avversari ──────────────────────────────────────────────────────────────
  if (opponents) {
    const numOpp = Math.max(3, Math.min(10, Math.floor(CLEN / 350)));
    const step   = Math.floor(CLEN / numOpp);
    const seed   = name.split("").reduce((a,c)=>a+c.charCodeAt(0),0);
    for (let i = 0; i < numOpp; i++) {
      const Z = (i * step + Math.floor(step * 0.3 * ((seed + i) % 3))) % CLEN;
      const x = i % 2 === 0 ? -0.55 : 0.45;
      const spd = ((seed + i) % 3) + 1;
      sprites.push({
        src:"img/otherVehicle.png",
        x, Z, speed: spd,
        lcw:0.45, rcw:0.45,
        collidable:true, scale:0.3
      });
    }
  }

  return sprites;
}

function patchObstacleSet(sprites){
  if(typeof ObstacleSet==="undefined") return;
  // Salva gli sprites da usare nella prossima costruzione del circuito crafter
  // e rimuove il patch precedente ripristinando il metodo originale prima di riapplicarlo.
  if(!ObstacleSet._crafterOrigMethod){
    ObstacleSet._crafterOrigMethod = ObstacleSet.prototype.creaOstacoliPerMappa;
  }
  // Aggiorna gli sprites correnti (accessibili tramite closure sul prototype)
  ObstacleSet._crafterSprites = sprites || [];
  // Applica il patch solo una volta
  if(!ObstacleSet._crafterPatched){
    ObstacleSet._crafterPatched = true;
    ObstacleSet.prototype.creaOstacoliPerMappa = function(len){
      if(this.tipoMappa !== "crafter"){
        ObstacleSet._crafterOrigMethod.call(this, len);
        return;
      }
      this.obstacleSet = [];
      (ObstacleSet._crafterSprites || []).forEach(sp => {
        const s = new Sprite(sp.src, sp.x, sp.Z, sp.speed);
        s.leftCollisionWidth  = sp.lcw;
        s.rightCollisionWidth = sp.rcw;
        s.collidable = sp.collidable;
        s.scale      = sp.scale;
        this.obstacleSet.push(s);
      });
    };
  }
}

async function show(){
  // Feature #2: Verifica sessione — solo utenti autenticati possono usare il Crafter
  try {
    const res = await fetch('/GiocoF/Session', { credentials: 'include' });
    const session = await res.json();
    if (!session.loggedIn) {
      // Feature #2: mostra modal login con redirect automatico al Crafter dopo auth
      if (typeof apriAuthModal === 'function') {
        apriAuthModal('login.html', 'crafter');
      } else {
        toast("⚠️ Devi essere loggato per accedere al Crafter!");
      }
      return;
    }
  } catch (e) {
    toast("⚠️ Impossibile verificare la sessione. Riprova.");
    return;
  }

  document.getElementById("gkCrafter").classList.add("on");
  // Carica mappe dal DB quando si apre il crafter (solo se loggato)
  setTimeout(()=>{ if(typeof loadSavedMapsFromDatabase==="function") loadSavedMapsFromDatabase(); }, 300);
  if(window.updateRadioUI) window.updateRadioUI();
  setTimeout(()=>{
    const dw=document.getElementById("gkDrawWrap");
    drawCanvas.width=dw.clientWidth||340; drawCanvas.height=dw.clientHeight||500;
    const pw=document.getElementById("gkPreviewWrap");
    previewCanvas.width=pw.clientWidth||600; previewCanvas.height=pw.clientHeight||500;
    updateStats();
  },60);
}

function hide(){
  document.getElementById("gkCrafter").classList.remove("on");
  document.dispatchEvent(new CustomEvent("crafterBack"));
  if(window.updateRadioUI) window.updateRadioUI();
}

// Feature #3: logout protetto dal Crafter — chiamato dal bottone logout nella auth bar
// La logica principale è in mainj.js eseguiLogout(), ma esponiamo un hook per il Crafter
window._isCrafterOpen = function() {
  const el = document.getElementById('gkCrafter');
  return el && el.classList.contains('on');
};

let _tt;
function toast(msg, duration){
  const el=document.getElementById("gkToast");
  el.textContent=msg; el.classList.add("on");
  clearTimeout(_tt); _tt=setTimeout(()=>el.classList.remove("on"), duration||2800);
}


// ========== FUNZIONI DATABASE (dal sistema NetBeans) ==========

async function saveMapToDatabase() {
    const nameInp = document.getElementById("gkNameIn");
    const mapName = nameInp ? nameInp.value.trim() : "";
    const userId = window._utenteLoggato ? true : null; // usa sessione server-side
    if (!mapName) { toast("⚠️ Inserisci un nome per il circuito!"); return; }
    if (!userId) { toast('❌ Effettua il login prima di salvare!'); return; }
    try {
        const cleanData = {name:S.name,mappa:S.mappa,rawPath:S.rawPath,smoothPath:S.smoothPath,obstacles:S.obstacles,scenery:S.scenery,colAsfalto:S.colAsfalto,colBordo:S.colBordo,colErba:S.colErba,roadW:S.roadW,opponents:S.opponents};
        const params = new URLSearchParams();
        params.append('nome', mapName);
        params.append('mapData', JSON.stringify(cleanData));
        const res = await fetch('/GiocoF/SalvaMappaPersonalizzata', {
            method:'POST', credentials:'include', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body:params.toString()
        });
        const data = await res.json();
        if (data.ok) {
            toast('🎉 "' + mapName + '" salvata nel database!', 3000);
            await loadSavedMapsFromDatabase();
        } else { alert('❌ Errore: ' + (data.errore||'Errore del server')); }
    } catch(e) { alert('❌ Errore di connessione'); }
}

async function loadSavedMapsFromDatabase() {
    const userId = window._utenteLoggato ? true : null; // usa sessione server-side
    if (!userId) return;
    try {
        const res = await fetch('/GiocoF/CaricaMappePersonalizzate', { credentials: 'include' });
        const mappe = await res.json();
        const list = document.getElementById("gkDbList");
        if (!list) return;
        if (!Array.isArray(mappe) || mappe.length === 0) {
            list.innerHTML = '<p style="color:#aaa;text-align:center;padding:20px;">Nessuna mappa nel database.</p>';
            return;
        }
        list.innerHTML = '';

        // Recupera il record PERSONALE dell'utente per ogni mappa
        // tramite ScorePersonale (non usa la top-10, quindi appare sempre)
        const scorePromises = mappe.map(mappa =>
            fetch('/GiocoF/ScorePersonale?idCircuito=' + mappa.id + '&customMap=true', { credentials: 'include' })
                .then(r => r.json())
                .then(data => ({
                    mapId: mappa.id,
                    record: (data.ok && data.tempoMs !== null)
                            ? { tempoFormattato: data.tempoFormattato }
                            : null
                }))
                .catch(() => ({ mapId: mappa.id, record: null }))
        );
        const scores = await Promise.all(scorePromises);
        const scoreMap = {};
        scores.forEach(s => { scoreMap[s.mapId] = s.record; });

        mappe.forEach(mappa => {
            const rec = scoreMap[mappa.id];
            const scoreHtml = rec
                ? `<div style="margin-top:4px;display:flex;align-items:center;gap:6px;">
                     <span style="font-size:0.65em;color:rgba(0,180,255,0.6);letter-spacing:1px;text-transform:uppercase;font-family:'Orbitron',monospace;">🏆 Il tuo record:</span>
                     <span style="font-family:'Orbitron',monospace;font-size:0.75em;font-weight:700;color:#00e5ff;">${rec.tempoFormattato}</span>
                   </div>`
                : `<div style="margin-top:4px;font-size:0.65em;color:rgba(255,255,255,0.25);font-style:italic;">Nessun record ancora</div>`;

            const el = document.createElement("div");
            el.className = "gkSavedItem";
            el.innerHTML = `
                <div style="flex:1">
                    <div class="sname">${mappa.nome}</div>
                    <div class="smeta">${new Date(mappa.data_creazione).toLocaleDateString()}</div>
                    ${scoreHtml}
                </div>
                <div style="display:flex;flex-direction:column;gap:4px;align-items:stretch;flex-shrink:0;">
                    <button onclick="playDatabaseMap(${mappa.id},'${mappa.nome.replace(/'/g,"\\'")}');event.stopPropagation();"
                        style="background:linear-gradient(135deg,#003fa3,#0077ff);color:#fff;border:none;padding:5px 10px;border-radius:5px;cursor:pointer;font-size:0.8em;font-weight:700;">▶ Gioca</button>
                    <button onclick="mostraTop10MappaDB(${mappa.id},'${mappa.nome.replace(/'/g,"\\'")}');event.stopPropagation();"
                        style="background:#1a3a6a;color:#7ec8ff;border:1px solid rgba(0,119,255,0.3);padding:5px 8px;border-radius:5px;cursor:pointer;font-size:0.8em;">🏆</button>
                    <button onclick="deleteDatabaseMap(${mappa.id});event.stopPropagation();"
                        style="background:#3a0808;color:#ff6b6b;border:1px solid rgba(255,59,59,0.3);padding:5px 8px;border-radius:5px;cursor:pointer;font-size:0.8em;">🗑</button>
                </div>`;
            list.appendChild(el);
        });
    } catch(e) { console.error('❌ Errore caricamento mappe DB:', e); }
}

async function playDatabaseMap(mapId, mapName) {
    const userId = window._utenteLoggato ? true : null; // usa sessione server-side
    try {
        const res = await fetch('/GiocoF/CaricaMappePersonalizzate', { credentials: 'include' });
        const mappe = await res.json();
        const mappa = mappe.find(m => m.id === mapId);
        if (!mappa) { alert('❌ Mappa non trovata!'); return; }
        // config è il JSON salvato nel DB. Supporta due formati:
        // - Nuovo (formato pulito): { name, mappa, smoothPath, obstacles, scenery, colAsfalto, ... }
        // - Vecchio (formato {…S}): stessi campi ma anche campi extra non necessari
        // In entrambi i casi i campi che ci servono sono allo stesso livello.
        const raw = mappa.config || mappa;
        // Estrai i campi essenziali con fallback sicuri
        const config = {
            name:       raw.name       || mappa.nome || mapName,
            mappa:      raw.mappa      || "montagna",
            smoothPath: Array.isArray(raw.smoothPath) ? raw.smoothPath : [],
            rawPath:    Array.isArray(raw.rawPath)    ? raw.rawPath    : [],
            obstacles:  Array.isArray(raw.obstacles)  ? raw.obstacles  : [],
            scenery:    Array.isArray(raw.scenery)     ? raw.scenery    : [],
            colAsfalto: raw.colAsfalto || null,
            colBordo:   raw.colBordo   || null,
            colErba:    raw.colErba    || null,
            roadW:      raw.roadW      || 3000,
            opponents:  raw.opponents  !== undefined ? raw.opponents : true,
        };
        window.customMapData = config; window.isCustomMap = true;
        window.customMapDbId = mapId; window.customMapName = mapName;
        // Evita che l'id del circuito precedente venga usato come fallback
        window.idCircuitoCorrente = null;

        // Nascondi crafter senza triggerare crafterBack
        document.getElementById("gkCrafter").classList.remove("on");

        const customMapKey = "db_" + mapId;
        const mappa_nome = config.mappa || "montagna";

        // Se smoothPath è vuoto ma rawPath non lo è, ricalcola il percorso smooth
        if (config.smoothPath.length < 10 && config.rawPath.length >= 24) {
            // Ricrea il percorso smooth dal rawPath usando la stessa logica del Crafter
            const tmpPts = config.rawPath;
            const n = tmpPts.length;
            let smoothed = tmpPts.map(p => ({...p}));
            for (let pass = 0; pass < 3; pass++) {
                const tmp = smoothed.slice();
                for (let i = 0; i < n; i++) {
                    let sx = 0, sy = 0;
                    for (let d = -1; d <= 1; d++) { const j=(i+d+n)%n; sx+=tmp[j].x; sy+=tmp[j].y; }
                    smoothed[i] = { x: sx/3, y: sy/3 };
                }
            }
            config.smoothPath = catmullRomSharp(smoothed, 32);
        }

        const CIRCUIT_LEN = calcCircuitLen(config.smoothPath || []);

        // Ricostruisci curve dal smoothPath (formato nuovo Crafter)
        let curvePerSegment = [];
        if (config.smoothPath && config.smoothPath.length > 10 && CIRCUIT_LEN > 0) {
            const raw = pathToPerSegmentCurves(config.smoothPath, CIRCUIT_LEN);
            curvePerSegment = smoothCurveLoop(raw);
        }

        // Trova segmento più dritto
        let bestSeg = 0;
        if (curvePerSegment.length > 0) {
            const WIN = 20;
            let bestScore = Infinity;
            for (let i = 0; i < CIRCUIT_LEN; i++) {
                let score = 0;
                for (let w = 0; w < WIN; w++) score += Math.abs(curvePerSegment[(i+w)%CIRCUIT_LEN]);
                if (score < bestScore) { bestScore = score; bestSeg = i; }
            }
        }

        // Colori dalla configurazione del nuovo Crafter
        const coloriStrada = {
            sand:   (config.colErba   || SAND_COLOR[mappa_nome]   || "#12690f") + "ff",
            rumble: (config.colBordo  || RUMBLE_COLOR[mappa_nome] || "#ffffff") + "ff",
            road:   (config.colAsfalto|| ROAD_COLOR[mappa_nome]   || "#c8c8c8") + "ff"
        };

        // Sfondo
        const bgImg = (config.customBgImg && config.customBgImg.src)
            ? config.customBgImg.src
            : (BG_IMG[mappa_nome] || "img2/montagna.png");

        // Patch ostacoli dal nuovo Crafter
        if (CIRCUIT_LEN > 0) patchObstacleSet(buildCrafterSprites(CIRCUIT_LEN, config));

        if (typeof MAPPE !== 'undefined') {
            MAPPE[customMapKey] = {
                nome: mapName,
                colore: BG_COLOR[mappa_nome] || "#4A90E2",
                immagine: bgImg,
                coloreSfondo: BG_COLOR[mappa_nome] || "#4A90E2",
                coloriStrada: coloriStrada,
                curve: [],
                curvePerSegment: curvePerSegment,
                length: CIRCUIT_LEN || 1600,
                altezza: 0,
                roadW: config.roadW || 3000,
                startSegment: bestSeg,
                tipoBase: "crafter"  // forza ObstacleSet a usare gli sprites del crafter
            };
        }

        // Avvia gioco
        document.getElementById("selezioneMappeScreen").style.display = "none";
        document.getElementById("gamecenter").style.display = "flex";
        document.getElementById("playButton").style.display = "none";
        document.getElementById("dashboard").style.display = "block";
        // Feature #7: aggiorna visibilità barra auth
        if (typeof aggiornaVisibilitaAuthBar === 'function') aggiornaVisibilitaAuthBar();
        const gc = document.getElementById("gameCanvas");
        if (gc) {
            window.canvas = gc;
            window.canvas2D = gc.getContext("2d");
            window.canvas.width = gc.offsetWidth;
            window.canvas.height = gc.offsetHeight;
        }
        if (typeof avviaGioco === 'function') avviaGioco(customMapKey);
    } catch(e) { console.error('❌ Errore:', e); alert('❌ Errore caricamento mappa: ' + e.message); }
}

async function deleteDatabaseMap(mapId) {
    if (!confirm('Eliminare questa mappa dal database?')) return;
    const userId = window._utenteLoggato ? true : null; // usa sessione server-side
    try {
        const params = new URLSearchParams();
        params.append('mapId', mapId);
        const res = await fetch('/GiocoF/EliminaMappaPersonalizzata', {
            method:'POST', credentials:'include', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body:params.toString()
        });
        const data = await res.json();
        if (data.ok) { toast('🗑️ Mappa eliminata!'); await loadSavedMapsFromDatabase(); }
        else alert('❌ Errore: ' + (data.errore||'Errore'));
    } catch(e) { alert('❌ Errore di connessione'); }
}

window.CrafterAPI={show,hide,getCircuit:()=>({...S})};
window.CrafterAPI.saveMapToDatabase=saveMapToDatabase;
window.CrafterAPI.loadSavedMapsFromDatabase=loadSavedMapsFromDatabase;
window.CrafterAPI.playDatabaseMap=playDatabaseMap;
window.CrafterAPI.deleteDatabaseMap=deleteDatabaseMap;

// Esponi globalmente per gli onclick inline nell'HTML generato
window.playDatabaseMap=playDatabaseMap;
window.deleteDatabaseMap=deleteDatabaseMap;
window.saveMapToDatabase=saveMapToDatabase;
window.loadSavedMapsFromDatabase=loadSavedMapsFromDatabase;

if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",init);
else init();
})();