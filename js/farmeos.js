// URL del Google Sheet (TSV) - Farmeos Sugeridos
const FARMEOS_SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ2CquzL6RCPdBne9xwX4c400vHeIn018aY5vdV9k00PNuy0VIoeiaNTEIYL4XqWAgk__QjPTsFwx11/pub?gid=260947743&single=true&output=tsv';

let farmeosData = [];
let priceCache = {};
let sortState = { column: null, ascending: true };

// LocalStorage para persistir precios
const STORAGE_KEY = 'farmeos_prices';
const STORAGE_EXPIRY = 6 * 60 * 60 * 1000; // 6 horas

function loadPricesFromStorage() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const data = JSON.parse(stored);
            const now = Date.now();
            if (data.timestamp && (now - data.timestamp) < STORAGE_EXPIRY) {
                priceCache = data.prices || {};
                console.log('Precios cargados desde localStorage');
                return true;
            }
        }
    } catch (e) {
        console.error('Error loading from localStorage:', e);
    }
    return false;
}

function savePricesToStorage() {
    try {
        const data = {
            prices: priceCache,
            timestamp: Date.now(),
            lastUpdate: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
        console.error('Error saving to localStorage:', e);
    }
}

// Helpers
function formatGold(amount) {
    if (!amount || amount === 0) return '<span class="text-gray-600">--</span>';
    
    // amount viene en oro con decimales (ej: 20.95 = 20 oro 95 plata)
    const gold = Math.floor(amount);
    const silver = Math.round((amount - gold) * 100);
    
    let html = '';
    if (gold > 0) {
        html += `${gold.toLocaleString('es-ES')} <img src="https://wow.zamimg.com/images/icons/money-gold.gif" class="inline w-4 h-4" alt="oro">`;
    }
    if (silver > 0) {
        if (gold > 0) html += ' ';
        html += `${silver} <img src="https://wow.zamimg.com/images/icons/money-silver.gif" class="inline w-4 h-4" alt="plata">`;
    }
    
    return html || '<span class="text-gray-600">--</span>';
}

// Fetch farmeos from Google Sheet
async function fetchFarmeosData() {
    try {
        const response = await fetch(FARMEOS_SHEET_URL);
        const text = await response.text();
        const lines = text.trim().split('\n');
        const headers = lines[0].split('\t');
        
        const rawData = lines.slice(1).map(line => {
            const values = line.split('\t');
            const obj = {};
            headers.forEach((h, i) => obj[h.trim()] = values[i]?.trim() || '');
            return obj;
        });

        farmeosData = rawData
            .map(d => ({
                name: d['Item'] || d['Nombre'] || d['Ítem'],
                itemId: parseInt(d['Id Wowhead'] || d['ID'] || d['Id']) || 0,
                icon: d['Link icono'] || d['Icono'] || d['Link Icono'] || '',
                youtubeUrl: d['Link YouTube'] || d['Tutorial'] || d['YouTube'] || d['Link Youtube'] || ''
            }))
            .filter(item => item.name && item.itemId > 0); // Solo items con nombre e ID válido

        console.log(`Loaded ${farmeosData.length} farmeos válidos de ${rawData.length} filas`);
        
        // Cargar precios desde localStorage primero
        const hasStoredPrices = loadPricesFromStorage();
        
        // Renderizar tabla
        renderFarmeosTable();
        
        // Si hay precios guardados, mostrarlos inmediatamente
        if (hasStoredPrices) {
            farmeosData.forEach(item => {
                if (priceCache[item.itemId]) {
                    updateItemPrice(item.itemId, priceCache[item.itemId]);
                }
            });
            
            // Mostrar hora de última actualización desde localStorage
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const data = JSON.parse(stored);
                if (data.lastUpdate) {
                    const el = document.getElementById('last-update-time');
                    if (el) el.textContent = data.lastUpdate;
                }
            }
            
            // DETECTAR ITEMS NUEVOS:
            // Filtrar items que están en la hoja pero NO en el caché
            const newItems = farmeosData.filter(item => !priceCache[item.itemId]);
            
            if (newItems.length > 0) {
                console.log(`⚠️ Detectados ${newItems.length} items nuevos sin precio. Buscando sus datos...`);
                // Solo buscamos los nuevos para no sobrecargar
                fetchAllPrices(newItems); 
            } else {
                console.log('Precios cargados desde localStorage - Todos los items están al día');
            }

        } else {
            // Solo actualizar desde API si NO hay caché
            console.log('No hay caché - Cargando precios desde API...');
            fetchAllPrices(farmeosData);
        }
    } catch (e) {
        console.error('Error loading farmeos:', e);
    }
}

