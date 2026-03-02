// utils.js - Funciones globales

/**
 * Carga una base de datos JSON desde una URL por defecto o desde un input de archivo.
 * @param {string} urlDefecto - La ruta al archivo JSON (ej: 'mis_puzzles.json').
 * @param {string} btnDefectoId - El ID del botón para cargar por defecto (ej: 'btn-defecto').
 * @param {string} inputArchivoId - El ID del input tipo file (ej: 'archivoInput').
 * @param {function} callbackExito - Función que se ejecuta pasando los datos cargados.
 */
function inicializarCargaBaseDatos(urlDefecto, btnDefectoId, inputArchivoId, callbackExito) {
    const btnDefecto = document.getElementById(btnDefectoId);
    const inputArchivo = document.getElementById(inputArchivoId);

    // Carga por botón (fetch)
    if (btnDefecto) {
        btnDefecto.addEventListener('click', function() {
            let textoOriginal = this.innerText;
            this.innerText = "Cargando..."; 
            fetch(urlDefecto)
                .then(response => { 
                    if (!response.ok) throw new Error('No se encontró el archivo'); 
                    return response.json(); 
                })
                .then(data => { 
                    callbackExito(data); 
                })
                .catch(error => { 
                    alert("⚠️ Error: No se pudo cargar " + urlDefecto); 
                    this.innerText = textoOriginal; 
                });
        });
    }

    // Carga por input file
    if (inputArchivo) {
        inputArchivo.addEventListener('change', function(e) {
            const archivo = e.target.files[0]; 
            if (!archivo) return;
            const lector = new FileReader();
            lector.onload = function(evt) { 
                try {
                    const data = JSON.parse(evt.target.result);
                    callbackExito(data);
                } catch (error) {
                    alert("⚠️ Error: El archivo no es un JSON válido.");
                }
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

/**
 * Reproduce un efecto de sonido predefinido.
 * @param {string} tipo - 'correcto', 'incorrecto', 'tick', 'fin'
 */
function reproducirSonido(tipo) {
    if (sonidos[tipo]) {
        sonidos[tipo].currentTime = 0; // Reinicia el sonido por si se llama muy rápido
        // El catch evita errores en la consola si el navegador bloquea el autoplay
        sonidos[tipo].play().catch(e => console.warn("Audio bloqueado por el navegador", e));
    }
}
// --- GESTOR DE PERFIL GLOBAL (localStorage) ---
const PERFIL_KEY = 'chess_gym_profile';

// Valores por defecto si es la primera vez que el jugador entra
const PERFIL_DEFAULT = {
    eloStorm: 1700,        // ELO en Puzzle Storm (Modo Racha)
    rachaStormMax: 0,      // Racha máxima en Puzzle Storm
    scoreTiempoMax: 0,     // Puntuación máxima en Storm Tiempo
    radarJugados: 0,
    radarAciertos: 0,
    flashJugados: 0,
    flashAciertos: 0,
    memoriaJugados: 0,
    memoriaAciertos: 0,
    arcadeCiegoMax: 0,
    arcadeVozMax: 0
};

/**
 * Obtiene el perfil actual del jugador.
 */
function obtenerPerfil() {
    let perfil = localStorage.getItem(PERFIL_KEY);
    if (!perfil) return PERFIL_DEFAULT;
    // Hacemos un merge por si en el futuro añadimos nuevos juegos al PERFIL_DEFAULT
    return { ...PERFIL_DEFAULT, ...JSON.parse(perfil) }; 
}

/**
 * Guarda el perfil actualizado.
 */
function guardarPerfil(perfil) {
    localStorage.setItem(PERFIL_KEY, JSON.stringify(perfil));
}