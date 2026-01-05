// Set default date to March 2, 2026 (Midnight expansion)
document.getElementById('deadlineDate').value = "2026-03-02";

// Global State
let manualDaily = false;

// Constants for Dates
const DATE_MIDNIGHT = '2026-03-02';

// --- FUNCIONES DE INTERFAZ (UI) ---

function setDeadline(dateStr) {
    const input = document.getElementById('deadlineDate');
    input.value = dateStr;
    calculate(); 
    
    input.classList.add('bg-yellow-900/40', 'border-wow-gold');
    setTimeout(() => {
        input.classList.remove('bg-yellow-900/40', 'border-wow-gold');
    }, 300);
}

// Helper to update button visuals based on current date
function updateButtonStates(currentDate) {
    const btnMid = document.getElementById('btnMidnight');

    if (!btnMid) return;

    const midActive = ['bg-purple-900/40', 'border-purple-500', 'text-purple-200', 'shadow-[0_0_10px_rgba(168,85,247,0.2)]'];
    const midInactive = ['bg-[#181226]', 'border-purple-900/30', 'text-purple-400/60', 'hover:text-purple-400', 'hover:border-purple-900/60'];

    btnMid.classList.remove(...midActive, ...midInactive);

    if (currentDate === DATE_MIDNIGHT) {
        btnMid.classList.add(...midActive);
    } else {
        btnMid.classList.add(...midInactive);
    }
}

function setCardStatus(cardId, iconBoxId, labelId, status) {
    const card = document.getElementById(cardId);
    const iconBox = document.getElementById(iconBoxId);
    const label = document.getElementById(labelId);
    
    const colors = {
        default: { border: 'border-l-wow-gold', iconBg: 'bg-yellow-900/20', iconText: 'text-yellow-500', label: 'text-yellow-500' },
        danger: { border: 'border-l-wow-danger', iconBg: 'bg-red-900/20', iconText: 'text-red-500', label: 'text-red-400' },
        success: { border: 'border-l-wow-success', iconBg: 'bg-green-900/20', iconText: 'text-green-500', label: 'text-green-400' }
    };

    card.classList.remove('border-l-wow-gold', 'border-l-wow-danger', 'border-l-wow-success');
    iconBox.className = 'p-1.5 rounded transition-colors duration-300';
    label.className = 'text-xs font-medium mb-1 transition-colors duration-300';

    const theme = colors[status];
    card.classList.add(theme.border);
    iconBox.classList.add(theme.iconBg, theme.iconText);
    label.classList.add(theme.label);
}

function handleTokenInput(input) {
    // Lógica de validación de límite de 1M y cálculo.
    let val = input.value.replace(/[^0-9.,]/g, '');
    let rawStr = val.replace(/[.,]/g, '');
    let raw = parseInt(rawStr);

    if (raw > 1000000) {
        input.value = "1000000"; 
        input.classList.add('text-red-500');
        setTimeout(() => {
            input.classList.remove('text-red-500');
        }, 300);
    } else {
        input.value = val;
    }
    
    calculate();
}

function handleDailyInput() {
    manualDaily = true;
    document.getElementById('syncBtn').classList.remove('hidden');
    document.getElementById('autoModeLabel').classList.add('opacity-0');
    calculate();
}

function enableAutoDaily() {
    manualDaily = false;
    document.getElementById('syncBtn').classList.add('clicked-spin'); 
    setTimeout(() => document.getElementById('syncBtn').classList.remove('clicked-spin'), 500);
    
    document.getElementById('syncBtn').classList.add('hidden');
    document.getElementById('autoModeLabel').classList.remove('opacity-0');
    document.getElementById('autoModeLabel').classList.add('text-wow-gold');
    calculate();
}

function resetForm() {
    document.getElementById('tokenPrice').value = "";
    document.getElementById('currentGold').value = "0";
    document.getElementById('dailyFarm').value = "0";
    document.getElementById('usdCost').value = "90";
    document.getElementById('deadlineDate').value = "2026-03-02";

    
    manualDaily = false;
    document.getElementById('syncBtn').classList.add('hidden');
    document.getElementById('autoModeLabel').classList.add('opacity-0'); 

    calculate();
}


// --- FUNCIONES DE CÁLCULO (LÓGICA) ---

function formatNumber(num) {
    // Formatea el número con separadores de miles para ES
    return new Intl.NumberFormat('es-ES').format(Math.round(num));
}

