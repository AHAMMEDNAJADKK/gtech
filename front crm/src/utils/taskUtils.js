const getAuthHeader = () => {
  const rawToken = localStorage.getItem('token');
  const token = rawToken ? rawToken.replace(/^"(.*)"$/, '$1').replace(/"/g, '').replace(/^Bearer\s+/i, '').trim() : '';
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const extractTasks = data => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.tasks)) return data.tasks;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.data?.tasks)) return data.data.tasks;
  return [];
};

const getTasksUrl = () => {
  const base = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');
  return base.endsWith('/v1') ? `${base}/tasks/all` : `${base}/v1/tasks/all`;
};

export const isUserAssigned = (assignedField, targetUserId) => {
  if (!assignedField || !targetUserId) return false;
  const cleanTarget = String(targetUserId).trim();

  if (Array.isArray(assignedField)) {
    return assignedField.some(u => {
      if (!u) return false;
      const uId = (typeof u === 'object') ? (u._id || u.id || u.user_id) : u;
      return String(uId || '').trim() === cleanTarget;
    });
  }

  const singleId = (typeof assignedField === 'object')
    ? (assignedField._id || assignedField.id || assignedField.user_id)
    : assignedField;

  return String(singleId || '').trim() === cleanTarget;
};

export const fetchCompletedTasks = async (userId, dateStr) => {
  if (!userId || !dateStr) return [];
  try {
    const res = await fetch(getTasksUrl(), {
      headers: {
        ...getAuthHeader(),
        'Content-Type': 'application/json'
      }
    });
    if (!res.ok) return [];
    
    const data = await res.json();
    const tasks = extractTasks(data);
    
    // Filter for tasks assigned to the user matching the selected report date.
    const filteredTasks = tasks.filter(t => {
      // Check user assignment
      if (!isUserAssigned(t.assigned_to || t.assignedTo, userId)) return false;
      
      const statusLower = String(t.status || '').toLowerCase();
      const isDone = ['done', 'completed'].includes(statusLower);

      const getDateStrings = (d) => {
        if (!d) return [];
        try {
          const dateObj = new Date(d);
          if (isNaN(dateObj.getTime())) return [];

          const localY = dateObj.getFullYear();
          const localM = String(dateObj.getMonth() + 1).padStart(2, '0');
          const localD = String(dateObj.getDate()).padStart(2, '0');
          const localDateStr = `${localY}-${localM}-${localD}`;

          const utcY = dateObj.getUTCFullYear();
          const utcM = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
          const utcD = String(dateObj.getUTCDate()).padStart(2, '0');
          const utcDateStr = `${utcY}-${utcM}-${utcD}`;

          return [localDateStr, utcDateStr];
        } catch (e) {
          return [];
        }
      };

      const matchesDate = (d) => getDateStrings(d).includes(dateStr);

      // If task is completed/done, it must have been completed on the report date (dateStr).
      // Tasks completed on prior dates (e.g. yesterday) will not appear on today's report.
      if (isDone) {
        const completionTime = t.completedAt || t.updatedAt;
        if (!completionTime) return false;
        return matchesDate(completionTime);
      }
      
      const isPendingOrInProgress = ['pending', 'current'].includes(statusLower);
      const dateMatches = matchesDate(t.date) || matchesDate(t.createdAt) || matchesDate(t.dueDate);
      
      return dateMatches || isPendingOrInProgress;
    });

    // Format task title and attributes timezone-safely for reports
    return filteredTasks.map(t => {
      // Map status values to human-friendly text
      const statusMap = {
        pending: 'Pending',
        current: 'In Progress',
        preview: 'Preview',
        done: 'Done'
      };
      const statusText = statusMap[String(t.status).toLowerCase()] || (t.status ? String(t.status) : 'N/A');

      const formatTime = (dateObjOrStr) => {
        if (!dateObjOrStr) return '';
        try {
          const d = new Date(dateObjOrStr);
          if (isNaN(d.getTime())) return '';
          
          const day = String(d.getDate()).padStart(2, '0');
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const year = d.getFullYear();
          const datePart = `${day}-${month}-${year}`;

          const timePart = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          return `${datePart} ${timePart}`;
        } catch (e) {
          return '';
        }
      };

      const startTime = formatTime(t.createdAt || t.startTime || t.startDate);
      const endTime = formatTime(t.updatedAt || t.endTime || t.endDate) || (String(t.status).toLowerCase() === 'done' ? formatTime(t.updatedAt) : formatTime(t.createdAt));

      // ISO/datetime-local formatted strings (YYYY-MM-DDTHH:mm) for datetime-local inputs
      const formatDateTimeLocal = (dateObjOrStr) => {
        if (!dateObjOrStr) return '';
        try {
          const d = new Date(dateObjOrStr);
          if (isNaN(d.getTime())) return '';
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          const hours = String(d.getHours()).padStart(2, '0');
          const minutes = String(d.getMinutes()).padStart(2, '0');
          return `${year}-${month}-${day}T${hours}:${minutes}`;
        } catch (e) {
          return '';
        }
      };

      const startDateTimeLocal = formatDateTimeLocal(t.createdAt || t.startTime || t.startDate);
      const endDateTimeLocal = formatDateTimeLocal(t.updatedAt || t.endTime || t.endDate) || startDateTimeLocal;

      // Format due date in UTC (DD-MM-YYYY) to prevent timezone shifts
      let dueDateText = '';
      let formattedDueDate = '';
      if (t.dueDate) {
        try {
          const d = new Date(t.dueDate);
          const day = String(d.getUTCDate()).padStart(2, '0');
          const month = String(d.getUTCMonth() + 1).padStart(2, '0');
          const year = d.getUTCFullYear();
          dueDateText = ` [Due: ${day}-${month}-${year}]`;
          formattedDueDate = `${year}-${month}-${day}`; // YYYY-MM-DD for date inputs
        } catch (e) {}
      }

      return {
        ...t,
        status: statusText,
        startTime,
        endTime,
        startDate: startTime,
        endDate: endTime,
        startDateTimeLocal,
        endDateTimeLocal,
        dueDate: formattedDueDate,
        title: t.title ? `${t.title} [${statusText.toUpperCase()}]` : 'N/A'
      };
    });
  } catch (error) {
    console.error("Error fetching tasks for report:", error);
    return [];
  }
};

