/* ---------------- CONFIG ---------------- */

const CONFIG = {
    tickRate: 5000, 
    costScale: 1.15,
    aiScale: 1.8, 
    units: {
        furnace: { id: 'furnace', name: 'Heat Furnace', baseCost: 30, heatGen: 3 },
        toaster: { id: 'toaster', name: 'Auto-Toaster', baseCost: 15, bread: 1, heat: 1, toast: 1 },
        industrial: { id: 'industrial', name: 'Ind. Toaster', baseCost: 200, bread: 5, heat: 3, toast: 8 }, 
        synth: { id: 'synth', name: 'Bread Synth', baseCost: 1000, money: 2, bread: 8 }, 
        fusion: { id: 'fusion', name: 'Fusion Oven', baseCost: 5000, heatGen: 100 }
    },
    ai: {
        eff: { id: 'eff', name: 'Eff. Core', baseCost: 300, desc: '-5% Heat Use' },
        gen: { id: 'gen', name: 'Genomics', baseCost: 600, desc: '+10% Synth Output' },
        supply: { id: 'supply', name: 'Auto-Supply', baseCost: 800, desc: 'Lvl 1: 10/tick. Lvl 2: 100/tick...' },
        mkt: { id: 'mkt', name: 'Market AI', baseCost: 1200, desc: '-5% Base Bread Cost' }
    }
};

/* ---------------- NEWS DATABASE ---------------- */
const NEWS_ARTICLES = [
    { text: "Hipsters declare toast 'Canceled'. Smoothies are in.", type: 'demand', val: 0.6, effText: "Demand Low (60%)" },
    { text: "Scientific study proves burnt toast increases IQ.", type: 'demand', val: 1.5, effText: "Demand High (150%)" },
    { text: "Global yeast shortage! Bakers panicking.", type: 'bread', val: 2.0, effText: "Bread Cost High" },
    { text: "Bumper wheat harvest floods the market.", type: 'bread', val: 0.5, effText: "Bread Cost Low" },
    { text: "CRUST INC. CEO caught eating a bagel.", type: 'stock', id: 'crust', val: 0.7, effText: "CRUST Stock Crash" },
    { text: "BUTR LOGISTICS invents friction-less butter.", type: 'stock', id: 'butr', val: 1.3, effText: "BUTR Stock Surge" },
    { text: "Viral TikTok challenge: 'The Infinite Toast'.", type: 'demand', val: 1.3, effText: "Demand Up (130%)" },
    { text: "Artisan sourdough craze: queues form outside bakeries.", type: 'demand', val: 1.4, effText: "Demand Up (140%)" },
    { text: "Toaster recall after overheating reports.", type: 'demand', val: 0.7, effText: "Demand Down (70%)" },
    { text: "New 'zero-crust' loaf reduces waste and price.", type: 'bread', val: 0.75, effText: "Bread Cost Down (75%)" },
    { text: "'Toast Art' auction sells pieces for thousands.", type: 'demand', val: 1.6, effText: "Demand Spike (160%)" },
    { text: "Gluten-free boom: premium breads skyrocket.", type: 'bread', val: 1.5, effText: "Bread Cost Up (150%)" },
    { text: "Yeast Dynamics wins award for sustainable yeast.", type: 'stock', id: 'yeast', val: 1.25, effText: "YEAST Stock Rise" },
    { text: "Midnight toast clubs cause morning bread shortages.", type: 'bread', val: 1.8, effText: "Bread Cost Surge" },
    { text: "DIY sourdough starter trend reduces store purchases.", type: 'demand', val: 0.8, effText: "Demand Slightly Down (80%)" },
    { text: "Butter tariffs cut profits for spread suppliers.", type: 'stock', id: 'butr', val: 0.85, effText: "BUTR Stock Slide" }
];

/* ---------------- STATE ---------------- */
let state = {
    money: 30,
    loan: 0,
    bread: 20,
    toast: 0,
    heat: 0,
    units: { toaster: 0, industrial: 0, synth: 0, furnace: 0, fusion: 0 },
    ai: { eff: 0, gen: 0, supply: 0, mkt: 0 },
    stocks: [
        { id: 'crust', name: 'CRUST INC.', price: Math.random(18, 28), owned: 0, color: '#f59e0b' },
        { id: 'butr', name: 'BUTR LOGISTICS', price: Math.random(8, 18), owned: 0, color: '#3b82f6' },
        { id: 'yeast', name: 'YEAST DYNAMICS', price: Math.random(2, 8), owned: 0, color: '#a855f7' }
    ],
    news: { active: false, type: 'none', val: 1, text: '' },
    newsTimer: 0,
    userPrice: 2.00,
    breadMarket: {
        cost: 0.50,
        history: [0.50, 0.50, 0.50],
        trend: 'flat'
    },
    autoBuy: { enabled: false, threshold: 0.60, batchSize: 10 },
    lastStats: { revenue: 0, sold: 0, produced: 0, breadBought: 0, stockDelta: 0, interestPaid: 0 }
};

