// ========== mainj.js ==========

// ========== VARIABILI GLOBALI UI ==========
let tachCanvas, tachCtx;
let radioPlayer, songName;
let currentSong = 0;
const songs = [
    { file: "Ricchi E Poveri - Sara Perche Ti Amo (Testo Lyrics)(mp3j.cc).mp3", title: "Sarà perché ti amo" },
    { file: "Loretta Goggi - Maledetta primavera (testo)(mp3j.cc).mp3",          title: "Maledetta primavera" },
    { file: "ABBA - Mamma Mia (Official Music Video)(mp3j.cc).mp3",               title: "Mamma mia" }
];

// ========== STATO AUTH ==========
window._utenteLoggato = false;

// ========== GESTIONE REDIRECT POST-AUTH (Feature #1) ==========
// Salva la pagina/azione di origine prima del login
window._pendingRedirectAction = null; // 'crafter' | null

function salvaRedirectAction(action) {
    window._pendingRedirectAction = action;
}

function eseguiRedirectPostAuth() {
    const action = window._pendingRedirectAction;
    window._pendingRedirectAction = null;
    if (action === 'crafter') {
        chiudiAuthModal();
        // Apri crafter dopo autenticazione
        setTimeout(() => {
            const selScreen = document.getElementById("selezioneMappeScreen");
            if (selScreen) selScreen.style.display = "none";
            if (window.CrafterAPI) {
                window.CrafterAPI.show();
            } else {
                const cs = document.getElementById("crafterScreen");
                if (cs) cs.style.display = "flex";
            }
            if (typeof avviaCrafterAnimations === 'function') avviaCrafterAnimations();
        }, 200);
        return;
    }
    // Se c'era un punteggio pendente, siamo probabilmente nella schermata di gioco —
    // chiudi solo il modal e lascia l'utente dov'è (fineGara è già mostrato da salvaPunteggioPendente)
    chiudiAuthModal();
}

// ========== TIMER ==========
let timerInterval = null, timerStartTime = 0, tempoFinaleMs = 0;

function avviaTimer() {
    timerStartTime = Date.now();
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        document.getElementById('dashboard').innerText = '⏱ ' + formatTimeMs(Date.now() - timerStartTime);
    }, 100);
}

function fermaTimer() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    tempoFinaleMs = Date.now() - timerStartTime;
    return tempoFinaleMs;
}

function formatTimeMs(ms) {
    const m=Math.floor(ms/60000), s=Math.floor((ms%60000)/1000), ml=ms%1000;
    return String(m).padStart(2,'0')+':'+String(s).padStart(2,'0')+'.'+String(ml).padStart(3,'0');
}

// ========== SALVA SCORE ==========
// Feature #8: salva score con eventuale punteggio pendente per ospiti
window._pendingScore = null; // { idCircuito, tempoMs }

async function salvaScore(idCircuito, tempoMs) {
    if (!window._utenteLoggato) {
        // Ospite: salva come pendente (con idCircuito valido) e mostra popup
        if (idCircuito) {
            const customMap = !!(window.isCustomMap && window.customMapDbId && String(idCircuito) === String(window.customMapDbId));
            window._pendingScore = { idCircuito, tempoMs, customMap };
        }
        mostraOspiteScorePopup(tempoMs);
        return null;
    }
    return await _inviaScoreAlServer(idCircuito, tempoMs);
}

async function _inviaScoreAlServer(idCircuito, tempoMs, customMapOverride) {
    try {
        // Feature #5: incrementa contatori gare locali
        const nakKey = sessionStorage.getItem('nakName') || 'guest';
        const gareTotKey  = 'gare_totali_' + nakKey;
        const mappeKey    = 'mappe_giocate_' + nakKey;
        localStorage.setItem(gareTotKey, (parseInt(localStorage.getItem(gareTotKey) || '0') + 1).toString());
        // Mappe uniche: usa un Set serializzato
        const mappeGiocate = new Set(JSON.parse(localStorage.getItem(mappeKey) || '[]'));
        mappeGiocate.add(String(idCircuito));
        localStorage.setItem(mappeKey, JSON.stringify([...mappeGiocate]));
        localStorage.setItem('mappe_uniche_' + nakKey, mappeGiocate.size.toString());

        const params = new URLSearchParams();
        params.append('idCircuito', idCircuito);
        params.append('tempoMs', tempoMs);
        // customMapOverride viene passato da salvaPunteggioPendente (ospite→loggato)
        // così il valore viene preservato dal momento della fine gara
        const customMap = (customMapOverride !== undefined)
            ? customMapOverride
            : !!(window.isCustomMap && window.customMapDbId);
        if (customMap) params.append('customMap', 'true');
        const res = await fetch('/Score', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString()
        });
        if (res.status === 401) {
            // Non autenticato (sessione scaduta) — mostra il modal di login
            console.warn('⚠️ Save score: non autenticato (401)');
            if (typeof apriAuthModal === 'function') apriAuthModal('login.html');
            return { ok: false, errore: 'Non autenticato' };
        }
        const data = await res.json();
        console.log('✅ Score salvato:', data);
        if (data && data.ok) {
            // Mostra info d'azione
            if (data.action) console.log('ℹ️ Save action:', data.action);
            // Aggiorna le Top10 in tutte le viste (profilo, modali, crafter)
            if (typeof caricaTuttiTop10 === 'function') setTimeout(caricaTuttiTop10, 200);
            // Aggiorna lista mappe custom nel crafter (record personale visibile subito)
            if (typeof loadSavedMapsFromDatabase === 'function') setTimeout(loadSavedMapsFromDatabase, 400);
        }
        return data;
    } catch(e) { console.warn('❌ Errore salvataggio score:', e); }
}

// Feature #8: dopo login/registrazione, salva il punteggio pendente
async function salvaPunteggioPendente() {
    if (!window._pendingScore) return;
    const { idCircuito, tempoMs, customMap } = window._pendingScore;
    window._pendingScore = null;
    if (!idCircuito) return; // senza idCircuito non possiamo salvare
    console.log('💾 Salvataggio punteggio pendente: circuito', idCircuito, 'tempo', tempoMs, 'customMap', customMap);
    await _inviaScoreAlServer(idCircuito, tempoMs, customMap);

    // Chiudi popup ospite se ancora aperto
    chiudiOspitePopup();

    // Mostra il messaggio di fine gara
    const fineGara = document.getElementById("fineGaraMessage");
    if (fineGara) {
        // Aggiorna il display (potrebbe essere già mostrato dalla fine gara)
        const tdEl = document.getElementById("tempoFinaleDisplay");
        const ndEl = document.getElementById("nakNameDisplay");
        if (tdEl) tdEl.textContent = formatTimeMs(tempoMs);
        const nakName = sessionStorage.getItem('nakName') || '';
        if (ndEl) ndEl.textContent = nakName ? '👤 ' + nakName : '';
        fineGara.style.display = 'block';

        // Reinizializza bottone Top10 (potrebbe non avere handler se siamo qui dopo redirect Google)
        window._lastIdCircuito = idCircuito;
        window._lastIsCustomMap = customMap;
        const top10Btn = document.getElementById('visualizzaScoreBtn');
        if (top10Btn) {
            top10Btn.onclick = function() {
                if (typeof mostraTop10Modal === 'function') mostraTop10Modal(idCircuito, customMap);
            };
        }

        // Nascondi "MODIFICA MAPPA" se non è una mappa crafter reale
        const editBtn = document.getElementById('editMapButton');
        if (editBtn) {
            const isRealCustom = customMap && (window.customMapDbId || mappaCorrente === 'crafter' || String(mappaCorrente || '').startsWith('db_'));
            editBtn.style.display = isRealCustom ? '' : 'none';
        }

        // Mostra i bottoni di controllo
        const ctrlDiv = document.getElementById('gameOverControls');
        if (ctrlDiv) ctrlDiv.style.display = 'flex';

        // Feature #5: mostra posizionamento in classifica
        await aggiornaPosizioneFinale(idCircuito);
    }
}

async function aggiornaPosizioneFinale(idCircuito) {
    try {
        const nakName = sessionStorage.getItem('nakName') || '';
        const customMap = window.isCustomMap && window.customMapDbId && String(idCircuito) === String(window.customMapDbId);
        const res = await fetch('/TopScore?idCircuito=' + idCircuito + (customMap ? '&customMap=true' : ''));
        const classifica = await res.json();
        const posMsg = document.getElementById('posizionamentoMessage');
        if (!posMsg || !classifica || !classifica.length) return;
        const mioIdx = classifica.findIndex(r => r.nakName === nakName);
        if (mioIdx >= 0) {
            posMsg.style.display = 'block';
            const pos = mioIdx + 1;
            if (pos === 1) posMsg.textContent = '🥇 Sei in TESTA alla classifica!';
            else if (pos <= 3) posMsg.textContent = `🏆 Sei #${pos} in classifica!`;
            else posMsg.textContent = `📊 Sei #${pos} in classifica`;
        }
    } catch(e) {}
}

