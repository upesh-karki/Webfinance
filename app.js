// === DB & UTILS ===
const DB = {
    get: (key) => JSON.parse(localStorage.getItem(key) || '[]'),
    set: (key, val) => localStorage.setItem(key, JSON.stringify(val)),
    push: (key, item) => {
        const arr = DB.get(key);
        item.id = Date.now() + Math.random();
        arr.push(item);
        DB.set(key, arr);
        return item;
    },
    delete: (key, id) => {
        const arr = DB.get(key).filter(item => item.id!== id);
        DB.set(key, arr);
    }
};

const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
const today = new Date().toISOString().split('T')[0];
document.getElementById('expDate').value = today;
document.getElementById('incDate').value = today;

function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

function openAddSheet() {
    document.getElementById('overlay').classList.add('show');
    document.getElementById('addSheet').classList.add('show');
    loadSuggestions();
}

function closeSheet() {
    document.getElementById('overlay').classList.remove('show');
    document.getElementById('addSheet').classList.remove('show');
}

function toggleTheme() {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', isDark? 'dark' : 'light');
    showToast(isDark? 'Dark mode on' : 'Light mode on');
}

// === VIEWS ===
function showView(view) {
    document.querySelectorAll('.view').forEach(v => v.style.display = 'none');
    document.getElementById(view).style.display = 'block';
    document.querySelectorAll('.nav-item').forEach(t => t.classList.remove('active'));
    event?.target.closest('.nav-item')?.classList.add('active');

    if(view === 'dashboard') renderDashboard();
    if(view === 'expenses') renderExpenses();
    if(view === 'goals') renderGoals();
    if(view === 'income') renderIncome();
}

// === CRUD ===
function saveExpense() {
    const exp = {
        amount: parseFloat(document.getElementById('expAmount').value),
        name: document.getElementById('expName').value.trim(),
        category: document.getElementById('expCategory').value,
        date: document.getElementById('expDate').value,
        timestamp: new Date().toISOString()
    };
    if(!exp.amount ||!exp.name) return showToast('Enter amount and name');
    DB.push('expenses', exp);
    showToast('Expense saved');
    closeSheet();
    document.getElementById('expAmount').value = '';
    document.getElementById('expName').value = '';
    renderDashboard();
}

function saveIncome() {
    const inc = {
        amount: parseFloat(document.getElementById('incAmount').value),
        type: document.getElementById('incType').value,
        freq: document.getElementById('incFreq').value,
        date: document.getElementById('incDate').value
    };
    if(!inc.amount) return showToast('Enter amount');
    DB.push('income', inc);
    showToast('Income added');
    document.getElementById('incAmount').value = '';
    renderIncome();
}

function addGoal() {
    const goal = {
        name: document.getElementById('goalName').value.trim(),
        target: parseFloat(document.getElementById('goalAmount').value),
        date: document.getElementById('goalDate').value,
        created: new Date().toISOString()
    };
    if(!goal.name ||!goal.target ||!goal.date) return showToast('Enter all goal details');
    DB.push('goals', goal);
    showToast('Goal created');
    document.getElementById('goalName').value = '';
    document.getElementById('goalAmount').value = '';
    document.getElementById('goalDate').value = '';
    renderGoals();
}

function deleteGoal(id) {
    if(!confirm('Delete this goal?')) return;
    DB.delete('goals', id);
    showToast('Goal deleted');
    renderGoals();
}

function deleteExpense(id) {
    if(!confirm('Delete this expense?')) return;
    DB.delete('expenses', id);
    showToast('Expense deleted');
    renderExpenses();
    renderDashboard();
}

function deleteIncome(id) {
    if(!confirm('Delete this income?')) return;
    DB.delete('income', id);
    showToast('Income deleted');
    renderIncome();
    renderDashboard();
}

