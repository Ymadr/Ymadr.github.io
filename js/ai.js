'use strict';

const AI = (() => {
  /* ─── Keyword → category mapping ─────────────────────────────────────── */
  const KEYWORDS = {
    'Food & Dining':  ['mcdonald','kfc','burger','pizza','restaurant','cafe','coffee',
                       'starbucks','food','eat','lunch','dinner','breakfast','sushi',
                       'noodle','rice','bakery','groceries','supermarket','market',
                       'delivery','snack','drinks','bar','pub','bistro','eatery',
                       'buffet','jollibee','subway','wendy','taco','dim sum','hawker'],
    'Transport':      ['grab','uber','taxi','bus','mrt','lrt','train','fuel','petrol',
                       'gas','parking','toll','car','bike','motorcycle','fare','transit',
                       'lyft','commute','ferry','airline','jeepney','tricycle','angkas'],
    'Shopping':       ['mall','shop','store','clothes','fashion','shoes','amazon','lazada',
                       'shopee','online','purchase','accessories','gadget','electronics',
                       'apparel','boutique','zara','h&m','uniqlo','ikea'],
    'Housing':        ['rent','house','apartment','condo','mortgage','water','electricity',
                       'maintenance','repair','home','lease','landlord','hoa','property'],
    'Health':         ['pharmacy','medicine','doctor','hospital','clinic','dental','gym',
                       'fitness','health','medical','prescription','vitamin','supplement',
                       'check-up','therapy','optician','lab test'],
    'Entertainment':  ['netflix','spotify','games','cinema','movie','subscription',
                       'youtube','concert','event','hobby','sport','disney','hbo',
                       'gaming','steam','playstation','xbox','karaoke','bowling'],
    'Education':      ['school','tuition','course','book','library','study','university',
                       'college','training','workshop','seminar','udemy','coursera'],
    'Utilities':      ['electric','water','bill','phone','mobile','internet','cable',
                       'broadband','data plan','wifi','sim','insurance'],
    'Travel':         ['hotel','resort','airbnb','travel','trip','vacation','holiday',
                       'tour','passport','visa','luggage','booking.com','agoda'],
  };

  const sum  = arr => arr.reduce((a, b) => a + b, 0);
  const fmt  = (n) => {
    if (typeof window !== 'undefined' && window.App && typeof window.App.fmt === 'function') {
      return window.App.fmt(n);
    }
    const sym = '₱';
    return `${sym}${Math.abs(n).toFixed(2)}`;
  };

  function monthOf(iso, y, m) {
    const d = new Date(iso);
    return d.getFullYear() === y && d.getMonth() === m;
  }

  const api = {
    /* ─── Cashflow Forecast ──────────────────────────────────────────── */
    getCashflowForecastCard(income, expenses, accounts) {
      if (!income || expenses.length < 5) return '';
      
      const now = new Date();
      // Calculate daily burn rate over the last 30 days
      const thirtyDaysAgo = now.getTime() - (30 * 86400000);
      const recentExp = expenses.filter(e => new Date(e.date).getTime() >= thirtyDaysAgo);
      const totalBurn = sum(recentExp.map(e => e.amount));
      const dailyBurn = totalBurn / 30;

      if (dailyBurn <= 0) return '';

      const totalCash = (accounts || []).reduce((s, a) => s + a.balance, 0);

      // Estimate if they can afford an imaginary 20% of their income purchase in 30 days
      const daysUntilTarget = 30;
      
      // Rough projection: Current Cash + Income - (dailyBurn * days)
      const projectedCash = totalCash + income - (dailyBurn * daysUntilTarget);
      
      const title = projectedCash > 0 ? 'Positive Cashflow Expected' : 'Cashflow Warning';
      const msg = title.includes('Warning') 
        ? `At your current burn rate of ${fmt(dailyBurn)}/day, you may face a shortfall of ${fmt(Math.abs(projectedCash))} in 30 days.`
        : `At ${fmt(dailyBurn)}/day, you're projected to have ${fmt(projectedCash)} in 30 days.`;
      
      const tip = title.includes('Warning')
        ? 'Consider reducing non-essential spending this month.'
        : 'You are on track to handle upcoming purchases safely.';

      return `
        <div class="insight-card insight-${title.includes('Warning') ? 'danger' : 'success'}" style="margin:0 0 16px;">
          <div class="insight-top">
            <span class="insight-icon">🔮</span>
            <div class="insight-body">
              <div class="insight-title">${title}</div>
              <div class="insight-msg">${msg}</div>
            </div>
          </div>
          <div class="insight-tip">${tip}</div>
        </div>
      `;
    },

    /* ─── Auto-categorise from text ──────────────────────────────────── */
    detectCategory(text) {
      if (!text) return 'Other';
      const lower = text.toLowerCase();
      for (const [cat, kws] of Object.entries(KEYWORDS)) {
        if (kws.some(k => lower.includes(k))) return cat;
      }
      return 'Other';
    },

    /* ─── 50 / 30 / 20 budget suggestions ────────────────────────────── */
    getBudgetSuggestions(income, expenses) {
      // Build 3-month category averages
      const cutoff = Date.now() - 90 * 86400000;
      const recent = expenses.filter(e => new Date(e.date).getTime() >= cutoff);
      const catSum = {};
      recent.forEach(e => { catSum[e.category] = (catSum[e.category] || 0) + e.amount; });

      if (income <= 0) {
        // No income set → suggest 15 % reduction from historical average
        const result = {};
        Object.entries(catSum).forEach(([k, v]) => { result[k] = Math.round(v / 3 * 0.85); });
        return result;
      }

      // Full 50/30/20 breakdown
      const needs = income * 0.50;
      const wants = income * 0.30;
      return {
        'Housing':       Math.round(needs * 0.40),
        'Food & Dining': Math.round(needs * 0.25),
        'Transport':     Math.round(needs * 0.15),
        'Utilities':     Math.round(needs * 0.12),
        'Health':        Math.round(needs * 0.08),
        'Shopping':      Math.round(wants * 0.40),
        'Entertainment': Math.round(wants * 0.30),
        'Travel':        Math.round(wants * 0.20),
        'Education':     Math.round(wants * 0.10),
        'Other':         Math.round(income * 0.05),
        _savings:        Math.round(income * 0.20),
      };
    },

    /* ─── AI insight cards ───────────────────────────────────────────── */
    getInsights(expenses, budgets, income, accounts = []) {
      const now   = new Date();
      const y     = now.getFullYear();
      const m     = now.getMonth();
      const lm    = new Date(y, m - 1, 1);

      const thisMonth = expenses.filter(e => monthOf(e.date, y, m));
      const lastMonth = expenses.filter(e => monthOf(e.date, lm.getFullYear(), lm.getMonth()));

      const thisTotal = sum(thisMonth.map(e => e.amount));
      const lastTotal = sum(lastMonth.map(e => e.amount));

      const catTotals = {};
      thisMonth.forEach(e => { catTotals[e.category] = (catTotals[e.category] || 0) + e.amount; });

      const insights = [];

      // Month-over-month comparison
      if (lastTotal > 0) {
        const pct = ((thisTotal - lastTotal) / lastTotal * 100);
        if (pct > 10) {
          insights.push({
            type: 'warning', icon: '📈', title: 'Spending Up',
            message: `You're spending ${pct.toFixed(0)}% more than last month.`,
            tip:    'Review your biggest categories to find savings opportunities.',
          });
        } else if (pct < -10) {
          insights.push({
            type: 'success', icon: '🎉', title: 'Spending Down!',
            message: `Spent ${Math.abs(pct).toFixed(0)}% less than last month. Great work!`,
            tip:    'Consider investing the difference for long-term growth.',
          });
        }
      }

      // Budget threshold alerts
      Object.entries(catTotals).forEach(([cat, spent]) => {
        const budget = budgets[cat];
        if (!budget) return;
        const pct = spent / budget * 100;
        if (pct >= 100) {
          insights.push({
            type: 'danger', icon: '🚨', title: `${cat} Over Budget`,
            message: `Spent ${fmt(spent)} of ${fmt(budget)} (${pct.toFixed(0)}%).`,
            tip:    `Reduce ${cat} by ${fmt(spent - budget)} to get back on track.`,
          });
        } else if (pct >= 80) {
          insights.push({
            type: 'warning', icon: '⚠️', title: `${cat} Near Limit`,
            message: `Used ${pct.toFixed(0)}% of your ${cat} budget.`,
            tip:    `Only ${fmt(budget - spent)} left for ${cat} this month.`,
          });
        }
      });

      // Top-spending category
      const top = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0];
      if (top && thisTotal > 0) {
        const pct = (top[1] / thisTotal * 100).toFixed(0);
        insights.push({
          type: 'info', icon: '💡', title: 'Biggest Expense',
          message: `${top[0]} is ${pct}% of your spending (${fmt(top[1])}).`,
          tip:    `Cutting ${top[0]} by 10% saves ${fmt(top[1] * 0.1)}/month.`,
        });
      }

      // Savings outlook
      if (income > 0) {
        const saved  = income - thisTotal;
        const target = income * 0.2;
        if (saved > 0) {
          insights.push({
            type: saved >= target ? 'success' : 'info',
            icon: '💰', title: 'Savings Outlook',
            message: `On track to save ${fmt(saved)} this month.`,
            tip: saved >= target
              ? `You're hitting the 20% savings goal! Consider investing the extra.`
              : `Save ${fmt(target - saved)} more to reach the recommended 20% target.`,
          });
        } else {
          insights.push({
            type: 'danger', icon: '🔴', title: 'Over Income',
            message: `Spending exceeds income by ${fmt(Math.abs(saved))}.`,
            tip:    'Identify non-essential expenses to cut this month.',
          });
        }
      }

      // Fallback when no data
      if (insights.length === 0) {
        insights.push({
          type: 'info', icon: '🤖', title: 'AI Ready',
          message: 'Add expenses and set your income for personalized insights.',
          tip:    'Go to Budget tab to set your monthly income and category budgets.',
        });
      }

      return insights;
    },

    /* ─── Daily spending trend ───────────────────────────────────────── */
    getTrends(expenses, days) {
      const now     = new Date();
      const buckets = {};

      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        buckets[d.toISOString().slice(0, 10)] = 0;
      }

      expenses.forEach(e => {
        const k = new Date(e.date).toISOString().slice(0, 10);
        if (k in buckets) buckets[k] += e.amount;
      });

      const labels = [], data = [];
      Object.entries(buckets).forEach(([date, amount]) => {
        const d = new Date(date);
        labels.push(d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }));
        data.push(amount);
      });

      return { labels, data };
    },

    /* ─── Category breakdown ─────────────────────────────────────────── */
    getCategoryBreakdown(expenses) {
      const totals = {};
      expenses.forEach(e => { totals[e.category] = (totals[e.category] || 0) + e.amount; });
      return Object.entries(totals)
        .sort((a, b) => b[1] - a[1])
        .map(([category, amount]) => ({ category, amount }));
    },

    /* ─── Spending anomalies  ─────────────────────────────────────────── */
    detectAnomalies(expenses) {
      const catItems = {};
      expenses.forEach(e => {
        (catItems[e.category] = catItems[e.category] || []).push(e);
      });

      const anomalies = [];
      const now = Date.now();

      Object.entries(catItems).forEach(([cat, items]) => {
        if (items.length < 4) return;
        const amounts  = items.map(e => e.amount);
        const avg      = sum(amounts) / amounts.length;
        const recent7  = items.filter(e => now - new Date(e.date).getTime() <= 7 * 86400000);
        const rTotal   = sum(recent7.map(e => e.amount));
        if (rTotal > avg * 2.5 && rTotal > 50) {
          anomalies.push({ category: cat, total: rTotal, avg });
        }
      });

      return anomalies;
    },

    fmt,
  };

  return api;
})();
