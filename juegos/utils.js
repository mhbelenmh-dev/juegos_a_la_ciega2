// utils.js - Funciones globales, Perfil, Ranking y Chat

function inicializarCargaBaseDatos(urlDefecto, btnDefectoId, inputArchivoId, callbackExito) {
    const btnDefecto = document.getElementById(btnDefectoId);
    const inputArchivo = document.getElementById(inputArchivoId);

    if (btnDefecto) {
        btnDefecto.addEventListener('click', function() {
            let textoOriginal = this.innerText;
            this.innerText = "Cargando..."; 
            fetch(urlDefecto)
                .then(response => { 
                    if (!response.ok) throw new Error('No se encontró el archivo'); 
                    return response.json(); 
                })
                .then(data => { callbackExito(data); })
                .catch(error => { 
                    alert("⚠️ Error: No se pudo cargar " + urlDefecto); 
                    this.innerText = textoOriginal; 
                });
        });
    }

    if (inputArchivo) {
        inputArchivo.addEventListener('change', function(e) {
            const archivo = e.target.files[0]; 
            if (!archivo) return;
            const lector = new FileReader();
            lector.onload = function(evt) { 
                try {
                    const data = JSON.parse(evt.target.result);
                    callbackExito(data);
                } catch (error) { alert("⚠️ Error: El archivo no es un JSON válido."); }
            };
            lector.readAsText(archivo);
        });
    }
}

const sonidos = {
    correcto: new Audio('https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/capture.mp3'),
    incorrecto: new Audio('https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/illegal.mp3'),
    tick: new Audio('https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/tenseconds.mp3'),
    fin: new Audio('https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/game-end.mp3')
};

function reproducirSonido(tipo) {
    try { if (sonidos[tipo]) { sonidos[tipo].currentTime = 0; sonidos[tipo].play().catch(e => console.warn("Audio bloqueado", e)); } } catch(e) {}
}

// =======================================================
// === CONFIGURACIÓN FIREBASE (VERSIÓN 8) ================
// =======================================================
const firebaseConfig = {
    apiKey: "AIzaSyADBD64ux6jAF505Rrja4bMIJA-Y89zQVc",
    authDomain: "ajedrez-gimnasio.firebaseapp.com",
    databaseURL: "https://ajedrez-gimnasio-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "ajedrez-gimnasio",
    storageBucket: "ajedrez-gimnasio.firebasestorage.app",
    messagingSenderId: "133833169975",
    appId: "1:133833169975:web:57a59733087fde8eee33b2"
};

try { if (typeof firebase !== 'undefined' && !firebase.apps.length) firebase.initializeApp(firebaseConfig); } catch(e) {}

// =======================================================
// === GESTOR DE PERFIL Y ATRIBUTOS INDIVIDUALES =========
// =======================================================

const PERFIL_DEFAULT = { 
    uid: "", nombreJugador: "Jugador", isPublic: true,
    eloNormal: 1700, eloCiego: 1700,
    elos: {
        base: { current: 0, history: [] },
        storm: { current: 1700, history: [] },
        ciego: { current: 1700, history: [] },
        radar: { current: 1700, history: [] },
        flash: { current: 1700, history: [] },
        memoria: { current: 1700, history: [] },
        lectura: { current: 1700, history: [] },
        tiempo: { current: 0, history: [] },
        teclado: { current: 0, history: [] },
        voz: { current: 0, history: [] }
    },
    ultimaActividad: [],
    xpTotal: 0, xpAciertos: 0, xpFallos: 0,
    radarJugados: 0, radarAciertos: 0,
    flashJugados: 0, flashAciertos: 0,
    memoriaJugados: 0, memoriaAciertos: 0,
    lecturaJugados: 0, lecturaAciertos: 0,
    arcadeGlobalMax: 0, stormTiempoMax: 0
};