// === ANALYTICS ===
function calculateMetrics() {
    const expenses = DB.get('expenses');
    const income = DB.get('income');
    const now = new Date();
    const thisMonth = now.getMonth(), thisYear = now.getFullYear();
    const lastMonth = thisMonth === 0? 11 : thisMonth - 1;
    const lastMonthYear = thisMonth === 0? thisYear - 1 : thisYear;

    const filterMonth = (items, m, y) => items.filter(i => {
        const d = new Date(i.date);
        return d.getMonth() === m && d.getFullYear() === y;
    });

    const sumIncome = (items) => items.reduce((sum, i) => {
        if(i.freq === 'monthly' || i.freq === 'once') return sum + i.amount;
        if(i.freq === 'biweekly') return sum + i.amount * 2;
        if(i.freq === 'weekly') return sum + i.amount * 4;
        return sum;
    }, 0);

    const thisInc = sumIncome(filterMonth(income, thisMonth, thisYear));
    const lastInc = sumIncome(filterMonth(income, lastMonth, lastMonthYear));
    const thisExp = filterMonth(expenses, thisMonth, thisYear).reduce((s,e) => s + e.amount, 0);
    const lastExp = filterMonth(expenses, lastMonth, lastMonthYear).reduce((s,e) => s + e.amount, 0);

    // Projections
    const expMap = {};
    expenses.forEach(e => {
        const key = e.name.toLowerCase() + '|' + e.category;
        if(!expMap[key]) expMap[key] = [];
        expMap[key].push(e.amount);
    });

    let projectedExp = 0;
    Object.entries(expMap).forEach(([key, amounts]) => {
        const [, cat] = key.split('|');
        const avg = amounts.reduce((a,b) => a+b, 0) / amounts.length;
        const last = amounts[amounts.length - 1];
        if(cat === 'fixed') projectedExp += last;
        else if(cat === 'range') projectedExp += 0.6 * last + 0.4 * avg;
        else if(cat === 'dynamic') projectedExp += avg;
    });

    return { thisInc, lastInc, thisExp, lastExp, projectedExp, expMap, expenses, income };
}

// === RENDER ===
function renderDashboard() {
    const { thisInc, lastInc, thisExp, lastExp, projectedExp, expMap } = calculateMetrics();
    const net = thisInc - thisExp;
    const lastNet = lastInc - lastExp;
    const netChange = lastNet === 0? 0 : ((net - lastNet) / Math.abs(lastNet)) * 100;

    const hour = new Date().getHours();
    const greeting = hour < 12? 'Good morning' : hour < 18? 'Good afternoon' : 'Good evening';
    document.getElementById('greeting').textContent = `${greeting}, Upesh`;

    document.getElementById('netMonth').textContent = fmt(net);
    document.getElementById('netMonth').className = `metric-value lg ${net >= 0? 'positive' : 'negative'}`;
    document.getElementById('netChange').textContent = `${netChange >= 0? '+' : ''}${netChange.toFixed(1)}% vs last month`;
    document.getElementById('netChange').className = `metric-change ${netChange >= 0? 'positive' : 'negative'}`;
    document.getElementById('monthIncome').textContent = fmt(thisInc);
    document.getElementById('monthExpense').textContent = fmt(thisExp);

    // Insights
    const insights = [];
    Object.entries(expMap).forEach(([key, amounts]) => {
        const [name, cat] = key.split('|');
        if(cat === 'range' && amounts.length >= 2) {
            const last = amounts[amounts.length - 1];
            const prev = amounts[amounts.length - 2];
            if(last > prev * 1.2) insights.push(`${name} is up ${((last/prev - 1) * 100).toFixed(0)}% from last month`);
        }
    });
    if(thisExp > thisInc) insights.push('⚠️ You spent more than you earned this month');
    if(insights.length === 0) insights.push('Your spending is consistent. Keep building those savings!');
    document.getElementById('insights').innerHTML = insights.map(i => `<div class="insight">${i}</div>`).join('');

    // Recent expenses
    const recent = DB.get('expenses').slice(-3).reverse();
    document.getElementById('recentExpenses').innerHTML = recent.length? recent.map(e => `
    <div class="list-item">
      <div class="flex">
        <div class="avatar">${e.name[0].toUpperCase()}</div>
        <div>
          <div style="font-weight: 500;">${e.name}</div>
          <div style="font-size: 13px; color: var(--text-muted);">${new Date(e.date).toLocaleDateString()} • <span class="badge ${e.category}">${e.category}</span></div>
        </div>
      </div>
      <div style="font-weight: 600;" class="negative">-${fmt(e.amount)}</div>
    </div>
  `).join('') : '<div class="empty"><svg fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clip-rule="evenodd"/></svg><p>No expenses yet<br>Tap Add to get started</p></div>';

    renderCharts(thisInc, thisExp, projectedExp);
}