function getCleanGold(id) {
    // Limpia la entrada de oro (acepta . o , como separadores de miles)
    let val = document.getElementById(id).value;
    if (typeof val === 'string') {
        val = val.replace(/[.,\s]/g, ''); 
    }
    return parseInt(val) || 0;
}

function getCleanMoney(id) {
    // Limpia la entrada de USD (acepta coma como decimal)
    let val = document.getElementById(id).value;
    if (typeof val === 'string') {
        val = val.replace(/[, ]/g, ''); 
        val = val.replace(',', '.'); 
    }
    return parseFloat(val) || 0;
}


function calculate() {
    // --- 1. LECTURA DE ENTRADAS ---
    const tokenPrice = getCleanGold('tokenPrice');
    const currentGold = getCleanGold('currentGold');
    const costInput = getCleanMoney('usdCost'); 
    const deadlineVal = document.getElementById('deadlineDate').value;
    
    // Referencias a elementos UI para transiciones
    const resultsSection = document.getElementById('resultsSection');
    const mainGrid = document.getElementById('mainGrid');
    const inputCol = document.getElementById('inputCol');
    const resetContainer = document.getElementById('resetContainer');

    // --- 2. TRANSICIÓN DE LAYOUT ---
    if (tokenPrice <= 0) {
        // Estado 1: Inicial (Centrado)
        resultsSection.classList.add('hidden');
        resultsSection.classList.remove('fade-in-up');
        resultsSection.style.opacity = '0';
        
        resetContainer.classList.add('hidden');
        resetContainer.classList.remove('opacity-100');
        resetContainer.classList.add('opacity-0');
        
        mainGrid.classList.add('max-w-md', 'mx-auto', 'block');
        mainGrid.classList.remove('max-w-4xl', 'grid', 'grid-cols-1', 'lg:grid-cols-12', 'gap-6', 'items-start');
        inputCol.classList.remove('lg:col-span-5');
        return;
    } else {
        // Estado 2: Activo (Dividido)
        mainGrid.classList.remove('max-w-md', 'mx-auto', 'block');
        mainGrid.classList.add('max-w-4xl', 'grid', 'grid-cols-1', 'lg:grid-cols-12', 'gap-6', 'items-start');
        inputCol.classList.add('lg:col-span-5');

        resultsSection.classList.remove('hidden');
        if (resultsSection.style.opacity === '0') {
            resultsSection.classList.add('fade-in-up');
            resultsSection.style.opacity = '1';
        }

        resetContainer.classList.remove('hidden');
        setTimeout(() => {
            resetContainer.classList.remove('opacity-0');
            resetContainer.classList.add('opacity-100');
        }, 100);
    }

    if (!deadlineVal) return;

    // Actualiza el estado visual de los botones de fecha
    updateButtonStates(deadlineVal);

    const tokenValue = 15; // Fijo: $15 de saldo por ficha
    const currencySymbol = '$';

    // --- 3. CÁLCULOS PRINCIPALES ---
    
    // Conversión USD a Fichas (redondeo hacia arriba)
    const tokensNeeded = Math.ceil(costInput / tokenValue);
    document.getElementById('inputTokensDisplay').innerText = tokensNeeded;
    
    // Oro total requerido
    const totalGoldNeeded = tokensNeeded * tokenPrice;
    
    // Oro faltante (nunca negativo)
    let missingGold = totalGoldNeeded - currentGold;
    if (missingGold < 0) missingGold = 0;

    // Porcentaje de progreso
    let progress = 0;
    if (totalGoldNeeded > 0) {
        progress = (currentGold / totalGoldNeeded) * 100;
        if (progress > 100) progress = 100;
    }

    // --- 4. CÁLCULOS DE FECHAS ---
    const now = new Date();
    now.setHours(0,0,0,0);
    const dateParts = deadlineVal.split('-');
    const deadline = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]); 
    
    // Días restantes hasta la fecha límite
    const diffTime = deadline - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    
    // Oro diario estricto para la meta
    let dailyStrict = 0;
    if (diffDays > 0) {
        dailyStrict = missingGold / diffDays;
    } else if (missingGold > 0) {
        dailyStrict = missingGold;
    }

    // --- 5. LÓGICA DE AUTO-AJUSTE Y ESTADO ---
    
    // Auto-sincronización del Farm Diario (si no es manual)
    if (!manualDaily) {
        let autoValue = Math.ceil(dailyStrict);
        
        // Aplica el mínimo de 15k
        if (autoValue < 15000) {
            autoValue = 15000;
        }

        const inputEl = document.getElementById('dailyFarm');
        inputEl.value = new Intl.NumberFormat('es-ES').format(autoValue);
        document.getElementById('autoModeLabel').classList.remove('opacity-0');
    }

    // Lee el farm diario (ajustado automáticamente o manual)
    const dailyFarm = getCleanGold('dailyFarm');
    let status = 'default';
    
    // Comprobación de la advertencia de eficiencia
    const effWarning = document.getElementById('efficiencyWarning');
    if (manualDaily && dailyFarm > 0 && dailyFarm < 15000) {
        effWarning.classList.remove('hidden');
    } else {
        effWarning.classList.add('hidden');
    }

    // Determinación del estado (Amarillo/Verde/Rojo)
    if (missingGold <= 0) {
        status = 'success'; // Tarea terminada
    } else if (manualDaily) {
        // Modo Manual: Comparación directa
        if (dailyFarm < dailyStrict) {
            status = 'danger';
        } else {
            status = 'success';
        }
    } else {
        // Modo Auto: Si hay oro actual, cambia a "Verde" (plan activado)
        if (currentGold > 0) {
            status = 'success';
        } else {
            status = 'default'; // Neutral (Amarillo) si solo hay precio de ficha
        }
    }

    // --- 6. CÁLCULOS DE PROYECCIÓN REAL ---
    const realDaysNeeded = dailyFarm > 0 ? Math.ceil(missingGold / dailyFarm) : 0;
    const estimatedDate = new Date();
    estimatedDate.setDate(now.getDate() + realDaysNeeded);

    let dateText = "Nunca";
    if (realDaysNeeded <= 3650) { // Si es menos de 10 años
        dateText = estimatedDate.toLocaleDateString('es-ES', {
            day: '2-digit', month: '2-digit', year: 'numeric'
        });
    }
    
    // --- 7. ACTUALIZACIÓN DE INTERFAZ (UI) ---

    // Actualización de colores de tarjetas
    setCardStatus('strictCard', 'strictIconBox', 'strictLabel', status);
    setCardStatus('projectionCard', 'projectionIconBox', 'projectionLabel', status);

    // Color del campo Farm Diario
    const dailyInput = document.getElementById('dailyFarm');
    dailyInput.classList.remove('text-yellow-400', 'text-red-500', 'text-green-500');
    if (status === 'success') dailyInput.classList.add('text-green-500');
    else if (status === 'danger') dailyInput.classList.add('text-red-500');
    else dailyInput.classList.add('text-yellow-400');

    // --- RESULTADOS EN NÚMEROS ---
    document.getElementById('totalGoldNeeded').innerText = formatNumber(totalGoldNeeded);
    document.getElementById('tokensNeeded').innerText = tokensNeeded;
    document.getElementById('missingGold').innerText = formatNumber(missingGold);
    
    document.getElementById('progressBar').style.width = `${progress}%`;
    document.getElementById('progressText').innerText = `${Math.round(progress)}%`;
    
    const progressBar = document.getElementById('progressBar');
    if (progress >= 100) {
        progressBar.classList.add('bg-wow-success');
        progressBar.classList.remove('from-wow-gold', 'to-yellow-500');
    } else {
        progressBar.classList.remove('bg-wow-success');
        progressBar.classList.add('from-wow-gold', 'to-yellow-500');
    }

    document.getElementById('dailyNeededStrict').innerText = formatNumber(dailyStrict);
    document.getElementById('daysRemainingText').innerText = diffDays > 0 ? diffDays : 0;
    document.getElementById('targetDateDisplay').innerText = `${dateParts[2]}/${dateParts[1]}`;

    document.getElementById('realDaysNeeded').innerText = realDaysNeeded;
    document.getElementById('estimatedDate').innerText = dateText;
    document.getElementById('estimatedDate').className = "text-2xl font-bold transition-colors duration-300 text-white";

    // --- 8. LÓGICA DEL MENSAJE FINAL (IMPOSING) ---
    const tipContainer = document.getElementById('tipContainer');
    const tipIcon = document.getElementById('tipIcon');
    const tipText = document.getElementById('tipText');

    if (status === 'danger') {
        // Caso Negativo (ROJO)
        tipContainer.className = "bg-gradient-to-r from-red-900/50 to-red-900/10 border-l-4 border-red-500 shadow-lg shadow-red-900/30 rounded-r-lg p-6 flex gap-4 items-start transition-all duration-300";
        tipIcon.className = "fas fa-exclamation-circle text-red-400 mt-1 text-2xl";
        
        const daysLate = realDaysNeeded - diffDays;
        
        tipText.innerHTML = `
            <div class="text-base text-gray-300">
                <strong class="text-red-300 text-lg block mb-1">Atención:</strong> 
                Llegarás a comprarlo el <strong class="text-white text-lg">${dateText}</strong> (${daysLate} días tarde) manteniendo el ritmo por <strong class="text-white text-lg">${realDaysNeeded}</strong> días de farmeo a <strong class="text-white text-lg">${formatNumber(dailyFarm)}</strong> oro diario.
            </div>
            <div class="mt-3 p-3 bg-red-950/40 rounded border border-red-900/30 text-sm text-gray-400">
                <i class="fas fa-hand-holding-dollar mr-1 text-red-400"></i> Sugerencia: Aumenta tu farm diario o compra lo restante con saldo de la tienda.
            </div>
        `;
    } else if (status === 'success') {
        // Caso Positivo (VERDE)
        tipContainer.className = "bg-gradient-to-r from-green-900/50 to-green-900/10 border-l-4 border-green-500 shadow-lg shadow-green-900/30 rounded-r-lg p-6 flex gap-4 items-start transition-all duration-300";
        tipIcon.className = "fas fa-check-circle text-green-400 mt-1 text-2xl";
        
        if (missingGold <= 0) {
            tipText.innerHTML = `<strong class="text-green-300 text-lg">¡Felicidades!</strong> <div class="text-base mt-1">Ya tienes suficiente oro para comprar todo lo que necesitas.</div>`;
        } else {
            tipText.innerHTML = `<strong class="text-green-300 text-lg block mb-1">¡Vas por buen camino!</strong> <div class="text-base text-gray-300">Llegarás a comprarlo el <strong class="text-white text-lg">${dateText}</strong> manteniendo el ritmo por <strong class="text-white text-lg">${realDaysNeeded}</strong> días de farmeo a <strong class="text-white text-lg">${formatNumber(dailyFarm)}</strong> oro diario.</div>`;
        }
    } else {
        // Caso Neutro (AMARILLO - Plan Ideal)
        tipContainer.className = "bg-gradient-to-r from-yellow-900/40 to-yellow-900/10 border-l-4 border-yellow-500 shadow-lg shadow-yellow-900/30 rounded-r-lg p-6 flex gap-4 items-start transition-all duration-300";
        tipIcon.className = "fas fa-info-circle text-yellow-400 mt-1 text-2xl";
        
        tipText.innerHTML = `<strong class="text-yellow-400 text-lg block mb-1">Plan Ideal:</strong> <div class="text-base text-gray-300">Para lograr la meta, deberías farmear <strong class="text-white text-lg">${formatNumber(dailyFarm)}</strong> oro diario durante <strong class="text-white text-lg">${realDaysNeeded}</strong> días de farmeo.</div>`;
    }
}

