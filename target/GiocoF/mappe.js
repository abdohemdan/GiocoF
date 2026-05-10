// ========== mappe.js ==========
// Configurazioni mappe, classi motore 2D, game loop
// Nota: CIRCUITO_ID, MAPPE, ELEMENT_SETS sono in config.js
// Fallback se config.js non carica:

if (typeof CIRCUITO_ID === 'undefined') {
    window.CIRCUITO_ID = { montagna: 1, citta: 2, deserto: 3 };
}

if (typeof MAPPE === 'undefined') {
    window.MAPPE = {
        montagna: { nome: "MONTAGNA", colore: "#4A90E2", immagine: "img2/montagna.png", coloreSfondo: "#4A90E2", coloriStrada: { sand: "#ffffffff", rumble: "#ffffffff", road: "#ffffffff" }, curve: [{ inizio: 0.1, fine: 0.25, valore: 0.5 }, { inizio: 0.3, fine: 0.50, valore: -0.9 }, { inizio: 0.6, fine: 0.70, valore: 0.6 }, { inizio: 0.7, fine: 0.80, valore: -0.6 }, { inizio: 0.9, fine: 1.0, valore: 0.4 }], altezza: 1300 },
        citta: { nome: "CITTÀ", colore: "#E24A4A", immagine: "img3/città.png", coloreSfondo: "#E24A4A", coloriStrada: { sand: "#474847ff", rumble: "#ffffffff", road: "#232323ff" }, curve: [{ inizio: 0.1, fine: 0.2, valore: -0.6 }, { inizio: 0.2, fine: 0.3, valore: 0.6 }, { inizio: 0.5, fine: 0.8, valore: -0.3 }, { inizio: 0.85, fine: 0.95, valore: 0.8 }], altezza: 400 },
        deserto: { nome: "FORESTA", icona: "🏜️", colore: "#E2B54A", immagine: "img/salsal.png", coloreSfondo: "#E2B54A", coloriStrada: { sand: "#12690fff", rumble: "#844c07ff", road: "#844c07ff" }, curve: [{ inizio: 0.25, fine: 0.5, valore: -0.5 }, { inizio: 0.75, fine: 1.0, valore: 0.5 }], altezza: 800 }
    };
}

if (typeof ELEMENT_SETS === 'undefined') {
    window.ELEMENT_SETS = {
        montagna: ['img2/albero2.png','img2/albero3.png','img2/funivia3.png','img2/montagne3.png'],
        citta: ['img3/lampione.png','img3/edifici1.10.png','img3/edifici1.11.png','img3/edifici2.3.png','img3/edifici2.4.png'],
        deserto: ['img/albero10.png','img/albero9.png','img/rocciag2.png','img/albero7.png','img/liane8.png']
    };
}

// ========== VARIABILI GLOBALI MOTORE 2D ==========
let canvas, canvas2D;
const gameFrameRate = 20;
let gameLoopInterval;
let myCamera, myCircuit, myBackground, myFerrari;
let mappaCorrente = null;

// ========== CURVE DINAMICHE ==========
function generateCurves(curveDifficulty) {
    const map = {
        facile:    [{inizio:0.15,fine:0.28,valore:0.3},{inizio:0.40,fine:0.52,valore:-0.3},{inizio:0.65,fine:0.78,valore:0.25},{inizio:0.88,fine:0.98,valore:-0.25}],
        normale:   [{inizio:0.1,fine:0.25,valore:0.5},{inizio:0.3,fine:0.50,valore:-0.9},{inizio:0.6,fine:0.70,valore:0.6},{inizio:0.7,fine:0.80,valore:-0.6},{inizio:0.9,fine:1.0,valore:0.4}],
        difficile: [{inizio:0.08,fine:0.20,valore:0.7},{inizio:0.22,fine:0.35,valore:-0.8},{inizio:0.38,fine:0.48,valore:0.75},{inizio:0.50,fine:0.62,valore:-0.85},{inizio:0.65,fine:0.75,valore:0.7},{inizio:0.78,fine:0.88,valore:-0.75},{inizio:0.90,fine:0.99,valore:0.6}],
        estremo:   [{inizio:0.05,fine:0.15,valore:0.9},{inizio:0.16,fine:0.25,valore:-0.95},{inizio:0.27,fine:0.36,valore:0.85},{inizio:0.38,fine:0.47,valore:-0.9},{inizio:0.49,fine:0.58,valore:0.88},{inizio:0.60,fine:0.69,valore:-0.92},{inizio:0.71,fine:0.80,valore:0.87},{inizio:0.82,fine:0.91,valore:-0.88},{inizio:0.93,fine:1.00,valore:0.85}]
    };
    return map[curveDifficulty] || map.normale;
}

// ========== CLASSI ==========
class Camera {
    constructor() { this.camD = 0.84; this.camH = 0; }
}

