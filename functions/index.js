const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const axios = require("axios");
const cors = require("cors")({ origin: true });

admin.initializeApp();

// Definimos los secretos para la nueva versión de funciones (v2)
const client_id = defineSecret("BLIZZARD_CLIENT_ID");
const client_secret = defineSecret("BLIZZARD_CLIENT_SECRET");

exports.getwowtokenprice = onRequest({ secrets: [client_id, client_secret] }, (req, res) => {
    return cors(req, res, async () => {
        try {
            const id = client_id.value();
            const secret = client_secret.value();

            if (!id || !secret) {
                return res.status(500).send("Faltan credenciales de Blizzard");
            }

            // 1. Obtener Token de Acceso de Blizzard
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

            // 2. Consultar precio de la ficha
            const priceResponse = await axios.get(
                "https://us.api.blizzard.com/data/wow/token/index?namespace=dynamic-us&locale=es_MX",
                {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                    },
                }
            );

            res.status(200).json(priceResponse.data);
        } catch (error) {
            console.error("Error consultando Blizzard API:", error.response?.data || error.message);
            res.status(500).json({ error: "Error al consultar Blizzard", detail: error.message });
        }
    });
});