// Initialize
calculate();

// --- AUTO FETCH WOW TOKEN (FIREBASE BRIDGE) ---
async function autoFetchToken() {
    const tokenInput = document.getElementById('tokenPrice');
    const updateLabel = document.getElementById('tokenLastUpdate');
    const timeDisplay = document.getElementById('lastUpdateTime');

    const HOURLY_MS = 60 * 60 * 1000;
    const now = Date.now();
    
    // Check Cache
    const cachedData = localStorage.getItem('wowTokenCache');
    if (cachedData) {
        const { price, timestamp } = JSON.parse(cachedData);
        if (now - timestamp < HOURLY_MS) {
            console.log("Using cached WoW Token price");
            tokenInput.value = price.toLocaleString('es-ES');
            updateLabel.classList.remove('hidden');
            timeDisplay.textContent = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            calculate();
            return;
        }
    }

    try {
        console.log("Fetching live WoW Token price...");
        const response = await fetch('/api/wow-token');
        const data = await response.json();
        
        if (data && data.price) {
            const goldPrice = Math.floor(data.price / 10000); // UI expects gold, API gives copper-like units
            tokenInput.value = goldPrice.toLocaleString('es-ES');
            
            // Save to Cache
            localStorage.setItem('wowTokenCache', JSON.stringify({
                price: goldPrice,
                timestamp: now
            }));

            updateLabel.classList.remove('hidden');
            timeDisplay.textContent = new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            calculate();
        }
    } catch (error) {
        console.error("Error fetching token:", error);
        tokenInput.placeholder = "Ingresa el precio...";
    }
}

autoFetchToken();
