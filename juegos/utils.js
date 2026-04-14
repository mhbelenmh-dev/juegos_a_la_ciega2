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
// === SEGURIDAD: LIMPIADOR DE HTML (ANTI-XSS) ===========
// =======================================================
window.escaparHTML = function(texto) {
    if (!texto) return "";
    return texto
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
};

// =======================================================
// === GESTOR DE PERFIL Y ATRIBUTOS INDIVIDUALES =========
// =======================================================

const PERFIL_DEFAULT = { 
    uid: "", nombreJugador: "Jugador", isPublic: true,
    eloNormal: 1700, eloCiego: 1700, 
    ultimaActividad: [],
    xpTotal: 0, xpAciertos: 0, xpFallos: 0,
    arcadeGlobalMax: 0, stormTiempoMax: 0,
    rachaDias: 0, ultimaConexion: ""
};

function obtenerPerfil() {
    try {
        let uid = localStorage.getItem('current_user_uid');
        if (!uid) return JSON.parse(JSON.stringify(PERFIL_DEFAULT)); 
        
        let localKey = 'chess_gym_profile_' + uid;
        let perfilStr = localStorage.getItem(localKey);
        
        let perfilObj = perfilStr ? JSON.parse(perfilStr) : {};
        let nuevoPerfil = { ...JSON.parse(JSON.stringify(PERFIL_DEFAULT)), ...perfilObj, uid: uid };
        
        if(!nuevoPerfil.ultimaActividad) nuevoPerfil.ultimaActividad = [];
        
        return nuevoPerfil; 
    } catch(e) { return JSON.parse(JSON.stringify(PERFIL_DEFAULT)); }
}

