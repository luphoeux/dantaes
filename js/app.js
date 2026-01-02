const SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ2CquzL6RCPdBne9xwX4c400vHeIn018aY5vdV9k00PNuy0VIoeiaNTEIYL4XqWAgk__QjPTsFwx11/pub?gid=0&single=true&output=tsv';

// Memoria volátil
const itemMetadataCache = {};

// Cargar caché desde localStorage al iniciar
function loadLocalCache() {
    const saved = localStorage.getItem('wow_item_metadata');
    if (saved) {
        Object.assign(itemMetadataCache, JSON.parse(saved));
    }
}

function saveLocalCache() {
    localStorage.setItem('wow_item_metadata', JSON.stringify(itemMetadataCache));
}

// --- HELPER FUNCTIONS ---

function formatGold(num) {
    let val = "";
    if (num >= 1000000) {
        val = (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        val = (num / 1000).toFixed(1) + 'k';
    } else {
        val = num.toLocaleString('es-ES');
    }
    return `<span class="inline-flex items-center gap-1 whitespace-nowrap">${val}<img src="https://undermine.exchange/images/coin-gold.png" class="gold-icon" alt="g"></span>`;
}

function formatCurrency(num) {
    return num.toLocaleString('es-ES');
}

async function fetchItemMetadata(itemId) {
    if (itemMetadataCache[itemId]) return itemMetadataCache[itemId];
    if (!itemId || itemId === 0) return null;
    
    try {
        const response = await fetch(`/api/item?id=${itemId}`);
        const data = await response.json();
        if (data && !data.error) {
            itemMetadataCache[itemId] = data;
            saveLocalCache();
            return data;
        }
    } catch (e) {
        console.error("Error fetching item metadata:", e);
    }
    return null;
}

function getQualityClass(quality) {
    if (!quality) return 'q-common';
    return `q-${quality.toLowerCase()}`;
}

function getQualityBgClass(quality) {
    if (!quality) return 'bg-q-common';
    return `bg-q-${quality.toLowerCase()}`;
}

// Global scope for tooltips
const tooltipEl = document.createElement('div');
tooltipEl.id = 'custom-chart-tooltip';
tooltipEl.className = 'fixed hidden pointer-events-none z-50 bg-wow-card/95 backdrop-blur border border-wow-border shadow-xl rounded-lg p-3 text-xs leading-5 transform transition-opacity duration-75';
document.body.appendChild(tooltipEl);

window.showChartTooltip = function(evt, date, dailyStr, totalStr, topItemName, topItemValStr) {
    const el = document.getElementById('custom-chart-tooltip');
    if(!el) return;
    
    // Contenido rico
    el.innerHTML = `
        <div class="font-bold text-white mb-2 pb-1 border-b border-white/10 flex justify-between items-center bg-wow-card/50 px-1 -mx-1 -mt-1 rounded-t">
            <span>${date}</span>
        </div>
        
        <div class="space-y-3">
            <div class="grid grid-cols-2 gap-x-6 gap-y-1">
                <span class="text-gray-400">Ingreso Diario:</span>
                <span class="text-white font-mono text-right font-bold">${dailyStr}</span>
                <span class="text-gray-400">Acumulado:</span>
                <span class="text-wow-gold font-mono text-right font-bold">${totalStr}</span>
            </div>

            ${topItemName ? `
            <div class="bg-white/5 rounded p-2 border border-white/5">
                <div class="text-[10px] uppercase text-gray-500 font-bold mb-1">🔥 Top Item del Día</div>
                <div class="flex justify-between items-center">
                    <span class="text-wow-rare font-bold truncate max-w-[120px]" title="${topItemName}">${topItemName}</span>
                    <span class="text-white text-xs">${topItemValStr}</span>
                </div>
            </div>
            ` : ''}
        </div>
    `;
    
    // Posicionamiento
    const x = evt.clientX + 15;
    const y = evt.clientY + 15;
    
    // Ajustar si se sale de la pantalla
    const rect = el.getBoundingClientRect();
    const finalX = (x + rect.width > window.innerWidth) ? x - rect.width - 20 : x;
    const finalY = (y + rect.height > window.innerHeight) ? y - rect.height - 20 : y;

    el.style.left = `${finalX}px`;
    el.style.top = `${finalY}px`;
    el.classList.remove('hidden');
    el.classList.add('opacity-100');
};

window.hideChartTooltip = function() {
    const el = document.getElementById('custom-chart-tooltip');
    if(!el) return;
    el.classList.add('hidden');
    el.classList.remove('opacity-100');
};

// Cache global para precio de ficha
let tokenPriceCache = null;

// Función para obtener precio de ficha WoW (solo una llamada)
async function fetchTokenPrice() {
    if (tokenPriceCache !== null) {
        updateTokenPriceUI(tokenPriceCache);
        return tokenPriceCache;
    }
    
    try {
        const response = await fetch('/api/wow-token');
        const data = await response.json();
        
        if (data && data.price) {
            // La API devuelve el precio en cobre, convertir a oro
            const priceInGold = Math.floor(data.price / 10000);
            tokenPriceCache = priceInGold;
            updateTokenPriceUI(priceInGold);
            return priceInGold;
        }
    } catch (e) {
        console.error("Error fetching token price:", e);
        updateTokenPriceUI(null, true);
    }
    return null;
}

function updateTokenPriceUI(price, error = false) {
    const el = document.getElementById('kpi-token-price');
    const timeEl = document.getElementById('token-last-update');
    if (!el) return;
    
    if (error) {
        el.innerHTML = '<span class="text-sm text-red-400">Error</span>';
        if (timeEl) timeEl.textContent = 'Última actualización: Error';
    } else if (price) {
        // Mostrar número completo con separadores de miles (ej: "290.799")
        el.innerHTML = `<span class="flex items-center gap-1">${price.toLocaleString('es-ES')} <img src="https://wow.zamimg.com/images/icons/money-gold.gif" class="w-4 h-4" alt="oro"></span>`;
        
        // Actualizar hora
        if (timeEl) {
            const now = new Date();
            const hours = now.getHours().toString().padStart(2, '0');
            const minutes = now.getMinutes().toString().padStart(2, '0');
            timeEl.textContent = `Última actualización: ${hours}:${minutes}`;
        }
    }
}

// Mapeo manual de nombres a IDs (si no hay columna ID en el Sheet)
const ITEM_MAPS = {
    "Tendón de zancaalta": 212470,
    "Urditela": 212462,
    "Madeja de urditela": 212471,
    "Sombra primigenia": 22467,
    "Carne en salmuera": 212472,
    "Tejido del crepúsculo": 212463
};

let ledgerData = [];

async function fetchLedgerData() {
    try {
        console.log("Sincronizando con Google Sheets...");
        const response = await fetch(SHEET_URL);
        const text = await response.text();
        
        // Parsear TSV
        const lines = text.trim().split('\n');
        const headers = lines[0].split('\t').map(h => h.trim());
        
        const rawData = lines.slice(1).map(line => {
            const cols = line.split('\t');
            const item = {};
            headers.forEach((h, i) => item[h] = cols[i]?.trim());
            return item;
        });

        // Convertir al formato de la app
        ledgerData = rawData.map(d => {
            const name = d["Item"];
            const qty = parseInt(d["Cantidad"]) || 1;
            
            // Helper to clean and parse numbers from the sheet
            const parseSheetNum = (val) => {
                if (!val || val === "#NAME?" || val === "") return NaN;
                const clean = val.toString().replace(/\s/g, '').replace(',', '.');
                return parseFloat(clean);
            };

            const unitPrice = parseSheetNum(d["Precio Unitario"]) || 0;
            let total = parseSheetNum(d["Total Oro"]);
            
            if (isNaN(total)) {
                total = Math.round(unitPrice * qty);
            } else {
                total = Math.round(total);
            }
            
            const id = parseInt(d["Id Wowhead"]) || ITEM_MAPS[name] || 0;
            const icon = d["Link icono"] || null;
            
            return {
                name: name,
                qty: qty,
                total: total,
                price: Math.floor(total / qty) || unitPrice,
                cat: (d["Categoria"] || "mat").toLowerCase(),
                date: d["Fecha"],
                jsDate: new Date(d["Fecha"]),
                id: id,
                icon: icon
            };
        }).sort((a,b) => b.jsDate - a.jsDate);

        return true;
    } catch (e) {
        console.error("Error cargando el Sheet:", e);
        return false;
    }
}

function initDashboard() {
    loadLocalCache();
    fetchLedgerData().then(success => {
        if (!success) console.warn("Usando datos locales por fallo en sincronización");
        
        // El resto se dispara por el flujo normal
        updateKPIs();
        renderMainChart();
        renderTopCategories();
        renderItemsTable();
    });
}

function updateKPIs() {
    const totalIncome = ledgerData.reduce((sum, item) => sum + item.total, 0);
    
    // Encontrar ítem top
    const grouped = {};
    ledgerData.forEach(d => {
        if(!grouped[d.name]) grouped[d.name] = 0;
        grouped[d.name] += d.total;
    });
    const topItem = Object.entries(grouped).sort((a,b) => b[1] - a[1])[0];

    const setHtml = (id, val) => { const el = document.getElementById(id); if(el) el.innerHTML = val; };
    const setText = (id, val) => { const el = document.getElementById(id); if(el) el.innerText = val; };

    setHtml('kpi-income', formatGold(totalIncome));
    
    if (topItem) {
        setText('kpi-top-item', topItem[0]);
        setHtml('kpi-top-item-gold', formatGold(topItem[1]));
        
        // Buscar el ícono del ítem top
        const topItemData = ledgerData.find(d => d.name === topItem[0]);
        const iconContainer = document.getElementById('kpi-top-item-icon');
        
        if (iconContainer && topItemData && topItemData.icon) {
            iconContainer.innerHTML = `<img src="${topItemData.icon}" class="w-full h-full object-cover" alt="${topItem[0]}">`;
        }
    }
    
    // Obtener precio de ficha (solo una vez)
    fetchTokenPrice();
}

function renderMainChart() {
    const container = document.getElementById('main-chart-container');
    if(!container || ledgerData.length === 0) return;

    // 1. Agrupar por fecha para calcular totales y Top Item
    const dailyStats = {};
    
    ledgerData.forEach(d => {
        if(!dailyStats[d.date]) {
            dailyStats[d.date] = { 
                total: 0, 
                items: {} 
            };
        }
        dailyStats[d.date].total += d.total;
        
        // Trackear items por día
        if(!dailyStats[d.date].items[d.name]) dailyStats[d.date].items[d.name] = 0;
        dailyStats[d.date].items[d.name] += d.total;
    });

    const sortedDates = Object.keys(dailyStats).sort((a,b) => new Date(a) - new Date(b));
    
    // 2. Generar historial con acumulados y Top Item
    let runningIncome = 0;
    const history = sortedDates.map(date => {
        const stats = dailyStats[date];
        runningIncome += stats.total;
        
        // Encontrar top item del día
        let topItemName = "N/A";
        let topItemVal = 0;
        
        Object.entries(stats.items).forEach(([name, val]) => {
            if(val > topItemVal) {
                topItemVal = val;
                topItemName = name;
            }
        });
        
        return { 
            date, 
            income: runningIncome, 
            dailyIncome: stats.total,
            topItem: topItemName,
            topItemVal: topItemVal
        };
    });

    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!w || h < 100) return;

    const p = 40;
    const maxVal = history[history.length - 1].income * 1.1;

    // 3. Generar coordenadas
    const getX = (i) => p + (i / (history.length - 1 || 1)) * (w - p * 2);
    const getY = (v) => h - p - (v / maxVal) * (h - p * 2);

    let incomePath = "";
    let areaIncome = "";

    history.forEach((d, i) => {
        const x = getX(i);
        const yI = getY(d.income);
        
        if (i === 0) {
            incomePath = `M ${x} ${yI}`;
            areaIncome = `M ${x} ${h-p} L ${x} ${yI}`;
        } else {
            incomePath += ` L ${x} ${yI}`;
            areaIncome += ` L ${x} ${yI}`;
        }
        
        if (i === history.length - 1) {
            areaIncome += ` L ${x} ${h-p} Z`;
        }
    });

    // 4. Renderizar SVG con gradientes y tooltips
    container.innerHTML = `
        <svg width="100%" height="100%" viewBox="0 0 ${w} ${h}">
            <defs>
                <linearGradient id="grad-income" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#0074e0" stop-opacity="0.3"/>
                    <stop offset="100%" stop-color="#0074e0" stop-opacity="0"/>
                </linearGradient>
            </defs>
            
            <!-- Grid lines -->
            <line x1="${p}" y1="${h-p}" x2="${w-p}" y2="${h-p}" stroke="#374151" stroke-width="1" />
            <line x1="${p}" y1="${p}" x2="${p}" y2="${h-p}" stroke="#374151" stroke-width="1" />
            
            <!-- Labels -->
            <text x="${p-5}" y="${h-p}" text-anchor="end" fill="#6B7280" font-size="10">0</text>
            <text x="${p-5}" y="${p+10}" text-anchor="end" fill="#6B7280" font-size="10">${formatCurrency(Math.floor(maxVal/1000))}k</text>

            <!-- Area & Line -->
            <path d="${areaIncome}" fill="url(#grad-income)" />
            <path d="${incomePath}" fill="none" stroke="#0074e0" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
            
            <!-- Points for dates with hover -->
            ${history.map((d, i) => {
                const dateFormatted = new Date(d.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
                
                // Formatear valores para pasar al tooltip
                const dailyHtml = formatGold(d.dailyIncome).replace(/"/g, "'");
                const totalHtml = formatGold(d.income).replace(/"/g, "'");
                const itemValHtml = formatGold(d.topItemVal).replace(/"/g, "'");

                // Escapar nombre del item por si tiene comillas
                const safeItemName = d.topItem.replace(/'/g, "\\'").replace(/"/g, "&quot;");

                return `
                    <g class="chart-point" style="cursor: pointer;" 
                       onmousemove="window.showChartTooltip(event, '${dateFormatted}', '${dailyHtml}', '${totalHtml}', '${safeItemName}', '${itemValHtml}')"
                       onmouseleave="window.hideChartTooltip()">
                        <circle cx="${getX(i)}" cy="${getY(d.income)}" r="6" fill="#0074e0" opacity="0" class="hover-area" />
                        <circle cx="${getX(i)}" cy="${getY(d.income)}" r="4" fill="#0074e0" class="point-dot transition-all duration-200" />
                        <text x="${getX(i)}" y="${h-p+15}" text-anchor="middle" fill="#6B7280" font-size="9" style="pointer-events: none;">${d.date.split('-').slice(1).reverse().join('/')}</text>
                    </g>
                `;
            }).join('')}
        </svg>
        <style>
            .chart-point:hover .hover-area { opacity: 0.2; }
            .chart-point:hover .point-dot { r: 6; fill: #fbbf24; stroke: white; stroke-width: 2px; filter: drop-shadow(0 0 4px #fbbf24); }
        </style>
    `;
}