class Circuit {
    constructor(length, tipoMappa = "montagna") {
        this.length = length; this.segL = 100;
        this.tipoMappa = tipoMappa;
        this.mappaConfig = MAPPE[tipoMappa] || MAPPE.montagna;
        this.roadW = this.mappaConfig.roadW || 3000;
        this.segments = Array.from({ length: this.length }, (_, i) => {
            let segment = new Segment(i * this.segL, this.roadW);
            if (this.mappaConfig.curve) {
                this.mappaConfig.curve.forEach(curva => {
                    if (i > curva.inizio * this.length && i < curva.fine * this.length) segment.curve = curva.valore;
                });
            }
            segment.y3d = Math.sin(i / 50.0) * (this.mappaConfig.altezza || 0);
            return segment;
        });
        // Supporto curvePerSegment (nuovo Crafter)
        if (this.mappaConfig.curvePerSegment && this.mappaConfig.curvePerSegment.length) {
            const cps = this.mappaConfig.curvePerSegment;
            for (let i = 0; i < this.segments.length; i++) {
                this.segments[i].curve = cps[i % cps.length] || 0;
            }
        }
        const baseTipo = (this.mappaConfig.tipoBase && this.mappaConfig.tipoBase !== '') ? this.mappaConfig.tipoBase : tipoMappa;
        this.obstacleSet = new ObstacleSet(this.length, baseTipo, this.mappaConfig.obstacleDensity || "normale", this.mappaConfig.allowedObstacles || null);
        this.obstacleSet.applyToCircuit(this.segments);
    }
    drawVisibleSegments = function(myPos, myX, camD, camH) {
        let mySegmentPos = Math.floor(myPos / this.segL), maxY = canvas.height, x = 0, dx = 0;
        for (let n = mySegmentPos; n < mySegmentPos + 350; n++) {
            let cur  = this.segments[(this.length + n) % this.length];
            let prev = this.segments[(this.length + n - 1) % this.length];
            cur.projectQuad(myX - x, camH, myPos - (n >= this.length ? this.length * this.segL : 0), camD);
            x += dx; dx += cur.curve; cur.clip = maxY;
            if (cur.y2d >= maxY) continue;
            maxY = cur.y2d;
            const { sand, rumble, road } = this.mappaConfig.coloriStrada;
            cur.drawQuad(sand,   0,        prev.y2d, canvas.width,    0,        canvas.width);
            cur.drawQuad(rumble, prev.x2d, prev.y2d, prev.w2d * 1.2,  cur.x2d,  cur.w2d * 1.2);
            cur.drawQuad(road,   prev.x2d, prev.y2d, prev.w2d,        cur.x2d,  cur.w2d);
        }
    };
    updateSpritesPosition = function() {
        this.segments.forEach(s => { s.Sprite = []; });
        this.obstacleSet.updatePositions(this.length);
        this.obstacleSet.applyToCircuit(this.segments);
    };
    drawVisibleSprites = function(posZ, camD, hasCollided) {
        let cur = Math.floor(posZ / this.segL);
        if (hasCollided) cur += 60;
        for (let n = cur + 300; n > cur; n--)
            this.segments[(this.length + n) % this.length].drawSprite(posZ - (n >= this.length ? this.length * this.segL : 0), camD);
    };
}

class Segment {
    constructor(z3d, roadW) {
        this.roadW = roadW; this.z3d = z3d;
        this.x3d = 0; this.y3d = 0; this.x2d = 0; this.y2d = 0; this.w2d = 0;
        this.curve = 0; this.clip = 0; this.Sprite = [];
    }
    projectQuad = function(camX, camY, camZ, camD) {
        let scale = camD / (this.z3d - camZ);
        this.x2d = (1 + scale * (this.x3d - camX)) * canvas.width / 2;
        this.y2d = (1 - scale * (this.y3d - camY)) * canvas.height / 2;
        this.w2d = scale * this.roadW * canvas.width / 2;
        if (!isFinite(this.w2d)) this.w2d = canvas.width / 2;
    }
    drawQuad = function(color, x1, y1, w1, x2, w2) {
        canvas2D.beginPath(); canvas2D.fillStyle = color;
        canvas2D.moveTo(x2-w2,this.y2d); canvas2D.lineTo(x2+w2,this.y2d);
        canvas2D.lineTo(x1+w1,y1); canvas2D.lineTo(x1-w1,y1); canvas2D.fill();
    }
    drawSprite = function(camZ, camD) {
        this.Sprite.forEach(s => { if (s.img.width !== 0) s.draw(camZ, camD, this.x2d, this.y2d, this.w2d, this.z3d, this.clip); });
    }
}

class Sprite {
    constructor(file, X, Z, V) {
        this.X = X; this.Z = Z; this.speed = V;
        this.img = new Image(); this.img.src = file;
        this.leftCollisionWidth = 0; this.rightCollisionWidth = 0;
        this.collidable = true; this.scale = 1.0;
    }
    set = function(file, X, lCW, rCW, collidable = true, scale = 1.0) {
        this.img.src = file; this.X = X;
        this.leftCollisionWidth = lCW; this.rightCollisionWidth = rCW;
        this.collidable = collidable; this.scale = scale;
    }
    moveForward = function(cl) { this.Z += this.speed; this.Z %= cl; }
    moveLeft    = function() { if (this.X > -1.5) this.X -= 0.1; }
    moveRight   = function() { if (this.X <  0.5) this.X += 0.1; }
    draw = function(camZ, camD, x2d, y2d, w2d, z3d, clip) {
        let w = this.img.width, h = this.img.height;
        let scale = camD / (z3d - camZ);
        this.destX = x2d + scale * this.X * canvas.width / 2;
        let destY = y2d + 4;
        this.destW = w * w2d / 366 * this.scale;
        let destH  = h * w2d / 366 * this.scale;
        this.destX += this.destW * this.X;
        destY += destH * (-0.7);
        let clipH = destY + destH - clip;
        if (clipH < 0) clipH = 0;
        if (clipH >= destH) return;
        if (this.img.complete && this.img.naturalWidth !== 0)
            canvas2D.drawImage(this.img, this.destX, destY, this.destW, destH - clipH);
    }
}