// ========== TOP 10 ==========
async function caricaTop10(idCircuito, divId) {
    const container = document.getElementById(divId);
    if (!container) return;
    try {
        const res = await fetch('/TopScore?idCircuito=' + idCircuito);
        const data = await res.json();
        if (!data || data.length === 0) {
            container.innerHTML = '<h4>🏆 TOP 10</h4><p class="nessuno">Nessun record ancora!</p>';
            return;
        }
        let html = '<h4>🏆 TOP 10</h4><ol>';
        data.forEach(r => { html += '<li>' + r.nakName + '<span class="tempo">' + r.tempoFormattato + '</span></li>'; });
        container.innerHTML = html + '</ol>';
    } catch(e) {
        container.innerHTML = '<h4>🏆 TOP 10</h4><p class="nessuno">Errore caricamento</p>';
    }
}

function caricaTuttiTop10() {
    caricaTop10(1,'top10-1'); caricaTop10(2,'top10-2'); caricaTop10(3,'top10-3');
}

function initCrafterTop10() {
    const sel = document.getElementById('crafterTop10Select');
    if (!sel) return;
    caricaTop10(sel.value, 'top10-crafter');
    sel.addEventListener('change', function() { caricaTop10(this.value, 'top10-crafter'); });
}

// ========== TOP 10 MODAL ==========
function mostraTop10MappaDB(mappaDbId, mappaNome) {
    const modal = document.getElementById('top10Modal');
    const content = document.getElementById('top10ModalContent');
    if (!modal || !content) return;
    const titleEl = modal.querySelector('h2');
    if (titleEl) titleEl.textContent = '🏆 TOP 10 - ' + mappaNome;
    modal.style.display = 'flex';
    caricaTop10MappaDB(mappaDbId, content);
}

async function caricaTop10MappaDB(mappaDbId, containerElement) {
    try {
        const res = await fetch('/TopScore?idCircuito=' + mappaDbId + '&customMap=true');
        const data = await res.json();
        if (!data || data.length === 0) {
            containerElement.innerHTML = '<p style="text-align:center;color:#aaa;">Nessun record ancora!</p>';
            return;
        }
        let html = '<ol style="list-style:none;padding:0;margin:0;">';
        data.forEach((r, idx) => {
            html += `<li style="padding:12px;margin:8px 0;background:rgba(255,204,0,0.1);border-radius:8px;display:flex;justify-content:space-between;align-items:center;">
                <span style="font-weight:bold;color:#ffcc00;">#${idx+1}</span>
                <span style="flex:1;margin:0 15px;">${r.nakName}</span>
                <span style="color:#ffcc00;font-weight:bold;">${r.tempoFormattato}</span></li>`;
        });
        containerElement.innerHTML = html + '</ol>';
    } catch(e) {
        containerElement.innerHTML = '<p style="text-align:center;color:#ff6b6b;">Errore caricamento</p>';
    }
}

function mostraTop10Modal(idCircuito, customMap) {
    const nomi = { 1:'MONTAGNA', 2:'CITTÀ', 3:'FORESTA' };
    const modal = document.getElementById('top10Modal');
    const content = document.getElementById('top10ModalContent');
    if (!modal || !content) return;
    const titleEl = modal.querySelector('h2');
    if (titleEl) titleEl.textContent = '🏆 TOP 10 - ' + (customMap ? 'MAPPA PERSONALIZZATA' : (nomi[idCircuito] || 'SCONOSCIUTO'));
    modal.style.display = 'flex';
    caricaTop10PerModal(idCircuito, content, customMap);
}

function chiudiTop10Modal() {
    const modal = document.getElementById('top10Modal');
    if (modal) modal.style.display = 'none';
    // Ripristina fineGaraMessage se la gara è finita
    const fineGara = document.getElementById('fineGaraMessage');
    if (fineGara && window._fineGaraVisibile) {
        fineGara.style.display = 'block';
    }
}

async function caricaTop10PerModal(idCircuito, containerElement, customMap) {
    try {
        const res = await fetch('/TopScore?idCircuito=' + idCircuito + (customMap ? '&customMap=true' : ''), { credentials: 'include' });
        const data = await res.json();
        if (!data || data.length === 0) {
            containerElement.innerHTML = '<p style="text-align:center;color:#aaa;">Nessun record ancora!</p>';
            return;
        }
        let html = '<ol style="list-style:none;padding:0;margin:0;">';
        data.forEach((r, idx) => {
            html += `<li style="padding:12px;margin:8px 0;background:rgba(255,204,0,0.1);border-radius:8px;display:flex;justify-content:space-between;align-items:center;">
                <span style="font-weight:bold;color:#ffcc00;">#${idx+1}</span>
                <span style="flex:1;margin:0 15px;">${r.nakName}</span>
                <span style="color:#ffcc00;font-weight:bold;">${r.tempoFormattato}</span></li>`;
        });
        containerElement.innerHTML = html + '</ol>';
    } catch(e) {
        containerElement.innerHTML = '<p style="text-align:center;color:#ff6b6b;">Errore caricamento</p>';
    }
}

// ========== RADIO ==========
function loadSong() {
    if (!radioPlayer || !songName) return;
    radioPlayer.src = songs[currentSong].file;
    songName.textContent = songs[currentSong].title;
}
function playPause() { if (!radioPlayer) return; radioPlayer.paused ? radioPlayer.play() : radioPlayer.pause(); }
function nextSong() { currentSong=(currentSong+1)%songs.length; loadSong(); if(radioPlayer) radioPlayer.play(); }
function prevSong() { currentSong=(currentSong-1+songs.length)%songs.length; loadSong(); if(radioPlayer) radioPlayer.play(); }

// ========== TACHIMETRO ==========
function drawTach(speed) {
    if (!tachCtx || !tachCanvas) return;
    const w=tachCanvas.width, h=tachCanvas.height, center=w/2, radius=center-8;
    tachCtx.clearRect(0,0,w,h);
    tachCtx.beginPath(); tachCtx.arc(center,center,radius,0.75*Math.PI,0.25*Math.PI,false);
    tachCtx.lineWidth=6; tachCtx.strokeStyle="#444"; tachCtx.stroke();
    tachCtx.lineWidth=1.5; tachCtx.font="10px Arial"; tachCtx.fillStyle="#fff";
    tachCtx.textAlign="center"; tachCtx.textBaseline="middle";
    const maxSpeed=500, numMarks=8;
    for (let i=0;i<=numMarks;i++) {
        const angle=0.75*Math.PI+i*1.5*Math.PI/numMarks;
        const x1=center+Math.cos(angle)*(radius-6), y1=center+Math.sin(angle)*(radius-6);
        const x2=center+Math.cos(angle)*radius,     y2=center+Math.sin(angle)*radius;
        tachCtx.beginPath(); tachCtx.moveTo(x1,y1); tachCtx.lineTo(x2,y2); tachCtx.stroke();
        if (i%2===0) {
            const nx=center+Math.cos(angle)*(radius-18), ny=center+Math.sin(angle)*(radius-18);
            tachCtx.fillText(Math.round(i*maxSpeed/numMarks),nx,ny);
        }
    }
    const angle=0.75*Math.PI+(speed/maxSpeed)*1.5*Math.PI;
    const x=center+Math.cos(angle)*(radius-15), y=center+Math.sin(angle)*(radius-15);
    tachCtx.beginPath(); tachCtx.moveTo(center,center); tachCtx.lineTo(x,y);
    tachCtx.lineWidth=3; tachCtx.strokeStyle="#ff3b3b"; tachCtx.stroke();
    tachCtx.beginPath(); tachCtx.arc(center,center,4,0,2*Math.PI); tachCtx.fillStyle="#ff3b3b"; tachCtx.fill();
    tachCtx.fillStyle="#fff"; tachCtx.font="bold 11px Arial";
    tachCtx.fillText(Math.round(speed*gameFrameRate/36),center,center);
}

// ========== AUTH BAR — Feature #7: nasconde btn durante gameplay ==========
function aggiornaVisibilitaAuthBar() {
    // Feature #7: "in gioco" = gamecenter visibile (display flex/block, non none o stringa vuota)
    const gcEl = document.getElementById('gamecenter');
    const gcDisplay = gcEl ? gcEl.style.display : '';
    const inGioco = gcDisplay === 'flex' || gcDisplay === 'block';
    const authBar = document.getElementById('authBar');
    if (!authBar) return;

    const loginBtn    = document.getElementById('authLoginBtn');
    const registerBtn = document.getElementById('authRegisterBtn');
    const logoutBtn   = document.getElementById('authLogoutBtn');
    const nomeEl      = document.getElementById('authNome');

    if (inGioco) {
        // Feature #7: durante il gioco nascondi login/register/logout
        if (loginBtn)    loginBtn.style.display    = 'none';
        if (registerBtn) registerBtn.style.display = 'none';
        if (logoutBtn)   logoutBtn.style.display   = 'none';
        // Mostra solo il nome se loggato, non cliccabile
        if (nomeEl) {
            nomeEl.style.display       = window._utenteLoggato ? 'inline' : 'none';
            nomeEl.style.pointerEvents = 'none';
        }
    } else {
        // Fuori dal gioco: ripristina visibilità normale
        if (window._utenteLoggato) {
            if (loginBtn)    loginBtn.style.display    = 'none';
            if (registerBtn) registerBtn.style.display = 'none';
            if (logoutBtn)   logoutBtn.style.display   = 'inline-block';
            if (nomeEl)      { nomeEl.style.display = 'inline'; nomeEl.style.pointerEvents = 'auto'; }
        } else {
            if (loginBtn)    loginBtn.style.display    = 'inline-block';
            if (registerBtn) registerBtn.style.display = 'inline-block';
            if (logoutBtn)   logoutBtn.style.display   = 'none';
            if (nomeEl)      { nomeEl.style.display = 'none'; nomeEl.style.pointerEvents = 'auto'; }
        }
    }
}

