import React, { useState, useEffect } from 'react';
import { getDailyReport, getMonthlyReport, getCategoryWiseReport, getSalaryReport } from '../../services/accountsService';
import { BarChart3, Calendar, PieChart, DollarSign, ArrowDownToLine, RefreshCw, TrendingUp, TrendingDown, Coins, ShoppingCart, Search, Filter, ArrowUpDown, Wallet } from 'lucide-react';

const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');

const getApiEndpoint = (path) => {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (API_BASE.endsWith('/v1')) {
    return `${API_BASE}${cleanPath}`;
  }
  if (API_BASE.endsWith('/api')) {
    return `${API_BASE}/v1${cleanPath}`;
  }
  return `${API_BASE}/api/v1${cleanPath}`;
};

const getAuthHeaders = () => {
  const rawToken = localStorage.getItem('token') || '';
  const cleanToken = rawToken.replace(/^"(.*)"$/, '$1').trim();
  return {
    'Content-Type': 'application/json',
    'Authorization': cleanToken.startsWith('Bearer ') ? cleanToken : `Bearer ${cleanToken}`
  };
};

const ExpenseReportsTab = () => {
  const [activeReportSubTab, setActiveReportSubTab] = useState('daily');
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState(null);
  const [incomes, setIncomes] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [error, setError] = useState('');

  // Daily Filter
  const [dailyDate, setDailyDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Monthly Filter
  const [monthlyYear, setMonthlyYear] = useState(() => new Date().getFullYear().toString());
  const [monthlyMonth, setMonthlyMonth] = useState(() => (new Date().getMonth() + 1).toString());

  // Category Filter
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Salary Filter
  const [salaryMonth, setSalaryMonth] = useState('');

  // Search, Filter & Sort Controls
  const [searchTerm, setSearchTerm] = useState('');
  const [flowFilter, setFlowFilter] = useState('ALL'); // 'ALL' | 'INCOME' | 'EXPENSE' | 'PURCHASE'
  const [sortBy, setSortBy] = useState('date-desc'); // 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc'

  const fetchIncomeData = async () => {
    try {
      const res = await fetch(getApiEndpoint('/accounts/income'), { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          setIncomes(data.data);
        }
      }
    } catch (e) {
      console.warn('Error fetching income for financial report:', e);
    }
  };

  const fetchPurchaseData = async () => {
    try {
      const savedLocal = JSON.parse(localStorage.getItem('crm_purchase_records') || '[]');
      const res = await fetch(getApiEndpoint('/accounts/expenses'), { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          const filtered = data.data.filter(item => {
            const cat = String(item.categoryName || item.category || '').toLowerCase();
            return cat.includes('purchase') || cat.includes('inventory') || item.isPurchase === true;
          });
          const combinedMap = new Map();
          savedLocal.forEach(p => combinedMap.set(String(p._id || p.id), p));
          filtered.forEach(p => combinedMap.set(String(p._id || p.id), p));
          setPurchases(Array.from(combinedMap.values()));
        } else {
          setPurchases(savedLocal);
        }
      } else {
        setPurchases(savedLocal);
      }
    } catch (e) {
      const saved = localStorage.getItem('crm_purchase_records');
      if (saved) setPurchases(JSON.parse(saved));
    }
  };

  const fetchReport = async () => {
    setLoading(true);
    setError('');
    try {
      await Promise.all([fetchIncomeData(), fetchPurchaseData()]);

      if (activeReportSubTab === 'daily') {
        const res = await getDailyReport({ date: dailyDate });
        if (res.success) setReportData(res);
      } else if (activeReportSubTab === 'monthly') {
        const res = await getMonthlyReport({ year: monthlyYear, month: monthlyMonth });
        if (res.success) setReportData(res);
      } else if (activeReportSubTab === 'category') {
        const res = await getCategoryWiseReport({ startDate, endDate });
        if (res.success) setReportData(res);
      } else if (activeReportSubTab === 'salary') {
        const res = await getSalaryReport({ month: salaryMonth });
        if (res.success) setReportData(res);
      }
    } catch (err) {
      console.error('Fetch report error:', err);
      setError('Error loading report analytics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [activeReportSubTab, dailyDate, monthlyYear, monthlyMonth, startDate, endDate, salaryMonth]);

  const handlePrintReport = () => {
    window.print();
  };

  // Helper calculations for Daily Income, Purchases & Expense
  const getDailyIncomes = () => {
    if (!dailyDate || !Array.isArray(incomes)) return [];
    return incomes.filter(inc => {
      const incDate = inc.date ? new Date(inc.date).toISOString().split('T')[0] : '';
      return incDate === dailyDate;
    });
  };

  const getDailyPurchases = () => {
    if (!dailyDate || !Array.isArray(purchases)) return [];
    return purchases.filter(pur => {
      const purDate = pur.date || pur.purchaseDate ? new Date(pur.date || pur.purchaseDate).toISOString().split('T')[0] : '';
      return purDate === dailyDate;
    });
  };

  const dayIncomesList = getDailyIncomes();
  const dayPurchasesList = getDailyPurchases();

  const dayBackendList = reportData?.data || [];
  const dayBackendPurchases = dayBackendList.filter(e => e.isPurchase || String(e.categoryName || '').toLowerCase().includes('purchase') || String(e.categoryName || '').toLowerCase().includes('inventory'));
  const dayBackendGenExp = dayBackendList.filter(e => !e.isPurchase && !String(e.categoryName || '').toLowerCase().includes('purchase') && !String(e.categoryName || '').toLowerCase().includes('inventory'));

  const allDayPurchasesMap = new Map();
  dayPurchasesList.forEach(p => allDayPurchasesMap.set(String(p._id || p.id), p));
  dayBackendPurchases.forEach(p => allDayPurchasesMap.set(String(p._id || p.id), p));
  const dayPurchaseTotal = Array.from(allDayPurchasesMap.values()).reduce((sum, item) => sum + (Number(item.amount || item.totalAmount) || 0), 0);

  const dayIncomeTotal = dayIncomesList.reduce((sum, item) => sum + (Number(item.receiptAmount || item.totalAmount || item.amount) || 0), 0);
  const dayExpenseTotal = dayBackendGenExp.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const dayTotalOutflow = dayExpenseTotal + dayPurchaseTotal;
  const dayNetSurplus = dayIncomeTotal - dayTotalOutflow;

  const getDailyCombinedRegister = () => {
    const combined = [];

    // 1. Day Incomes
    dayIncomesList.forEach(inc => {
      combined.push({
        _id: inc._id || inc.id,
        flowType: 'INCOME',
        date: inc.date || dailyDate,
        title: inc.title || 'Client Revenue',
        category: inc.department || 'Income',
        payee: inc.clientName || 'Client',
        paymentMode: inc.paymentMethod || 'Bank Transfer',
        amount: Number(inc.receiptAmount || inc.totalAmount || inc.amount) || 0
      });
    });

    // 2. Day Expenses from backend reportData
    const addedIds = new Set();
    dayBackendList.forEach(exp => {
      addedIds.add(String(exp._id));
      const cat = String(exp.categoryName || '').toLowerCase();
      const isPur = exp.isPurchase || cat.includes('purchase') || cat.includes('inventory');
      combined.push({
        _id: exp._id,
        flowType: isPur ? 'PURCHASE' : 'EXPENSE',
        date: exp.date || dailyDate,
        title: exp.categoryName || (isPur ? 'Inventory Procurement' : 'General Expense'),
        category: isPur ? 'Inventory & Purchase' : (exp.type === 'Salary' ? 'Employee Payroll' : (exp.categoryName || 'General')),
        payee: exp.paidTo || 'Vendor / Employee',
        paymentMode: exp.paymentMode || 'Cash',
        amount: exp.amount || 0
      });
    });

    // 3. Day Purchases from dayPurchasesList not in addedIds
    dayPurchasesList.forEach(pur => {
      const pId = String(pur._id || pur.id);
      if (!addedIds.has(pId)) {
        addedIds.add(pId);
        combined.push({
          _id: pId,
          flowType: 'PURCHASE',
          date: pur.date || pur.purchaseDate || dailyDate,
          title: pur.description || pur.itemName || 'Vendor Procurement',
          category: 'Inventory & Purchase',
          payee: pur.paidTo || pur.vendorName || 'Vendor',
          paymentMode: pur.paymentMode || pur.paymentMethod || 'Bank Transfer',
          amount: Number(pur.amount || pur.totalAmount) || 0
        });
      }
    });

    return combined;
  };

  // Helper calculations for Monthly Income, Purchases & Expense
  const getMonthlyIncomes = () => {
    if (!Array.isArray(incomes)) return [];
    const targetMonth = parseInt(monthlyMonth, 10);
    const targetYear = parseInt(monthlyYear, 10);
    return incomes.filter(inc => {
      if (!inc.date) return false;
      const d = new Date(inc.date);
      return d.getMonth() + 1 === targetMonth && d.getFullYear() === targetYear;
    });
  };

  const getMonthlyPurchases = () => {
    if (!Array.isArray(purchases)) return [];
    const targetMonth = parseInt(monthlyMonth, 10);
    const targetYear = parseInt(monthlyYear, 10);
    return purchases.filter(pur => {
      const pDate = pur.date || pur.purchaseDate;
      if (!pDate) return false;
      const d = new Date(pDate);
      return d.getMonth() + 1 === targetMonth && d.getFullYear() === targetYear;
    });
  };

  const monthIncomesList = getMonthlyIncomes();
  const monthPurchasesList = getMonthlyPurchases();
  const monthIncomeTotal = monthIncomesList.reduce((sum, item) => sum + (Number(item.receiptAmount || item.totalAmount || item.amount) || 0), 0);

  // Consolidated Backend + Local Expense & Purchase Lists
  const backendExpList = reportData?.data || [];
  const monthBackendPurchases = backendExpList.filter(e => e.isPurchase || String(e.categoryName || '').toLowerCase().includes('purchase') || String(e.categoryName || '').toLowerCase().includes('inventory'));
  const monthBackendGenExp = backendExpList.filter(e => !e.isPurchase && !String(e.categoryName || '').toLowerCase().includes('purchase') && !String(e.categoryName || '').toLowerCase().includes('inventory'));

  const allMonthlyPurchasesMap = new Map();
  monthPurchasesList.forEach(p => allMonthlyPurchasesMap.set(String(p._id || p.id), p));
  monthBackendPurchases.forEach(p => allMonthlyPurchasesMap.set(String(p._id || p.id), p));
  const monthPurchaseTotal = Array.from(allMonthlyPurchasesMap.values()).reduce((sum, item) => sum + (Number(item.amount || item.totalAmount) || 0), 0);

  const monthGeneralExpenseTotal = monthBackendGenExp.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const monthTotalOutflow = monthGeneralExpenseTotal + monthPurchaseTotal;
  const monthNetProfit = monthIncomeTotal - monthTotalOutflow;

  const getMonthlyCombinedRegister = () => {
    const combined = [];
    monthIncomesList.forEach(inc => {
      combined.push({
        _id: inc._id || inc.id,
        flowType: 'INCOME',
        date: inc.date,
        title: inc.title || 'Client Revenue',
        category: inc.department || 'Income',
        payee: inc.clientName || 'Client',
        paymentMode: inc.paymentMethod || 'Bank Transfer',
        amount: Number(inc.receiptAmount || inc.totalAmount || inc.amount) || 0
      });
    });

    const addedIds = new Set();
    backendExpList.forEach(exp => {
      addedIds.add(String(exp._id));
      const cat = String(exp.categoryName || '').toLowerCase();
      const isPur = exp.isPurchase || cat.includes('purchase') || cat.includes('inventory');
      combined.push({
        _id: exp._id,
        flowType: isPur ? 'PURCHASE' : 'EXPENSE',
        date: exp.date,
        title: exp.categoryName || (isPur ? 'Inventory Procurement' : 'General Expense'),
        category: isPur ? 'Inventory & Purchase' : (exp.type === 'Salary' ? 'Employee Payroll' : (exp.categoryName || 'General')),
        payee: exp.paidTo || 'Vendor / Employee',
        paymentMode: exp.paymentMode || 'Cash',
        amount: exp.amount || 0
      });
    });

    monthPurchasesList.forEach(pur => {
      const pId = String(pur._id || pur.id);
      if (!addedIds.has(pId)) {
        addedIds.add(pId);
        combined.push({
          _id: pId,
          flowType: 'PURCHASE',
          date: pur.date || pur.purchaseDate,
          title: pur.description || pur.itemName || 'Vendor Procurement',
          category: 'Inventory & Purchase',
          payee: pur.paidTo || pur.vendorName || 'Vendor',
          paymentMode: pur.paymentMode || pur.paymentMethod || 'Bank Transfer',
          amount: Number(pur.amount || pur.totalAmount) || 0
        });
      }
    });

    return combined;
  };

  const applyFilterAndSort = (items) => {
    let result = [...items];

    if (flowFilter && flowFilter !== 'ALL') {
      result = result.filter(item => item.flowType === flowFilter);
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      result = result.filter(item => 
        (item.title || '').toLowerCase().includes(q) ||
        (item.payee || '').toLowerCase().includes(q) ||
        (item.category || '').toLowerCase().includes(q) ||
        (item.paymentMode || '').toLowerCase().includes(q)
      );
    }

    result.sort((a, b) => {
      if (sortBy === 'amount-desc') {
        return (b.amount || 0) - (a.amount || 0);
      }
      if (sortBy === 'amount-asc') {
        return (a.amount || 0) - (b.amount || 0);
      }
      if (sortBy === 'date-asc') {
        return new Date(a.date || 0) - new Date(b.date || 0);
      }
      return new Date(b.date || 0) - new Date(a.date || 0);
    });

    return result;
  };

  const dayRawList = getDailyCombinedRegister();
  const dayCombinedList = applyFilterAndSort(dayRawList);

  const monthRawList = getMonthlyCombinedRegister();
  const monthCombinedList = applyFilterAndSort(monthRawList);

  return (
    <div className="space-y-6">
      {/* Sub-tab Navigation Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            Profit & Loss Statement (P&L Analytics)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Consolidated statement of Sales, Income Receipts, Vendor Procurement Purchases, Operational Expenses, and Net Profit.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrintReport}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium transition cursor-pointer"
          >
            <ArrowDownToLine size={14} />
            <span>Print / Export PDF</span>
          </button>
          <button
            onClick={fetchReport}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition cursor-pointer"
            title="Refresh Financial Report"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Report Sub-tab Selectors */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 bg-slate-100 dark:bg-slate-950 p-1.5 rounded-2xl border border-slate-200/60 dark:border-slate-800">
        <button
          onClick={() => setActiveReportSubTab('daily')}
          className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeReportSubTab === 'daily'
              ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Calendar size={15} />
          <span>Daily Ledger</span>
        </button>

        <button
          onClick={() => setActiveReportSubTab('monthly')}
          className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeReportSubTab === 'monthly'
              ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <BarChart3 size={15} />
          <span>Monthly P&L</span>
        </button>

        <button
          onClick={() => setActiveReportSubTab('purchase')}
          className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeReportSubTab === 'purchase'
              ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <ShoppingCart size={15} />
          <span>Purchase Register</span>
        </button>

        <button
          onClick={() => setActiveReportSubTab('category')}
          className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeReportSubTab === 'category'
              ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <PieChart size={15} />
          <span>Categories</span>
        </button>

        <button
          onClick={() => setActiveReportSubTab('salary')}
          className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeReportSubTab === 'salary'
              ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <DollarSign size={15} />
          <span>Salary Report</span>
        </button>
      </div>

      {/* ── REPORT CONTENT PANEL ── */}

      {/* 1. DAILY FINANCIAL LEDGER (INCOME + EXPENSES) */}
      {activeReportSubTab === 'daily' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                Daily Financial Ledger
              </h3>
              <p className="text-xs text-slate-400">Consolidated day-wise view of income receipts and expense outflows.</p>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Select Date:</label>
              <input
                type="date"
                value={dailyDate}
                onChange={(e) => setDailyDate(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs font-medium cursor-pointer"
              />
            </div>
          </div>

          {/* Comprehensive 6-Column Profit & Loss Metric Cards for Daily View */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            <div className="bg-white dark:bg-slate-900 border border-emerald-500/20 dark:border-emerald-500/30 rounded-2xl p-4 shadow-2xs">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500 dark:text-slate-400 font-bold">Income Opening</p>
                <Coins size={16} className="text-emerald-600 dark:text-emerald-400" />
              </div>
              <h4 className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-1.5 font-mono">
                ₹{(reportData?.summary?.incomeOpeningBalance || 0).toLocaleString('en-IN')}
              </h4>
              <p className="text-[10px] text-slate-400 mt-0.5">As of Day Start</p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-emerald-500/20 dark:border-emerald-500/30 rounded-2xl p-4 shadow-2xs">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500 dark:text-slate-400 font-bold">Total Income Received</p>
                <TrendingUp size={16} className="text-emerald-600 dark:text-emerald-400" />
              </div>
              <h4 className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-1.5 font-mono">
                +₹{((reportData?.summary?.incomeOpeningBalance || 0) + dayIncomeTotal).toLocaleString('en-IN')}
              </h4>
              <p className="text-[10px] text-slate-400 mt-0.5">Inc. OB ₹{(reportData?.summary?.incomeOpeningBalance || 0).toLocaleString('en-IN')}</p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-rose-500/20 dark:border-rose-500/30 rounded-2xl p-4 shadow-2xs">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500 dark:text-slate-400 font-bold">Expense Opening</p>
                <TrendingDown size={16} className="text-rose-600 dark:text-rose-400" />
              </div>
              <h4 className="text-lg font-black text-rose-600 dark:text-rose-400 mt-1.5 font-mono">
                ₹{(reportData?.summary?.expenseOpeningBalance || 0).toLocaleString('en-IN')}
              </h4>
              <p className="text-[10px] text-slate-400 mt-0.5">As of Day Start</p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-purple-500/20 dark:border-purple-500/30 rounded-2xl p-4 shadow-2xs">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500 dark:text-slate-400 font-bold">Total Outflows</p>
                <TrendingDown size={16} className="text-purple-600 dark:text-purple-400" />
              </div>
              <h4 className="text-lg font-black text-purple-600 dark:text-purple-400 mt-1.5 font-mono">
                -₹{((reportData?.summary?.expenseOpeningBalance || 0) + dayExpenseTotal + purchases.filter(p => (p.date ? new Date(p.date).toISOString().split('T')[0] : '') === dailyDate).reduce((s, p) => s + (Number(p.amount || p.totalAmount) || 0), 0)).toLocaleString('en-IN')}
              </h4>
              <p className="text-[10px] text-slate-400 mt-0.5">Inc. OB ₹{(reportData?.summary?.expenseOpeningBalance || 0).toLocaleString('en-IN')}</p>
            </div>

            <div className={`bg-white dark:bg-slate-900 border ${dayNetSurplus >= 0 ? 'border-indigo-500/20 dark:border-indigo-500/30' : 'border-amber-500/20 dark:border-amber-500/30'} rounded-2xl p-4 shadow-2xs`}>
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500 dark:text-slate-400 font-bold">Period Net Profit</p>
                <Coins size={16} className={dayNetSurplus >= 0 ? "text-indigo-600 dark:text-indigo-400" : "text-amber-600 dark:text-amber-400"} />
              </div>
              <h4 className={`text-lg font-black mt-1.5 font-mono ${dayNetSurplus >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-amber-600 dark:text-amber-400'}`}>
                {dayNetSurplus >= 0 ? '+' : ''}₹{dayNetSurplus.toLocaleString('en-IN')}
              </h4>
              <p className="text-[10px] text-slate-400 mt-0.5">{dayNetSurplus >= 0 ? 'Period Surplus' : 'Period Deficit'}</p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-indigo-500/20 dark:border-indigo-500/30 rounded-2xl p-4 shadow-2xs">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500 dark:text-slate-400 font-bold">Closing Net Balance</p>
                <Wallet size={16} className="text-indigo-600 dark:text-indigo-400" />
              </div>
              <h4 className="text-lg font-black text-indigo-600 dark:text-indigo-400 mt-1.5 font-mono">
                ₹{((reportData?.summary?.closingBalance) !== undefined ? reportData.summary.closingBalance : (((reportData?.summary?.incomeOpeningBalance || 0) + dayIncomeTotal) - ((reportData?.summary?.expenseOpeningBalance || 0) + dayExpenseTotal))).toLocaleString('en-IN')}
              </h4>
              <p className="text-[10px] text-slate-400 mt-0.5">Effective Closing</p>
            </div>
          </div>

          {/* Filter & Sort Controls Toolbar for Daily View */}
          <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
            <div className="flex-1 relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search daily transactions by title, payee, category, payment mode..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-medium text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5">
                <Filter size={13} className="text-slate-400" />
                <span className="text-[11px] font-bold text-slate-500">Flow:</span>
                <select
                  value={flowFilter}
                  onChange={(e) => setFlowFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-semibold text-slate-800 dark:text-slate-100 cursor-pointer"
                >
                  <option value="ALL">All Flows</option>
                  <option value="INCOME">Income Inflow (+)</option>
                  <option value="EXPENSE">General Expense (-)</option>
                  <option value="PURCHASE">Vendor Purchase (-)</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <ArrowUpDown size={13} className="text-slate-400" />
                <span className="text-[11px] font-bold text-slate-500">Sort:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-semibold text-slate-800 dark:text-slate-100 cursor-pointer"
                >
                  <option value="date-desc">Date (Newest First)</option>
                  <option value="date-asc">Date (Oldest First)</option>
                  <option value="amount-desc">Amount (High → Low)</option>
                  <option value="amount-asc">Amount (Low → High)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Consolidated Daily Financial Transactions Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Consolidated Daily Ledger (All Inflows & Outflows)</h4>
              <span className="text-[10px] font-bold text-slate-400">{dailyDate}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 border-y border-slate-200/60 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Flow</th>
                    <th className="py-2.5 px-3">Title / Source / Category</th>
                    <th className="py-2.5 px-3">Client / Payee</th>
                    <th className="py-2.5 px-3">Payment Mode</th>
                    <th className="py-2.5 px-3 text-right">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {loading ? (
                    <tr><td colSpan={5} className="py-6 text-center text-slate-400">Loading daily financial ledger...</td></tr>
                  ) : dayCombinedList.length === 0 ? (
                    <tr><td colSpan={5} className="py-6 text-center text-slate-400">No matching income, expense, or purchase transactions found for this date.</td></tr>
                  ) : (
                    dayCombinedList.map((item) => {
                      const isIncome = item.flowType === 'INCOME';
                      const isPurchase = item.flowType === 'PURCHASE';
                      return (
                        <tr
                          key={item._id}
                          className={
                            isIncome
                              ? 'bg-emerald-50/30 dark:bg-emerald-950/10'
                              : isPurchase
                              ? 'bg-purple-50/30 dark:bg-purple-950/10'
                              : 'bg-rose-50/20 dark:bg-rose-950/10'
                          }
                        >
                          <td className="py-3 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                                isIncome
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                  : isPurchase
                                  ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300'
                                  : 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                              }`}
                            >
                              {item.flowType}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <strong className="block text-slate-900 dark:text-slate-100">{item.title}</strong>
                            <span className="text-[10px] text-slate-400">{item.category}</span>
                          </td>
                          <td className="py-3 px-3">{item.payee}</td>
                          <td className="py-3 px-3">{item.paymentMode}</td>
                          <td
                            className={`py-3 px-3 text-right font-mono font-black ${
                              isIncome
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : isPurchase
                                ? 'text-purple-600 dark:text-purple-400'
                                : 'text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {isIncome ? '+' : '-'} ₹{(item.amount || 0).toLocaleString('en-IN')}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 2. MONTHLY FINANCIAL SUMMARY (INCOME VS EXPENSE) */}
      {activeReportSubTab === 'monthly' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                Monthly Income & Expense Summary
              </h3>
              <p className="text-xs text-slate-400">Monthly financial overview of revenues, expenses & net operating profit.</p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={monthlyMonth}
                onChange={(e) => setMonthlyMonth(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-semibold cursor-pointer"
              >
                {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m, idx) => (
                  <option key={idx} value={idx + 1}>{m}</option>
                ))}
              </select>
              <select
                value={monthlyYear}
                onChange={(e) => setMonthlyYear(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-semibold cursor-pointer"
              >
                {[2024, 2025, 2026, 2027].map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Comprehensive 6-Column Monthly Financial Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            <div className="bg-white dark:bg-slate-900 border border-emerald-500/20 dark:border-emerald-500/30 rounded-2xl p-4 shadow-2xs">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500 dark:text-slate-400 font-bold">Income Opening</p>
                <Coins size={16} className="text-emerald-600 dark:text-emerald-400" />
              </div>
              <h4 className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-1.5 font-mono">
                ₹{(reportData?.summary?.incomeOpeningBalance || 0).toLocaleString('en-IN')}
              </h4>
              <p className="text-[10px] text-slate-400 mt-0.5">As of Month Start</p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-emerald-500/20 dark:border-emerald-500/30 rounded-2xl p-4 shadow-2xs">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500 dark:text-slate-400 font-bold">Total Income Received</p>
                <TrendingUp size={16} className="text-emerald-600 dark:text-emerald-400" />
              </div>
              <h4 className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-1.5 font-mono">
                +₹{((reportData?.summary?.incomeOpeningBalance || 0) + monthIncomeTotal).toLocaleString('en-IN')}
              </h4>
              <p className="text-[10px] text-slate-400 mt-0.5">Inc. OB ₹{(reportData?.summary?.incomeOpeningBalance || 0).toLocaleString('en-IN')}</p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-rose-500/20 dark:border-rose-500/30 rounded-2xl p-4 shadow-2xs">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500 dark:text-slate-400 font-bold">Expense Opening</p>
                <TrendingDown size={16} className="text-rose-600 dark:text-rose-400" />
              </div>
              <h4 className="text-lg font-black text-rose-600 dark:text-rose-400 mt-1.5 font-mono">
                ₹{(reportData?.summary?.expenseOpeningBalance || 0).toLocaleString('en-IN')}
              </h4>
              <p className="text-[10px] text-slate-400 mt-0.5">As of Month Start</p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-purple-500/20 dark:border-purple-500/30 rounded-2xl p-4 shadow-2xs">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500 dark:text-slate-400 font-bold">Total Outflows & Expenses</p>
                <TrendingDown size={16} className="text-purple-600 dark:text-purple-400" />
              </div>
              <h4 className="text-lg font-black text-purple-600 dark:text-purple-400 mt-1.5 font-mono">
                -₹{((reportData?.summary?.expenseOpeningBalance || 0) + monthTotalOutflow).toLocaleString('en-IN')}
              </h4>
              <p className="text-[10px] text-slate-400 mt-0.5">Inc. OB ₹{(reportData?.summary?.expenseOpeningBalance || 0).toLocaleString('en-IN')}</p>
            </div>

            <div className={`bg-white dark:bg-slate-900 border ${monthNetProfit >= 0 ? 'border-indigo-500/20 dark:border-indigo-500/30' : 'border-amber-500/20 dark:border-amber-500/30'} rounded-2xl p-4 shadow-2xs`}>
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500 dark:text-slate-400 font-bold">Period Net Profit</p>
                <Coins size={16} className={monthNetProfit >= 0 ? "text-indigo-600 dark:text-indigo-400" : "text-amber-600 dark:text-amber-400"} />
              </div>
              <h4 className={`text-lg font-black mt-1.5 font-mono ${monthNetProfit >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-amber-600 dark:text-amber-400'}`}>
                {monthNetProfit >= 0 ? '+' : ''}₹{monthNetProfit.toLocaleString('en-IN')}
              </h4>
              <p className="text-[10px] text-slate-400 mt-0.5">{monthNetProfit >= 0 ? 'Monthly Net Profit' : 'Monthly Deficit'}</p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-indigo-500/20 dark:border-indigo-500/30 rounded-2xl p-4 shadow-2xs">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500 dark:text-slate-400 font-bold">Closing Net Balance</p>
                <Wallet size={16} className="text-indigo-600 dark:text-indigo-400" />
              </div>
              <h4 className="text-lg font-black text-indigo-600 dark:text-indigo-400 mt-1.5 font-mono">
                ₹{((reportData?.summary?.closingBalance) !== undefined ? reportData.summary.closingBalance : (((reportData?.summary?.incomeOpeningBalance || 0) + monthIncomeTotal) - ((reportData?.summary?.expenseOpeningBalance || 0) + monthTotalOutflow))).toLocaleString('en-IN')}
              </h4>
              <p className="text-[10px] text-slate-400 mt-0.5">Effective Closing</p>
            </div>
          </div>

          {/* Filter & Sort Controls Toolbar for Monthly View */}
          <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
            <div className="flex-1 relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search monthly transactions by title, payee, category, payment mode..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-medium text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5">
                <Filter size={13} className="text-slate-400" />
                <span className="text-[11px] font-bold text-slate-500">Flow:</span>
                <select
                  value={flowFilter}
                  onChange={(e) => setFlowFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-semibold text-slate-800 dark:text-slate-100 cursor-pointer"
                >
                  <option value="ALL">All Flows</option>
                  <option value="INCOME">Income Inflow (+)</option>
                  <option value="EXPENSE">General Expense (-)</option>
                  <option value="PURCHASE">Vendor Purchase (-)</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <ArrowUpDown size={13} className="text-slate-400" />
                <span className="text-[11px] font-bold text-slate-500">Sort:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-semibold text-slate-800 dark:text-slate-100 cursor-pointer"
                >
                  <option value="date-desc">Date (Newest First)</option>
                  <option value="date-asc">Date (Oldest First)</option>
                  <option value="amount-desc">Amount (High → Low)</option>
                  <option value="amount-asc">Amount (Low → High)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Monthly Consolidated Register */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-3">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Monthly Consolidated Register (All Inflows & Outflows)</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 border-y border-slate-200/60 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Flow</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Category / Title</th>
                    <th className="py-2.5 px-3">Client / Payee</th>
                    <th className="py-2.5 px-3 text-right">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {loading ? (
                    <tr><td colSpan={5} className="py-6 text-center text-slate-400">Loading monthly financial register...</td></tr>
                  ) : monthCombinedList.length === 0 ? (
                    <tr><td colSpan={5} className="py-6 text-center text-slate-400">No financial transactions recorded for this month.</td></tr>
                  ) : (
                    monthCombinedList.map((item) => {
                      const isIncome = item.flowType === 'INCOME';
                      const isPurchase = item.flowType === 'PURCHASE';
                      return (
                        <tr
                          key={item._id}
                          className={
                            isIncome
                              ? 'bg-emerald-50/30 dark:bg-emerald-950/10'
                              : isPurchase
                              ? 'bg-purple-50/30 dark:bg-purple-950/10'
                              : 'bg-rose-50/20 dark:bg-rose-950/10'
                          }
                        >
                          <td className="py-3 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                                isIncome
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                  : isPurchase
                                  ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300'
                                  : 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                              }`}
                            >
                              {item.flowType}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-slate-500">
                            {item.date ? new Date(item.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'N/A'}
                          </td>
                          <td className="py-3 px-3 font-semibold text-slate-900 dark:text-slate-100">
                            {item.title}
                            <span className="block text-[10px] text-slate-400 font-normal">{item.category}</span>
                          </td>
                          <td className="py-3 px-3">{item.payee}</td>
                          <td
                            className={`py-3 px-3 text-right font-mono font-black ${
                              isIncome
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : isPurchase
                                ? 'text-purple-600 dark:text-purple-400'
                                : 'text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {isIncome ? '+' : '-'} ₹{(item.amount || 0).toLocaleString('en-IN')}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 3. PURCHASE PROCUREMENT REGISTER */}
      {activeReportSubTab === 'purchase' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                Purchase & Procurement Register
              </h3>
              <p className="text-xs text-slate-400">Statement of vendor bills, inventory procurement, and purchase orders.</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-purple-50 dark:bg-purple-950/40 text-purple-600 border border-purple-200 dark:border-purple-800">
                {purchases.length} Procurement Entries
              </span>
            </div>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-purple-500/20 dark:border-purple-500/30 rounded-2xl p-4 shadow-2xs">
              <p className="text-xs text-slate-500 dark:text-slate-400 font-bold">Total Procurement Outflow</p>
              <h4 className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-1 font-mono">
                ₹{purchases.reduce((sum, p) => sum + (Number(p.amount || p.totalAmount) || 0), 0).toLocaleString('en-IN')}
              </h4>
              <p className="text-[10px] text-slate-400 mt-0.5">Inventory & Vendor Orders</p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-emerald-500/20 dark:border-emerald-500/30 rounded-2xl p-4 shadow-2xs">
              <p className="text-xs text-slate-500 dark:text-slate-400 font-bold">Approved Vendor Bills</p>
              <h4 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
                ₹{purchases.filter(p => p.status === 'APPROVED' || p.status === 'Paid').reduce((sum, p) => sum + (Number(p.amount || p.totalAmount) || 0), 0).toLocaleString('en-IN')}
              </h4>
              <p className="text-[10px] text-slate-400 mt-0.5">Settled Accounts Payable</p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-amber-500/20 dark:border-amber-500/30 rounded-2xl p-4 shadow-2xs">
              <p className="text-xs text-slate-500 dark:text-slate-400 font-bold">Pending Vendor Bills</p>
              <h4 className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1 font-mono">
                ₹{purchases.filter(p => p.status !== 'APPROVED' && p.status !== 'Paid').reduce((sum, p) => sum + (Number(p.amount || p.totalAmount) || 0), 0).toLocaleString('en-IN')}
              </h4>
              <p className="text-[10px] text-slate-400 mt-0.5">Unsettled / Approval Pending</p>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-3">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Procurement Purchase Ledger</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 border-y border-slate-200/60 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Bill / PO Ref</th>
                    <th className="py-2.5 px-3">Vendor Name</th>
                    <th className="py-2.5 px-3">Item / Service Description</th>
                    <th className="py-2.5 px-3">Payment Mode</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {purchases.length === 0 ? (
                    <tr><td colSpan={7} className="py-6 text-center text-slate-400">No purchase procurement records found.</td></tr>
                  ) : (
                    purchases.map((pur) => (
                      <tr key={pur._id || pur.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/30">
                        <td className="py-3 px-3 text-slate-500 whitespace-nowrap">
                          {new Date(pur.date || pur.purchaseDate || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-slate-700 dark:text-slate-300">
                          {pur.billNo || pur.referenceNo || 'PO-PUR-001'}
                        </td>
                        <td className="py-3 px-3 font-bold text-slate-900 dark:text-slate-100">
                          {pur.paidTo || pur.vendorName || 'Vendor'}
                        </td>
                        <td className="py-3 px-3 text-slate-600 dark:text-slate-400">
                          {pur.description || pur.itemName || 'Goods / Procurement'}
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {pur.paymentMode || pur.paymentMethod || 'Bank Transfer'}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            pur.status === 'APPROVED' || pur.status === 'Paid'
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                              : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                          }`}>
                            {pur.status || 'APPROVED'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-black text-purple-600 dark:text-purple-400 whitespace-nowrap">
                          - ₹{(Number(pur.amount || pur.totalAmount) || 0).toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 3. CATEGORY & REVENUE BREAKDOWN */}
      {activeReportSubTab === 'category' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Category & Revenue Distribution</h3>
              <p className="text-xs text-slate-400">Percentage distribution & breakdown across categories.</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs cursor-pointer"
                placeholder="Start Date"
              />
              <span className="text-xs text-slate-400">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs cursor-pointer"
                placeholder="End Date"
              />
            </div>
          </div>

          {/* Grand Financial Totals Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-emerald-500/20 dark:border-emerald-500/30 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 font-semibold">Total Revenue Inflows</p>
                <h4 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5 font-mono">
                  ₹{incomes.reduce((sum, i) => sum + (Number(i.receiptAmount || i.totalAmount || i.amount) || 0), 0).toLocaleString('en-IN')}
                </h4>
              </div>
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600">
                {incomes.length} Income Receipts
              </span>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-rose-500/20 dark:border-rose-500/30 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 font-semibold">Total Expense Outflows</p>
                <h4 className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-0.5 font-mono">
                  ₹{(reportData?.summary?.grandTotal || 0).toLocaleString('en-IN')}
                </h4>
              </div>
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-600">
                {reportData?.summary?.categoryCount || 0} Categories Active
              </span>
            </div>
          </div>

          {/* Expense Category Progress Bars */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Expense Category Breakdown</h4>
            {loading ? (
              <p className="text-center py-6 text-slate-400 text-xs">Loading category breakdown...</p>
            ) : !reportData?.data || reportData.data.length === 0 ? (
              <p className="text-center py-6 text-slate-400 text-xs">No expense category data found.</p>
            ) : (
              reportData.data.map((cat, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-slate-800 dark:text-slate-200 font-bold">{cat.category}</span>
                    <span className="text-slate-600 dark:text-slate-400 font-semibold font-mono">
                      ₹{(cat.totalAmount || 0).toLocaleString('en-IN')} ({cat.percentage}%)
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-rose-500 to-rose-600 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(cat.percentage, 100)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 4. SALARY REPORT */}
      {activeReportSubTab === 'salary' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Employee Salary Disbursement Report</h3>
              <p className="text-xs text-slate-400">Total salaries paid across employees & payroll records.</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Filter Month (e.g. August 2026)"
                value={salaryMonth}
                onChange={(e) => setSalaryMonth(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs"
              />
            </div>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4">
              <p className="text-xs text-slate-400 font-semibold">Total Disbursed Salary</p>
              <h4 className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-1 font-mono">
                ₹{(reportData?.summary?.totalPaid || 0).toLocaleString('en-IN')}
              </h4>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4">
              <p className="text-xs text-slate-400 font-semibold">Total Salary Records Processed</p>
              <h4 className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-1">
                {reportData?.summary?.employeeCount || 0}
              </h4>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Salary Disbursal Audit Table</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 border-y border-slate-200/60 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Employee</th>
                    <th className="py-2.5 px-3">Month</th>
                    <th className="py-2.5 px-3">Basic Salary</th>
                    <th className="py-2.5 px-3">Mode</th>
                    <th className="py-2.5 px-3 text-right">Paid Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {loading ? (
                    <tr><td colSpan={6} className="py-6 text-center text-slate-400">Loading salary report...</td></tr>
                  ) : !reportData?.data || reportData.data.length === 0 ? (
                    <tr><td colSpan={6} className="py-6 text-center text-slate-400">No salary payment records found.</td></tr>
                  ) : (
                    reportData.data.map((p) => (
                      <tr key={p._id}>
                        <td className="py-3 px-3 font-medium">{new Date(p.paymentDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</td>
                        <td className="py-3 px-3 font-bold text-slate-900 dark:text-slate-100">{p.employeeName || p.employee?.name}</td>
                        <td className="py-3 px-3">{p.month}</td>
                        <td className="py-3 px-3 text-slate-500 font-mono">₹{(p.basicSalary || 0).toLocaleString('en-IN')}</td>
                        <td className="py-3 px-3">{p.paymentMode}</td>
                        <td className="py-3 px-3 text-right font-bold text-purple-600 dark:text-purple-400 font-mono">₹{p.paidAmount?.toLocaleString('en-IN')}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExpenseReportsTab;