class ObstacleSet {
    constructor(circuitLength, tipoMappa = "montagna", obstacleDensity = "normale", allowedObstacles = null) {
        this.obstacleSet = []; this.tipoMappa = tipoMappa;
        this.obstacleDensity = obstacleDensity; this.allowedObstacles = allowedObstacles;
        this.densityMultiplier = this.getDensityMultiplier(obstacleDensity);
        this.creaOstacoliPerMappa(circuitLength);
    }
    getDensityMultiplier(d) { return { bassa:2.0, normale:1.5, alta:1.0, massima:0.8 }[d] || 1.0; }
    creaOstacoliPerMappa(circuitLength) {
        let alberoSx, alberoDx, roccia, edificio;
        let div = this.densityMultiplier;
        const enabled = (file) => {
            if (this.allowedObstacles === null || this.allowedObstacles === undefined) return true;
            if (!Array.isArray(this.allowedObstacles)) return true;
            if (this.allowedObstacles.length === 0) return false;
            const norm = s => (s||'').toString().trim();
            const cands = this.allowedObstacles.map(norm), tgt = norm(file);
            return cands.some(a => a===tgt||a.endsWith(tgt)||tgt.endsWith(a)||a.includes(tgt)||tgt.includes(a));
        };
        const add = (file, X, lCW, rCW, step, collidable=true, scale=1.0, speed=0) => {
            for (let i = 0; i < circuitLength / (step * div); i++) {
                let p = this.obstacleSet.push(new Sprite("", 0, i * step * div, speed));
                this.obstacleSet[p-1].set(file, X, lCW, rCW, collidable, scale);
            }
        };
        if (this.tipoMappa === "montagna") {
            alberoSx="img2/albero2.png"; alberoDx="img2/albero3.png"; roccia="img2/funivia3.png"; edificio="img2/albero3.png";
            if (enabled('img2/albero2.png'))  add('img2/albero2.png', -2.5, 0.08, 0.03, 20);
            if (enabled('img2/albero3.png'))  add('img2/albero3.png',  2.3, 0.06, 0.06, 20);
            if (enabled('img/sparaneve.png')) {
                for (let i = 0; i < circuitLength/(500*div)-1; i++) {
                    let p=this.obstacleSet.push(new Sprite("",0,i*500*div,0)); this.obstacleSet[p-1].set("img/sparaneve.png",0,0.45,0.5,true,0.25);
                    p=this.obstacleSet.push(new Sprite("",0,i*500*div+250,0)); this.obstacleSet[p-1].set("img/sparaneve.png",-1,0.45,0.5,true,0.25);
                }
            }
            for (let i=0;i<circuitLength/(150*div);i++){let p=this.obstacleSet.push(new Sprite("",0,i*150*div,Math.floor(Math.random()*3)+1));this.obstacleSet[p-1].set("img/otherVehicle.png",Math.random()*2-1.5,0.5,0.5,true,0.3);}
            if (enabled('img2/funivia3.png'))  add('img2/funivia3.png',  1,   0.06, 0.06, 110);
            if (enabled('img2/montagne3.png')) add('img2/montagne3.png', -2.2,0.06, 0.06, 60);
        } else if (this.tipoMappa === "citta") {
            alberoSx="img3/lampione.png"; alberoDx="img3/lampione.png"; roccia="img3/edifici1.10.png"; edificio="img3/edifici1.11.png";
            if (enabled(alberoSx)) add(alberoSx, -2.5, 0.08, 0.03, 70);
            if (enabled(alberoDx)) add(alberoDx,  1,   0.06, 0.06, 70);
            if (enabled('img/blocco.png')) {
                for (let i=0;i<circuitLength/(500*div)-1;i++){
                    let p=this.obstacleSet.push(new Sprite("",0,i*500*div,0));this.obstacleSet[p-1].set("img/blocco.png",0,0.45,0.5);
                    p=this.obstacleSet.push(new Sprite("",0,i*500*div+250,0));this.obstacleSet[p-1].set("img/blocco.png",-1,0.45,0.5);
                }
            }
            for (let i=0;i<circuitLength/(150*div);i++){let p=this.obstacleSet.push(new Sprite("",0,i*150*div,Math.floor(Math.random()*3)+1));this.obstacleSet[p-1].set("img/otherVehicle.png",Math.random()*2-1.5,0.5,0.5,true,0.3);}
            if (enabled(roccia))   add(roccia,   0.4, 0.08, 0.03, 40);
            if (enabled(edificio)) { add(edificio, 1.2, 0.08, 0.03, 40); add(edificio, -3, 0.08, 0.03, 40); }
            if (enabled('img3/edifici2.3.png')) { add('img3/edifici2.3.png',1.8,0.08,0.03,40); add('img3/edifici2.3.png',-1.5,0.08,0.03,40); }
            if (enabled('img3/edifici2.4.png'))   add('img3/edifici2.4.png',-2.4,0.08,0.03,40);
        } else {
            alberoSx="img/albero10.png"; alberoDx="img/albero9.png"; roccia="img/rocciag2.png"; edificio="img/albero7.png";
            if (enabled(alberoSx)) add(alberoSx, -2.2, 0.08, 0.03, 30);
            if (enabled(alberoDx)) add(alberoDx,  1.2, 0.06, 0.06, 30);
            if (enabled('img/tronco.png')) {
                for (let i=0;i<circuitLength/(500*div)-1;i++){
                    let p=this.obstacleSet.push(new Sprite("",0,i*500*div,0));this.obstacleSet[p-1].set("img/tronco.png",0,0.45,0.5,true,0.6);
                    p=this.obstacleSet.push(new Sprite("",0,i*500*div+250,0));this.obstacleSet[p-1].set("img/tronco.png",-1,0.45,0.5,true,0.6);
                }
            }
            for (let i=0;i<circuitLength/(150*div);i++){let p=this.obstacleSet.push(new Sprite("",0,i*150*div,Math.floor(Math.random()*3)+1));this.obstacleSet[p-1].set("img/otherVehicle.png",Math.random()*2-1.5,0.5,0.5,true,0.3);}
            if (enabled(roccia)) {
                add(roccia,   -2.6, 0.08, 0.03, 30); add(roccia, 1.2, 0.08, 0.03, 30);
                add(edificio,  1.7, 0.06, 0.06, 20); add(edificio,-2.9,0.06, 0.06, 20);
                if (enabled('img/liane8.png')) add('img/liane8.png',-0.56,0.06,0.06,90,false);
            }
        }
        try {
            const pos = { montagna:{left:-2.5,right:2.3,leftAlt:-2.2,rightAlt:1.0,center:0,centerAlt:-1}, citta:{left:-2.5,right:1.2,leftAlt:-2.4,rightAlt:1.8,center:0,centerAlt:-1} };
            const mp = pos[this.tipoMappa] || { left:-2.2, right:1.2, leftAlt:-2.9, rightAlt:1.7, center:0, centerAlt:-1 };
            const pickX = (file, idx) => {
                const l = (file||'').toLowerCase();
                if (l.includes('sparaneve')||l.includes('blocco')||l.includes('tronco')) return idx%2===0?mp.center:mp.centerAlt;
                if (l.includes('albero')||l.includes('lampione')||l.includes('edifici')||l.includes('montagne')||l.includes('funivia')||l.includes('rocc'))
                    return idx%2===0?(mp.left+Math.random()*0.3):(mp.right-Math.random()*0.3);
                if (l.includes('liane')||l.includes('other')) return mp.leftAlt+Math.random()*0.6;
                return Math.random()*4-2;
            };
            if (Array.isArray(this.allowedObstacles) && this.allowedObstacles.length > 0) {
                this.allowedObstacles.forEach(file => {
                    const exists = this.obstacleSet.some(o => { try { return (o.img&&(o.img.src||'').includes(file)); } catch(e){return false;} });
                    if (!exists) {
                        for (let i=0;i<6;i++) {
                            const zPos=Math.floor((i/6)*circuitLength+Math.random()*20), xPos=pickX(file,i);
                            const p=this.obstacleSet.push(new Sprite("",0,zPos,0)), sp=this.obstacleSet[p-1];
                            const l=file.toLowerCase();
                            if (l.includes('sparaneve')||l.includes('tronco')) sp.set(file,xPos,0.45,0.5,true,0.5);
                            else if (l.includes('blocco')) sp.set(file,xPos,0.45,0.5,true,1.0);
                            else if (l.includes('albero')||l.includes('lampione')||l.includes('montagne')||l.includes('edifici')||l.includes('rocc')) sp.set(file,xPos,0.08,0.06,false,0.9);
                            else sp.set(file,xPos,0.06,0.06,false,0.8);
                        }
                    }
                });
            }
        } catch(e) { console.warn('Errore ostacoli:',e); }
    }
    length = function() { return this.obstacleSet.length; }
    avoidCollisions = function() {
        this.obstacleSet.forEach(t => {
            let ok=true, tL=t.destX+t.destW*(0.5-t.leftCollisionWidth), tR=t.destX+t.destW*(0.5+t.rightCollisionWidth);
            this.obstacleSet.forEach(o => {
                if (t.Z+100>o.Z && t.speed>o.speed) {
                    let oL=o.destX+o.destW*(0.5-o.leftCollisionWidth), oR=o.destX+o.destW*(0.5+o.rightCollisionWidth);
                    if ((oL>tL&&oL<tR)||(oR>tL&&oR<tR)||(tL>oL&&tR<oR)) {
                        if (t.speed>1) t.speed--;
                        o.X>-0.5?t.moveLeft():t.moveRight(); ok=false;
                    }
                }
            });
            if (ok&&t.speed>0&&t.speed<3) t.speed++;
        });
    }
    updatePositions = function(cl) { this.avoidCollisions(); this.obstacleSet.forEach(o => o.moveForward(cl)); }
    applyToCircuit(segments) {
        this.obstacleSet.forEach(o => {
            const idx = Math.floor(o.Z) % segments.length;
            if (idx<0||idx>=segments.length||!Number.isFinite(idx)) return;
            segments[idx].Sprite.push(o);
        });
    }
}

