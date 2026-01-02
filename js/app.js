import { ledgerData } from './data.js';

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

// Global scope for tooltips
window.showTooltip = function(evt, date, income, expense) {
    const tt = document.getElementById('chart-tooltip');
    if(!tt) return;
    tt.style.display = 'block';
    
    const clientX = evt.clientX || (window.event && window.event.clientX) || 0;
    const clientY = evt.clientY || (window.event && window.event.clientY) || 0;
    
    // Adjust logic to be relative to container if needed, but fixed/absolute to body is easier
    // With Tailwind layout, `position: absolute` inside chart container is tricky if container is relative.
    // The previous CSS had chart-container relative.
    
    // Let's use simple offset inside the container for now, assuming the container is arguably large enough
    // OR just offset from mouse.
    
    // Note: In refined index.html, chart container has `relative`.
    // So `left/top` are relative to that container if `tt` is inside it.
    // We need to calculate position relative to the container, OR move TT to body.
    // Moving TT to body is safer for overflow.
    // But currently TT is inside `main-chart-container`.
    // So we need `evt.offsetX/Y` or similar.
    
    // Let's try direct mouse coordinates minus container offset?
    // Start with simple offset from mouse pointer assuming the chart handles hover events
    
    // Since `tt` is absolutely positioned inside `relative` container:
    // We need the mouse position relative to the element that fired the event (the rect).
    // `evt.target` is the rect.
    
    // Simplified: Just use `evt.layerX` / `evt.layerY` if available or `offsetX`.
    // But standard is `offsetX`.
    
    // However, since the SVG is full width/height, `offsetX` on the rect is relative to the rect?
    // Let's stick to a safe approach:
    // Actually, simply sticking it near the mouse pointer usually works if offsets are handled.
    
    // IMPORTANT: If `tt` is child of `container` (relative), `top` and `left` are relative to container.
    // `evt.clientX` is viewport. We need to subtract container's BB.
    const container = document.getElementById('main-chart-container');
    const rect = container.getBoundingClientRect();
    
    let x = clientX - rect.left + 15;
    let y = clientY - rect.top - 10;
    
    // Boundary check
    if (x + 150 > rect.width) x = x - 170; // flip left
    
    tt.style.left = x + 'px';
    tt.style.top = y + 'px';

    if (expense !== undefined) {
         tt.innerHTML = `
            <div style="font-weight:600; margin-bottom:4px; border-bottom:1px solid #4B5563; padding-bottom:4px; color:#F3F4F6;">${date}</div>
            <div style="color:#34D399; font-size:0.9em;">Ingresos: +${formatCurrency(income)}</div>
            <div style="color:#EF4444; font-size:0.9em;">Gastos: -${formatCurrency(expense)}</div>
         `;
    } else {
         tt.innerHTML = `<span>${date}</span>: ${income}`;
    }
};

window.hideTooltip = function() {
    const tt = document.getElementById('chart-tooltip');
    if(tt) tt.style.display = 'none';
};


// --- RENDER LOGIC ---

function initDashboard() {
    console.log("Initializing Tailwind Dashboard...");
    
    const totalIncome = ledgerData.reduce((sum, item) => sum + item.total, 0);
    const totalExpense = Math.floor(totalIncome * 0.35); 
    const netProfit = totalIncome - totalExpense;
    const margin = totalIncome > 0 ? ((netProfit / totalIncome) * 100).toFixed(1) : 0;

    const setHtml = (id, val) => { const el = document.getElementById(id); if(el) el.innerHTML = val; };
    const setText = (id, val) => { const el = document.getElementById(id); if(el) el.innerText = val; };

    setHtml('kpi-income', formatGold(totalIncome));
    setHtml('kpi-expense', formatGold(totalExpense));
    setHtml('kpi-profit', formatGold(netProfit));
    setText('kpi-margin', margin + '%');

    renderMainChart();
    renderTopCategories();
    renderItemsTable();
}

function renderMainChart() {
    const container = document.getElementById('main-chart-container');
    if(!container) return;

    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'];
    const chartData = months.map(m => {
        const income = Math.floor(Math.random() * 500000) + 100000;
        const expense = Math.floor(income * (0.2 + Math.random() * 0.3));
        return { month: m, income, expense };
    });

    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!w) return;

    const p = 30; 
    const maxVal = Math.max(...chartData.map(d => Math.max(d.income, d.expense))) * 1.1;

    let svgContent = '';
    const barWidth = (w - p*2) / chartData.length / 3; 

    chartData.forEach((d, i) => {
        const xBase = p + i * ((w - p*2) / chartData.length) + 20;
        const hIncome = (d.income / maxVal) * (h - p*2);
        const yIncome = h - p - hIncome;
        const hExpense = (d.expense / maxVal) * (h - p*2);
        const yExpense = h - p - hExpense;

        svgContent += `
            <rect x="${xBase}" y="${yIncome}" width="${barWidth}" height="${hIncome}" fill="#0074e0" rx="3" 
                  onmouseover="showTooltip(event, '${d.month}', ${d.income}, ${d.expense})" onmousemove="showTooltip(event, '${d.month}', ${d.income}, ${d.expense})" onmouseout="hideTooltip()"/>
            <rect x="${xBase + barWidth + 6}" y="${yExpense}" width="${barWidth}" height="${hExpense}" fill="#ef4444" rx="3" 
                  onmouseover="showTooltip(event, '${d.month}', ${d.income}, ${d.expense})" onmousemove="showTooltip(event, '${d.month}', ${d.income}, ${d.expense})" onmouseout="hideTooltip()"/>
            
            <text x="${xBase + barWidth}" y="${h - p + 20}" text-anchor="middle" fill="#6B7280" font-size="12" font-family="Inter">${d.month}</text>
        `;
    });

    svgContent += `<line x1="${p}" y1="${h-p}" x2="${w-p}" y2="${h-p}" stroke="#374151" stroke-width="1" />`;

    container.innerHTML = `
        <div class="chart-tooltip" id="chart-tooltip" style="position: absolute;"></div>
        <svg width="100%" height="100%" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
            ${svgContent}
        </svg>
    `;
}