/* ---------------- HELPERS ---------------- */
const el = (id) => document.getElementById(id);
const cost = (base, count) => Math.floor(base * Math.pow(CONFIG.costScale, count));
const aiCost = (base, lvl) => Math.floor(base * Math.pow(CONFIG.aiScale, lvl));

/* ---------------- GAME LOOP ---------------- */
function gameTick() {
    const TICKS_PER_LOOP = 5; 
    
    // 1. LOAN INTEREST
    let interestCharge = 0;
    if(state.loan > 0) {
        interestCharge = Math.ceil(state.loan * 0.005); // 0.5% per tick
        state.loan += interestCharge;
    }

    // 2. Market Bread Price
    let discount = Math.min(0.5, state.ai.mkt * 0.05);
    let volatility = (Math.random() * 0.8) + 0.6; // 0.6x to 1.4x
    let rawPrice = 0.50 * volatility * (1 - discount);
    
    if(state.news.active && state.news.type === 'bread') rawPrice *= state.news.val;
    
    const newPrice = Math.max(0.10, parseFloat(rawPrice.toFixed(2)));

    // Update History
    const oldPrice = state.breadMarket.cost;
    state.breadMarket.cost = newPrice;
    state.breadMarket.history.push(newPrice);
    if(state.breadMarket.history.length > 4) state.breadMarket.history.shift();
    
    if(newPrice > oldPrice) state.breadMarket.trend = 'up';
    else if(newPrice < oldPrice) state.breadMarket.trend = 'down';
    else state.breadMarket.trend = 'flat';

    // 3. News
    state.newsTimer++;
    if(state.newsTimer > 12) { 
        if(Math.random() > 0.4) {
            generateNews();
            state.newsTimer = 0;
        }
    }
    
    // 4. Resources
    const heatReduc = Math.max(0.1, 1 - (state.ai.eff * 0.05));
    const synthBonus = 1 + (state.ai.gen * 0.10);

    // Heat Generation
    const heatGenRate = (state.units.furnace * CONFIG.units.furnace.heatGen) + 
                        (state.units.fusion * CONFIG.units.fusion.heatGen);
    const totalHeatGen = heatGenRate * TICKS_PER_LOOP;
    state.heat += totalHeatGen;

    // Bread Synth
    if(state.units.synth > 0) {
        const u = CONFIG.units.synth;
        const costPs = u.money * TICKS_PER_LOOP;
        const outPs = u.bread * TICKS_PER_LOOP * synthBonus;
        const limit = Math.floor(state.money / costPs);
        const run = Math.min(state.units.synth, limit);
        state.money -= run * costPs;
        state.bread += run * outPs;
    }

    // Auto Buy (SCALABLE BATCHES)
    let autoBought = 0;
    if(state.ai.supply > 0 && state.autoBuy.enabled) {
        if(state.breadMarket.cost <= state.autoBuy.threshold) {
            const amount = state.autoBuy.batchSize;
            const batchCost = state.breadMarket.cost * amount;
            
            if(state.money >= batchCost) {
                state.money -= batchCost;
                state.bread += amount;
                autoBought = amount;
            }
        }
    }

    // Production
    let produced = 0;
    let heatUsed = 0;

    const produce = (uKey, heatMod) => {
        if(state.units[uKey] <= 0) return;
        const u = CONFIG.units[uKey];
        const heatReq = u.heat * heatMod * TICKS_PER_LOOP;
        const breadReq = u.bread * TICKS_PER_LOOP;
        const out = u.toast * TICKS_PER_LOOP;
        
        const maxB = Math.floor(state.bread / breadReq);
        const maxH = Math.floor(state.heat / heatReq);
        const run = Math.min(state.units[uKey], maxB, maxH);

        state.bread -= run * breadReq;
        state.heat -= run * heatReq;
        state.toast += run * out;
        
        produced += run * out;
        heatUsed += run * heatReq;
    };

    produce('industrial', heatReduc);
    produce('toaster', heatReduc);

    // Sales
    let demandMod = 1.0;
    if(state.news.active && state.news.type === 'demand') demandMod = state.news.val;
    
    const baseDemand = 300; 
    const demand = Math.floor((baseDemand * demandMod) / Math.pow(state.userPrice, 1.5));
    
    const amountSold = Math.min(state.toast, demand);
    const revenue = amountSold * state.userPrice;
    
    state.toast -= amountSold;
    state.money += revenue;

    // Stocks
    let totalStockValChange = 0;
    state.stocks.forEach(stk => {
        const oldP = stk.price;
        let vol = 0.05;
        if(state.news.active && state.news.type === 'stock' && state.news.id === stk.id) {
            stk.price *= state.news.val;
            state.news.active = false; 
            el('news-container').style.display = 'none'; 
        } else {
            const chg = 1 + (Math.random() * vol * 2 - vol);
            stk.price = Math.max(1, stk.price * chg);
        }
        totalStockValChange += (stk.price - oldP) * stk.owned;
    });

    // Stats
    state.lastStats = {
        revenue: revenue,
        sold: amountSold,
        produced: produced,
        heat: totalHeatGen - heatUsed,
        breadBought: autoBought,
        stockDelta: totalStockValChange,
        interestPaid: interestCharge
    };

    updateUI();
    updateCharts();
    resetProgressBar();
}

