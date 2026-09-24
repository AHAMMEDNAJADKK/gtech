import { DailyRoutine, RoutineTemplate, DepartmentBriefing, EodClosure, ManagerToDo } from '../models/dailyOperations.model.js';
import User from '../models/user.model.js';
import Department from '../modules/departments/department.model.js';
import { sendSuccess, sendError } from '../utils/response.helper.js';

const DEFAULT_ROUTINES = [
  { time: '09:30', title: 'Attendance & Check-in', subtitle: 'All Teams' },
  { time: '09:45', title: 'Department Daily Briefing', subtitle: 'All Teams' },
  { time: '10:00', title: 'Priority Execution Window', subtitle: 'All Teams' },
  { time: '13:00', title: 'Mid-day Project Health Review', subtitle: 'All Teams' },
  { time: '16:30', title: 'Client / Delivery Review', subtitle: 'All Teams' },
  { time: '17:00', title: 'EOD Reporting & Escalation', subtitle: 'All Teams' },
  { time: '17:30', title: 'Management Daily Review', subtitle: 'All Teams' }
];

const isExcludedDepartment = (deptName) => {
  if (!deptName) return true;
  const lower = String(deptName).toLowerCase().trim();
  return lower === 'user' || lower === 'users' || lower === 'user accounts';
};

const getTargetDepartments = async () => {
  try {
    const depts = await Department.find({ status: true });
    const activeNames = depts
      .map(d => d.name || d.departmentName || d.title)
      .filter(Boolean)
      .filter(name => !isExcludedDepartment(name));
    if (activeNames.length > 0) return activeNames;
  } catch (err) {}
  return [];
};

const expandRoutineDocs = (itemsList, activeDepts, dateString) => {
  const resultDocs = [];
  itemsList.forEach(item => {
    const sub = String(item.subtitle || '').toLowerCase().trim();
    const isGeneral = !sub || sub.includes('all') || sub.includes('general') || sub.includes('heads') || sub.includes('teams');

    if (!isGeneral) {
      resultDocs.push({
        dateString,
        time: item.time,
        title: item.title,
        subtitle: item.subtitle,
        status: item.status || 'pending'
      });
    } else {
      activeDepts.forEach(dept => {
        resultDocs.push({
          dateString,
          time: item.time,
          title: item.title,
          subtitle: dept,
          status: item.status || 'pending'
        });
      });
    }
  });
  return resultDocs;
};

const getTodayDateString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Fetch all Daily Operations data for a given date (defaults to today)
 */