// ========== INIZIALIZZAZIONE UI ==========
function initUI() {
    tachCanvas = document.getElementById("tachimetro");
    if (tachCanvas) {
        tachCtx = tachCanvas.getContext("2d");
        tachCanvas.width = 120; tachCanvas.height = 120;
    }
    radioPlayer = document.getElementById("radioPlayer");
    songName    = document.getElementById("songName");
    if (radioPlayer && songName) loadSong();
}

// ========== VARIABILE CRAFTER ==========
let crafterInstance;

function aggiornaAuthBar(loggedIn, nakName) {
    window._utenteLoggato = loggedIn;
    const nome     = document.getElementById('authNome');
    const btnLogin = document.getElementById('authLoginBtn');
    const btnReg   = document.getElementById('authRegisterBtn');
    const btnOut   = document.getElementById('authLogoutBtn');
    const lockBadge = document.getElementById('crafterLockBadge');
    if (lockBadge) lockBadge.style.display = loggedIn ? 'none' : 'block';
    if (!nome) { aggiornaVisibilitaAuthBar(); return; }
    if (loggedIn) {
        nome.textContent = '👤 ' + nakName;
        nome.style.display = 'inline';
        if (btnLogin) btnLogin.style.display = 'none';
        if (btnReg)   btnReg.style.display   = 'none';
        if (btnOut)   btnOut.style.display   = 'inline-block';
        // Feature #2/#6: il profilo è cliccabile solo su GIOCO.html
        if (typeof apriProfilo === 'function') {
            nome.style.cursor = 'pointer';
            nome.title = 'Visualizza profilo';
            nome.onclick = apriProfilo;
        }
        // Aggiorna il nome con avatar se la funzione è disponibile (GIOCO.html)
        if (typeof aggiornaNomeBarraAuth === 'function') setTimeout(aggiornaNomeBarraAuth, 50);
    } else {
        nome.style.display = 'none';
        nome.onclick = null;
        nome.style.cursor = 'default';
        if (btnLogin) btnLogin.style.display = 'inline-block';
        if (btnReg)   btnReg.style.display   = 'inline-block';
        if (btnOut)   btnOut.style.display   = 'none';
    }
    aggiornaVisibilitaAuthBar();
}

// ===== AUTH MODAL =====
function apriAuthModal(tipo, redirectAction) {
    const modal = document.getElementById('authModal');
    if (!modal) {
        // Siamo in una pagina senza modale (es. index.html) — vai alla pagina dedicata
        const currentPage = window.location.pathname.split('/').pop() || 'GIOCO.html';
        window.location.href = (tipo === 'register' || tipo === 'register.html')
            ? 'register.html?redirect=' + encodeURIComponent(currentPage)
            : 'login.html?redirect=' + encodeURIComponent(currentPage);
        return;
    }
    // Feature #1: salva azione di redirect se fornita
    if (redirectAction) salvaRedirectAction(redirectAction);
    modal.classList.add('open');
    switchAuthModal(tipo);
}
function chiudiAuthModal() {
    const modal = document.getElementById('authModal');
    if (modal) modal.classList.remove('open');
}
function switchAuthModal(tipo) {
    var isLogin = (tipo === 'login' || tipo === 'login.html');
    var titleEl = document.getElementById('authModalTitle');
    if (titleEl) titleEl.textContent = isLogin ? 'Accedi' : 'Registrati';
    document.getElementById('authLoginForm').style.display    = isLogin ? 'block' : 'none';
    document.getElementById('authRegisterForm').style.display = isLogin ? 'none'  : 'block';
    var errEl = document.getElementById('authErrore');
    var regEl = document.getElementById('regErrore');
    if (errEl) errEl.textContent = '';
    if (regEl) regEl.textContent = '';
}

async function eseguiLogin() {
    const email    = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value.trim();
    const errEl    = document.getElementById('authErrore');
    if (!email || !password) { errEl.textContent = 'Inserisci email e password'; return; }
    errEl.textContent = '';
    try {
        const res  = await fetch('/Login', {
            method: 'POST', credentials: 'include',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: 'email=' + encodeURIComponent(email) + '&password=' + encodeURIComponent(password)
        });
        const data = await res.json();
        if (data.ok) {
            sessionStorage.setItem('nakName', data.nakName);
            // Feature #5: aggiorna statistiche gare dopo login
            aggiornaAuthBar(true, data.nakName);
            // Feature #8: salva punteggio pendente se presente
            await salvaPunteggioPendente();
            // Feature #1: esegui redirect post-auth
            eseguiRedirectPostAuth();
        } else {
            errEl.textContent = data.errore || 'Errore login';
        }
    } catch(e) { errEl.textContent = 'Errore di connessione'; }
}

async function eseguiRegistrazione() {
    const nome      = document.getElementById('regNome').value.trim();
    const email     = document.getElementById('regEmail').value.trim();
    const password  = document.getElementById('regPassword').value.trim();
    const pass2     = document.getElementById('regPassword2') ? document.getElementById('regPassword2').value.trim() : password;
    const domanda1  = document.getElementById('regDomanda1') ? document.getElementById('regDomanda1').value : '';
    const risposta1 = document.getElementById('regRisposta1') ? document.getElementById('regRisposta1').value.trim() : '';
    const domanda2  = document.getElementById('regDomanda2') ? document.getElementById('regDomanda2').value : '';
    const risposta2 = document.getElementById('regRisposta2') ? document.getElementById('regRisposta2').value.trim() : '';
    const errEl     = document.getElementById('regErrore');
    if (!nome || !email || !password) { errEl.textContent = 'Compila tutti i campi'; return; }
    if (password !== pass2) { errEl.textContent = 'Le password non coincidono'; return; }
    errEl.textContent = '';
    const haDomanda1 = domanda1 && risposta1;
    const haDomanda2 = domanda2 && risposta2;
    if ((haDomanda1 && !haDomanda2) || (!haDomanda1 && haDomanda2)) { errEl.textContent = 'Compila entrambe le domande di sicurezza (o lascia entrambe vuote).'; return; }
    if (haDomanda1 && risposta1.includes(' ')) { errEl.textContent = 'La risposta 1 deve essere una sola parola.'; return; }
    if (haDomanda2 && risposta2.includes(' ')) { errEl.textContent = 'La risposta 2 deve essere una sola parola.'; return; }
    if (haDomanda1 && haDomanda2 && domanda1 === domanda2) { errEl.textContent = 'Scegli due domande diverse.'; return; }
    try {
        const params = new URLSearchParams();
        params.append('nak_name', nome);
        params.append('email', email);
        params.append('password', password);
        if (haDomanda1 && haDomanda2) {
            params.append('domanda1', domanda1);
            params.append('risposta1', risposta1);
            params.append('domanda2', domanda2);
            params.append('risposta2', risposta2);
        }
        const res  = await fetch('/Register', {
            method: 'POST', credentials: 'include',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString()
        });
        const data = await res.json();
        if (data.ok) {
            sessionStorage.setItem('nakName', nome);
            aggiornaAuthBar(true, nome);
            // Feature #8: salva punteggio pendente se presente
            await salvaPunteggioPendente();
            // Feature #1: esegui redirect post-auth
            eseguiRedirectPostAuth();
        } else {
            errEl.textContent = data.errore || 'Errore registrazione';
        }
    } catch(e) { errEl.textContent = 'Errore di connessione'; }
}

// Feature #6: logout chiude profilo + redirect a splash
async function eseguiLogout() {
    // Feature #3: se nel Crafter, chiedi conferma
    const crafterAperto = window.CrafterAPI && document.getElementById('gkCrafter') &&
                          document.getElementById('gkCrafter').classList.contains('on');
    if (crafterAperto) {
        const conferma = confirm('Se esci, tutte le modifiche non salvate verranno perse. Vuoi continuare?');
        if (!conferma) return; // Feature #3: annulla — rimane nel Crafter
        // Chiudi crafter prima del logout
        if (window.CrafterAPI) window.CrafterAPI.hide();
    }

    await fetch('/Logout', { method: 'POST', credentials: 'include' });
    sessionStorage.removeItem('nakName');
    window._utenteLoggato = false;
    window._pendingScore = null;
    window._pendingRedirectAction = null;

    // Feature #6: nascondi profilo immediatamente (solo su GIOCO.html)
    if (typeof chiudiProfilo === 'function') chiudiProfilo();

    aggiornaAuthBar(false, '');

    // Feature #6: torna alla schermata iniziale
    document.getElementById('gamecenter') && (document.getElementById('gamecenter').style.display = 'none');
    document.getElementById('selezioneMappeScreen') && (document.getElementById('selezioneMappeScreen').style.display = 'none');
    const crafterScreen = document.getElementById('gkCrafter');
    if (crafterScreen) crafterScreen.classList.remove('on');

    const splash = document.getElementById('splashScreen');
    if (splash) {
        splash.style.display = 'flex';
        avviaSplashAnimations();
    }
}

