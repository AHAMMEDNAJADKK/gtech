import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wallet, TrendingUp, TrendingDown, DollarSign, ShoppingBag,
  ShoppingCart, Tag, BookCheck, BarChart3, RefreshCw, ChevronRight,
  Plus, CheckCircle2, Clock, AlertCircle, FileText, ArrowUpRight,
  ArrowDownRight, CreditCard, Receipt, Calendar, ShieldAlert, Loader2,
  PieChart, Building2, User, Eye, PlusCircle, Calculator
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../components/ToastProvider';
import {
  getOpeningBalance, getExpenses, getSalaryPayments,
  getCashBook, getExpenseCategories, getMonthlyReport
} from '../services/accountsService';
import CreatePayslipModal from '../components/accounts/CreatePayslipModal';

const rawApiBase = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');
const API_BASE = rawApiBase.endsWith('/v1') ? rawApiBase.slice(0, -3) : rawApiBase;

const getApiEndpoint = (path) => {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}/v1${cleanPath}`;
};

const AccountantDashboard = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [user, setUser] = useState(null);

  // Data states
  const [openingBalance, setOpeningBalanceState] = useState({ incomeAmount: 0, expenseAmount: 0 });
  const [incomes, setIncomes] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [salaries, setSalaries] = useState([]);
  const [cashBook, setCashBook] = useState([]);
  const [categories, setCategories] = useState([]);
  
  // UI states
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeLedgerTab, setActiveLedgerTab] = useState('income'); // 'income' | 'expenses' | 'salaries' | 'cashbook'
  const [timeFilter, setTimeFilter] = useState('all'); // 'all' | 'month' | 'today'
  const [isCreatePayslipOpen, setIsCreatePayslipOpen] = useState(false);

  const getAuthHeaders = useCallback(() => {
    const rawToken = localStorage.getItem('token');
    const cleanToken = rawToken ? rawToken.replace(/^"(.*)"$/, '$1').replace(/"/g, '').replace(/^Bearer\s+/i, '').trim() : '';
    return {
      'Authorization': `Bearer ${cleanToken}`,
      'Content-Type': 'application/json'
    };
  }, []);

  useEffect(() => {
    try {
      const savedUser = localStorage.getItem('user');
      if (savedUser) setUser(JSON.parse(savedUser));
    } catch (e) { console.error(e); }
  }, []);

  // Fetch all accounting data concurrently
  const fetchDashboardData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);

    try {
      const headers = getAuthHeaders();

      // Fetch Income entries
      const incomePromise = fetch(getApiEndpoint('/accounts/income'), { headers })
        .then(res => res.json())
        .then(json => {
          if (json.success && Array.isArray(json.data)) return json.data;
          if (Array.isArray(json)) return json;
          return [];
        })
        .catch(err => {
          console.error("Failed to load incomes:", err);
          return [];
        });

      // Fetch Opening Balance
      const obPromise = getOpeningBalance()
        .then(res => res?.data || res || { incomeAmount: 0, expenseAmount: 0 })
        .catch(err => ({ incomeAmount: 0, expenseAmount: 0 }));

      // Fetch Expenses
      const expensePromise = getExpenses()
        .then(res => res?.data || (Array.isArray(res) ? res : []))
        .catch(err => []);

      // Fetch Salary Payments
      const salaryPromise = getSalaryPayments()
        .then(res => res?.data || (Array.isArray(res) ? res : []))
        .catch(err => []);

      // Fetch Cash Book
      const cashBookPromise = getCashBook()
        .then(res => res?.data || (Array.isArray(res) ? res : []))
        .catch(err => []);

      // Fetch Expense Categories
      const categoriesPromise = getExpenseCategories()
        .then(res => res?.data || (Array.isArray(res) ? res : []))
        .catch(err => []);

      const [incData, obData, expData, salData, cbData, catData] = await Promise.all([
        incomePromise, obPromise, expensePromise, salaryPromise, cashBookPromise, categoriesPromise
      ]);

      setIncomes(incData);
      setOpeningBalanceState({
        incomeAmount: Number(obData.incomeAmount) || 0,
        expenseAmount: Number(obData.expenseAmount) || 0
      });
      setExpenses(expData);
      setSalaries(salData);
      setCashBook(cbData);
      setCategories(catData);

      if (silent) showToast('Financial dashboard refreshed!', 'success');
    } catch (e) {
      console.error(e);
      showToast('Failed to load accounting dashboard data.', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getAuthHeaders, showToast]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  /* ─── Computed Financial Metrics ─── */
  const metrics = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Helper filter by date
    const filterByTime = (itemDate) => {
      if (!itemDate || timeFilter === 'all') return true;
      const d = new Date(itemDate);
      if (isNaN(d.getTime())) return true;
      if (timeFilter === 'today') return d >= startOfDay;
      if (timeFilter === 'month') return d >= startOfMonth;
      return true;
    };

    const filteredIncomes = incomes.filter(i => filterByTime(i.createdAt || i.date));
    const filteredExpenses = expenses.filter(e => filterByTime(e.createdAt || e.date));
    const filteredSalaries = salaries.filter(s => filterByTime(s.createdAt || s.paymentDate || s.date));

    // Income sums
    const totalIncomeReceived = filteredIncomes.reduce((sum, item) => {
      const amt = Number(item.amount || item.incomeAmount || item.receivedAmount || 0);
      return sum + (isNaN(amt) ? 0 : amt);
    }, 0);

    const paidInvoicesCount = filteredIncomes.filter(i => (i.paymentStatus || i.status || '').toLowerCase() === 'paid').length;
    const unpaidIncomes = filteredIncomes.filter(i => (i.paymentStatus || i.status || '').toLowerCase() !== 'paid');
    const unpaidAmount = unpaidIncomes.reduce((sum, item) => sum + (Number(item.amount || 0) - Number(item.receivedAmount || 0)), 0);

    // Expense sums
    const approvedExpenses = filteredExpenses.filter(e => (e.status || 'approved').toLowerCase() === 'approved');
    const totalExpensesPaid = approvedExpenses.reduce((sum, item) => {
      const amt = Number(item.amount || 0);
      return sum + (isNaN(amt) ? 0 : amt);
    }, 0);

    const pendingExpenses = filteredExpenses.filter(e => (e.status || '').toLowerCase() === 'pending');
    const pendingExpenseAmount = pendingExpenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);

    // Salary sums
    const totalSalaryPaid = filteredSalaries.reduce((sum, item) => {
      const amt = Number(item.netSalary || item.amount || item.totalPaid || 0);
      return sum + (isNaN(amt) ? 0 : amt);
    }, 0);

    // Net Cash Balance Calculation
    const incOB = openingBalance.incomeAmount || 0;
    const expOB = openingBalance.expenseAmount || 0;
    const netOpeningBalance = incOB - expOB;
    
    const netCashInHand = netOpeningBalance + totalIncomeReceived - totalExpensesPaid - totalSalaryPaid;

    // Category Breakdown (Expenses)
    const categoryBreakdown = {};
    approvedExpenses.forEach(exp => {
      const catName = exp.category?.name || exp.categoryName || exp.category || 'General Expense';
      categoryBreakdown[catName] = (categoryBreakdown[catName] || 0) + Number(exp.amount || 0);
    });

    const categoryList = Object.entries(categoryBreakdown)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);

    return {
      totalIncomeReceived,
      incomeCount: filteredIncomes.length,
      paidInvoicesCount,
      unpaidIncomesCount: unpaidIncomes.length,
      unpaidAmount,
      totalExpensesPaid,
      expenseCount: approvedExpenses.length,
      pendingExpensesCount: pendingExpenses.length,
      pendingExpenseAmount,
      totalSalaryPaid,
      salaryCount: filteredSalaries.length,
      incOB,
      expOB,
      netOpeningBalance,
      netCashInHand,
      categoryList,
      filteredIncomes,
      filteredExpenses,
      filteredSalaries
    };
  }, [incomes, expenses, salaries, openingBalance, timeFilter]);

  /* ─── Loading Screen ─── */
  if (loading) {
    return (
      <div className="min-h-[75vh] flex flex-col items-center justify-center">
        <Loader2 className="animate-spin text-indigo-500 mb-4" size={42} />
        <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">Loading Accountant Financial Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 lg:p-8 bg-slate-50/50 dark:bg-slate-950/20 text-slate-800 dark:text-slate-100">
      <div className="max-w-[1600px] mx-auto space-y-6">

        {/* ─── Header ─── */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/50 dark:border-slate-800/50 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3.5 bg-gradient-to-br from-emerald-500 via-teal-600 to-indigo-600 text-white rounded-2xl shadow-lg shadow-emerald-500/30">
              <Wallet size={30} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[8px] font-black uppercase tracking-wider rounded-md">
                  Finance & Accounts Hub
                </span>
                <span className="w-1.5 h-1.5 bg-lime-500 rounded-full animate-pulse" />
                <span className="text-[9px] text-lime-500 font-bold uppercase">Live Ledger Sync</span>
              </div>
              <h1 className="text-2xl lg:text-3xl font-black tracking-tight bg-gradient-to-r from-slate-900 via-slate-700 to-slate-500 dark:from-white dark:via-slate-200 dark:to-slate-400 bg-clip-text text-transparent">
                Accountant Dashboard
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button onClick={() => fetchDashboardData(true)} disabled={refreshing}
              className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl transition-all disabled:opacity-50 cursor-pointer">
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button onClick={() => setIsCreatePayslipOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-500/20 transition-all cursor-pointer">
              <Receipt size={14} />
              Create Payslip
            </button>
            <button onClick={() => navigate('/accounts/create-invoice')}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition-all cursor-pointer">
              <Plus size={14} />
              Create Invoice
            </button>
            <button onClick={() => navigate('/accounts/expenses')}
              className="flex items-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-rose-500/20 transition-all cursor-pointer">
              <PlusCircle size={14} />
              Add Expense
            </button>
            <button onClick={() => navigate('/accounts/cash-book')}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-500/20 transition-all cursor-pointer">
              <BookCheck size={14} />
              Cash Book
            </button>
          </div>
        </div>

        {/* ─── Time Filter Selector ─── */}
        <div className="flex items-center justify-between gap-4 bg-white dark:bg-slate-900 p-2 px-4 rounded-2xl border border-slate-200/50 dark:border-slate-800/50 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
            <Calendar size={14} className="text-emerald-500" /> Timeframe Filter:
          </div>
          <div className="flex items-center gap-1.5">
            {[
              { id: 'all', label: 'All Time' },
              { id: 'month', label: 'This Month' },
              { id: 'today', label: 'Today' }
            ].map(tf => (
              <button
                key={tf.id}
                onClick={() => setTimeFilter(tf.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  timeFilter === tf.id
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>

        {/* ─── Primary Financial KPI Cards Grid ─── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

          {/* Net Cash Balance */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-emerald-500/15 via-teal-500/10 to-transparent border border-emerald-500/30 rounded-3xl p-5 relative overflow-hidden group shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="p-2.5 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl">
                <Wallet size={22} />
              </span>
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                Available Cash
              </span>
            </div>
            <div className="text-3xl font-black text-slate-900 dark:text-white font-mono leading-none">
              ₹{metrics.netCashInHand.toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-2 flex items-center justify-between">
              <span>Net Cash Balance</span>
              <span className="text-emerald-500 font-mono">OB: ₹{metrics.netOpeningBalance.toLocaleString('en-IN')}</span>
            </div>
          </motion.div>

          {/* Total Income Received */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="bg-gradient-to-br from-indigo-500/15 via-purple-500/10 to-transparent border border-indigo-500/30 rounded-3xl p-5 relative overflow-hidden group shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="p-2.5 bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-xl">
                <TrendingUp size={22} />
              </span>
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md">
                {metrics.incomeCount} Invoices
              </span>
            </div>
            <div className="text-3xl font-black text-slate-900 dark:text-white font-mono leading-none">
              ₹{metrics.totalIncomeReceived.toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-2 flex items-center justify-between">
              <span>Total Income Received</span>
              <span className="text-indigo-500 font-mono">{metrics.paidInvoicesCount} Paid</span>
            </div>
          </motion.div>

          {/* Total Expenses Paid */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="bg-gradient-to-br from-rose-500/15 via-amber-500/10 to-transparent border border-rose-500/30 rounded-3xl p-5 relative overflow-hidden group shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="p-2.5 bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl">
                <TrendingDown size={22} />
              </span>
              <span className="text-[10px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-md">
                {metrics.expenseCount} Approved
              </span>
            </div>
            <div className="text-3xl font-black text-slate-900 dark:text-white font-mono leading-none">
              ₹{metrics.totalExpensesPaid.toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-2 flex items-center justify-between">
              <span>Total Expenses Paid</span>
              <span className="text-amber-500 font-mono">{metrics.pendingExpensesCount} Pending</span>
            </div>
          </motion.div>

          {/* Total Salary Payouts */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className="bg-gradient-to-br from-violet-500/15 via-fuchsia-500/10 to-transparent border border-violet-500/30 rounded-3xl p-5 relative overflow-hidden group shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="p-2.5 bg-violet-500/20 text-violet-600 dark:text-violet-400 rounded-xl">
                <DollarSign size={22} />
              </span>
              <span className="text-[10px] font-black uppercase tracking-wider text-violet-600 dark:text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded-md">
                {metrics.salaryCount} Payslips
              </span>
            </div>
            <div className="text-3xl font-black text-slate-900 dark:text-white font-mono leading-none">
              ₹{metrics.totalSalaryPaid.toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-2 flex items-center justify-between">
              <span>Salary Payouts</span>
              <span className="text-violet-500 font-mono">Processed</span>
            </div>
          </motion.div>

        </div>

        {/* ─── Opening Balance & Expense Breakdown Grid ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Opening Balance Summary Card (1 col) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-2">
                  <span className="w-1 h-5 bg-emerald-500 rounded-full" />
                  Opening Balance Records
                </h3>
                <button
                  onClick={() => navigate('/accounts/cash-book')}
                  className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  Edit OB <ChevronRight size={12} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">Income Opening Balance</span>
                    <span className="text-xs text-slate-500">Initial reserve in hand</span>
                  </div>
                  <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                    ₹{metrics.incOB.toLocaleString('en-IN')}
                  </span>
                </div>

                <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-wider block">Expense Opening Balance</span>
                    <span className="text-xs text-slate-500">Initial liability reserve</span>
                  </div>
                  <span className="text-xl font-black text-rose-600 dark:text-rose-400 font-mono">
                    ₹{metrics.expOB.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Net Reserve Balance</span>
              <span className="text-sm font-black text-slate-900 dark:text-white font-mono">
                ₹{metrics.netOpeningBalance.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {/* Expense Category Breakdown (2 cols) */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50 rounded-3xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-2">
                <span className="w-1 h-5 bg-rose-500 rounded-full" />
                Expense Category Wise Distribution
              </h3>
              <button
                onClick={() => navigate('/accounts/categories')}
                className="text-[10px] font-bold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                Manage Categories <ChevronRight size={12} />
              </button>
            </div>

            {metrics.categoryList.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-10">No expense records found for the selected filter.</p>
            ) : (
              <div className="space-y-3.5">
                {metrics.categoryList.slice(0, 5).map((cat, idx) => {
                  const maxAmt = metrics.totalExpensesPaid || 1;
                  const pct = Math.round((cat.amount / maxAmt) * 100);
                  return (
                    <div key={cat.name}>
                      <div className="flex items-center justify-between text-xs mb-1 px-1">
                        <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-rose-500" />
                          {cat.name}
                        </span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white">
                          ₹{cat.amount.toLocaleString('en-IN')} <span className="text-slate-400 font-normal text-[10px]">({pct}%)</span>
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-800 h-4.5 rounded-lg overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.max(pct, 2)}%` }}
                          transition={{ duration: 0.7, delay: idx * 0.08 }}
                          className="h-full bg-gradient-to-r from-rose-500 via-amber-500 to-orange-400 rounded-lg"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* ─── Financial Transaction Ledgers (Tabbed Section) ─── */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50 rounded-3xl p-6 shadow-sm">

          {/* Ledger Tab Switcher Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-2">
              <span className="w-1.5 h-5 bg-indigo-500 rounded-full" />
              Financial Transaction Ledger
            </h3>

            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl overflow-x-auto">
              <button
                onClick={() => setActiveLedgerTab('income')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                  activeLedgerTab === 'income'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <TrendingUp size={13} />
                Incomes ({metrics.filteredIncomes.length})
              </button>

              <button
                onClick={() => setActiveLedgerTab('expenses')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                  activeLedgerTab === 'expenses'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <TrendingDown size={13} />
                Expenses ({metrics.filteredExpenses.length})
              </button>

              <button
                onClick={() => setActiveLedgerTab('salaries')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                  activeLedgerTab === 'salaries'
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <DollarSign size={13} />
                Salaries ({metrics.filteredSalaries.length})
              </button>

              <button
                onClick={() => setActiveLedgerTab('cashbook')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                  activeLedgerTab === 'cashbook'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <BookCheck size={13} />
                Cash Book ({cashBook.length})
              </button>
            </div>
          </div>

          {/* Tab 1: Income Ledger Table */}
          {activeLedgerTab === 'income' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200/60 dark:border-slate-800">
                    <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Customer / Client</th>
                    <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Invoice No</th>
                    <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Category</th>
                    <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Amount</th>
                    <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Status</th>
                    <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {metrics.filteredIncomes.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-xs text-slate-400">No income records found.</td>
                    </tr>
                  ) : (
                    metrics.filteredIncomes.slice(0, 10).map((inc, i) => {
                      const clientName = inc.customerName || inc.clientName || inc.name || 'Client';
                      const invNum = inc.invoiceNumber || inc.invoiceNo || `#INV-${1000 + i}`;
                      const amt = Number(inc.amount || inc.incomeAmount || 0);
                      const status = (inc.paymentStatus || inc.status || 'Paid').toUpperCase();
                      const isPaid = status === 'PAID';
                      return (
                        <tr key={inc._id || i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition">
                          <td className="px-5 py-3.5">
                            <span className="text-xs font-bold text-slate-800 dark:text-white block">{clientName}</span>
                            {inc.particulars && <span className="text-[10px] text-slate-400">{inc.particulars}</span>}
                          </td>
                          <td className="px-5 py-3.5 text-xs font-mono font-semibold text-indigo-600 dark:text-indigo-400">{invNum}</td>
                          <td className="px-5 py-3.5 text-xs text-slate-600 dark:text-slate-400">{inc.category || 'Sales Income'}</td>
                          <td className="px-5 py-3.5 text-xs font-mono font-black text-emerald-600 dark:text-emerald-400">₹{amt.toLocaleString('en-IN')}</td>
                          <td className="px-5 py-3.5">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              isPaid ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                            }`}>
                              {status}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-[10px] text-slate-500">
                            {inc.createdAt || inc.date ? new Date(inc.createdAt || inc.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Tab 2: Expense Ledger Table */}
          {activeLedgerTab === 'expenses' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200/60 dark:border-slate-800">
                    <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Category</th>
                    <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Particulars / Payee</th>
                    <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Amount</th>
                    <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Approval Status</th>
                    <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {metrics.filteredExpenses.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-xs text-slate-400">No expense records found.</td>
                    </tr>
                  ) : (
                    metrics.filteredExpenses.slice(0, 10).map((exp, i) => {
                      const catName = exp.category?.name || exp.categoryName || exp.category || 'General';
                      const amt = Number(exp.amount || 0);
                      const status = (exp.status || 'Approved').toUpperCase();
                      return (
                        <tr key={exp._id || i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition">
                          <td className="px-5 py-3.5">
                            <span className="text-xs font-bold text-slate-800 dark:text-white block">{catName}</span>
                          </td>
                          <td className="px-5 py-3.5 text-xs text-slate-600 dark:text-slate-400">{exp.particulars || exp.description || exp.payee || 'Expense entry'}</td>
                          <td className="px-5 py-3.5 text-xs font-mono font-black text-rose-600 dark:text-rose-400">₹{amt.toLocaleString('en-IN')}</td>
                          <td className="px-5 py-3.5">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' :
                              status === 'PENDING' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400' :
                              'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'
                            }`}>
                              {status}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-[10px] text-slate-500">
                            {exp.createdAt || exp.date ? new Date(exp.createdAt || exp.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Tab 3: Salary Payouts Table */}
          {activeLedgerTab === 'salaries' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200/60 dark:border-slate-800">
                    <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Employee Name</th>
                    <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Designation / Dept</th>
                    <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Month / Period</th>
                    <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Net Salary Paid</th>
                    <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {metrics.filteredSalaries.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-xs text-slate-400">No salary payment records found.</td>
                    </tr>
                  ) : (
                    metrics.filteredSalaries.slice(0, 10).map((sal, i) => {
                      const empName = sal.user?.name || sal.employeeName || sal.name || 'Staff Member';
                      const dept = sal.user?.department || sal.department || 'Payroll';
                      const period = sal.month || sal.payPeriod || 'Monthly Salary';
                      const amt = Number(sal.netSalary || sal.amount || 0);
                      return (
                        <tr key={sal._id || i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition">
                          <td className="px-5 py-3.5">
                            <span className="text-xs font-bold text-slate-800 dark:text-white block">{empName}</span>
                          </td>
                          <td className="px-5 py-3.5 text-xs text-slate-600 dark:text-slate-400">{dept}</td>
                          <td className="px-5 py-3.5 text-xs font-semibold text-slate-600 dark:text-slate-400">{period}</td>
                          <td className="px-5 py-3.5 text-xs font-mono font-black text-violet-600 dark:text-violet-400">₹{amt.toLocaleString('en-IN')}</td>
                          <td className="px-5 py-3.5 text-[10px] text-slate-500">
                            {sal.createdAt || sal.paymentDate || sal.date ? new Date(sal.createdAt || sal.paymentDate || sal.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Tab 4: Cash Book Entries Table */}
          {activeLedgerTab === 'cashbook' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200/60 dark:border-slate-800">
                    <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Date</th>
                    <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Particulars / Description</th>
                    <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 text-right">Cash In (Income)</th>
                    <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 text-right">Cash Out (Expense)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {cashBook.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-8 text-xs text-slate-400">No cash book ledger entries found.</td>
                    </tr>
                  ) : (
                    cashBook.slice(0, 10).map((cb, i) => {
                      const cashIn = Number(cb.cashIn || cb.incomeAmount || 0);
                      const cashOut = Number(cb.cashOut || cb.expenseAmount || 0);
                      return (
                        <tr key={cb._id || i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition">
                          <td className="px-5 py-3.5 text-xs text-slate-500 font-mono">
                            {cb.date || cb.createdAt ? new Date(cb.date || cb.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                          </td>
                          <td className="px-5 py-3.5 text-xs font-semibold text-slate-800 dark:text-white">
                            {cb.particulars || cb.description || 'Cash Book Entry'}
                          </td>
                          <td className="px-5 py-3.5 text-xs font-mono font-black text-emerald-600 dark:text-emerald-400 text-right">
                            {cashIn > 0 ? `₹${cashIn.toLocaleString('en-IN')}` : '—'}
                          </td>
                          <td className="px-5 py-3.5 text-xs font-mono font-black text-rose-600 dark:text-rose-400 text-right">
                            {cashOut > 0 ? `₹${cashOut.toLocaleString('en-IN')}` : '—'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

        </div>

        {/* ─── Financial Module Shortcuts Grid ─── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <ShortcutCard icon={<TrendingUp size={20} />} title="Sales Invoices" path="/accounts/sales" color="emerald" navigate={navigate} />
          <ShortcutCard icon={<ShoppingBag size={20} />} title="Income Received" path="/accounts/income" color="indigo" />
          <ShortcutCard icon={<ShoppingCart size={20} />} title="Purchase Entries" path="/accounts/purchase" color="purple" navigate={navigate} />
          <ShortcutCard icon={<PlusCircle size={20} />} title="Expense Manager" path="/accounts/expenses" color="rose" navigate={navigate} />
          <ShortcutCard icon={<DollarSign size={20} />} title="Salary Payments" path="/accounts/salary" color="violet" navigate={navigate} />
          <ShortcutCard icon={<Calculator size={20} />} title="Accountant Report" path="/accountant-report" color="sky" navigate={navigate} />
        </div>

        {/* CREATE PAYSLIP MODAL */}
        <CreatePayslipModal
          isOpen={isCreatePayslipOpen}
          onClose={() => setIsCreatePayslipOpen(false)}
          onSuccess={() => fetchDashboardData(true)}
        />
      </div>
    </div>
  );
};

/* ─── Shortcut Card Component ─── */
const ShortcutCard = ({ icon, title, path, color, navigate }) => {
  return (
    <button
      onClick={() => navigate(path)}
      className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-4 text-left hover:border-indigo-500/50 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
    >
      <div className="p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl w-fit group-hover:bg-indigo-600 group-hover:text-white transition-colors">
        {icon}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{title}</span>
        <ChevronRight size={14} className="text-slate-400 group-hover:translate-x-0.5 transition-transform" />
      </div>
    </button>
  );
};

export default AccountantDashboard;
