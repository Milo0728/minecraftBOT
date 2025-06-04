const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const stringSimilarity = require('string-similarity');
const axios = require('axios');

// ==== CONFIGURACIONES ====
const usuarios = JSON.parse(fs.readFileSync('../frontend/data/usuarios.json', 'utf8'));
const usuariosPermitidos = usuarios.map(u => u.telefono);
const corpus = JSON.parse(fs.readFileSync('../frontend/data/corpus.json', 'utf8'));
const RATE_LIMIT = 20;
const messageCache = new Map();
let messageCount = 0;

// ==== FUNCIONES DE UTILIDAD ====
function eliminarQR() {
    const qrFile = path.join(__dirname, '../frontend/static/qr.svg');
    if (fs.existsSync(qrFile)) fs.unlinkSync(qrFile);
}

function esperar(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function limpiarCache() {
    console.log(`📊 Mensajes respondidos en el último minuto: ${messageCount}`);
    messageCache.clear();
    messageCount = 0;
}
setInterval(limpiarCache, 60 * 1000);

// ==== NLP SIMPLE ====
function limpiarTexto(texto) {
    return texto
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9\s]/g, "")
        .trim();
}

function buscarRespuesta(inputUsuario) {
    const inputLimpio = limpiarTexto(inputUsuario);
    let mejorCoincidencia = { puntuacion: 0, respuesta: "" };

    corpus.forEach(item => {
        const preguntaLimpia = limpiarTexto(item.pregunta);
        const puntuacion = stringSimilarity.compareTwoStrings(inputLimpio, preguntaLimpia);
        if (puntuacion > mejorCoincidencia.puntuacion) {
            mejorCoincidencia = { puntuacion, respuesta: item.respuesta };
        }
    });

    // Si la similitud no supera el umbral, se considera "no entendida"
    const UMBRAL_MINIMO = 0.6;
    if (mejorCoincidencia.puntuacion < UMBRAL_MINIMO) {
        return "Lo siento, no entendí tu pregunta. ¿Puedes reformularla?";
    }

    return mejorCoincidencia.respuesta;
}

function registrarNoEntendida(pregunta, usuario) {
    const filePath = path.join(__dirname, '../frontend/data/no_entendidas.json');
    const intento = {
        usuario,
        pregunta,
        fecha: new Date().toISOString()
    };

    try {
        const contenido = fs.existsSync(filePath)
            ? JSON.parse(fs.readFileSync(filePath, 'utf8'))
            : [];
        contenido.push(intento);
        fs.writeFileSync(filePath, JSON.stringify(contenido, null, 2));
        console.log(`🟡 Pregunta no entendida registrada: ${pregunta}`);
    } catch (error) {
        console.error('❌ No se pudo registrar la pregunta no entendida:', error.message);
    }
}

// ==== BIENVENIDA ====
async function enviarBienvenida(client) {
    const imagen = MessageMedia.fromFilePath('./promocion.png');
    let usuarios = [];

    try {
        usuarios = JSON.parse(fs.readFileSync('../frontend/data/usuarios.json', 'utf8'));
        console.log(`📚 ${usuarios.length} usuarios cargados para enviar bienvenida.`);
    } catch (e) {
        console.error('❌ No se pudo cargar usuarios.json:', e.message);
        return;
    }

    for (const u of usuarios) {
        console.log(`➡️ Intentando enviar bienvenida a ${u.nombre} (${u.telefono})`);

        try {
            if (!/^\d{10,15}$/.test(u.telefono)) {
                console.warn(`⚠️ Número inválido: ${u.telefono}`);
                continue;
            }

            const chatId = u.telefono + '@c.us';
            const esValido = await client.isRegisteredUser(chatId);
            console.log(`🔍 ¿${chatId} tiene WhatsApp?:`, esValido);

            if (!esValido) {
                console.warn(`⛔ ${u.telefono} no está registrado en WhatsApp.`);
                continue;
            }

            const mensaje = `¡Hola ${u.nombre}! 👋 Bienvenido al bot de soporte de nuestra comunidad de Minecraft. 🧱🌍

Aquí puedes preguntar sobre comandos, servidores, trucos y más. 🤖

📌 Ejemplos de preguntas que puedes hacer:

- ¿Cómo consigo diamantes rápido?
- ¿Cuál es el comando para volar?
- ¿Cómo me uno al servidor?
- ¿Qué versión usan?
- ¿Se puede usar mods?
- ¿Qué hago si me banearon?
- ¿Cómo protejo mi casa?
- ¿Hay eventos activos?
- ¿Qué permisos tiene el rango VIP?
- ¿Cómo cambio mi skin?

¡Escríbeme y te ayudaré encantado! 🚀`;


            await client.sendMessage(chatId, mensaje);
            console.log(`📤 Texto enviado a ${chatId}`);

            await client.sendMessage(chatId, imagen);
            console.log(`🖼 Imagen enviada a ${chatId}`);

        } catch (err) {
            console.error(`❌ Error al enviar a ${u.nombre} (${u.telefono}):`, err.message);
        }
    }
}