function generateNews() {
    const article = NEWS_ARTICLES[Math.floor(Math.random() * NEWS_ARTICLES.length)];
    state.news = { active: true, type: article.type, val: article.val, id: article.id, text: article.text };
    
    const newsEl = el('news-container');
    el('news-text').textContent = article.text;
    el('news-effect').textContent = "Effect: " + article.effText;
    newsEl.style.display = 'block';
    
    setTimeout(() => {
        if(state.news.text === article.text) { 
             state.news.active = false; 
             newsEl.style.display = 'none';
        }
    }, 19000); 
}

/* ---------------- UI ---------------- */
function init() {
    // Units
    const uDiv = el('units-list');
    for(let k in CONFIG.units) {
        let u = CONFIG.units[k];
        let d = document.createElement('div');
        d.className = 'unit-item';
        d.innerHTML = `
            <div>
                <div style="font-weight:bold">${u.name} <span style="font-size:11px;color:#9ca3af">x<span id="cnt-${u.id}">0</span></span></div>
                <div style="font-size:11px;color:#9ca3af">${getUnitDesc(u)}</div>
            </div>
            <button class="btn-buy" id="btn-${u.id}" style="width:auto">Buy $<span id="cost-${u.id}">${u.baseCost}</span></button>
        `;
        uDiv.appendChild(d);
        el(`btn-${u.id}`).onclick = () => {
            let c = cost(u.baseCost, state.units[u.id]);
            if(state.money >= c) { state.money -= c; state.units[u.id]++; updateUI(); }
        };
    }

    // AI
    const aDiv = el('ai-list');
    for(let k in CONFIG.ai) {
        let a = CONFIG.ai[k];
        let d = document.createElement('div');
        d.className = 'ai-card';
        d.innerHTML = `
            <div style="font-size:12px;font-weight:bold">${a.name}</div>
            <div style="font-size:10px;color:#9ca3af">${a.desc}</div>
            <div style="font-size:11px;color:var(--accent);margin-top:4px">Lvl <span id="lvl-${a.id}">0</span></div>
            <div style="font-size:10px;margin-top:2px">$<span id="aicost-${a.id}">${a.baseCost}</span></div>
        `;
        d.onclick = () => {
            let c = aiCost(a.baseCost, state.ai[a.id]);
            if(state.money >= c) { state.money -= c; state.ai[a.id]++; updateUI(); }
        }
        aDiv.appendChild(d);
    }

    // Stocks
    const sDiv = el('stock-list');
    state.stocks.forEach(stk => {
        let d = document.createElement('div');
        d.className = 'stock-item';
        d.style.borderLeftColor = stk.color;
        d.innerHTML = `
            <div class="stock-header">
                <span style="font-weight:bold; color:${stk.color}">${stk.name}</span>
                <span>Price: <strong id="price-${stk.id}">$0.00</strong></span>
            </div>
            <div class="stat-row" style="border:none; padding:0 0 5px 0">
                <span>Owned: <span id="owned-${stk.id}">0</span></span>
                <span>Val: $<span id="val-${stk.id}">0</span></span>
            </div>
            <div style="display:flex; gap:5px;">
                <button class="btn-stock-buy" id="buy-${stk.id}">Buy</button>
                <button class="btn-stock-sell" id="sell-${stk.id}">Sell</button>
            </div>
        `;
        sDiv.appendChild(d);
        el(`buy-${stk.id}`).onclick = () => {
            let s = state.stocks.find(x => x.id === stk.id);
            if(state.money >= s.price) { state.money -= s.price; s.owned++; updateUI(); }
        };
        el(`sell-${stk.id}`).onclick = () => {
            let s = state.stocks.find(x => x.id === stk.id);
            if(s.owned > 0) { state.money += s.price; s.owned--; updateUI(); }
        };
    });

    // Buttons
    el('btn-manual-toast').onclick = () => { if(state.bread>=1){ state.bread--; state.toast++; updateUI();} };
    el('btn-buy-bread').onclick = () => { 
        let price = state.breadMarket.cost * 10;
        if(state.money >= price){ state.money -= price; state.bread+=10; updateUI();} 
    };

    // Bank
    el('btn-borrow').onclick = () => {
        if(state.loan < 5000) {
            state.loan += 500;
            state.money += 500;
            updateUI();
        }
    };
    el('btn-repay').onclick = () => {
        if(state.money >= 500 && state.loan > 0) {
            let amt = Math.min(state.loan, 500);
            state.loan -= amt;
            state.money -= amt;
            updateUI();
        }
    };

    // Controls
    el('chk-auto-buy').onclick = (e) => { state.autoBuy.enabled = e.target.checked; };
    el('inp-auto-threshold').oninput = (e) => { state.autoBuy.threshold = parseFloat(e.target.value) || 0.50; };
    el('price-slider').oninput = (e) => { state.userPrice = parseFloat(e.target.value); updateUI(); };

    initCharts();
    updateUI();
    startProgressBar();
    setInterval(gameTick, CONFIG.tickRate);
}