class Background {
    constructor(imgFile, staticColor) {
        this.staticColor = staticColor; this.img = new Image(); this.img.src = imgFile; this.X = 0;
    }
    cleanAll   = function() { canvas2D.clearRect(0,0,canvas.width,canvas.height); }
    drawStatic = function() {
        canvas2D.beginPath(); canvas2D.fillStyle=this.staticColor;
        canvas2D.moveTo(0,0); canvas2D.lineTo(canvas.width,0);
        canvas2D.lineTo(canvas.width,canvas.height/1.9); canvas2D.lineTo(0,canvas.height/1.9); canvas2D.fill();
    }
    drawRotating = function() {
        for (let i=-2;i<2;i++) canvas2D.drawImage(this.img,this.X+i*canvas.width,0,canvas.width,canvas.height/1.8);
    }
    updatePoV = function(curve, speed) {
        if (speed>0) this.X-=curve*2; if (speed<0) this.X+=curve*2;
        this.X = (this.img&&this.img.width>0) ? this.X%this.img.width : 0;
        this.drawStatic();
        if (this.img&&this.img.width>0&&this.img.complete) this.drawRotating();
    }
}

class PlayerCar {
    constructor() {
        this.posZ=0; this.segmentPos=0; this.posX=0; this.speed=300;
        this.img=new Image(); this.img.src="img/ferrari.png";
        this.carImageCrop=[7,64,132,32]; this.guyImageCrop=[]; this.ladyImageCrop=[];
        this.hasCollided=false;
        document.addEventListener('keydown',keyDown); document.addEventListener('keyup',keyUp);
    }
    updatePosition = function(myCamera, myCircuitLength, myCircuitSegments, mySegmentLenght) {
        this.posZ += this.speed;
        while (this.posZ>=myCircuitLength*mySegmentLenght) this.posZ-=myCircuitLength*mySegmentLenght;
        while (this.posZ<0) this.posZ+=myCircuitLength*mySegmentLenght;
        this.segmentPos=Math.floor(this.posZ/mySegmentLenght);
        myCamera.camH=3500+myCircuitSegments[this.segmentPos].y3d;
        this.posX-=myCircuitSegments[this.segmentPos].curve*50*Math.sign(this.speed);
    }
    checkForCollision = function(myCircuit) {
        for (let next=12;next<17;next++) {
            let si=myFerrari.segmentPos+next;
            if (si<0||si>=myCircuit.segments.length) continue;
            let seg=myCircuit.segments[si];
            if (!seg||!seg.Sprite) continue;
            seg.Sprite.forEach(sp => {
                if (!sp.collidable) return;
                if (sp.img.width!==0) {
                    let sL=sp.destX+sp.destW*(0.5-sp.leftCollisionWidth);
                    let cL=(canvas.width-myFerrari.carImageCrop[1]+myFerrari.carImageCrop[0])/2;
                    let cR=(canvas.width+myFerrari.carImageCrop[1]-myFerrari.carImageCrop[0])/2;
                    let sR=sp.destX+sp.destW*(0.5+sp.rightCollisionWidth);
                    if ((sL>cL&&sL<cR)||(sR>cL&&sR<cR)||(cL>sL&&cR<sR)) myFerrari.manageCollision();
                }
            });
        }
    }
    manageCollision() {
        if (this.hasCollided) return;
        this.hasCollided=true;
        document.removeEventListener('keydown',keyDown); document.removeEventListener('keyup',keyUp);
        myFerrari.animateCollision();
    }
    animateCollision = async function() {
        const carSeq=[[140,243,371,57,50],[245,340,361,67,75],[0,100,430,64,100],[100,200,430,64,115],[200,298,430,62,90],[300,380,430,64,70],[0,85,495,40,75],[90,180,495,40,75],[185,265,495,40,60],[265,340,490,50,45],[10,75,545,40,45],[80,150,545,40,50],[150,220,545,40,35],[220,290,536,50,25],[10,70,586,40,20],[75,145,586,40,20]];
        const guySeq=[[180,214,585,40,0,90],[217,239,585,40,20,100],[240,265,585,40,30,115],[267,292,585,40,40,105],[295,313,585,40,45,90],[160,180,586,40,65,80],[180,214,585,40,70,70],[217,239,585,40,70,50],[240,265,585,40,90,40],[267,292,585,40,90,30],[315,375,585,40,80,10],[0,45,630,30,105,10],[50,80,630,30,105,10],[87,113,630,30,105,10],[123,148,630,30,114,10],[87,113,630,30,105,10]];
        const ladySeq=[[240,270,630,30,-180,90],[270,300,630,30,-200,90],[150,180,630,30,-200,110],[210,235,630,30,-200,110],[240,270,630,30,-200,110],[270,300,630,30,-200,90],[300,330,630,30,-215,70],[330,350,630,30,-220,30],[0,33,660,25,-215,3],[35,68,660,25,-215,3],[70,100,660,25,-210,5],[105,135,660,25,-210,5],[140,160,660,25,-215,5],[160,180,655,30,-210,5],[140,160,660,25,-205,5],[160,180,655,30,-210,5]];
        const tempo=fermaTimer();
        document.getElementById("gameOverMessage").style.display="block";
        for (let i=0;i<carSeq.length;i++) {
            if (this.speed>0) this.speed-=100;
            myFerrari.carImageCrop=carSeq[i]; this.guyImageCrop=guySeq[i]; this.ladyImageCrop=ladySeq[i];
            await new Promise(r=>setTimeout(r,100));
        }
        await new Promise(r=>setTimeout(r,800));
        // Salva score con ID circuito corretto
        let idCircuito = null;
        if (window.customMapDbId) {
            // Mappa custom già salvata nel DB (utente loggato)
            idCircuito = window.customMapDbId;
            console.log('💾 Salvataggio score - Mappa DB ID:', idCircuito, 'Tempo:', tempo);
        } else if (CIRCUITO_ID && CIRCUITO_ID[mappaCorrente]) {
            // Mappa fissa (montagna, citta, deserto)
            idCircuito = CIRCUITO_ID[mappaCorrente];
            console.log('💾 Salvataggio score - Circuito:', idCircuito, 'Tempo:', tempo);
        } else if (window.idCircuitoCorrente) {
            idCircuito = window.idCircuitoCorrente;
        }

        document.getElementById("gameOverMessage").style.display = "none";
        document.getElementById("tempoFinaleDisplay").textContent = formatTimeMs(tempo);
        document.getElementById("nakNameDisplay").textContent = '👤 ' + (sessionStorage.getItem('nakName') || '');

        if (idCircuito) {
            // salvaScore gestisce ospiti (Feature #8) e loggati
            const scoreResult = await salvaScore(idCircuito, tempo);
            if (window._utenteLoggato) {
                // Loggato: mostra fineGara e posizionamento
                window._fineGaraVisibile = true;
                document.getElementById("fineGaraMessage").style.display = "block";
                // Feature #5: mostra posizionamento in classifica
                const posMsg = document.getElementById('posizionamentoMessage');
                if (posMsg) {
                    try {
                        const nakName = sessionStorage.getItem('nakName') || '';
                        const isCustomCircuito = window.isCustomMap && window.customMapDbId && String(idCircuito) === String(window.customMapDbId);
                        const topUrl = '/TopScore?idCircuito=' + idCircuito + (isCustomCircuito ? '&customMap=true' : '');
                        const resTop = await fetch(topUrl);
                        const classifica = await resTop.json();
                        const mioIdx = classifica.findIndex(r => r.nakName === nakName);
                        if (mioIdx >= 0) {
                            posMsg.style.display = 'block';
                            const pos = mioIdx + 1;
                            if (pos === 1) posMsg.textContent = '🥇 Sei in TESTA alla classifica!';
                            else if (pos <= 3) posMsg.textContent = `🏆 Sei #${pos} in classifica!`;
                            else posMsg.textContent = `📊 Sei #${pos} in classifica`;
                        } else {
                            posMsg.style.display = 'none';
                        }
                    } catch(e) {
                        if (posMsg) posMsg.style.display = 'none';
                    }
                }
            }
            // Se ospite, salvaScore mostra già il popup — non mostrare fineGaraMessage
        } else if (window.isCustomMap && !window._utenteLoggato) {
            // Ospite su mappa crafter: mostra popup specifico per crafter
            mostraOspiteCrafterPopup(tempo);
        } else {
            // Ospite su mappa normale senza idCircuito: popup standard
            if (window._utenteLoggato === false) {
                mostraOspiteScorePopup(tempo);
            } else {
                window._fineGaraVisibile = true;
                document.getElementById("fineGaraMessage").style.display = "block";
            }
        }

        // Bottone visualizza top10 — usa idCircuito corretto
        // Salva anche su window così salvaPunteggioPendente (dopo Google login) può riusarlo
        if (idCircuito) window._lastIdCircuito = idCircuito;
        if (idCircuito) window._lastIsCustomMap = !!(window.isCustomMap && window.customMapDbId && String(idCircuito) === String(window.customMapDbId));
        document.getElementById("visualizzaScoreBtn").onclick = function(){
            const idTop = window._lastIdCircuito || idCircuito || window.idCircuitoCorrente;
            const customMap = window._lastIsCustomMap || (window.isCustomMap && window.customMapDbId && String(idTop) === String(window.customMapDbId));
            if (idTop) mostraTop10Modal(idTop, customMap);
        };
        await new Promise(r=>setTimeout(r,500));
        // I bottoni sono ora dentro fineGaraMessage — li mostriamo insieme
        const ctrlDiv = document.getElementById("gameOverControls");
        if (ctrlDiv) ctrlDiv.style.display="flex";
        const editBtn=document.getElementById("editMapButton");
        // Mostra "MODIFICA MAPPA" solo per mappe crafter vere (custom E con un id DB valido o avviate dal crafter)
        const isRealCustom = (window.isCustomMap && (window.customMapDbId || mappaCorrente === 'crafter' || String(mappaCorrente).startsWith('db_')));
        if (editBtn) editBtn.style.display = isRealCustom ? "" : "none";
        document.getElementById("playButton").style.display="none";
        const mb=document.getElementById('menuButton'); if (mb) mb.style.display='none';
    }
    draw = function() {
        let deltaCY=0,deltaGY=0,deltaLY=0;
        let deltaGX=this.guyImageCrop[4],deltaLX=this.ladyImageCrop[4];
        let lCX=this.carImageCrop[0],lGX=this.guyImageCrop[0],lLX=this.ladyImageCrop[0];
        let rCX=this.carImageCrop[1],rGX=this.guyImageCrop[1],rLX=this.ladyImageCrop[1];
        let tCY=this.carImageCrop[2],tGY=this.guyImageCrop[2],tLY=this.ladyImageCrop[2];
        let hC=this.carImageCrop[3],hG=this.guyImageCrop[3],hL=this.ladyImageCrop[3];
        let wC=rCX-lCX,wG=rGX-lGX,wL=rLX-lLX;
        deltaCY=this.hasCollided?this.carImageCrop[4]:0;
        deltaGY=this.hasCollided?this.guyImageCrop[5]:0;
        deltaLY=this.hasCollided?this.ladyImageCrop[5]:0;
        const S=2.5;
        canvas2D.drawImage(this.img,lCX,tCY,wC,hC,(canvas.width-wC*S)/2,canvas.height-hC*S-deltaCY,wC*S,hC*S);
        if (this.hasCollided) {
            canvas2D.drawImage(this.img,lGX,tGY,wG,hG,(canvas.width-wC*S)/2+deltaGX,canvas.height-hG*S-deltaGY,wG*S,hG*S);
            canvas2D.drawImage(this.img,lLX,tLY,wL,hL,(canvas.width-wC*S)/2-deltaLX,canvas.height-hL*S-deltaLY,wL*S,hL*S);
        }
    }
}

