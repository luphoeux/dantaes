const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const axios = require("axios");
const cors = require("cors")({ origin: true });

admin.initializeApp();

// Secretos de Blizzard
const client_id = defineSecret("BLIZZARD_CLIENT_ID");
const client_secret = defineSecret("BLIZZARD_CLIENT_SECRET");

// Caché en memoria del servidor (efímera pero ayuda a reducir llamadas)
let serverCachedToken = null;
let serverLastFetch = 0;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hora en milisegundos

exports.getwowtokenprice = onRequest({ 
    secrets: [client_id, client_secret],
    region: "us-central1" // Puedes ajustarlo a tu región preferida
}, (req, res) => {
    return cors(req, res, async () => {
        try {
            const now = Date.now();

            // Verificar si tenemos un precio válido en caché
            if (serverCachedToken && (now - serverLastFetch < CACHE_DURATION)) {
                console.log("Servidor: Devolviendo precio desde caché");
                return res.status(200).json(serverCachedToken);
            }

            const id = client_id.value();
            const secret = client_secret.value();

            if (!id || !secret) {
                console.error("Servidor: Faltan credenciales de Blizzard");
                return res.status(500).send("Error de configuración: Faltan credenciales");
            }

            console.log("Servidor: Consultando nueva data a Blizzard...");

            // 1. Obtener Token de Acceso de Blizzard (OAuth 2.0)
            const auth = Buffer.from(`${id}:${secret}`).toString("base64");
            const tokenResponse = await axios.post(
                "https://oauth.battle.net/token",
                "grant_type=client_credentials",
                {
                    headers: {
                        Authorization: `Basic ${auth}`,
                        "Content-Type": "application/x-www-form-urlencoded",
                    },
                }
            );

            const accessToken = tokenResponse.data.access_token;

            // 2. Consultar precio de la ficha (Región US, Locale es_MX)
            const priceResponse = await axios.get(
                "https://us.api.blizzard.com/data/wow/token/index?namespace=dynamic-us&locale=es_MX",
                {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                    },
                }
            );

            // 3. Actualizar la caché del servidor
            serverCachedToken = priceResponse.data;
            serverLastFetch = now;

            res.status(200).json(serverCachedToken);
        } catch (error) {
            console.error("Error en la función getwowtokenprice:", error.response?.data || error.message);
            
            // Si hay un error pero tenemos algo en caché (aunque sea viejo), lo devolvemos para que la web no falle
            if (serverCachedToken) {
                console.log("Servidor: Error en fetch, devolviendo última caché conocida.");
                return res.status(200).json(serverCachedToken);
            }

            res.status(500).json({ 
                error: "Error al consultar Blizzard", 
                message: error.message 
            });
        }
    });
});