function obtenerPerfil() {
    try {
        let uid = localStorage.getItem('current_user_uid');
        if (!uid) return JSON.parse(JSON.stringify(PERFIL_DEFAULT)); 
        
        let localKey = 'chess_gym_profile_' + uid;
        let perfilStr = localStorage.getItem(localKey);
        
        let perfilObj = perfilStr ? JSON.parse(perfilStr) : {};
        let nuevoPerfil = { ...JSON.parse(JSON.stringify(PERFIL_DEFAULT)), ...perfilObj, uid: uid };
        
        if(!nuevoPerfil.elos) nuevoPerfil.elos = JSON.parse(JSON.stringify(PERFIL_DEFAULT.elos));
        for (let key in PERFIL_DEFAULT.elos) {
            if (!nuevoPerfil.elos[key]) nuevoPerfil.elos[key] = JSON.parse(JSON.stringify(PERFIL_DEFAULT.elos[key]));
        }
        if(!nuevoPerfil.ultimaActividad) nuevoPerfil.ultimaActividad = [];
        
        return nuevoPerfil; 
    } catch(e) { return JSON.parse(JSON.stringify(PERFIL_DEFAULT)); }
}

function guardarPerfil(perfil) { 
    try {
        let uid = localStorage.getItem('current_user_uid');
        if (!uid) return;

        // Copia exacta para no modificar el objeto original en memoria
        let pToSave = JSON.parse(JSON.stringify(perfil));

        // 🔥 PARCHE DE SEGURIDAD: Evitamos borrar los contactos y la conexión online
        delete pToSave.isOnline;
        delete pToSave.contactos;

        // Guardamos en local
        localStorage.setItem('chess_gym_profile_' + uid, JSON.stringify(pToSave));
        
        // Actualizamos Firebase de manera segura (con UPDATE, no con SET)
        if (typeof firebase !== 'undefined' && firebase.database) {
            firebase.database().ref('users/' + uid).update(pToSave);
        }
    } catch(e) {}
}

function actualizarEloJuego(gameId, nuevoElo, puntosGanados) {
    let p = obtenerPerfil();
    let fechaHoy = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' });
    
    if(!p.elos[gameId]) p.elos[gameId] = { current: (gameId==='base'||gameId==='tiempo'||gameId==='teclado'||gameId==='voz') ? 0 : 1700, history: [] };
    
    let hist = p.elos[gameId].history;
    if (hist.length > 0 && hist[hist.length - 1].fecha === fechaHoy) {
        hist[hist.length - 1].elo = nuevoElo;
    } else {
        hist.push({ fecha: fechaHoy, elo: nuevoElo });
    }
    if (hist.length > 30) hist.shift(); 

    p.elos[gameId].current = nuevoElo;

    p.ultimaActividad.unshift({ fecha: fechaHoy, juego: gameId, pts: puntosGanados > 0 ? "+"+puntosGanados : puntosGanados });
    if(p.ultimaActividad.length > 10) p.ultimaActividad.pop();

    guardarPerfil(p);
}

function actualizarEstadisticaGlobal(campo, valor, esAcumulativo = false) {
    try {
        let perfil = obtenerPerfil();
        let esNuevoRecord = false;
        
        if (esAcumulativo) { perfil[campo] = (perfil[campo] || 0) + valor; } 
        else {
            if (campo.includes('elo')) { perfil[campo] = valor; } 
            else if (valor > (perfil[campo] || 0)) { perfil[campo] = valor; esNuevoRecord = true; }
        }
        guardarPerfil(perfil);

        if (esNuevoRecord) {
            if (campo === 'arcadeGlobalMax') subirAFirebase('rankings/arcade', valor);
            if (campo === 'stormTiempoMax') subirAFirebase('rankings/stormTiempo', valor);
        }
    } catch (e) {}
}

function registrarXP(dificultad, exito) {
    let pts = 0;
    if (dificultad === 'basico') pts = exito ? 2 : 1;
    else if (dificultad === 'medio') pts = exito ? 4 : 2;
    else if (dificultad === 'avanzado') pts = exito ? 6 : 3;
    else if (dificultad === 'maestro') pts = exito ? 10 : 5;

    actualizarEstadisticaGlobal('xpTotal', pts, true);
    if (exito) actualizarEstadisticaGlobal('xpAciertos', pts, true);
    else actualizarEstadisticaGlobal('xpFallos', pts, true);

    let perfil = obtenerPerfil();
    subirAFirebase('rankings/xp', perfil.xpTotal);
}