function renderCharts(inc, exp, projExp) {
    // Forecast bar chart
    const ctx1 = document.getElementById('forecastChart');
    if(window.forecastChart) window.forecastChart.destroy();
    window.forecastChart = new Chart(ctx1, {
        type: 'bar',
        data: {
            labels: ['This Month', 'Next Month', 'Month +2'],
            datasets: [
                { label: 'Income', data: [inc, inc, inc], backgroundColor: '#10b981', borderRadius: 8 },
                { label: 'Expenses', data: [exp, projExp, projExp], backgroundColor: '#f43f5e', borderRadius: 8 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { grid: { color: 'var(--border)' }, ticks: { color: 'var(--text-muted)' } },
                x: { grid: { display: false }, ticks: { color: 'var(--text-muted)' } }
            }
        }
    });

    // Sparkline - last 6 months net
    const ctx2 = document.getElementById('sparkline');
    const expenses = DB.get('expenses');
    const income = DB.get('income');
    const months = [];
    for(let i = 5; i >= 0; i--) {
        const d = new Date(); d.setMonth(d.getMonth() - i);
        const m = d.getMonth(), y = d.getFullYear();
        const mExp = expenses.filter(e => { const ed = new Date(e.date); return ed.getMonth() === m && ed.getFullYear() === y; })
            .reduce((s,e) => s + e.amount, 0);
        const mInc = income.filter(i => { const id = new Date(i.date); return id.getMonth() === m && id.getFullYear() === y; })
            .reduce((s,i) => s + (i.freq === 'monthly' || i.freq === 'once'? i.amount : i.freq === 'biweekly'? i.amount * 2 : i.amount * 4), 0);
        months.push(mInc - mExp);
    }

    if(window.sparkChart) window.sparkChart.destroy();
    window.sparkChart = new Chart(ctx2, {
        type: 'line',
        data: {
            labels: ['', '', '', '', '', ''],
            datasets: [{ data: months, borderColor: '#0ea5e9', borderWidth: 2, tension: 0.4, pointRadius: 0, fill: true, backgroundColor: 'rgb(14 165 233 / 0.1)' }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { display: false }, y: { display: false } } }
    });
}
function renderExpenses() {
    const expenses = DB.get('expenses').reverse();
    document.getElementById('allExpenses').innerHTML = expenses.length? expenses.map(e => `
    <div class="list-item">
      <div class="flex">
        <div class="avatar">${e.name[0].toUpperCase()}</div>
        <div>
          <div style="font-weight: 500;">${e.name}</div>
          <div style="font-size: 13px; color: var(--text-muted);">${new Date(e.date).toLocaleDateString()} • <span class="badge ${e.category}">${e.category}</span></div>
        </div>
      </div>
      <div class="flex" style="gap: 8px;">
        <div style="text-align: right;">
          <div style="font-weight: 600;" class="negative">-${fmt(e.amount)}</div>
        </div>
        <button class="icon danger" style="width: 36px; height: 36px;" onclick="deleteExpense('${e.id}')">
          <svg width="16" height="16" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>
        </button>
      </div>
    </div>
  `).join('') : '<div class="empty"><svg fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clip-rule="evenodd"/></svg><p>No expenses yet<br>Tap Add to get started</p></div>';
}

function renderGoals() {
    const goals = DB.get('goals');
    const { thisInc, thisExp } = calculateMetrics();
    const saved = Math.max(0, thisInc - thisExp);

    document.getElementById('goalsList').innerHTML = goals.length? goals.map(g => {
        const targetDate = new Date(g.date);
        const createdDate = new Date(g.created);
        const now = new Date();
        const totalMonths = Math.max(1, Math.ceil((targetDate - createdDate) / (1000*60*60*24*30)));
        const monthsPassed = Math.ceil((now - createdDate) / (1000*60*60*24*30));
        const monthsLeft = Math.max(0, Math.ceil((targetDate - now) / (1000*60*60*24*30)));

        // Assume user saves consistently - this is current progress
        const expectedProgress = (monthsPassed / totalMonths) * g.target;
        const currentSaved = Math.min(saved, expectedProgress); // Simplified: using this month's savings
        const progress = Math.min(100, (currentSaved / g.target) * 100);
        const needPerMonth = monthsLeft > 0? Math.max(0, (g.target - currentSaved) / monthsLeft) : 0;

        return `
      <div class="card">
        <div class="flex flex-between" style="margin-bottom: 8px;">
          <h3>${g.name}</h3>
          <button class="icon danger" style="width: 32px; height: 32px;" onclick="deleteGoal('${g.id}')">
            <svg width="14" height="14" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>
          </button>
        </div>
        <div class="flex flex-between" style="margin-bottom: 4px;">
          <span style="font-size: 13px; color: var(--text-muted);">${fmt(currentSaved)} of ${fmt(g.target)}</span>
          <span style="font-size: 13px; font-weight: 600;">${progress.toFixed(0)}%</span>
        </div>
        <div class="progress"><div class="progress-fill" style="width:${progress}%"></div></div>
        <p style="color: var(--text-muted); font-size: 13px; margin-top: 8px;">
          ${monthsLeft > 0? `Save ${fmt(needPerMonth)}/mo to reach by ${targetDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}` : 'Goal deadline reached'}
        </p>
      </div>`;
    }).join('') : '<div class="empty"><svg fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg><p>No goals yet<br>Create one to start saving</p></div>';
}

function renderIncome() {
    const income = DB.get('income').slice().reverse();
    document.getElementById('incomeList').innerHTML = income.length? income.map(i => `
    <div class="list-item">
      <div class="flex">
        <div class="avatar" style="background: rgb(16 185 129 / 0.1); color: var(--green);">$</div>
        <div>
          <div style="font-weight: 500; text-transform: capitalize;">${i.type}</div>
          <div style="font-size: 13px; color: var(--text-muted);">${new Date(i.date).toLocaleDateString()} • ${i.freq}</div>
        </div>
      </div>
      <div class="flex" style="gap: 8px;">
        <div style="font-weight: 600;" class="positive">+${fmt(i.amount)}</div>
        <button class="icon danger" style="width: 36px; height: 36px;" onclick="deleteIncome('${i.id}')">
          <svg width="16" height="16" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>
        </button>
      </div>
    </div>
  `).join('') : '<div class="empty"><svg fill="currentColor" viewBox="0 0 20 20"><path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0.114-.07.34-.433.582a2.305 2.305 0 01-.567.267z"/><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0.99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clip-rule="evenodd"/></svg><p>No income recorded<br>Add your salary to start tracking</p></div>';
}

function loadSuggestions() {
    const expenses = DB.get('expenses');
    const names = [...new Set(expenses.map(e => e.name))];
    document.getElementById('expSuggestions').innerHTML = names.map(n => `<option value="${n}">`).join('');
}

// === RECEIPT SCAN ===
async function scanReceipt() {
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        video.srcObject = stream;
        video.style.display = 'block';
        showToast('Point at receipt, capturing in 3s...');

        setTimeout(async () => {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            canvas.getContext('2d').drawImage(video, 0, 0);
            stream.getTracks().forEach(t => t.stop());
            video.style.display = 'none';
            canvas.style.display = 'block';

            showToast('Scanning receipt...');
            const { data: { text } } = await Tesseract.recognize(canvas, 'eng');
            const total = text.match(/total[:\s]*\$?(\d+\.?\d*)/i) || text.match(/amount[:\s]*\$?(\d+\.?\d*)/i);

            if(total) {
                document.getElementById('expAmount').value = total[1];
                showToast(`Found total: ${fmt(total[1])}`);
            } else {
                showToast('Could not find total. Enter manually.');
            }
            canvas.style.display = 'none';
        }, 3000);
    } catch(err) {
        showToast('Camera access denied');
        video.style.display = 'none';
    }
}

// === VOICE INPUT ===
function startVoice() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if(!SpeechRecognition) return showToast('Voice not supported on this device');

    const rec = new SpeechRecognition();
    rec.lang = 'en-US';
    showToast('Listening...');

    rec.onresult = (e) => {
        const text = e.results[0][0].transcript;
        const match = text.match(/(\d+\.?\d*)\s*(dollars?|bucks?)?\s*(?:for|on)?\s*(.+)/i);
        if(match) {
            document.getElementById('expAmount').value = match[1];
            document.getElementById('expName').value = match[3].trim();
            showToast(`Heard: ${fmt(match[1])} for ${match[3]}`);
        } else {
            showToast(`Heard: "${text}" - please check`);
        }
    };
    rec.onerror = () => showToast('Voice recognition failed');
    rec.start();
}

// === INIT ===
function init() {
    // Set theme from localStorage
    if(localStorage.getItem('theme') === 'dark' || (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
    }

    // Set default dates
    document.getElementById('goalDate').value = new Date(Date.now() + 365*24*60*60*1000).toISOString().split('T')[0];

    renderDashboard();
}

// Run on load
init();

