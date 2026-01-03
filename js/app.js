const SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ2CquzL6RCPdBne9xwX4c400vHeIn018aY5vdV9k00PNuy0VIoeiaNTEIYL4XqWAgk__QjPTsFwx11/pub?gid=0&single=true&output=tsv';
const LOCAL_STORAGE_KEY_USER_ENTRIES = 'dantaes_user_entries';

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

function formatGold(num, fullFormat = false) {
    if (isNaN(num)) return '0';
    let val = "";
    if (fullFormat) {
        val = Math.round(num).toLocaleString('es-ES');
    } else if (num >= 1000000) {
        val = (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        val = (num / 1000).toFixed(1) + 'k';
    } else {
        val = num.toLocaleString('es-ES');
    }
    return `<span class="inline-flex items-center gap-1 whitespace-nowrap">${val}<img src="https://wow.zamimg.com/images/icons/money-gold.gif" class="w-3 h-3 md:w-4 md:h-4" alt="g"></span>`;
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
            // Soporte dinámico para headers según la nueva imagen
            const highlightedItem = d["Item destacado"] || d["Item Destacado"] || "";
            const activities = d["Farmeo"] || d["Actividades"] || "";
            const date = d["Fecha"] || d["Date"];
            const icon = d["Link icono"] || d["Link Icono"] || d["Icono"] || null;
            const observation = d["Observación"] || d["Observacion"] || "";
            const link = d["Link sugerido del día"] || d["Link sugerido"] || d["Links sugeridos"] || "";
            const id = parseInt(d["Id Wowhead"] || d["ID"]) || 0;
            
            const parseSheetNum = (val) => {
                if (!val || val === "#NAME?" || val === "") return NaN;
                const clean = val.toString().replace(/[^0-9,.]/g, '').replace(/\s/g, '');
                if (clean.includes('.') && clean.includes(',')) {
                    return parseFloat(clean.replace(/\./g, '').replace(',', '.'));
                }
                const lastComma = clean.lastIndexOf(',');
                const lastDot = clean.lastIndexOf('.');
                if (lastComma > lastDot && lastComma > clean.length - 4) {
                    return parseFloat(clean.replace(/\./g, '').replace(',', '.'));
                }
                return parseFloat(clean.replace(/,/g, ''));
            };

            let total = parseSheetNum(d["Oro ganado en total"] || d["Oro ganado en"] || d["Oro ganado"] || d["Total Oro"]);
            
            return {
                name: highlightedItem || (activities ? activities.split(',')[0] : "Sin nombre"),
                activities: activities,
                total: isNaN(total) ? 0 : Math.round(total),
                date: date,
                jsDate: (function() {
                    const parts = date.split('-');
                    return new Date(parts[0], parts[1] - 1, parts[2]);
                })(),
                id: id,
                icon: icon,
                observation: observation,
                link: link,
                cat: highlightedItem || "Otros"
            };
        }).filter(d => (d.name || d.activities) && d.date).sort((a,b) => b.jsDate - a.jsDate);

        // Cargar entradas locales
        const savedEntries = localStorage.getItem(LOCAL_STORAGE_KEY_USER_ENTRIES);
        if (savedEntries) {
            const userEntries = JSON.parse(savedEntries).map(e => ({
                ...e,
                jsDate: new Date(e.date)
            }));
            ledgerData = [...userEntries, ...ledgerData].sort((a,b) => b.jsDate - a.jsDate);
        }

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
        
        // Poblar datalist de farmeos con ítems únicos del catálogo
        populateFarmDatalist();

        // El resto se dispara por el flujo normal
        updateKPIs();
        renderMainChart();
        renderTopCategories();
        renderItemsTable();
    });
}

function populateFarmDatalist() {
    const datalist = document.getElementById('farmeos-options');
    if (!datalist) return;
    
    // Obtener nombres únicos de los farmeos del catálogo
    const uniqueFarms = [...new Set(ledgerData.map(d => d.name))].sort();
    datalist.innerHTML = uniqueFarms.map(f => `<option value="${f}">`).join('');
}

// Handler para el nuevo formulario
function initIncomeForm() {
    const form = document.getElementById('income-form');
    if (!form) return;

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const name = formData.get('farmName');
        const gold = parseFloat(formData.get('goldEarned'));
        const observation = formData.get('observation');
        const link = formData.get('suggestedLink');
        const today = new Date().toISOString().split('T')[0];

        // Buscar icono del catálogo
        const catalogEntry = ledgerData.find(d => d.name.toLowerCase() === name.toLowerCase());
        const icon = catalogEntry ? catalogEntry.icon : 'https://wow.zamimg.com/images/wow/icons/large/inv_misc_questionmark.jpg';
        const id = catalogEntry ? catalogEntry.id : 0;

        const newEntry = {
            name,
            total: gold,
            qty: 1,
            price: gold,
            date: today,
            jsDate: new Date(),
            observation,
            link,
            icon,
            id,
            cat: catalogEntry ? catalogEntry.cat : 'otros',
            isLocal: true // Identificador para entradas locales
        };

        // Guardar localmente
        const savedEntries = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY_USER_ENTRIES) || '[]');
        savedEntries.unshift(newEntry);
        localStorage.setItem(LOCAL_STORAGE_KEY_USER_ENTRIES, JSON.stringify(savedEntries));

        // Actualizar estado global y UI
        ledgerData.unshift(newEntry);
        form.reset();
        applyFilters();
    });
}

