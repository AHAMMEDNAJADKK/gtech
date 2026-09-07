import React, { useState, useEffect, useMemo } from 'react';
import { getCashBook, getExpenseCategories, getOpeningBalance, setOpeningBalance as saveOpeningBalanceApi } from '../../services/accountsService';
import { 
  BookOpen, 
  ArrowDownLeft,
  ArrowUpRight, 
  RefreshCw, 
  FileSpreadsheet, 
  FileText, 
  Wallet, 
  CreditCard, 
  Search, 
  Filter, 
  Loader2, 
  TrendingUp, 
  TrendingDown, 
  Coins, 
  ShoppingCart, 
  DollarSign, 
  PlusCircle, 
  X,
  Calendar,
  ArrowUpDown,
  Layers
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const MONTH_OPTIONS = [
  { value: 'ALL', label: 'All Months' },
  { value: '1', label: 'January' },
  { value: '2', label: 'February' },
  { value: '3', label: 'March' },
  { value: '4', label: 'April' },
  { value: '5', label: 'May' },
  { value: '6', label: 'June' },
  { value: '7', label: 'July' },
  { value: '8', label: 'August' },
  { value: '9', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
  { value: 'CUSTOM', label: 'Custom Range' }
];

const YEAR_OPTIONS = [2024, 2025, 2026, 2027];

const CashBookTab = () => {
  const [cashBookData, setCashBookData] = useState([]);
  const [categories, setCategories] = useState([]);
  const [summary, setSummary] = useState({ 
    incomeOpeningBalance: 0, 
    baseExpenseOpeningBalance: 0,
    categoryOpeningBalance: 0,
    expenseOpeningBalance: 0, 
    totalIncome: 0, 
    effectiveTotalIncome: 0, 
    totalGeneralExpense: 0, 
    totalPurchase: 0, 
    totalExpense: 0, 
    effectiveTotalOutflow: 0, 
    netBalance: 0, 
    closingBalance: 0, 
    totalEntries: 0 
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Month-wise Filtering & Sorting States
  const [selectedMonth, setSelectedMonth] = useState('ALL');
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear().toString());
  const [activePreset, setActivePreset] = useState('ALL'); // 'ALL', 'THIS_MONTH', 'LAST_MONTH', 'LAST_3_MONTHS', 'CUSTOM'
  const [groupByMonth, setGroupByMonth] = useState(true);

  // Filters & Sorting
  const [entryTypeFilter, setEntryTypeFilter] = useState(''); // '' (All), 'INCOME', 'EXPENSE', 'PURCHASE'
  const [filterType, setFilterType] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterMode, setFilterMode] = useState('');
  const [sortBy, setSortBy] = useState('date-desc');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const handleSelectMonth = (monthVal, yearVal = selectedYear) => {
    setSelectedMonth(monthVal);
    setSelectedYear(yearVal);
    setActivePreset(monthVal === 'ALL' ? 'ALL' : (monthVal === 'CUSTOM' ? 'CUSTOM' : 'MONTH_PICK'));
    if (monthVal === 'ALL') {
      setStartDate('');
      setEndDate('');
    } else if (monthVal !== 'CUSTOM') {
      const m = parseInt(monthVal, 10);
      const y = parseInt(yearVal, 10);
      const s = `${y}-${String(m).padStart(2, '0')}-01`;
      const lastDay = new Date(y, m, 0).getDate();
      const e = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      setStartDate(s);
      setEndDate(e);
    }
  };

  const handleApplyPreset = (preset) => {
    setActivePreset(preset);
    const now = new Date();
    if (preset === 'ALL') {
      setSelectedMonth('ALL');
      setStartDate('');
      setEndDate('');
    } else if (preset === 'THIS_MONTH') {
      const m = now.getMonth() + 1;
      const y = now.getFullYear();
      setSelectedMonth(String(m));
      setSelectedYear(String(y));
      const s = `${y}-${String(m).padStart(2, '0')}-01`;
      const lastDay = new Date(y, m, 0).getDate();
      const e = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      setStartDate(s);
      setEndDate(e);
    } else if (preset === 'LAST_MONTH') {
      const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const m = prevDate.getMonth() + 1;
      const y = prevDate.getFullYear();
      setSelectedMonth(String(m));
      setSelectedYear(String(y));
      const s = `${y}-${String(m).padStart(2, '0')}-01`;
      const lastDay = new Date(y, m, 0).getDate();
      const e = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      setStartDate(s);
      setEndDate(e);
    } else if (preset === 'LAST_3_MONTHS') {
      setSelectedMonth('CUSTOM');
      const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      const s = `${threeMonthsAgo.getFullYear()}-${String(threeMonthsAgo.getMonth() + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const e = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      setStartDate(s);
      setEndDate(e);
    }
  };

  const fetchCashBook = async () => {
    setLoading(true);
    setError('');
    try {
      const [cashRes, catRes] = await Promise.all([
        getCashBook({ entryType: entryTypeFilter === 'PURCHASE' ? 'PURCHASE' : entryTypeFilter, type: filterType, category: filterCategory, paymentMode: filterMode, startDate, endDate }),
        getExpenseCategories()
      ]);

      let backendEntries = cashRes.success ? (cashRes.data || []) : [];

      // Merge local purchases from crm_purchase_records if available
      try {
        const localPurchasesRaw = JSON.parse(localStorage.getItem('crm_purchase_records') || '[]');
        if (localPurchasesRaw.length > 0) {
          const formattedLocalPurchases = localPurchasesRaw.map(p => ({
            _id: p._id || p.id,
            entryType: 'EXPENSE',
            isPurchase: true,
            type: 'Purchase',
            categoryName: 'Inventory & Purchase',
            paidTo: p.paidTo || p.vendorName || 'N/A',
            paymentMode: p.paymentMode || p.paymentMethod || 'Cash',
            amount: p.amount || 0,
            date: p.date || p.purchaseDate || p.createdAt,
            referenceNo: p.billNo || p.referenceNo || 'PUR-LOCAL',
            description: p.description || p.itemName || p.remarks || ''
          }));

          const existingIds = new Set(backendEntries.map(e => String(e._id)));
          formattedLocalPurchases.forEach(p => {
            if (!existingIds.has(String(p._id))) {
              backendEntries.push(p);
            }
          });
        }
      } catch (localErr) {
        console.warn('Error reading local purchase records:', localErr);
      }

      // Merge local capital records from crm_capital_records if available
      try {
        const localCapitalRaw = JSON.parse(localStorage.getItem('crm_capital_records') || '[]');
        if (localCapitalRaw.length > 0) {
          const formattedCapital = localCapitalRaw.map(c => ({
            _id: c._id || c.id,
            entryType: 'INCOME',
            isCapital: true,
            type: 'Capital Inflow',
            categoryName: 'Capital Contribution',
            paidTo: c.investorName || 'Investor / Contributor',
            paymentMode: c.paymentMethod || 'Bank Transfer',
            amount: Number(c.totalCapital || 0) || (Number(c.amount || 0) + Number(c.openingBalance || 0)),
            date: c.date || c.createdAt,
            referenceNo: c.voucherNo || c.referenceNo || 'CAP-LOCAL',
            description: `Capital Contribution: ${c.remarks || ''}`
          }));

          const existingIds = new Set(backendEntries.map(e => String(e._id)));
          formattedCapital.forEach(c => {
            if (!existingIds.has(String(c._id))) {
              backendEntries.push(c);
            }
          });
        }
      } catch (capErr) {
        console.warn('Error reading local capital records:', capErr);
      }

      // Sort combined entries by date descending
      backendEntries.sort((a, b) => new Date(b.date) - new Date(a.date));

      setCashBookData(backendEntries);

      // Compute summary metrics
      const incOb = (cashRes.success && cashRes.summary && typeof cashRes.summary.incomeOpeningBalance === 'number')
        ? cashRes.summary.incomeOpeningBalance
        : (cashRes.success && cashRes.summary && typeof cashRes.summary.openingBalance === 'number' ? cashRes.summary.openingBalance : 0);

      const categoryObTotal = (catRes.success && Array.isArray(catRes.data))
        ? catRes.data.reduce((s, c) => s + (Number(c.openingBalance) || 0), 0)
        : (cashRes.summary?.categoryOpeningBalance || 0);

      const baseExpOb = (cashRes.success && cashRes.summary && typeof cashRes.summary.baseExpenseOpeningBalance === 'number')
        ? cashRes.summary.baseExpenseOpeningBalance
        : (cashRes.success && cashRes.summary && typeof cashRes.summary.expenseOpeningBalance === 'number'
            ? Math.max(0, cashRes.summary.expenseOpeningBalance - categoryObTotal)
            : 0);

      // The categories OB is added to the expense OB in cashbook
      const expOb = (cashRes.success && cashRes.summary && typeof cashRes.summary.expenseOpeningBalance === 'number')
        ? cashRes.summary.expenseOpeningBalance
        : (baseExpOb + categoryObTotal);

      const totInc = backendEntries.filter(e => e.entryType === 'INCOME').reduce((s, i) => s + (i.amount || 0), 0);
      const totPur = backendEntries.filter(e => e.entryType === 'EXPENSE' && (e.isPurchase || (e.categoryName || '').toLowerCase().includes('purchase') || e.type === 'Purchase')).reduce((s, i) => s + (i.amount || 0), 0);
      const totGenExp = backendEntries.filter(e => e.entryType === 'EXPENSE' && !e.isPurchase && !(e.categoryName || '').toLowerCase().includes('purchase') && e.type !== 'Purchase').reduce((s, i) => s + (i.amount || 0), 0);
      const totOutflow = totGenExp + totPur;
      
      const effInc = incOb + totInc;
      const effExp = expOb + totOutflow;
      const netBal = totInc - totOutflow;
      const closeBal = effInc - effExp;

      setSummary({
        incomeOpeningBalance: incOb,
        baseExpenseOpeningBalance: baseExpOb,
        categoryOpeningBalance: categoryObTotal,
        expenseOpeningBalance: expOb,
        totalIncome: totInc,
        effectiveTotalIncome: effInc,
        totalGeneralExpense: totGenExp,
        totalPurchase: totPur,
        totalExpense: totOutflow,
        effectiveTotalOutflow: effExp,
        netBalance: netBal,
        closingBalance: closeBal,
        totalEntries: backendEntries.length
      });

      if (catRes.success) {
        setCategories(catRes.data || []);
      }
    } catch (err) {
      console.error('Cash book error:', err);
      setError('Failed to load cash book entries.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCashBook();
  }, [entryTypeFilter, filterType, filterCategory, filterMode, startDate, endDate]);

  // Client-side search & sorting logic
  const filteredAndSortedData = useMemo(() => {
    let data = [...cashBookData];

    if (entryTypeFilter === 'PURCHASE') {
      data = data.filter(item => item.isPurchase || (item.categoryName || '').toLowerCase().includes('purchase') || item.type === 'Purchase');
    } else if (entryTypeFilter === 'INCOME') {
      data = data.filter(item => item.entryType === 'INCOME');
    } else if (entryTypeFilter === 'EXPENSE') {
      data = data.filter(item => item.entryType === 'EXPENSE' && !item.isPurchase && !(item.categoryName || '').toLowerCase().includes('purchase'));
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      data = data.filter(item => 
        (item.paidTo || '').toLowerCase().includes(q) ||
        (item.description || '').toLowerCase().includes(q) ||
        (item.type || '').toLowerCase().includes(q) ||
        (item.categoryName || '').toLowerCase().includes(q) ||
        (item.entryType || '').toLowerCase().includes(q)
      );
    }

    if (sortBy === 'date-desc') {
      data.sort((a, b) => new Date(b.date) - new Date(a.date));
    } else if (sortBy === 'date-asc') {
      data.sort((a, b) => new Date(a.date) - new Date(b.date));
    } else if (sortBy === 'amount-desc') {
      data.sort((a, b) => (b.amount || 0) - (a.amount || 0));
    } else if (sortBy === 'amount-asc') {
      data.sort((a, b) => (a.amount || 0) - (b.amount || 0));
    } else if (sortBy === 'income-first') {
      data.sort((a, b) => {
        if (a.entryType === b.entryType) return new Date(b.date) - new Date(a.date);
        return a.entryType === 'INCOME' ? -1 : 1;
      });
    } else if (sortBy === 'expense-first') {
      data.sort((a, b) => {
        if (a.entryType === b.entryType) return new Date(b.date) - new Date(a.date);
        return a.entryType === 'EXPENSE' ? -1 : 1;
      });
    }
    return data;
  }, [cashBookData, entryTypeFilter, searchTerm, sortBy]);

  // Group entries by month for Month-wise view
  const groupedByMonth = useMemo(() => {
    const groupMap = new Map();

    filteredAndSortedData.forEach((item) => {
      const d = new Date(item.date);
      const y = isNaN(d.getTime()) ? 2026 : d.getFullYear();
      const m = isNaN(d.getTime()) ? 0 : d.getMonth();
      const key = `${y}-${String(m + 1).padStart(2, '0')}`;
      const label = isNaN(d.getTime()) ? 'Unknown Period' : d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

      if (!groupMap.has(key)) {
        groupMap.set(key, {
          key,
          label,
          year: y,
          month: m,
          items: [],
          totalInflow: 0,
          totalOutflow: 0,
          net: 0
        });
      }

      const grp = groupMap.get(key);
      grp.items.push(item);
      if (item.entryType === 'INCOME') {
        grp.totalInflow += (item.amount || 0);
      } else {
        grp.totalOutflow += (item.amount || 0);
      }
      grp.net = grp.totalInflow - grp.totalOutflow;
    });

    const groups = Array.from(groupMap.values());
    if (sortBy === 'date-asc') {
      groups.sort((a, b) => a.key.localeCompare(b.key));
    } else {
      groups.sort((a, b) => b.key.localeCompare(a.key));
    }

    return groups;
  }, [filteredAndSortedData, sortBy]);

  // Export to Excel
  const handleExportExcel = () => {
    if (filteredAndSortedData.length === 0) {
      alert('No cash book records to export.');
      return;
    }

    const exportData = filteredAndSortedData.map((item, idx) => ({
      'S.No': idx + 1,
      'Date': new Date(item.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      'Entry Type': item.entryType === 'INCOME' ? 'INCOME (INFLOW)' : (item.isPurchase ? 'PURCHASE (PROCUREMENT)' : 'EXPENSE (OUTFLOW)'),
      'Category / Dept': item.categoryName || 'General',
      'Party / Vendor / Source': item.paidTo || 'N/A',
      'Payment Mode': item.paymentMode || 'Cash',
      'Inflow Amount (INR)': item.entryType === 'INCOME' ? (item.amount || 0) : 0,
      'Outflow Amount (INR)': item.entryType === 'EXPENSE' ? (item.amount || 0) : 0,
      'Description / Notes': item.description || ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Cash Book Income Expense Purchase');

    worksheet['!cols'] = [
      { wch: 6 },
      { wch: 15 },
      { wch: 24 },
      { wch: 22 },
      { wch: 28 },
      { wch: 15 },
      { wch: 18 },
      { wch: 18 },
      { wch: 35 }
    ];

    XLSX.writeFile(workbook, `Cash_Book_Ledger_Profit_Loss_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Export to PDF
  const handleExportPDF = () => {
    if (filteredAndSortedData.length === 0) {
      alert('No cash book records to export.');
      return;
    }

    const doc = new jsPDF('p', 'pt', 'a4');

    doc.setFontSize(15);
    doc.setTextColor(30, 41, 59);
    doc.text('CASH BOOK LEDGER & PROFIT AND LOSS STATEMENT', 40, 40);

    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated on: ${new Date().toLocaleString('en-IN')}`, 40, 55);
    doc.text(`Total Income: RS. ${(summary.totalIncome || 0).toLocaleString('en-IN')} | General Expense: RS. ${(summary.totalGeneralExpense || 0).toLocaleString('en-IN')} | Purchases: RS. ${(summary.totalPurchase || 0).toLocaleString('en-IN')} | Net Profit/Loss: RS. ${(summary.netBalance || 0).toLocaleString('en-IN')}`, 40, 68);

    const tableRows = filteredAndSortedData.map((item, idx) => [
      idx + 1,
      new Date(item.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      item.entryType === 'INCOME' ? 'INCOME' : (item.isPurchase ? 'PURCHASE' : 'EXPENSE'),
      item.categoryName || 'General',
      item.paidTo || 'N/A',
      item.paymentMode || 'Cash',
      item.entryType === 'INCOME' ? `+ RS. ${(item.amount || 0).toLocaleString('en-IN')}` : '-',
      item.entryType === 'EXPENSE' ? `- RS. ${(item.amount || 0).toLocaleString('en-IN')}` : '-'
    ]);

    autoTable(doc, {
      startY: 85,
      head: [['#', 'Date', 'Type', 'Category / Dept', 'Party / Source', 'Mode', 'Inflow (₹)', 'Outflow (₹)']],
      body: tableRows,
      theme: 'grid',
      headStyles: {
        fillColor: [79, 70, 229],
        textColor: [255, 255, 255],
        fontSize: 9,
        fontStyle: 'bold'
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [51, 65, 85]
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 65 },
        2: { cellWidth: 60 },
        3: { cellWidth: 85 },
        4: { cellWidth: 120 },
        5: { cellWidth: 55 },
        6: { cellWidth: 65, halign: 'right' },
        7: { cellWidth: 65, halign: 'right' }
      }
    });

    doc.save(`Cash_Book_Profit_Loss_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="space-y-4">
      {/* Month-Wise Sorting & Period Filter Bar at the Top */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3 sm:p-3.5 shadow-xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
        {/* Left: Quick Month Presets & Month/Year Selectors */}
        <div className="flex items-center gap-2 flex-wrap w-full lg:w-auto">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 pr-1">
            <Calendar size={15} className="text-indigo-600 dark:text-indigo-400" />
            <span className="hidden sm:inline">Period:</span>
          </div>

          {/* Preset Buttons */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => handleApplyPreset('ALL')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                activePreset === 'ALL'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              All Time
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset('THIS_MONTH')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                activePreset === 'THIS_MONTH'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              This Month
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset('LAST_MONTH')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                activePreset === 'LAST_MONTH'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Last Month
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset('LAST_3_MONTHS')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer hidden md:inline-block ${
                activePreset === 'LAST_3_MONTHS'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Last 3 Months
            </button>
          </div>

          <div className="h-4 w-px bg-slate-200 dark:border-slate-800 mx-0.5 hidden sm:block" />

          {/* Month Selector Dropdown */}
          <select
            value={selectedMonth}
            onChange={(e) => handleSelectMonth(e.target.value, selectedYear)}
            className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 cursor-pointer"
          >
            {MONTH_OPTIONS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>

          {/* Year Selector Dropdown */}
          <select
            value={selectedYear}
            onChange={(e) => handleSelectMonth(selectedMonth, e.target.value)}
            disabled={selectedMonth === 'ALL' || selectedMonth === 'CUSTOM'}
            className={`px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 cursor-pointer ${
              (selectedMonth === 'ALL' || selectedMonth === 'CUSTOM') ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {YEAR_OPTIONS.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        {/* Right: Sorting & Grouping Controls */}
        <div className="flex items-center gap-2 flex-wrap w-full lg:w-auto justify-start lg:justify-end">
          {/* Sorting Dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <ArrowUpDown size={13} className="text-indigo-600 dark:text-indigo-400" />
              <span>Sort:</span>
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 cursor-pointer"
            >
              <option value="date-desc">📅 Month: Newest First</option>
              <option value="date-asc">📅 Month: Oldest First</option>
              <option value="amount-desc">💰 Highest Amount First</option>
              <option value="amount-asc">💰 Lowest Amount First</option>
              <option value="income-first">🟢 Income (Inflow) First</option>
              <option value="expense-first">🔴 Expense (Outflow) First</option>
            </select>
          </div>

          {/* Group By Month Toggle Button */}
          <button
            type="button"
            onClick={() => setGroupByMonth(!groupByMonth)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
              groupByMonth
                ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300'
                : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
            title="Toggle grouping ledger entries with month headers and monthly net totals"
          >
            <Layers size={13} />
            <span>Group by Month</span>
            <span className={`w-1.5 h-1.5 rounded-full ${groupByMonth ? 'bg-indigo-600 dark:bg-indigo-400' : 'bg-slate-300 dark:bg-slate-600'}`} />
          </button>
        </div>
      </div>

      {/* Sleek 5-Column Stats Strip with Income & Expense Opening Balances */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Income Opening Balance Stat Card */}
        <div className="bg-white dark:bg-slate-900 border border-emerald-500/20 dark:border-emerald-500/30 rounded-2xl p-3 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Income Opening</p>
            <h3 className="text-base font-black text-emerald-600 dark:text-emerald-400 mt-0.5 font-mono">
              ₹{(summary.incomeOpeningBalance || 0).toLocaleString('en-IN')}
            </h3>
            <p className="text-[9px] text-slate-400">Brought Forward</p>
          </div>
          <div className="p-2 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 rounded-xl shrink-0">
            <Coins size={16} />
          </div>
        </div>

        {/* Total Income Received (Including Opening Balance) Stat Card */}
        <div className="bg-white dark:bg-slate-900 border border-emerald-500/20 dark:border-emerald-500/30 rounded-2xl p-3 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Total Income Received</p>
            <h3 className="text-base font-black text-emerald-600 dark:text-emerald-400 mt-0.5 font-mono">
              +₹{(summary.effectiveTotalIncome || ((summary.incomeOpeningBalance || 0) + (summary.totalIncome || 0))).toLocaleString('en-IN')}
            </h3>
            <p className="text-[9px] text-slate-400">Inc. OB ₹{(summary.incomeOpeningBalance || 0).toLocaleString('en-IN')}</p>
          </div>
          <div className="p-2 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 rounded-xl shrink-0">
            <ArrowDownLeft size={16} />
          </div>
        </div>

        {/* Expense Opening Balance Stat Card */}
        <div className="bg-white dark:bg-slate-900 border border-rose-500/20 dark:border-rose-500/30 rounded-2xl p-3 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Expense Opening</p>
            <h3 className="text-base font-black text-rose-600 dark:text-rose-400 mt-0.5 font-mono">
              ₹{(summary.expenseOpeningBalance || 0).toLocaleString('en-IN')}
            </h3>
            <p className="text-[9px] text-slate-400">
              {summary.categoryOpeningBalance > 0
                ? (summary.baseExpenseOpeningBalance > 0
                    ? `OB ₹${summary.baseExpenseOpeningBalance.toLocaleString('en-IN')} + Cat ₹${summary.categoryOpeningBalance.toLocaleString('en-IN')}`
                    : `Incl. Cat. OB ₹${summary.categoryOpeningBalance.toLocaleString('en-IN')}`)
                : 'Brought Forward'}
            </p>
          </div>
          <div className="p-2 bg-rose-50 dark:bg-rose-950/30 text-rose-600 rounded-xl shrink-0">
            <TrendingDown size={16} />
          </div>
        </div>

        {/* Total Expenses & Purchases (Including Opening Balance) Stat Card */}
        <div className="bg-white dark:bg-slate-900 border border-rose-500/20 dark:border-rose-500/30 rounded-2xl p-3 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Total Expenses & Purchases</p>
            <h3 className="text-base font-black text-rose-600 dark:text-rose-400 mt-0.5 font-mono">
              -₹{(summary.effectiveTotalOutflow || ((summary.expenseOpeningBalance || 0) + (summary.totalExpense || 0))).toLocaleString('en-IN')}
            </h3>
            <p className="text-[9px] text-slate-400">Inc. OB ₹{(summary.expenseOpeningBalance || 0).toLocaleString('en-IN')}</p>
          </div>
          <div className="p-2 bg-rose-50 dark:bg-rose-950/30 text-rose-600 rounded-xl shrink-0">
            <ArrowUpRight size={16} />
          </div>
        </div>

        {/* Closing Net Balance Stat Card */}
        <div className="bg-white dark:bg-slate-900 border border-indigo-500/20 dark:border-indigo-500/30 rounded-2xl p-3 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Closing Net Balance</p>
            <h3 className={`text-base font-black mt-0.5 font-mono ${
              (summary.closingBalance || 0) >= 0 
                ? 'text-indigo-600 dark:text-indigo-400' 
                : 'text-amber-600 dark:text-amber-400'
            }`}>
              ₹{(summary.closingBalance || 0).toLocaleString('en-IN')}
            </h3>
            <p className="text-[9px] text-slate-400">Net Total Balance</p>
          </div>
          <div className="p-2 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 rounded-xl shrink-0">
            <Wallet size={16} />
          </div>
        </div>
      </div>

      {/* Sleek Toolbar & Filter Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 rounded-2xl p-3 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Left Title */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-600/10 dark:bg-indigo-400/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <BookOpen className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
              Profit & Loss / Cash & Bank (Income, Expense & Purchase)
            </h3>
          </div>
        </div>

        {/* Right Search, Filters & Export Actions */}
        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap justify-end">
          {/* Search Input */}
          <div className="relative w-full md:w-44">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search vendor, party..."
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            />
            <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
          </div>

          {/* Entry Type Filter (All / Income / Expense / Purchase) */}
          <select
            value={entryTypeFilter}
            onChange={(e) => setEntryTypeFilter(e.target.value)}
            className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
          >
            <option value="">All Ledger Entries</option>
            <option value="INCOME">🟢 Income Only (Inflow)</option>
            <option value="EXPENSE">🔴 Expense Only (Outflow)</option>
            <option value="PURCHASE">🛒 Purchase Only (Procurement)</option>
          </select>

          {/* Payment Mode Filter */}
          <select
            value={filterMode}
            onChange={(e) => setFilterMode(e.target.value)}
            className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
          >
            <option value="">All Payment Modes</option>
            <option value="Cash">Cash</option>
            <option value="UPI_BANK">UPI / Bank</option>
          </select>

          {/* Custom Date Pickers */}
          <div className="flex items-center gap-1">
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setSelectedMonth('CUSTOM');
                setActivePreset('CUSTOM');
              }}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2 py-1 text-xs text-slate-700 dark:text-slate-300 focus:outline-none"
              title="Custom Start Date"
            />
            <span className="text-slate-400 text-xs">-</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setSelectedMonth('CUSTOM');
                setActivePreset('CUSTOM');
              }}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2 py-1 text-xs text-slate-700 dark:text-slate-300 focus:outline-none"
              title="Custom End Date"
            />
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={fetchCashBook}
            className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
            title="Refresh Ledger"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>

          {/* Export Excel Button */}
          <button
            type="button"
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold transition border border-emerald-200 dark:border-emerald-900 cursor-pointer"
          >
            <FileSpreadsheet size={13} />
            Excel
          </button>

          {/* Export PDF Button */}
          <button
            type="button"
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-xs font-bold transition border border-indigo-200 dark:border-indigo-900 cursor-pointer"
          >
            <FileText size={13} />
            PDF
          </button>
        </div>
      </div>

      {/* Main Ledger Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-slate-950/60 text-slate-400 text-[10px] font-bold uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Category / Dept</th>
                <th className="py-3 px-4">Party / Vendor / Source</th>
                <th className="py-3 px-4">Mode</th>
                <th className="py-3 px-4 text-right">Inflow (₹)</th>
                <th className="py-3 px-4 text-right">Outflow (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-slate-700 dark:text-slate-300 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Loader2 className="animate-spin text-indigo-600 mx-auto mb-2" size={24} />
                    Loading entries...
                  </td>
                </tr>
              ) : filteredAndSortedData.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No entries found matching current filters.
                  </td>
                </tr>
              ) : groupByMonth ? (
                groupedByMonth.map((group) => (
                  <React.Fragment key={group.key}>
                    {/* Month Group Header Row */}
                    <tr className="bg-slate-100/90 dark:bg-slate-800/90 border-y border-slate-200 dark:border-slate-700/80">
                      <td colSpan={5} className="py-2.5 px-4">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-black text-xs tracking-tight shadow-xs">
                            <Calendar size={12} />
                            <span>{group.label}</span>
                          </span>
                          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                            {group.items.length} {group.items.length === 1 ? 'entry' : 'entries'}
                          </span>
                          <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">|</span>
                          <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 hidden sm:inline">
                            Month Net:{' '}
                            <span className={`font-mono ${group.net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                              {group.net >= 0 ? '+' : ''}₹{group.net.toLocaleString('en-IN')}
                            </span>
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                        <span className="text-[9px] text-slate-400 uppercase font-sans block">Inflow</span>
                        {group.totalInflow > 0 ? `+₹${group.totalInflow.toLocaleString('en-IN')}` : '₹0'}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap">
                        <span className="text-[9px] text-slate-400 uppercase font-sans block">Outflow</span>
                        {group.totalOutflow > 0 ? `-₹${group.totalOutflow.toLocaleString('en-IN')}` : '₹0'}
                      </td>
                    </tr>

                    {/* Transactions under this Month */}
                    {group.items.map((item) => {
                      const isIncome = item.entryType === 'INCOME';
                      const isPur = item.isPurchase || (item.categoryName || '').toLowerCase().includes('purchase') || item.type === 'Purchase';

                      return (
                        <tr key={`${item.entryType}-${item._id}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/30 transition">
                          <td className="py-3 px-4 whitespace-nowrap font-medium text-slate-500 dark:text-slate-400">
                            {new Date(item.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold tracking-wider ${
                              isIncome 
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/80' 
                                : isPur
                                  ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/80'
                                  : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200/80 dark:border-rose-800/80'
                            }`}>
                              {isIncome ? '🟢 INCOME' : isPur ? '🛒 PURCHASE' : '🔴 EXPENSE'}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">
                            {item.categoryName || 'General'}
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-100">
                            {item.paidTo}
                            {item.description && (
                              <p className="text-[11px] font-normal text-slate-400 line-clamp-1">{item.description}</p>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                              String(item.paymentMode || '').toUpperCase() === 'CASH'
                                ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                                : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300'
                            }`}>
                              {item.paymentMode || 'Cash'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                            {isIncome ? `+₹${(item.amount || 0).toLocaleString('en-IN')}` : '—'}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap">
                            {!isIncome ? `-₹${(item.amount || 0).toLocaleString('en-IN')}` : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                ))
              ) : (
                filteredAndSortedData.map((item) => {
                  const isIncome = item.entryType === 'INCOME';
                  const isPur = item.isPurchase || (item.categoryName || '').toLowerCase().includes('purchase') || item.type === 'Purchase';

                  return (
                    <tr key={`${item.entryType}-${item._id}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/30 transition">
                      <td className="py-3 px-4 whitespace-nowrap font-medium text-slate-500 dark:text-slate-400">
                        {new Date(item.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold tracking-wider ${
                          isIncome 
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/80' 
                            : isPur
                              ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/80'
                              : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200/80 dark:border-rose-800/80'
                        }`}>
                          {isIncome ? '🟢 INCOME' : isPur ? '🛒 PURCHASE' : '🔴 EXPENSE'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">
                        {item.categoryName || 'General'}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-100">
                        {item.paidTo}
                        {item.description && (
                          <p className="text-[11px] font-normal text-slate-400 line-clamp-1">{item.description}</p>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                          String(item.paymentMode || '').toUpperCase() === 'CASH'
                            ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                            : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300'
                        }`}>
                          {item.paymentMode || 'Cash'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                        {isIncome ? `+₹${(item.amount || 0).toLocaleString('en-IN')}` : '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap">
                        {!isIncome ? `-₹${(item.amount || 0).toLocaleString('en-IN')}` : '—'}
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
  );
};

export default CashBookTab;