// Function to set batch size from buttons
function setBatch(size) {
    state.autoBuy.batchSize = size;
    updateUI();
}

function getUnitDesc(u) {
    if(u.heatGen) return `+${u.heatGen*5} Heat / 5s`;
    if(u.money) return `-$${u.money*5} -> +${u.bread*5} Bread / 5s`;
    return `-${u.bread*5} Bread, -${u.heat*5} Heat -> +${u.toast*5} Toast / 5s`;
}

function updateUI() {
    el('res-money').textContent = Math.floor(state.money);
    el('res-toast').textContent = Math.floor(state.toast);
    el('res-bread').textContent = Math.floor(state.bread);
    el('res-heat').textContent = Math.floor(state.heat);

    el('val-price').textContent = state.userPrice.toFixed(2);
    el('val-loan').textContent = state.loan.toFixed(0);
    
    // Demand
    let demandMod = (state.news.active && state.news.type === 'demand') ? state.news.val : 1.0;
    const estDemand = Math.floor((300 * demandMod) / Math.pow(state.userPrice, 1.5));
    el('val-demand').textContent = estDemand + " /tick";
    el('val-demand').style.color = (state.news.active && state.news.type === 'demand') 
        ? (state.news.val > 1 ? 'var(--success)' : 'var(--danger)') : 'inherit';

    // Bread Market
    const bCost = state.breadMarket.cost;
    el('cost-bread-market').textContent = (bCost * 10).toFixed(2); 
    
    // Auto Buy Logic & Visibility
    if(state.ai.supply > 0) {
        el('auto-supply-panel').style.display = 'block';
        el('disp-batch-size').textContent = state.autoBuy.batchSize;
        
        // Show/Hide Batch buttons based on level
        el('batch-100').style.display = state.ai.supply >= 2 ? 'block' : 'none';
        el('batch-1000').style.display = state.ai.supply >= 3 ? 'block' : 'none';
        el('batch-10000').style.display = state.ai.supply >= 4 ? 'block' : 'none';

        // Update active class for buttons
        ['10', '100', '1000', '10000'].forEach(val => {
            const btn = el('batch-' + val);
            if(parseInt(val) === state.autoBuy.batchSize) btn.classList.add('active');
            else btn.classList.remove('active');
        });

        // Price Trend
        const pDisp = el('disp-current-price');
        pDisp.textContent = '$' + bCost.toFixed(2);
        pDisp.style.color = (bCost <= state.autoBuy.threshold) ? 'var(--success)' : 'var(--danger)';

        const tDisp = el('disp-price-trend');
        if(state.breadMarket.trend === 'up') { tDisp.textContent = '▲'; tDisp.style.color = 'var(--danger)'; }
        else if (state.breadMarket.trend === 'down') { tDisp.textContent = '▼'; tDisp.style.color = 'var(--success)'; }
        else { tDisp.textContent = '—'; tDisp.style.color = 'gray'; }

        el('disp-price-history').textContent = state.breadMarket.history.map(p => '$'+p.toFixed(2)).join(' → ');

        // Batch Cost Calculation
        const currentBatchCost = bCost * state.autoBuy.batchSize;
        el('val-auto-cost').textContent = '$' + currentBatchCost.toFixed(2);
        el('val-auto-cost').style.color = (state.money >= currentBatchCost) ? 'var(--text-main)' : 'var(--danger)';
    }

    // Stocks
    state.stocks.forEach(stk => {
        el(`price-${stk.id}`).textContent = '$' + stk.price.toFixed(2);
        el(`owned-${stk.id}`).textContent = stk.owned;
        el(`val-${stk.id}`).textContent = (stk.owned * stk.price).toFixed(0);
    });

    // Stats
    el('stat-revenue').textContent = '$' + state.lastStats.revenue.toFixed(2);
    el('stat-interest').textContent = '-$' + state.lastStats.interestPaid.toFixed(2);
    el('stat-sold').textContent = state.lastStats.sold;
    el('stat-produced').textContent = state.lastStats.produced;
    el('stat-bread-cost').textContent = '$' + state.breadMarket.cost.toFixed(2);
    el('stat-bread-bought').textContent = state.lastStats.breadBought;
    el('stat-stock-trend').innerHTML = state.lastStats.stockDelta >= 0 
        ? `<span style="color:var(--success)">▲ $${state.lastStats.stockDelta.toFixed(2)}</span>` 
        : `<span style="color:var(--danger)">▼ $${state.lastStats.stockDelta.toFixed(2)}</span>`;

    // Costs
    for(let k in CONFIG.units) {
        el(`cnt-${k}`).textContent = state.units[k];
        el(`cost-${k}`).textContent = cost(CONFIG.units[k].baseCost, state.units[k]);
        el(`btn-${k}`).disabled = state.money < cost(CONFIG.units[k].baseCost, state.units[k]);
    }
    for(let k in CONFIG.ai) {
        el(`lvl-${k}`).textContent = state.ai[k];
        el(`aicost-${k}`).textContent = aiCost(CONFIG.ai[k].baseCost, state.ai[k]);
    }
}