export const getDailyOperations = async (req, res) => {
  try {
    const dateString = req.query.date || getTodayDateString();
    const targetDepts = await getTargetDepartments();

    // Ensure RoutineTemplate has initial defaults if zero templates exist in DB
    const templateCount = await RoutineTemplate.countDocuments();
    if (templateCount === 0) {
      const existingRoutines = await DailyRoutine.find({});
      if (existingRoutines && existingRoutines.length > 0) {
        const templateMap = new Map();
        existingRoutines.forEach(r => {
          const key = `${r.time}_${r.title.toLowerCase()}_${(r.subtitle || '').toLowerCase()}`;
          if (!templateMap.has(key)) {
            templateMap.set(key, {
              time: r.time,
              title: r.title,
              subtitle: r.subtitle,
              startDateString: r.dateString || getTodayDateString(),
              isActive: true
            });
          }
        });
        await RoutineTemplate.insertMany(Array.from(templateMap.values()));
      } else {
        const baseDocs = expandRoutineDocs(DEFAULT_ROUTINES, targetDepts, getTodayDateString());
        const initialTemplates = baseDocs.map(t => ({
          time: t.time,
          title: t.title,
          subtitle: t.subtitle,
          startDateString: t.dateString,
          isActive: true
        }));
        await RoutineTemplate.insertMany(initialTemplates);
      }
    }

    // Fetch existing routine items for the date
    let routines = await DailyRoutine.find({ dateString }).sort({ time: 1 });

    // Fetch active recurring templates starting on or before dateString
    const recurringTemplates = await RoutineTemplate.find({
      isActive: true,
      startDateString: { $lte: dateString }
    }).sort({ time: 1 });

    // If routines for dateString is completely empty, populate from recurringTemplates
    if (!routines || routines.length === 0) {
      const recurringDocs = expandRoutineDocs(recurringTemplates, targetDepts, dateString);
      const combinedMap = new Map();
      recurringDocs.forEach(item => {
        const key = `${item.time}_${item.title.toLowerCase()}_${(item.subtitle || '').toLowerCase()}`;
        if (!combinedMap.has(key)) {
          combinedMap.set(key, item);
        }
      });

      const docsToInsert = Array.from(combinedMap.values());
      if (docsToInsert.length > 0) {
        routines = await DailyRoutine.insertMany(docsToInsert);
      }
    } else {
      // Migrate any legacy shared routines into per-department routines
      const generalShared = routines.filter(r => {
        const sub = String(r.subtitle || '').toLowerCase().trim();
        return (
          sub.includes(',') ||
          sub.includes('all') ||
          sub.includes('general') ||
          sub.includes('heads') ||
          sub.includes('hr & administration') ||
          sub.includes('project managers') ||
          sub.includes('md / management')
        );
      });

      if (generalShared.length > 0) {
        for (const sharedRoutine of generalShared) {
          await DailyRoutine.findByIdAndDelete(sharedRoutine._id);
          const rawSub = String(sharedRoutine.subtitle || '').trim();
          let deptsToUse = targetDepts;
          if (rawSub.includes(',')) {
            const parsed = rawSub.split(',').map(d => d.trim()).filter(Boolean).filter(d => !isExcludedDepartment(d));
            if (parsed.length > 0) deptsToUse = parsed;
          }

          const expanded = deptsToUse.map(dept => ({
            dateString,
            time: sharedRoutine.time,
            title: sharedRoutine.title,
            subtitle: dept,
            status: 'pending'
          }));
          await DailyRoutine.insertMany(expanded);
        }
        routines = await DailyRoutine.find({ dateString }).sort({ time: 1 });
      }
    }

    // Ensure any active recurring template starting on or before dateString is included
    const existingKeys = new Set(routines.map(r => `${r.time}_${r.title.toLowerCase()}_${(r.subtitle || '').toLowerCase()}`));
    const missingDocs = [];

    const expandedTemplates = expandRoutineDocs(recurringTemplates, targetDepts, dateString);
    expandedTemplates.forEach(t => {
      const key = `${t.time}_${t.title.toLowerCase()}_${(t.subtitle || '').toLowerCase()}`;
      if (!existingKeys.has(key)) {
        existingKeys.add(key);
        missingDocs.push({
          dateString,
          time: t.time,
          title: t.title,
          subtitle: t.subtitle,
          status: 'pending'
        });
      }
    });

    if (missingDocs.length > 0) {
      const newlyInserted = await DailyRoutine.insertMany(missingDocs);
      routines = [...routines, ...newlyInserted].sort((a, b) => a.time.localeCompare(b.time));
    }

    // Fetch department briefings with populated submitter
    const briefings = await DepartmentBriefing.find({ dateString })
      .populate('submittedBy', 'name email department')
      .sort({ createdAt: -1 });

    // Fetch EOD closures with populated user
    const eodClosures = await EodClosure.find({ dateString })
      .populate('user', 'name email department')
      .sort({ createdAt: -1 });

    // Format briefings & EOD closures to ensure exact submitter name is resolved
    const formattedBriefings = briefings.map(bDoc => {
      const b = bDoc.toObject();
      let resolvedName = b.submittedByName;
      if (b.submittedBy && typeof b.submittedBy === 'object' && b.submittedBy.name) {
        resolvedName = b.submittedBy.name;
      } else if (!resolvedName || resolvedName === 'User') {
        resolvedName = 'Team Lead';
      }
      return {
        ...b,
        submittedByName: resolvedName
      };
    });

    const formattedEodClosures = eodClosures.map(eodDoc => {
      const eod = eodDoc.toObject();
      let resolvedName = eod.userName;
      if (eod.user && typeof eod.user === 'object' && eod.user.name) {
        resolvedName = eod.user.name;
      } else if (!resolvedName || resolvedName === 'User') {
        resolvedName = 'Staff Member';
      }
      return {
        ...eod,
        userName: resolvedName
      };
    });

    // Fetch Manager To-Do Checklist Items for dateString
    const managerToDos = await ManagerToDo.find({ dateString }).sort({ createdAt: -1 });

    return sendSuccess(res, 'Daily Operations retrieved successfully', {
      dateString,
      routines,
      briefings: formattedBriefings,
      eodClosures: formattedEodClosures,
      managerToDos
    });
  } catch (error) {
    console.error('Error fetching Daily Operations:', error);
    return sendError(res, error.message || 'Failed to fetch Daily Operations', 500);
  }
};