function renderTopCategories() {
    const container = document.getElementById('top-categories-list');
    if(!container) return;

    const cats = {};
    let total = 0;
    ledgerData.forEach(d => {
        if(!cats[d.cat]) cats[d.cat] = 0;
        cats[d.cat] += d.total;
        total += d.total;
    });

    const displayCats = [
        { name: 'BoE', val: cats['boe'] || 0, color: 'bg-wow-blue' },
        { name: 'Materials', val: cats['mat'] || 0, color: 'bg-wow-gold' },
        { name: 'Transmog', val: cats['xmog'] || 0, color: 'bg-wow-blue' },
        { name: 'Consumibles', val: (cats['mat'] || 0) * 0.5, color: 'bg-wow-gold' }, 
    ].sort((a,b) => b.val - a.val);

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
    container.innerHTML = html;
}

function getColorClass(cat) {
    if(cat === 'boe') return 'text-purple-400 bg-purple-400/10 border-purple-400/20';
    if(cat === 'xmog') return 'text-green-400 bg-green-400/10 border-green-400/20';
    return 'text-gray-400 bg-gray-400/10 border-gray-400/20';
}

function renderItemsTable() {
    const tbody = document.getElementById('items-table-body');
    if(!tbody) return;
    tbody.innerHTML = '';

    const grouped = {};
    ledgerData.forEach(d => {
        if(!grouped[d.name]) grouped[d.name] = { ...d, count: 0, sumQty: 0, sumTotal: 0 };
        grouped[d.name].count++;
        grouped[d.name].sumQty += d.qty;
        grouped[d.name].sumTotal += d.total;
    });

    const itemsArr = Object.values(grouped).sort((a,b) => b.sumTotal - a.sumTotal);

    itemsArr.forEach(item => {
        const avgPrice = Math.round(item.sumTotal / item.sumQty);
        const tr = document.createElement('tr');
        tr.className = "hover:bg-white/[0.02] transition-colors group";
        
        tr.innerHTML = `
            <td class="py-3 px-2">
                <div class="flex items-center justify-between">
                    <div>
                        <a href="https://www.wowhead.com/item=${item.id}" target="_blank" class="font-bold text-white hover:text-wow-blue transition-colors">
                            ${item.name}
                        </a>
                        <span class="ml-2 px-1.5 py-0.5 text-[10px] uppercase font-bold border rounded ${getColorClass(item.cat)}">
                            ${item.cat}
                        </span>
                    </div>
                    <div class="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onclick="openItemHistory('${item.name}')" class="w-7 h-7 bg-wow-gold/10 text-wow-gold rounded flex items-center justify-center hover:bg-wow-gold hover:text-white transition-all">
                            <i class="fas fa-chart-line text-[10px]"></i>
                        </button>
                    </div>
                </div>
            </td>
            <td class="py-3 px-2 text-center text-gray-400 font-medium">${item.count}</td>
            <td class="py-3 px-2 text-center text-gray-400 font-medium">${item.sumQty}</td>
            <td class="py-3 px-2 text-right text-white/80">${formatGold(avgPrice)}</td>
            <td class="py-3 px-2 text-right font-bold text-wow-gold">${formatGold(item.sumTotal)}</td>
        `;
        tbody.appendChild(tr);
    });
    
    // Suma Oro Total Ganado (Footer de la tabla)
    const grandTotal = itemsArr.reduce((sum, item) => sum + item.sumTotal, 0);
    const totalEl = document.getElementById('table-total-gold');
    if(totalEl) totalEl.innerHTML = formatGold(grandTotal);

    if(window.$WowheadPower) window.$WowheadPower.refreshLinks();
}

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
            <circle cx="${x}" cy="${y}" r="6" fill="#fbbf24" stroke="#1c202a" stroke-width="2" style="cursor:pointer"
                    onmouseover="showTooltip(event, '${d.date}', ${d.price}, ${d.qty})" onmousemove="showTooltip(event, '${d.date}', ${d.price}, ${d.qty})" onmouseout="hideTooltip()"/>
        `;
    });

    container.innerHTML = `
        <div class="chart-tooltip" id="chart-tooltip" style="position: absolute;"></div>
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
});
window.addEventListener('resize', () => {
    renderMainChart();
});
