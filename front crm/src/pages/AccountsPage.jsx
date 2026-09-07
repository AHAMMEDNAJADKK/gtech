import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Tag, PlusCircle, DollarSign, BookOpen, BarChart3, Wallet, TrendingUp, FileText, ShoppingBag, ShoppingCart, Coins, Layers } from 'lucide-react';

import AddExpenseTab from '../components/accounts/AddExpenseTab';
import SalaryPaymentTab from '../components/accounts/SalaryPaymentTab';
import CashBookTab from '../components/accounts/CashBookTab';
import ExpenseReportsTab from '../components/accounts/ExpenseReportsTab';
import IncomeTab from '../components/accounts/IncomeTab';
import CreateInvoiceTab from '../components/accounts/CreateInvoiceTab';
import SalesTab from '../components/accounts/SalesTab';
import PurchaseTab from '../components/accounts/PurchaseTab';
import CapitalTab from '../components/accounts/CapitalTab';
import OperationTab from '../components/accounts/OperationTab';
import LedgerTab from '../components/accounts/LedgerTab';

const AccountsPage = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Determine active tab based on current pathname
  const getTabFromPath = (path) => {
    if (path.includes('/accounts/create-invoice')) return 'create-invoice';
    if (path.includes('/accounts/income') || path === '/income') return 'income';
    if (path.includes('/accounts/proforma')) return 'proforma';
    if (path.includes('/accounts/sales')) return 'sales';
    if (path.includes('/accounts/ledger') || path === '/ledger') return 'ledger';
    if (path.includes('/accounts/capital') || path === '/capital') return 'capital';
    if (path.includes('/accounts/purchase')) return 'purchase';
    if (path.includes('/accounts/categories') || path.includes('/accounts/expenses')) return 'expenses';
    if (path.includes('/accounts/salary')) return 'salary';
    if (path.includes('/accounts/cash-book')) return 'cash-book';
    if (path.includes('/accounts/operation')) return 'operation';
    if (path.includes('/accounts/reports')) return 'reports';
    return 'cash-book'; // Default tab
  };

  const [activeTab, setActiveTab] = useState(() => getTabFromPath(location.pathname));

  useEffect(() => {
    setActiveTab(getTabFromPath(location.pathname));
  }, [location.pathname]);

  const handleTabChange = (tabId, path) => {
    setActiveTab(tabId);
    navigate(path);
  };

  return (
    <div className="space-y-4">
      {/* Sleek Minimal Header Navbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 rounded-2xl p-2.5 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 pl-1">
          <div className="w-8 h-8 rounded-xl bg-indigo-600/10 dark:bg-indigo-400/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Wallet className="w-4 h-4" />
          </div>
          <h1 className="text-sm font-black text-slate-900 dark:text-white tracking-tight shrink-0">
            Accounts
          </h1>
        </div>

        {/* Compact Navigation Tabs Bar */}
        <div className="flex items-center gap-1 overflow-x-auto w-full md:w-auto scrollbar-none">
          <button
            onClick={() => handleTabChange('capital', '/accounts/capital')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              activeTab === 'capital'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <Coins size={14} />
            <span>Capital</span>
          </button>

          <button
            onClick={() => handleTabChange('sales', '/accounts/sales')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              activeTab === 'sales'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <TrendingUp size={14} />
            <span>Sales</span>
          </button>

          <button
            onClick={() => handleTabChange('proforma', '/accounts/proforma')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              activeTab === 'proforma'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <FileText size={14} />
            <span>Proforma</span>
          </button>

          <button
            onClick={() => handleTabChange('income', '/accounts/income')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              activeTab === 'income'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <ShoppingBag size={14} />
            <span>Income</span>
          </button>

          <button
            onClick={() => handleTabChange('ledger', '/accounts/ledger')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              activeTab === 'ledger'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <BookOpen size={14} />
            <span>Ledger</span>
          </button>

          <button
            onClick={() => handleTabChange('purchase', '/accounts/purchase')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              activeTab === 'purchase'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <ShoppingCart size={14} />
            <span>Purchase</span>
          </button>

          <button
            onClick={() => handleTabChange('expenses', '/accounts/expenses')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              activeTab === 'expenses'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <PlusCircle size={14} />
            <span>Expense</span>
          </button>

          <button
            onClick={() => handleTabChange('salary', '/accounts/salary')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              activeTab === 'salary'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <DollarSign size={14} />
            <span>Salary Payment</span>
          </button>

          <button
            onClick={() => handleTabChange('cash-book', '/accounts/cash-book')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              activeTab === 'cash-book'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <BookOpen size={14} />
            <span>Cash & Bank</span>
          </button>

          <button
            onClick={() => handleTabChange('operation', '/accounts/operation')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              activeTab === 'operation'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <Layers size={14} />
            <span>Operation</span>
          </button>

          <button
            onClick={() => handleTabChange('reports', '/accounts/reports')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              activeTab === 'reports'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <BarChart3 size={14} />
            <span>Profit and Loss</span>
          </button>
        </div>
      </div>

      {/* Main Tab View */}
      <div className="transition-all duration-300">
        {activeTab === 'create-invoice' && <CreateInvoiceTab />}
        {activeTab === 'sales' && <IncomeTab mode="sales" />}
        {activeTab === 'proforma' && <IncomeTab mode="proforma" />}
        {activeTab === 'capital' && <CapitalTab />}
        {activeTab === 'income' && <IncomeTab mode="income" />}
        {activeTab === 'ledger' && <LedgerTab />}
        {activeTab === 'purchase' && <PurchaseTab />}
        {activeTab === 'expenses' && <AddExpenseTab />}
        {activeTab === 'salary' && <SalaryPaymentTab />}
        {activeTab === 'cash-book' && <CashBookTab />}
        {activeTab === 'operation' && <OperationTab />}
        {activeTab === 'reports' && <ExpenseReportsTab />}
      </div>
    </div>
  );
};

export default AccountsPage;