// ==== INICIO DEL BOT ====
async function iniciarBot() {
    try {
        const client = new Client({
            authStrategy: new LocalAuth()
        });

        client.on('qr', (qr) => {
            const qrImagePath = path.join(__dirname, '../frontend/static/qr.svg');
            const QRCode = require('qrcode-svg');
            const svg = new QRCode(qr).svg();
            fs.writeFileSync(qrImagePath, svg);
            console.log(`✅ QR generado y guardado en: ${qrImagePath}`);
            console.log('\n📲 Escanea el QR desde el panel web...\n');
        });

        client.on('ready', async () => {
            console.log('✅ Bot de WhatsApp conectado exitosamente.');
            eliminarQR();

            try {
                await axios.post('http://localhost:5000/api/whatsapp-activar');
                console.log('🟢 Estado del bot actualizado en el backend.');
            } catch (e) {
                console.error('❌ No se pudo actualizar estado del bot en backend:', e.message);
            }

            await enviarBienvenida(client);
        });

        client.on('disconnected', async () => {
            console.log('⚠️ Bot desconectado. Eliminando sesión...');
            eliminarQR();

            try {
                await axios.post('http://localhost:5000/api/whatsapp-desactivar');
                console.log('🔴 Estado actualizado a inactivo en backend (disconnected).');
            } catch (e) {
                console.error('❌ No se pudo desactivar en backend (disconnected):', e.message);
            }
        });

        client.on('auth_failure', async (msg) => {
            console.error('❌ Fallo de autenticación:', msg);

            try {
                await axios.post('http://localhost:5000/api/whatsapp-desactivar');
                console.log('🔴 Estado actualizado a inactivo en backend (auth_failure).');
            } catch (e) {
                console.error('❌ No se pudo desactivar en backend (auth_failure):', e.message);
            }
        });

        client.on('change_state', (state) => {
            console.log('🔄 Estado del cliente cambiado a:', state);
        });

        client.on('message', async (message) => {
            console.log('📥 Mensaje recibido:', message.body, 'de', message.from);

            // Ignora mensajes de grupos
            if (message.from.endsWith('@g.us')) {
                console.log('👥 Mensaje de grupo ignorado:', message.from);
                return;
            }

            // Extraer número sin "@c.us"
            const numero = message.from.split('@')[0];

            // Cargar usuarios actualizados desde el archivo en tiempo real
            let usuariosActualizados = [];
            try {
                usuariosActualizados = JSON.parse(fs.readFileSync('../frontend/data/usuarios.json', 'utf8')).map(u => u.telefono);
            } catch (e) {
                console.error('❌ No se pudo cargar users.json dinámicamente:', e.message);
            }

            // Verificar autorización
            if (!usuariosActualizados.includes(numero)) {
                console.log(`⛔ Ignorando mensaje de ${message.from} (no autorizado)`);
                return;
            }

            const key = `${message.from}-${message.body}`;

            if (message.body && message.body.length > 1 && !messageCache.has(key)) {
                if (messageCount >= RATE_LIMIT) {
                    console.log(`⚠️ Límite de mensajes alcanzado. Ignorando a ${message.from}`);
                    return;
                }

                messageCache.set(key, true);
                messageCount++;

                try {
                    const respuesta = buscarRespuesta(message.body);

                    if (respuesta.startsWith("Lo siento")) {
                        registrarNoEntendida(message.body, message.from);
                    }

                    const delay = Math.floor(Math.random() * 1000) + 500;
                    await esperar(delay);
                    await client.sendMessage(message.from, respuesta);
                    console.log(`✅ Respuesta enviada a ${message.from}`);
                } catch (error) {
                    console.error('❌ Error al responder:', error.message);
                    await esperar(500);
                    await client.sendMessage(message.from, 'Ocurrió un error. Intenta más tarde.');
                }
            }
        });


        client.initialize();

    } catch (error) {
        console.error('❌ No se pudo iniciar el bot:', error.message);
    }
}

iniciarBot();
