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
// === GESTOR DE PERFIL Y ATRIBUTOS INDIVIDUALES =========
// =======================================================

// Ya no hay nombres aleatorios. Todo a cero para los nuevos.
const PERFIL_DEFAULT = { 
    uid: "", 
    nombreJugador: "Jugador", 
    eloNormal: 1700, eloCiego: 1700,      
    xpTotal: 0, xpAciertos: 0, xpFallos: 0,
    radarJugados: 0, radarAciertos: 0,
    flashJugados: 0, flashAciertos: 0,
    memoriaJugados: 0, memoriaAciertos: 0,
    lecturaJugados: 0, lecturaAciertos: 0,
    arcadeGlobalMax: 0, stormTiempoMax: 0
};

function obtenerPerfil() {
    try {
        // Miramos quién está conectado ahora mismo
        let uid = localStorage.getItem('current_user_uid');
        if (!uid) return PERFIL_DEFAULT; // Si no hay nadie, devolvemos todo vacío
        
        // Buscamos LA CAJA FUERTE EXACTA de este usuario
        let localKey = 'chess_gym_profile_' + uid;
        let perfilStr = localStorage.getItem(localKey);
        
        if (!perfilStr) {
            // Si es su primera vez, le preparamos sus atributos a 0
            let nuevoPerfil = { ...PERFIL_DEFAULT };
            nuevoPerfil.uid = uid;
            nuevoPerfil.nombreJugador = localStorage.getItem('current_user_name') || "Jugador";
            return nuevoPerfil;
        }
        
        let perfilObj = JSON.parse(perfilStr);
        return { ...PERFIL_DEFAULT, ...perfilObj }; 
    } catch(e) {
        return PERFIL_DEFAULT;
    }
}

function guardarPerfil(perfil) { 
    try {
        let uid = localStorage.getItem('current_user_uid');
        if (!uid) return;

        // Guardamos en la caja fuerte de su PC
        let localKey = 'chess_gym_profile_' + uid;
        localStorage.setItem(localKey, JSON.stringify(perfil));
        
        // Y HACEMOS BACKUP EN LA NUBE (En su carpeta privada)
        if (typeof firebase !== 'undefined' && firebase.database) {
            firebase.database().ref('users/' + uid).set(perfil);
        }
    } catch(e) {}
}

function actualizarEstadisticaGlobal(campo, valor, esAcumulativo = false) {
    try {
        let perfil = obtenerPerfil();
        let esNuevoRecord = false;
        
        if (esAcumulativo) {
            perfil[campo] = (perfil[campo] || 0) + valor;
        } else {
            if (campo.includes('elo')) {
                perfil[campo] = valor; 
            } else if (valor > (perfil[campo] || 0)) {
                perfil[campo] = valor; 
                esNuevoRecord = true; 
            }
        }
        
        guardarPerfil(perfil);

        if (esNuevoRecord) {
            if (campo === 'arcadeGlobalMax') subirAFirebase('rankings/arcade', valor);
            if (campo === 'stormTiempoMax') subirAFirebase('rankings/stormTiempo', valor);
        }
    } catch (e) { console.warn("Error al guardar estadística", e); }
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
            const dataSubida = {
                nombre: perfil.nombreJugador,
                puntos: puntuacion,
                fecha: Date.now()
            };
            db.ref(rutaRef).child(perfil.uid).set(dataSubida);
        }
    } catch (e) {}
}// ========================================================
// MOTOR MULTIJUGADOR DE DUELOS (Sincronización de Semilla)
// ========================================================
window.DueloManager = {
    enDuelo: false,
    sala: "",
    contador: 0,
    
    iniciar: function() {
        const params = new URLSearchParams(window.location.search);
        if (params.get('duelo') === 'true') {
            this.enDuelo = true;
            this.sala = params.get('sala') || "sala_secreta";
            
            // Ocultar elementos de navegación para máxima inmersión
            setTimeout(() => {
                document.querySelectorAll('a[href="index.html"], .btn-skip, button:contains("Menú")').forEach(el => {
                    if(!el.onclick || !el.onclick.toString().includes('saltarPuzzle')) {
                        el.style.display = 'none';
                    }
                });
                
                // Carga automática de base de datos para evitar bloqueos de navegador
                const btnBase = document.getElementById('btn-defecto') || document.getElementById('btn-cargar');
                if(btnBase && btnBase.innerText !== "✅ Base cargada") btnBase.click();
            }, 500);
        }
    },

    obtenerIndiceSincronizado: function(maximo) {
        if (!this.enDuelo) return Math.floor(Math.random() * maximo);
        
        this.contador++;
        // Usamos la sala + el número de ronda como semilla única
        let semilla = this.sala + "_" + this.contador;
        let hash = 0;
        for (let i = 0; i < semilla.length; i++) {
            hash = Math.imul(31, hash) + semilla.charCodeAt(i) | 0;
        }
        return Math.abs(hash) % maximo;
    },

    enviarPuntos: function(puntos) {
        if (this.enDuelo && window.self !== window.top) {
            window.parent.postMessage({ action: 'actualizarPuntos', puntos: puntos }, '*');
        }
    }
};
window.addEventListener('DOMContentLoaded', () => { DueloManager.iniciar(); });