// Fetch auction price from Blizzard API con retry
async function fetchAuctionPrice(itemId, retries = 2) {
    if (priceCache[itemId]) return priceCache[itemId];
    
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const response = await fetch(`/api/auction-price?id=${itemId}`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data && data.price !== undefined) {
                priceCache[itemId] = {
                    price: data.price,
                    quantity: data.quantity || 0
                };
                return priceCache[itemId];
            }
        } catch (e) {
            console.error(`Error fetching price for ${itemId} (attempt ${attempt + 1}/${retries + 1}):`, e);
            if (attempt < retries) {
                // Esperar antes de reintentar
                await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
            }
        }
    }
    return null;
}

// Procesar en lotes para evitar sobrecarga
// Procesar en lotes para evitar sobrecarga
async function fetchAllPrices(itemsToFetch = farmeosData) {
    const BATCH_SIZE = 3; // Procesar 3 items a la vez
    // Filtrar items válidos de la lista proporcionada
    const items = itemsToFetch.filter(item => item.itemId);
    
    console.log(`Actualizando precios de ${items.length} items...`);
    
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
        const batch = items.slice(i, i + BATCH_SIZE);
        
        // Procesar lote en paralelo
        const promises = batch.map(async (item) => {
            const priceData = await fetchAuctionPrice(item.itemId);
            updateItemPrice(item.itemId, priceData);
        });
        
        await Promise.all(promises);
        
        // Pequeña pausa entre lotes
        if (i + BATCH_SIZE < items.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    
    // Guardar en localStorage después de actualizar
    savePricesToStorage();
    updateLastUpdateTime();
    console.log('Precios actualizados correctamente');
}

function updateItemPrice(itemId, priceData) {
    const priceEl = document.getElementById(`price-${itemId}`);
    const qtyEl = document.getElementById(`qty-${itemId}`);
    
    if (priceEl && priceData) {
        // Guardar precio original con decimales para plata
        const priceWithDecimals = priceData.price + (priceData.silver || 0) / 100;
        priceEl.innerHTML = formatGold(priceWithDecimals);
        priceEl.classList.remove('animate-pulse', 'text-gray-500');
        priceEl.classList.add('text-white');
        
        // Actualizar caché con precio completo
        if (priceCache[itemId]) {
            priceCache[itemId].priceWithDecimals = priceWithDecimals;
        }
    }
    
    if (qtyEl && priceData) {
        qtyEl.textContent = priceData.quantity.toLocaleString('es-ES');
        qtyEl.classList.remove('text-gray-600');
        qtyEl.classList.add('text-gray-400');
    }
}

function updateLastUpdateTime() {
    const el = document.getElementById('last-update-time');
    if (el) {
        const now = new Date();
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        el.textContent = `${hours}:${minutes}`;
    }
}

function sortTable(column) {
    // No hacer llamadas a la API, solo reordenar datos existentes
    if (sortState.column === column) {
        sortState.ascending = !sortState.ascending;
    } else {
        sortState.column = column;
        sortState.ascending = true;
    }
    
    const sorted = [...farmeosData].sort((a, b) => {
        let valA, valB;
        
        if (column === 'name') {
            valA = a.name.toLowerCase();
            valB = b.name.toLowerCase();
            return sortState.ascending ? valA.localeCompare(valB) : valB.localeCompare(valA);
        } else if (column === 'price') {
            valA = priceCache[a.itemId]?.priceWithDecimals || priceCache[a.itemId]?.price || 0;
            valB = priceCache[b.itemId]?.priceWithDecimals || priceCache[b.itemId]?.price || 0;
        } else if (column === 'quantity') {
            valA = priceCache[a.itemId]?.quantity || 0;
            valB = priceCache[b.itemId]?.quantity || 0;
        }
        
        return sortState.ascending ? valA - valB : valB - valA;
    });
    
    // Solo re-renderizar, no volver a cargar precios
    renderFarmeosTableFast(sorted);
}

function getSortIcon(column) {
    if (sortState.column !== column) {
        return '<i class="fas fa-sort text-gray-600 text-xs ml-1"></i>';
    }
    return sortState.ascending 
        ? '<i class="fas fa-sort-up text-wow-blue text-xs ml-1"></i>'
        : '<i class="fas fa-sort-down text-wow-blue text-xs ml-1"></i>';
}

function renderFarmeosTable(dataToRender = null) {
    const tbody = document.getElementById('farmeos-table-body');
    const thead = document.querySelector('#farmeos-table-body').closest('table').querySelector('thead tr');
    
    if (!tbody) return;
    
    const data = dataToRender || farmeosData;
    if (data.length === 0) return;
    
    // Update headers with sort buttons
    if (thead) {
        thead.innerHTML = `
            <th class="py-1.5 px-2 md:py-3 md:px-4">
                <button onclick="sortTable('name')" class="flex items-center hover:text-white transition-colors">
                    Ítem ${getSortIcon('name')}
                </button>
            </th>
            <th class="py-1.5 px-2 md:py-3 md:px-4 text-left">
                <button onclick="sortTable('price')" class="flex items-center hover:text-white transition-colors">
                    Precio Subasta ${getSortIcon('price')}
                </button>
            </th>
            <th class="py-1.5 px-2 md:py-3 md:px-4 text-left">
                <button onclick="sortTable('quantity')" class="flex items-center hover:text-white transition-colors">
                    Disponible ${getSortIcon('quantity')}
                </button>
            </th>
            <th class="py-1.5 px-2 md:py-3 md:px-4 text-left">Tutorial</th>
        `;
    }
    
    tbody.innerHTML = data.map(item => `
        <tr class="hover:bg-white/[0.02] transition-colors">
            <td class="py-1.5 px-2 md:py-3 md:px-4">
                <div class="flex items-center gap-2">
                    <div class="w-8 h-8 md:w-10 md:h-10 rounded border border-wow-border bg-wow-dark overflow-hidden flex-shrink-0">
                        <img src="${item.icon || 'https://wow.zamimg.com/images/wow/icons/large/inv_misc_questionmark.jpg'}" 
                             class="w-full h-full object-cover" alt="${item.name}">
                    </div>
                    <span class="font-bold text-white text-xs md:text-base text-wrap leading-tight max-w-[120px] md:max-w-none">${item.name}</span>
                </div>
            </td>
            <td class="py-1.5 px-2 md:py-3 md:px-4 text-left whitespace-nowrap">
                <div id="price-${item.itemId}" class="font-bold text-gray-500 animate-pulse text-xs md:text-base">Cargando...</div>
            </td>
            <td class="py-1.5 px-2 md:py-3 md:px-4 text-left whitespace-nowrap">
                <span id="qty-${item.itemId}" class="text-gray-600 text-xs md:text-base">--</span>
            </td>
            <td class="py-1.5 px-2 md:py-3 md:px-4 text-left">
                ${item.youtubeUrl ? `
                    <a href="${item.youtubeUrl}" target="_blank" 
                       class="inline-flex items-center gap-1.5 px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded md:rounded-lg transition-colors text-[10px] md:text-sm font-semibold text-gray-300">
                        <i class="fab fa-youtube"></i>
                        <span class="hidden md:inline">Ver Tutorial</span>
                        <span class="md:hidden">Ver</span>
                    </a>
                ` : '<span class="text-gray-600 text-[10px] md:text-xs">Próximamente...</span>'}
            </td>
        </tr>
    `).join('');
}

// Versión rápida que solo actualiza tbody (para ordenamiento)
function renderFarmeosTableFast(dataToRender) {
    const tbody = document.getElementById('farmeos-table-body');
    if (!tbody || !dataToRender || dataToRender.length === 0) return;
    
    // Solo actualizar tbody, mantener precios ya cargados
    tbody.innerHTML = dataToRender.map(item => {
        const cachedPrice = priceCache[item.itemId];
        const priceDisplay = cachedPrice 
            ? formatGold(cachedPrice.priceWithDecimals || cachedPrice.price)
            : '<span class="animate-pulse text-gray-500 text-xs">Cargando...</span>';
        const qtyDisplay = cachedPrice 
            ? cachedPrice.quantity.toLocaleString('es-ES')
            : '--';
        
        return `
        <tr class="hover:bg-white/[0.02] transition-colors">
            <td class="py-1.5 px-2 md:py-3 md:px-4">
                <div class="flex items-center gap-2">
                    <div class="w-8 h-8 md:w-10 md:h-10 rounded border border-wow-border bg-wow-dark overflow-hidden flex-shrink-0">
                        <img src="${item.icon || 'https://wow.zamimg.com/images/wow/icons/large/inv_misc_questionmark.jpg'}" 
                             class="w-full h-full object-cover" alt="${item.name}">
                    </div>
                    <span class="font-bold text-white text-xs md:text-base text-wrap leading-tight max-w-[120px] md:max-w-none">${item.name}</span>
                </div>
            </td>
            <td class="py-1.5 px-2 md:py-3 md:px-4 text-left whitespace-nowrap">
                <div class="font-bold text-white text-xs md:text-base">${priceDisplay}</div>
            </td>
            <td class="py-1.5 px-2 md:py-3 md:px-4 text-left whitespace-nowrap">
                <span class="text-gray-400 text-xs md:text-base">${qtyDisplay}</span>
            </td>
            <td class="py-1.5 px-2 md:py-3 md:px-4 text-left">
                ${item.youtubeUrl ? `
                    <a href="${item.youtubeUrl}" target="_blank" 
                       class="inline-flex items-center gap-1.5 px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded md:rounded-lg transition-colors text-[10px] md:text-sm font-semibold text-gray-300">
                        <i class="fab fa-youtube"></i>
                        <span class="hidden md:inline">Ver Tutorial</span>
                        <span class="md:hidden">Ver</span>
                    </a>
                ` : '<span class="text-gray-600 text-[10px] md:text-xs">Próximamente...</span>'}
            </td>
        </tr>
        `;
    }).join('');
    
    // Actualizar headers con iconos de ordenamiento
    const thead = tbody.closest('table').querySelector('thead tr');
    if (thead) {
        thead.innerHTML = `
            <th class="py-1.5 px-2 md:py-3 md:px-4">
                <button onclick="sortTable('name')" class="flex items-center hover:text-white transition-colors">
                    Ítem ${getSortIcon('name')}
                </button>
            </th>
            <th class="py-1.5 px-2 md:py-3 md:px-4 text-left">
                <button onclick="sortTable('price')" class="flex items-center hover:text-white transition-colors">
                    Precio Subasta ${getSortIcon('price')}
                </button>
            </th>
            <th class="py-1.5 px-2 md:py-3 md:px-4 text-left">
                <button onclick="sortTable('quantity')" class="flex items-center hover:text-white transition-colors">
                    Disponible ${getSortIcon('quantity')}
                </button>
            </th>
            <th class="py-1.5 px-2 md:py-3 md:px-4 text-left">Tutorial</th>
        `;
    }
}

// Make functions global for onclick
window.sortTable = sortTable;

// Sistema de actualización inteligente
let updateInterval = null;
let countdownInterval = null;

function getNextUpdateTime() {
    const now = new Date();
    const currentHour = now.getHours();
    const nextUpdate = new Date(now);
    
    // Si estamos en horario de pausa (00:00 - 08:00), próxima actualización es a las 08:00
    if (currentHour >= 0 && currentHour < 8) {
        nextUpdate.setHours(8, 0, 0, 0);
        return nextUpdate;
    }
    
    // Si estamos entre 08:00 - 23:59, próxima actualización es la siguiente hora en punto
    nextUpdate.setHours(currentHour + 1, 0, 0, 0);
    
    // Si la próxima hora sería 00:00 o después, programar para las 08:00 del día siguiente
    if (nextUpdate.getHours() >= 0 && nextUpdate.getHours() < 8) {
        nextUpdate.setHours(8, 0, 0, 0);
    }
    
    return nextUpdate;
}

function updateCountdown() {
    const now = new Date();
    const nextUpdate = getNextUpdateTime();
    const diff = nextUpdate - now;
    
    if (diff <= 0) {
        // Es hora de actualizar
        fetchAllPrices();
        scheduleNextUpdate();
        return;
    }
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    const el = document.getElementById('last-update-time');
    if (el) {
        const lastUpdate = new Date();
        const timeStr = `${lastUpdate.getHours().toString().padStart(2, '0')}:${lastUpdate.getMinutes().toString().padStart(2, '0')}`;
        
        if (hours > 0) {
            el.textContent = `${timeStr} (próxima: ${hours}h ${minutes}m)`;
        } else if (minutes > 0) {
            el.textContent = `${timeStr} (próxima: ${minutes}m ${seconds}s)`;
        } else {
            el.textContent = `${timeStr} (próxima: ${seconds}s)`;
        }
    }
}

function scheduleNextUpdate() {
    // Limpiar intervalos anteriores
    if (updateInterval) clearTimeout(updateInterval);
    if (countdownInterval) clearInterval(countdownInterval);
    
    const now = new Date();
    const nextUpdate = getNextUpdateTime();
    const diff = nextUpdate - now;
    
    console.log(`Próxima actualización programada para: ${nextUpdate.toLocaleTimeString('es-ES')}`);
    
    // Programar la próxima actualización
    updateInterval = setTimeout(() => {
        fetchAllPrices();
        scheduleNextUpdate();
    }, diff);
    
    // Actualizar countdown cada segundo
    countdownInterval = setInterval(updateCountdown, 1000);
    updateCountdown(); // Actualizar inmediatamente
}

// Init
document.addEventListener('DOMContentLoaded', () => {
    fetchFarmeosData();
    
    // Iniciar sistema de actualización inteligente
    scheduleNextUpdate();
});