/**
 * Toggle status of a Routine item (pending <-> completed)
 */
export const toggleRoutineStatus = async (req, res) => {
  try {
    const { routineId } = req.params;
    const routine = await DailyRoutine.findById(routineId);

    if (!routine) {
      return sendError(res, 'Routine item not found', 404);
    }

    const newStatus = routine.status === 'completed' ? 'pending' : 'completed';
    routine.status = newStatus;
    routine.completedBy = newStatus === 'completed' ? (req.user._id || req.user.id) : null;
    routine.completedByName = newStatus === 'completed' ? (req.user.name || 'User') : '';
    routine.completedAt = newStatus === 'completed' ? new Date() : null;

    await routine.save();

    return sendSuccess(res, `Routine item marked as ${newStatus}`, routine);
  } catch (error) {
    console.error('Error toggling routine status:', error);
    return sendError(res, error.message || 'Failed to toggle routine status', 500);
  }
};

/**
 * Add routine item (with optional multi-department array and isRecurring flag)
 */
export const addRoutineItem = async (req, res) => {
  try {
    const { time, title, subtitle, departments, date, isRecurring = true } = req.body;
    const dateString = date || getTodayDateString();

    if (!time || !title) {
      return sendError(res, 'Time and Title are required', 400);
    }

    // Determine target department list
    let deptList = [];
    if (Array.isArray(departments) && departments.length > 0) {
      deptList = departments.map(d => String(d).trim()).filter(Boolean);
    } else if (subtitle) {
      deptList = [String(subtitle).trim()];
    } else {
      deptList = ['General / All Departments'];
    }

    // Create routine item for each department in dateString
    const routineDocs = deptList.map(dept => ({
      dateString,
      time,
      title,
      subtitle: dept,
      status: 'pending'
    }));

    const insertedRoutines = await DailyRoutine.insertMany(routineDocs);

    // If isRecurring, save RoutineTemplates for each department
    if (isRecurring) {
      const templateDocs = deptList.map(dept => ({
        time,
        title,
        subtitle: dept,
        startDateString: dateString,
        isActive: true
      }));
      await RoutineTemplate.insertMany(templateDocs);
    }

    return sendSuccess(
      res, 
      isRecurring 
        ? `Routine milestone added for ${deptList.length} department(s) from today onwards` 
        : `Routine milestone created for ${deptList.length} department(s)`, 
      insertedRoutines[0] || insertedRoutines, 
      201
    );
  } catch (error) {
    console.error('Error adding routine item:', error);
    return sendError(res, error.message || 'Failed to add routine item', 500);
  }
};

/**
 * Update routine item (Superadmin / Admin)
 */
export const updateRoutineItem = async (req, res) => {
  try {
    const { routineId } = req.params;
    const { time, title, subtitle, updateRecurring } = req.body;

    const routine = await DailyRoutine.findById(routineId);
    if (!routine) {
      return sendError(res, 'Routine item not found', 404);
    }

    const oldTitle = routine.title;
    const oldTime = routine.time;
    const oldSubtitle = routine.subtitle;

    if (time) routine.time = time;
    if (title) routine.title = title;
    if (subtitle !== undefined) routine.subtitle = subtitle;

    await routine.save();

    // If updateRecurring is true, also update matching RoutineTemplate for this department
    if (updateRecurring) {
      const updateQuery = { title: oldTitle, time: oldTime };
      if (oldSubtitle) {
        const escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        updateQuery.subtitle = new RegExp(`^${escapeRegex(oldSubtitle)}$`, 'i');
      }
      await RoutineTemplate.updateMany(
        updateQuery,
        { $set: { time: routine.time, title: routine.title, subtitle: routine.subtitle } }
      );
    }

    return sendSuccess(res, 'Routine item updated successfully', routine);
  } catch (error) {
    console.error('Error updating routine item:', error);
    return sendError(res, error.message || 'Failed to update routine item', 500);
  }
};

/**
 * Delete routine item (Superadmin / Admin / TL)
 */
