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

exports.getwowtokenprice = onRequest(
  {
    secrets: [client_id, client_secret],
    region: "us-central1", // Puedes ajustarlo a tu región preferida
  },
  (req, res) => {
    return cors(req, res, async () => {
      try {
        const now = Date.now();

        // Verificar si tenemos un precio válido en caché
        if (serverCachedToken && now - serverLastFetch < CACHE_DURATION) {
          console.log("Servidor: Devolviendo precio desde caché");
          return res.status(200).json(serverCachedToken);
        }

        const id = client_id.value();
        const secret = client_secret.value();

        if (!id || !secret) {
          console.error("Servidor: Faltan credenciales de Blizzard");
          return res
            .status(500)
            .send("Error de configuración: Faltan credenciales");
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
        console.error(
          "Error en la función getwowtokenprice:",
          error.response?.data || error.message
        );

        // Si hay un error pero tenemos algo en caché (aunque sea viejo), lo devolvemos para que la web no falle
        if (serverCachedToken) {
          console.log(
            "Servidor: Error en fetch, devolviendo última caché conocida."
          );
          return res.status(200).json(serverCachedToken);
        }

        res.status(500).json({
          error: "Error al consultar Blizzard",
          message: error.message,
        });
      }
    });
  }
);

/**
 * Función para obtener detalles de un ítem (Nombre, Calidad e Ícono)
 * Utiliza Firestore para cachear los resultados de forma permanente.
 */
exports.getitemdetails = onRequest(
  {
    secrets: [client_id, client_secret],
    region: "us-central1",
  },
  (req, res) => {
    return cors(req, res, async () => {
      const itemId = req.query.id;
      if (!itemId) return res.status(400).send("Falta el ID del ítem");

      try {
        let db = null;
        let doc = { exists: false };

        // Intentar usar Firestore si está habilitado
        try {
          db = admin.firestore();
          const itemRef = db.collection("items_cache").doc(itemId.toString());
          doc = await itemRef.get();
        } catch (fsError) {
          console.warn("Firestore no disponible o sin permisos, saltando caché.");
        }

        // 1. Verificar si está en caché (Firestore)
        if (doc.exists) {
          console.log(`Servidor: Item ${itemId} encontrado en caché Firestore`);
          return res.status(200).json(doc.data());
        }

        // 2. Si no está, pedir Token a Blizzard
        const id = client_id.value();
        const secret = client_secret.value();
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

        console.log(`Servidor: Consultando item ${itemId} a Blizzard...`);

        // 3. Consultar datos básicos (Calidad, Nombre)
        const itemResponse = await axios.get(
          `https://us.api.blizzard.com/data/wow/item/${itemId}?namespace=static-us&locale=es_MX`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        // 4. Consultar medios (Ícono)
        const mediaResponse = await axios.get(
          `https://us.api.blizzard.com/data/wow/media/item/${itemId}?namespace=static-us&locale=es_MX`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        // 5. Estructurar respuesta
        const iconAsset = mediaResponse.data.assets.find((a) => a.key === "icon");
        const result = {
          id: itemId,
          name: itemResponse.data.name,
          quality: itemResponse.data.quality.type,
          icon: iconAsset ? iconAsset.value : null,
          level: itemResponse.data.level,
          item_class: itemResponse.data.item_class.name,
          item_subclass: itemResponse.data.item_subclass ? itemResponse.data.item_subclass.name : "Objeto",
          sell_price: itemResponse.data.sell_price || 0,
          max_stack_size: itemResponse.data.max_stack_size || 1,
          description: itemResponse.data.description || null,
          last_updated: Date.now(),
        };

        // 6. Guardar en caché permanente (si Firestore funciona)
        if (db) {
          try {
            await db.collection("items_cache").doc(itemId.toString()).set(result);
          } catch (e) {
            console.error("No se pudo guardar en Firestore:", e.message);
          }
        }

        res.status(200).json(result);
      } catch (error) {
        console.error(`Error al obtener item ${itemId}:`, error.response?.data || error.message);
        res.status(500).json({
          error: "No se pudo obtener el ítem",
          message: error.message,
        });
      }
    });
  }
);

// Función para obtener precio de subasta de un ítem
exports.getauctionprice = onRequest(
  {
    secrets: [client_id, client_secret],
    region: "us-central1",
  },
  (req, res) => {
    return cors(req, res, async () => {
      const itemId = req.query.id;
      if (!itemId) return res.status(400).send("Falta el ID del ítem");

      try {
        let db = null;
        let doc = { exists: false };

        // Intentar usar Firestore para caché (1 hora)
        try {
          db = admin.firestore();
          const cacheRef = db.collection("auction_cache").doc(itemId.toString());
          doc = await cacheRef.get();
          
          if (doc.exists) {
            const data = doc.data();
            const now = Date.now();
            // Cache válido por 6 horas
            if (data.timestamp && (now - data.timestamp) < 21600000) {
              console.log(`Precio de subasta ${itemId} desde caché`);
              return res.status(200).json(data);
            }
          }
        } catch (fsError) {
          console.warn("Firestore no disponible, saltando caché.");
        }

        const id = client_id.value();
        const secret = client_secret.value();

        if (!id || !secret) {
          return res.status(500).send("Error: Faltan credenciales");
        }

        // 1. Obtener Token de Acceso
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

        // 2. Consultar datos de subasta (commodities para NA)
        const auctionResponse = await axios.get(
          `https://us.api.blizzard.com/data/wow/auctions/commodities?namespace=dynamic-us&locale=es_MX`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        // 3. Buscar el ítem en las subastas
        const auctions = auctionResponse.data.auctions || [];
        const itemAuctions = auctions.filter(a => a.item && a.item.id === parseInt(itemId));

        let price = 0;
        let quantity = 0;

        if (itemAuctions.length > 0) {
          // Obtener el precio más bajo y cantidad total
          const prices = itemAuctions.map(a => a.unit_price || a.buyout || 0);
          price = Math.min(...prices.filter(p => p > 0));
          quantity = itemAuctions.reduce((sum, a) => sum + (a.quantity || 0), 0);
        }

        const result = {
          itemId: parseInt(itemId),
          price: price / 10000, // Convertir de cobre a oro (mantener decimales para plata)
          quantity: quantity,
          timestamp: Date.now()
        };

        // 4. Guardar en caché
        if (db) {
          try {
            await db.collection("auction_cache").doc(itemId.toString()).set(result);
          } catch (e) {
            console.error("No se pudo guardar en caché:", e.message);
          }
        }

        res.status(200).json(result);
      } catch (error) {
        console.error(`Error al obtener precio de subasta ${itemId}:`, error.response?.data || error.message);
        res.status(500).json({
          error: "No se pudo obtener el precio",
          message: error.message,
        });
      }
    });
  }
);