const extractUserId = (userField) => {
  if (!userField) return '';
  if (Array.isArray(userField)) {
    for (const u of userField) {
      if (!u) continue;
      const id = (typeof u === 'object') ? String(u._id || u.id || u.user_id || '').trim() : String(u).trim();
      if (id) return id;
    }
    return '';
  }
  if (typeof userField === 'object') {
    return String(userField._id || userField.id || userField.user_id || '').trim();
  }
  return String(userField).trim();
};

export const fetchDelegatedTasks = async (userId, dateStr, usersList = []) => {
  if (!userId || !dateStr) return [];
  try {
    const res = await fetch(getTasksUrl(), {
      headers: getAuthHeader()
    });
    if (!res.ok) return [];
    
    const data = await res.json();
    const tasks = extractTasks(data);

    // Build user lookup map from localStorage and passed usersList
    const userMap = new Map();
    try {
      const cachedUsers = localStorage.getItem('crm_users_list') || localStorage.getItem('users') || localStorage.getItem('all_users');
      if (cachedUsers) {
        const parsed = JSON.parse(cachedUsers);
        if (Array.isArray(parsed)) {
          parsed.forEach(u => {
            const id = String(u._id || u.id || u.user_id || '').trim();
            if (id) userMap.set(id, u.name || u.employeeName || u.username || u.email);
          });
        }
      }
    } catch (e) {}

    if (Array.isArray(usersList)) {
      usersList.forEach(u => {
        const id = String(u._id || u.id || u.user_id || '').trim();
        if (id && (u.name || u.employeeName || u.username)) {
          userMap.set(id, u.name || u.employeeName || u.username);
        }
      });
    }
    
    const matchesDate = (d) => {
      if (!d) return false;
      try {
        const dateObj = new Date(d);
        if (isNaN(dateObj.getTime())) return false;
        const localY = dateObj.getFullYear();
        const localM = String(dateObj.getMonth() + 1).padStart(2, '0');
        const localD = String(dateObj.getDate()).padStart(2, '0');
        const localDateStr = `${localY}-${localM}-${localD}`;

        const utcY = dateObj.getUTCFullYear();
        const utcM = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
        const utcD = String(dateObj.getUTCDate()).padStart(2, '0');
        const utcDateStr = `${utcY}-${utcM}-${utcD}`;

        return localDateStr === dateStr || utcDateStr === dateStr;
      } catch (e) {
        return false;
      }
    };

    const delegatedTasks = tasks.filter(t => {
      const createdUser = extractUserId(t.created_by) || extractUserId(t.createdBy) || extractUserId(t.user_id) || extractUserId(t.assigned_by) || extractUserId(t.assignedBy);
      const isAssignedToSelf = isUserAssigned(t.assigned_to || t.assignedTo, userId);

      if (createdUser !== String(userId)) return false;
      if (isAssignedToSelf) return false; 
      
      const statusLower = String(t.status || '').toLowerCase();
      const isDone = ['done', 'completed'].includes(statusLower);

      if (isDone) {
        const completionTime = t.updatedAt || t.completedAt;
        const completionDateStrs = matchesDate(completionTime);
        try {
          const dObj = new Date(completionTime);
          if (!isNaN(dObj.getTime())) {
            const locY = dObj.getFullYear();
            const locM = String(dObj.getMonth() + 1).padStart(2, '0');
            const locD = String(dObj.getDate()).padStart(2, '0');
            const locStr = `${locY}-${locM}-${locD}`;
            if (locStr < dateStr) return false;
          }
        } catch (e) {}
      }

      const dateMatches = matchesDate(t.date) || matchesDate(t.createdAt) || matchesDate(t.updatedAt) || matchesDate(t.dueDate);
      const isPendingOrInProgress = ['pending', 'current'].includes(statusLower);

      return dateMatches || isPendingOrInProgress;
    });

    return delegatedTasks.map(t => {
      const statusMap = {
        pending: 'Pending',
        current: 'In Progress',
        preview: 'Preview',
        done: 'Done'
      };
      const statusText = statusMap[String(t.status).toLowerCase()] || (t.status ? String(t.status) : 'N/A');
      
      const extractName = (field) => {
        if (!field) return '';
        if (Array.isArray(field)) {
          const names = field.map(u => {
            if (!u) return '';
            if (typeof u === 'object') {
              const name = u.name || u.employeeName || u.username || u.email;
              if (name) return name;
              const id = String(u._id || u.id || u.user_id || '').trim();
              if (id && userMap.has(id)) return userMap.get(id);
            } else if (typeof u === 'string') {
              const clean = u.trim();
              if (userMap.has(clean)) return userMap.get(clean);
              if (!/^[0-9a-fA-F]{24}$/.test(clean)) return clean;
            }
            return '';
          }).filter(Boolean);
          if (names.length > 0) return names.join(', ');
        } else if (typeof field === 'object') {
          const name = field.name || field.employeeName || field.username || field.email;
          if (name) return name;
          const id = String(field._id || field.id || field.user_id || '').trim();
          if (id && userMap.has(id)) return userMap.get(id);
        } else if (typeof field === 'string') {
          const clean = field.trim();
          if (userMap.has(clean)) return userMap.get(clean);
          if (!/^[0-9a-fA-F]{24}$/.test(clean)) return clean;
        }
        return '';
      };

      const assignedName = extractName(t.assigned_to) || extractName(t.assignedTo) || extractName(t.assigned_users) || extractName(t.assignedUsers) || t.assigned_to_name || t.assignedToName || 'N/A';

      let formattedDueDate = '';
      if (t.dueDate) {
        try {
          const d = new Date(t.dueDate);
          const day = String(d.getUTCDate()).padStart(2, '0');
          const month = String(d.getUTCMonth() + 1).padStart(2, '0');
          const year = d.getUTCFullYear();
          formattedDueDate = `${year}-${month}-${day}`;
        } catch (e) {}
      }

      return {
        ...t,
        title: t.title || t.task || t.name || 'Delegated Task',
        taskTitle: t.title || t.task || t.name || 'Delegated Task',
        assignedToName: assignedName !== 'N/A' ? assignedName : 'Team Member',
        assignedTo: assignedName,
        status: statusText,
        dueDate: formattedDueDate,
        startDate: t.startDate || (t.createdAt ? t.createdAt.split('T')[0] : ''),
        endDate: t.endDate || formattedDueDate,
        remarks: t.remarks || t.notes || t.description || '',
        project: assignedName,
        kpi: t.title || t.task || 'N/A',
        target: formattedDueDate,
        achieved: statusText
      };
    });
  } catch (error) {
    console.error('Error fetching delegated tasks for report:', error);
    return [];
  }
};
