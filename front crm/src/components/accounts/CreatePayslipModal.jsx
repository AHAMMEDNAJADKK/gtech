import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, DollarSign, Users, Calendar, Sparkles, Loader2, CheckCircle2 } from 'lucide-react';
import { createSalaryPayment } from '../../services/accountsService';
import { useToast } from '../ToastProvider';

const CreatePayslipModal = ({ isOpen, onClose, onSuccess }) => {
  const { showToast } = useToast();
  const [employees, setEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form States
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [kbEmployeeId, setKbEmployeeId] = useState('KB-DV-002');
  const [location, setLocation] = useState('HEAD OFFICE');
  const [payPeriod, setPayPeriod] = useState(() => {
    const d = new Date();
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const m = monthNames[d.getMonth()];
    const y = d.getFullYear();
    const lastDay = new Date(y, d.getMonth() + 1, 0).getDate();
    return `01 ${m} ${y} - ${lastDay} ${m} ${y}`;
  });
  const [payDateStr, setPayDateStr] = useState(() => {
    const d = new Date();
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return `On or Before 10th ${monthNames[d.getMonth()]} ${d.getFullYear()}`;
  });
  const [workingDays, setWorkingDays] = useState(27);
  const [daysWorked, setDaysWorked] = useState(27);
  const [daysInLeave, setDaysInLeave] = useState(0);
  const [paymentMode, setPaymentMode] = useState('Bank');
  const [remarks, setRemarks] = useState('');

  // Earnings
  const [basicSalary, setBasicSalary] = useState('');
  const [hra, setHra] = useState('0');
  const [medicalAllowance, setMedicalAllowance] = useState('0');
  const [specialAllowance, setSpecialAllowance] = useState('0');
  const [transportAllowance, setTransportAllowance] = useState('0');
  const [otherAllowance, setOtherAllowance] = useState('0');
  const [integrityAward, setIntegrityAward] = useState('0');
  const [bonus, setBonus] = useState('0');

  // Deductions
  const [pf, setPf] = useState('0');
  const [professionalTax, setProfessionalTax] = useState('0');
  const [incomeTax, setIncomeTax] = useState('0');
  const [unpaidLeave, setUnpaidLeave] = useState('0');
  const [advanceSalary, setAdvanceSalary] = useState('0');
  const [otherDeductions, setOtherDeductions] = useState('0');
  const [department, setDepartment] = useState('');
  const [designation, setDesignation] = useState('');
  const [month, setMonth] = useState(() => {
    const d = new Date();
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
  });

  const getEmployeeDepartment = (emp) => {
    if (!emp) return 'GENERAL';
    if (emp.departmentId && typeof emp.departmentId === 'object' && emp.departmentId.name) {
      return emp.departmentId.name;
    }
    if (emp.department && typeof emp.department === 'string' && emp.department.trim()) {
      return emp.department;
    }
    if (emp.department && typeof emp.department === 'object' && emp.department.name) {
      return emp.department.name;
    }
    if (emp.department_name && typeof emp.department_name === 'string' && emp.department_name.trim()) {
      return emp.department_name;
    }
    return 'GENERAL';
  };

  const getEmployeeDesignation = (emp) => {
    if (!emp) return 'STAFF MEMBER';
    if (emp.designationName && typeof emp.designationName === 'string' && emp.designationName.trim()) {
      return emp.designationName;
    }
    if (emp.designation && typeof emp.designation === 'string' && emp.designation.trim()) {
      return emp.designation;
    }
    if (emp.designationId && typeof emp.designationId === 'object' && emp.designationId.name) {
      return emp.designationId.name;
    }
    return 'STAFF MEMBER';
  };

  // Fetch Active Employees
  useEffect(() => {
    if (!isOpen) return;
    const fetchEmployees = async () => {
      setLoadingEmployees(true);
      try {
        let token = localStorage.getItem('token') || '';
        token = token.replace(/^"(.*)"$/, '$1').trim();
        if (token.startsWith('Bearer ')) token = token.slice(7).trim();

        const host = import.meta.env.VITE_API_URL || '/api';
        const apiUrl = `${host.replace(/\/+$/, '')}/v1/users`;

        const res = await axios.get(apiUrl, {
          headers: { Authorization: `Bearer ${token}` }
        });

        const userList = res.data?.data || res.data || [];
        if (Array.isArray(userList)) {
          const activeList = userList.filter(u => u.isActive !== false);
          setEmployees(activeList);
          if (activeList.length > 0 && !selectedEmployeeId) {
            const firstEmp = activeList[0];
            setSelectedEmployeeId(firstEmp._id || firstEmp.id);
            setBasicSalary(firstEmp.salary || '12000');
            setKbEmployeeId(firstEmp.employeeId || `KB-${(firstEmp.name || '').slice(0, 2).toUpperCase()}-001`);
            setDepartment(getEmployeeDepartment(firstEmp));
            setDesignation(getEmployeeDesignation(firstEmp));
          }
        }
      } catch (err) {
        console.error('Error loading employees for payslip:', err);
      } finally {
        setLoadingEmployees(false);
      }
    };
    fetchEmployees();
  }, [isOpen]);

  const handleEmployeeChange = (e) => {
    const empId = e.target.value;
    setSelectedEmployeeId(empId);
    const empObj = employees.find(u => (u._id || u.id) === empId);
    if (empObj) {
      setBasicSalary(empObj.salary || '12000');
      setKbEmployeeId(empObj.employeeId || `KB-${(empObj.name || '').slice(0, 2).toUpperCase()}-001`);
      setDepartment(getEmployeeDepartment(empObj));
      setDesignation(getEmployeeDesignation(empObj));
    }
  };

  const totalEarnings = (Number(basicSalary) || 0) + (Number(hra) || 0) + (Number(medicalAllowance) || 0) + (Number(specialAllowance) || 0) + (Number(transportAllowance) || 0) + (Number(otherAllowance) || 0) + (Number(integrityAward) || 0) + (Number(bonus) || 0);
  const totalDeductions = (Number(pf) || 0) + (Number(professionalTax) || 0) + (Number(incomeTax) || 0) + (Number(unpaidLeave) || 0) + (Number(advanceSalary) || 0) + (Number(otherDeductions) || 0);
  const netPay = Math.max(0, totalEarnings - totalDeductions);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedEmployeeId) {
      showToast('Please select an employee.', 'error');
      return;
    }
    if (!month) {
      showToast('Please enter pay month.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        employeeId: selectedEmployeeId,
        month,
        department: department ? department.trim() : 'GENERAL',
        designation: designation ? designation.trim() : 'STAFF MEMBER',
        basicSalary: Number(basicSalary || 0),
        paidAmount: netPay,
        paymentMode,
        remarks,
        kbEmployeeId,
        location,
        payPeriod,
        payDateStr,
        workingDays: Number(workingDays || 27),
        daysWorked: Number(daysWorked || 21),
        daysInLeave: Number(daysInLeave || 6),
        hra: Number(hra || 0),
        medicalAllowance: Number(medicalAllowance || 0),
        specialAllowance: Number(specialAllowance || 0),
        transportAllowance: Number(transportAllowance || 0),
        otherAllowance: Number(otherAllowance || 0),
        integrityAward: Number(integrityAward || 0),
        bonus: Number(bonus || 0),
        totalEarnings,
        pf: Number(pf || 0),
        professionalTax: Number(professionalTax || 0),
        incomeTax: Number(incomeTax || 0),
        unpaidLeave: Number(unpaidLeave || 0),
        advanceSalary: Number(advanceSalary || 0),
        otherDeductions: Number(otherDeductions || 0),
        totalDeductions
      };

      const res = await createSalaryPayment(payload);
      if (res.success) {
        showToast('Payslip generated and salary record created successfully!', 'success');
        onSuccess();
        onClose();
      } else {
        showToast(res.message || 'Failed to generate payslip.', 'error');
      }
    } catch (err) {
      console.error('Error generating payslip:', err);
      showToast(err.response?.data?.message || 'Error creating payslip.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4">
        <div className="fixed inset-0 bg-slate-950/60" onClick={onClose} />
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative z-10 w-full max-w-4xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] my-auto"
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white flex items-center justify-center font-bold shadow-md">
                <Plus size={20} />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight">Create Official Employee Payslip</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Generate itemized KOD.BRAND salary slip</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Modal Form */}
          <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 text-xs text-slate-800 dark:text-slate-200">
            {/* 1. Employee & Period Details Header */}
            <div className="bg-slate-50 dark:bg-slate-950/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
              <h4 className="font-extrabold uppercase tracking-wider text-[11px] text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                <Users size={14} /> Employee & Pay Period Information
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Select Employee *</label>
                  <select
                    required
                    value={selectedEmployeeId}
                    onChange={handleEmployeeChange}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 font-medium text-slate-900 dark:text-white"
                  >
                    {loadingEmployees ? (
                      <option>Loading staff list...</option>
                    ) : (
                      employees.map(e => (
                        <option key={e._id || e.id} value={e._id || e.id}>
                          {e.name} ({e.designationName || e.designation || 'Staff'})
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Employee Code (ID)</label>
                  <input
                    type="text"
                    value={kbEmployeeId}
                    onChange={e => setKbEmployeeId(e.target.value)}
                    placeholder="KB-DV-002"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 font-medium"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Department</label>
                  <input
                    type="text"
                    value={department}
                    onChange={e => setDepartment(e.target.value)}
                    placeholder="e.g. Operations / Development"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 font-medium text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Pay Month *</label>
                  <input
                    type="text"
                    required
                    value={month}
                    onChange={e => {
                      const val = e.target.value;
                      setMonth(val);
                      if (val && val.trim()) {
                        const parts = val.trim().split(/\s+/);
                        const mName = parts[0] || '';
                        const yearStr = parts[1] || new Date().getFullYear();
                        setPayDateStr(`On or Before 10th ${mName} ${yearStr}`);
                      }
                    }}
                    placeholder="September 2026"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 font-medium"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Location</label>
                  <input
                    type="text"
                    value={location}
                    onChange={e => setLocation(e.target.value)}
                    placeholder="HEAD OFFICE"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 font-medium"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Pay Period Dates</label>
                  <input
                    type="text"
                    value={payPeriod}
                    onChange={e => setPayPeriod(e.target.value)}
                    placeholder="01 July 2026 - 31 July 2026"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 font-medium"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Pay Date Text</label>
                  <input
                    type="text"
                    value={payDateStr}
                    onChange={e => setPayDateStr(e.target.value)}
                    placeholder="On or Before 10th August 2026"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 font-medium"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Working Days</label>
                  <input
                    type="number"
                    value={workingDays}
                    onChange={e => {
                      const wd = Number(e.target.value) || 0;
                      setWorkingDays(wd);
                      const dw = Number(daysWorked) || 0;
                      setDaysInLeave(Math.max(0, wd - dw));
                    }}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 font-medium"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Days Worked</label>
                  <input
                    type="number"
                    value={daysWorked}
                    onChange={e => {
                      const dw = Number(e.target.value) || 0;
                      setDaysWorked(dw);
                      const wd = Number(workingDays) || 0;
                      setDaysInLeave(Math.max(0, wd - dw));
                    }}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 font-medium"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Days in Leave</label>
                  <input
                    type="number"
                    value={daysInLeave}
                    onChange={e => {
                      const dil = Number(e.target.value) || 0;
                      setDaysInLeave(dil);
                      const wd = Number(workingDays) || 0;
                      setDaysWorked(Math.max(0, wd - dil));
                    }}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 font-medium text-amber-600 dark:text-amber-400"
                  />
                </div>
              </div>
            </div>

            {/* 2. Earnings Particulars */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="flex justify-between items-center">
                <h4 className="font-extrabold uppercase tracking-wider text-[11px] text-emerald-600 dark:text-emerald-400">
                  EARNINGS PARTICULAR BREAKDOWN (₹)
                </h4>
                <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm">
                  Total Earnings: ₹{totalEarnings.toLocaleString('en-IN')}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-500 font-semibold mb-1">Basic Salary *</label>
                  <input
                    type="number"
                    required
                    value={basicSalary}
                    onChange={e => setBasicSalary(e.target.value)}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-2 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 font-semibold mb-1">House Rent (HRA)</label>
                  <input
                    type="number"
                    value={hra}
                    onChange={e => setHra(e.target.value)}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-2"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 font-semibold mb-1">Medical Allowance</label>
                  <input
                    type="number"
                    value={medicalAllowance}
                    onChange={e => setMedicalAllowance(e.target.value)}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-2"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 font-semibold mb-1">Special Allowance</label>
                  <input
                    type="number"
                    value={specialAllowance}
                    onChange={e => setSpecialAllowance(e.target.value)}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-2"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 font-semibold mb-1">Transport Allowance</label>
                  <input
                    type="number"
                    value={transportAllowance}
                    onChange={e => setTransportAllowance(e.target.value)}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-2"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 font-semibold mb-1">Other Allowance</label>
                  <input
                    type="number"
                    value={otherAllowance}
                    onChange={e => setOtherAllowance(e.target.value)}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-2"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 font-semibold mb-1">KODBRAND Integrity</label>
                  <input
                    type="number"
                    value={integrityAward}
                    onChange={e => setIntegrityAward(e.target.value)}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-2"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 font-semibold mb-1">Bonus</label>
                  <input
                    type="number"
                    value={bonus}
                    onChange={e => setBonus(e.target.value)}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-2"
                  />
                </div>
              </div>
            </div>

            {/* 3. Deductions Particulars */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="flex justify-between items-center">
                <h4 className="font-extrabold uppercase tracking-wider text-[11px] text-rose-600 dark:text-rose-400">
                  DEDUCTIONS PARTICULAR BREAKDOWN (₹)
                </h4>
                <span className="font-black text-rose-600 dark:text-rose-400 text-sm">
                  Total Deductions: ₹{totalDeductions.toLocaleString('en-IN')}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-500 font-semibold mb-1">PF (Provident Fund)</label>
                  <input
                    type="number"
                    value={pf}
                    onChange={e => setPf(e.target.value)}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-2"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 font-semibold mb-1">Professional Tax</label>
                  <input
                    type="number"
                    value={professionalTax}
                    onChange={e => setProfessionalTax(e.target.value)}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-2"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 font-semibold mb-1">Income Tax</label>
                  <input
                    type="number"
                    value={incomeTax}
                    onChange={e => setIncomeTax(e.target.value)}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-2"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 font-semibold mb-1">Unpaid Leave</label>
                  <input
                    type="number"
                    value={unpaidLeave}
                    onChange={e => setUnpaidLeave(e.target.value)}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-2 font-semibold text-rose-600"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 font-semibold mb-1">Advance Salary</label>
                  <input
                    type="number"
                    value={advanceSalary}
                    onChange={e => setAdvanceSalary(e.target.value)}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-2"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 font-semibold mb-1">Other Deductions</label>
                  <input
                    type="number"
                    value={otherDeductions}
                    onChange={e => setOtherDeductions(e.target.value)}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-2"
                  />
                </div>
              </div>
            </div>

            {/* Net Pay Highlight & Disbursal Mode */}
            <div className="bg-indigo-50 dark:bg-indigo-950/40 p-4 rounded-2xl border border-indigo-200 dark:border-indigo-800 flex flex-col sm:flex-row justify-between items-center gap-4">
              <div>
                <span className="block text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400">NET PAYABLE AMOUNT (₹)</span>
                <span className="text-2xl font-black text-indigo-700 dark:text-indigo-300">₹{netPay.toLocaleString('en-IN')}</span>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="flex-1 sm:flex-none">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Payment Mode</label>
                  <select
                    value={paymentMode}
                    onChange={e => setPaymentMode(e.target.value)}
                    className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-2 font-bold text-xs"
                  >
                    <option value="Bank">Bank Transfer</option>
                    <option value="Cash">Cash Disbursal</option>
                    <option value="UPI">UPI / Online</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition shadow-lg shadow-indigo-600/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Generating Payslip...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} />
                    <span>Generate & Issue Payslip</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
};

export default CreatePayslipModal;