function updateKPIs() {
    const totalIncome = ledgerData.reduce((sum, item) => sum + item.total, 0);
    const setHtml = (id, val) => { const el = document.getElementById(id); if(el) el.innerHTML = val; };
    setHtml('kpi-income', formatGold(totalIncome, true));
    
    // --- TOP DAY CARD (Replacing Top Item) ---
    const dayTotals = {};
    const dayData = {};
    ledgerData.forEach(d => {
        if(!dayTotals[d.date]) {
            dayTotals[d.date] = 0;
            dayData[d.date] = [];
        }
        dayTotals[d.date] += d.total;
        dayData[d.date].push(d);
    });

    let bestDate = null;
    let maxTotal = -1;
    Object.keys(dayTotals).forEach(date => {
        if(dayTotals[date] > maxTotal) {
            maxTotal = dayTotals[date];
            bestDate = date;
        }
    });

    const topItemContainer = document.getElementById('kpi-top-item');
    if (topItemContainer && bestDate) {
        const topDayEntries = dayData[bestDate];
        const dateObj = new Date(bestDate + 'T00:00:00'); 
        const dateFriendly = dateObj.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' });
        
        topItemContainer.innerHTML = `
            <div class="flex flex-col h-full bg-wow-gold/5 overflow-hidden">
                <div class="bg-wow-gold/10 px-4 py-2 flex justify-between items-center border-b border-wow-gold/20">
                    <div class="flex items-center gap-2">
                        <i class="fas fa-trophy text-wow-gold text-xs"></i>
                        <span class="text-[10px] uppercase text-wow-gold font-bold tracking-widest">Día de Oro Récord</span>
                    </div>
                    <span class="text-[10px] text-white/60 font-bold capitalize">${dateFriendly}</span>
                </div>
                <div class="p-4 space-y-4 max-h-[250px] overflow-y-auto custom-scrollbar flex-1">
                    ${topDayEntries.map(entry => `
                        <div class="flex items-start gap-4 pb-4 border-b border-wow-gold/5 last:border-0 last:pb-0">
                            <div class="relative flex-shrink-0">
                                <div class="w-14 h-14 rounded-xl border border-wow-gold/20 overflow-hidden shadow-md">
                                    <img src="${entry.icon || 'https://wow.zamimg.com/images/wow/icons/large/inv_misc_questionmark.jpg'}" class="w-full h-full object-cover">
                                </div>
                            </div>
                            <div class="flex-1 min-w-0">
                                <div class="flex justify-between items-start gap-2">
                                    <h4 class="text-white font-black text-[11px] uppercase tracking-tight truncate">${entry.name}</h4>
                                    <span class="text-wow-gold font-mono font-bold text-[11px] whitespace-nowrap">${formatGold(entry.total, true)}</span>
                                </div>
                                <div class="mt-1 flex flex-col gap-1">
                                    ${entry.activities ? entry.activities.split(',').map(act => `
                                        <div class="text-[8px] text-white/40 border-l border-wow-blue/20 pl-2 py-0.5 italic">
                                            ${act.trim()}
                                        </div>
                                    `).join('') : ''}
                                </div>
                                ${entry.observation ? `
                                    <p class="mt-2 text-[9px] text-gray-500 italic leading-tight border-t border-white/5 pt-1">
                                        ${entry.observation}
                                    </p>
                                ` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
                <div class="bg-wow-gold/5 px-4 py-2 border-t border-wow-gold/10 text-right mt-auto">
                    <span class="text-[10px] text-gray-500 uppercase mr-2">Cifra Récord:</span>
                    <span class="text-wow-gold font-bold font-mono text-sm">${formatGold(maxTotal, true)}</span>
                </div>
            </div>
        `;
    }
    
    fetchTokenPrice();
}

// Filtros globales
let chartTimeframe = 'week'; // 'day', 'week', 'month', 'year'

window.setChartFilter = function(filter) {
    chartTimeframe = filter;
    
    // Update UI
    ['day', 'week', 'month', 'year'].forEach(f => {
        const btn = document.getElementById(`filter-btn-${f}`);
        if(btn) {
            if(f === filter) {
                btn.classList.add('bg-wow-blue', 'text-white', 'shadow');
                btn.classList.remove('text-gray-400', 'hover:text-white');
            } else {
                btn.classList.remove('bg-wow-blue', 'text-white', 'shadow');
                btn.classList.add('text-gray-400', 'hover:text-white');
            }
        }
    });

    // Auto-set based on current date
    // Note: This forces the filter to "this week/month/year". 
    // If the data is old, the chart might look empty. 
    // Usually dashboards show "Current Period".
    const now = new Date();
    const fmt = (date) => {
        // Adjust for timezone offset to avoid previous day
        const offset = date.getTimezoneOffset();
        const adjustedDate = new Date(date.getTime() - (offset*60*1000));
        return adjustedDate.toISOString().split('T')[0];
    };

    if (filter === 'week') {
        // Current ISO week (Mon-Sun)
        const day = now.getDay() || 7; 
        const start = new Date(now);
        start.setDate(now.getDate() - day + 1);
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        
        filters.dateFrom = fmt(start);
        filters.dateTo = fmt(end);
    } else if (filter === 'month') {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0); // Last day
        filters.dateFrom = fmt(start);
        filters.dateTo = fmt(end);
    } else if (filter === 'year') {
        const start = new Date(now.getFullYear(), 0, 1);
        const end = new Date(now.getFullYear(), 11, 31);
        filters.dateFrom = fmt(start);
        filters.dateTo = fmt(end);
    } else if (filter === 'day') {
        filters.dateFrom = fmt(now);
        filters.dateTo = fmt(now);
    }

    // Update Inputs
    const fromInput = document.getElementById('filter-date-from');
    const toInput = document.getElementById('filter-date-to');
    if(fromInput) fromInput.value = filters.dateFrom;
    if(toInput) toInput.value = filters.dateTo;

    applyFilters();
}

let filters = {
    dateFrom: null,
    dateTo: null,
    search: '',
    currentPage: 1,
    itemsPerPage: 7
};

function updateResetButtonVisibility() {
    const resetBtn = document.getElementById('reset-filters-container');
    const hasFilters = filters.search || filters.dateFrom || filters.dateTo || chartTimeframe !== 'week';
    if (resetBtn) {
        if (hasFilters) resetBtn.classList.remove('hidden');
        else resetBtn.classList.add('hidden');
    }
}

function applyFilters() {
    filters.currentPage = 1; // Reset page on filter
    updateResetButtonVisibility();
    renderItemsTable();
    updateKPIs();
    renderMainChart();
    renderTopCategories();
}

window.resetFilters = function() {
    // Reset global filters object
    filters.search = '';
    filters.dateFrom = null;
    filters.dateTo = null;
    filters.currentPage = 1;
    chartTimeframe = 'week';

    // Clear UI inputs
    const searchInput = document.getElementById('filter-search');
    const dateFromInput = document.getElementById('filter-date-from');
    const dateToInput = document.getElementById('filter-date-to');
    
    if (searchInput) searchInput.value = '';
    if (dateFromInput) dateFromInput.value = '';
    if (dateToInput) dateToInput.value = '';

    // Reset chart timeframe buttons UI
    ['day', 'week', 'month', 'year'].forEach(f => {
        const btn = document.getElementById(`filter-btn-${f}`);
        if(btn) {
            if(f === 'week') {
                btn.classList.add('bg-wow-blue', 'text-white', 'shadow');
                btn.classList.remove('text-gray-400', 'hover:text-white');
            } else {
                btn.classList.remove('bg-wow-blue', 'text-white', 'shadow');
                btn.classList.add('text-gray-400', 'hover:text-white');
            }
        }
    });

    applyFilters();
};
window.applyFilters = applyFilters;

// Helper to get week number
function getWeekNumber(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    var weekNo = Math.ceil(( ( (d - yearStart) / 86400000) + 1)/7);
    return { year: d.getUTCFullYear(), week: weekNo };
}

// Helper to get date range from week number
function getDateRangeFromWeek(w, y) {
    const d = new Date(Date.UTC(y, 0, 1 + (w - 1) * 7));
    const dayOfWeek = d.getUTCDay();
    const ISOweekStart = d;
    if (dayOfWeek <= 4)
        ISOweekStart.setUTCDate(d.getUTCDate() - d.getUTCDay() + 1);
    else
        ISOweekStart.setUTCDate(d.getUTCDate() + 8 - d.getUTCDay());
    
    // Adjust to Monday start
    const weekStart = new Date(ISOweekStart);
    const weekEnd = new Date(ISOweekStart);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
    
    const format = (date) => {
        const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
        return `${date.getUTCDate()} ${months[date.getUTCMonth()]}`;
    };
    return `${format(weekStart)} - ${format(weekEnd)}`;
}

// Helper to handle click on chart points
window.handleChartClick = function(key) {
    // Force hide tooltip immediately
    window.hideChartTooltip();

    // Determine context based on current timeframe
    if (chartTimeframe === 'year') {
        // key is YYYY-MM
        const [y, m] = key.split('-').map(Number);
        const start = new Date(y, m - 1, 1);
        const end = new Date(y, m, 0);
        
        const fmt = (date) => {
            const offset = date.getTimezoneOffset();
            const adjusted = new Date(date.getTime() - (offset*60*1000));
            return adjusted.toISOString().split('T')[0];
        };
        
        filters.dateFrom = fmt(start);
        filters.dateTo = fmt(end);
        
    } else {
        // key is YYYY-MM-DD
        filters.dateFrom = key;
        filters.dateTo = key;
    }
    
    // Update UI Inputs to reflect the drill-down
    const fromInput = document.getElementById('filter-date-from');
    const toInput = document.getElementById('filter-date-to');
    if(fromInput) fromInput.value = filters.dateFrom;
    if(toInput) toInput.value = filters.dateTo;
    
    // IMPORTANT: Do NOT call applyFilters(). We want to keep the Chart showing the wider context (Week/Month)
    // while the Table and KPIs focus on the specific day/month selected.
    filters.currentPage = 1;
    updateResetButtonVisibility(); // Show reset button since we now have date filters
    renderItemsTable();
    updateKPIs(); 

    // Scroll to table for better UX
    const tableContainer = document.getElementById('daily-performance-container');
    if(tableContainer) tableContainer.scrollIntoView({ behavior: 'smooth' });
}

function renderMainChart() {
    const container = document.getElementById('main-chart-container');
    if(!container) return;
    
    if (ledgerData.length === 0) {
        container.innerHTML = '<div class="flex items-center justify-center h-full text-gray-500">No hay datos</div>';
        return;
    }

    // 1. Filtrar datos (respetar filtros de fechas si existen)
    let filteredData = ledgerData.filter(d => {
        if (filters.dateFrom && d.date < filters.dateFrom) return false;
        if (filters.dateTo && d.date > filters.dateTo) return false;
        return true;
    });

    // 2. Agrupar datos según Timeframe REFACTORIZADO para granularidad
    const aggregated = {};
    
    filteredData.forEach(d => {
        let key;
        const [y, m, day] = d.date.split('-').map(Number);
        
        // "Week" y "Month" views now use Daily Granularity
        if (chartTimeframe === 'week' || chartTimeframe === 'month' || chartTimeframe === 'day') {
            key = d.date; // YYYY-MM-DD
        } else if (chartTimeframe === 'year') {
            // Year view uses Monthly Granularity
            key = `${y}-${m.toString().padStart(2, '0')}`; // YYYY-MM
        }
        
        const dateObj = new Date(y, m - 1, day);

        if(!aggregated[key]) {
            aggregated[key] = {
                label: key,
                total: 0,
                items: {},
                dateObj: dateObj // Para ordenar
            };
        }
        aggregated[key].total += d.total;
        
        // Trackear items
        if(!aggregated[key].items[d.name]) aggregated[key].items[d.name] = 0;
        aggregated[key].items[d.name] += d.total;
    });

    const sortedKeys = Object.keys(aggregated).sort((a,b) => {
        return new Date(a) - new Date(b); // Standard string sort works for YYYY-MM-DD and YYYY-MM actually, but Date is safer
    });

    // 3. Generar historial
    let runningIncome = 0;
    const history = sortedKeys.map(key => {
        const stats = aggregated[key];
        runningIncome += stats.total;
        
        // Top Item
        let topItemName = "N/A";
        let topItemVal = 0;
        Object.entries(stats.items).forEach(([name, val]) => {
            if(val > topItemVal) {
                topItemVal = val;
                topItemName = name;
            }
        });
        
        // Friendly Label Logic
        let friendlyLabel = key;
        const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
        
        if (chartTimeframe === 'year') {
             // Key is YYYY-MM
             const [y, m] = key.split('-');
             friendlyLabel = `${months[parseInt(m)-1]}`;
        } else {
            // Key is YYYY-MM-DD for week/month/day
            const [y, m, day] = key.split('-').map(Number);
            const localDate = new Date(y, m - 1, day);
            friendlyLabel = localDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).replace('.', '');
        }
        
        return {
            key,
            label: friendlyLabel,
            income: runningIncome, // Cumulative
            periodIncome: stats.total, // Income in this period
            topItem: topItemName,
            topItemVal: topItemVal
        };
    });

    if (history.length === 0) {
         container.innerHTML = '<div class="flex items-center justify-center h-full text-gray-500">No hay datos en este rango</div>';
         return;
    }

    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!w || h < 100) return;

    const p = 40;
    const maxVal = history[history.length - 1].income * 1.1 || 1000;

    // Generar coordenadas
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

    // Render SVG
    container.innerHTML = `
        <svg width="100%" height="100%" viewBox="0 0 ${w} ${h}">
            <defs>
                <linearGradient id="grad-income" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#0074e0" stop-opacity="0.3"/>
                    <stop offset="100%" stop-color="#0074e0" stop-opacity="0"/>
                </linearGradient>
            </defs>
            <line x1="${p}" y1="${h-p}" x2="${w-p}" y2="${h-p}" stroke="#374151" stroke-width="1" />
            <line x1="${p}" y1="${p}" x2="${p}" y2="${h-p}" stroke="#374151" stroke-width="1" />
            <text x="${p-5}" y="${h-p}" text-anchor="end" fill="#6B7280" font-size="10">0</text>
            <text x="${p-5}" y="${p+10}" text-anchor="end" fill="#6B7280" font-size="10">${formatCurrency(Math.floor(maxVal/1000))}k</text>

            <path d="${areaIncome}" fill="url(#grad-income)" />
            <path d="${incomePath}" fill="none" stroke="#0074e0" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
            
            ${history.map((d, i) => {
                const esc = (str) => str.replace(/'/g, "\\'").replace(/"/g, "&quot;");
                const dailyHtml = esc(formatGold(d.periodIncome, true));
                const totalHtml = esc(formatGold(d.income, true));
                const itemValHtml = esc(formatGold(d.topItemVal, true));
                const safeItemName = esc(d.topItem);
                
                // Click interaction: Always available now
                const clickAttr = `onclick="window.handleChartClick('${d.key}')" style="cursor: pointer;"`;
                
                return `
                    <g class="chart-point" ${clickAttr}
                       onmousemove="window.showChartTooltip(event, '${d.label}', '${dailyHtml}', '${totalHtml}', '${safeItemName}', '${itemValHtml}')"
                       onmouseleave="window.hideChartTooltip()">
                        <circle cx="${getX(i)}" cy="${getY(d.income)}" r="6" fill="#0074e0" opacity="0" class="hover-area" />
                        <circle cx="${getX(i)}" cy="${getY(d.income)}" r="4" fill="#0074e0" class="point-dot transition-all duration-200" />
                        <text x="${getX(i)}" y="${h-p+15}" text-anchor="middle" fill="#6B7280" font-size="9" style="pointer-events: none;">${d.label}</text>
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
// let filters = { // Moved to top with chartTimeframe
//     dateFrom: null,
//     dateTo: null,
//     search: '',
//     currentPage: 1,
//     itemsPerPage: 7
// };

// function applyFilters() { // Moved to top with chartTimeframe
//     renderItemsTable();
//     updateKPIs();
//     renderMainChart();
//     renderTopCategories();
// }

function renderItemsTable() {
    const container = document.getElementById('daily-performance-container');
    if(!container) return;
    container.innerHTML = '';

    // Aplicar filtros
    let filteredData = ledgerData.filter(d => {
        if (filters.dateFrom && d.date < filters.dateFrom) return false;
        if (filters.dateTo && d.date > filters.dateTo) return false;
        
        if (filters.search) {
            const s = filters.search.toLowerCase();
            const inName = d.name?.toLowerCase().includes(s);
            const inActivities = d.activities?.toLowerCase().includes(s);
            const inObservation = d.observation?.toLowerCase().includes(s);
            const inDate = d.date?.includes(s);
            const inCat = d.cat?.toLowerCase().includes(s);
            
            if (!inName && !inActivities && !inObservation && !inDate && !inCat) return false;
        }
        return true;
    });

    // 1. Agrupar por fecha
    const groups = {};
    filteredData.forEach(d => {
        // Normalizar fecha a YYYY-MM-DD usando componentes locales para evitar desfases
        let dateKey = d.date;
        if (d.jsDate && !isNaN(d.jsDate.getTime())) {
            const y = d.jsDate.getFullYear();
            const m = (d.jsDate.getMonth() + 1).toString().padStart(2, '0');
            const day = d.jsDate.getDate().toString().padStart(2, '0');
            dateKey = `${y}-${m}-${day}`;
        }
        if(!groups[dateKey]) groups[dateKey] = [];
        groups[dateKey].push(d);
    });

    // 2. Ordenar fechas (más reciente primero)
    const sortedDates = Object.keys(groups).sort((a,b) => new Date(b) - new Date(a));
    
    // 3. Paginación
    const totalItems = sortedDates.length;
    const totalPages = Math.ceil(totalItems / filters.itemsPerPage);
    const startIndex = (filters.currentPage - 1) * filters.itemsPerPage;
    const endIndex = startIndex + filters.itemsPerPage;
    const visibleDates = sortedDates.slice(startIndex, endIndex);

    visibleDates.forEach((date, index) => {
        const items = groups[date];
        // Forzamos que siempre esté abierto quitando la lógica de isFirst variable
        const isFirst = true; 
        
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

        const card = document.createElement('div');
        card.className = "bg-wow-card border border-wow-border rounded-xl shadow-lg overflow-hidden fade-in mb-4";
        
        const [y, m, d] = date.split('-').map(Number);
        const localDate = new Date(y, m - 1, d);
        const dateFriendly = localDate.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const cardId = `card-${date.replace(/\-/g, '')}`;

        card.innerHTML = `
            <div 
                class="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 bg-wow-dark/40 border-b border-wow-border/30 gap-3"
            >
                <div class="flex items-center gap-3">
                    <i class="fas fa-calendar-alt text-wow-gold"></i>
                    <div>
                        <h3 class="font-bold text-white capitalize">${dateFriendly}</h3>
                        <p class="text-xs text-gray-500">${itemsArr.length} registros</p>
                    </div>
                </div>
                <div class="text-sm font-bold text-wow-gold bg-wow-gold/10 px-3 py-1.5 rounded-full">
                    ${formatGold(dayTotal, true)}
                </div>
            </div>
            <div id="${cardId}" class="daily-card-content transition-all duration-300 max-h-none">
                <!-- VISTA ESCRITORIO: Tabla Original -->
                <div class="hidden lg:block p-6 pt-0 border-t border-wow-border/30">
                    <table class="w-full text-left text-base table-fixed">
                        <thead class="text-sm uppercase text-gray-500 border-b border-wow-border">
                            <tr>
                                <th class="py-4 px-4 text-left w-[25%]">Farmeo</th>
                                <th class="py-4 px-4 text-left w-[20%]">Oro Ganado</th>
                                <th class="py-4 px-4 text-left w-[40%]">Observación</th>
                                <th class="py-4 px-4 text-center w-[15%]">Link</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-wow-border/30">
                            ${itemsArr.map((item, index) => {
                                let thumbUrl = 'https://wow.zamimg.com/images/wow/icons/large/inv_misc_questionmark.jpg';
                                if (item.link && (item.link.includes('youtube.com') || item.link.includes('youtu.be'))) {
                                    const videoId = item.link.includes('v=') ? item.link.split('v=')[1].split('&')[0] : item.link.split('/').pop();
                                    thumbUrl = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
                                }
                                return `
                                <tr class="hover:bg-white/[0.02] transition-colors">
                                    <td class="py-4 px-4 text-left align-top">
                                        <div class="flex items-start gap-3">
                                            <div class="relative w-10 h-10 flex-shrink-0 bg-wow-dark rounded border border-wow-border overflow-hidden">
                                                <img src="${item.icon || 'https://wow.zamimg.com/images/wow/icons/large/inv_misc_questionmark.jpg'}" class="w-full h-full object-cover">
                                            </div>
                                            <div class="flex flex-col min-w-0 pt-1">
                                                <div class="flex items-center gap-2">
                                                    <span class="font-bold text-white text-base leading-tight truncate" title="${item.name}">${item.name}</span>
                                                    ${item.activities ? `
                                                        <button onclick="toggleActivities('acts-dt-${date}-${index}')" class="text-wow-blue hover:text-white transition-colors text-xs">
                                                            <i id="icon-acts-dt-${date}-${index}" class="fas fa-plus-circle"></i>
                                                        </button>
                                                    ` : ''}
                                                </div>
                                                <div id="acts-dt-${date}-${index}" class="mt-2 flex flex-col gap-1 hidden">
                                                    ${item.activities ? item.activities.split(',').map(act => `
                                                        <div class="text-[10px] text-white/50 border-l border-wow-blue/30 pl-2 py-0.5 italic">
                                                            ${act.trim()}
                                                        </div>
                                                    `).join('') : ''}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td class="py-4 px-4 text-left font-bold text-wow-gold text-base align-top pt-5">${formatGold(item.sumTotal, true)}</td>
                                    <td class="py-4 px-4 text-left text-gray-400 text-base italic align-top pt-5 truncate" title="${item.observation || ''}">${item.observation || '-'}</td>
                                    <td class="py-4 px-4 text-center align-top pt-5">
                                        ${item.link ? `
                                            <a href="${item.link}" target="_blank" class="group relative inline-block w-28 h-16 rounded-lg overflow-hidden border border-wow-border hover:border-wow-blue transition-all shadow-lg">
                                                <img src="${thumbUrl}" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110">
                                                <div class="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                                    <i class="fas fa-play text-white text-sm drop-shadow-lg opacity-80 group-hover:opacity-100 group-hover:scale-125 transition-all"></i>
                                                </div>
                                            </a>
                                        ` : '<span class="text-gray-600">-</span>'}
                                    </td>
                                </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>

                <!-- VISTA MÓVIL: Fichas Verticales -->
                <div class="lg:hidden divide-y divide-wow-border/20">
                             ${itemsArr.map((item, index) => {
                                let thumbUrl = null;
                                if (item.link && (item.link.includes('youtube.com') || item.link.includes('youtu.be'))) {
                                    const videoId = item.link.includes('v=') ? item.link.split('v=')[1].split('&')[0] : item.link.split('/').pop();
                                    thumbUrl = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
                                }

                                return `
                                <div class="p-4 md:p-5 hover:bg-white/[0.02] transition-colors group">
                                    <div class="grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-6">
                                        <!-- Información Principal -->
                                        <div class="flex items-center gap-5">
                                            <div class="relative w-12 h-12 md:w-16 md:h-16 flex-shrink-0 bg-wow-dark rounded-xl border border-wow-border overflow-hidden shadow-lg group-hover:border-wow-blue/40 transition-all">
                                                <img src="${item.icon || 'https://wow.zamimg.com/images/wow/icons/large/inv_misc_questionmark.jpg'}" class="w-full h-full object-cover">
                                            </div>
                                            <div class="flex-1 min-w-0">
                                                <div class="flex items-center gap-3">
                                                    <h4 class="font-black text-white text-lg uppercase tracking-tight truncate">${item.name}</h4>
                                                    ${item.activities ? `
                                                        <button onclick="toggleActivities('acts-mb-${date}-${index}')" class="text-wow-blue hover:text-white transition-colors">
                                                            <i id="icon-acts-mb-${date}-${index}" class="fas fa-plus-circle"></i>
                                                        </button>
                                                    ` : ''}
                                                </div>
                                                <div id="acts-mb-${date}-${index}" class="flex flex-col gap-1 hidden my-2">
                                                    ${item.activities ? item.activities.split(',').map(act => `
                                                        <div class="text-[10px] text-white/40 border-l border-wow-blue/20 pl-3 py-0.5 italic">
                                                            ${act.trim()}
                                                        </div>
                                                    `).join('') : ''}
                                                </div>
                                                <div class="text-wow-gold font-mono font-black text-xl md:text-2xl leading-none flex items-center gap-2 mt-1">
                                                    ${formatGold(item.sumTotal, true)}
                                                </div>
                                            </div>
                                        </div>

                                        <!-- Detalles Verticales (Ficha) -->
                                        <div class="flex flex-col space-y-3 pt-4 lg:pt-0 border-t lg:border-t-0 lg:border-l border-wow-border/20 lg:pl-6">
                                            <div class="grid grid-cols-[100px_1fr] gap-3 items-start">
                                                <span class="text-[10px] font-bold text-gray-600 uppercase tracking-widest pt-1">Observación</span>
                                                <p class="text-xs md:text-sm text-gray-400 italic leading-snug line-clamp-2" title="${item.observation || ''}">${item.observation || 'Ninguna'}</p>
                                            </div>
                                            
                                            ${item.link ? `
                                            <div class="grid grid-cols-[100px_1fr] gap-3 items-center">
                                                <span class="text-[10px] font-bold text-gray-600 uppercase tracking-widest">Guía</span>
                                                <a href="${item.link}" target="_blank" class="block w-24 h-14 md:w-28 md:h-16 rounded-xl overflow-hidden border border-wow-border hover:border-wow-blue transition-all shadow-lg relative group/link">
                                                    <img src="${thumbUrl || 'https://wow.zamimg.com/images/wow/icons/large/inv_misc_questionmark.jpg'}" class="w-full h-full object-cover grayscale-[0.2] group-hover/link:grayscale-0 transition-all">
                                                    <div class="absolute inset-0 bg-black/40 flex items-center justify-center group-hover/link:bg-black/10 transition-all">
                                                        <i class="fas fa-play text-white text-xs drop-shadow-md"></i>
                                                    </div>
                                                </a>
                                            </div>
                                            ` : ''}
                                        </div>
                                    </div>
                                </div>
                                `;
                             }).join('')}
                </div>
            </div>
        `;
        container.appendChild(card);
    });

    if (totalItems > 0) {
        // Render Pagination Controls
        const totalPages = Math.ceil(totalItems / filters.itemsPerPage);
        const controls = document.createElement('div');
        controls.className = "flex justify-center items-center gap-4 mt-6";
        controls.innerHTML = `
            <button 
                onclick="changePage(-1)" 
                class="px-4 py-2 bg-wow-dark border border-wow-border rounded hover:border-wow-blue transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                ${filters.currentPage === 1 ? 'disabled' : ''}>
                <i class="fas fa-chevron-left"></i> Anterior
            </button>
            <span class="text-sm text-gray-400">
                Página <span class="text-white font-bold">${filters.currentPage}</span> de ${totalPages}
            </span>
            <button 
                onclick="changePage(1)" 
                class="px-4 py-2 bg-wow-dark border border-wow-border rounded hover:border-wow-blue transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                ${filters.currentPage === totalPages ? 'disabled' : ''}>
                Siguiente <i class="fas fa-chevron-right"></i>
            </button>
        `;
        container.appendChild(controls);
    }

    if (sortedDates.length === 0) {
        container.innerHTML = `
            <div class="bg-wow-card border border-wow-border rounded-xl p-8 shadow-lg text-center">
                <i class="fas fa-search text-4xl text-gray-600 mb-3"></i>
                <p class="text-gray-400">No se encontraron resultados con los filtros aplicados</p>
            </div>
        `;
    }
}

window.changePage = function(delta) {
    const newPage = filters.currentPage + delta;
    const totalItems = Object.keys(ledgerData.filter(d => {
        if (filters.dateFrom && d.date < filters.dateFrom) return false;
        if (filters.dateTo && d.date > filters.dateTo) return false;
        
        if (filters.search) {
            const s = filters.search.toLowerCase();
            const inName = d.name?.toLowerCase().includes(s);
            const inActivities = d.activities?.toLowerCase().includes(s);
            const inObservation = d.observation?.toLowerCase().includes(s);
            const inDate = d.date?.includes(s);
            const inCat = d.cat?.toLowerCase().includes(s);
            if (!inName && !inActivities && !inObservation && !inDate && !inCat) return false;
        }
        return true;
    }).reduce((groups, d) => {
        if(!groups[d.date]) groups[d.date] = [];
        return groups;
    }, {})).length;
    const totalPages = Math.ceil(totalItems / filters.itemsPerPage);

    if (newPage > 0 && newPage <= totalPages) {
        filters.currentPage = newPage;
        renderItemsTable();
        // Scroll to top of list
        const container = document.getElementById('daily-performance-container');
        if(container) {
             const yOffset = -100; // Offset for header
             const y = container.getBoundingClientRect().top + window.pageYOffset + yOffset;
             window.scrollTo({top: y, behavior: 'smooth'});
        }
    }
}

window.toggleCard = function(cardId) {
    const clickedContent = document.getElementById(cardId);
    
    // Determinar si se va a abrir (si está cerrado actualmente)
    const isOpening = clickedContent.classList.contains('max-h-0');

    // CERRAR TODOS
    const allContents = document.querySelectorAll('.daily-card-content');
    allContents.forEach(content => {
        content.classList.add('max-h-0');
        content.classList.remove('max-h-[2000px]');
        
        // Reset icon
        const icon = document.getElementById(`icon-${content.id}`);
        if(icon) {
            icon.classList.add('fa-chevron-right');
            icon.classList.remove('fa-chevron-down');
        }
    });

    // ABRIR SÓLO EL RIQUEADO (si correspondía)
    if (isOpening) {
        const icon = document.getElementById(`icon-${cardId}`);
        clickedContent.classList.remove('max-h-0');
        clickedContent.classList.add('max-h-[2000px]');
        
        if (icon) {
            icon.classList.remove('fa-chevron-right');
            icon.classList.add('fa-chevron-down');
        }
    }
};

window.focusDay = function(dateStr) {
    const cardId = `card-${dateStr.replace(/-/g, '')}`;
    const cardContent = document.getElementById(cardId);
    
    if (!cardContent) return;
    
    // Si ya está abierto, solo scrollear
    if (!cardContent.classList.contains('max-h-0')) {
        cardContent.parentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
    }
    
    // Si está cerrado, usar toggleCard para abrirlo (y cerrar los demás)
    toggleCard(cardId);
    
    // Esperar un poco a que la animación empiece para scrollear
    setTimeout(() => {
        cardContent.parentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
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

window.openVideoModal = function(linksStr) {
    const modal = document.getElementById('video-modal');
    const container = document.getElementById('video-modal-content');
    const modalCont = document.getElementById('video-modal-container');
    
    if (!modal || !container || !modalCont) return;

    const links = linksStr.split('-').map(l => l.trim()).filter(l => l.length > 0);
    
    let html = '<div class="grid grid-cols-1 gap-4">';
    links.forEach((link, index) => {
        // Embed de YouTube si es link de youtube
        if (link.includes('youtube.com') || link.includes('youtu.be')) {
            const videoId = link.includes('v=') ? link.split('v=')[1].split('&')[0] : link.split('/').pop();
            html += `
                <div class="space-y-2">
                    <p class="text-xs text-gray-400 font-bold uppercase">Video ${index + 1}</p>
                    <div class="aspect-video w-full rounded-lg overflow-hidden border border-wow-border">
                        <iframe width="100%" height="100%" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
                    </div>
                </div>
            `;
        } else {
            html += `
                <a href="${link}" target="_blank" class="flex items-center justify-between p-4 bg-wow-dark border border-wow-border rounded-lg hover:border-wow-blue transition-all group">
                    <span class="text-white">Ver link externo ${index + 1}</span>
                    <i class="fas fa-external-link-alt text-wow-blue group-hover:scale-110 transition-transform"></i>
                </a>
            `;
        }
    });
    html += '</div>';
    
    container.innerHTML = html;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    
    setTimeout(() => {
        modalCont.classList.remove('scale-95', 'opacity-0');
        modalCont.classList.add('scale-100', 'opacity-100');
    }, 10);
};

window.closeVideoModal = function() {
    const modal = document.getElementById('video-modal');
    const modalCont = document.getElementById('video-modal-container');
    
    if (!modal || !modalCont) return;

    modalCont.classList.remove('scale-100', 'opacity-100');
    modalCont.classList.add('scale-95', 'opacity-0');
    
    setTimeout(() => {
        modal.classList.remove('flex');
        modal.classList.add('hidden');
        document.getElementById('video-modal-content').innerHTML = ''; // Limpiar iframes
    }, 300);
};

window.toggleActivities = function(id) {
    const el = document.getElementById(id);
    const icon = document.getElementById('icon-' + id);
    if(!el) return;
    
    if(el.classList.contains('hidden')) {
        el.classList.remove('hidden');
        if(icon) icon.classList.replace('fa-plus-circle', 'fa-minus-circle');
    } else {
        el.classList.add('hidden');
        if(icon) icon.classList.replace('fa-minus-circle', 'fa-plus-circle');
    }
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
    initIncomeForm();
    
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
