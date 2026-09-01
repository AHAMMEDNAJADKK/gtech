import mongoose from 'mongoose';
import ExpenseCategory from '../models/expenseCategory.model.js';
import Expense from '../models/expense.model.js';
import SalaryPayment from '../models/salaryPayment.model.js';
import User from '../models/user.model.js';
import Income from '../models/income.model.js';
import OpeningBalance from '../models/openingBalance.model.js';
import { sendEmail } from '../services/emailService.js';

const DEFAULT_CATEGORIES = [
  'Salary',
  'Stationery',
  'Electricity',
  'Internet',
  'Rent',
  'Travel',
  'Maintenance',
  'Miscellaneous'
];

/**
 * Auto-seed default master expense categories if none exist
 */
const seedDefaultCategoriesIfNeeded = async () => {
  try {
    const count = await ExpenseCategory.countDocuments();
    if (count === 0) {
      const docs = DEFAULT_CATEGORIES.map(name => ({
        name,
        description: `Default category for ${name}`,
        openingBalance: 0,
        isActive: true,
        isSystemDefault: true
      }));
      await ExpenseCategory.insertMany(docs);
      console.log('🌱 Successfully seeded default expense categories.');
    }
  } catch (err) {
    console.error('Error seeding default expense categories:', err.message);
  }
};

// ==========================================
// CATEGORY CONTROLLERS
// ==========================================