function guardarPerfil(perfil) { 
    try {
        let uid = localStorage.getItem('current_user_uid');
        if (!uid) return;

        let pToSave = JSON.parse(JSON.stringify(perfil));

        delete pToSave.isOnline;
        delete pToSave.contactos;

        localStorage.setItem('chess_gym_profile_' + uid, JSON.stringify(pToSave));
        
        if (typeof firebase !== 'undefined' && firebase.database) {
            firebase.database().ref('users/' + uid).update(pToSave);
        }
    } catch(e) {}
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
// SISTEMA DE MENSAJERÍA PRIVADA
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
   SISTEMA SÚPER-PANEL DE AJUSTES GLOBALES
   ========================================== */

// 1. Lógica de guardado y lectura
window.obtenerAjustesGlobales = function() {
    let defaults = { sonido: true, chatNotif: true, piezas: 'wikipedia', colorTablero: 'verde' };
    let guardado = localStorage.getItem('chessgym_ajustes');
    return guardado ? JSON.parse(guardado) : defaults;
};

window.guardarAjustesGlobal = function() {
    let s = document.getElementById('ajuste-sonido-global').value === "on";
    let cn = document.getElementById('ajuste-chat-global').value === "on";
    let p = document.getElementById('ajuste-piezas-oculto').value; 
    let c = document.getElementById('ajuste-color-oculto').value; 
    
    localStorage.setItem('chessgym_ajustes', JSON.stringify({ sonido: s, chatNotif: cn, piezas: p, colorTablero: c }));
    document.getElementById('modal-ajustes-global').style.display = 'none';
    location.reload(); 
};

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

window.seleccionarColorVisual = function(color) {
    document.getElementById('ajuste-color-oculto').value = color;
    let cards = document.getElementsByClassName('color-card');
    for(let i=0; i<cards.length; i++) { cards[i].style.borderColor = '#555'; cards[i].style.transform = 'scale(1)'; }
    let selectedCard = document.getElementById('card-color-' + color);
    if(selectedCard) { selectedCard.style.borderColor = '#fff'; selectedCard.style.transform = 'scale(1.1)'; }
};

// 2. Modificación de Seguridad (Nombre, Correo, Pass)
// 2. Modificación de Seguridad (Nombre, Correo, Pass)
window.cambiarNombreUsuario = function() {
    let nuevo = document.getElementById('ajuste-nuevo-nombre').value.trim();
    if(nuevo.length < 3) return alert("El nombre debe tener al menos 3 letras.");
    
    let user = firebase.auth().currentUser;
    if(user) {
        user.updateProfile({ displayName: nuevo }).then(() => {
            let uid = user.uid;
            
            firebase.database().ref('users/' + uid).update({ 
                nombreJugador: nuevo, 
                nombreJugadorLower: nuevo.toLowerCase() 
            }).then(() => {
                // 🔥 EL TRUCO: Actualizamos todas las "memorias" del navegador para que no lo machaque
                localStorage.setItem('current_user_name', nuevo);
                localStorage.setItem('nombre_temporal', nuevo); 
                
                // Actualizamos también su perfil guardado en caché
                let perfilLocal = localStorage.getItem('chess_gym_profile_' + uid);
                if (perfilLocal) {
                    let p = JSON.parse(perfilLocal);
                    p.nombreJugador = nuevo;
                    localStorage.setItem('chess_gym_profile_' + uid, JSON.stringify(p));
                }
                
                alert("¡Nombre cambiado con éxito!");
                location.reload();
            });
        }).catch(e => alert("Error al cambiar el nombre: " + e.message));
    } else { 
        alert("Debes iniciar sesión para cambiar tu nombre."); 
    }
};
window.vincularCorreoDesdeAjustes = function() {
    let nuevoEmail = document.getElementById('ajuste-nuevo-correo').value.trim();
    if (!nuevoEmail.includes('@')) return alert("Introduce un email válido.");
    
    let user = firebase.auth().currentUser;
    if (user) {
        user.updateEmail(nuevoEmail).then(() => {
            firebase.database().ref('users/' + user.uid).update({
                emailReal: nuevoEmail,
                cuentaProtegida: true
            });
            alert("✅ ¡Correo vinculado con éxito! Ya puedes usarlo para iniciar sesión o recuperar contraseñas.");
            document.getElementById('ajuste-nuevo-correo').value = ""; 
        }).catch(e => {
            if(e.code === 'auth/requires-recent-login') {
                alert("🔒 Por seguridad, Firebase pide que cierres sesión y vuelvas a entrar para cambiar tu correo.");
            } else {
                alert("Error: " + e.message);
            }
        });
    }
};

window.enviarCorreoRecuperacion = function() {
    let user = firebase.auth().currentUser;
    if (!user) return;
    
    if (user.email && user.email.includes('@ajedrezgym.local')) {
        alert("⚠️ No podemos enviarte el correo porque aún estás usando una cuenta antigua sin vincular. ¡Por favor, guarda tu correo real en la casilla de arriba primero!");
        return;
    }

    firebase.auth().sendPasswordResetEmail(user.email).then(() => {
        alert("📧 ¡Correo de recuperación enviado a " + user.email + "! Revisa tu bandeja de entrada (y la de SPAM) para cambiar tu contraseña de forma segura.");
    }).catch(e => {
        alert("Error al enviar el correo: " + e.message);
    });
};

// 3. Interceptar el Sonido
if (typeof window.reproducirSonidoOriginal === 'undefined' && typeof window.reproducirSonido === 'function') {
    window.reproducirSonidoOriginal = window.reproducirSonido;
    window.reproducirSonido = function(tipo) {
        let ajustes = window.obtenerAjustesGlobales();
        if (ajustes.sonido) {
            window.reproducirSonidoOriginal(tipo);
        }
    };
}

// 4. Interceptar ChessboardJS
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

// 5. Inyectar el botón flotante y el modal visual en el HTML
document.addEventListener('DOMContentLoaded', () => {
    const style = document.createElement('style');
    style.innerHTML = `
        /* Colores de Tablero Personalizados */
        body.board-verde .black-3c85d { background-color: #769656 !important; color: #eeeed2 !important; }
        body.board-verde .white-1e1d7 { background-color: #eeeed2 !important; color: #769656 !important; }
        
        body.board-azul .black-3c85d { background-color: #4b7399 !important; color: #eae9d2 !important; }
        body.board-azul .white-1e1d7 { background-color: #eae9d2 !important; color: #4b7399 !important; }
        
        body.board-madera .black-3c85d { background-color: #855e42 !important; color: #d18b47 !important; }
        body.board-madera .white-1e1d7 { background-color: #d18b47 !important; color: #855e42 !important; }
        
        body.board-gris .black-3c85d { background-color: #777777 !important; color: #cccccc !important; }
        body.board-gris .white-1e1d7 { background-color: #cccccc !important; color: #777777 !important; }

        body.board-lichess .black-3c85d { background-color: #b58863 !important; color: #f0d9b5 !important;} 
        body.board-lichess .white-1e1d7 { background-color: #f0d9b5 !important; color: #b58863 !important;}

        .pieza-card { flex: 1; background: #1a1917; border: 2px solid #555; border-radius: 8px; padding: 15px 10px; text-align: center; cursor: pointer; transition: 0.2s; color: #fff; font-size: 0.95em; font-weight: bold; }
        .pieza-card:hover { border-color: #888; transform: translateY(-2px); }
        .pieza-card img { width: 50px; height: 50px; margin-bottom: 8px; filter: drop-shadow(0 4px 5px rgba(0,0,0,0.5)); }
        
        .color-card { flex:1; height:45px; border-radius:8px; cursor:pointer; border:3px solid transparent; transition:0.2s; }
        .color-card:hover { transform: scale(1.05); }
        
        .seccion-ajuste { background: #1a1917; padding: 15px; border-radius: 8px; border: 1px solid #444; margin-bottom: 20px; }
        .label-ajuste { color: var(--accent, #e5bf00); font-weight: bold; display: block; margin-bottom: 10px; font-size: 1.1em; text-transform: uppercase; border-bottom: 1px solid #333; padding-bottom: 5px;}
    `;
    document.head.appendChild(style);

    // Aplicar color de tablero actual al body
    let misAjustes = window.obtenerAjustesGlobales();
    document.body.classList.add('board-' + (misAjustes.colorTablero || 'verde'));

    const btnAjustes = document.createElement('button');
    btnAjustes.innerHTML = '⚙️';
    btnAjustes.id = "btn-ajustes-flotante";
    btnAjustes.title = "Centro de Control";
    btnAjustes.style.cssText = 'position: fixed; bottom: 20px; left: 20px; background: #262421; border: 2px solid #444; color: white; font-size: 1.5em; width: 50px; height: 50px; border-radius: 50%; cursor: pointer; z-index: 9998; box-shadow: 0 4px 10px rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; transition: 0.2s;';
    
    btnAjustes.onmouseover = () => { btnAjustes.style.transform = 'scale(1.1)'; btnAjustes.style.borderColor = '#3692e7'; };
    btnAjustes.onmouseout = () => { btnAjustes.style.transform = 'scale(1)'; btnAjustes.style.borderColor = '#444'; };
    
    btnAjustes.onclick = () => {
        let a = window.obtenerAjustesGlobales();
        document.getElementById('ajuste-sonido-global').value = a.sonido ? "on" : "off";
        document.getElementById('ajuste-chat-global').value = a.chatNotif ? "on" : "off";
        window.seleccionarPiezaVisual(a.piezas || 'wikipedia');
        window.seleccionarColorVisual(a.colorTablero || 'verde');
        document.getElementById('modal-ajustes-global').style.display = 'flex';
    };
    document.body.appendChild(btnAjustes);

    const modalHTML = `
        <div id="modal-ajustes-global" class="overlay-modal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(10, 10, 10, 0.95); z-index: 9999; display: none; justify-content: center; align-items: center;">
            <div class="caja-modal" style="background: #262421; padding: 30px; border-radius: 12px; border: 2px solid #3692e7; width: 90%; max-width: 500px; max-height: 85vh; overflow-y: auto; text-align: left; position: relative; box-shadow: 0 15px 50px rgba(0,0,0,0.8); font-family: 'Segoe UI', Tahoma, sans-serif;">
                <span style="position: absolute; top: 15px; right: 20px; font-size: 2em; cursor: pointer; color: #888; line-height: 1;" onclick="document.getElementById('modal-ajustes-global').style.display='none'">&times;</span>
                <h2 style="color:#3692e7; margin-top:0; text-align: center; text-transform: uppercase; letter-spacing: 2px;">⚙️ Centro de Control</h2>
                
                <div class="seccion-ajuste">
                    <label class="label-ajuste">🎮 Preferencias</label>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                        <span style="color:#fff; font-weight:bold;">🔊 Efectos de Sonido:</span>
                        <select id="ajuste-sonido-global" style="padding: 8px; background: #111; color: #fff; border: 1px solid #555; border-radius: 4px;">
                            <option value="on">Activado</option><option value="off">Silenciado</option>
                        </select>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="color:#fff; font-weight:bold;">💬 Notificaciones Chat:</span>
                        <select id="ajuste-chat-global" style="padding: 8px; background: #111; color: #fff; border: 1px solid #555; border-radius: 4px;">
                            <option value="on">Activado</option><option value="off">Silenciado</option>
                        </select>
                    </div>
                </div>

                <div class="seccion-ajuste">
                    <label class="label-ajuste">🎨 Apariencia del Tablero</label>
                    <span style="color:#ddd; font-size:0.9em; margin-bottom:10px; display:block;">Estilo de Piezas:</span>
                    <input type="hidden" id="ajuste-piezas-oculto" value="wikipedia">
                    <div style="display: flex; gap: 10px; margin-bottom: 20px;">
                        <div class="pieza-card" id="card-pieza-wikipedia" onclick="seleccionarPiezaVisual('wikipedia')"><img src="https://chessboardjs.com/img/chesspieces/wikipedia/wN.png"><br>Clásico</div>
                        <div class="pieza-card" id="card-pieza-alpha" onclick="seleccionarPiezaVisual('alpha')"><img src="https://chessboardjs.com/img/chesspieces/alpha/wN.png"><br>Moderno</div>
                        <div class="pieza-card" id="card-pieza-uscf" onclick="seleccionarPiezaVisual('uscf')"><img src="https://chessboardjs.com/img/chesspieces/uscf/wN.png"><br>Torneo</div>
                    </div>

                    <span style="color:#ddd; font-size:0.9em; margin-bottom:10px; display:block;">Color de Casillas:</span>
                    <input type="hidden" id="ajuste-color-oculto" value="verde">
                    <div style="display: flex; gap: 15px;">
                        <div class="color-card" id="card-color-verde" onclick="seleccionarColorVisual('verde')" style="background: linear-gradient(135deg, #eeeed2 50%, #769656 50%);"></div>
                        <div class="color-card" id="card-color-azul" onclick="seleccionarColorVisual('azul')" style="background: linear-gradient(135deg, #eae9d2 50%, #4b7399 50%);"></div>
                        <div class="color-card" id="card-color-madera" onclick="seleccionarColorVisual('madera')" style="background: linear-gradient(135deg, #d18b47 50%, #855e42 50%);"></div>
                        <div class="color-card" id="card-color-gris" onclick="seleccionarColorVisual('gris')" style="background: linear-gradient(135deg, #cccccc 50%, #777777 50%);"></div>
                    <div class="color-card" id="card-color-lichess" onclick="seleccionarColorVisual('lichess')" style="background: linear-gradient(135deg, #f0d9b5 50%, #b58863 50%);" title="Clásico Lichess"></div>
                    </div>
                </div>

                <div class="seccion-ajuste" style="border: 1px solid #444; padding: 15px; border-radius: 8px; margin-bottom: 20px; text-align: left;">
                    <h3 style="color: #cc3333; margin-top: 0; text-transform: uppercase;">🔒 Cuenta y Seguridad</h3>
                    
                    <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                        <input type="text" id="ajuste-nuevo-nombre" placeholder="Nuevo Nombre" style="flex:1; padding:10px; background:#111; color:#fff; border:1px solid #555; border-radius:4px; outline:none;">
                        <button onclick="cambiarNombreUsuario()" style="background: #cc3333; color: white; border: none; padding: 10px 15px; border-radius: 4px; font-weight: bold; cursor: pointer; transition: 0.2s;">Cambiar</button>
                    </div>

                    <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                        <input type="email" id="ajuste-nuevo-correo" placeholder="Tu Correo Real (ej: tu@gmail.com)" style="flex:1; padding:10px; background:#111; color:#fff; border:1px solid #555; border-radius:4px; outline:none;">
                        <button onclick="vincularCorreoDesdeAjustes()" style="background: #cc3333; color: white; border: none; padding: 10px 15px; border-radius: 4px; font-weight: bold; cursor: pointer; transition: 0.2s;">Guardar Correo</button>
                    </div>

                    <div style="border-top: 1px dashed #444; padding-top: 15px;">
                        <button onclick="enviarCorreoRecuperacion()" style="width: 100%; background: #333; color: #fff; border: 1px solid #555; padding: 12px; border-radius: 4px; font-weight: bold; cursor: pointer; transition: 0.2s;" onmouseover="this.style.background='#444'" onmouseout="this.style.background='#333'">📧 Enviarme enlace para cambiar contraseña</button>
                        <div style="font-size: 0.85em; color: #888; margin-top: 8px; text-align: center;">Te enviaremos un email seguro para que elijas una contraseña nueva.</div>
                    </div>
                </div>

                <button style="width: 100%; color: #fff; padding: 15px; border: none; border-radius: 6px; font-weight: bold; font-size: 1.2em; cursor: pointer; background: #629924; transition: 0.2s; box-shadow: 0 4px 0 #4a751b; margin-top: 10px;" onclick="guardarAjustesGlobal()">✅ Guardar Todo y Recargar</button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
});
/* ==========================================
   OPTIMIZACIÓN MÓVIL GLOBAL
   ========================================== */
document.addEventListener('DOMContentLoaded', () => {
    const mobileStyle = document.createElement('style');
    mobileStyle.innerHTML = `
        @media (max-width: 768px) {
        /* RE-ACTIVAR EL SCROLL EN MÓVIL */
            body { overflow-y: auto !important; height: auto !important; }
            /* TOP BAR MÓVIL (Se expande hacia abajo en bloque) */
            #top-bar { 
                padding: 10px !important; 
                height: auto !important; 
                flex-direction: column !important; 
                align-items: stretch !important;
                gap: 12px !important; 
            }
            #brand-logo { display: none !important; }
            
            /* Pestañas de menú */
            #nav-menu { 
                width: 100% !important; 
                justify-content: center !important; 
                flex-wrap: wrap !important; 
                gap: 8px !important; 
            }
            .nav-link { font-size: 0.85em !important; padding: 6px !important; }
            
            /* Contenedor de Búsqueda y Botones */
            #top-bar > div:last-child {
                flex-direction: column !important;
                gap: 10px !important;
                width: 100% !important;
                align-items: stretch !important;
            }
            
            .search-container { width: 100% !important; }
            #search-input { width: 100% !important; padding: 10px !important; box-sizing: border-box !important; }
            
            /* Botones Baúl, Perfil, Salir */
            #top-bar > div:last-child > div:last-child {
                width: 100% !important;
                border-left: none !important;
                padding-left: 0 !important;
                justify-content: space-between !important;
                gap: 5px !important;
            }
            #top-bar > div:last-child > div:last-child button {
                flex: 1 !important;
                padding: 10px 5px !important;
                font-size: 0.85em !important;
                white-space: nowrap !important;
            }

            /* AJUSTE DE MARGEN SUPERIOR PARA COMPENSAR LA BARRA MÁS ALTA */
            #layout-wrapper { flex-direction: column !important; height: auto !important; overflow-y: visible !important; margin-top: 145px !important; }
            #main-content { padding: 15px !important; width: 100% !important; box-sizing: border-box; }
            #sidebar-right { width: 100% !important; border-left: none !important; border-top: 2px solid #444 !important; }
            
            #hub-container { padding: 10px !important; margin-top: 145px !important; }
            .config-section { padding: 15px !important; }
            .hub-title { font-size: 2em !important; text-align: center; }
            
            #main-layout { flex-direction: column !important; align-items: center !important; gap: 15px !important; padding: 5px !important; margin-top: 145px !important; }
            #tablero-wrapper { width: 100% !important; flex: none !important; max-width: 100vw !important; padding: 0 !important; box-sizing: border-box; }
            #tablero { width: 100% !important; max-width: 100% !important; border-width: 3px !important; }
            .sidebar-panel { width: 100% !important; max-width: 100% !important; padding: 0 !important; box-sizing: border-box;}
            
            #chat-modal { width: 100% !important; right: 0 !important; bottom: 0 !important; height: 60vh !important; border-radius: 15px 15px 0 0 !important; border-bottom: none !important; z-index: 9999 !important;}
            .caja-modal { width: 95% !important; padding: 25px 15px !important; }
        }
    `;
    document.head.appendChild(mobileStyle);
});


/* ==========================================
   SISTEMA DE RANGOS Y XP
   ========================================== */
window.obtenerInfoRango = function(xpTotal) {
    let xp = xpTotal || 0;
    
    let rangos = [
{ 
    nombre: "Iniciado I", 
    pieza: "Peón", // Opcional, pero útil si quieres mostrar el nombre de la pieza
    imagen: "peon1.jpg", // Aquí pondrás la ruta a tu imagen sin fondo
    min: 0, 
    max: 499, 
    color: "#8b5a2b" 
  },
  { 
    nombre: "Iniciado II", 
    pieza: "Peón Épico",
    imagen: "peon2.jpg", 
    min: 500, 
    max: 999, 
    color: "#a06f3d" // Un truco: puedes hacer que el color sea un poco más claro/brillante en la fase II
  },
  { 
    nombre: "Aficionado I", 
    pieza: "Caballo",
    imagen: "caballo1.jpg", 
    min: 1000, 
    max: 1499, 
    color: "#cd7f32" 
  },
  { 
    nombre: "Aficionado II", 
    pieza: "Caballo Épico",
    imagen: "caballo2.jpg", 
    min: 1500, 
    max: 2499, 
    color: "#e08b3d" 
  },
  { 
    nombre: "Promesa I", 
    pieza: "Alfil",
    imagen: "alfil1.jpg", 
    min: 2500, 
    max: 2999, 
    color: "#c0c0c0" 
  },
  { 
    nombre: "Promesa II", 
    pieza: "Alfil Épico",
    imagen: "alfil2.jpg", 
    min: 3000, 
    max: 4999, 
    color: "#d4c0c0" 
  },
  { 
    nombre: "Experto I", 
    pieza: "Torre",
    imagen: "torre1.jpg", 
    min: 5000, 
    max: 5999, 
    color: "#ffd700" 
  },
  { 
    nombre: "Experto II", 
    pieza: "Torre Épica",
    imagen: "torre2.jpg", 
    min: 6000, 
    max: 9999, 
    color: "#e8c300" 
  },
  { 
    nombre: "Maestro I", 
    pieza: "Dama",
    imagen: "dama1.jpg", 
    min: 10000, 
    max: 14999, 
    color: "#00ced1" 
  },
  { 
    nombre: "Maestro II", 
    pieza: "Dama Épica",
    imagen: "dama2.jpg", 
    min: 15000, 
    max: 24999, 
    color: "#00e0d1" 
  },
  { 
    nombre: "Leyenda I", 
    pieza: "Rey",
    imagen: "rey1.jpg", 
    min: 25000, 
    max: 49999, 
    color: "#ff4500" 
  },
  { 
    nombre: "Leyenda II", 
    pieza: "Rey Épico",
    imagen: "rey2.jpg", 
    min: 50000, 
    max: Infinity, 
    color: "#ff6b3d" 
  }
];

    let rangoActual = rangos[0];
    let rangoSiguiente = rangos[1];

    for (let i = 0; i < rangos.length; i++) {
        if (xp >= rangos[i].min && xp <= rangos[i].max) {
            rangoActual = rangos[i];
            rangoSiguiente = rangos[i + 1] || rangos[i];
            break;
        }
    }

    let progresoEnElNivel = xp - rangoActual.min;
    let xpTotalDelNivel = rangoSiguiente.min - rangoActual.min;
    let porcentaje = (rangoActual.nombre === "Leyenda") ? 100 : Math.floor((progresoEnElNivel / xpTotalDelNivel) * 100);

    return {
        nombre: rangoActual.nombre,
        imagen: rangoActual.imagen, // <-- ¡ESTO ES LO QUE FALTABA!
        color: rangoActual.color,
        // He ajustado esto también porque tu nivel máximo ahora se llama "Leyenda II"
        xpFaltante: (rangoActual.nombre === "Leyenda II") ? 0 : (rangoSiguiente.min - xp),
        porcentajeProgreso: porcentaje,
        siguienteRango: rangoSiguiente.nombre
    };
};


/* ==========================================
   BAÚL DE ERRORES
   ========================================== */
window.guardarFallo = function(modulo, fen, solucionCorrecta, tuJugada, puzzleId) {
    let uid = localStorage.getItem('current_user_uid');
    if (!uid || typeof firebase === 'undefined') return;

    let nuevoFallo = {
        puzzleId: puzzleId || "sin_id", // 🔥 AÑADIMOS EL ID AQUÍ
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

/* ==========================================
   SISTEMA DE MISIÓN DIARIA
   ========================================== */
function avanzarMisionDiaria(categoria) {
    let hoy = new Date().toDateString();
    let mision = JSON.parse(localStorage.getItem('mision_diaria'));
    
    if (!mision || mision.fecha !== hoy) {
        mision = { fecha: hoy, tactica: 0, memoria: 0, geo: 0, reclamado: false };
    }
    
    if (mision.reclamado) return;

    if (mision[categoria] < 3) {
        mision[categoria]++;
        localStorage.setItem('mision_diaria', JSON.stringify(mision));
    }
}