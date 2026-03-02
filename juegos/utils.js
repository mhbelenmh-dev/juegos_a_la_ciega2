// utils.js - Funciones globales, Perfil y Ranking en la Nube

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

// --- GESTOR DE AUDIO GLOBAL ---
const sonidos = {
    correcto: new Audio('https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/capture.mp3'),
    incorrecto: new Audio('https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/illegal.mp3'),
    tick: new Audio('https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/tenseconds.mp3'),
    fin: new Audio('https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/game-end.mp3')
};

function reproducirSonido(tipo) {
    try {
        if (sonidos[tipo]) {
            sonidos[tipo].currentTime = 0; 
            sonidos[tipo].play().catch(e => console.warn("Audio bloqueado", e));
        }
    } catch(e) {}
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

try {
    if (typeof firebase !== 'undefined' && !firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
} catch(e) {
    console.warn("Aviso: No se pudo conectar a Firebase.");
}

// =======================================================
// === GESTOR DE PERFIL Y ATRIBUTOS ======================
// =======================================================
const PERFIL_KEY = 'chess_gym_profile'; 

// NUEVO: Estructura de datos ampliada
const PERFIL_DEFAULT = { 
    uid: "jugador_" + Math.floor(Math.random() * 999999999), 
    nombreJugador: "Anonimo_" + Math.floor(Math.random() * 1000), 
    
    // 1. ELO Táctico
    eloNormal: 1700,        
    eloCiego: 1700,      
    
    // 2. Experiencia (Gimnasio)
    xpTotal: 0,
    xpAciertos: 0,
    xpFallos: 0,

    // 3. Precisión Visual (Intentos y Aciertos)
    radarJugados: 0, radarAciertos: 0,
    flashJugados: 0, flashAciertos: 0,
    memoriaJugados: 0, memoriaAciertos: 0,
    lecturaJugados: 0, lecturaAciertos: 0,

    // 4. Récords de Competición
    arcadeGlobalMax: 0, // Unifica Teclado y Voz
    stormTiempoMax: 0
};

function obtenerPerfil() {
    try {
        let perfilStr = localStorage.getItem(PERFIL_KEY);
        if (!perfilStr) return PERFIL_DEFAULT;
        let perfilObj = JSON.parse(perfilStr);
        if (!perfilObj.uid) perfilObj.uid = "jugador_" + Math.floor(Math.random() * 999999999);
        return { ...PERFIL_DEFAULT, ...perfilObj }; 
    } catch(e) {
        localStorage.removeItem(PERFIL_KEY);
        return PERFIL_DEFAULT;
    }
}

function guardarPerfil(perfil) { 
    try {
        localStorage.setItem(PERFIL_KEY, JSON.stringify(perfil));
    } catch(e) {}
}

// --- FUNCIÓN 1: ACTUALIZAR ESTADÍSTICAS Y RÉCORDS ---
function actualizarEstadisticaGlobal(campo, valor, esAcumulativo = false) {
    try {
        let perfil = obtenerPerfil();
        let esNuevoRecord = false;
        
        if (esAcumulativo) {
            perfil[campo] = (perfil[campo] || 0) + valor;
        } else {
            if (campo.includes('elo')) {
                perfil[campo] = valor; // El ELO puede subir o bajar
            } else if (valor > (perfil[campo] || 0)) {
                perfil[campo] = valor; 
                esNuevoRecord = true; // Récord superado
            }
        }
        
        guardarPerfil(perfil);

        // Subidas a las tablas de récords
        if (esNuevoRecord) {
            if (campo === 'arcadeGlobalMax') subirAFirebase('rankings/arcade', valor);
            if (campo === 'stormTiempoMax') subirAFirebase('rankings/stormTiempo', valor);
        }
    } catch (e) { console.warn("Error al guardar estadística", e); }
}

// --- FUNCIÓN 2: MOTOR DE EXPERIENCIA (XP) ---
/**
 * @param {string} dificultad - 'basico', 'medio', 'avanzado', 'maestro'
 * @param {boolean} exito - true si acierta, false si falla
 */
function registrarXP(dificultad, exito) {
    let pts = 0;
    if (dificultad === 'basico') pts = exito ? 2 : 1;
    else if (dificultad === 'medio') pts = exito ? 4 : 2;
    else if (dificultad === 'avanzado') pts = exito ? 6 : 3;
    else if (dificultad === 'maestro') pts = exito ? 10 : 5;

    actualizarEstadisticaGlobal('xpTotal', pts, true);
    if (exito) actualizarEstadisticaGlobal('xpAciertos', pts, true);
    else actualizarEstadisticaGlobal('xpFallos', pts, true);

    // Cada vez que ganamos XP, actualizamos nuestro lugar en el ranking de Constancia
    let perfil = obtenerPerfil();
    subirAFirebase('rankings/xp', perfil.xpTotal);
}

// --- FUNCIÓN DE APOYO PARA FIREBASE ---
function subirAFirebase(rutaRef, puntuacion) {
    try {
        if (typeof firebase !== 'undefined') {
            const perfil = obtenerPerfil();
            const db = firebase.database();
            const dataSubida = {
                nombre: perfil.nombreJugador,
                puntos: puntuacion,
                fecha: Date.now()
            };
            db.ref(rutaRef).child(perfil.uid).set(dataSubida);
        }
    } catch (e) {}
}