export const getCategories = async (req, res) => {
  try {
    await seedDefaultCategoriesIfNeeded();
    const categories = await ExpenseCategory.find().sort({ name: 1 });
    return res.status(200).json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('getCategories Error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createCategory = async (req, res) => {
  try {
    const { name, description, openingBalance } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Category name is required.' });
    }

    const cleanName = name.trim();
    const escapedName = cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    let category = await ExpenseCategory.findOne({ name: { $regex: new RegExp(`^${escapedName}$`, 'i') } });
    
    if (category) {
      // Category already exists: update its opening balance and description directly!
      const updateData = {};
      if (typeof openingBalance !== 'undefined') {
        updateData.openingBalance = Math.max(0, Number(openingBalance) || 0);
      }
      if (description !== undefined) updateData.description = description.trim();

      const updatedCategory = await ExpenseCategory.findByIdAndUpdate(
        category._id,
        { $set: updateData },
        { new: true, returnDocument: 'after', runValidators: true }
      );

      return res.status(200).json({
        success: true,
        message: 'Category opening balance updated successfully.',
        data: updatedCategory
      });
    }

    category = await ExpenseCategory.create({
      name: cleanName,
      description: description ? description.trim() : '',
      openingBalance: typeof openingBalance !== 'undefined' ? Math.max(0, Number(openingBalance) || 0) : 0,
      isActive: true,
      isSystemDefault: false
    });

    return res.status(201).json({
      success: true,
      message: 'Expense category created successfully.',
      data: category
    });
  } catch (error) {
    console.error('createCategory Error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, isActive, openingBalance } = req.body;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid category ID.' });
    }

    const objectId = new mongoose.Types.ObjectId(id);
    const category = await ExpenseCategory.findById(objectId);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found.' });
    }

    if (name && name.trim().toLowerCase() !== (category.name || '').toLowerCase()) {
      const cleanName = name.trim();
      const escapedName = cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const existing = await ExpenseCategory.findOne({ 
        _id: { $ne: objectId }, 
        name: { $regex: new RegExp(`^${escapedName}$`, 'i') } 
      });
      if (existing) {
        return res.status(400).json({ success: false, message: 'Another category with this name already exists.' });
      }
    }

    const updateFields = {};
    if (name) updateFields.name = name.trim();
    if (description !== undefined) updateFields.description = description ? description.trim() : '';
    if (isActive !== undefined) updateFields.isActive = Boolean(isActive);
    if (openingBalance !== undefined) updateFields.openingBalance = Math.max(0, Number(openingBalance) || 0);

    const updated = await ExpenseCategory.findByIdAndUpdate(
      objectId,
      { $set: updateFields },
      { new: true, returnDocument: 'after', runValidators: true }
    );

    if (name && name.trim() !== category.name) {
      await Expense.updateMany({ category: objectId }, { $set: { categoryName: name.trim() } });
    }

    return res.status(200).json({
      success: true,
      message: 'Category updated successfully.',
      data: updated
    });
  } catch (error) {
    console.error('updateCategory Error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateBatchCategoryOpeningBalances = async (req, res) => {
  try {
    const { balances } = req.body; // array of { id, openingBalance }
    if (!Array.isArray(balances)) {
      return res.status(400).json({ success: false, message: 'balances array is required.' });
    }

    const bulkOps = balances
      .filter(item => item && item.id && mongoose.Types.ObjectId.isValid(item.id))
      .map(item => ({
        updateOne: {
          filter: { _id: new mongoose.Types.ObjectId(item.id) },
          update: { $set: { openingBalance: Math.max(0, Number(item.openingBalance) || 0) } }
        }
      }));

    if (bulkOps.length > 0) {
      await ExpenseCategory.bulkWrite(bulkOps);
    }

    const updatedCategories = await ExpenseCategory.find().sort({ name: 1 });

    return res.status(200).json({
      success: true,
      message: 'All category opening balances updated successfully.',
      data: updatedCategories
    });
  } catch (error) {
    console.error('updateBatchCategoryOpeningBalances Error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await ExpenseCategory.findById(id);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found.' });
    }

    // Check if used in expenses
    const usedInExpenses = await Expense.countDocuments({ category: id });
    if (usedInExpenses > 0) {
      return res.status(400).json({ 
        success: false, 
        message: `Cannot delete category because it is used in ${usedInExpenses} expense record(s).` 
      });
    }

    await ExpenseCategory.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: 'Category deleted successfully.'
    });
  } catch (error) {
    console.error('deleteCategory Error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// EXPENSE CONTROLLERS
// ==========================================

export const getExpenses = async (req, res) => {
  try {
    const { category, type, startDate, endDate, search, paymentMode, status } = req.query;
    const query = {};

    if (category) {
      query.category = category;
    }

    if (paymentMode) {
      query.paymentMode = paymentMode;
    }

    if (status && status !== 'ALL') {
      query.status = status;
    }

    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate + 'T23:59:59.999Z');
    }

    if (search) {
      query.$or = [
        { paidTo: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { categoryName: { $regex: search, $options: 'i' } }
      ];
    }

    const expenses = await Expense.find(query)
      .populate('category', 'name openingBalance')
      .populate('addedBy', 'name email')
      .sort({ date: -1, createdAt: -1 });

    return res.status(200).json({
      success: true,
      data: expenses
    });
  } catch (error) {
    console.error('getExpenses Error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createExpense = async (req, res) => {
  try {
    const { 
      date, 
      category, 
      categoryName,
      isPurchase,
      amount, 
      paymentMode, 
      paidTo, 
      description,
      taxOption,
      gstCategory,
      gstRate,
      gstAmount,
      cgstAmount,
      sgstAmount,
      igstAmount,
      totalAmount
    } = req.body;

    const expAmount = Number(amount || 0);

    if (!expAmount || !paymentMode || !paidTo) {
      return res.status(400).json({
        success: false,
        message: 'Amount, Payment Mode, and Paid To fields are required.'
      });
    }

    let catObj = null;
    let resolvedCategoryName = categoryName || '';

    if (category && mongoose.Types.ObjectId.isValid(category)) {
      catObj = await ExpenseCategory.findById(category);
      if (catObj) {
        resolvedCategoryName = catObj.name;
      }
    }

    if (!resolvedCategoryName) {
      if (isPurchase) {
        resolvedCategoryName = 'Inventory & Purchase';
      } else {
        resolvedCategoryName = 'General';
      }
    }

    // Auto-seed category if missing
    if (!catObj && resolvedCategoryName) {
      catObj = await ExpenseCategory.findOne({ name: { $regex: new RegExp(`^${resolvedCategoryName.trim()}$`, 'i') } });
      if (!catObj) {
        catObj = await ExpenseCategory.create({
          name: resolvedCategoryName.trim(),
          description: `Auto created category for ${resolvedCategoryName.trim()}`
        });
      }
    }

    let attachmentUrl = '';
    if (req.file) {
      attachmentUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    }

    let addedByName = req.user?.name || req.user?.email || 'System User';
    if (req.user?.id) {
      const user = await User.findById(req.user.id).select('name');
      if (user) addedByName = user.name;
    }

    const userRole = String(req.user?.role || '').toLowerCase();
    const isMdUser = req.user?.isSuperAdmin === true ||
      ['0', 'superadmin', 'md', 'coo', 'executive_director'].includes(userRole);
    const isSalary = resolvedCategoryName.toLowerCase() === 'salary';
    const isPur = isPurchase === true || resolvedCategoryName.toLowerCase().includes('purchase') || resolvedCategoryName.toLowerCase().includes('inventory') || resolvedCategoryName.toLowerCase().includes('vendor');

    let initialStatus = expAmount > 1000 ? 'PENDING' : 'APPROVED';
    if (req.body.status && isMdUser) {
      initialStatus = req.body.status;
    }

    const expense = await Expense.create({
      date: date ? new Date(date) : new Date(),
      category: catObj ? catObj._id : null,
      categoryName: resolvedCategoryName,
      isPurchase: isPur,
      amount: expAmount,
      paymentMode,
      paidTo: paidTo.trim(),
      description: description ? description.trim() : '',
      attachment: attachmentUrl,
      addedBy: req.user?.id || null,
      addedByName,
      type: isSalary ? 'Salary' : (isPur ? 'Purchase' : 'Expense'),
      taxOption: taxOption || 'No GST',
      gstCategory: gstCategory || 'NONE',
      gstRate: parseFloat(gstRate || 0),
      gstAmount: parseFloat(gstAmount || 0),
      cgstAmount: parseFloat(cgstAmount || 0),
      sgstAmount: parseFloat(sgstAmount || 0),
      igstAmount: parseFloat(igstAmount || 0),
      totalAmount: parseFloat(totalAmount || expAmount),
      status: initialStatus
    });

    return res.status(201).json({
      success: true,
      message: initialStatus === 'PENDING'
        ? 'Expense recorded successfully and submitted for MD approval.'
        : 'Expense recorded successfully.',
      data: expense
    });
  } catch (error) {
    console.error('createExpense Error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateExpense = async (req, res) => {
  try {
    const { id } = req.params;
    const { date, category, amount, paymentMode, paidTo, description } = req.body;

    const expense = await Expense.findById(id);
    if (!expense) {
      return res.status(404).json({ success: false, message: 'Expense not found.' });
    }

    if (category) {
      const catObj = await ExpenseCategory.findById(category);
      if (catObj) {
        expense.category = catObj._id;
        expense.categoryName = catObj.name;
        expense.type = catObj.name.toLowerCase() === 'salary' ? 'Salary' : 'Expense';
      }
    }

    if (date) expense.date = new Date(date);
    if (amount !== undefined) expense.amount = Number(amount);
    if (paymentMode) expense.paymentMode = paymentMode;
    if (paidTo) expense.paidTo = paidTo.trim();
    if (description !== undefined) expense.description = description.trim();

    if (req.file) {
      expense.attachment = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    }

    await expense.save();

    return res.status(200).json({
      success: true,
      message: 'Expense updated successfully.',
      data: expense
    });
  } catch (error) {
    console.error('updateExpense Error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteExpense = async (req, res) => {
  try {
    const { id } = req.params;
    const expense = await Expense.findById(id);
    if (!expense) {
      return res.status(404).json({ success: false, message: 'Expense not found.' });
    }

    // If linked to a salary payment, unlink or restrict delete
    if (expense.salaryPaymentId) {
      await SalaryPayment.findByIdAndDelete(expense.salaryPaymentId);
    }

    await Expense.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: 'Expense deleted successfully.'
    });
  } catch (error) {
    console.error('deleteExpense Error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// SALARY PAYMENT CONTROLLERS
// ==========================================

export const getSalaryPayments = async (req, res) => {
  try {
    const { month, employeeId } = req.query;
    const query = {};

    if (month) query.month = month;
    if (employeeId) query.employee = employeeId;

    const payments = await SalaryPayment.find(query)
      .populate('employee', 'name email designation salary employeeId')
      .populate('addedBy', 'name email')
      .sort({ paymentDate: -1, createdAt: -1 });

    return res.status(200).json({
      success: true,
      data: payments
    });
  } catch (error) {
    console.error('getSalaryPayments Error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createSalaryPayment = async (req, res) => {
  try {
    const {
      employeeId, month, basicSalary, paidAmount, paymentDate, paymentMode, remarks,
      kbEmployeeId, location, payPeriod, payDateStr, workingDays, daysWorked, daysInLeave,
      hra, medicalAllowance, specialAllowance, transportAllowance, otherAllowance, integrityAward, bonus, totalEarnings,
      pf, professionalTax, incomeTax, unpaidLeave, advanceSalary, otherDeductions, totalDeductions
    } = req.body;

    if (!employeeId || !month || (paidAmount === undefined && totalEarnings === undefined) || !paymentMode) {
      return res.status(400).json({
        success: false,
        message: 'Employee, Month, Paid Amount, and Payment Mode are required.'
      });
    }

    // Extract valid 24-character ObjectId if embedded in string
    let cleanEmployeeId = String(employeeId || '').trim();
    const hexMatch = cleanEmployeeId.match(/[a-fA-F0-9]{24}/);
    if (hexMatch) {
      cleanEmployeeId = hexMatch[0];
    }

    if (!cleanEmployeeId || !mongoose.Types.ObjectId.isValid(cleanEmployeeId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Employee ID selected.'
      });
    }

    const employeeObj = await User.findById(cleanEmployeeId);
    if (!employeeObj) {
      return res.status(404).json({ success: false, message: 'Selected Employee not found in database.' });
    }

    let addedByName = req.user?.name || req.user?.email || 'System User';
    if (req.user?.id) {
      const adminUser = await User.findById(req.user.id).select('name');
      if (adminUser) addedByName = adminUser.name;
    }

    const computedBasic = Number(basicSalary || employeeObj.salary || 0);
    const computedTotalEarnings = Number(totalEarnings || (computedBasic + Number(hra || 0) + Number(medicalAllowance || 0) + Number(specialAllowance || 0) + Number(transportAllowance || 0) + Number(otherAllowance || 0) + Number(integrityAward || 0) + Number(bonus || 0)));
    const computedTotalDeductions = Number(totalDeductions || (Number(pf || 0) + Number(professionalTax || 0) + Number(incomeTax || 0) + Number(unpaidLeave || 0) + Number(advanceSalary || 0) + Number(otherDeductions || 0)));
    const finalPaidAmount = Number(paidAmount !== undefined ? paidAmount : Math.max(0, computedTotalEarnings - computedTotalDeductions));

    // 1. Create Salary Payment
    const salaryPayment = new SalaryPayment({
      employee: employeeObj._id,
      employeeName: employeeObj.name,
      month,
      basicSalary: computedBasic,
      paidAmount: finalPaidAmount,
      paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
      paymentMode,
      remarks: remarks ? remarks.trim() : '',
      kbEmployeeId: kbEmployeeId || employeeObj.employeeId || `KB-${(employeeObj.name || '').slice(0, 2).toUpperCase()}-001`,
      location: location || 'HEAD OFFICE',
      payPeriod: payPeriod || `${month}`,
      payDateStr: payDateStr || `On or Before 10th ${month}`,
      workingDays: Number(workingDays || 27),
      daysWorked: Number(daysWorked || 27),
      daysInLeave: Number(daysInLeave || 0),
      hra: Number(hra || 0),
      medicalAllowance: Number(medicalAllowance || 0),
      specialAllowance: Number(specialAllowance || 0),
      transportAllowance: Number(transportAllowance || 0),
      otherAllowance: Number(otherAllowance || 0),
      integrityAward: Number(integrityAward || 0),
      bonus: Number(bonus || 0),
      totalEarnings: computedTotalEarnings,
      pf: Number(pf || 0),
      professionalTax: Number(professionalTax || 0),
      incomeTax: Number(incomeTax || 0),
      unpaidLeave: Number(unpaidLeave || 0),
      advanceSalary: Number(advanceSalary || 0),
      otherDeductions: Number(otherDeductions || 0),
      totalDeductions: computedTotalDeductions,
      addedBy: req.user?.id || null,
      addedByName
    });

    await salaryPayment.save();

    // 2. Automatically create corresponding Expense Entry under "Salary" Category!
    await seedDefaultCategoriesIfNeeded();
    let salaryCategory = await ExpenseCategory.findOne({ 
      name: { $regex: /^Salary$/i } 
    });

    if (!salaryCategory) {
      salaryCategory = await ExpenseCategory.create({
        name: 'Salary',
        description: 'Employee salary payments',
        isSystemDefault: true
      });
    }

    const autoExpense = await Expense.create({
      date: salaryPayment.paymentDate,
      category: salaryCategory._id,
      categoryName: 'Salary',
      amount: salaryPayment.paidAmount,
      paymentMode: salaryPayment.paymentMode,
      paidTo: employeeObj.name,
      description: `Employee Salary Payment for ${month}${remarks ? ' (' + remarks.trim() + ')' : ''}`,
      addedBy: req.user?.id || null,
      addedByName,
      type: 'Salary',
      salaryPaymentId: salaryPayment._id,
      status: salaryPayment.paidAmount > 1000 ? 'PENDING' : 'APPROVED'
    });

    // Link back expense ID to salary payment
    salaryPayment.expenseId = autoExpense._id;
    await salaryPayment.save();

    return res.status(201).json({
      success: true,
      message: 'Salary payment recorded and auto expense entry created successfully.',
      data: salaryPayment
    });
  } catch (error) {
    console.error('createSalaryPayment Error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Update a Salary Payment (edit payslip fields)
 * PUT /api/v1/accounts/salary-payments/:id
 */
export const updateSalaryPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const payment = await SalaryPayment.findById(id);
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Salary payment record not found.' });
    }

    // Fields that can be updated
    const allowedFields = [
      'month', 'payPeriod', 'payDateStr', 'location',
      'kbEmployeeId', 'employeeName', 'designation', 'department',
      'workingDays', 'daysWorked', 'daysInLeave',
      'basicSalary', 'hra', 'medicalAllowance', 'specialAllowance',
      'transportAllowance', 'otherAllowance', 'integrityAward', 'bonus',
      'totalEarnings', 'pf', 'professionalTax', 'incomeTax',
      'unpaidLeave', 'advanceSalary', 'otherDeductions', 'totalDeductions',
      'paidAmount', 'paymentMode', 'remarks'
    ];

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        payment[field] = req.body[field];
      }
    });

    await payment.save();

    return res.status(200).json({
      success: true,
      message: 'Payslip updated successfully.',
      data: payment
    });
  } catch (error) {
    console.error('updateSalaryPayment Error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteSalaryPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const payment = await SalaryPayment.findById(id);
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Salary payment record not found.' });
    }

    // Automatically remove synced expense entry
    if (payment.expenseId) {
      await Expense.findByIdAndDelete(payment.expenseId);
    } else {
      await Expense.deleteMany({ salaryPaymentId: id });
    }

    await SalaryPayment.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: 'Salary payment and synced expense record removed successfully.'
    });
  } catch (error) {
    console.error('deleteSalaryPayment Error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// CASH BOOK CONTROLLER
// ==========================================

export const getCashBook = async (req, res) => {
  try {
    const { startDate, endDate, entryType, type, category, paymentMode } = req.query;
    const expenseQuery = {};
    const incomeQuery = {};

    if (paymentMode) {
      if (paymentMode === 'UPI_BANK' || paymentMode === 'UPI/BANK') {
        expenseQuery.paymentMode = { $in: ['UPI', 'Bank', 'upi', 'bank'] };
        incomeQuery.paymentMethod = { $in: ['Bank Transfer', 'UPI / QR Code', 'Credit/Debit Card', 'Online Payment Gateway', 'UPI', 'Bank'] };
      } else if (paymentMode === 'Cash' || paymentMode === 'CASH') {
        expenseQuery.paymentMode = { $regex: '^cash$', $options: 'i' };
        incomeQuery.paymentMethod = { $regex: '^cash$', $options: 'i' };
      } else {
        expenseQuery.paymentMode = paymentMode;
        incomeQuery.paymentMethod = paymentMode;
      }
    }

    if (startDate || endDate) {
      const dateFilter = {};
      if (startDate) dateFilter.$gte = new Date(startDate);
      if (endDate) dateFilter.$lte = new Date(endDate + 'T23:59:59.999Z');
      expenseQuery.date = dateFilter;
      incomeQuery.date = dateFilter;
    }

    if (category) {
      expenseQuery.category = category;
    }

    if (type) {
      expenseQuery.type = type;
    }

    let expenses = [];
    let incomes = [];

    // Fetch Expenses if entryType is 'all' or 'EXPENSE' or 'PURCHASE'
    if (!entryType || entryType === 'all' || entryType === 'EXPENSE' || entryType === 'PURCHASE') {
      const expList = await Expense.find(expenseQuery)
        .populate('category', 'name')
        .populate('addedBy', 'name email')
        .sort({ date: -1, createdAt: -1 });

      expenses = expList.map(e => {
        const cat = String(e.categoryName || e.category?.name || '').toLowerCase();
        const isPur = e.isPurchase === true || cat.includes('purchase') || cat.includes('inventory') || cat.includes('vendor');
        return {
          _id: e._id,
          entryType: 'EXPENSE', // Outflow
          isPurchase: isPur,
          type: isPur ? 'Purchase' : (e.type || 'Expense'),
          categoryName: e.type === 'Salary' ? 'Employee Salary' : (isPur ? 'Inventory & Purchase' : (e.categoryName || e.category?.name || 'General')),
          paidTo: e.paidTo || 'N/A',
          paymentMode: e.paymentMode || 'Cash',
          amount: e.amount || 0,
          date: e.date || e.createdAt,
          referenceNo: e.receiptNo || e.billNo || e._id,
          description: e.description || ''
        };
      });

      if (entryType === 'PURCHASE') {
        expenses = expenses.filter(e => e.isPurchase);
      }
    }

    // Fetch Incomes if entryType is 'all' or 'INCOME'
    if (!entryType || entryType === 'all' || entryType === 'INCOME') {
      const incList = await Income.find(incomeQuery)
        .sort({ date: -1, createdAt: -1 });

      incomes = incList.map(i => {
        let paid = 0;
        if (Array.isArray(i.payments) && i.payments.length > 0) {
          paid = i.payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
        }
        if (paid <= 0 && typeof i.receiptAmount === 'number' && i.receiptAmount > 0) {
          paid = i.receiptAmount;
        }
        if (paid <= 0 && (i.status || '').toLowerCase() === 'paid') {
          paid = parseFloat(i.totalAmount || i.amount || 0);
        }

        const billed = parseFloat(i.totalAmount || i.amount || 0);

        return {
          _id: i._id,
          entryType: 'INCOME', // Inflow
          isPurchase: false,
          type: i.sourceType || 'Income',
          categoryName: i.department || 'Income',
          paidTo: i.clientName ? `${i.title} (${i.clientName})` : i.title,
          paymentMode: i.paymentMethod || 'Bank Transfer',
          amount: paid, // Actual Cash Received (Paid Amount)
          billedAmount: billed,
          status: i.status || 'Pending',
          date: i.date || i.createdAt,
          referenceNo: i.referenceNo || i.receiptNo || '',
          description: i.description || ''
        };
      });
    }

    // Combine and sort by date descending
    const combinedLedger = [...incomes, ...expenses].sort((a, b) => new Date(b.date) - new Date(a.date));

    // Fetch active Opening Balance
    const obRecord = await OpeningBalance.findOne().sort({ updatedAt: -1 });
    const incomeOpeningBalance = obRecord ? (obRecord.incomeAmount ?? obRecord.amount ?? 0) : 0;
    const baseExpenseOpeningBalance = obRecord ? (obRecord.expenseAmount ?? 0) : 0;

    // Calculate total Category Opening Balances
    const allCategories = await ExpenseCategory.find();
    const categoryOpeningBalanceTotal = allCategories.reduce((sum, c) => sum + (Number(c.openingBalance) || 0), 0);

    // The categories OB is added to the expense OB in cashbook
    const expenseOpeningBalance = baseExpenseOpeningBalance + categoryOpeningBalanceTotal;

    // Calculate Summary Stats (Income, General Expense, Purchase Outflow, Net Profit/Loss)
    const totalIncome = incomes.reduce((sum, item) => sum + (item.amount || 0), 0);
    const totalPurchase = expenses.filter(e => e.isPurchase).reduce((sum, item) => sum + (item.amount || 0), 0);
    const totalGeneralExpense = expenses.filter(e => !e.isPurchase).reduce((sum, item) => sum + (item.amount || 0), 0);
    const totalExpense = totalGeneralExpense + totalPurchase; // Total Outflow

    const effectiveTotalIncome = incomeOpeningBalance + totalIncome;
    const effectiveTotalOutflow = expenseOpeningBalance + totalExpense;
    const netBalance = totalIncome - totalExpense;
    const closingBalance = effectiveTotalIncome - effectiveTotalOutflow;

    return res.status(200).json({
      success: true,
      summary: {
        incomeOpeningBalance,
        baseExpenseOpeningBalance,
        expenseOpeningBalance,
        categoryOpeningBalance: categoryOpeningBalanceTotal,
        openingBalance: incomeOpeningBalance - expenseOpeningBalance,
        totalIncome,
        effectiveTotalIncome,
        totalGeneralExpense,
        totalPurchase,
        totalExpense,
        totalOutflow: totalExpense,
        effectiveTotalOutflow,
        netBalance,
        closingBalance,
        totalEntries: combinedLedger.length
      },
      data: combinedLedger
    });
  } catch (error) {
    console.error('getCashBook Error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// OPENING BALANCE CONTROLLERS
// ==========================================

export const getOpeningBalance = async (req, res) => {
  try {
    const activeBalance = await OpeningBalance.findOne().sort({ updatedAt: -1 }).populate('updatedBy', 'name email');
    return res.status(200).json({
      success: true,
      data: activeBalance || { incomeAmount: 0, expenseAmount: 0, amount: 0, asOfDate: new Date(), paymentMode: 'ALL', note: '' }
    });
  } catch (error) {
    console.error('getOpeningBalance Error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const setOpeningBalance = async (req, res) => {
  try {
    const { incomeAmount, expenseAmount, amount, asOfDate, paymentMode, note } = req.body;

    let obRecord = await OpeningBalance.findOne();
    if (!obRecord) {
      obRecord = new OpeningBalance();
    }

    if (incomeAmount !== undefined && incomeAmount !== null && incomeAmount !== '') {
      const parsedIncome = parseFloat(incomeAmount);
      if (!isNaN(parsedIncome)) {
        obRecord.incomeAmount = parsedIncome;
        obRecord.amount = parsedIncome;
      }
    } else if (amount !== undefined && amount !== null && amount !== '' && expenseAmount === undefined) {
      const parsedAmount = parseFloat(amount);
      if (!isNaN(parsedAmount)) {
        obRecord.incomeAmount = parsedAmount;
        obRecord.amount = parsedAmount;
      }
    }

    if (expenseAmount !== undefined && expenseAmount !== null && expenseAmount !== '') {
      const parsedExpense = parseFloat(expenseAmount);
      if (!isNaN(parsedExpense)) {
        obRecord.expenseAmount = parsedExpense;
      }
    }

    if (asOfDate) obRecord.asOfDate = new Date(asOfDate);
    if (paymentMode) obRecord.paymentMode = paymentMode;
    if (note !== undefined) obRecord.note = note;
    if (req.user?.id || req.user?._id) obRecord.updatedBy = req.user?.id || req.user?._id;

    await obRecord.save();

    return res.status(200).json({
      success: true,
      message: 'Income and Expense opening balances configured successfully.',
      data: obRecord
    });
  } catch (error) {
    console.error('setOpeningBalance Error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// EXPENSE REPORTS CONTROLLERS
// ==========================================

export const getDailyReport = async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date ? new Date(date) : new Date();
    
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const [expenses, incomes, obRecord, allCategories] = await Promise.all([
      Expense.find({ date: { $gte: startOfDay, $lte: endOfDay } }).sort({ date: -1 }),
      Income.find({ date: { $gte: startOfDay, $lte: endOfDay } }).sort({ date: -1 }),
      OpeningBalance.findOne().sort({ updatedAt: -1 }),
      ExpenseCategory.find()
    ]);

    const incomeOpeningBalance = obRecord ? (obRecord.incomeAmount ?? obRecord.amount ?? 0) : 0;
    const baseExpenseOpeningBalance = obRecord ? (obRecord.expenseAmount ?? 0) : 0;
    const categoryOpeningBalanceTotal = allCategories.reduce((sum, c) => sum + (Number(c.openingBalance) || 0), 0);
    const expenseOpeningBalance = baseExpenseOpeningBalance + categoryOpeningBalanceTotal;

    const totalIncome = incomes.reduce((sum, i) => sum + (i.amount || 0), 0);
    const purchaseTotal = expenses.filter(e => e.isPurchase || String(e.categoryName || '').toLowerCase().includes('purchase') || String(e.categoryName || '').toLowerCase().includes('inventory')).reduce((sum, e) => sum + (e.amount || 0), 0);
    const salaryTotal = expenses.filter(e => e.type === 'Salary').reduce((sum, e) => sum + (e.amount || 0), 0);
    const generalExpenseTotal = expenses.filter(e => !e.isPurchase && !String(e.categoryName || '').toLowerCase().includes('purchase') && !String(e.categoryName || '').toLowerCase().includes('inventory') && e.type !== 'Salary').reduce((sum, e) => sum + (e.amount || 0), 0);
    
    const totalOutflow = generalExpenseTotal + salaryTotal + purchaseTotal;
    const effectiveTotalIncome = incomeOpeningBalance + totalIncome;
    const effectiveTotalOutflow = expenseOpeningBalance + totalOutflow;
    const netBalance = totalIncome - totalOutflow;
    const closingBalance = effectiveTotalIncome - effectiveTotalOutflow;

    return res.status(200).json({
      success: true,
      date: startOfDay.toISOString().split('T')[0],
      summary: {
        incomeOpeningBalance,
        baseExpenseOpeningBalance,
        expenseOpeningBalance,
        categoryOpeningBalance: categoryOpeningBalanceTotal,
        openingBalance: incomeOpeningBalance - expenseOpeningBalance,
        totalIncome,
        effectiveTotalIncome,
        totalAmount: totalOutflow,
        totalOutflow,
        effectiveTotalOutflow,
        salaryTotal,
        purchaseTotal,
        generalExpenseTotal,
        netBalance,
        closingBalance,
        count: expenses.length + incomes.length
      },
      data: expenses,
      incomes
    });
  } catch (error) {
    console.error('getDailyReport Error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getMonthlyReport = async (req, res) => {
  try {
    const { year, month } = req.query;
    const current = new Date();
    const targetYear = parseInt(year || current.getFullYear(), 10);
    const targetMonth = parseInt(month || current.getMonth() + 1, 10);

    const startOfMonth = new Date(targetYear, targetMonth - 1, 1);
    const endOfMonth = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);

    const [expenses, incomes, obRecord, allCategories] = await Promise.all([
      Expense.find({ date: { $gte: startOfMonth, $lte: endOfMonth } }).sort({ date: -1 }),
      Income.find({ date: { $gte: startOfMonth, $lte: endOfMonth } }).sort({ date: -1 }),
      OpeningBalance.findOne().sort({ updatedAt: -1 }),
      ExpenseCategory.find()
    ]);

    const incomeOpeningBalance = obRecord ? (obRecord.incomeAmount ?? obRecord.amount ?? 0) : 0;
    const baseExpenseOpeningBalance = obRecord ? (obRecord.expenseAmount ?? 0) : 0;
    const categoryOpeningBalanceTotal = allCategories.reduce((sum, c) => sum + (Number(c.openingBalance) || 0), 0);
    const expenseOpeningBalance = baseExpenseOpeningBalance + categoryOpeningBalanceTotal;

    const totalIncome = incomes.reduce((sum, i) => sum + (i.amount || 0), 0);
    const purchaseTotal = expenses.filter(e => e.isPurchase || String(e.categoryName || '').toLowerCase().includes('purchase') || String(e.categoryName || '').toLowerCase().includes('inventory')).reduce((sum, e) => sum + (e.amount || 0), 0);
    const salaryTotal = expenses.filter(e => e.type === 'Salary').reduce((sum, e) => sum + (e.amount || 0), 0);
    const generalExpenseTotal = expenses.filter(e => !e.isPurchase && !String(e.categoryName || '').toLowerCase().includes('purchase') && !String(e.categoryName || '').toLowerCase().includes('inventory') && e.type !== 'Salary').reduce((sum, e) => sum + (e.amount || 0), 0);
    
    const totalOutflow = generalExpenseTotal + salaryTotal + purchaseTotal;
    const effectiveTotalIncome = incomeOpeningBalance + totalIncome;
    const effectiveTotalOutflow = expenseOpeningBalance + totalOutflow;
    const netBalance = totalIncome - totalOutflow;
    const closingBalance = effectiveTotalIncome - effectiveTotalOutflow;

    return res.status(200).json({
      success: true,
      period: `${targetYear}-${String(targetMonth).padStart(2, '0')}`,
      summary: {
        incomeOpeningBalance,
        baseExpenseOpeningBalance,
        expenseOpeningBalance,
        categoryOpeningBalance: categoryOpeningBalanceTotal,
        openingBalance: incomeOpeningBalance - expenseOpeningBalance,
        totalIncome,
        effectiveTotalIncome,
        totalAmount: totalOutflow,
        totalOutflow,
        effectiveTotalOutflow,
        salaryTotal,
        purchaseTotal,
        generalExpenseTotal,
        netBalance,
        closingBalance,
        count: expenses.length + incomes.length
      },
      data: expenses,
      incomes
    });
  } catch (error) {
    console.error('getMonthlyReport Error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getCategoryWiseReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const query = {};

    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate + 'T23:59:59.999Z');
    }

    const aggregation = await Expense.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$categoryName',
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { totalAmount: -1 } }
    ]);

    const grandTotal = aggregation.reduce((sum, item) => sum + item.totalAmount, 0);

    const categories = await ExpenseCategory.find();
    const catMap = new Map();
    categories.forEach(c => {
      catMap.set((c.name || '').toLowerCase().trim(), c);
    });

    const formattedData = aggregation.map(item => {
      const catObj = catMap.get((item._id || '').toLowerCase().trim());
      return {
        category: item._id || 'Uncategorized',
        categoryId: catObj?._id || null,
        openingBalance: catObj?.openingBalance || 0,
        totalAmount: item.totalAmount,
        count: item.count,
        percentage: grandTotal > 0 ? ((item.totalAmount / grandTotal) * 100).toFixed(2) : 0
      };
    });

    // Also include any registered categories that have opening balances or are active even if 0 expenses in date range
    categories.forEach(c => {
      const catKey = (c.name || '').toLowerCase().trim();
      const alreadyInList = formattedData.some(f => (f.category || '').toLowerCase().trim() === catKey);
      if (!alreadyInList && (Number(c.openingBalance) > 0 || c.isActive)) {
        formattedData.push({
          category: c.name,
          categoryId: c._id,
          openingBalance: Number(c.openingBalance) || 0,
          totalAmount: 0,
          count: 0,
          percentage: '0.00'
        });
      }
    });

    return res.status(200).json({
      success: true,
      summary: {
        grandTotal,
        categoryCount: formattedData.length
      },
      data: formattedData
    });
  } catch (error) {
    console.error('getCategoryWiseReport Error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getSalaryReport = async (req, res) => {
  try {
    const { month, year } = req.query;
    const query = {};

    if (month) {
      query.month = { $regex: month, $options: 'i' };
    }

    const payments = await SalaryPayment.find(query)
      .populate('employee', 'name email designation department salary employeeId')
      .sort({ paymentDate: -1 });

    const totalPaid = payments.reduce((sum, p) => sum + p.paidAmount, 0);
    const totalBasic = payments.reduce((sum, p) => sum + (p.basicSalary || 0), 0);

    return res.status(200).json({
      success: true,
      summary: {
        totalPaid,
        totalBasic,
        employeeCount: payments.length
      },
      data: payments
    });
  } catch (error) {
    console.error('getSalaryReport Error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Approve or Reject a specific Salary Payment (MD / Admin action)
 * PUT /api/v1/accounts/salary-payments/:id/action
 */
export const approveOrRejectSalaryPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, rejectionReason } = req.body; // action: 'APPROVED' | 'REJECTED'
    const actorId = req.user?.id || req.user?._id;

    if (!['APPROVED', 'REJECTED'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Action must be APPROVED or REJECTED.' });
    }

    const salaryPayment = await SalaryPayment.findById(id);
    if (!salaryPayment) {
      return res.status(404).json({ success: false, message: 'Salary payment record not found.' });
    }

    let actorName = req.user?.name || req.user?.email || 'Executive';
    if (actorId) {
      const u = await User.findById(actorId).select('name');
      if (u) actorName = u.name;
    }

    salaryPayment.status = action;
    salaryPayment.actionBy = actorId || null;
    salaryPayment.actionByName = actorName;
    salaryPayment.actionAt = new Date();

    if (action === 'REJECTED') {
      salaryPayment.rejectionReason = rejectionReason ? rejectionReason.trim() : '';
    } else {
      salaryPayment.rejectionReason = '';
    }

    await salaryPayment.save();

    // Sync status change to synced expense record in expenses collection
    await Expense.updateMany(
      { $or: [{ salaryPaymentId: id }, { _id: salaryPayment.expenseId }] },
      {
        $set: {
          status: action,
          actionBy: actorId || null,
          actionByName: actorName,
          actionAt: new Date(),
          rejectionReason: action === 'REJECTED' ? (rejectionReason ? rejectionReason.trim() : '') : ''
        }
      }
    );

    return res.status(200).json({
      success: true,
      message: `Salary payment ${action.toLowerCase()} successfully.`,
      data: salaryPayment
    });
  } catch (error) {
    console.error('approveOrRejectSalaryPayment Error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Bulk Approve all pending Salary Payments in one click (MD / Executive action)
 * PUT /api/v1/accounts/salary-payments/approve-all
 */
export const approveAllSalaryPayments = async (req, res) => {
  try {
    const actorId = req.user?.id || req.user?._id;
    let actorName = req.user?.name || req.user?.email || 'Executive';
    if (actorId) {
      const u = await User.findById(actorId).select('name');
      if (u) actorName = u.name;
    }

    const pendingSalaries = await SalaryPayment.find({ status: 'PENDING' });
    const pendingIds = pendingSalaries.map(s => s._id);

    const result = await SalaryPayment.updateMany(
      { _id: { $in: pendingIds } },
      {
        $set: {
          status: 'APPROVED',
          actionBy: actorId || null,
          actionByName: actorName,
          actionAt: new Date(),
          rejectionReason: ''
        }
      }
    );

    await Expense.updateMany(
      { salaryPaymentId: { $in: pendingIds } },
      {
        $set: {
          status: 'APPROVED',
          actionBy: actorId || null,
          actionByName: actorName,
          actionAt: new Date(),
          rejectionReason: ''
        }
      }
    );

    return res.status(200).json({
      success: true,
      message: `Approved ${result.modifiedCount || 0} pending salary payment(s) successfully.`,
      modifiedCount: result.modifiedCount || 0
    });
  } catch (error) {
    console.error('approveAllSalaryPayments Error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * MD Approval / Rejection for Expense (> 1000 INR)
 * PUT /api/v1/accounts/expenses/:id/action
 */
export const approveOrRejectExpense = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, rejectionReason } = req.body;

    const expense = await Expense.findById(id);
    if (!expense) {
      return res.status(404).json({ success: false, message: 'Expense record not found.' });
    }

    let actionByName = req.user?.name || req.user?.email || 'Managing Director';
    if (req.user?.id) {
      const u = await User.findById(req.user.id).select('name');
      if (u) actionByName = u.name;
    }

    if (action === 'APPROVED') {
      expense.status = 'APPROVED';
      expense.actionBy = req.user?.id || null;
      expense.actionByName = actionByName;
      expense.actionAt = new Date();
      expense.rejectionReason = '';
    } else if (action === 'REJECTED') {
      expense.status = 'REJECTED';
      expense.actionBy = req.user?.id || null;
      expense.actionByName = actionByName;
      expense.actionAt = new Date();
      expense.rejectionReason = rejectionReason ? rejectionReason.trim() : 'Rejected by MD';
    } else {
      return res.status(400).json({ success: false, message: 'Invalid action. Must be APPROVED or REJECTED.' });
    }

    await expense.save();

    return res.status(200).json({
      success: true,
      message: `Expense ${action.toLowerCase()} successfully.`,
      data: expense
    });
  } catch (error) {
    console.error('approveOrRejectExpense Error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Send official Salary Payslip to employee via email
 * POST /api/v1/accounts/salary-payments/:id/send-email
 */
export const sendSalaryPayslipEmail = async (req, res) => {
  try {
    const { id } = req.params;
    const { email } = req.body;

    const payment = await SalaryPayment.findById(id).populate('employee', 'name email designation employeeId');
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Salary payment record not found.' });
    }

    const recipientEmail = (email && email.trim()) || payment.employee?.email;
    if (!recipientEmail) {
      return res.status(400).json({ success: false, message: 'Recipient email address is required.' });
    }

    const empName = payment.employeeName || payment.employee?.name || 'Employee';
    const month = payment.month || 'Current Month';
    const netPay = (payment.paidAmount || 0).toLocaleString('en-IN');
    const empId = payment.kbEmployeeId || payment.employee?.employeeId || 'KB-EMP-001';
    const payDate = payment.paymentDate ? new Date(payment.paymentDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
        <div style="background-color: #4f46e5; color: #ffffff; padding: 24px; text-align: center;">
          <h2 style="margin: 0; font-size: 20px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">KOD.BRAND</h2>
          <p style="margin: 4px 0 0 0; font-size: 12px; opacity: 0.9;">Official Employee Salary Payslip — ${month}</p>
        </div>

        <div style="padding: 24px; color: #334155;">
          <p style="font-size: 14px; margin-top: 0;">Dear <strong>${empName}</strong>,</p>
          <p style="font-size: 13px; color: #64748b; line-height: 1.5;">
            Your salary payslip statement for <strong>${month}</strong> has been generated. Please find the disbursal details below:
          </p>

          <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13px;">
            <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 10px; font-weight: bold; color: #475569;">Employee Name</td>
              <td style="padding: 10px; text-align: right; font-weight: bold; color: #0f172a;">${empName}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 10px; font-weight: bold; color: #475569;">Employee ID</td>
              <td style="padding: 10px; text-align: right; color: #0f172a;">${empId}</td>
            </tr>
            <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 10px; font-weight: bold; color: #475569;">Pay Period</td>
              <td style="padding: 10px; text-align: right; color: #0f172a;">${payment.payPeriod || month}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 10px; font-weight: bold; color: #475569;">Disbursal Date</td>
              <td style="padding: 10px; text-align: right; color: #0f172a;">${payDate}</td>
            </tr>
            <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 10px; font-weight: bold; color: #475569;">Payment Mode</td>
              <td style="padding: 10px; text-align: right; color: #0f172a;">${payment.paymentMode || 'Bank'}</td>
            </tr>
            <tr style="background-color: #e0e7ff; border-top: 2px solid #6366f1;">
              <td style="padding: 12px; font-weight: bold; color: #3730a3; font-size: 14px;">Net Salary Disbursed</td>
              <td style="padding: 12px; text-align: right; font-weight: bold; color: #3730a3; font-size: 16px;">₹${netPay}</td>
            </tr>
          </table>

          <p style="font-size: 12px; color: #94a3b8; text-align: center; margin-top: 24px; border-top: 1px solid #f1f5f9; padding-top: 16px;">
            This is an official computer-generated salary advice statement issued by KOD.BRAND HR & Payroll Department.
          </p>
        </div>
      </div>
    `;

    const emailResult = await sendEmail({
      to: recipientEmail,
      subject: `Official Salary Payslip Statement — ${month} | ${empName}`,
      htmlContent,
      senderName: 'KOD.BRAND Payroll'
    });

    return res.status(200).json({
      success: true,
      message: `Payslip email sent successfully to ${recipientEmail}.`,
      data: emailResult
    });
  } catch (error) {
    console.error('sendSalaryPayslipEmail Error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// INCOME CONTROLLERS
// ==========================================

export const getIncomes = async (req, res) => {
  try {
    const { department, paymentMethod, startDate, endDate, search, status, isInactive } = req.query;
    const query = {};

    if (status === 'Inactive' || isInactive === 'true' || isInactive === true) {
      query.$or = [{ status: 'Inactive' }, { isDeleted: true }];
    } else {
      query.status = { $ne: 'Inactive' };
      query.isDeleted = { $ne: true };
    }

    if (department && department !== 'all') {
      query.department = { $regex: new RegExp(`^${department.trim()}$`, 'i') };
    }

    if (paymentMethod && paymentMethod !== 'all') {
      query.paymentMethod = paymentMethod;
    }

    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate + 'T23:59:59.999Z');
    }

    if (search && search.trim()) {
      const q = search.trim();
      const searchConditions = [
        { title: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { referenceNo: { $regex: q, $options: 'i' } },
        { department: { $regex: q, $options: 'i' } },
        { createdByName: { $regex: q, $options: 'i' } },
        { clientName: { $regex: q, $options: 'i' } },
        { subject: { $regex: q, $options: 'i' } }
      ];

      if (query.$or) {
        query.$and = [
          { $or: query.$or },
          { $or: searchConditions }
        ];
        delete query.$or;
      } else {
        query.$or = searchConditions;
      }
    }

    const incomes = await Income.find(query).sort({ date: -1, createdAt: -1 }).populate('client');

    const totalIncome = incomes.reduce((sum, item) => sum + (item.amount || 0), 0);

    // Group by department
    const deptBreakdown = incomes.reduce((acc, item) => {
      const d = item.department || 'General';
      acc[d] = (acc[d] || 0) + (item.amount || 0);
      return acc;
    }, {});

    return res.status(200).json({
      success: true,
      summary: {
        totalIncome,
        totalEntries: incomes.length,
        departmentBreakdown: deptBreakdown
      },
      data: incomes
    });
  } catch (error) {
    console.error('getIncomes Error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getIncomeById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(String(id))) {
      return res.status(400).json({ success: false, message: 'Invalid income record ID.' });
    }

    const income = await Income.findById(id).populate('client');
    if (!income) {
      return res.status(404).json({ success: false, message: 'Income record not found.' });
    }

    return res.status(200).json({ success: true, data: income });
  } catch (error) {
    console.error('getIncomeById Error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createIncome = async (req, res) => {
  try {
    const { 
      title, 
      amount, 
      department, 
      paymentMethod, 
      date, 
      referenceNo, 
      description,
      sourceType,
      client,
      clientName,
      taxOption,
      gstCategory,
      gstRate,
      gstAmount,
      cgstAmount,
      sgstAmount,
      igstAmount,
      totalAmount
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Income title / source is required.' });
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Valid positive income amount is required.' });
    }

    if (!department || !department.trim()) {
      return res.status(400).json({ success: false, message: 'Department is required.' });
    }

    const creatorId = req.user?.id || req.user?._id;
    const creatorName = req.user?.name || 'Accountant';

    let finalSourceType = sourceType;
    if (!finalSourceType || !['Academy', 'Client', 'General'].includes(finalSourceType)) {
      if (client || (clientName && clientName.trim())) {
        finalSourceType = 'Client';
      } else if (department && department.trim() === 'Academy & LMS') {
        finalSourceType = 'Academy';
      } else {
        finalSourceType = 'General';
      }
    }

    let finalReferenceNo = referenceNo ? referenceNo.trim() : '';
    if (finalReferenceNo) {
      // Ensure referenceNo is unique across ALL records (both active and inactive)
      const existingRef = await Income.findOne({ referenceNo: finalReferenceNo });
      if (existingRef) {
        return res.status(400).json({
          success: false,
          message: `Invoice No. '${finalReferenceNo}' already exists (in active or inactive records). Invoice numbers cannot be repeated.`
        });
      }
    } else {
      const prefix = finalSourceType === 'Client' ? 'INV-KB-C' : finalSourceType === 'Academy' ? 'INV-KB-A' : 'INV-KB-G';
      const totalCount = await Income.countDocuments({});
      let nextNum = 1001 + totalCount;
      finalReferenceNo = `${prefix}${nextNum}`;
      while (await Income.findOne({ referenceNo: finalReferenceNo })) {
        nextNum++;
        finalReferenceNo = `${prefix}${nextNum}`;
      }
    }

    const inputStatus = req.body.status || 'Pending';

    let finalReceiptNo = req.body.receiptNo ? req.body.receiptNo.trim() : '';
    if (finalReceiptNo) {
      const existingRec = await Income.findOne({ receiptNo: finalReceiptNo });
      if (existingRec) {
        return res.status(400).json({
          success: false,
          message: `Receipt No. '${finalReceiptNo}' already exists (in active or inactive records). Receipt numbers cannot be repeated.`
        });
      }
    } else if (inputStatus === 'Paid') {
      const recPrefix = finalSourceType === 'Client' ? 'REC-KB-C' : finalSourceType === 'Academy' ? 'REC-KB-A' : 'REC-KB-G';
      const rCount = await Income.countDocuments({ receiptNo: { $ne: '' } });
      let nextRecNum = 1001 + rCount;
      finalReceiptNo = `${recPrefix}${nextRecNum}`;
      while (await Income.findOne({ receiptNo: finalReceiptNo })) {
        nextRecNum++;
        finalReceiptNo = `${recPrefix}${nextRecNum}`;
      }
    }

    const income = new Income({
      title: title.trim(),
      amount: parsedAmount,
      department: department.trim(),
      paymentMethod: paymentMethod || 'Bank Transfer',
      date: date ? new Date(date) : new Date(),
      referenceNo: finalReferenceNo,
      description: description ? description.trim() : '',
      sourceType: finalSourceType,
      client: client && mongoose.Types.ObjectId.isValid(String(client)) ? client : null,
      clientName: clientName ? clientName.trim() : '',
      taxOption: taxOption || 'No GST',
      gstCategory: gstCategory || 'NONE',
      gstRate: parseFloat(gstRate || 0),
      gstAmount: parseFloat(gstAmount || 0),
      cgstAmount: parseFloat(cgstAmount || 0),
      sgstAmount: parseFloat(sgstAmount || 0),
      igstAmount: parseFloat(igstAmount || 0),
      totalAmount: parseFloat(totalAmount || parsedAmount),
      status: inputStatus,
      dueDate: req.body.dueDate ? new Date(req.body.dueDate) : new Date(Date.now() + 15*24*60*60*1000),
      orderNumber: req.body.orderNumber ? req.body.orderNumber.trim() : '',
      paymentTerms: req.body.paymentTerms || 'Due on Receipt',
      accountsReceivable: req.body.accountsReceivable || 'Accounts Receivable',
      salesperson: req.body.salesperson ? req.body.salesperson.trim() : '',
      subject: req.body.subject ? req.body.subject.trim() : '',
      discountRate: parseFloat(req.body.discountRate || 0),
      discountAmount: parseFloat(req.body.discountAmount || 0),
      tdsAmount: parseFloat(req.body.tdsAmount || 0),
      tcsAmount: parseFloat(req.body.tcsAmount || 0),
      adjustment: parseFloat(req.body.adjustment || 0),
      receiptNo: finalReceiptNo,
      receiptDate: req.body.receiptDate ? new Date(req.body.receiptDate) : (finalReceiptNo ? new Date() : null),
      receiptAmount: (inputStatus === 'Paid' || inputStatus === 'Partially Paid') 
        ? parseFloat(req.body.receiptAmount !== undefined ? req.body.receiptAmount : (totalAmount || parsedAmount))
        : 0,
      lineItems: Array.isArray(req.body.lineItems) && req.body.lineItems.length > 0 
        ? req.body.lineItems.map(item => ({
            description: item.description || title.trim(),
            quantity: parseFloat(item.quantity || 1),
            unitPrice: parseFloat(item.unitPrice || 0),
            amount: parseFloat(item.amount || 0)
          }))
        : [{ description: title.trim(), quantity: 1, unitPrice: parsedAmount, amount: parsedAmount }],
      notes: req.body.notes ? req.body.notes.trim() : 'Thanks for your business.',
      terms: req.body.terms ? req.body.terms.trim() : 'Payment due within 15 days.',
      createdBy: creatorId,
      createdByName: creatorName
    });

    await income.save();

    const populatedDoc = await Income.findById(income._id).populate('client');

    return res.status(201).json({
      success: true,
      message: 'Income record saved successfully.',
      data: populatedDoc || income
    });
  } catch (error) {
    console.error('createIncome Error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateIncome = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(String(id))) {
      return res.status(400).json({ success: false, message: 'Invalid income ID.' });
    }

    const { 
      title, 
      amount, 
      department, 
      paymentMethod, 
      date, 
      referenceNo, 
      description,
      sourceType,
      client,
      clientName,
      taxOption,
      gstRate,
      gstAmount,
      totalAmount
    } = req.body;

    const income = await Income.findById(id);
    if (!income) {
      return res.status(404).json({ success: false, message: 'Income record not found.' });
    }

    if (title !== undefined) income.title = title.trim();
    if (amount !== undefined) {
      const parsed = parseFloat(amount);
      if (!isNaN(parsed) && parsed >= 0) {
        income.amount = parsed;
        if (Array.isArray(income.lineItems) && income.lineItems.length > 0) {
          income.lineItems[0].unitPrice = parsed;
          income.lineItems[0].amount = parsed * (income.lineItems[0].quantity || 1);
        }
      }
    }
    if (department !== undefined) income.department = department.trim();
    if (paymentMethod !== undefined) income.paymentMethod = paymentMethod;
    if (date !== undefined) income.date = new Date(date);
    if (referenceNo !== undefined) {
      const trimmedRef = referenceNo.trim();
      if (trimmedRef && trimmedRef !== income.referenceNo) {
        const existingRef = await Income.findOne({ referenceNo: trimmedRef, _id: { $ne: id } });
        if (existingRef) {
          return res.status(400).json({
            success: false,
            message: `Invoice No. '${trimmedRef}' already exists (in active or inactive records). Invoice numbers cannot be repeated.`
          });
        }
      }
      income.referenceNo = trimmedRef;
    }
    if (description !== undefined) income.description = description.trim();
    if (sourceType !== undefined) income.sourceType = sourceType;
    if (client !== undefined) income.client = client && mongoose.Types.ObjectId.isValid(String(client)) ? client : null;
    if (clientName !== undefined) income.clientName = clientName.trim();
    if (taxOption !== undefined) income.taxOption = taxOption;
    if (gstRate !== undefined) income.gstRate = parseFloat(gstRate || 0);
    if (gstAmount !== undefined) income.gstAmount = parseFloat(gstAmount || 0);
    if (totalAmount !== undefined) income.totalAmount = parseFloat(totalAmount || income.amount);
    
    if (req.body.status !== undefined) {
      income.status = req.body.status;
      if ((req.body.status === 'Paid' || req.body.status === 'Partially Paid') && !income.receiptNo) {
        const sType = income.sourceType || 'General';
        const recPrefix = sType === 'Client' ? 'REC-KB-C' : sType === 'Academy' ? 'REC-KB-A' : 'REC-KB-G';
        const rCount = await Income.countDocuments({ receiptNo: { $ne: '' } });
        income.receiptNo = `${recPrefix}${1001 + rCount}`;
        income.receiptDate = new Date();
      }
    }
    if (req.body.dueDate !== undefined) income.dueDate = new Date(req.body.dueDate);
    if (req.body.orderNumber !== undefined) income.orderNumber = req.body.orderNumber.trim();
    if (req.body.paymentTerms !== undefined) income.paymentTerms = req.body.paymentTerms;
    if (req.body.accountsReceivable !== undefined) income.accountsReceivable = req.body.accountsReceivable;
    if (req.body.salesperson !== undefined) income.salesperson = req.body.salesperson.trim();
    if (req.body.subject !== undefined) income.subject = req.body.subject.trim();
    if (req.body.discountRate !== undefined) income.discountRate = parseFloat(req.body.discountRate || 0);
    if (req.body.discountAmount !== undefined) income.discountAmount = parseFloat(req.body.discountAmount || 0);
    if (req.body.tdsAmount !== undefined) income.tdsAmount = parseFloat(req.body.tdsAmount || 0);
    if (req.body.tcsAmount !== undefined) income.tcsAmount = parseFloat(req.body.tcsAmount || 0);
    if (req.body.adjustment !== undefined) income.adjustment = parseFloat(req.body.adjustment || 0);
    if (req.body.receiptNo !== undefined) income.receiptNo = req.body.receiptNo.trim();
    if (req.body.receiptDate !== undefined) income.receiptDate = new Date(req.body.receiptDate);
    
    if (!Array.isArray(income.payments)) {
      income.payments = [];
    }

    if (req.body.newPayment && typeof req.body.newPayment === 'object') {
      income.payments.push({
        receiptNo: req.body.newPayment.receiptNo || income.receiptNo || '',
        receiptDate: req.body.newPayment.receiptDate ? new Date(req.body.newPayment.receiptDate) : new Date(),
        amount: parseFloat(req.body.newPayment.amount || 0),
        paymentMethod: req.body.newPayment.paymentMethod || income.paymentMethod || 'Bank Transfer',
        notes: req.body.newPayment.notes || ''
      });
    } else if (req.body.receiptAmount !== undefined) {
      const parsedRec = parseFloat(req.body.receiptAmount);
      if (!isNaN(parsedRec) && parsedRec >= 0) {
        if (req.body.addSettlement === true) {
          income.payments.push({
            receiptNo: req.body.receiptNo || income.receiptNo || '',
            receiptDate: req.body.receiptDate ? new Date(req.body.receiptDate) : new Date(),
            amount: parsedRec,
            paymentMethod: req.body.paymentMethod || income.paymentMethod || 'Bank Transfer',
            notes: req.body.notes || ''
          });
        } else if (income.payments.length > 0) {
          const lastIdx = income.payments.length - 1;
          income.payments[lastIdx].amount = parsedRec;
          if (req.body.receiptNo) income.payments[lastIdx].receiptNo = req.body.receiptNo;
          if (req.body.receiptDate) income.payments[lastIdx].receiptDate = new Date(req.body.receiptDate);
          if (req.body.paymentMethod) income.payments[lastIdx].paymentMethod = req.body.paymentMethod;
          if (req.body.notes) income.payments[lastIdx].notes = req.body.notes;
        } else if (parsedRec > 0) {
          income.payments.push({
            receiptNo: req.body.receiptNo || income.receiptNo || '',
            receiptDate: req.body.receiptDate ? new Date(req.body.receiptDate) : new Date(),
            amount: parsedRec,
            paymentMethod: req.body.paymentMethod || income.paymentMethod || 'Bank Transfer',
            notes: req.body.notes || ''
          });
        }
      }
    }

    const finalTotAmt = parseFloat(req.body.totalAmount !== undefined ? req.body.totalAmount : (income.totalAmount || income.amount || 0));
    if (req.body.totalAmount !== undefined) income.totalAmount = finalTotAmt;
    if (req.body.amount !== undefined) income.amount = parseFloat(req.body.amount || finalTotAmt);

    // Dynamic Status calculated strictly from logged installment payments & balance due
    const totalCollectedLogs = Array.isArray(income.payments) && income.payments.length > 0
      ? income.payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0)
      : parseFloat(req.body.receiptAmount !== undefined ? req.body.receiptAmount : (income.receiptAmount || 0));

    income.receiptAmount = totalCollectedLogs;
    const balanceDueLogs = Math.max(0, finalTotAmt - totalCollectedLogs);

    if (req.body.status === 'Paid') {
      income.status = 'Paid';
      income.receiptAmount = finalTotAmt;
      if (!income.payments || income.payments.length === 0) {
        income.payments = [{
          receiptNo: income.receiptNo || 'REC-KB-1001',
          receiptDate: income.receiptDate || new Date(),
          amount: finalTotAmt,
          paymentMethod: income.paymentMethod || 'Bank Transfer',
          notes: 'Marked as Paid in full'
        }];
      }
    } else if (req.body.status === 'Pending') {
      income.status = 'Pending';
      income.receiptAmount = 0;
      income.payments = [];
    } else if (totalCollectedLogs <= 0) {
      income.status = 'Pending';
    } else if (balanceDueLogs <= 0.01 || totalCollectedLogs >= (finalTotAmt - 0.01)) {
      income.status = 'Paid';
    } else {
      income.status = 'Partially Paid';
    }
    if (Array.isArray(req.body.lineItems) && req.body.lineItems.length > 0) {
      income.lineItems = req.body.lineItems.map(item => ({
        description: item.description || income.title || '',
        quantity: parseFloat(item.quantity || 1),
        unitPrice: parseFloat(item.unitPrice || 0),
        amount: parseFloat(item.amount || 0)
      }));
    }
    if (req.body.notes !== undefined) income.notes = req.body.notes.trim();
    if (req.body.terms !== undefined) income.terms = req.body.terms.trim();

    await income.save();

    const populatedIncome = await Income.findById(income._id).populate('client');

    return res.status(200).json({
      success: true,
      message: 'Income record updated successfully.',
      data: populatedIncome || income
    });
  } catch (error) {
    console.error('updateIncome Error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteIncome = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(String(id))) {
      return res.status(400).json({ success: false, message: 'Invalid income ID.' });
    }

    const income = await Income.findById(id);
    if (!income) {
      return res.status(404).json({ success: false, message: 'Income record not found.' });
    }

    income.status = 'Inactive';
    income.isDeleted = true;
    income.deletedAt = new Date();
    await income.save();

    return res.status(200).json({
      success: true,
      message: 'Invoice moved to Inactive tab successfully.'
    });
  } catch (error) {
    console.error('deleteIncome Error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const restoreIncome = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(String(id))) {
      return res.status(400).json({ success: false, message: 'Invalid income ID.' });
    }

    const income = await Income.findById(id);
    if (!income) {
      return res.status(404).json({ success: false, message: 'Income record not found.' });
    }

    const recPaid = parseFloat(income.receiptAmount || 0);
    const targetStatus = (recPaid > 0 && recPaid >= (income.totalAmount || income.amount || 0))
      ? 'Paid'
      : (recPaid > 0 ? 'Partially Paid' : 'Pending');

    income.status = targetStatus;
    income.isDeleted = false;
    income.deletedAt = null;
    await income.save();

    return res.status(200).json({
      success: true,
      message: 'Invoice restored successfully to active list.'
    });
  } catch (error) {
    console.error('restoreIncome Error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const permanentDeleteIncome = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(String(id))) {
      return res.status(400).json({ success: false, message: 'Invalid income ID.' });
    }

    await Income.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: 'Income record permanently deleted.'
    });
  } catch (error) {
    console.error('permanentDeleteIncome Error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const recordPaymentSettlement = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, paymentMethod, receiptNo, receiptDate, notes } = req.body;

    if (!id || !mongoose.Types.ObjectId.isValid(String(id))) {
      return res.status(400).json({ success: false, message: 'Invalid income record ID.' });
    }

    const income = await Income.findById(id);
    if (!income) {
      return res.status(404).json({ success: false, message: 'Income record not found.' });
    }

    const parsedAmount = parseFloat(amount || 0);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Please enter a valid settlement amount.' });
    }

    if (!Array.isArray(income.payments)) {
      income.payments = [];
    }

    let finalRecNo = receiptNo && receiptNo.trim() ? receiptNo.trim() : income.receiptNo;
    if (!finalRecNo) {
      const sType = income.sourceType || 'General';
      const recPrefix = sType === 'Client' ? 'REC-KB-C' : sType === 'Academy' ? 'REC-KB-A' : 'REC-KB-G';
      const count = income.payments.length + 1;
      const mongoIdNum = String(income._id).slice(-4).toUpperCase();
      finalRecNo = `${recPrefix}${mongoIdNum}-${count}`;
    }

    const newPaymentEntry = {
      receiptNo: finalRecNo,
      receiptDate: receiptDate ? new Date(receiptDate) : new Date(),
      amount: parsedAmount,
      paymentMethod: paymentMethod || income.paymentMethod || 'Bank Transfer',
      notes: notes ? notes.trim() : 'Payment settlement logged',
      createdAt: new Date()
    };

    income.payments.push(newPaymentEntry);
    income.receiptNo = finalRecNo;
    income.receiptDate = newPaymentEntry.receiptDate;

    const totalCollected = income.payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    income.receiptAmount = totalCollected;

    const totalBilled = income.totalAmount || income.amount || 0;
    const balanceDue = Math.max(0, totalBilled - totalCollected);

    if (totalCollected <= 0) {
      income.status = 'Pending';
    } else if (balanceDue <= 0.01 || totalCollected >= (totalBilled - 0.01)) {
      income.status = 'Paid';
    } else {
      income.status = 'Partially Paid';
    }

    await income.save();

    const populatedDoc = await Income.findById(income._id).populate('client');

    return res.status(200).json({
      success: true,
      message: 'Payment settlement logged successfully.',
      data: populatedDoc || income
    });
  } catch (error) {
    console.error('recordPaymentSettlement Error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