// ===== POPUP OSPITE =====
function mostraOspiteScorePopup(tempo) {
    const popup = document.getElementById('ospiteScorePopup');
    const tempoEl = document.getElementById('ospiteTempoDisplay');
    if (!popup) return;
    if (tempoEl) tempoEl.textContent = formatTimeMs(tempo);
    // Aggiorna i bottoni per aprire modal e chiudere popup
    const btnAccedi = popup.querySelector('.btn-accedi-score');
    const btnRegistrati = popup.querySelector('.btn-registrati-score');
    if (btnAccedi) {
        btnAccedi.onclick = function() {
            chiudiOspitePopup();
            apriAuthModal('login.html');
        };
    }
    if (btnRegistrati) {
        btnRegistrati.onclick = function() {
            chiudiOspitePopup();
            apriAuthModal('register.html');
        };
    }
    popup.classList.add('open');
    window._fineGaraVisibile = true;
}
function chiudiOspitePopup() {
    const popup = document.getElementById('ospiteScorePopup');
    if (popup) popup.classList.remove('open');
    const fineGara = document.getElementById('fineGaraMessage');
    if (fineGara && window._fineGaraVisibile) {
        fineGara.style.display = 'block';
        const ctrlDiv = document.getElementById('gameOverControls');
        if (ctrlDiv) ctrlDiv.style.display = 'flex';
    }
}

function mostraOspiteCrafterPopup(tempo) {
    document.getElementById("tempoFinaleDisplay").textContent = formatTimeMs(tempo);
    document.getElementById("nakNameDisplay").textContent = '';
    const fineGara = document.getElementById("fineGaraMessage");
    if (fineGara) {
        const prev = document.getElementById('crafterGuestBanner');
        if (prev) prev.remove();
        const banner = document.createElement('div');
        banner.id = 'crafterGuestBanner';
        banner.style.cssText = 'margin:14px 0 0;padding:14px 16px;background:rgba(255,204,0,0.08);border:1px solid rgba(255,204,0,0.4);border-radius:8px;text-align:center;';
        banner.innerHTML = `
            <div style="color:#ffcc00;font-size:0.9em;font-weight:700;margin-bottom:10px;">
                💾 Accedi per salvare la mappa e il tuo tempo!
            </div>
            <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">
                <button onclick="chiudiCrafterGuestBanner();apriAuthModal('login.html')"
                    style="padding:8px 18px;background:linear-gradient(135deg,#ffcc00,#ff9900);color:#000;border:none;border-radius:20px;font-weight:700;cursor:pointer;font-size:0.85em;">
                    🔑 Accedi
                </button>
                <button onclick="chiudiCrafterGuestBanner();apriAuthModal('register.html')"
                    style="padding:8px 18px;background:transparent;border:1px solid #ffcc00;color:#ffcc00;border-radius:20px;font-weight:700;cursor:pointer;font-size:0.85em;">
                    📝 Registrati
                </button>
                <button onclick="chiudiCrafterGuestBanner()"
                    style="padding:8px 18px;background:transparent;border:1px solid #555;color:#aaa;border-radius:20px;cursor:pointer;font-size:0.85em;">
                    Continua senza salvare
                </button>
            </div>`;
        fineGara.appendChild(banner);
        fineGara.style.display = 'block';
    }
}
function chiudiCrafterGuestBanner() {
    const b = document.getElementById('crafterGuestBanner');
    if (b) b.remove();
}

// ===== WINDOW.SELEZIONAMAPPA =====
window.selezionaMappa = function(idMappa) {
    mappaCorrente = idMappa;
    window.isCustomMap = (idMappa === "crafter" || String(idMappa).startsWith("db_"));
    // Reset idCircuitoCorrente per evitare che il valore precedente (es. "montagna")
    // venga usato come fallback quando si gioca una mappa personalizzata.
    if (window.isCustomMap) window.idCircuitoCorrente = null;
    resetGiocoCompleto();
    document.getElementById("selezioneMappeScreen").style.display = "none";
    document.getElementById("gamecenter").style.display = "flex";
    document.getElementById("dashboard").style.display = "none";
    aggiornaVisibilitaAuthBar(); // Feature #7
    const gc = document.getElementById("gameCanvas");
    if (!gc) return;
    canvas = gc; canvas2D = canvas.getContext("2d");
    canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight;
    avviaGioco(idMappa);
};

