'use strict';

const DB = (() => {
  const K = { 
    EXP: 'spendai_exp', 
    BUD: 'spendai_bud', 
    SET: 'spendai_set',
    ACC: 'spendai_acc',
    DEBT: 'spendai_debt',
    INV: 'spendai_inv'
  };

  const load = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  };
  const save = (key, data) => localStorage.setItem(key, JSON.stringify(data));
  const uid  = () => `e${Date.now()}${Math.random().toString(36).slice(2,6)}`;
  const ago  = n => { const d = new Date(); d.setDate(d.getDate()-n); return d.toISOString(); };

  const api = {
    // ── Expenses ────────────────────────────────────────────────
    getExpenses: () => load(K.EXP, []),

    addExpense(data) {
      const list = api.getExpenses();
      const item = {
        id: uid(),
        accountId:   data.accountId || null,
        amount:      Math.abs(parseFloat(data.amount) || 0),
        category:    data.category  || 'Other',
        description: (data.description || '').trim(),
        date:        data.date || new Date().toISOString(),
        note:        (data.note || '').trim(),
        createdAt:   new Date().toISOString(),
      };
      list.unshift(item);
      save(K.EXP, list);
      
      if (item.accountId) {
        api.updateAccountBalance(item.accountId, -item.amount);
      }
      
      return item;
    },

    deleteExpense(id) {
      save(K.EXP, api.getExpenses().filter(e => e.id !== id));
    },

    getExpensesForMonth(year, month) {
      return api.getExpenses().filter(e => {
        const d = new Date(e.date);
        return d.getFullYear() === year && d.getMonth() === month;
      });
    },

    getExpensesForLastDays(n) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - n);
      cutoff.setHours(0, 0, 0, 0);
      return api.getExpenses().filter(e => new Date(e.date) >= cutoff);
    },

    // ── Budgets ─────────────────────────────────────────────────
    getBudgets:  () => load(K.BUD, {}),
    setBudgets:  b  => save(K.BUD, b),

    setBudget(category, amount) {
      const b   = api.getBudgets();
      const amt = parseFloat(amount);
      if (amt > 0) b[category] = amt; else delete b[category];
      save(K.BUD, b);
    },

    // ── Accounts ────────────────────────────────────────────────
    getAccounts: () => load(K.ACC, []),
    
    addAccount(data) {
      const list = api.getAccounts();
      const item = {
        id: uid(),
        name: (data.name || 'Account').trim(),
        type: data.type || 'Cash', // Cash, Bank, Credit Card
        balance: parseFloat(data.balance) || 0,
        createdAt: new Date().toISOString()
      };
      // Credit card balances are generally negative or represented as debt, but we'll store as numbers
      list.push(item);
      save(K.ACC, list);
      return item;
    },

    updateAccountBalance(id, amountDelta) {
      const list = api.getAccounts();
      const acc = list.find(a => a.id === id);
      if (acc) {
        acc.balance += amountDelta;
        save(K.ACC, list);
      }
    },
    
    deleteAccount(id) {
      save(K.ACC, api.getAccounts().filter(a => a.id !== id));
    },

    // ── Debts ───────────────────────────────────────────────────
    getDebts: () => load(K.DEBT, []),
    
    addDebt(data) {
      const list = api.getDebts();
      const item = {
        id: uid(),
        person: (data.person || 'Someone').trim(),
        type: data.type || 'Owe', // 'Owe', 'Owed'
        amount: Math.abs(parseFloat(data.amount) || 0),
        date: data.date || new Date().toISOString(),
        status: 'Pending', // Pending, Settled
        createdAt: new Date().toISOString()
      };
      list.push(item);
      save(K.DEBT, list);
      return item;
    },

    settleDebt(id) {
      const list = api.getDebts();
      const debt = list.find(d => d.id === id);
      if (debt && debt.status !== 'Settled') {
        debt.status = 'Settled';
        debt.settledAt = new Date().toISOString();
        save(K.DEBT, list);
      }
    },

    deleteDebt(id) {
      save(K.DEBT, api.getDebts().filter(d => d.id !== id));
    },

    // ── Investments ─────────────────────────────────────────────
    getInvestments: () => load(K.INV, []),
    
    addInvestment(data) {
      const list = api.getInvestments();
      const item = {
        id: uid(),
        ticker: (data.ticker || '').trim().toUpperCase(),
        type: data.type || 'Crypto', // Crypto, Stock
        shares: parseFloat(data.shares) || 0,
        avgCost: parseFloat(data.avgCost) || 0,
        createdAt: new Date().toISOString()
      };
      list.push(item);
      save(K.INV, list);
      return item;
    },
    
    deleteInvestment(id) {
      save(K.INV, api.getInvestments().filter(i => i.id !== id));
    },

    // ── Auto Backup ─────────────────────────────────────────────
    createBackup() {
      const s = api.getSettings();
      if (!s.autoBackup) return; // Only backup if setting is enabled
      const dump = {
        exp: load(K.EXP, []),
        bud: load(K.BUD, {}),
        set: load(K.SET, {}),
        acc: load(K.ACC, []),
        debt: load(K.DEBT, []),
        inv: load(K.INV, []),
        timestamp: new Date().toISOString()
      };
      localStorage.setItem('spendai_backup', JSON.stringify(dump));
    },

    restoreBackup() {
      try {
        const dump = JSON.parse(localStorage.getItem('spendai_backup'));
        if (!dump) return false;
        if (dump.exp) save(K.EXP, dump.exp);
        if (dump.bud) save(K.BUD, dump.bud);
        if (dump.set) save(K.SET, dump.set);
        if (dump.acc) save(K.ACC, dump.acc);
        if (dump.debt) save(K.DEBT, dump.debt);
        if (dump.inv) save(K.INV, dump.inv);
        return true;
      } catch (e) {
        return false;
      }
    },

    // ── Settings ────────────────────────────────────────────────
    getSettings() {
      return {
        currency: 'PHP', currencySymbol: '₱',
        demoSeed: false,
        monthlyIncome: 0, theme: 'dark',
        ...load(K.SET, {}),
      };
    },
    saveSettings: s => save(K.SET, s),

    // Remove previously-seeded demo entries (safe remover)
    purgeDemo() {
      const demoItems = [
        [12.50,  'Food & Dining',   "Jollibee Lunch",         0],
        [45.00,  'Transport',       'Grab to Airport',          1],
        [89.99,  'Shopping',        'Shopee Purchase',          2],
        [8.90,   'Food & Dining',   'Coffee Shop',              2],
        [1200,   'Housing',         'Monthly Rent',             3],
        [55.00,  'Health',          'Pharmacy Medicines',       4],
        [15.99,  'Entertainment',   'Netflix Subscription',     5],
        [34.50,  'Food & Dining',   'Dinner Restaurant',        6],
        [22.00,  'Utilities',       'Electric Bill',            8],
        [67.80,  'Shopping',        'Lazada Clothes',          10],
        [9.50,   'Food & Dining',   'Mang Inasal Lunch',       12],
        [30.00,  'Transport',       'Monthly Bus Pass',        14],
        [120.00, 'Health',          'Doctor Consultation',     15],
        [19.99,  'Entertainment',   'Spotify Premium',         20],
        [250.00, 'Shopping',        'New Sneakers',            22],
        [18.50,  'Food & Dining',   'Sushi Restaurant',        25],
        [45.00,  'Utilities',       'Internet Bill',           28],
        [75.00,  'Food & Dining',   'Weekly Groceries',        30],
        [20.00,  'Entertainment',   'Movie Tickets',           32],
        [50.00,  'Education',       'Online Course',           35],
      ];

      const keys = new Set(demoItems.map(([amount, category, description, days]) =>
        `${parseFloat(amount)}|${category}|${description}|${ago(days).slice(0,10)}`
      ));

      const orig = api.getExpenses();
      const filtered = orig.filter(e => {
        const key = `${parseFloat(e.amount)}|${e.category}|${(e.description||'').trim()}|${new Date(e.date).toISOString().slice(0,10)}`;
        return !keys.has(key);
      });

      if (filtered.length !== orig.length) save(K.EXP, filtered);
    },
    // Add a small set of generic starter entries for first-run installs
    defaultSeed() {
      if (api.getExpenses().length > 0) return;
      const starter = [
        { amount: 12.5,  category: 'Food & Dining', description: 'Lunch', days: 2 },
        { amount: 250.0, category: 'Shopping',       description: 'New Shoes', days: 7 },
        { amount: 1200,  category: 'Housing',         description: 'Rent', days: 15 },
        { amount: 45.0,  category: 'Transport',       description: 'Taxi', days: 3 },
      ];
      starter.forEach(s => api.addExpense({ amount: s.amount, category: s.category, description: s.description, date: ago(s.days) }));
    },
  };

  return api;
})();