function gameLoop(myCamera, myCircuit, myBackground, myFerrari) {
    try {
        myBackground.cleanAll();
        myCircuit.updateSpritesPosition();
        myFerrari.updatePosition(myCamera,myCircuit.length,myCircuit.segments,myCircuit.segL);
        let seg=myCircuit.segments[myFerrari.segmentPos];
        myBackground.updatePoV(seg.curve,myFerrari.speed);
        myCircuit.drawVisibleSegments(seg.z3d,myFerrari.posX,myCamera.camD,myCamera.camH);
        myCircuit.drawVisibleSprites(seg.z3d,myCamera.camD,myFerrari.hasCollided);
        if (!myFerrari.hasCollided) myFerrari.checkForCollision(myCircuit);
        myFerrari.draw();
        drawTach(myFerrari.speed);
    } catch(e) { console.error("❌ ERRORE game loop:",e); }
}

keyDown = function(event) {
    if (!myFerrari) return;
    switch (event.key) {
        case "ArrowDown":  myFerrari.speed-=100; if(myFerrari.speed<=-300)myFerrari.speed=-300; break;
        case "ArrowUp":    myFerrari.speed+=100; if(myFerrari.speed>=500)myFerrari.speed=500; break;
        case "ArrowLeft":  myFerrari.carImageCrop=[143,233,251,32]; myFerrari.posX-=200; if(myFerrari.posX<=-5*myCircuit.roadW)myFerrari.posX=-5*myCircuit.roadW; break;
        case "ArrowRight": myFerrari.carImageCrop=[7,97,171,32];    myFerrari.posX+=200; if(myFerrari.posX>=5*myCircuit.roadW)myFerrari.posX=5*myCircuit.roadW; break;
        default: myFerrari.carImageCrop=[7,64,132,32]; return;
    }
}
keyUp = function(event) { if (!myFerrari) return; myFerrari.carImageCrop=[7,64,132,32]; }