/* ---------------- PROGRESS BAR ---------------- */
function startProgressBar() {
    const bar = el('tick-bar');
    bar.style.transition = 'none'; bar.style.width = '0%';
    setTimeout(() => { bar.style.transition = `width ${CONFIG.tickRate}ms linear`; bar.style.width = '100%'; }, 50);
}
function resetProgressBar() { startProgressBar(); }

/* ---------------- CHARTS ---------------- */
let stockChart, prodChart, invChart;
const LABEL_BUFFER = Array(60).fill('');

function initCharts() {
    // Stocks
    const stockDatasets = state.stocks.map(stk => ({
        label: stk.name, data: Array(60).fill(stk.price), borderColor: stk.color, tension: 0.1, pointRadius: 0, borderWidth: 2
    }));
    stockChart = new Chart(el('stockChart'), {
        type: 'line', data: { labels: LABEL_BUFFER, datasets: stockDatasets },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { display: false }, y: { grid: { color: '#374151' } } } }
    });

    // Production
    prodChart = new Chart(el('productionChart'), {
        type: 'line', data: { labels: LABEL_BUFFER, datasets: [
            { label: 'Heat Reserve', data: Array(60).fill(0), borderColor: '#f97316', backgroundColor:'rgba(249,115,22,0.1)', fill:true, pointRadius: 0 },
            { label: 'Toast Prod', data: Array(60).fill(0), borderColor: '#9ca3af', borderDash:[5,5], pointRadius: 0 }
        ] },
        options: { responsive: true, maintainAspectRatio: false, scales:{x:{display:false}, y:{beginAtZero:true, grid:{color:'#374151'}}} }
    });

    // Inventory
    invChart = new Chart(el('inventoryChart'), {
        type: 'bar', data: { labels: LABEL_BUFFER, datasets: [
            { label: 'Bread', data: Array(60).fill(20), backgroundColor: '#6b7280' },
            { label: 'Toast', data: Array(60).fill(0), backgroundColor: '#f59e0b' }
        ] },
        options: { responsive: true, maintainAspectRatio: false, scales:{x:{display:false, stacked:true}, y:{display:false, stacked:true}} }
    });
}

function updateCharts() {
    stockChart.data.datasets.forEach((ds, i) => { ds.data.push(state.stocks[i].price); if(ds.data.length > 60) ds.data.shift(); });
    stockChart.update();
    const updateData = (chart, ...dataSets) => {
        chart.data.datasets.forEach((ds, i) => { ds.data.push(dataSets[i]); if(ds.data.length > 60) ds.data.shift(); });
        chart.update();
    };
    updateData(prodChart, state.heat, state.lastStats.produced);
    updateData(invChart, state.bread, state.toast);
}

window.onload = init;