function subirAFirebase(rutaRef, puntuacion) {
    try {
        if (typeof firebase !== 'undefined') {
            const perfil = obtenerPerfil();
            const db = firebase.database();
            db.ref(rutaRef).child(perfil.uid).update({ nombre: perfil.nombreJugador, puntos: puntuacion, fecha: Date.now() });
        }
    } catch (e) {}
}

// ========================================================
// SISTEMA DE MENSAJERÍA PRIVADA (CHAT EN NODO AISLADO)
// ========================================================
window.ChatManager = {
    enviarMensaje: function(toUid, texto) {
        let miUid = localStorage.getItem('current_user_uid');
        if(!miUid || !texto.trim()) return;
        
        let chatId = miUid < toUid ? `${miUid}_${toUid}` : `${toUid}_${miUid}`;
        
        firebase.database().ref(`chats/${chatId}/mensajes`).push({
            from: miUid,
            text: texto,
            time: Date.now()
        });
        
        // Guardamos las agendas en un sitio seguro donde el juego no las pueda pisar
        firebase.database().ref(`mis_contactos/${miUid}/${toUid}`).set(Date.now());
        firebase.database().ref(`mis_contactos/${toUid}/${miUid}`).set(Date.now());
    },
    escucharConversacion: function(toUid, callback) {
        let miUid = localStorage.getItem('current_user_uid');
        let chatId = miUid < toUid ? `${miUid}_${toUid}` : `${toUid}_${miUid}`;
        firebase.database().ref(`chats/${chatId}/mensajes`).limitToLast(50).on('value', callback);
    }
};

// ========================================================
// MOTOR DE DUELOS Y TORNEOS
// ========================================================
window.DueloManager = {
    enDuelo: false, sala: "", contador: 0,
    iniciar: function() {
        const params = new URLSearchParams(window.location.search);
        if (params.get('duelo') === 'true') {
            this.enDuelo = true; this.sala = params.get('sala') || "sala_secreta";
            setTimeout(() => {
                document.querySelectorAll('a[href="index.html"], .btn-salir').forEach(el => el.style.display = 'none');
                let btnBase = document.getElementById('btn-defecto') || document.getElementById('btn-cargar');
                if(btnBase) btnBase.click();
            }, 500);
        }
    },
    obtenerIndiceSincronizado: function(maximo) {
        if (!this.enDuelo) return Math.floor(Math.random() * maximo);
        this.contador++; let semilla = this.sala + "_" + this.contador; let hash = 0;
        for (let i = 0; i < semilla.length; i++) hash = Math.imul(31, hash) + semilla.charCodeAt(i) | 0;
        return Math.abs(hash) % maximo;
    },
    enviarPuntos: function(puntos) { if (this.enDuelo && window.self !== window.top) window.parent.postMessage({ action: 'actualizarPuntos', puntos: puntos }, '*'); }
};
window.addEventListener('DOMContentLoaded', () => { DueloManager.iniciar(); });

window.TorneoManager = {
    enTorneo: false, codigoSala: "", contador: 0, semillaRonda: "1",
    obtenerIndiceSincronizado: function(maximo) {
        if (!this.enTorneo) return Math.floor(Math.random() * maximo);
        this.contador++; let semilla = this.codigoSala + "_torneo_" + this.semillaRonda + "_" + this.contador; let hash = 0;
        for (let i = 0; i < semilla.length; i++) hash = Math.imul(31, hash) + semilla.charCodeAt(i) | 0;
        return Math.abs(hash) % maximo;
    },
    enviarPuntos: function(puntos) {
        if (!this.enTorneo || !this.codigoSala) return;
        let uid = localStorage.getItem('current_user_uid'); let nombre = localStorage.getItem('current_user_name') || "Jugador";
        if (uid && typeof firebase !== 'undefined') firebase.database().ref(`torneos/${this.codigoSala}/jugadores/${uid}`).update({ nombre: nombre, puntos: puntos, ultimaActividad: Date.now() });
    }
};