function avviaGioco(idMappa) {
    // Guard: se idMappa e null/undefined torna alla selezione
    if (!idMappa) {
        console.warn('avviaGioco: idMappa null — torno alla selezione.');
        if (typeof tornaSelezioneMappe === 'function') tornaSelezioneMappe();
        return;
    }
    // Se la mappa non esiste in MAPPE usa fallback montagna invece di crashare
    if (!MAPPE[idMappa]) {
        console.warn('avviaGioco: mappa non trovata in MAPPE — uso fallback montagna.');
        MAPPE[idMappa] = Object.assign({}, MAPPE.montagna, { nome: String(idMappa) });
    }
    mappaCorrente=idMappa;
    ['gameOverMessage','fineGaraMessage'].forEach(id=>document.getElementById(id).style.display='none');
    const mb=document.getElementById('menuButton'); if(mb) mb.style.display='inline-block';
    const bCB=document.getElementById("backToCrafterButton"); if(bCB&&!window.isCustomMap) bCB.style.display="none";
    document.getElementById("playButton").style.display="none";
    document.getElementById("dashboard").style.display="block";
    // Feature #7: nascondi tutti i pulsanti auth durante il gameplay
    if(typeof aggiornaVisibilitaAuthBar==='function') aggiornaVisibilitaAuthBar();
    if (!canvas2D) {
        canvas=document.getElementById("gameCanvas");
        if (!canvas){console.error("CANVAS NON TROVATO!");return;}
        canvas2D=canvas.getContext("2d"); canvas.width=canvas.offsetWidth; canvas.height=canvas.offsetHeight;
    }
    const mappa=MAPPE[idMappa];
    const circuitLength = (mappa && mappa.length) ? mappa.length : 1600;
    myCamera=new Camera(); myCircuit=new Circuit(circuitLength,idMappa);
    myBackground=new Background(mappa.immagine,mappa.coloreSfondo); myFerrari=new PlayerCar();
    if (gameLoopInterval) clearInterval(gameLoopInterval);
    gameLoopInterval=setInterval(gameLoop,gameFrameRate,myCamera,myCircuit,myBackground,myFerrari);
    gameLoop(myCamera,myCircuit,myBackground,myFerrari);
    avviaTimer();
}