export const deleteRoutineItem = async (req, res) => {
  try {
    const { routineId } = req.params;
    const { deleteFromFuture } = req.query;

    const routine = await DailyRoutine.findById(routineId);
    if (!routine) {
      return sendError(res, 'Routine item not found', 404);
    }

    const deptName = String(routine.subtitle || '').trim();

    await DailyRoutine.findByIdAndDelete(routineId);

    const isFutureDelete = deleteFromFuture === undefined || deleteFromFuture === 'true' || deleteFromFuture === true || String(deleteFromFuture).toLowerCase() === 'true';

    if (isFutureDelete) {
      const cleanTitle = String(routine.title || '').trim();
      const escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const titleRegex = new RegExp(`^${escapeRegex(cleanTitle)}$`, 'i');

      const templateQuery = {
        title: titleRegex,
        time: routine.time
      };

      const futureQuery = {
        title: titleRegex,
        time: routine.time,
        dateString: { $gte: routine.dateString }
      };

      // Scope deletion specifically to this department if subtitle is present
      if (deptName) {
        const deptRegex = new RegExp(`^${escapeRegex(deptName)}$`, 'i');
        templateQuery.subtitle = deptRegex;
        futureQuery.subtitle = deptRegex;
      }

      // Purge matching template for this department only from RoutineTemplate
      await RoutineTemplate.deleteMany(templateQuery);

      // Purge matching instances for this department only from DailyRoutine for current and future dates
      await DailyRoutine.deleteMany(futureQuery);
    }

    return sendSuccess(res, 'Routine item deleted successfully', { id: routineId });
  } catch (error) {
    console.error('Error deleting routine item:', error);
    return sendError(res, error.message || 'Failed to delete routine item', 500);
  }
};

/**
 * Save / Update Department Daily Briefing
 */
export const saveDepartmentBriefing = async (req, res) => {
  try {
    const { department, priority, deliverables, blockers, date } = req.body;
    const dateString = date || getTodayDateString();
    const userId = req.user._id || req.user.id;
    let userName = req.user.name;

    if (!userName || userName === 'User') {
      const dbUser = await User.findById(userId);
      if (dbUser && dbUser.name) {
        userName = dbUser.name;
      }
    }
    userName = userName || 'Team Lead';

    if (!department) {
      return sendError(res, 'Department is required', 400);
    }

    let briefing = await DepartmentBriefing.findOne({ dateString, department });

    if (briefing) {
      briefing.priority = priority !== undefined ? priority : briefing.priority;
      briefing.deliverables = deliverables !== undefined ? deliverables : briefing.deliverables;
      briefing.blockers = blockers !== undefined ? blockers : briefing.blockers;
      briefing.submittedBy = userId;
      briefing.submittedByName = userName;
      await briefing.save();
    } else {
      briefing = new DepartmentBriefing({
        dateString,
        department,
        priority: priority || '',
        deliverables: deliverables || '',
        blockers: blockers || '',
        submittedBy: userId,
        submittedByName: userName
      });
      await briefing.save();
    }

    return sendSuccess(res, 'Department briefing saved successfully', briefing);
  } catch (error) {
    console.error('Error saving department briefing:', error);
    return sendError(res, error.message || 'Failed to save department briefing', 500);
  }
};

/**
 * Update Department Briefing by ID (Superadmin / Admin / Author)
 */
export const updateDepartmentBriefing = async (req, res) => {
  try {
    const { briefingId } = req.params;
    const { priority, deliverables, blockers } = req.body;

    const briefing = await DepartmentBriefing.findById(briefingId);
    if (!briefing) {
      return sendError(res, 'Department briefing not found', 404);
    }

    if (priority !== undefined) briefing.priority = priority;
    if (deliverables !== undefined) briefing.deliverables = deliverables;
    if (blockers !== undefined) briefing.blockers = blockers;

    await briefing.save();
    return sendSuccess(res, 'Department briefing updated successfully', briefing);
  } catch (error) {
    console.error('Error updating department briefing:', error);
    return sendError(res, error.message || 'Failed to update department briefing', 500);
  }
};

/**
 * Delete Department Briefing by ID (Superadmin / Admin)
 */
export const deleteDepartmentBriefing = async (req, res) => {
  try {
    const { briefingId } = req.params;

    const briefing = await DepartmentBriefing.findById(briefingId);
    if (!briefing) {
      return sendError(res, 'Department briefing not found', 404);
    }

    await DepartmentBriefing.findByIdAndDelete(briefingId);
    return sendSuccess(res, 'Department briefing deleted successfully', { id: briefingId });
  } catch (error) {
    console.error('Error deleting department briefing:', error);
    return sendError(res, error.message || 'Failed to delete department briefing', 500);
  }
};

/**
 * Submit / Update EOD Closure Report
 */