function renderTopCategories() {
    const container = document.getElementById('top-categories-list');
    if(!container) return;

    // Agrupar por categoría usando datos reales
    const cats = {};
    let total = 0;
    ledgerData.forEach(d => {
        const category = d.cat || 'otros';
        if(!cats[category]) cats[category] = 0;
        cats[category] += d.total;
        total += d.total;
    });

    // Mapeo de nombres de categorías (español latinoamericano)
    const categoryNames = {
        'cloth': 'Tela',
        'leather': 'Cuero',
        'metal & stone': 'Metal y Piedra',
        'metal': 'Metal',
        'stone': 'Piedra',
        'cooking': 'Cocina',
        'herb': 'Hierba',
        'enchanting': 'Encantamiento',
        'inscription': 'Inscripción',
        'jewelcrafting': 'Joyería',
        'parts': 'Partes',
        'elemental': 'Elemental',
        'optional reagents': 'Reactivos Opcionales',
        'finishing reagents': 'Reactivos de Acabado',
        'other': 'Otro',
        'material': 'Materiales',
        'mat': 'Materiales',
        'boe': 'BoE',
        'xmog': 'Transmog',
        'otros': 'Otros'
    };

    const categoryColors = {
        'cloth': 'bg-blue-500',
        'leather': 'bg-amber-700',
        'metal & stone': 'bg-gray-500',
        'metal': 'bg-gray-400',
        'stone': 'bg-gray-600',
        'cooking': 'bg-orange-500',
        'herb': 'bg-green-500',
        'enchanting': 'bg-purple-500',
        'inscription': 'bg-indigo-500',
        'jewelcrafting': 'bg-pink-500',
        'parts': 'bg-cyan-500',
        'elemental': 'bg-blue-400',
        'optional reagents': 'bg-yellow-500',
        'finishing reagents': 'bg-lime-500',
        'other': 'bg-gray-500',
        'material': 'bg-wow-gold',
        'mat': 'bg-wow-gold',
        'boe': 'bg-purple-500',
        'xmog': 'bg-green-500',
        'otros': 'bg-gray-500'
    };

    // Convertir a array y ordenar por valor
    const displayCats = Object.entries(cats)
        .map(([key, val]) => ({
            name: categoryNames[key.toLowerCase()] || key,
            val: val,
            color: categoryColors[key.toLowerCase()] || 'bg-gray-500'
        }))
        .sort((a,b) => b.val - a.val)
        .slice(0, 5); // Top 5

    let html = '';
    displayCats.forEach(c => {
        const pct = total ? ((c.val / total) * 100).toFixed(1) : 0;
        html += `
            <div>
                <div class="flex justify-between text-xs mb-1.5">
                    <span class="text-gray-400 font-medium">${c.name}</span>
                    <span class="text-white font-bold">${formatGold(c.val)}</span>
                </div>
                <div class="w-full bg-[#0a0b10] rounded-full h-2">
                    <div class="${c.color} h-2 rounded-full transition-all duration-1000" style="width:${pct}%"></div>
                </div>
            </div>
        `;
    });
    
    if (displayCats.length === 0) {
        html = '<div class="text-center text-gray-500 text-sm">No hay datos disponibles</div>';
    }
    
    container.innerHTML = html;
}

