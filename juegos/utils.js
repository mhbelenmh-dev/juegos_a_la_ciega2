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


/* ==========================================
   SISTEMA DE AJUSTES GLOBALES (PANEL FLOTANTE)
   ========================================== */

// 1. Lógica de guardado y lectura
window.obtenerAjustesGlobales = function() {
    let defaults = { sonido: true, piezas: 'wikipedia' };
    let guardado = localStorage.getItem('chessgym_ajustes');
    return guardado ? JSON.parse(guardado) : defaults;
};

window.guardarAjustesGlobal = function() {
    let s = document.getElementById('ajuste-sonido-global').value === "on";
    let p = document.getElementById('ajuste-piezas-oculto').value; // Ahora lee de un input oculto
    localStorage.setItem('chessgym_ajustes', JSON.stringify({ sonido: s, piezas: p }));
    document.getElementById('modal-ajustes-global').style.display = 'none';
    
    // Recargar la página para que se redibuje el tablero con las nuevas piezas
    location.reload(); 
};

// Función para iluminar la tarjeta de la pieza seleccionada
window.seleccionarPiezaVisual = function(estilo) {
    document.getElementById('ajuste-piezas-oculto').value = estilo;
    let cards = document.getElementsByClassName('pieza-card');
    for(let i=0; i<cards.length; i++) {
        cards[i].style.borderColor = '#555';
        cards[i].style.background = '#1a1917';
    }
    let selectedCard = document.getElementById('card-pieza-' + estilo);
    if(selectedCard) {
        selectedCard.style.borderColor = '#3692e7';
        selectedCard.style.background = 'rgba(54, 146, 231, 0.2)';
    }
};

// 2. Interceptar el Sonido
if (typeof window.reproducirSonidoOriginal === 'undefined' && typeof window.reproducirSonido === 'function') {
    window.reproducirSonidoOriginal = window.reproducirSonido;
    window.reproducirSonido = function(tipo) {
        let ajustes = window.obtenerAjustesGlobales();
        if (ajustes.sonido) {
            window.reproducirSonidoOriginal(tipo);
        }
    };
}

// 3. Interceptar ChessboardJS para inyectar el diseño de las piezas
if (typeof window.Chessboard !== 'undefined' && typeof window._originalChessboard === 'undefined') {
    window._originalChessboard = window.Chessboard;
    window.Chessboard = function(el, config) {
        let ajustes = window.obtenerAjustesGlobales();
        let themeUrl = 'https://chessboardjs.com/img/chesspieces/' + ajustes.piezas + '/{piece}.png';
        
        if (config && typeof config === 'object') {
            config.pieceTheme = themeUrl;
        } else if (typeof config === 'string') {
            config = { position: config, pieceTheme: themeUrl };
        } else if (typeof config === 'undefined') {
            config = { pieceTheme: themeUrl };
        }
        return window._originalChessboard(el, config);
    };
}