export const submitEodClosure = async (req, res) => {
  try {
    const { completedToday, pendingReason, tomorrowPriority, department, date } = req.body;
    const dateString = date || getTodayDateString();
    const userId = req.user._id || req.user.id;
    let userName = req.user.name;

    if (!userName || userName === 'User') {
      const dbUser = await User.findById(userId);
      if (dbUser && dbUser.name) {
        userName = dbUser.name;
      }
    }
    userName = userName || 'Staff Member';

    let closure = await EodClosure.findOne({ dateString, user: userId });

    if (closure) {
      closure.completedToday = completedToday !== undefined ? completedToday : closure.completedToday;
      closure.pendingReason = pendingReason !== undefined ? pendingReason : closure.pendingReason;
      closure.tomorrowPriority = tomorrowPriority !== undefined ? tomorrowPriority : closure.tomorrowPriority;
      closure.department = department || closure.department;
      closure.userName = userName;
      await closure.save();
    } else {
      closure = new EodClosure({
        dateString,
        user: userId,
        userName,
        department: department || req.user.department || '',
        completedToday: completedToday || '',
        pendingReason: pendingReason || '',
        tomorrowPriority: tomorrowPriority || ''
      });
      await closure.save();
    }

    return sendSuccess(res, 'EOD closure submitted successfully', closure);
  } catch (error) {
    console.error('Error submitting EOD closure:', error);
    return sendError(res, error.message || 'Failed to submit EOD closure', 500);
  }
};

/**
 * Update EOD Closure Report by ID (Superadmin / Admin / Author)
 */
export const updateEodClosure = async (req, res) => {
  try {
    const { eodId } = req.params;
    const { completedToday, pendingReason, tomorrowPriority } = req.body;

    const closure = await EodClosure.findById(eodId);
    if (!closure) {
      return sendError(res, 'EOD closure report not found', 404);
    }

    if (completedToday !== undefined) closure.completedToday = completedToday;
    if (pendingReason !== undefined) closure.pendingReason = pendingReason;
    if (tomorrowPriority !== undefined) closure.tomorrowPriority = tomorrowPriority;

    await closure.save();
    return sendSuccess(res, 'EOD closure report updated successfully', closure);
  } catch (error) {
    console.error('Error updating EOD closure:', error);
    return sendError(res, error.message || 'Failed to update EOD closure', 500);
  }
};

/**
 * Delete EOD Closure Report by ID (Superadmin / Admin)
 */
export const deleteEodClosure = async (req, res) => {
  try {
    const { eodId } = req.params;

    const closure = await EodClosure.findById(eodId);
    if (!closure) {
      return sendError(res, 'EOD closure report not found', 404);
    }

    await EodClosure.findByIdAndDelete(eodId);
    return sendSuccess(res, 'EOD closure report deleted successfully', { id: eodId });
  } catch (error) {
    console.error('Error deleting EOD closure:', error);
    return sendError(res, error.message || 'Failed to delete EOD closure', 500);
  }
};

/**
 * Reset all routine milestones to exact default 7 routines
 */
export const resetRoutines = async (req, res) => {
  try {
    const dateString = req.body?.date || req.query?.date || getTodayDateString();
    const activeDepts = await getTargetDepartments();

    // Remove all existing daily routines and recurring templates
    await DailyRoutine.deleteMany({});
    await RoutineTemplate.deleteMany({});

    // Create per-department routine docs for current dateString
    const baseDocs = expandRoutineDocs(DEFAULT_ROUTINES, activeDepts, dateString);
    const insertedRoutines = await DailyRoutine.insertMany(baseDocs);

    // Create per-department templates in RoutineTemplate for future dates
    const templateDocs = expandRoutineDocs(DEFAULT_ROUTINES, activeDepts, dateString).map(r => ({
      time: r.time,
      title: r.title,
      subtitle: r.subtitle,
      startDateString: dateString,
      isActive: true
    }));

    await RoutineTemplate.insertMany(templateDocs);

    return sendSuccess(res, 'Daily routines reset to default per-department milestones successfully', insertedRoutines);
  } catch (error) {
    console.error('Error resetting daily routines:', error);
    return sendError(res, error.message || 'Failed to reset daily routines', 500);
  }
};

/**
 * Fetch Manager To-Do Checklist Items for a date
 */
export const getManagerToDos = async (req, res) => {
  try {
    const dateString = req.query.date || getTodayDateString();
    const items = await ManagerToDo.find({ dateString }).sort({ createdAt: -1 });
    return sendSuccess(res, 'Manager To-Do checklist retrieved', items);
  } catch (error) {
    console.error('Error fetching Manager To-Dos:', error);
    return sendError(res, error.message || 'Failed to fetch Manager To-Dos', 500);
  }
};