function getColorClass(cat) {
    if(cat === 'boe') return 'text-purple-400 bg-purple-400/10 border-purple-400/20';
    if(cat === 'xmog') return 'text-green-400 bg-green-400/10 border-green-400/20';
    return 'text-gray-400 bg-gray-400/10 border-gray-400/20';
}

// Filtros globales
let filters = {
    dateFrom: null,
    dateTo: null,
    search: ''
};

function applyFilters() {
    renderItemsTable();
    updateKPIs();
    renderMainChart();
    renderTopCategories();
}

function renderItemsTable() {
    const container = document.getElementById('daily-performance-container');
    if(!container) return;
    container.innerHTML = '';

    // Aplicar filtros
    let filteredData = ledgerData.filter(d => {
        if (filters.dateFrom && d.date < filters.dateFrom) return false;
        if (filters.dateTo && d.date > filters.dateTo) return false;
        if (filters.search && !d.name.toLowerCase().includes(filters.search.toLowerCase())) return false;
        return true;
    });

    // 1. Agrupar por fecha
    const groups = {};
    filteredData.forEach(d => {
        if(!groups[d.date]) groups[d.date] = [];
        groups[d.date].push(d);
    });

    // 2. Ordenar fechas (más reciente primero)
    const sortedDates = Object.keys(groups).sort((a,b) => new Date(b) - new Date(a));

    sortedDates.forEach((date, index) => {
        const items = groups[date];
        const isFirst = index === 0; // Solo la primera (más reciente) abierta
        
        // Colapsar duplicados por nombre en el mismo día
        const collapsed = {};
        items.forEach(it => {
            if(!collapsed[it.name]) collapsed[it.name] = { ...it, count: 0, sumQty: 0, sumTotal: 0 };
            collapsed[it.name].count++;
            collapsed[it.name].sumQty += it.qty;
            collapsed[it.name].sumTotal += it.total;
        });

        const itemsArr = Object.values(collapsed).sort((a,b) => b.sumTotal - a.sumTotal);
        const dayTotal = itemsArr.reduce((sum, it) => sum + it.sumTotal, 0);

        // Crear la Ficha (Card) colapsable
        const card = document.createElement('div');
        card.className = "bg-wow-card border border-wow-border rounded-xl shadow-lg overflow-hidden fade-in";
        
        const dateFriendly = new Date(date).toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const cardId = `card-${date.replace(/\-/g, '')}`;

        card.innerHTML = `
            <div 
                class="flex justify-between items-center p-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
                onclick="toggleCard('${cardId}')"
            >
                <div class="flex items-center gap-3">
                    <i id="icon-${cardId}" class="fas fa-chevron-${isFirst ? 'down' : 'right'} text-wow-gold transition-transform"></i>
                    <div>
                        <h3 class="font-bold text-white capitalize">${dateFriendly}</h3>
                        <p class="text-xs text-gray-500">${itemsArr.length} ítems vendidos</p>
                    </div>
                </div>
                <div class="text-sm font-bold text-wow-gold bg-wow-gold/10 px-3 py-1.5 rounded-full">
                    ${formatGold(dayTotal)}
                </div>
            </div>
            <div id="${cardId}" class="overflow-hidden transition-all duration-300 ${isFirst ? 'max-h-[2000px]' : 'max-h-0'}">
                <div class="p-4 pt-0 border-t border-wow-border/30">
                    <table class="w-full text-left text-sm">
                        <thead class="text-[10px] uppercase text-gray-500 border-b border-wow-border">
                            <tr>
                                <th class="py-2 px-2">Item</th>
                                <th class="py-2 px-2 text-center">Cant.</th>
                                <th class="py-2 px-2 text-right">Precio Medio</th>
                                <th class="py-2 px-2 text-right">Ganancia</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-wow-border/30">
                            ${itemsArr.map(item => `
                                <tr class="hover:bg-white/[0.02] transition-colors">
                                    <td class="py-2 px-2">
                                        <div class="flex items-center gap-2">
                                            <div class="relative w-7 h-7 flex-shrink-0 bg-wow-dark rounded border border-wow-border overflow-hidden">
                                                <img src="${item.icon || 'https://wow.zamimg.com/images/wow/icons/large/inv_misc_questionmark.jpg'}" class="w-full h-full object-cover">
                                            </div>
                                            <div class="flex flex-col">
                                                <span class="font-medium text-white text-xs">${item.name}</span>
                                                <span class="text-[8px] uppercase opacity-40 ${getColorClass(item.cat)}">${item.cat}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td class="py-2 px-2 text-center text-gray-400 text-xs">${item.sumQty}</td>
                                    <td class="py-2 px-2 text-right text-white/60 text-xs">${formatGold(Math.round(item.sumTotal / item.sumQty))}</td>
                                    <td class="py-2 px-2 text-right font-bold text-wow-gold text-xs">${formatGold(item.sumTotal)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        container.appendChild(card);
    });

    if (sortedDates.length === 0) {
        container.innerHTML = `
            <div class="bg-wow-card border border-wow-border rounded-xl p-8 shadow-lg text-center">
                <i class="fas fa-search text-4xl text-gray-600 mb-3"></i>
                <p class="text-gray-400">No se encontraron resultados con los filtros aplicados</p>
            </div>
        `;
    }
}

window.toggleCard = function(cardId) {
    const content = document.getElementById(cardId);
    const icon = document.getElementById(`icon-${cardId}`);
    
    if (content.classList.contains('max-h-0')) {
        content.classList.remove('max-h-0');
        content.classList.add('max-h-[2000px]');
        icon.classList.remove('fa-chevron-right');
        icon.classList.add('fa-chevron-down');
    } else {
        content.classList.add('max-h-0');
        content.classList.remove('max-h-[2000px]');
        icon.classList.add('fa-chevron-right');
        icon.classList.remove('fa-chevron-down');
    }
};

window.openItemHistory = function(itemName) {
    const modal = document.getElementById('item-history-modal');
    const title = document.getElementById('modal-item-title');
    const container = document.getElementById('item-chart');
    const modalCont = document.getElementById('modal-container');
    
    const history = ledgerData.filter(d => d.name === itemName).sort((a,b) => a.jsDate - b.jsDate);
    
    title.innerHTML = `Historial: <span class="text-wow-gold">${itemName}</span>`;
    container.innerHTML = ''; 
    
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    
    // Animation trigger
    setTimeout(() => {
        modalCont.classList.remove('scale-95', 'opacity-0');
        modalCont.classList.add('scale-100', 'opacity-100');
        renderItemHistoryChart(container, history);
    }, 10);
};

window.closeModal = function() {
    const modal = document.getElementById('item-history-modal');
    const modalCont = document.getElementById('modal-container');
    
    modalCont.classList.remove('scale-100', 'opacity-100');
    modalCont.classList.add('scale-95', 'opacity-0');
    
    setTimeout(() => {
        modal.classList.remove('flex');
        modal.classList.add('hidden');
    }, 300);
};

function renderItemHistoryChart(container, history) {
    const w = container.clientWidth || 800;
    const h = container.clientHeight || 400;
    const p = 40;

    const prices = history.map(d => d.price);
    const minPrice = Math.min(...prices) * 0.9;
    const maxPrice = Math.max(...prices) * 1.1;
    const priceRange = maxPrice - minPrice || 1;

    const minTime = history[0].jsDate.getTime();
    const maxTime = history[history.length-1].jsDate.getTime();
    const timeRange = maxTime - minTime || 1;

    let circlesHtml = '';
    let linePath = '';
    
    history.forEach((d, i) => {
        let x = timeRange === 0 ? w/2 : p + ((d.jsDate.getTime() - minTime) / timeRange) * (w - p*2);
        const y = h - p - ((d.price - minPrice) / priceRange) * (h - p*2);
        
        if(i === 0) linePath += `M ${x} ${y}`;
        else linePath += ` L ${x} ${y}`;

        circlesHtml += `
            <circle cx="${x}" cy="${y}" r="6" fill="#fbbf24" stroke="#1c202a" stroke-width="2" style="cursor:pointer" />
        `;
    });

    container.innerHTML = `
        <svg width="100%" height="100%" viewBox="0 0 ${w} ${h}">
            <line x1="${p}" y1="${h-p}" x2="${w-p}" y2="${h-p}" stroke="#374151" stroke-width="1" />
            <line x1="${p}" y1="${p}" x2="${p}" y2="${h-p}" stroke="#374151" stroke-width="1" />
            <text x="${p-10}" y="${h-p}" text-anchor="end" fill="#6B7280" font-size="10">${Math.round(minPrice)}g</text>
            <text x="${p-10}" y="${p+10}" text-anchor="end" fill="#6B7280" font-size="10">${Math.round(maxPrice)}g</text>
            <path d="${linePath}" fill="none" stroke="#fbbf2455" stroke-width="3"/>
            ${circlesHtml}
        </svg>
    `;
}

document.addEventListener('DOMContentLoaded', () => {
    initDashboard();
    
    // Configurar fecha "hasta" con el día de hoy por defecto
    const today = new Date().toISOString().split('T')[0];
    const dateToInput = document.getElementById('filter-date-to');
    if (dateToInput) {
        dateToInput.value = today;
    }
    
    // Event listeners para filtros
    const dateFrom = document.getElementById('filter-date-from');
    const dateTo = document.getElementById('filter-date-to');
    const searchInput = document.getElementById('filter-search');
    
    if (dateFrom) {
        dateFrom.addEventListener('change', (e) => {
            filters.dateFrom = e.target.value;
            applyFilters();
        });
    }
    
    if (dateTo) {
        dateTo.addEventListener('change', (e) => {
            filters.dateTo = e.target.value;
            applyFilters();
        });
    }
    
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            filters.search = e.target.value;
            applyFilters();
        });
    }
});
window.addEventListener('resize', () => {
    renderMainChart();
});