function rigiocaMappa() {
    if (!mappaCorrente) return;
    ['gameOverMessage','fineGaraMessage'].forEach(id=>document.getElementById(id).style.display='none');
    const mb=document.getElementById('menuButton'); if(mb) mb.style.display='inline-block';
    avviaGioco(mappaCorrente);
}

function tornaSelezioneMappe() {
    if (gameLoopInterval){clearInterval(gameLoopInterval);gameLoopInterval=null;}
    myCamera=null;myCircuit=null;myBackground=null;myFerrari=null;
    if (canvas2D) canvas2D.clearRect(0,0,canvas.width,canvas.height);
    document.addEventListener('keydown',keyDown); document.addEventListener('keyup',keyUp);
    ['gamecenter','gameOverMessage','fineGaraMessage'].forEach(id=>document.getElementById(id).style.display='none');
    document.getElementById("playButton").style.display="none";
    try{if(radioPlayer&&!radioPlayer.paused)radioPlayer.pause();}catch(e){}
    document.getElementById("selezioneMappeScreen").style.display="flex";
    // Feature #7: ripristina auth bar quando si esce dal gioco
    if(typeof aggiornaVisibilitaAuthBar==='function') aggiornaVisibilitaAuthBar();
}

function tornaAlCrafter() {
    if (!window.isCustomMap){alert("Questa funzione è disponibile solo per mappe personalizzate!");return;}
    if (gameLoopInterval){clearInterval(gameLoopInterval);gameLoopInterval=null;}
    myCamera=null;myCircuit=null;myBackground=null;myFerrari=null;
    if (canvas2D) canvas2D.clearRect(0,0,canvas.width,canvas.height);
    document.addEventListener('keydown',keyDown); document.addEventListener('keyup',keyUp);
    ['gamecenter','gameOverMessage','fineGaraMessage'].forEach(id=>document.getElementById(id).style.display='none');
    document.getElementById("playButton").style.display="none";
    try{if(radioPlayer&&!radioPlayer.paused)radioPlayer.pause();}catch(e){}
    // Apri il nuovo Crafter se disponibile, altrimenti il vecchio
    if (window.CrafterAPI) {
        window.CrafterAPI.show();
    } else {
        document.getElementById("selezioneMappeScreen").style.display="none";
        document.getElementById("crafterScreen").style.display="flex";
        if (window.mapCrafterInstance) window.mapCrafterInstance.drawPreview();
    }
}