document.addEventListener('DOMContentLoaded', function() {
    initUI();

    // Controlla se bisogna ripristinare lo stato del gioco dopo il redirect Google OAuth
    const _needRestoreGame = !!sessionStorage.getItem('_googleRedirectRestoreGame');

    fetch('/Session', { credentials: 'include' })
        .then(r => r.json())
        .then(async data => {
            if (data.loggedIn) {
                sessionStorage.setItem('nakName', data.nakName);
                aggiornaAuthBar(true, data.nakName);

                // Ripristina stato gioco dopo redirect Google OAuth
                if (_needRestoreGame) {
                    sessionStorage.removeItem('_googleRedirectRestoreGame');
                    // Ripristina variabili di circuito
                    const savedCircuito = sessionStorage.getItem('_googleRedirectCircuito');
                    if (savedCircuito) { window.idCircuitoCorrente = parseInt(savedCircuito); sessionStorage.removeItem('_googleRedirectCircuito'); }
                    if (sessionStorage.getItem('_googleRedirectCustomMap')) { window.isCustomMap = true; sessionStorage.removeItem('_googleRedirectCustomMap'); }
                    const savedCustomId = sessionStorage.getItem('_googleRedirectCustomMapId');
                    if (savedCustomId) { window.customMapDbId = parseInt(savedCustomId); sessionStorage.removeItem('_googleRedirectCustomMapId'); }
                    // Ripristina mappaCorrente — senza di essa "Rigioca" crasherebbe
                    const savedMappa = sessionStorage.getItem('_googleRedirectMappa');
                    if (savedMappa) { mappaCorrente = savedMappa; sessionStorage.removeItem('_googleRedirectMappa'); }
                    // Mostra gamecenter (la pagina torna al gioco, non alla splash)
                    const gcEl = document.getElementById('gamecenter');
                    const splashEl = document.getElementById('splashScreen');
                    const selEl = document.getElementById('selezioneMappeScreen');
                    if (splashEl) splashEl.style.display = 'none';
                    if (selEl) selEl.style.display = 'none';
                    if (gcEl) { gcEl.style.display = 'flex'; aggiornaVisibilitaAuthBar(); }
                    // Nascondi playButton (la gara è già finita)
                    const pbEl = document.getElementById('playButton');
                    if (pbEl) pbEl.style.display = 'none';
                }

                // Ripristina schermata corrente dopo redirect Google OAuth (selezione mappe / crafter)
                const _savedScreen = sessionStorage.getItem('_googleRedirectRestoreScreen');
                if (_savedScreen) {
                    sessionStorage.removeItem('_googleRedirectRestoreScreen');
                    const splashEl2 = document.getElementById('splashScreen');
                    if (splashEl2) splashEl2.style.display = 'none';
                    if (_savedScreen === 'selezione') {
                        const selEl2 = document.getElementById('selezioneMappeScreen');
                        if (selEl2) {
                            selEl2.style.display = 'flex';
                            if (typeof caricaTuttiTop10 === 'function') setTimeout(caricaTuttiTop10, 300);
                            if (typeof avviaSelezioneAnimations === 'function') setTimeout(avviaSelezioneAnimations, 50);
                            aggiornaVisibilitaAuthBar();
                        }
                    } else if (_savedScreen === 'crafter') {
                        if (window.CrafterAPI) {
                            window.CrafterAPI.show();
                        } else {
                            const crafterEl = document.getElementById('crafterScreen');
                            if (crafterEl) crafterEl.style.display = 'flex';
                        }
                        aggiornaVisibilitaAuthBar();
                    }
                }

                // Ripristina punteggio pendente salvato prima del redirect Google
                const pendingJson = sessionStorage.getItem('_pendingScoreGoogle');
                if (pendingJson) {
                    sessionStorage.removeItem('_pendingScoreGoogle');
                    try {
                        window._pendingScore = JSON.parse(pendingJson);
                        console.log('🔄 Punteggio pendente ripristinato dopo Google login:', window._pendingScore);
                        await salvaPunteggioPendente();
                    } catch(e) {
                        console.warn('❌ Errore ripristino punteggio pendente:', e);
                        window._pendingScore = null;
                    }
                }
            } else {
                aggiornaAuthBar(false, '');
                // Pulisci eventuale pending score Google se l'utente non è loggato
                sessionStorage.removeItem('_pendingScoreGoogle');
                sessionStorage.removeItem('_googleRedirectRestoreGame');
                sessionStorage.removeItem('_googleRedirectCircuito');
                sessionStorage.removeItem('_googleRedirectCustomMap');
                sessionStorage.removeItem('_googleRedirectCustomMapId');
                sessionStorage.removeItem('_googleRedirectRestoreScreen');
            }
        })
        .catch(() => aggiornaAuthBar(false, ''))
        .finally(() => {
            if (!_needRestoreGame && !sessionStorage.getItem('_googleRedirectRestoreScreen')) {
                document.getElementById('splashScreen').style.display = 'flex';
                avviaSplashAnimations();
            }
        });

    document.getElementById("startButton").onclick = function() {
        document.getElementById("splashScreen").style.display = "none";
        document.getElementById("selezioneMappeScreen").style.display = "flex";
        document.getElementById("selezioneMappeScreen").style.zIndex = "2000";
        caricaTuttiTop10();
        avviaSelezioneAnimations();
        aggiornaVisibilitaAuthBar();
    };

    document.getElementById("backButton").onclick = function() {
        document.getElementById("selezioneMappeScreen").style.display = "none";
        document.getElementById("splashScreen").style.display = "flex";
        avviaSplashAnimations();
        aggiornaVisibilitaAuthBar();
    };

    const _origTornaSelezione = window.tornaSelezioneMappe;
    window.tornaSelezioneMappe = function() {
        if (typeof _origTornaSelezione === 'function') _origTornaSelezione();
        setTimeout(avviaSelezioneAnimations, 50);
        aggiornaVisibilitaAuthBar();
    };

    initSplashExtras();
    avviaSplashAnimations();
    initSelezioneExtras();
    initCrafterExtras();

    // ===== SELEZIONE MAPPE =====
    document.querySelectorAll('.map-card').forEach(card => {
        if (card.id === "crafterCard") return;
        card.addEventListener('click', function() {
            mappaCorrente = this.getAttribute('data-mappa');
            window.idCircuitoCorrente = parseInt(this.getAttribute('data-idcircuito')) || null;
            window.isCustomMap = false;
            window.customMapDbId = null;
            window.customMapData = null;
            resetGiocoCompleto();
            document.getElementById("selezioneMappeScreen").style.display = "none";
            document.getElementById("gamecenter").style.display = "flex";
            document.getElementById("playButton").style.display = "block";
            document.getElementById("dashboard").style.display = "none";
            aggiornaVisibilitaAuthBar(); // Feature #7
            const gameCanvas = document.getElementById("gameCanvas");
            if (!gameCanvas) return;
            canvas = gameCanvas;
            canvas2D = canvas.getContext("2d");
            canvas.width = canvas.offsetWidth;
            canvas.height = canvas.offsetHeight;
        });
    });

    // ===== CRAFTER — Feature #2: solo utenti autenticati =====
    document.getElementById("crafterCard").addEventListener('click', function() {
        if (!window._utenteLoggato) {
            // Feature #2: mostra modal login con redirect al crafter dopo auth
            apriAuthModal('login.html', 'crafter');
            return;
        }
        document.getElementById("selezioneMappeScreen").style.display = "none";
        if (window.CrafterAPI) {
            window.CrafterAPI.show();
        } else {
            document.getElementById("crafterScreen").style.display = "flex";
        }
        avviaCrafterAnimations();
    });

    // ===== PLAY =====
    document.getElementById("playButton").addEventListener('click', function() {
        if (!mappaCorrente) { alert("Per favore, seleziona prima una mappa!"); return; }
        if (!canvas2D) {
            canvas = document.getElementById("gameCanvas");
            if (!canvas) return;
            canvas2D = canvas.getContext("2d");
            canvas.width = canvas.offsetWidth;
            canvas.height = canvas.offsetHeight;
        }
        const btn = document.getElementById("playButton");
        if (btn) btn.style.display = 'none';
        avviaCountdown(function() {
            if (btn) btn.style.display = 'block';
            avviaGioco(mappaCorrente);
        });
    });

    // ===== CRAFTER BACK EVENT =====
    document.addEventListener('crafterBack', function() {
        document.getElementById("selezioneMappeScreen").style.display = "flex";
        caricaTuttiTop10();
        avviaSelezioneAnimations();
        aggiornaVisibilitaAuthBar();
    });

    // ===== MODAL TOP 10 =====
    const modalTop10 = document.getElementById('top10Modal');
    if (modalTop10) {
        modalTop10.addEventListener('click', function(e) {
            if (e.target === this) chiudiTop10Modal();
        });
    }

}); // ← chiusura DOMContentLoaded

// ===== GAME OVER BUTTONS =====
// In DOMContentLoaded con null-check: evita TypeError se l'elemento non esiste
// (es. su index.html che non ha questi bottoni).
document.addEventListener('DOMContentLoaded', function() {

    const restartBtn = document.getElementById("restartButton");
    if (restartBtn) {
        restartBtn.onclick = function() {
            // Se mappaCorrente non è impostata O non esiste in MAPPE, torna alla selezione
            if (!mappaCorrente || (typeof MAPPE !== 'undefined' && !MAPPE[mappaCorrente])) {
                tornaSelezioneMappe();
                aggiornaVisibilitaAuthBar();
                return;
            }
            const gameOverMsg = document.getElementById("gameOverMessage");
            const fineGara    = document.getElementById("fineGaraMessage");
            if (gameOverMsg) gameOverMsg.style.display = 'none';
            if (fineGara)    fineGara.style.display    = 'none';
            if (typeof resetGiocoCompleto === 'function') resetGiocoCompleto();
            avviaCountdown(function() {
                if (typeof avviaGioco === 'function') avviaGioco(mappaCorrente);
            });
        };
    }

    const changeMapBtn = document.getElementById("changeMapButton");
    if (changeMapBtn) {
        changeMapBtn.onclick = function() {
            tornaSelezioneMappe();
            aggiornaVisibilitaAuthBar();
        };
    }

    const editMapBtn = document.getElementById("editMapButton");
    if (editMapBtn) { editMapBtn.onclick = tornaAlCrafter; }

    const backToCrafterBtn = document.getElementById("backToCrafterButton");
    if (backToCrafterBtn) {
        backToCrafterBtn.onclick = function() {
            document.getElementById("gamecenter").style.display = "none";
            document.getElementById("crafterScreen").style.display = "flex";
            if (window.customMapData && crafterInstance) {
                crafterInstance.currentMapConfig = {...window.customMapData};
                document.getElementById("obstacleDensity").value = crafterInstance.currentMapConfig.obstacleDensity || "normale";
                document.getElementById("roadColor").value       = crafterInstance.currentMapConfig.coloriStrada.road || "#ffffff";
                document.getElementById("rumbleColor").value     = crafterInstance.currentMapConfig.coloriStrada.rumble || "#ffffff";
                document.getElementById("sandColor").value       = crafterInstance.currentMapConfig.coloriStrada.sand || "#ffffff";
                document.getElementById("curveDifficulty").value = crafterInstance.currentMapConfig.curveDifficulty || "normale";
                const me = crafterInstance.currentMapConfig.mapElements || '';
                document.querySelectorAll('input[name="mapElements"]').forEach(r => r.checked = (r.value === me));
                const ao = crafterInstance.currentMapConfig.allowedObstacles || [];
                document.querySelectorAll('input[name="trackObstacle"]').forEach(r => r.checked = ao.includes(r.getAttribute('data-file')));
                crafterInstance.drawPreview();
            }
        };
    }

    const menuBtn = document.getElementById("menuButton");
    if (menuBtn) {
        menuBtn.onclick = function() {
            if (confirm('Sei sicuro di voler tornare al menu? Il gioco corrente verrà chiuso.')) {
                tornaSelezioneMappe();
                setTimeout(caricaTuttiTop10, 300);
                aggiornaVisibilitaAuthBar();
            }
        };
    }

}); // fine GAME OVER BUTTONS

document.addEventListener('keypress', function(event) {
    if (event.key === 'Enter') {
        if (document.getElementById("splashScreen").style.display !== 'none')
            document.getElementById("startButton").click();
        else if (document.getElementById("selezioneMappeScreen").style.display !== 'none')
            document.querySelector('.map-card').click();
    }
});

// ========== SELEZIONE MAPPE ENHANCEMENTS ==========
function initSelezioneExtras() {
    const screen = document.getElementById('selezioneMappeScreen');
    if (!screen) return;
    if (!document.getElementById('selezioneCheckerBottom')) {
        const cb = document.createElement('div');
        cb.id = 'selezioneCheckerBottom';
        screen.appendChild(cb);
    }
    if (!document.getElementById('selezioneBgCanvas')) {
        const cv = document.createElement('canvas');
        cv.id = 'selezioneBgCanvas';
        screen.insertBefore(cv, screen.firstChild);
    }
    if (!document.getElementById('selezioneSub')) {
        const sub = document.createElement('div');
        sub.id = 'selezioneSub';
        const nakName = sessionStorage.getItem('nakName');
        sub.textContent = nakName ? '🏎  ' + nakName.toUpperCase() + '  —  SCEGLI IL TUO CIRCUITO' : 'SCEGLI IL TUO CIRCUITO';
        const title = document.getElementById('selezioneTitle');
        if (title && title.parentNode) title.parentNode.insertBefore(sub, title.nextSibling);
    }
}

