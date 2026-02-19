const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuración - Ajusta estos valores si es necesario
// NO DEJES TUS CREDENCIALES AQUÍ SI VAS A SUBIR EL CÓDIGO A GITHUB
const BLIZZARD_CLIENT_ID = process.env.BLIZZARD_CLIENT_ID || 'TU_CLIENT_ID';
const BLIZZARD_CLIENT_SECRET = process.env.BLIZZARD_CLIENT_SECRET || 'TU_CLIENT_SECRET';
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ2CquzL6RCPdBne9xwX4c400vHeIn018aY5vdV9k00PNuy0VIoeiaNTEIYL4XqWAgk__QjPTsFwx11/pub?gid=260947743&single=true&output=tsv';

async function getAccessToken() {
    const auth = Buffer.from(`${BLIZZARD_CLIENT_ID}:${BLIZZARD_CLIENT_SECRET}`).toString('base64');
    const response = await axios.post('https://oauth.battle.net/token', 'grant_type=client_credentials', {
        headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    });
    return response.data.access_token;
}

async function fetchItemData(itemId, token) {
    try {
        console.log(`Descargando datos del ítem: ${itemId}...`);
        const itemRes = await axios.get(`https://us.api.blizzard.com/data/wow/item/${itemId}?namespace=static-us&locale=es_MX`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const mediaRes = await axios.get(`https://us.api.blizzard.com/data/wow/media/item/${itemId}?namespace=static-us&locale=es_MX`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const iconAsset = mediaRes.data.assets.find(a => a.key === 'icon');
        
        return {
            id: itemId,
            name: itemRes.data.name,
            quality: itemRes.data.quality.type,
            icon: iconAsset ? iconAsset.value : null,
            level: itemRes.data.level,
            item_class: itemRes.data.item_class.name,
            item_subclass: itemRes.data.item_subclass ? itemRes.data.item_subclass.name : 'Objeto',
            sell_price: itemRes.data.sell_price || 0,
            description: itemRes.data.description || null
        };
    } catch (e) {
        console.error(`Error con el ítem ${itemId}: ${e.message}`);
        return null;
    }
}

async function main() {
    try {
        console.log('1. Obteniendo lista de ítems desde Google Sheets...');
        const sheetRes = await axios.get(SHEET_URL);
        const lines = sheetRes.data.trim().split('\n');
        const headers = lines[0].split('\t');
        const idIdx = headers.findIndex(h => h.trim().toLowerCase().includes('id'));
        
        const ids = [...new Set(lines.slice(1).map(line => {
            const cols = line.split('\t');
            return parseInt(cols[idIdx]) || 0;
        }).filter(id => id > 0))];
        
        console.log(`Encontrados ${ids.length} ítems únicos.`);
        
        console.log('2. Obteniendo token de acceso de Blizzard...');
        const token = await getAccessToken();
        
        const metadata = {};
        
        // Descargar uno por uno para no saturar la API
        for (const id of ids) {
            const data = await fetchItemData(id, token);
            if (data) {
                metadata[id] = data;
            }
            // Pequeña pausa
            await new Promise(r => setTimeout(r, 100));
        }
        
        console.log('3. Guardando metadatos en js/items_metadata.json...');
        const outputPath = path.join(__dirname, 'js', 'items_metadata.json');
        fs.writeFileSync(outputPath, JSON.stringify(metadata, null, 2));
        
        console.log('¡Proceso completado con éxito!');
        console.log(`Archivo guardado en: ${outputPath}`);
        
    } catch (e) {
        console.error('Error general:', e);
    }
}

main();