function resetGiocoCompleto() {
    if (gameLoopInterval){clearInterval(gameLoopInterval);gameLoopInterval=null;}
    myCamera=null;myCircuit=null;myBackground=null;myFerrari=null;
    window._fineGaraVisibile = false;
    if (canvas&&canvas2D) canvas2D.clearRect(0,0,canvas.width,canvas.height);
    ['dashboard','gameOverMessage','fineGaraMessage'].forEach(id=>document.getElementById(id).style.display='none');
    const mb=document.getElementById('menuButton'); if(mb) mb.style.display='inline-block';
    document.getElementById("playButton").style.display="block";
    document.addEventListener('keydown',keyDown); document.addEventListener('keyup',keyUp);
}
// ========== CONTROLLI GIROSCOPIO MOBILE ==========
(function () {
    'use strict';

    if (!('ontouchstart' in window) && navigator.maxTouchPoints === 0) return;

    var SOGLIA       = 2;    // gradi minimi — reagisce subito
    var SENSIBILITA  = 15;   // gradi per sterzo massimo (prima era 40)
    var VELOCITA     = 300;
    var gyroAttivo   = false;
    var gammaCorrente = 0;

    // ── Indicatore visivo debug ──
    var dbg = document.createElement('div');
    dbg.style.cssText = 'position:fixed;top:40px;left:8px;z-index:999999;background:rgba(0,0,0,0.75);color:#0ff;font-family:monospace;font-size:12px;padding:5px 8px;border-radius:6px;pointer-events:none;display:none;';
    document.body.appendChild(dbg);

    // ── Bottone permesso iOS ──
    var btnGyro = document.createElement('button');
    btnGyro.textContent = '🎮 Attiva Giroscopio';
    btnGyro.style.cssText = [
        'position:fixed','bottom:20px','left:50%','transform:translateX(-50%)',
        'z-index:999999','background:linear-gradient(135deg,#ffcc00,#ff9900)',
        'color:#000','font-family:Orbitron,monospace','font-size:0.85em',
        'font-weight:700','letter-spacing:2px','border:none','border-radius:30px',
        'padding:14px 28px','cursor:pointer','display:none',
        'box-shadow:0 4px 20px rgba(0,0,0,0.5)'
    ].join(';');
    document.body.appendChild(btnGyro);

    function onGyro(e) {
        var gamma = e.gamma !== null ? e.gamma : 0;
        gammaCorrente = gamma;
        dbg.style.display = 'block';
        dbg.innerHTML = 'γ:' + Math.round(gamma);
    }

    setInterval(function() {
        if (!gyroAttivo) return;
        if (typeof myFerrari === 'undefined' || !myFerrari) return;
        if (myFerrari.hasCollided) return;
        if (typeof myCircuit === 'undefined' || !myCircuit) return;

        myFerrari.speed = VELOCITA;

        if (Math.abs(gammaCorrente) > SOGLIA) {
            // Intensità proporzionale: da SOGLIA a SENSIBILITA = 0 a 1
            var intensita = Math.min(Math.abs(gammaCorrente) / SENSIBILITA, 1);
            var spostamento = Math.round(400 * intensita); // max 400 per step

            if (gammaCorrente < 0) {
                myFerrari.carImageCrop = [143, 233, 251, 32];
                myFerrari.posX -= spostamento;
                if (myFerrari.posX < -5 * myCircuit.roadW) myFerrari.posX = -5 * myCircuit.roadW;
            } else {
                myFerrari.carImageCrop = [7, 97, 171, 32];
                myFerrari.posX += spostamento;
                if (myFerrari.posX > 5 * myCircuit.roadW) myFerrari.posX = 5 * myCircuit.roadW;
            }
        } else {
            myFerrari.carImageCrop = [7, 64, 132, 32];
        }

    }, 50);

    function avviaGyro() {
        if (gyroAttivo) return;
        gyroAttivo = true;
        btnGyro.style.display = 'none';

        if (typeof DeviceOrientationEvent !== 'undefined' &&
            typeof DeviceOrientationEvent.requestPermission === 'function') {
            DeviceOrientationEvent.requestPermission()
                .then(function(r) {
                    if (r === 'granted') {
                        window.addEventListener('deviceorientation', onGyro, true);
                        dbg.style.display = 'block';
                        dbg.textContent = '✅ Gyro attivo';
                    } else {
                        gyroAttivo = false;
                        btnGyro.style.display = 'block';
                        dbg.textContent = '❌ Permesso negato';
                        dbg.style.display = 'block';
                    }
                }).catch(function() { gyroAttivo = false; btnGyro.style.display = 'block'; });
        } else {
            window.addEventListener('deviceorientation', onGyro, true);
            dbg.style.display = 'block';
            dbg.textContent = '✅ Gyro attivo';
        }
    }

    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function') {
        btnGyro.style.display = 'block';
        btnGyro.addEventListener('click', avviaGyro);
    } else {
        document.addEventListener('touchstart', function() { avviaGyro(); }, { once: true });
    }

})();