let _selezioneAnimFrame = null;
function avviaSelezioneAnimations() {
    const cv = document.getElementById('selezioneBgCanvas');
    if (!cv) return;
    if (_selezioneAnimFrame) { cancelAnimationFrame(_selezioneAnimFrame); _selezioneAnimFrame = null; }
    cv.width  = window.innerWidth;
    cv.height = window.innerHeight;
    const ctx = cv.getContext('2d');
    function mkLine() {
        return { x: Math.random()*cv.width, y: Math.random()*cv.height, len: 40+Math.random()*140, speed: 8+Math.random()*18, alpha: 0.03+Math.random()*0.09, w: 0.4+Math.random()*1.0, color: Math.random()>0.5?'#00e5ff':'#0077ff' };
    }
    function mkPart() {
        return { x: Math.random()*cv.width, y: cv.height+Math.random()*40, r: 0.6+Math.random()*2.0, vx: (Math.random()-0.5)*0.5, vy: -0.3-Math.random()*0.6, alpha: 0.15+Math.random()*0.5, color: Math.random()>0.5?'#00e5ff':'#0077ff' };
    }
    const lines=Array.from({length:60},mkLine), particles=Array.from({length:30},mkPart);
    function loop() {
        const screen=document.getElementById('selezioneMappeScreen');
        if (!screen||screen.style.display==='none'){_selezioneAnimFrame=null;return;}
        ctx.clearRect(0,0,cv.width,cv.height);
        const bg=ctx.createRadialGradient(cv.width/2,cv.height*0.8,0,cv.width/2,cv.height/2,cv.height);
        bg.addColorStop(0,'rgba(0,50,160,0.2)'); bg.addColorStop(1,'rgba(4,6,14,0)');
        ctx.fillStyle=bg; ctx.fillRect(0,0,cv.width,cv.height);
        lines.forEach(l=>{ ctx.beginPath(); ctx.moveTo(l.x,l.y); ctx.lineTo(l.x-l.len,l.y); ctx.strokeStyle=l.color; ctx.globalAlpha=l.alpha; ctx.lineWidth=l.w; ctx.stroke(); ctx.globalAlpha=1; l.x+=l.speed; if(l.x-l.len>cv.width){l.x=-10;l.y=Math.random()*cv.height;} });
        particles.forEach(p=>{ ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fillStyle=p.color; ctx.globalAlpha=p.alpha; ctx.fill(); ctx.globalAlpha=1; p.x+=p.vx;p.y+=p.vy;p.alpha-=0.0025; if(p.alpha<=0||p.y<-10){Object.assign(p,mkPart());} });
        _selezioneAnimFrame=requestAnimationFrame(loop);
    }
    loop();
}

// ========== CRAFTER SCREEN ENHANCEMENTS ==========
function initCrafterExtras() {
    const screen = document.getElementById('crafterScreen');
    if (!screen) return;
    if (!document.getElementById('crafterBgCanvas')) {
        const cv = document.createElement('canvas');
        cv.id = 'crafterBgCanvas';
        screen.insertBefore(cv, screen.firstChild);
    }
}

let _crafterAnimFrame = null;
function avviaCrafterAnimations() {
    const cv = document.getElementById('crafterBgCanvas');
    if (!cv) return;
    if (_crafterAnimFrame) { cancelAnimationFrame(_crafterAnimFrame); _crafterAnimFrame = null; }
    cv.width=window.innerWidth; cv.height=window.innerHeight;
    const ctx=cv.getContext('2d');
    let tick=0;
    function mkDot() { const cols=Math.ceil(cv.width/40)+1, rows=Math.ceil(cv.height/40)+1; return {col:Math.floor(Math.random()*cols),row:Math.floor(Math.random()*rows),life:0,maxLife:60+Math.random()*80}; }
    const dots=Array.from({length:12},mkDot);
    function loop() {
        const screen=document.getElementById('crafterScreen');
        if (!screen||screen.style.display==='none'){_crafterAnimFrame=null;return;}
        ctx.clearRect(0,0,cv.width,cv.height); tick++;
        ctx.strokeStyle='rgba(0,119,255,0.045)'; ctx.lineWidth=1;
        for(let x=0;x<cv.width;x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,cv.height);ctx.stroke();}
        for(let y=0;y<cv.height;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(cv.width,y);ctx.stroke();}
        ctx.strokeStyle='rgba(0,229,255,0.018)';
        for(let x=0;x<cv.width;x+=8){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,cv.height);ctx.stroke();}
        for(let y=0;y<cv.height;y+=8){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(cv.width,y);ctx.stroke();}
        dots.forEach(d=>{ d.life++; const progress=d.life/d.maxLife, alpha=progress<0.5?progress*2:(1-progress)*2; ctx.beginPath(); ctx.arc(d.col*40,d.row*40,2+alpha*2,0,Math.PI*2); ctx.fillStyle='#00e5ff'; ctx.globalAlpha=alpha*0.6; ctx.fill(); ctx.globalAlpha=1; if(d.life>=d.maxLife)Object.assign(d,mkDot()); });
        _crafterAnimFrame=requestAnimationFrame(loop);
    }
    loop();
}

// ========== SPLASH ENHANCEMENTS ==========
function initSplashExtras() {
    const splash=document.getElementById('splashScreen'), content=document.getElementById('splashContent');
    if(!splash||!content) return;
    if(!document.getElementById('splashCheckerBottom')){const cb=document.createElement('div');cb.id='splashCheckerBottom';splash.appendChild(cb);}
    if(!document.getElementById('splashBgCanvas')){const cv=document.createElement('canvas');cv.id='splashBgCanvas';splash.insertBefore(cv,splash.firstChild);}
    if(!document.getElementById('splashBadge')){const badge=document.createElement('div');badge.id='splashBadge';badge.textContent='🏁 STAGIONE 2026';content.insertBefore(badge,content.firstChild);}
    if(!document.getElementById('splashSubtitle')){const sub=document.createElement('div');sub.id='splashSubtitle';const title=document.getElementById('splashTitle');if(title&&title.nextSibling)content.insertBefore(sub,title.nextSibling);else content.appendChild(sub);}
    if(!document.getElementById('splashHint')){const hint=document.createElement('div');hint.id='splashHint';hint.textContent='↵ premi invio per iniziare';const btn=document.getElementById('startButton');if(btn&&btn.parentNode)btn.parentNode.insertBefore(hint,btn.nextSibling);}
}

