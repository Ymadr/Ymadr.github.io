'use strict';

/* ═══════════════════════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════════════════════ */
const CATEGORIES = [
  { name: 'Food & Dining', icon: '🍔', color: '#F59E0B' },
  { name: 'Transport', icon: '🚗', color: '#3B82F6' },
  { name: 'Shopping', icon: '🛍️', color: '#EC4899' },
  { name: 'Housing', icon: '🏠', color: '#8B5CF6' },
  { name: 'Health', icon: '💊', color: '#10B981' },
  { name: 'Entertainment', icon: '🎮', color: '#F97316' },
  { name: 'Education', icon: '📚', color: '#06B6D4' },
  { name: 'Utilities', icon: '💡', color: '#84CC16' },
  { name: 'Travel', icon: '✈️', color: '#6366F1' },
  { name: 'Other', icon: '💰', color: '#9CA3AF' },
];

const CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'PHP', symbol: '₱', name: 'Philippine Peso' },
  { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
  { code: 'KRW', symbol: '₩', name: 'Korean Won' },
  { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah' },
];
const LOCALES = {
  PHP: 'en-PH', USD: 'en-US', EUR: 'de-DE', GBP: 'en-GB', JPY: 'ja-JP',
  MYR: 'ms-MY', SGD: 'en-SG', AUD: 'en-AU', CAD: 'en-CA', INR: 'en-IN',
  CNY: 'zh-CN', KRW: 'ko-KR', IDR: 'id-ID'
};

/* ═══════════════════════════════════════════════════════════════════════════
   APP
═══════════════════════════════════════════════════════════════════════════ */
const App = {
  _screen: 'dashboard',
  _period: '30',       // analytics period (days)
  _selCat: null,       // selected category in Add screen
  expenses: [],
  budgets: {},
  settings: {},
  accounts: [],
  debts: [],
  investments: [],
  _wealthTab: 'acc',
  deferredPrompt: null,
  installed: false,
  _swWaiting: null,      // waiting service worker (update ready)
  _updateAvailable: false,

  /* ── Bootstrap ──────────────────────────────────────────────────────── */
  init() {
    this.reload();
    if (this.settings.autoBackup && DB.createBackup) {
      DB.createBackup();
    }
    // Migrate old/default USD settings to PHP for Philippine deployment
    if (!this.settings.currency || this.settings.currency === 'USD' || this.settings.currencySymbol === '$') {
      const s = { ...this.settings, currency: 'PHP', currencySymbol: '₱' };
      DB.saveSettings(s);
      this.settings = s;
    }
    // Remove any previously-seeded demo entries
    if (DB.purgeDemo) DB.purgeDemo();

    // PWA install prompt handling
    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault();
      this.deferredPrompt = e;
      if (this._screen === 'settings') this.navigate('settings');
    });
    window.addEventListener('appinstalled', () => {
      this.deferredPrompt = null;
      this.installed = true;
      if (DB.defaultSeed) DB.defaultSeed();
      this.reload();
      this._toast('App installed ✅', 'success');
      if (this._screen === 'settings') this.navigate('settings');
    });
    this._renderShell();
    this.navigate('dashboard');

    // If a SW update was detected before App initialized, apply it now
    if (window.__swWaiting) this._swUpdateReady(window.__swWaiting);

    // Global delete delegation
    document.addEventListener('click', e => {
      const btn = e.target.closest('[data-del]');
      if (!btn) return;
      e.stopPropagation();
      if (confirm('Delete this expense?')) {
        DB.deleteExpense(btn.dataset.del);
        this.reload();
        this.navigate(this._screen);
      }
    });
  },

  reload() {
    this.expenses = DB.getExpenses();
    this.budgets = DB.getBudgets();
    this.settings = DB.getSettings();
    this.accounts = DB.getAccounts ? DB.getAccounts() : [];
    this.debts = DB.getDebts ? DB.getDebts() : [];
    this.investments = DB.getInvestments ? DB.getInvestments() : [];
  },

  /* ── Shell (tab bar + screen root) ─────────────────────────────────── */
  _renderShell() {
    const tabs = [
      { id: 'dashboard', icon: '⊞', label: 'Home' },
      { id: 'wealth', icon: '🏦', label: 'Wealth' },
      { id: 'add', icon: '+', label: 'Add', special: true },
      { id: 'budget', icon: '◎', label: 'Budget' },
      { id: 'analytics', icon: '◑', label: 'Trends' },
      { id: 'settings', icon: '⚙', label: 'Settings' },
    ];

    document.getElementById('app').innerHTML = `
      <div id="screen-root"></div>
      <nav class="tab-bar" role="tablist">
        ${tabs.map(t => `
          <button class="nav-item${t.special ? ' nav-add' : ''}"
                  data-screen="${t.id}"
                  role="tab"
                  aria-label="${t.label}"
                  onclick="App.navigate('${t.id}')">
            <span class="nav-icon">${t.icon}</span>
            <span class="nav-label">${t.label}</span>
          </button>`).join('')}
      </nav>`;
  },

  /* ── Navigation ─────────────────────────────────────────────────────── */
  navigate(screen) {
    this._screen = screen;
    document.querySelectorAll('.nav-item').forEach(b =>
      b.classList.toggle('active', b.dataset.screen === screen));

    const root = document.getElementById('screen-root');
    root.innerHTML = this['_screen_' + screen]();

    requestAnimationFrame(() => {
      root.querySelector('.screen')?.classList.add('screen-in');
      this['_setup_' + screen]?.();
    });
  },

  /* ── Helpers ────────────────────────────────────────────────────────── */
  fmt(n) {
    const code = this.settings.currency || 'PHP';
    const num = Math.abs(parseFloat(n) || 0);
    const locale = LOCALES[code] || 'en-PH';
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency', currency: code,
        minimumFractionDigits: 2, maximumFractionDigits: 2
      }).format(num);
    } catch (e) {
      const sym = this.settings.currencySymbol || '₱';
      return `${sym}${num.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
  },

  relDate(iso) {
    const diff = Math.floor((Date.now() - new Date(iso)) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    if (diff < 7) return `${diff}d ago`;
    return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
  },

  catInfo(name) {
    return CATEGORIES.find(c => c.name === name) || { name, icon: '💰', color: '#9CA3AF' };
  },

  greeting() {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning 👋' : h < 17 ? 'Good afternoon 👋' : 'Good evening 👋';
  },

  monthExpenses() {
    const n = new Date();
    return DB.getExpensesForMonth(n.getFullYear(), n.getMonth());
  },

  _expenseRow(e) {
    const info = this.catInfo(e.category);
    return `
      <div class="expense-item" id="exp-${e.id}">
        <div class="exp-icon" style="background:${info.color}22;color:${info.color}">${info.icon}</div>
        <div class="exp-body">
          <div class="exp-desc">${e.description || e.category}</div>
          <div class="exp-meta">
            <span class="exp-tag">${e.category}</span>
            <span class="exp-date">${this.relDate(e.date)}</span>
          </div>
        </div>
        <div class="exp-right">
          <div class="exp-amount">-${this.fmt(e.amount)}</div>
          <button class="del-btn" data-del="${e.id}" aria-label="Delete">✕</button>
        </div>
      </div>`;
  },

  /* ═══════════════════════════════════════════════════════════════════════
     DASHBOARD
  ═══════════════════════════════════════════════════════════════════════ */
  _screen_dashboard() {
    const me = this.monthExpenses();
    const total = me.reduce((s, e) => s + e.amount, 0);
    const income = this.settings.monthlyIncome || 0;
    const saved = income > 0 ? income - total : null;

    const catTotals = {};
    me.forEach(e => { catTotals[e.category] = (catTotals[e.category] || 0) + e.amount; });

    const topCats = Object.entries(catTotals).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const insight = AI.getInsights(this.expenses, this.budgets, income, this.accounts)[0];
    const recent = this.expenses.slice(0, 8);
    const now = new Date();
    const mName = now.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });

    const budgetUsed = income > 0 ? Math.min(total / income * 100, 100).toFixed(0) : null;

    return `
      <div class="screen">
        <!-- Header -->
        <div class="scr-header">
          <div>
            <div class="greeting">${this.greeting()}</div>
            <div class="subheading">${mName}</div>
          </div>
          <button class="avatar-btn" onclick="App.navigate('settings')" aria-label="Settings">
            <span>💳</span>
          </button>
        </div>

        <!-- Spending card -->
        <div class="spend-card">
          <div class="spend-left">
            <div class="spend-label">Total Spent</div>
            <div class="spend-amount">${this.fmt(total)}</div>
            ${income > 0 ? `<div class="spend-sub">of ${this.fmt(income)} budget</div>` : '<div class="spend-sub">Set income in Settings</div>'}
            ${income > 0 && budgetUsed !== null ? `
              <div class="budget-usage-bar">
                <div class="budget-usage-fill ${total > income ? 'over' : total / income > 0.8 ? 'warn' : ''}"
                     style="width:${budgetUsed}%"></div>
              </div>
              <div class="budget-usage-label">${budgetUsed}% of budget</div>
            ` : ''}
            ${saved !== null && saved > 0 ? `<div class="savings-badge">💰 Saving ${this.fmt(saved)}</div>` : ''}
          </div>
          <div class="donut-wrap">
            <canvas id="donut-chart"></canvas>
          </div>
        </div>

        <!-- Category legend -->
        ${topCats.length > 0 ? `
          <div class="legend-row">
            ${topCats.map(([cat, amt]) => {
      const info = this.catInfo(cat);
      return `<div class="legend-item">
                <div class="legend-dot" style="background:${info.color}"></div>
                <span>${info.icon}</span>
                <span class="legend-name">${cat.split(' ')[0]}</span>
                <span class="legend-amt">${this.fmt(amt)}</span>
              </div>`;
    }).join('')}
          </div>` : ''}

        <!-- AI Insight -->
        ${insight ? `
          <button class="insight-card insight-${insight.type}" onclick="App.navigate('budget')">
            <div class="insight-top">
              <span class="insight-icon">${insight.icon}</span>
              <div class="insight-body">
                <div class="insight-title">${insight.title}</div>
                <div class="insight-msg">${insight.message}</div>
              </div>
              <span class="insight-arrow">›</span>
            </div>
            <div class="insight-tip">${insight.tip}</div>
          </button>` : ''}

        <!-- Recent -->
        <div class="sec-header">
          <h2 class="sec-title">Recent Expenses</h2>
          <button class="see-all" onclick="App.navigate('analytics')">See all</button>
        </div>

        <div class="txn-list">
          ${recent.length === 0 ? `
            <div class="empty-state">
              <div class="empty-icon">📝</div>
              <div class="empty-title">No expenses yet</div>
              <div class="empty-sub">Tap + to log your first expense</div>
            </div>` :
        recent.map(e => this._expenseRow(e)).join('')}
        </div>

        <div class="bottom-pad"></div>
      </div>`;
  },

  _setup_dashboard() {
    const me = this.monthExpenses();
    const total = me.reduce((s, e) => s + e.amount, 0);
    const catT = {};
    me.forEach(e => { catT[e.category] = (catT[e.category] || 0) + e.amount; });

    const canvas = document.getElementById('donut-chart');
    if (!canvas) return;

    const segs = Object.entries(catT).map(([cat, v]) => ({
      value: v, color: this.catInfo(cat).color,
    }));

    Charts.drawDonut(canvas, segs, total, this.fmt(total), 'this month');
  },

  /* ═══════════════════════════════════════════════════════════════════════
     ADD EXPENSE
  ═══════════════════════════════════════════════════════════════════════ */
  _screen_add() {
    const today = new Date().toISOString().slice(0, 10);
    const sym = this.settings.currencySymbol || '$';

    return `
      <div class="screen">
        <div class="scr-header">
          <h1 class="page-title">Add Expense</h1>
        </div>

        <!-- Amount -->
        <div class="amount-section">
          <span class="amount-sym">${sym}</span>
          <input type="number" id="inp-amount" class="amount-input"
                 placeholder="0.00" step="0.01" min="0.01"
                 inputmode="decimal">
        </div>

        <!-- Description -->
        <div class="form-row">
          <label for="inp-desc" class="form-label">Description</label>
          <div class="input-wrap">
            <input type="text" id="inp-desc" class="form-input"
                   placeholder="e.g. Jollibee lunch"
                   autocomplete="off"
                   oninput="App._autoDetect(this.value)">
            <div id="ai-badge" class="ai-badge hidden">🤖 AI detected</div>
          </div>
        </div>

        <!-- Category -->
        <div class="form-row">
          <label class="form-label">Category</label>
          <div class="cat-grid" id="cat-grid">
            ${CATEGORIES.map(c => `
              <button class="cat-pill" data-cat="${c.name}"
                      style="--cc:${c.color}"
                      onclick="App._selectCat('${c.name}')">
                <span>${c.icon}</span>
                <span class="cat-pill-name">${c.name.split(' ')[0]}</span>
              </button>`).join('')}
          </div>
        </div>

        <!-- Account -->
        ${this.accounts && this.accounts.length > 0 ? `
        <div class="form-row">
          <label for="inp-account" class="form-label">Account <span class="opt">(optional)</span></label>
          <select id="inp-account" class="form-input">
            <option value="">None</option>
            ${this.accounts.map(a => `<option value="${a.id}">${a.name} (${this.fmt(a.balance)})</option>`).join('')}
          </select>
        </div>` : ''}

        <!-- Date -->
        <div class="form-row">
          <label for="inp-date" class="form-label">Date</label>
          <input type="date" id="inp-date" class="form-input" value="${today}">
        </div>

        <!-- Note -->
        <div class="form-row">
          <label for="inp-note" class="form-label">Note <span class="opt">(optional)</span></label>
          <textarea id="inp-note" class="form-input form-textarea"
                    placeholder="Add a note…"></textarea>
        </div>

        <button class="save-btn" onclick="App._saveExpense()">Save Expense</button>
        <div class="bottom-pad"></div>
      </div>`;
  },

  _setup_add() {
    this._selCat = null;
    setTimeout(() => document.getElementById('inp-amount')?.focus(), 100);
  },

  _autoDetect(text) {
    if (!text || text.length < 3) return;
    const cat = AI.detectCategory(text);
    if (cat && cat !== 'Other') {
      this._selectCat(cat, true);
    }
  },

  _selectCat(name, auto = false) {
    this._selCat = name;
    document.querySelectorAll('.cat-pill').forEach(b =>
      b.classList.toggle('selected', b.dataset.cat === name));
    if (auto) {
      document.getElementById('ai-badge')?.classList.remove('hidden');
    } else {
      document.getElementById('ai-badge')?.classList.add('hidden');
    }
  },

  _saveExpense() {
    const amount = parseFloat(document.getElementById('inp-amount')?.value);
    const desc = document.getElementById('inp-desc')?.value.trim();
    const date = document.getElementById('inp-date')?.value;
    const note = document.getElementById('inp-note')?.value.trim();
    const accId = document.getElementById('inp-account')?.value;
    const cat = this._selCat || AI.detectCategory(desc) || 'Other';

    if (!amount || amount <= 0) {
      this._toast('Enter a valid amount', 'error');
      document.getElementById('inp-amount')?.focus();
      return;
    }

    DB.addExpense({
      amount,
      description: desc,
      category: cat,
      accountId: accId || null,
      date: date ? new Date(date + 'T12:00:00').toISOString() : undefined,
      note,
    });
    this.reload();
    this._toast('Expense saved 🎉', 'success');
    if (navigator.vibrate) navigator.vibrate(40);
    setTimeout(() => this.navigate('dashboard'), 800);
  },

  /* ═══════════════════════════════════════════════════════════════════════
     BUDGET PLANNER
  ═══════════════════════════════════════════════════════════════════════ */
  _screen_budget() {
    const { expenses, accounts, budgets, settings } = this;
    const income = settings.monthlyIncome || 0;
    const me = this.monthExpenses();
    const sugg = AI.getBudgetSuggestions(income, expenses);
    const anomalies = AI.detectAnomalies(expenses);

    const catSpent = {};
    me.forEach(e => { catSpent[e.category] = (catSpent[e.category] || 0) + e.amount; });

    return `
      <div class="screen">
        <div class="scr-header">
          <h1 class="page-title">Budget Planner</h1>
          <div class="ai-chip">🤖 AI</div>
        </div>

        <!-- Income card -->
        <div class="income-card">
          <div class="income-label">Monthly Income</div>
          <div class="income-row">
            <span class="income-sym">${settings.currencySymbol || '$'}</span>
            <input type="number" id="inp-income" class="income-input"
                   value="${income || ''}"
                   placeholder="Enter your income"
                   inputmode="decimal"
                   onchange="App._updateIncome(this.value)">
          </div>
          ${income > 0 ? `
            <div class="rule-row">
              <div class="rule-chip needs">50% Needs<br><strong>${this.fmt(income * 0.5)}</strong></div>
              <div class="rule-chip wants">30% Wants<br><strong>${this.fmt(income * 0.3)}</strong></div>
              <div class="rule-chip save">20% Save<br><strong>${this.fmt(income * 0.2)}</strong></div>
            </div>` :
        '<p class="income-hint">💡 Set income for personalized AI suggestions</p>'}
        </div>

        <!-- Anomalies -->
        ${anomalies.length ? `
          <div class="anomaly-card">
            <div class="anomaly-title">🚨 Unusual Activity Detected</div>
            ${anomalies.map(a => `
              <div class="anomaly-row">
                ${this.catInfo(a.category).icon} <strong>${a.category}</strong>
                — ${this.fmt(a.total)} this week (avg ${this.fmt(a.avg)}/expense)
              </div>`).join('')}
          </div>` : ''}

        <!-- Forecast Insight -->
        ${AI.getCashflowForecastCard(income, expenses, accounts)}

        <!-- AI Suggest -->
        <button class="ai-btn" onclick="App._applyAI()">
          🤖 Apply AI Budget Suggestions
        </button>

        <!-- Category budgets -->
        <div class="sec-header">
          <h2 class="sec-title">Category Budgets</h2>
          <span class="sec-sub">Tap amount to edit</span>
        </div>

        <div class="bud-list">
          ${CATEGORIES.map(cat => {
          const spent = catSpent[cat.name] || 0;
          const budget = budgets[cat.name] || 0;
          const sg = sugg[cat.name] || 0;
          const pct = budget > 0 ? Math.min(spent / budget * 100, 100) : 0;
          const isOver = budget > 0 && spent > budget;
          const fillColor = isOver ? '#EF4444' : cat.color;

          return `
              <div class="bud-item">
                <div class="bud-header">
                  <div class="bud-cat">
                    <span class="bud-icon" style="background:${cat.color}22">${cat.icon}</span>
                    <span class="bud-name">${cat.name}</span>
                  </div>
                  <div class="bud-amounts">
                    <span class="bud-spent" style="color:${isOver ? '#EF4444' : '#F9FAFB'}">
                      ${this.fmt(spent)}
                    </span>
                    <span class="bud-sep">/</span>
                    <input type="number" class="bud-input"
                           data-cat="${cat.name}"
                           value="${budget > 0 ? budget : ''}"
                           placeholder="${sg > 0 ? sg.toFixed(0) : 'Set'}"
                           onchange="App._setBudget('${cat.name}', this.value)">
                  </div>
                </div>
                ${budget > 0 ? `
                  <div class="bud-track">
                    <div class="bud-fill ${isOver ? 'over' : pct > 80 ? 'warn' : ''}"
                         style="width:${pct}%;background:${fillColor}"></div>
                  </div>
                  <div class="bud-footer">
                    <span>${pct.toFixed(0)}% used</span>
                    <span>${isOver
                ? '🚨 Over by ' + this.fmt(spent - budget)
                : '✅ ' + this.fmt(budget - spent) + ' left'}</span>
                  </div>` :
              `<div class="bud-no">${sg > 0 ? `AI suggests: ${this.fmt(sg)}` : 'No budget set'}</div>`}
              </div>`;
        }).join('')}
        </div>
        <div class="bottom-pad"></div>
      </div>`;
  },

  _setup_budget() { },

  _updateIncome(val) {
    const income = parseFloat(val) || 0;
    const settings = { ...this.settings, monthlyIncome: income };
    DB.saveSettings(settings);
    this.settings = settings;
    this._toast('Income saved', 'success');
    setTimeout(() => this.navigate('budget'), 200);
  },

  _setBudget(cat, val) {
    DB.setBudget(cat, parseFloat(val) || 0);
    this.budgets = DB.getBudgets();
  },

  _applyAI() {
    if (!(this.settings.monthlyIncome > 0)) {
      this._toast('Set your monthly income first', 'warning');
      document.getElementById('inp-income')?.focus();
      return;
    }
    const { _savings, ...budgets } = AI.getBudgetSuggestions(
      this.settings.monthlyIncome, this.expenses);
    DB.setBudgets(budgets);
    this.budgets = budgets;
    this._toast('AI budgets applied! 🤖', 'success');
    setTimeout(() => this.navigate('budget'), 500);
  },

  /* ═══════════════════════════════════════════════════════════════════════
     ANALYTICS
  ═══════════════════════════════════════════════════════════════════════ */
  _screen_analytics() {
    const days = parseInt(this._period);
    const filtered = DB.getExpensesForLastDays(days);
    const total = filtered.reduce((s, e) => s + e.amount, 0);
    const avgDay = total / days;
    const breakdown = AI.getCategoryBreakdown(filtered);

    // Prev period comparison
    const now = Date.now();
    const prev = this.expenses.filter(e => {
      const t = now - new Date(e.date).getTime();
      return t >= days * 86400000 && t < days * 2 * 86400000;
    });
    const prevTotal = prev.reduce((s, e) => s + e.amount, 0);
    const change = prevTotal > 0 ? ((total - prevTotal) / prevTotal * 100) : null;

    return `
      <div class="screen">
        <div class="scr-header">
          <h1 class="page-title">Analytics</h1>
        </div>

        <!-- Period -->
        <div class="period-row">
          ${[['7', '7 Days'], ['30', '1 Month'], ['90', '3 Months'], ['365', '1 Year']].map(
      ([v, l]) => `<button class="period-btn${this._period === v ? ' active' : ''}"
                                onclick="App._setPeriod('${v}')">${l}</button>`
    ).join('')}
        </div>

        <!-- Stats -->
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-val">${this.fmt(total)}</div>
            <div class="stat-lbl">Total Spent</div>
          </div>
          <div class="stat-card">
            <div class="stat-val">${filtered.length}</div>
            <div class="stat-lbl">Transactions</div>
          </div>
          <div class="stat-card">
            <div class="stat-val">${this.fmt(avgDay)}</div>
            <div class="stat-lbl">Daily Avg</div>
          </div>
          <div class="stat-card ${change === null ? '' : change > 0 ? 'stat-warn' : 'stat-ok'}">
            <div class="stat-val">${change === null ? '—' : (change > 0 ? '+' : '') + change.toFixed(0) + '%'}</div>
            <div class="stat-lbl">vs Prior Period</div>
          </div>
        </div>

        <!-- Trend chart -->
        <div class="chart-card">
          <div class="chart-title">Spending Trend</div>
          <canvas id="line-chart" class="line-canvas"></canvas>
        </div>

        <!-- Category breakdown -->
        <div class="chart-card">
          <div class="chart-title">By Category</div>
          ${breakdown.length === 0 ? '<div class="chart-empty">No data for this period</div>' :
        breakdown.map(({ category, amount }) => {
          const info = this.catInfo(category);
          const pct = total > 0 ? (amount / total * 100) : 0;
          return `
                <div class="cat-row">
                  <span class="cat-sm">${info.icon}</span>
                  <div class="cat-info">
                    <div class="cat-row-header">
                      <span>${category}</span>
                      <span>${this.fmt(amount)}</span>
                    </div>
                    <div class="cat-track">
                      <div class="cat-bar" style="width:${pct}%;background:${info.color}"
                           data-pct="${pct}"></div>
                    </div>
                  </div>
                  <span class="cat-pct">${pct.toFixed(0)}%</span>
                </div>`;
        }).join('')}
        </div>

        <!-- All transactions -->
        <div class="sec-header">
          <h2 class="sec-title">All Transactions</h2>
          <span class="sec-sub">${filtered.length} items</span>
        </div>
        <div class="txn-list">
          ${filtered.length === 0 ? `
            <div class="empty-state">
              <div class="empty-icon">📊</div>
              <div class="empty-title">No transactions</div>
              <div class="empty-sub">Try a wider date range</div>
            </div>` :
        filtered.map(e => this._expenseRow(e)).join('')}
        </div>
        <div class="bottom-pad"></div>
      </div>`;
  },

  _setup_analytics() {
    const days = parseInt(this._period);
    const filtered = DB.getExpensesForLastDays(days);
    const trends = AI.getTrends(filtered, days);
    const canvas = document.getElementById('line-chart');

    if (canvas) {
      setTimeout(() => Charts.drawLine(canvas, trends.labels, trends.data), 80);
    }

    // Animate category bars
    setTimeout(() => {
      document.querySelectorAll('.cat-bar').forEach(bar => {
        const target = bar.dataset.pct + '%';
        bar.style.width = '0';
        requestAnimationFrame(() => {
          bar.style.transition = 'width 0.9s cubic-bezier(.4,0,.2,1)';
          bar.style.width = target;
        });
      });
    }, 100);
  },

  _setPeriod(p) {
    this._period = p;
    this.navigate('analytics');
  },

  /* ═══════════════════════════════════════════════════════════════════════
     WEALTH
  ═══════════════════════════════════════════════════════════════════════ */
  _screen_wealth() {
    const tabData = [
      { id: 'acc', label: 'Accounts' },
      { id: 'debt', label: 'Debts' },
      { id: 'inv', label: 'Investments' }
    ];

    let content = '';
    if (this._wealthTab === 'acc') content = this._wealth_accounts();
    else if (this._wealthTab === 'debt') content = this._wealth_debts();
    else if (this._wealthTab === 'inv') content = this._wealth_investments();

    return `
      <div class="screen">
        <div class="scr-header">
          <h1 class="page-title">Wealth</h1>
        </div>

        <div class="wealth-tabs">
          ${tabData.map(t => `
            <button class="wealth-tab${this._wealthTab === t.id ? ' active' : ''}" 
                    onclick="App._setWealthTab('${t.id}')">
              ${t.label}
            </button>
          `).join('')}
        </div>

        <div class="wealth-content">
          ${content}
        </div>

        <div class="bottom-pad"></div>
      </div>
    `;
  },

  _setup_wealth() {
    if (this._wealthTab === 'inv') {
      this._updateInvestmentPrices();
    }
  },

  _setWealthTab(tab) {
    this._wealthTab = tab;
    this.navigate('wealth');
  },

  _wealth_accounts() {
    const totalBalance = this.accounts.reduce((s, a) => s + a.balance, 0);
    return `
      <div class="wealth-card">
        <div class="wealth-card-title">Total Cash Balance</div>
        <div class="wealth-card-val">${this.fmt(totalBalance)}</div>
      </div>

      <div class="sec-header">
        <h2 class="sec-title">Your Accounts</h2>
      </div>
      
      <div class="list-cards">
        ${this.accounts.length === 0 ? '<div class="empty-state">No accounts added yet</div>' :
        this.accounts.map(a => `
          <div class="w-item">
            <div class="w-item-info">
              <div class="w-item-title">${a.name}</div>
              <div class="w-item-sub">${a.type}</div>
            </div>
            <div class="w-item-right">
              <div class="w-item-val" style="color: ${a.balance < 0 ? '#EF4444' : '#10B981'}">${this.fmt(a.balance)}</div>
              <button class="icon-btn del-btn" onclick="App._delAccount('${a.id}')">✕</button>
            </div>
          </div>
        `).join('')}
      </div>

      <div class="add-box">
        <h3 class="add-box-title">Add Account</h3>
        <input type="text" id="acc-name" class="form-input" placeholder="Bank Name (e.g. Chase)">
        <select id="acc-type" class="form-input">
          <option value="Bank">Bank</option>
          <option value="Cash">Cash</option>
          <option value="Credit Card">Credit Card</option>
        </select>
        <input type="number" id="acc-bal" class="form-input" placeholder="Current Balance" step="0.01">
        <button class="save-btn" onclick="App._saveAccount()">Add Account</button>
      </div>
    `;
  },

  _wealth_debts() {
    const owe = this.debts.filter(d => d.type === 'Owe' && d.status === 'Pending').reduce((s, d) => s + d.amount, 0);
    const owed = this.debts.filter(d => d.type === 'Owed' && d.status === 'Pending').reduce((s, d) => s + d.amount, 0);

    return `
      <div class="stats-grid" style="margin-bottom: 20px;">
        <div class="stat-card" style="border-left: 3px solid #EF4444;">
          <div class="stat-val" style="color: #EF4444">${this.fmt(owe)}</div>
          <div class="stat-lbl">You Owe</div>
        </div>
        <div class="stat-card" style="border-left: 3px solid #10B981;">
          <div class="stat-val" style="color: #10B981">${this.fmt(owed)}</div>
          <div class="stat-lbl">Owed to You</div>
        </div>
      </div>

      <div class="sec-header">
        <h2 class="sec-title">Pending Debts</h2>
      </div>
      
      <div class="list-cards">
        ${this.debts.filter(d => d.status === 'Pending').length === 0 ? '<div class="empty-state">No pending debts</div>' :
        this.debts.filter(d => d.status === 'Pending').map(d => `
          <div class="w-item">
            <div class="w-item-info">
              <div class="w-item-title">${d.person}</div>
              <div class="w-item-sub">${new Date(d.date).toLocaleDateString()}</div>
            </div>
            <div class="w-item-right">
              <div class="w-item-val" style="color: ${d.type === 'Owe' ? '#EF4444' : '#10B981'}">
                ${d.type === 'Owe' ? '-' : '+'}${this.fmt(d.amount)}
              </div>
              <button class="action-btn" onclick="App._settleDebt('${d.id}')">Settle</button>
              <button class="icon-btn del-btn" onclick="App._delDebt('${d.id}')">✕</button>
            </div>
          </div>
        `).join('')}
      </div>

      <div class="add-box">
        <h3 class="add-box-title">Add Debt</h3>
        <input type="text" id="debt-person" class="form-input" placeholder="Person's Name">
        <select id="debt-type" class="form-input">
          <option value="Owe">I Owe Them</option>
          <option value="Owed">They Owe Me</option>
        </select>
        <input type="number" id="debt-amount" class="form-input" placeholder="Amount" step="0.01">
        <button class="save-btn" onclick="App._saveDebt()">Add Debt</button>
      </div>
    `;
  },

  _wealth_investments() {
    const totalCost = this.investments.reduce((s, i) => s + (i.shares * i.avgCost), 0);
    // Rough estimate total value if we have live prices in dataset
    const totalVal = this.investments.reduce((s, i) => s + (i.shares * (i.currentPrice || i.avgCost)), 0);

    return `
      <div class="wealth-card">
        <div class="wealth-card-title">Estimated Portfolio Value</div>
        <div class="wealth-card-val">${this.fmt(totalVal)}</div>
        <div class="spend-sub">Cost Basis: ${this.fmt(totalCost)}</div>
      </div>

      <div class="sec-header">
        <h2 class="sec-title">Holdings</h2>
        <span class="sec-sub">Live Crypto prices via CoinGecko</span>
      </div>
      
      <div class="list-cards">
        ${this.investments.length === 0 ? '<div class="empty-state">No investments logged</div>' :
        this.investments.map(i => {
          const val = i.shares * (i.currentPrice || i.avgCost);
          const returnPct = ((val - (i.shares * i.avgCost)) / (i.shares * i.avgCost) * 100) || 0;
          return `
            <div class="w-item">
              <div class="w-item-info">
                <div class="w-item-title">${i.ticker}</div>
                <div class="w-item-sub">${i.shares} shares @ ${this.fmt(i.avgCost)}</div>
              </div>
              <div class="w-item-right">
                <div class="w-item-val">${this.fmt(val)}</div>
                <div class="w-item-pct" style="color: ${returnPct >= 0 ? '#10B981' : '#EF4444'}">
                  ${returnPct >= 0 ? '▲' : '▼'} ${Math.abs(returnPct).toFixed(2)}%
                </div>
                <button class="icon-btn del-btn" onclick="App._delInv('${i.id}')" style="margin-left: 8px;">✕</button>
              </div>
            </div>
            `;
        }).join('')}
      </div>

      <div class="add-box">
        <h3 class="add-box-title">Add Investment</h3>
        <div class="form-row">
          <input type="text" id="inv-ticker" class="form-input" placeholder="Ticker (e.g. BTC)">
        </div>
        <div class="form-row">
          <select id="inv-type" class="form-input">
            <option value="Crypto">Crypto</option>
            <option value="Stock">Stock</option>
          </select>
        </div>
        <div class="form-row" style="display:flex;gap:10px">
          <input type="number" id="inv-shares" class="form-input" placeholder="Amount/Shares" step="0.0001">
          <input type="number" id="inv-cost" class="form-input" placeholder="Avg Cost/Share" step="0.01">
        </div>
        <button class="save-btn" onclick="App._saveInvestment()">Add Investment</button>
      </div>
    `;
  },

  async _updateInvestmentPrices() {
    const cryptos = this.investments.filter(i => i.type === 'Crypto');
    if (cryptos.length === 0) return;

    // CoinGecko mapping needs actual coin ids. We'll do a simple mapping for popular ones.
    const map = { 'BTC': 'bitcoin', 'ETH': 'ethereum', 'SOL': 'solana', 'DOGE': 'dogecoin' };
    const ids = cryptos.map(c => map[c.ticker] || c.ticker.toLowerCase()).join(',');

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`, { signal: controller.signal });
      clearTimeout(timeoutId);
      const data = await res.json();

      let changed = false;
      this.investments.forEach(i => {
        const id = map[i.ticker] || i.ticker.toLowerCase();
        if (data[id] && data[id].usd) {
          // Simplistic assuming USD output, converting roughly to local settings if needed
          let p = data[id].usd;
          if (this.settings.currency === 'PHP') p *= 56; // Mock conversion
          i.currentPrice = p;
          changed = true;
        }
      });
      if (changed) {
        document.querySelector('.wealth-content').innerHTML = this._wealth_investments();
      }
    } catch (e) {
      console.log('Offline or API failed, using cached prices');
    }
  },

  _saveAccount() {
    const name = document.getElementById('acc-name')?.value;
    const type = document.getElementById('acc-type')?.value;
    const bal = parseFloat(document.getElementById('acc-bal')?.value) || 0;
    if (!name) return this._toast('Enter account name', 'error');
    DB.addAccount({ name, type, balance: bal });
    this.reload();
    this.navigate('wealth');
    this._toast('Account Added', 'success');
  },

  _delAccount(id) {
    if (!confirm('Remove account?')) return;
    DB.deleteAccount(id);
    this.reload();
    this.navigate('wealth');
  },

  _saveDebt() {
    const person = document.getElementById('debt-person')?.value;
    const type = document.getElementById('debt-type')?.value;
    const amount = parseFloat(document.getElementById('debt-amount')?.value);
    if (!person || !amount) return this._toast('Missing fields', 'error');
    DB.addDebt({ person, type, amount });
    this.reload();
    this.navigate('wealth');
    this._toast('Debt Added', 'success');
  },

  _settleDebt(id) {
    DB.settleDebt(id);
    this.reload();
    this.navigate('wealth');
    this._toast('Debt Settled!', 'success');
  },

  _delDebt(id) {
    if (!confirm('Remove debt?')) return;
    DB.deleteDebt(id);
    this.reload();
    this.navigate('wealth');
  },

  _saveInvestment() {
    const ticker = document.getElementById('inv-ticker')?.value.toUpperCase();
    const type = document.getElementById('inv-type')?.value;
    const shares = parseFloat(document.getElementById('inv-shares')?.value);
    const avgCost = parseFloat(document.getElementById('inv-cost')?.value);
    if (!ticker || !shares) return this._toast('Enter ticker and shares', 'error');
    DB.addInvestment({ ticker, type, shares, avgCost });
    this.reload();
    this.navigate('wealth');
    this._toast('Investment Added', 'success');
  },

  _delInv(id) {
    if (!confirm('Remove investment?')) return;
    DB.deleteInvestment(id);
    this.reload();
    this.navigate('wealth');
  },


  /* ═══════════════════════════════════════════════════════════════════════
     SETTINGS
  ═══════════════════════════════════════════════════════════════════════ */
  _screen_settings() {
    const { settings, expenses } = this;
    const totalSpent = expenses.reduce((s, e) => s + e.amount, 0);

    // Install button states
    const isInstalled = this.installed || window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    const canInstall = this.deferredPrompt && !isInstalled;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    return `
      <div class="screen">
        <div class="scr-header">
          <h1 class="page-title">Settings</h1>
        </div>

        <!-- Update banner -->
        ${this._updateAvailable ? `
          <div class="update-banner" onclick="App._applyUpdate()">
            <span>🔄 Update available — tap to install</span>
            <span class="sg-arrow">›</span>
          </div>` : ''}

        <!-- Profile -->
        <div class="setting-group">
          <div class="sg-title">Profile</div>

          <div class="sg-row">
            <div class="sg-row-label">Currency</div>
            <select class="sg-select" onchange="App._setCurrency(this.value)">
              ${CURRENCIES.map(c => `
                <option value="${c.code}" ${settings.currency === c.code ? 'selected' : ''}>
                  ${c.symbol} ${c.code} — ${c.name}
                </option>`).join('')}
            </select>
          </div>

          <div class="sg-row">
            <div class="sg-row-label">Monthly Income</div>
            <div class="sg-input-row">
              <span>${settings.currencySymbol || '$'}</span>
              <input type="number" class="sg-input"
                     value="${settings.monthlyIncome || ''}"
                     placeholder="0.00"
                     inputmode="decimal"
                     onchange="App._saveField('monthlyIncome', parseFloat(this.value)||0)">
            </div>
          </div>
        </div>

        <!-- AI -->
        <div class="setting-group">
          <div class="sg-title">AI Features <span class="offline-badge">100% Offline</span></div>
          ${[
        ['Auto Category Detection', 'AI tags expenses from description text'],
        ['Budget Suggestions', '50/30/20 rule personalized to your patterns'],
        ['Spending Insights', 'AI-powered monthly financial insights'],
        ['Anomaly Detection', 'Alerts when spending spikes unexpectedly'],
      ].map(([title, sub]) => `
            <div class="sg-row">
              <div>
                <div class="sg-row-title">${title}</div>
                <div class="sg-row-sub">${sub}</div>
              </div>
              <div class="toggle-on" role="switch" aria-checked="true"></div>
            </div>`).join('')}
        </div>

        <!-- Stats -->
        <div class="setting-group stats-group">
          <div class="sg-title">Your Stats</div>
          <div class="stats-ov">
            <div class="stats-ov-item">
              <div class="stats-ov-val">${expenses.length}</div>
              <div class="stats-ov-lbl">Tracked</div>
            </div>
            <div class="stats-ov-div"></div>
            <div class="stats-ov-item">
              <div class="stats-ov-val">${this.fmt(totalSpent)}</div>
              <div class="stats-ov-lbl">All Time</div>
            </div>
          </div>
        </div>

        <!-- App -->
        <div class="setting-group">
          <div class="sg-title">App</div>

          <!-- Install button — always visible with contextual state -->
          ${isInstalled ? `
          <div class="sg-row">
            <div>
              <div class="sg-row-title">Install App</div>
              <div class="sg-row-sub">Already installed on your device ✅</div>
            </div>
            <span class="sg-val">Installed</span>
          </div>` : canInstall ? `
          <div class="sg-row sg-clickable sg-install" onclick="App._promptInstall()" id="install-row">
            <div>
              <div class="sg-row-title">📲 Install App</div>
              <div class="sg-row-sub">Add to home screen for offline use</div>
            </div>
            <span class="sg-arrow">›</span>
          </div>` : isIOS ? `
          <div class="sg-row">
            <div>
              <div class="sg-row-title">📲 Install App (iOS)</div>
              <div class="sg-row-sub">Tap Share then "Add to Home Screen" ➕</div>
            </div>
          </div>` : `
          <div class="sg-row">
            <div>
              <div class="sg-row-title">📲 Install App</div>
              <div class="sg-row-sub">Open browser menu (⋮) and tap "Install app"</div>
            </div>
          </div>`}

          ${this._updateAvailable ? `
          <div class="sg-row sg-clickable sg-install" onclick="App._applyUpdate()">
            <div>
              <div class="sg-row-title">🔄 Update Available</div>
              <div class="sg-row-sub">Tap to refresh — your data will not be affected</div>
            </div>
            <span class="sg-arrow">›</span>
          </div>` : ''}
        </div>

        <!-- Data -->
        <div class="setting-group">
          <div class="sg-title">Data</div>
          
          <div class="sg-row">
            <div>
              <div class="sg-row-title">Auto Backup</div>
              <div class="sg-row-sub">Saves entire database automatically</div>
            </div>
            <div class="toggle-${settings.autoBackup ? 'on' : 'off'}" 
                 role="switch" aria-checked="${settings.autoBackup ? 'true' : 'false'}"
                 onclick="App._toggleAutoBackup()"></div>
          </div>
          
          <div class="sg-row sg-clickable" onclick="App._restoreBackup()">
            <span>📥 Restore from Auto Backup</span>
            <span class="sg-arrow">›</span>
          </div>

          <div class="sg-row sg-clickable" onclick="App._exportData('csv')">
            <span>📤 Export to CSV</span>
            <span class="sg-arrow">›</span>
          </div>
          <div class="sg-row sg-clickable" onclick="App._exportData('json')">
            <span>📤 Export to JSON</span>
            <span class="sg-arrow">›</span>
          </div>
          <div class="sg-row sg-clickable sg-danger" onclick="App._clearData()">
            <span>🗑️ Clear All Data</span>
            <span class="sg-arrow">›</span>
          </div>
        </div>

        <!-- About -->
        <div class="setting-group">
          <div class="sg-title">About</div>
          <div class="sg-row"><span>Version</span><span class="sg-val">1.0.5</span></div>
          <div class="sg-row"><span>AI Engine</span><span class="sg-val">🤖 Local (Offline)</span></div>
          <div class="sg-row"><span>Storage</span><span class="sg-val">📱 On-Device Only</span></div>
          <div class="sg-row"><span>Network Required</span><span class="sg-val">❌ Never</span></div>
        </div>

        <div class="bottom-pad"></div>
      </div>`;
  },

  _setup_settings() { },

  // Called by index.html when a new SW is waiting to take over
  _swUpdateReady(sw) {
    this._swWaiting = sw;
    this._updateAvailable = true;
    // Show a persistent update banner
    this._showUpdateBanner();
    // Refresh settings if open so the button appears immediately
    if (this._screen === 'settings') this.navigate('settings');
  },

  _showUpdateBanner() {
    if (document.getElementById('update-banner')) return;
    const el = document.createElement('div');
    el.id = 'update-banner';
    el.className = 'update-banner-fixed';
    el.innerHTML = `
      <span>🔄 Update available</span>
      <button onclick="App._applyUpdate()">Update now</button>
      <button onclick="this.parentElement.remove()" style="background:none;color:rgba(255,255,255,0.5);padding:0 4px">✕</button>
    `;
    document.body.appendChild(el);
  },

  // Tell the waiting SW to skip waiting, which triggers controllerchange → page reload
  _applyUpdate() {
    if (this._swWaiting) {
      this._swWaiting.postMessage({ type: 'SKIP_WAITING' });
    } else {
      window.location.reload();
    }
  },

  _setCurrency(code) {
    const cur = CURRENCIES.find(c => c.code === code);
    if (!cur) return;
    const s = { ...this.settings, currency: code, currencySymbol: cur.symbol };
    DB.saveSettings(s);
    this.settings = s;
    this._toast(`Currency → ${cur.symbol} ${code}`, 'success');
  },

  _saveField(field, val) {
    const s = { ...this.settings, [field]: val };
    DB.saveSettings(s);
    this.settings = s;
    this._toast('Saved', 'success');
  },

  _loadDemo() {
    this._toast('Demo data loading removed', 'warning');
  },

  _promptInstall() {
    if (!this.deferredPrompt) { this._toast('Install not available', 'warning'); return; }
    this.deferredPrompt.prompt();
    this.deferredPrompt.userChoice.then(choice => {
      if (choice.outcome === 'accepted') {
        this._toast('Thanks for installing 🎉', 'success');
      } else {
        this._toast('Install dismissed', 'info');
      }
      this.deferredPrompt = null;
      if (this._screen === 'settings') this.navigate('settings');
    }).catch(() => { this.deferredPrompt = null; });
  },

  _toggleAutoBackup() {
    const val = !this.settings.autoBackup;
    this._saveField('autoBackup', val);
    if (val && DB.createBackup) DB.createBackup();
    this.navigate('settings');
  },

  _restoreBackup() {
    if (!confirm('Restore from the last auto-backup? This will overwrite current data.')) return;
    if (DB.restoreBackup && DB.restoreBackup()) {
      this._toast('Backup restored!', 'success');
      this.reload();
      this.navigate('settings');
    } else {
      this._toast('No backup found or it is invalid', 'error');
    }
  },

  _exportData(format) {
    if (!this.expenses.length && !this.accounts.length) { this._toast('No data to export', 'warning'); return; }

    if (format === 'json') {
      const dump = {
        expenses: this.expenses,
        accounts: this.accounts,
        debts: this.debts,
        investments: this.investments,
        budgets: this.budgets
      };
      const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement('a'), {
        href: url, download: `spendai_export_${new Date().toISOString().slice(0, 10)}.json`,
      });
      a.click();
      URL.revokeObjectURL(url);
      this._toast('JSON Exported! 📤', 'success');
      return;
    }

    const rows = [
      ['Date', 'Description', 'Category', 'Amount', 'Note'],
      ...this.expenses.map(e => [
        new Date(e.date).toLocaleDateString('en-PH'),
        `"${e.description}"`,
        e.category,
        e.amount.toFixed(2),
        `"${e.note}"`,
      ]),
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), {
      href: url, download: `expenses_${new Date().toISOString().slice(0, 10)}.csv`,
    });
    a.click();
    URL.revokeObjectURL(url);
    this._toast('Exported! 📤', 'success');
  },

  _clearData() {
    if (!confirm('⚠️ Delete ALL expense data? This cannot be undone.')) return;
    ['spendai_exp', 'spendai_bud', 'spendai_acc', 'spendai_debt', 'spendai_inv'].forEach(k => localStorage.removeItem(k));
    this.reload();
    this.navigate('dashboard');
    this._toast('Data cleared', 'success');
  },

  /* ── SW Update Banner ───────────────────────────────────────────────── */
  // Called by index.html when a new service worker is waiting to activate.
  // Shows a subtle banner — user data in localStorage is NEVER touched.
  _swUpdateReady(sw) {
    this._swWaiting = sw;
    this._updateAvailable = true;

    // Remove any existing banner first
    document.getElementById('update-banner')?.remove();

    const banner = document.createElement('div');
    banner.id = 'update-banner';
    banner.innerHTML = `
      <span>🚀 Update available</span>
      <button id="update-apply-btn" onclick="App._applyUpdate()">Reload</button>
      <button id="update-dismiss-btn" onclick="document.getElementById('update-banner')?.remove()" aria-label="Dismiss">✕</button>
    `;
    document.body.appendChild(banner);

    // Slide in
    requestAnimationFrame(() => banner.classList.add('update-banner-show'));
  },

  // Sends SKIP_WAITING to the new SW; the controllerchange listener in
  // index.html will then call window.location.reload() automatically.
  _applyUpdate() {
    if (!this._swWaiting) { window.location.reload(); return; }
    this._swWaiting.postMessage({ type: 'SKIP_WAITING' });
  },

  /* ── Toast ─────────────────────────────────────────────────────────── */
  _toast(msg, type = 'info') {
    document.getElementById('toast')?.remove();
    const el = document.createElement('div');
    el.id = 'toast';
    el.className = `toast toast-${type}`;
    el.textContent = msg;
    document.body.appendChild(el);
    requestAnimationFrame(() => {
      el.classList.add('show');
      setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 2600);
    });
  },
};

document.addEventListener('DOMContentLoaded', () => App.init());