// 4. Inyectar el botón flotante y el modal visual en el HTML
document.addEventListener('DOMContentLoaded', () => {
    // Botón flotante
    const btnAjustes = document.createElement('button');
    btnAjustes.innerHTML = '⚙️';
    btnAjustes.id = "btn-ajustes-flotante";
    btnAjustes.title = "Ajustes del Gimnasio";
    btnAjustes.style.cssText = 'position: fixed; bottom: 20px; left: 20px; background: #262421; border: 2px solid #444; color: white; font-size: 1.5em; width: 50px; height: 50px; border-radius: 50%; cursor: pointer; z-index: 9998; box-shadow: 0 4px 10px rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; transition: 0.2s;';
    
    // Efectos hover por JS
    btnAjustes.onmouseover = () => { btnAjustes.style.transform = 'scale(1.1)'; btnAjustes.style.borderColor = '#3692e7'; };
    btnAjustes.onmouseout = () => { btnAjustes.style.transform = 'scale(1)'; btnAjustes.style.borderColor = '#444'; };
    
    // Abrir Modal
    btnAjustes.onclick = () => {
        let a = window.obtenerAjustesGlobales();
        document.getElementById('ajuste-sonido-global').value = a.sonido ? "on" : "off";
        window.seleccionarPiezaVisual(a.piezas || 'wikipedia');
        document.getElementById('modal-ajustes-global').style.display = 'flex';
    };
    document.body.appendChild(btnAjustes);

    // CSS inyectado para las tarjetas de piezas
    const style = document.createElement('style');
    style.innerHTML = `
        .pieza-card {
            flex: 1; background: #1a1917; border: 2px solid #555; border-radius: 8px; 
            padding: 15px 10px; text-align: center; cursor: pointer; transition: 0.2s; 
            color: #fff; font-size: 0.95em; font-weight: bold;
        }
        .pieza-card:hover { border-color: #888; transform: translateY(-2px); }
        .pieza-card img { width: 50px; height: 50px; margin-bottom: 8px; filter: drop-shadow(0 4px 5px rgba(0,0,0,0.5)); }
    `;
    document.head.appendChild(style);

    // Modal oculto de ajustes con selector visual
    const modalHTML = `
        <div id="modal-ajustes-global" class="overlay-modal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(10, 10, 10, 0.95); z-index: 9999; display: none; justify-content: center; align-items: center;">
            <div class="caja-modal" style="background: #262421; padding: 40px; border-radius: 12px; border: 2px solid #3692e7; width: 100%; max-width: 450px; text-align: left; position: relative; box-shadow: 0 15px 50px rgba(0,0,0,0.8); font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
                <span style="position: absolute; top: 15px; right: 20px; font-size: 2em; cursor: pointer; color: #888; line-height: 1;" onclick="document.getElementById('modal-ajustes-global').style.display='none'" onmouseover="this.style.color='#cc3333'" onmouseout="this.style.color='#888'">&times;</span>
                <h2 style="color:#e5bf00; margin-top:0; text-align: center; text-transform: uppercase; letter-spacing: 2px;">⚙️ Ajustes</h2>
                
                <label style="color: #fff; font-weight: bold; display: block; margin-bottom: 10px; font-size: 1.1em;">🔊 Efectos de Sonido:</label>
                <select id="ajuste-sonido-global" style="width: 100%; padding: 15px; margin-bottom: 25px; background: #1a1917; color: #fff; border: 1px solid #555; border-radius: 6px; font-size: 1.1em; outline: none; cursor: pointer;">
                    <option value="on">Activado</option>
                    <option value="off">Silenciado</option>
                </select>

                <label style="color: #fff; font-weight: bold; display: block; margin-bottom: 10px; font-size: 1.1em;">♟️ Diseño de Piezas:</label>
                <input type="hidden" id="ajuste-piezas-oculto" value="wikipedia">
                
                <div style="display: flex; gap: 15px; margin-bottom: 30px;">
                    <div class="pieza-card" id="card-pieza-wikipedia" onclick="seleccionarPiezaVisual('wikipedia')">
                        <img src="https://chessboardjs.com/img/chesspieces/wikipedia/wN.png"><br>Clásico
                    </div>
                    <div class="pieza-card" id="card-pieza-alpha" onclick="seleccionarPiezaVisual('alpha')">
                        <img src="https://chessboardjs.com/img/chesspieces/alpha/wN.png"><br>Moderno
                    </div>
                    <div class="pieza-card" id="card-pieza-uscf" onclick="seleccionarPiezaVisual('uscf')">
                        <img src="https://chessboardjs.com/img/chesspieces/uscf/wN.png"><br>Torneo
                    </div>
                </div>

                <button style="width: 100%; color: #fff; padding: 15px; border: none; border-radius: 6px; font-weight: bold; font-size: 1.2em; cursor: pointer; background: #629924; transition: 0.2s; box-shadow: 0 4px 0 #4a751b;" onmouseover="this.style.filter='brightness(1.2)'; this.style.transform='translateY(-2px)';" onmouseout="this.style.filter='brightness(1)'; this.style.transform='translateY(0)';" onclick="guardarAjustesGlobal()">Guardar Cambios</button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
});


/* ==========================================
   OPTIMIZACIÓN MÓVIL GLOBAL (PUNTO 5)
   ========================================== */
document.addEventListener('DOMContentLoaded', () => {
    const mobileStyle = document.createElement('style');
    mobileStyle.innerHTML = `
        @media (max-width: 768px) {
            /* 1. Arreglo del Menú Superior */
            #top-bar { 
                padding: 0 10px !important; 
                overflow-x: auto; /* Permite deslizar el menú con el dedo si no cabe */
                justify-content: flex-start !important; 
                gap: 15px; 
            }
            #brand-logo { font-size: 1.2em !important; display: none; } /* Ocultamos el logo en móvil para dar espacio al menú */
            #nav-menu { gap: 10px !important; }
            .nav-link { font-size: 0.9em !important; padding: 5px !important; }
            .search-container { width: 140px !important; }
            #search-input { font-size: 0.8em !important; padding: 8px !important; }

            /* 2. Arreglo del Dashboard (Index) */
            #layout-wrapper { flex-direction: column !important; height: auto !important; overflow-y: visible !important; }
            #main-content { padding: 15px !important; width: 100% !important; box-sizing: border-box; }
            #sidebar-right { width: 100% !important; border-left: none !important; border-top: 2px solid #444 !important; }

            /* 3. Arreglo de los Hubs */
            #hub-container { padding: 10px !important; margin-top: 80px !important;}
            .config-section { padding: 15px !important; }
            .hub-title { font-size: 2em !important; }
            
            /* 4. Arreglo de los Juegos (El Tablero es el Rey) */
            #main-layout { flex-direction: column !important; align-items: center !important; gap: 15px !important; padding: 5px !important; margin-top: 70px !important;}
            #tablero-wrapper { width: 100% !important; flex: none !important; max-width: 100vw !important; padding: 0 !important; box-sizing: border-box; }
            #tablero { width: 100% !important; max-width: 100% !important; border-width: 3px !important; } /* Tablero al 100% del ancho del móvil */
            .sidebar-panel { width: 100% !important; max-width: 100% !important; padding: 0 !important; box-sizing: border-box;}
            
            /* 5. Chat y Modales Adaptados */
            #chat-modal { width: 100% !important; right: 0 !important; bottom: 0 !important; height: 60vh !important; border-radius: 15px 15px 0 0 !important; border-bottom: none !important; z-index: 9999 !important;}
            .caja-modal { width: 95% !important; padding: 25px 15px !important; }
        }
    `;
    document.head.appendChild(mobileStyle);
});


/* ==========================================
   SISTEMA DE RANGOS Y XP (PUNTO 2)
   ========================================== */
window.obtenerInfoRango = function(xpTotal) {
    let xp = xpTotal || 0;
    
    // Escala de niveles del Gimnasio
    let rangos = [
        { nombre: "Iniciado", icono: "🪵", min: 0, max: 999, color: "#8b5a2b" },
        { nombre: "Aficionado", icono: "🥉", min: 1000, max: 2499, color: "#cd7f32" },
        { nombre: "Promesa", icono: "🥈", min: 2500, max: 4999, color: "#c0c0c0" },
        { nombre: "Experto", icono: "🥇", min: 5000, max: 9999, color: "#ffd700" },
        { nombre: "Maestro", icono: "💎", min: 10000, max: 24999, color: "#00ced1" },
        { nombre: "Leyenda", icono: "👑", min: 25000, max: Infinity, color: "#ff4500" }
    ];

    let rangoActual = rangos[0];
    let rangoSiguiente = rangos[1];

    // Buscar en qué rango encaja el jugador
    for (let i = 0; i < rangos.length; i++) {
        if (xp >= rangos[i].min && xp <= rangos[i].max) {
            rangoActual = rangos[i];
            rangoSiguiente = rangos[i + 1] || rangos[i]; // Si ya es Leyenda, se queda ahí
            break;
        }
    }

    // Calcular porcentajes para la barra de progreso
    let progresoEnElNivel = xp - rangoActual.min;
    let xpTotalDelNivel = rangoSiguiente.min - rangoActual.min;
    let porcentaje = (rangoActual.nombre === "Leyenda") ? 100 : Math.floor((progresoEnElNivel / xpTotalDelNivel) * 100);

    return {
        nombre: rangoActual.nombre,
        icono: rangoActual.icono,
        color: rangoActual.color,
        xpFaltante: (rangoActual.nombre === "Leyenda") ? 0 : (rangoSiguiente.min - xp),
        porcentajeProgreso: porcentaje,
        siguienteRango: rangoSiguiente.nombre
    };
};


/* ==========================================
   BAÚL DE ERRORES (PUNTO 6)
   ========================================== */
window.guardarFallo = function(modulo, fen, solucionCorrecta, tuJugada) {
    let uid = localStorage.getItem('current_user_uid');
    if (!uid || typeof firebase === 'undefined') return;

    let nuevoFallo = {
        modulo: modulo,
        fen: fen,
        solucion: solucionCorrecta,
        tuJugada: tuJugada || "Me rendí / Tiempo agotado",
        fecha: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute:'2-digit' }),
        timestamp: Date.now()
    };

    firebase.database().ref('users/' + uid + '/errores').push(nuevoFallo);
};

window.borrarFallo = function(key) {
    let uid = localStorage.getItem('current_user_uid');
    if (!uid || typeof firebase === 'undefined') return;
    firebase.database().ref('users/' + uid + '/errores/' + key).remove();
};