let _splashAnimFrame = null;
function avviaSplashAnimations() {
    const cv=document.getElementById('splashBgCanvas');
    if(!cv) return;
    if(_splashAnimFrame){cancelAnimationFrame(_splashAnimFrame);_splashAnimFrame=null;}
    cv.width=window.innerWidth; cv.height=window.innerHeight;
    const ctx=cv.getContext('2d');
    const W=cv.width, H=cv.height;
    let tick=0;
    function mkLine(){return{x:Math.random()*W,y:Math.random()*H,len:60+Math.random()*200,speed:8+Math.random()*18,alpha:0.03+Math.random()*0.1,w:0.4+Math.random()*1.2,color:Math.random()>0.55?'#00e5ff':'#0077ff'};}
    const lines=Array.from({length:55},mkLine);
    function mkPart(){return{x:Math.random()*W,y:H+5,r:0.8+Math.random()*2.4,vx:(Math.random()-0.5)*0.4,vy:-0.25-Math.random()*0.6,alpha:0.2+Math.random()*0.55,color:Math.random()>0.5?'#00e5ff':'#0077ff'};}
    const particles=Array.from({length:38},mkPart);
    const rings=[{r:0,maxR:Math.max(W,H)*0.7,speed:1.2,alpha:0},{r:Math.max(W,H)*0.23,maxR:Math.max(W,H)*0.7,speed:1.2,alpha:0.4},{r:Math.max(W,H)*0.46,maxR:Math.max(W,H)*0.7,speed:1.2,alpha:0.25}];
    function disegnaAuto(ctx,x,y,scala,alpha){
        ctx.save();ctx.translate(x,y);ctx.scale(scala,scala);ctx.globalAlpha=alpha;
        ctx.beginPath();ctx.moveTo(-60,8);ctx.lineTo(-50,-4);ctx.lineTo(-20,-12);ctx.lineTo(20,-12);ctx.lineTo(48,-4);ctx.lineTo(60,2);ctx.lineTo(60,8);ctx.closePath();ctx.fillStyle='#0a1628';ctx.fill();ctx.strokeStyle='#00e5ff';ctx.lineWidth=1.5;ctx.stroke();
        ctx.beginPath();ctx.moveTo(-10,-12);ctx.lineTo(-4,-22);ctx.lineTo(12,-22);ctx.lineTo(18,-12);ctx.closePath();ctx.fillStyle='rgba(0,180,255,0.15)';ctx.fill();ctx.strokeStyle='#00e5ff';ctx.lineWidth=1;ctx.stroke();
        ctx.beginPath();ctx.moveTo(42,4);ctx.lineTo(68,0);ctx.lineTo(68,8);ctx.lineTo(42,10);ctx.closePath();ctx.fillStyle='#0a1628';ctx.strokeStyle='#0077ff';ctx.lineWidth=1;ctx.fill();ctx.stroke();
        ctx.beginPath();ctx.moveTo(-52,-4);ctx.lineTo(-70,-14);ctx.lineTo(-70,-8);ctx.lineTo(-52,4);ctx.closePath();ctx.fillStyle='#0a1628';ctx.strokeStyle='#00e5ff';ctx.lineWidth=1;ctx.fill();ctx.stroke();
        [[-38,10],[38,10]].forEach(([rx,ry])=>{ctx.beginPath();ctx.ellipse(rx,ry,10,7,0,0,Math.PI*2);ctx.fillStyle='#050d1e';ctx.fill();ctx.strokeStyle='#0077ff';ctx.lineWidth=1.5;ctx.stroke();});
        ctx.beginPath();ctx.moveTo(-40,0);ctx.lineTo(44,0);ctx.strokeStyle='rgba(0,229,255,0.5)';ctx.lineWidth=1;ctx.stroke();
        ctx.globalAlpha=1;ctx.restore();
    }
    const cars=[];
    function mkCar(){const lane=H*(0.25+Math.random()*0.5),fast=Math.random()>0.4;return{x:W+100,y:lane,speed:fast?6+Math.random()*5:3+Math.random()*3,scala:0.9+Math.random()*0.5,alpha:0.18+Math.random()*0.22,trail:[]};}
    cars.push(mkCar());
    let nextCarTick=120+Math.floor(Math.random()*180);
    let gridOffset=0;
    function disegnaGriglia(){
        const vx=W/2,vy=H*0.72,nLineeV=10,nLineeO=14,larghPista=W*0.55;
        ctx.save();ctx.globalAlpha=0.07;ctx.strokeStyle='#00b4ff';ctx.lineWidth=0.8;
        for(let i=0;i<=nLineeV;i++){const t=i/nLineeV,bx=(W/2-larghPista/2)+t*larghPista;ctx.beginPath();ctx.moveTo(bx,H);ctx.lineTo(vx,vy);ctx.stroke();}
        for(let i=0;i<=nLineeO;i++){const rawT=(i/nLineeO+gridOffset)%1,t=rawT*rawT,y2=vy+t*(H-vy),hw=(larghPista/2)*t;ctx.beginPath();ctx.moveTo(vx-hw,y2);ctx.lineTo(vx+hw,y2);ctx.stroke();}
        ctx.restore();
    }
    function loop(){
        const splash=document.getElementById('splashScreen');
        if(!splash||splash.style.display==='none'){_splashAnimFrame=null;return;}
        ctx.clearRect(0,0,W,H);tick++;gridOffset=(gridOffset+0.003)%1;
        const bg=ctx.createRadialGradient(W/2,H,0,W/2,H/2,H);
        bg.addColorStop(0,'rgba(0,50,160,0.28)');bg.addColorStop(1,'rgba(4,6,14,0)');
        ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
        disegnaGriglia();
        rings.forEach(ring=>{ring.r+=ring.speed;if(ring.r>ring.maxR){ring.r=0;ring.alpha=0.45;}ring.alpha=Math.max(0,ring.alpha-0.004);if(ring.alpha<=0)return;ctx.beginPath();ctx.arc(W/2,H/2,ring.r,0,Math.PI*2);ctx.strokeStyle='#00b4ff';ctx.lineWidth=1;ctx.globalAlpha=ring.alpha*0.35;ctx.stroke();ctx.globalAlpha=1;});
        lines.forEach(l=>{const grad=ctx.createLinearGradient(l.x-l.len,l.y,l.x,l.y);grad.addColorStop(0,'transparent');grad.addColorStop(1,l.color);ctx.beginPath();ctx.moveTo(l.x-l.len,l.y);ctx.lineTo(l.x,l.y);ctx.strokeStyle=grad;ctx.globalAlpha=l.alpha;ctx.lineWidth=l.w;ctx.stroke();ctx.globalAlpha=1;l.x+=l.speed;if(l.x-l.len>W){l.x=-10;l.y=Math.random()*H;}});
        particles.forEach(p=>{ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fillStyle=p.color;ctx.globalAlpha=p.alpha;ctx.fill();ctx.globalAlpha=1;p.x+=p.vx;p.y+=p.vy;p.alpha-=0.003;if(p.alpha<=0||p.y<0){Object.assign(p,mkPart());}});
        if(tick>=nextCarTick&&cars.length<3){cars.push(mkCar());nextCarTick=tick+90+Math.floor(Math.random()*150);}
        for(let i=cars.length-1;i>=0;i--){const car=cars[i];car.x-=car.speed;car.trail.push({x:car.x+65*car.scala,y:car.y});if(car.trail.length>28)car.trail.shift();if(car.trail.length>2){ctx.beginPath();ctx.moveTo(car.trail[0].x,car.trail[0].y);for(let t=1;t<car.trail.length;t++)ctx.lineTo(car.trail[t].x,car.trail[t].y);const trGrad=ctx.createLinearGradient(car.trail[0].x,0,car.trail[car.trail.length-1].x,0);trGrad.addColorStop(0,'transparent');trGrad.addColorStop(1,'rgba(0,229,255,0.35)');ctx.strokeStyle=trGrad;ctx.lineWidth=3*car.scala;ctx.globalAlpha=car.alpha*1.2;ctx.stroke();ctx.globalAlpha=1;}disegnaAuto(ctx,car.x,car.y,car.scala,car.alpha);if(car.x<-150)cars.splice(i,1);}
        _splashAnimFrame=requestAnimationFrame(loop);
    }
    loop();
}

// ========== COUNTDOWN ==========
function avviaCountdown(onComplete) {
    let overlay=document.getElementById('countdownOverlay');
    if(!overlay){overlay=document.createElement('div');overlay.id='countdownOverlay';const ga=document.getElementById('gameArea');if(ga)ga.appendChild(overlay);else document.body.appendChild(overlay);}
    let numberEl=document.getElementById('countdownNumber');
    if(!numberEl){numberEl=document.createElement('div');numberEl.id='countdownNumber';overlay.appendChild(numberEl);}
    const steps=['3','2','1','VIA!'];
    let i=0;
    overlay.style.display='flex';
    function showStep(){
        numberEl.textContent=steps[i];
        numberEl.style.animation='none';
        void numberEl.offsetHeight;
        numberEl.style.animation='';
        if(steps[i]==='VIA!'){numberEl.style.color='#ffd700';numberEl.style.textShadow='0 0 30px rgba(255,215,0,0.85), 0 0 60px rgba(255,215,0,0.4)';}
        else{numberEl.style.color='';numberEl.style.textShadow='';}
        i++;
        if(i<steps.length){setTimeout(showStep,900);}
        else{setTimeout(function(){overlay.style.display='none';numberEl.textContent='';if(typeof onComplete==='function')onComplete();},750);}
    }
    showStep();
}