/**
 * Add a new Manager To-Do Checklist Item for a date
 */
export const addManagerToDo = async (req, res) => {
  try {
    const { task, date, priority, category, assignedTo, assignedToName } = req.body;
    const dateString = date || getTodayDateString();

    if (!task || !task.trim()) {
      return sendError(res, 'Task description is required', 400);
    }

    let finalAssignedTo = null;
    let finalAssignedToName = '';
    let finalAssignedToEmail = '';

    if (assignedTo && assignedTo !== 'unassigned' && assignedTo !== 'none') {
      try {
        const assignedUser = await User.findById(assignedTo);
        if (assignedUser) {
          finalAssignedTo = assignedUser._id;
          finalAssignedToName = assignedUser.name || assignedToName || '';
          finalAssignedToEmail = assignedUser.email || '';
        } else if (assignedToName) {
          finalAssignedToName = assignedToName;
        }
      } catch (e) {
        if (assignedToName) finalAssignedToName = assignedToName;
      }
    } else if (assignedToName) {
      finalAssignedToName = assignedToName;
    }

    const item = new ManagerToDo({
      dateString,
      task: task.trim(),
      priority: priority || 'medium',
      category: category || 'General',
      assignedTo: finalAssignedTo,
      assignedToName: finalAssignedToName,
      assignedToEmail: finalAssignedToEmail,
      createdBy: req.user._id || req.user.id,
      createdByName: req.user.name || 'Manager'
    });

    await item.save();
    return sendSuccess(res, 'Manager To-Do checklist item added', item);
  } catch (error) {
    console.error('Error adding Manager To-Do:', error);
    return sendError(res, error.message || 'Failed to add Manager To-Do item', 500);
  }
};

/**
 * Toggle status of a Manager To-Do item (pending <-> completed)
 */
export const toggleManagerToDoStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await ManagerToDo.findById(id);

    if (!item) {
      return sendError(res, 'Manager To-Do item not found', 404);
    }

    const newStatus = item.status === 'completed' ? 'pending' : 'completed';
    item.status = newStatus;
    item.completedBy = newStatus === 'completed' ? (req.user._id || req.user.id) : null;
    item.completedByName = newStatus === 'completed' ? (req.user.name || 'User') : '';
    item.completedAt = newStatus === 'completed' ? new Date() : null;

    await item.save();
    return sendSuccess(res, `Checklist item marked as ${newStatus}`, item);
  } catch (error) {
    console.error('Error toggling Manager To-Do status:', error);
    return sendError(res, error.message || 'Failed to toggle status', 500);
  }
};

/**
 * Update Manager To-Do item
 */
export const updateManagerToDo = async (req, res) => {
  try {
    const { id } = req.params;
    const { task, priority, category, assignedTo, assignedToName } = req.body;

    const item = await ManagerToDo.findById(id);
    if (!item) {
      return sendError(res, 'Manager To-Do item not found', 404);
    }

    if (task !== undefined) item.task = task.trim();
    if (priority !== undefined) item.priority = priority;
    if (category !== undefined) item.category = category;

    if (assignedTo !== undefined) {
      if (!assignedTo || assignedTo === 'unassigned' || assignedTo === 'none') {
        item.assignedTo = null;
        item.assignedToName = '';
        item.assignedToEmail = '';
      } else {
        try {
          const assignedUser = await User.findById(assignedTo);
          if (assignedUser) {
            item.assignedTo = assignedUser._id;
            item.assignedToName = assignedUser.name || assignedToName || '';
            item.assignedToEmail = assignedUser.email || '';
          } else {
            item.assignedToName = assignedToName || '';
          }
        } catch (e) {
          item.assignedToName = assignedToName || '';
        }
      }
    }

    await item.save();
    return sendSuccess(res, 'Manager To-Do item updated', item);
  } catch (error) {
    console.error('Error updating Manager To-Do:', error);
    return sendError(res, error.message || 'Failed to update Manager To-Do item', 500);
  }
};

/**
 * Delete Manager To-Do item
 */
export const deleteManagerToDo = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await ManagerToDo.findById(id);

    if (!item) {
      return sendError(res, 'Manager To-Do item not found', 404);
    }

    await ManagerToDo.findByIdAndDelete(id);
    return sendSuccess(res, 'Manager To-Do item deleted', { id });
  } catch (error) {
    console.error('Error deleting Manager To-Do:', error);
    return sendError(res, error.message || 'Failed to delete Manager To-Do item', 500);
  }
};

