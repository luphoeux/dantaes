// --- 1. DATOS REALES (Desde Imagen) ---
const realSales = [
    { name: "Tendón de zancaalta", qty: 148, total: 70383, cat: "mat", id: 212470 },
    { name: "Urditela", qty: 396, total: 4511, cat: "mat", id: 212462 },
    { name: "Madeja de urditela", qty: 108, total: 1871, cat: "mat", id: 212471 },
    { name: "Urditela", qty: 317, total: 3638, cat: "mat", id: 212462 },
    { name: "Madeja de urditela", qty: 57, total: 984, cat: "mat", id: 212471 },
    { name: "Urditela", qty: 601, total: 6881, cat: "mat", id: 212462 },
    { name: "Sombra primigenia", qty: 4, total: 514, cat: "mat", id: 22467 },
    { name: "Madeja de urditela", qty: 18, total: 362, cat: "mat", id: 212471 },
    { name: "Urditela", qty: 233, total: 2433, cat: "mat", id: 212462 },
    { name: "Madeja de urditela", qty: 44, total: 760, cat: "mat", id: 212471 },
    { name: "Urditela", qty: 82, total: 779, cat: "mat", id: 212462 },
    { name: "Madeja de urditela", qty: 124, total: 2378, cat: "mat", id: 212471 },
    { name: "Carne en salmuera", qty: 2, total: 8, cat: "mat", id: 212472 },
    { name: "Tejido del crepúsculo", qty: 98, total: 3785, cat: "mat", id: 212463 }
];

export function generateLedgerData() {
    return realSales.map((item, index) => {
        const date = new Date();
        // Distribute sales over the last 2 days for visual variety in the chart
        date.setDate(date.getDate() - (index % 2)); 
        
        return {
            ...item,
            price: Math.floor(item.total / item.qty),
            date: date.toISOString().split("T")[0],
            jsDate: date
        };
    }).sort((a, b) => b.jsDate - a.jsDate);
}

export const ledgerData = generateLedgerData();