// ========== OVERRIDE MODAL AUTH (DOMContentLoaded) ==========
// NOTE: funzioni avatar/profilo (ripristinaAvatarSalvato, aggiornaNomeBarraAuth ecc.)
// sono definite in GIOCO.html e disponibili solo lì. mainj.js usa safe-guard typeof.
document.addEventListener('DOMContentLoaded', () => {
    if (typeof ripristinaAvatarSalvato === 'function') ripristinaAvatarSalvato();

    window.switchAuthModal = function(tipo) {
        const loginForm=document.getElementById('authLoginForm');
        const regForm=document.getElementById('authRegisterForm');
        if(!loginForm||!regForm) return;
        const isLogin=(tipo==='login'||tipo==='login.html');
        const isRegister=(tipo==='register'||tipo==='register.html');
        loginForm.style.display=isLogin?'block':'none';
        regForm.style.display=isRegister?'block':'none';
        ['authErrore','regErrore','regSuccesso'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent='';});
        const lb=document.getElementById('authLoginBtn2');
        const rb=document.getElementById('authRegBtn2');
        if(lb){lb.textContent='ENTRA NEL GIOCO \u279c';lb.disabled=false;}
        if(rb){rb.textContent='CREA ACCOUNT \u279c';rb.disabled=false;}
    };

    // Feature #1 & #2: apriAuthModal con redirect action
    window.apriAuthModal = function(tipo, redirectAction) {
        const modal=document.getElementById('authModal');
        if(!modal) return;
        if(redirectAction) salvaRedirectAction(redirectAction);
        // Ferma la musica quando si apre il modal auth (non deve suonare durante login/registrazione)
        const rp = document.getElementById('radioPlayer');
        if (rp && !rp.paused) { rp.pause(); }
        modal.classList.add('open');
        window.switchAuthModal(tipo);
    };

   window.chiudiAuthModal = function() {
    const modal = document.getElementById('authModal');
    if (modal) modal.classList.remove('open');
    // Se c'è un punteggio pendente → rimostra popup ospite
    if (window._pendingScore) {
        const ospite = document.getElementById('ospiteScorePopup');
        if (ospite) ospite.classList.add('open');
    } else {
        // Altrimenti rimostra il popup di fine gara se era visibile
        const fineGara = document.getElementById('fineGaraMessage');
        if (fineGara && window._fineGaraVisibile) {
            fineGara.style.display = 'block';
            const ctrlDiv = document.getElementById('gameOverControls');
            if (ctrlDiv) ctrlDiv.style.display = 'flex';
        }
    }
};

    window.eseguiLogin = async function() {
        const email=document.getElementById('authEmail').value.trim();
        const password=document.getElementById('authPassword').value.trim();
        const errEl=document.getElementById('authErrore');
        const btn=document.getElementById('authLoginBtn2');
        if(!email||!password){errEl.textContent='Inserisci email e password.';return;}
        errEl.textContent='';btn.textContent='ACCESSO IN CORSO...';btn.disabled=true;
        try{
            const res=await fetch('/Login',{method:'POST',credentials:'include',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'email='+encodeURIComponent(email)+'&password='+encodeURIComponent(password)});
            const data=await res.json();
            if(data.ok){
                btn.textContent='\u2713 ACCESSO EFFETTUATO';
                sessionStorage.setItem('nakName',data.nakName);
                if(typeof aggiornaAuthBar==='function')aggiornaAuthBar(true,data.nakName);
                // Feature #8: salva punteggio pendente
                await salvaPunteggioPendente();
                // Feature #1: redirect post-auth
                setTimeout(eseguiRedirectPostAuth, 900);
            }else{errEl.textContent=data.errore||'Email o password errati.';btn.textContent='ENTRA NEL GIOCO \u279c';btn.disabled=false;}
        }catch(e){errEl.textContent='Errore di connessione al server.';btn.textContent='ENTRA NEL GIOCO \u279c';btn.disabled=false;}
    };

    // Ridefinisce eseguiRegistrazione con supporto completo domande di sicurezza.
    // Questa versione è identica a quella di GIOCO.html e va bene per entrambe le pagine.
    window.eseguiRegistrazione = async function() {
        const nome      = document.getElementById('regNome').value.trim();
        const email     = document.getElementById('regEmail').value.trim();
        const password  = document.getElementById('regPassword').value.trim();
        const pass2     = document.getElementById('regPassword2') ? document.getElementById('regPassword2').value.trim() : password;
        const domanda1  = document.getElementById('regDomanda1') ? document.getElementById('regDomanda1').value : '';
        const risposta1 = document.getElementById('regRisposta1') ? document.getElementById('regRisposta1').value.trim() : '';
        const domanda2  = document.getElementById('regDomanda2') ? document.getElementById('regDomanda2').value : '';
        const risposta2 = document.getElementById('regRisposta2') ? document.getElementById('regRisposta2').value.trim() : '';
        const errEl     = document.getElementById('regErrore');
        const okEl      = document.getElementById('regSuccesso');
        const btn       = document.getElementById('authRegBtn2');
        if (errEl) errEl.textContent = '';
        if (okEl)  okEl.textContent  = '';
        if (!nome || !email || !password || !pass2) { if(errEl) errEl.textContent = 'Tutti i campi sono obbligatori.'; return; }
        if (password.length < 6) { if(errEl) errEl.textContent = 'La password deve essere almeno 6 caratteri.'; return; }
        if (password !== pass2)  { if(errEl) errEl.textContent = 'Le password non coincidono.'; return; }
        const haDomanda1 = domanda1 && risposta1;
        const haDomanda2 = domanda2 && risposta2;
        if ((haDomanda1 && !haDomanda2) || (!haDomanda1 && haDomanda2)) { if(errEl) errEl.textContent = 'Compila entrambe le domande di sicurezza (o lascia entrambe vuote).'; return; }
        if (haDomanda1 && risposta1.includes(' ')) { if(errEl) errEl.textContent = 'La risposta 1 deve essere una sola parola.'; return; }
        if (haDomanda2 && risposta2.includes(' ')) { if(errEl) errEl.textContent = 'La risposta 2 deve essere una sola parola.'; return; }
        if (haDomanda1 && haDomanda2 && domanda1 === domanda2) { if(errEl) errEl.textContent = 'Scegli due domande diverse.'; return; }
        if (btn) { btn.textContent = 'CREAZIONE IN CORSO...'; btn.disabled = true; }
        try {
            const params = new URLSearchParams();
            params.append('nak_name', nome);
            params.append('email', email);
            params.append('password', password);
            if (haDomanda1 && haDomanda2) {
                params.append('domanda1', domanda1);
                params.append('risposta1', risposta1);
                params.append('domanda2', domanda2);
                params.append('risposta2', risposta2);
            }
            const res  = await fetch('/Register', {
                method: 'POST', credentials: 'include',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: params.toString()
            });
            const data = await res.json();
            if (data.ok) {
                if (okEl) okEl.textContent = '\u2713 Account creato! Bentornato in pista!';
                if (btn)  btn.textContent  = '\u2713 FATTO!';
                sessionStorage.setItem('nakName', data.nakName || nome);
                if (typeof aggiornaAuthBar === 'function') aggiornaAuthBar(true, data.nakName || nome);
                await salvaPunteggioPendente();
                setTimeout(eseguiRedirectPostAuth, 1100);
            } else {
                if (errEl) errEl.textContent = data.errore || 'Errore durante la registrazione.';
                if (btn) { btn.textContent = 'CREA ACCOUNT \u279c'; btn.disabled = false; }
            }
        } catch(e) {
            if (errEl) errEl.textContent = 'Errore di connessione al server.';
            if (btn) { btn.textContent = 'CREA ACCOUNT \u279c'; btn.disabled = false; }
        }
    };

    window.gooogleLogin = function() {
        // Prima del redirect Google la pagina si ricarica completamente —
        // salva _pendingScore in sessionStorage così sopravvive al redirect
        if (window._pendingScore) {
            try {
                sessionStorage.setItem('_pendingScoreGoogle', JSON.stringify(window._pendingScore));
            } catch(e) {}
        }
        // Salva mappaCorrente — senza di essa "Rigioca" dopo il redirect crasherebbe
        if (typeof mappaCorrente !== 'undefined' && mappaCorrente) {
            sessionStorage.setItem('_googleRedirectMappa', mappaCorrente);
        }
        // Salva lo stato del gioco per ripristinarlo dopo il redirect OAuth
        const gcEl2 = document.getElementById('gamecenter');
        if (gcEl2 && (gcEl2.style.display === 'flex' || gcEl2.style.display === 'block')) {
            sessionStorage.setItem('_googleRedirectRestoreGame', '1');
            if (window.idCircuitoCorrente) sessionStorage.setItem('_googleRedirectCircuito', String(window.idCircuitoCorrente));
            if (window.isCustomMap)        sessionStorage.setItem('_googleRedirectCustomMap', '1');
            if (window.customMapDbId)      sessionStorage.setItem('_googleRedirectCustomMapId', String(window.customMapDbId));
        }
        // Salva la schermata corrente per ripristinarla dopo il redirect OAuth
        const selEl2 = document.getElementById('selezioneMappeScreen');
        if (selEl2 && (selEl2.style.display === 'flex' || selEl2.style.display === 'block')) {
            sessionStorage.setItem('_googleRedirectRestoreScreen', 'selezione');
        }
        const crafterEl2 = document.getElementById('gkCrafter');
        if (crafterEl2 && crafterEl2.classList.contains('on')) {
            sessionStorage.setItem('_googleRedirectRestoreScreen', 'crafter');
        }
        const currentPage = window.location.pathname.split('/').pop() || 'GIOCO.html';
        window.location.href = '/GoogleLogin?redirect=' + encodeURIComponent(currentPage);
    };

    // Forza password — rimane globale
    window.modalCheckStrength = function(val){
        const bars=['ms1','ms2','ms3','ms4'].map(id=>document.getElementById(id));
        const label=document.getElementById('modalStrengthLabel');
        if(!bars[0]||!label)return;
        const colors=['#ff6b6b','#ff9900','#ffcc00','#00ff88'];
        const labels=['DEBOLE','DISCRETA','BUONA','OTTIMA'];
        let score=0;
        if(val.length>=6)score++;if(val.length>=10)score++;
        if(/[A-Z]/.test(val)&&/[0-9]/.test(val))score++;if(/[^A-Za-z0-9]/.test(val))score++;
        bars.forEach((b,i)=>{b.style.background=i<score?colors[score-1]:'rgba(255,255,255,0.14)';});
        label.textContent=val.length>0?(labels[score-1]||''):'';label.style.color=score>0?colors[score-1]:'rgba(255,255,255,0.38)';
    };
});