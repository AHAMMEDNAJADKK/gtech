import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, Clock, CheckCircle2, Eye, Layout, X, 
  Trash2, Edit3, Save, Upload, Image as ImageIcon, 
  Loader2, Camera, ShieldCheck, User, Target, Info, Building, FolderKanban,
  Paperclip, Link2, ExternalLink, FileText, CheckSquare, ListTodo, PlusCircle, Check
} from 'lucide-react';
import { useToast } from '../components/ToastProvider';
import ConfirmModal from '../components/ConfirmModal';
import { useUser } from '../contexts/UserContext';
import { sendEmail } from '../services/emailService';
import TaskCollaboration from '../components/TaskCollaboration';

const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, ''); // --- UTILS & CONSTANTS ---
const getTaskImageUrl = (path) => {
  if (!path) return null;
  if (typeof path === 'object') {
    path = path.url || path.file || path.image || path.path || null;
    if (!path) return null;
  }
  if (typeof path !== 'string') return null;

  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("data:") || path.startsWith("blob:")) {
    let cleanUrl = path;
    if (path.includes('res.cloudinary.com')) {
      cleanUrl = cleanUrl
        .replace('/raw/upload/', '/image/upload/')
        .replace('/image/upload/fl_inline/', '/image/upload/');
      if (/\.pdf$/i.test(cleanUrl)) {
        cleanUrl = cleanUrl.replace(/\.pdf$/i, '.png');
      }
      
    }
    return cleanUrl;
  }

  const cleanPath = path.replace(/^\//, '');
  const apiBase = import.meta.env.VITE_API_URL || '';
  const backendHost = apiBase ? apiBase.replace(/\/api\/v1\/?$/, '').replace(/\/api\/?$/, '') : window.location.origin;
  return `${backendHost}/${cleanPath}`;
};

const formatDateTimeDisplay = (dVal) => {
  if (!dVal) return '';
  try {
    const d = new Date(dVal);
    if (isNaN(d.getTime())) return dVal;
    const dateStr = d.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `${dateStr} ${timeStr}`;
  } catch (e) {
    return dVal;
  }
};

const getDatetimeLocalValue = (dVal) => {
  if (!dVal) return '';
  try {
    const d = new Date(dVal);
    if (isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch (e) {
    return '';
  }
};

const getUserDisplayName = (userOrId, usersList = []) => {
  if (!userOrId) return 'Unassigned';
  if (Array.isArray(userOrId)) {
    if (userOrId.length === 0) return 'Unassigned';
    const names = userOrId.map(u => getUserDisplayName(u, usersList)).filter(Boolean);
    if (names.length === 1) return names[0];
    if (names.length === 2) return `${names[0]}, ${names[1]}`;
    return `${names[0]}, ${names[1]} +${names.length - 2}`;
  }
  if (typeof userOrId === 'object' && userOrId !== null) {
    if (userOrId.name) return userOrId.name;
    if (userOrId.email) return userOrId.email;
    const idVal = String(userOrId._id || userOrId.id || '').replace(/"/g, '').trim();
    if (idVal) {
      const found = usersList.find(u => String(u._id || u.id || '').replace(/"/g, '').trim() === idVal);
      if (found?.name) return found.name;
      if (found?.email) return found.email;
    }
  }
  const targetId = String(userOrId).replace(/"/g, '').trim();
  const found = usersList.find(u => String(u._id || u.id || '').replace(/"/g, '').trim() === targetId);
  if (found?.name) return found.name;
  if (found?.email) return found.email;
  return targetId.length === 24 ? 'Unassigned Staff' : targetId;
};

const getUserDesignationName = (userOrId, designationsList = [], usersList = []) => {
  if (!userOrId) return '';
  let userObj = userOrId;
  if (typeof userOrId === 'string') {
    userObj = usersList.find(u => String(u._id || u.id) === String(userOrId)) || { designation: userOrId };
  }
  if (!userObj) return '';
  if (userObj.designationId) {
    if (typeof userObj.designationId === 'object' && userObj.designationId.name) {
      return userObj.designationId.name;
    }
    const dFound = designationsList.find(d => String(d.id || d._id) === String(userObj.designationId));
    if (dFound?.name) return dFound.name;
  }
  if (userObj.designation) {
    const dFound = designationsList.find(d => String(d.id || d._id) === String(userObj.designation));
    if (dFound?.name) return dFound.name;
    return String(userObj.designation);
  }
  return '';
};

const getOwnerDisplayName = (taskObj, usersList = []) => {
  if (!taskObj) return 'System';
  const createdBy = taskObj.created_by;
  if (createdBy && typeof createdBy === 'object' && createdBy.name) {
    return createdBy.name;
  }
  const idVal = String(
    (createdBy && typeof createdBy === 'object')
      ? (createdBy._id || createdBy.id)
      : (createdBy || taskObj?.user_id || '')
  ).replace(/"/g, '').trim();

  const found = usersList.find(u => String(u._id || u.id || '').replace(/"/g, '').trim() === idVal);
  if (found?.name) return found.name;
  return idVal.length === 24 ? 'System Admin' : idVal;
};

const COLUMN_META = {
  pending: { label: 'Pending', icon: Layout, color: 'bg-[#e26a6a]', glow: 'shadow-[#e26a6a]/20' },
  current: { label: 'Current', icon: Clock, color: 'bg-[#e5a23a]', glow: 'shadow-[#e5a23a]/20' },
  preview: { label: 'Preview', icon: Eye, color: 'bg-indigo-500', glow: 'shadow-indigo-500/20' },
  done: { label: 'Completed', icon: CheckCircle2, color: 'bg-[#b7d333]', glow: 'shadow-[#b7d333]/20' }
};

const PRIORITY_META = {
  high: { 
    label: 'High Priority',
    shortLabel: 'High', 
    color: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30', 
    dot: 'bg-rose-500',
    barColor: 'bg-rose-500',
    style: { backgroundColor: 'rgba(244, 63, 94, 0.15)', color: '#f43f5e', borderColor: 'rgba(244, 63, 94, 0.4)' },
    dotStyle: { backgroundColor: '#f43f5e' }
  },
  medium: { 
    label: 'Medium Priority', 
    shortLabel: 'Medium',
    color: 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30', 
    dot: 'bg-sky-500',
    barColor: 'bg-sky-500',
    style: { backgroundColor: 'rgba(2, 132, 199, 0.18)', color: '#0284c7', borderColor: 'rgba(2, 132, 199, 0.45)' },
    dotStyle: { backgroundColor: '#0284c7' }
  },
  low: { 
    label: 'Low Priority', 
    shortLabel: 'Low',
    color: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30', 
    dot: 'bg-yellow-500',
    barColor: 'bg-yellow-500',
    style: { backgroundColor: 'rgba(234, 179, 8, 0.18)', color: '#ca8a04', borderColor: 'rgba(234, 179, 8, 0.45)' },
    dotStyle: { backgroundColor: '#eab308' }
  }
};

const Todo = () => {
  const { showToast } = useToast();
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [previewFile, setPreviewFile] = useState(null);
  
  // Determine current user ID from localStorage or JWT token
  const getCurrentUserId = () => {
    const stored = localStorage.getItem('user_id');
    if (stored) {
      return stored.replace(/"/g, '').trim();
    }
    const rawToken = localStorage.getItem('token');
    if (rawToken) {
      try {
        const payload = JSON.parse(atob(rawToken.split('.')[1]));
        // Common fields: id, _id, user_id
        return (payload.id || payload._id || payload.user_id || '').toString().replace(/"/g, '').trim();
      } catch (e) {
        console.warn('Failed to decode JWT for user id', e);
      }
    }
    return '';
  };
  const [currentUserId] = useState(getCurrentUserId);

  const getAuthHeaders = useCallback(() => {
    const rawToken = localStorage.getItem('token');
    const cleanToken = rawToken ? rawToken.replace(/"/g, '') : '';
    return { 'Authorization': cleanToken.startsWith('Bearer ') ? cleanToken : `Bearer ${cleanToken}` };
  }, []);

const fetchData = useCallback(async () => {
  try {

    const [tRes, uRes, dRes] = await Promise.all([
      fetch(`${API_BASE}/tasks/all`, {
        headers: getAuthHeaders()
      }),

      fetch(`${API_BASE}/v1/users/list`, {
        headers: getAuthHeaders()
      }),

      fetch(`${API_BASE}/v1/designations`, {
        headers: getAuthHeaders()
      })
    ]);

    if (!tRes.ok) {
      console.error("Fetch Error: failed to load tasks", tRes.status);
      return;
    }

    const responseText = await tRes.text();
    const tData = JSON.parse(responseText);
    const uData = await uRes.json();
    
    let dData = [];
    if (dRes.ok) {
      const dJson = await dRes.json();
      dData = dJson.data || [];
    }

    const rawTasks = Array.isArray(tData)
      ? tData
      : (tData.data || []);

    const sortedTasks = [...rawTasks].sort((a, b) => {
      const getTimestamp = (item) => {
        if (!item) return 0;
        if (item.createdAt) {
          const t = new Date(item.createdAt).getTime();
          if (!isNaN(t) && t > 0) return t;
        }
        const idStr = String(item.id || item._id || '');
        if (idStr.length === 24) {
          const sec = parseInt(idStr.substring(0, 8), 16);
          if (!isNaN(sec)) return sec * 1000;
        }
        return 0;
      };
      return getTimestamp(b) - getTimestamp(a);
    });
    const cleanedTasks = sortedTasks.map(task => ({
      ...task,
      assigned_to: (task.assigned_to && typeof task.assigned_to === "object" && (task.assigned_to.name || task.assigned_to.email))
        ? task.assigned_to
        : (task.assigned_to || "")
    }));

    setTasks(cleanedTasks);
    const fetchedUsers = Array.isArray(uData) ? uData : (uData.data?.users || uData.data || uData.users || []);
    setUsers(fetchedUsers);

    if (Array.isArray(dData) && dData.length > 0) {
      setDesignations(dData);
    } else {
      const desigMap = new Map();
      fetchedUsers.forEach(u => {
        const dObj = u.designationId || u.designation;
        if (dObj && typeof dObj === 'object' && (dObj._id || dObj.id) && (dObj.name || dObj.designation_name)) {
          const id = dObj._id || dObj.id;
          const name = dObj.name || dObj.designation_name;
          desigMap.set(String(id), { id, _id: id, name, designation_name: name });
        } else if (typeof dObj === 'string' && dObj.trim()) {
          desigMap.set(dObj.trim().toLowerCase(), { id: dObj.trim(), _id: dObj.trim(), name: dObj.trim(), designation_name: dObj.trim() });
        }
      });
      setDesignations(Array.from(desigMap.values()));
    }
  } catch (e) {
    console.error("Fetch Error:", e);
  } finally {
    setLoading(false);
  }
}, [getAuthHeaders]);
  useEffect(() => { fetchData(); }, [fetchData]);

  const onDragEnd = async (result) => {
    const { destination, draggableId } = result;
    if (!destination) return;
    const newStatus = destination.droppableId;
    const oldTasks = [...tasks];
    setTasks(prev => prev.map(t => (t.id || t._id || '').toString() === draggableId ? { ...t, status: newStatus } : t));
    try {
      const res = await fetch(`${API_BASE}/tasks/task-status/${draggableId}?status=${newStatus}`, {
        method: 'PUT', headers: getAuthHeaders()
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setTasks(oldTasks);
        showToast(errData.message || 'Failed to update task status', 'error');
      }
    } catch (err) {
      setTasks(oldTasks);
      showToast('Network error while updating task status', 'error');
    }
  };

  if (loading) return (
    <div className="min-h-[75vh] bg-transparent flex flex-col items-center justify-center">
      <div className="relative">
        <Loader2 className="animate-spin text-indigo-500" size={48} />
        <div className="absolute inset-0 blur-xl bg-indigo-500/20 animate-pulse" />
      </div>
      <p className="mt-6 text-[10px] font-black uppercase tracking-[0.5em] text-indigo-500/50">Syncing Nexus</p>
    </div>
  );
  return (
    <div className="text-slate-700 dark:text-slate-200 font-sans selection:bg-white-500/30 selection:text-white">
      <style>{`.no-scrollbar::-webkit-scrollbar { display: none; }`}</style>
      
      <div className="max-w-[1700px] mx-auto py-2">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-6 border-b border-slate-200 dark:border-slate-800 pb-2">
          <div>
            <div className="flex items-center gap-3 ">
              {/* <div className="h-2 w-2 bg-indigo-500 rounded-full animate-ping" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-500/70 dark:text-indigo-400/80">System Live</span> */}
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-slate-100 italic tracking-tighter leading-none">
              TASKS <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-purple-500"></span>
            </h1>
          </div>
          
          <button 
            onClick={() => setIsModalOpen(true)} 
            className="group relative flex items-center justify-center gap-3 px-10 py-5 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 shadow-sm rounded-full font-black text-[11px] uppercase tracking-widest transition-all hover:scale-105 active:scale-95 overflow-hidden cursor-pointer"
          >
            <div className="absolute inset-0 bg-indigo-500 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
            <Plus size={18} className="relative z-10 group-hover:text-white" /> 
            <span className="relative z-10 group-hover:text-white">Create Task</span>
          </button>
        </header>

        <DragDropContext onDragEnd={onDragEnd}>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8">
            {Object.keys(COLUMN_META).map(statusKey => (
              <Droppable droppableId={statusKey} key={statusKey}>
                {(provided, snapshot) => (
                  <div 
                    {...provided.droppableProps} ref={provided.innerRef} 
                    className={`flex flex-col min-h-[75vh] rounded-[2.25rem] transition-all duration-300 border ${snapshot.isDraggingOver ? 'bg-indigo-500/[0.03] dark:bg-indigo-500/[0.01] border-indigo-500/30 dark:border-indigo-500/20 shadow-inner' : 'bg-slate-50/50 dark:bg-slate-950/20 border-slate-200/50 dark:border-slate-800/40'}`}
                  >
                    <div className="p-6 pb-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-900/80">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/60 shadow-sm ${COLUMN_META[statusKey].glow}`}>
                          {React.createElement(COLUMN_META[statusKey].icon, {
                            size: 15,
                            className: COLUMN_META[statusKey].color.replace('bg-', 'text-')
                          })}
                        </div>
                        <h2 className="font-bold text-slate-800 dark:text-slate-200 uppercase text-[11px] tracking-[0.2em]">{COLUMN_META[statusKey].label}</h2>
                      </div>
                      <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-900 px-3 py-1 rounded-lg border border-slate-200/20 dark:border-slate-800/30">{tasks.filter(t => t.status === statusKey).length}</span>
                    </div>

                    <div className="p-4 space-y-4">
                      {tasks.filter(t => t.status === statusKey).map((task, index) => {
                        const checkIsUrgent = (dateString) => {
                          if (!dateString) return false;
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          const due = new Date(dateString);
                          due.setHours(0, 0, 0, 0);
                          const diffTime = due.getTime() - today.getTime();
                          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                          return diffDays <= 1; // Today, tomorrow, or overdue
                        };
                        const isUrgent = task.dueDate && statusKey !== 'done' && checkIsUrgent(task.dueDate);
                        const prioKey = String(task.priority || 'medium').toLowerCase();
                        const prioMeta = PRIORITY_META[prioKey] || PRIORITY_META.medium;

                        return (
                        <Draggable key={task.id.toString()} draggableId={task.id.toString()} index={index}>
                          {(p, s) => (
                            <div 
                              ref={p.innerRef} {...p.draggableProps} {...p.dragHandleProps} 
                              onClick={() => setSelectedTask(task)} 
                              className={`group relative p-5 pl-7 rounded-[1.75rem] bg-white/80 dark:bg-slate-900/40 backdrop-blur-md border ${isUrgent ? 'border-rose-500 bg-rose-50/20 dark:bg-rose-950/20' : 'border-slate-200/50 dark:border-slate-800/50'} shadow-sm hover:shadow-lg dark:hover:shadow-indigo-500/[0.02] transition-all duration-300 cursor-grab active:cursor-grabbing hover:-translate-y-[2px] ${s.isDragging ? 'rotate-[1.5deg] scale-[1.02] shadow-2xl z-50 bg-white/95 dark:bg-slate-900/95 border-indigo-500/40 dark:border-indigo-500/50 ring-2 ring-indigo-500/10' : ''}`}
                            >
                              {/* Left Accent Bar */}
                              <div className={`absolute left-0 top-6 bottom-6 w-[3px] rounded-r-full transition-all duration-300 group-hover:top-4 group-hover:bottom-4 ${prioMeta.barColor || prioMeta.dot}`} />

                              <div className="flex items-center justify-between gap-2 mb-3">
                                <div className="flex items-center gap-2">
                                  {/* Priority Badge Button */}
                                  <span style={prioMeta.style} className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${prioMeta.color}`}>
                                    <span style={prioMeta.dotStyle} className={`w-1.5 h-1.5 rounded-full ${prioMeta.dot} animate-pulse`} />
                                    {prioMeta.shortLabel || prioKey}
                                  </span>
                                  <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                                    {designations.find(d => String(d.id) === String(task.designation_id))?.name || "General"}
                                  </span>
                                </div>
                                {task.project && (
                                  <span className="text-[9px] font-extrabold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800/60 truncate max-w-[130px]">
                                    {typeof task.project === 'object' && task.project ? (task.project.projectName || task.project.projectCode) : 'Project'}
                                  </span>
                                )}
                              </div>

                              <h3 className="text-slate-800 dark:text-slate-200 font-bold text-[14px] leading-snug mb-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors duration-300">{task.title}</h3>
                              {task.dueDate && (
                                <div className={`text-[10px] font-bold mb-4 flex items-center gap-1.5 ${isUrgent ? 'text-rose-500' : 'text-slate-500'}`}>
                                  <Clock size={12} />
                                  <span>Due: {formatDateTimeDisplay(task.dueDate)}</span>
                                </div>
                              )}

                              {task.subtasks && task.subtasks.length > 0 && (
                                <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between">
                                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                                    <CheckSquare size={12} className="text-indigo-500" />
                                    <span>
                                      {task.subtasks.filter(s => s.completed).length}/{task.subtasks.length} subtasks
                                    </span>
                                  </div>
                                  <div className="w-16 bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                    <div 
                                      className="bg-indigo-500 h-full rounded-full transition-all duration-300"
                                      style={{ width: `${Math.round((task.subtasks.filter(s => s.completed).length / task.subtasks.length) * 100)}%` }}
                                    />
                                  </div>
                                </div>
                              )}

                              <div className="flex items-center justify-between pt-3 border-t border-slate-100/60 dark:border-slate-850/50">
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-850 border border-slate-200/50 dark:border-slate-750/50 flex items-center justify-center text-slate-500 dark:text-slate-400">
                                    <User size={12} />
                                  </div>
                                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 tracking-wide truncate max-w-[120px]">
                                    {getUserDisplayName(task.assigned_to, users)}
                                  </span>
                                </div>
                                {task.image && (
                                  <div className="p-1.5 rounded-lg bg-white-500/10 text-white-500 dark:text-indigo-400 border border-indigo-500/10">
                                    <ImageIcon size={12} />
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </Draggable>
                        );
                      })}
                      {provided.placeholder}
                    </div>
                  </div>
                )}
              </Droppable>
            ))}
          </div>
        </DragDropContext>
      </div>

      {/* MODALS */}
      <AnimatePresence>
        {isModalOpen && (
          <CreateModal 
            onClose={() => setIsModalOpen(false)} 
            users={users} refresh={fetchData} getAuthHeaders={getAuthHeaders} 
            designations={designations}
            currentUserId={currentUserId}
          />
        )}
        {selectedTask && (
          <DetailModal 
            task={selectedTask} users={users} 
            currentUserId={currentUserId}
            onClose={() => setSelectedTask(null)} 
            onUpdate={fetchData}           // Pointing to your fetch function
            getAuthHeaders={getAuthHeaders}
            API_BASE={API_BASE} // <--- ADD THIS LINE
            DESIGNATIONS={designations} 
            onPreviewFile={(f) => setPreviewFile(f)}
          />
        )}
        {previewFile && (
          <DocPreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />
        )}
      </AnimatePresence>
    </div>
  );
};

// --- CREATE MODAL COMPONENT ---
const CreateModal = ({ onClose, users, refresh, getAuthHeaders, designations, currentUserId }) => {
  const { showToast } = useToast();

  const [form, setForm] = useState({ title: '', description: '', assigned_to: '', designation_id: '', dueDate: '', client: '', project: '', priority: 'medium' });
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [attachedLinks, setAttachedLinks] = useState([]);
  const [linkTitle, setLinkTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [initialSubtasks, setInitialSubtasks] = useState([]);
  const [subtaskInput, setSubtaskInput] = useState('');

  const handleAddInitialSubtask = (e) => {
    if (e) e.preventDefault();
    if (!subtaskInput.trim()) return;
    setInitialSubtasks(prev => [...prev, subtaskInput.trim()]);
    setSubtaskInput('');
  };

  const removeInitialSubtask = (index) => {
    setInitialSubtasks(prev => prev.filter((_, i) => i !== index));
  };

  const [clientsList, setClientsList] = useState([]);
  const [clientProjects, setClientProjects] = useState([]);
  const [allProjects, setAllProjects] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/v1/clients?limit=100`, { headers: getAuthHeaders() })
      .then(res => res.json())
      .then(data => {
        if (data && data.success) setClientsList(data.data.clients || []);
      })
      .catch(err => console.error("Failed to load clients in task modal", err));

    fetch(`${API_BASE}/v1/projects?limit=100`, { headers: getAuthHeaders() })
      .then(res => res.json())
      .then(data => {
        if (data && data.success) {
          const list = data.data.projects || [];
          setAllProjects(list);
          setClientProjects(list);
        }
      })
      .catch(err => console.error("Failed to load projects in task modal", err));
  }, [getAuthHeaders]);

  const handleMultiFiles = (e) => {
    const selected = Array.from(e.target.files);
    if (selected.length > 0) {
      setAttachedFiles(prev => [...prev, ...selected]);
    }
    e.target.value = '';
  };

  const removeFile = (index) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddLink = (e) => {
    e.preventDefault();
    if (!linkUrl.trim()) return;
    let formattedUrl = linkUrl.trim();
    if (!/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = `https://${formattedUrl}`;
    }
    const newLink = {
      title: linkTitle.trim() || formattedUrl,
      url: formattedUrl
    };
    setAttachedLinks(prev => [...prev, newLink]);
    setLinkTitle('');
    setLinkUrl('');
    setShowLinkInput(false);
  };

  const removeLink = (index) => {
    setAttachedLinks(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const selectedAssignees = Array.isArray(form.assigned_to)
      ? form.assigned_to
      : (form.assigned_to ? [form.assigned_to] : []);

    if (selectedAssignees.length === 0) {
      showToast("Please select at least one staff member to assign", "error");
      setIsSubmitting(false);
      return;
    }

    const fd = new FormData();
    fd.append('title', form.title);
    fd.append('description', form.description || '');
    fd.append('assigned_to', JSON.stringify(selectedAssignees));
    fd.append('designation_id', form.designation_id);
    fd.append('status', 'pending');
    fd.append('priority', form.priority || 'medium');
    if (form.dueDate) fd.append('dueDate', form.dueDate);
    if (form.client) fd.append('client', form.client);
    if (form.project) fd.append('project', form.project);

    // Append multiple files
    attachedFiles.forEach(f => {
      fd.append('file', f);
    });

    // Append links as JSON
    if (attachedLinks.length > 0) {
      fd.append('links', JSON.stringify(attachedLinks));
    }

    // Append initial subtasks as JSON
    if (initialSubtasks.length > 0) {
      fd.append('subtasks', JSON.stringify(initialSubtasks.map(t => ({ title: t, completed: false }))));
    }

  try {
    const res = await fetch(`${API_BASE}/tasks/create`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: fd
    });

    const data = await res.json();

    if (!res.ok) {
      showToast(data.message || "Task creation failed", "error");
      return;
    }

    showToast("Task successfully created!", "success");

    // Send email notification via Brevo to assigned user(s)
    const assignedUsers = selectedAssignees
      .map(id => users?.find(u => String(u.id || u._id) === String(id)))
      .filter(u => u && u.email);

    for (const assignedUser of assignedUsers) {
      try {
        await sendEmail({
          to: { email: assignedUser.email, name: assignedUser.name || assignedUser.username },
          subject: `📌 New Task Assigned: ${form.title}`,
          htmlContent: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
              <div style="background: linear-gradient(135deg, #c4ec0d 0%, #aed604 100%); padding: 32px; text-align: left;">
                <span style="display: inline-block; background: #0f172a; color: #c4ec0d; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; padding: 4px 12px; border-radius: 50px; margin-bottom: 10px;">
                  New Task Assigned
                </span>
                <h1 style="color: #0f172a; font-size: 22px; font-weight: 800; margin: 0; line-height: 1.3;">
                  ${form.title}
                </h1>
              </div>

              <div style="padding: 32px 32px 24px 32px;">
                <p style="font-size: 15px; color: #334155; margin-top: 0;">Hi <strong>${assignedUser.name || 'Team Member'}</strong>,</p>
                <p style="font-size: 14px; color: #475569; margin-bottom: 20px;">You have been assigned a new task in the CRM portal:</p>
                
                <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #c4ec0d; padding: 20px; border-radius: 12px; margin-bottom: 24px;">
                  <p style="margin: 0 0 10px 0; color: #0f172a; font-size: 16px; font-weight: 700;">${form.title}</p>
                  ${form.description ? `<p style="margin: 0 0 12px 0; color: #334155; font-size: 14px; line-height: 1.5;"><strong>Briefing:</strong> ${form.description}</p>` : ''}
                  <div style="margin-top: 12px;">
                    <span style="display: inline-block; background: #0f172a; color: #c4ec0d; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 6px; text-transform: uppercase; margin-right: 6px;">
                      Priority: ${(form.priority || 'medium').toUpperCase()}
                    </span>
                    ${form.dueDate ? `<span style="display: inline-block; background: #fee2e2; color: #991b1b; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 6px;">Due: ${formatDateTimeDisplay(form.dueDate)}</span>` : ''}
                  </div>
                </div>

                <p style="color: #64748b; font-size: 13px; margin: 0;">Please log in to your CRM dashboard to manage this task.</p>
              </div>

              <div style="background-color: #f8fafc; padding: 20px 32px; border-top: 1px solid #f1f5f9; text-align: center; color: #94a3b8; font-size: 12px;">
                Sent via CRM System • Automated Task Dispatcher
              </div>
            </div>
          `
        });
        console.log("Task assignment email sent to:", assignedUser.email);
      } catch (emailErr) {
        console.error("Failed to send task email notification:", emailErr);
      }
    }

    await refresh();
    onClose();

  } catch (e) {
    console.error("CREATE ERROR:", e);
    showToast("Network error. Task creation failed.", "error");
  } finally {
    setIsSubmitting(false);
  }
};

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex justify-center items-start pt-6 overflow-y-auto p-4"
    >
      <motion.div 
        initial={{ y: -40, scale: 0.95 }} animate={{ y: 0, scale: 1 }}
        className="bg-white border border-slate-200 w-full max-w-2xl rounded-2xl p-6 shadow-xl relative"
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 transition-colors"><X size={18}/></button>
        
        <header className="mb-4">
          <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">New <span className="text-indigo-600">Task</span></h2>
        </header>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Multi-Attachments & Multi-Links Section */}
          <div className="space-y-2.5 bg-slate-50 dark:bg-slate-900/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-black uppercase text-indigo-500 tracking-[0.2em] flex items-center gap-1.5">
                <Paperclip size={12} /> Attachments & Links ({attachedFiles.length + attachedLinks.length})
              </span>
              <button
                type="button"
                onClick={() => setShowLinkInput(prev => !prev)}
                className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Link2 size={12} /> + Add External Link
              </button>
            </div>

            {/* Multi-file selection input */}
            <div className="group relative flex items-center gap-3 w-full border border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-500 rounded-xl px-3 py-2.5 bg-white dark:bg-slate-800 transition-all cursor-pointer">
              <input 
                type="file" 
                multiple 
                className="absolute inset-0 opacity-0 cursor-pointer w-full z-10" 
                onChange={handleMultiFiles} 
              />
              <Upload size={15} className="text-indigo-500 shrink-0" />
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold truncate">
                Upload files / images — Select multiple files or images
              </span>
            </div>

            {/* Render Selected File Chips */}
            {attachedFiles.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {attachedFiles.map((f, idx) => {
                  const isImg = f.type?.startsWith('image/');
                  return (
                    <div key={idx} className="flex items-center gap-2 bg-white dark:bg-slate-800 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
                      {isImg ? (
                        <img src={URL.createObjectURL(f)} className="w-5 h-5 rounded-md object-cover" alt="thumb" />
                      ) : (
                        <FileText size={13} className="text-indigo-500" />
                      )}
                      <span className="text-[10px] font-bold text-slate-700 dark:text-slate-200 truncate max-w-[140px]">{f.name}</span>
                      <button type="button" onClick={() => removeFile(idx)} className="text-slate-400 hover:text-rose-500 p-0.5 cursor-pointer">
                        <X size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add Link Popover Inline */}
            {showLinkInput && (
              <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <input 
                    type="text" 
                    placeholder="Link Title (e.g. Figma, Drive)" 
                    value={linkTitle} 
                    onChange={e => setLinkTitle(e.target.value)} 
                    className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none text-slate-900 dark:text-slate-100"
                  />
                  <input 
                    type="url" 
                    placeholder="https://example.com" 
                    value={linkUrl} 
                    onChange={e => setLinkUrl(e.target.value)} 
                    className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setShowLinkInput(false)} className="px-2.5 py-1 text-[10px] font-bold text-slate-500 cursor-pointer">Cancel</button>
                  <button type="button" onClick={handleAddLink} className="px-3 py-1 bg-indigo-600 text-white text-[10px] font-bold rounded-lg uppercase tracking-wider cursor-pointer">Save Link</button>
                </div>
              </div>
            )}

            {/* Render Selected Link Chips */}
            {attachedLinks.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {attachedLinks.map((l, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 px-2.5 py-1 rounded-xl border border-indigo-200 dark:border-indigo-800/60 text-[10px] font-bold">
                    <ExternalLink size={12} />
                    <span className="truncate max-w-[150px]">{l.title}</span>
                    <button type="button" onClick={() => removeLink(idx)} className="text-indigo-400 hover:text-rose-500 p-0.5 cursor-pointer">
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>



          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase text-indigo-500 tracking-[0.2em] ml-1">Title</label>
              <input required className="w-full bg-white border border-slate-200 px-3 py-2 rounded-xl text-slate-900 text-sm font-semibold outline-none focus:border-indigo-500/50" placeholder="Task title" value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase text-indigo-500 tracking-[0.2em] ml-1">Priority</label>
              <select
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-xl text-slate-900 dark:text-slate-100 text-xs font-bold outline-none cursor-pointer"
                value={form.priority || 'medium'}
                onChange={e => setForm({ ...form, priority: e.target.value })}
              >
                <option value="high">🔴 High</option>
                <option value="medium">🔷 Medium</option>
                <option value="low">🟡 Low</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase text-indigo-500 tracking-[0.2em] ml-1">Due Date & Time</label>
              <input type="datetime-local" className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-xl text-slate-900 dark:text-slate-100 text-xs font-semibold outline-none focus:border-indigo-500/50" value={form.dueDate} onChange={e => setForm({...form, dueDate: e.target.value})} />
            </div>
          </div>

          {/* Client & Project Selection Section (Feature 1) */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase text-indigo-500 tracking-[0.2em] ml-1">Client</label>
              <select
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-xl text-slate-900 dark:text-slate-100 text-xs font-bold outline-none"
                value={form.client}
                onChange={async (e) => {
                  const clientId = e.target.value;
                  setForm(prev => ({ ...prev, client: clientId, project: '' }));
                  if (clientId) {
                    try {
                      const res = await fetch(`${API_BASE}/v1/projects?client=${clientId}&limit=100`, { headers: getAuthHeaders() });
                      const d = await res.json();
                      if (d && d.success) setClientProjects(d.data.projects || []);
                    } catch (err) { console.error("Failed to fetch client projects", err); }
                  } else {
                    setClientProjects(allProjects);
                  }
                }}
              >
                <option value="">Select Client (Optional)</option>
                {clientsList.map(c => (
                  <option key={c._id || c.id} value={c._id || c.id}>
                    {c.companyName} ({c.clientId})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase text-indigo-500 tracking-[0.2em] ml-1">Project</label>
              <select
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-xl text-slate-900 dark:text-slate-100 text-xs font-bold outline-none cursor-pointer"
                value={form.project}
                onChange={e => {
                  const projId = e.target.value;
                  const selectedProj = clientProjects.find(p => String(p._id || p.id) === String(projId));
                  let parentClient = form.client;
                  if (selectedProj && selectedProj.client) {
                    parentClient = (selectedProj.client && typeof selectedProj.client === 'object') ? (selectedProj.client._id || selectedProj.client.id) : selectedProj.client;
                  }
                  setForm({ ...form, project: projId, client: parentClient });
                }}
              >
                <option value="">Select Active Project (Optional)</option>
                {clientProjects.map(p => (
                  <option key={p._id || p.id} value={p._id || p.id}>
                    {p.projectName} ({p.projectCode})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[9px] font-black uppercase text-indigo-500 tracking-[0.2em] ml-1">
                Assign To (Select Staff Members) *
              </label>
              <div className="flex items-center gap-2">
                {currentUserId && (
                  <button
                    type="button"
                    onClick={() => {
                      const current = Array.isArray(form.assigned_to) ? form.assigned_to : (form.assigned_to ? [form.assigned_to] : []);
                      const exists = current.map(String).includes(String(currentUserId));
                      const next = exists ? current.filter(id => String(id) !== String(currentUserId)) : [...current, currentUserId];
                      setForm({ ...form, assigned_to: next });
                    }}
                    className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-0.5 rounded-lg border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition cursor-pointer flex items-center gap-1"
                  >
                    <User size={11} /> {(Array.isArray(form.assigned_to) ? form.assigned_to : [form.assigned_to]).map(String).includes(String(currentUserId)) ? '✓ Self Assigned' : '+ Assign to Me'}
                  </button>
                )}
                <span className="text-[10px] font-extrabold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800">
                  {(Array.isArray(form.assigned_to) ? form.assigned_to : (form.assigned_to ? [form.assigned_to] : [])).length} Selected
                </span>
              </div>
            </div>

            {/* Selected Assignee Chips */}
            {(Array.isArray(form.assigned_to) ? form.assigned_to : (form.assigned_to ? [form.assigned_to] : [])).length > 0 && (
              <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 max-h-28 overflow-y-auto">
                {(Array.isArray(form.assigned_to) ? form.assigned_to : [form.assigned_to]).map((uId) => {
                  const uObj = users.find(u => String(u.id || u._id) === String(uId));
                  const uName = uObj ? uObj.name : uId;
                  const desigName = getUserDesignationName(uObj, designations, users);
                  return (
                    <div key={uId} className="inline-flex items-center gap-2 bg-indigo-100/90 dark:bg-indigo-950 px-2.5 py-1 rounded-xl text-xs font-bold text-indigo-900 dark:text-indigo-100 border border-indigo-200 dark:border-indigo-800">
                      <div className="flex flex-col">
                        <span className="font-bold leading-tight">{uName}</span>
                        {desigName && (
                          <span className="text-[9px] text-indigo-600 dark:text-indigo-400 font-medium leading-none mt-0.5">
                            {desigName}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const current = Array.isArray(form.assigned_to) ? form.assigned_to : [form.assigned_to];
                          const next = current.filter(id => String(id) !== String(uId));
                          setForm({ ...form, assigned_to: next });
                        }}
                        className="hover:text-rose-500 p-0.5 cursor-pointer ml-1"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Multi-Select Users Dropdown */}
            <select
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2.5 rounded-xl text-slate-900 dark:text-slate-100 text-xs font-bold outline-none cursor-pointer"
              value=""
              onChange={e => {
                const selectedId = e.target.value;
                if (!selectedId) return;
                const current = Array.isArray(form.assigned_to) ? form.assigned_to : (form.assigned_to ? [form.assigned_to] : []);
                let next;
                if (current.map(String).includes(String(selectedId))) {
                  next = current.filter(id => String(id) !== String(selectedId));
                } else {
                  next = [...current, selectedId];
                }

                let desigId = form.designation_id;
                if (next.length > 0) {
                  const firstUser = users.find(u => String(u.id || u._id) === String(next[0]));
                  if (firstUser) {
                    if (firstUser.designationId) {
                      desigId = (firstUser.designationId && typeof firstUser.designationId === 'object')
                        ? (firstUser.designationId._id || firstUser.designationId.id || '')
                        : String(firstUser.designationId);
                    } else if (firstUser.designation) {
                      desigId = String(firstUser.designation);
                    }
                  }
                }
                setForm({ ...form, assigned_to: next, designation_id: desigId });
              }}
            >
              <option value="">+ Click to add / remove assigned staff member...</option>
              {users.map(u => {
                const uId = u.id || u._id;
                const isYou = currentUserId && String(uId) === String(currentUserId);
                const isSel = (Array.isArray(form.assigned_to) ? form.assigned_to : [form.assigned_to]).some(id => String(id) === String(uId));
                const desigName = getUserDesignationName(u, designations, users);
                return (
                  <option key={uId} value={uId} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-medium">
                    {isSel ? `✓ ${u.name}` : u.name}{isYou ? ' (You)' : ''}{desigName ? ` — (${desigName})` : ''}{isSel ? ' [Selected]' : ''}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase text-indigo-500 tracking-[0.2em] ml-1">Briefing</label>
            <textarea className="w-full bg-white border border-slate-200 px-3 py-2 rounded-xl text-slate-900 text-sm h-20 resize-none outline-none focus:border-indigo-500/50" placeholder="Enter task details..." value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
          </div>

          <button disabled={isSubmitting} className="w-full py-3 bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl font-black uppercase text-[11px] tracking-[0.2em] transition-all flex items-center justify-center gap-2">
            {isSubmitting ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
            Submit Task
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
};

// --- LIVE IN-APP DOCUMENT PREVIEW MODAL ---
const DocPreviewModal = ({ file, onClose }) => {
  if (!file) return null;
  const rawUrl = typeof file === 'string' ? file : (file.url || file.file || file.image);
  const fileName = typeof file === 'object' && file.name ? file.name : (rawUrl ? rawUrl.split(/[\\/]/).pop() : 'Document');
  
  const isImage = (typeof file === 'object' && file.fileType === 'image') || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(rawUrl || '');
  const isPdf = /\.(pdf)$/i.test(rawUrl || fileName);
  
  let targetUrl = rawUrl;
  if (targetUrl && targetUrl.includes('res.cloudinary.com')) {
    targetUrl = targetUrl.replace('/raw/upload/', '/image/upload/');
  }

  // Cloudinary PDF to Image rendering URL
  const cloudinaryJpgUrl = (targetUrl && targetUrl.includes('res.cloudinary.com') && isPdf) 
    ? targetUrl.replace(/\.pdf$/i, '.jpg') 
    : null;

  const [useJpgFallback, setUseJpgFallback] = useState(false);

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[6000] bg-slate-950/80 backdrop-blur-md flex flex-col justify-between p-3 md:p-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between bg-slate-900/90 text-white px-5 py-3 rounded-2xl border border-slate-800 shadow-2xl mb-3">
        <div className="flex items-center gap-3 truncate">
          <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl">
            {isImage || isPdf ? <ImageIcon size={18} /> : <FileText size={18} />}
          </div>
          <div className="truncate">
            <h3 className="text-sm font-bold text-slate-100 truncate max-w-md">{fileName}</h3>
            <span className="text-[10px] text-indigo-400 font-semibold tracking-wider uppercase">
              {isImage ? 'Image Preview' : (isPdf ? 'PDF Live View' : 'Document View')}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isPdf && cloudinaryJpgUrl && (
            <button
              type="button"
              onClick={() => setUseJpgFallback(prev => !prev)}
              className="px-3 py-1.5 bg-indigo-600/30 border border-indigo-500/40 hover:bg-indigo-600 text-xs font-bold rounded-xl text-indigo-200 transition-colors cursor-pointer"
            >
              {useJpgFallback ? 'Switch to PDF View' : 'Render Page as Image'}
            </button>
          )}
          <a 
            href={targetUrl} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 text-slate-200 transition-colors"
          >
            <ExternalLink size={13} /> Open Raw Link
          </a>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Embedded Live Viewer Area */}
      <div className="flex-1 w-full bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center relative shadow-inner">
        {isImage || useJpgFallback ? (
          <img src={useJpgFallback ? cloudinaryJpgUrl : targetUrl} className="max-w-full max-h-full object-contain p-4 rounded-xl" alt={fileName} />
        ) : isPdf ? (
          <object 
            data={targetUrl} 
            type="application/pdf" 
            className="w-full h-full min-h-[75vh] rounded-2xl border-0 bg-white"
          >
            <iframe 
              src={`https://docs.google.com/viewer?url=${encodeURIComponent(targetUrl)}&embedded=true`} 
              className="w-full h-full min-h-[75vh] rounded-2xl border-0 bg-white" 
              title={fileName}
            />
          </object>
        ) : (
          <iframe 
            src={`https://docs.google.com/viewer?url=${encodeURIComponent(targetUrl)}&embedded=true`} 
            className="w-full h-full min-h-[75vh] rounded-2xl border-0 bg-white" 
            title={fileName}
          />
        )}
      </div>
    </motion.div>
  );
};

// --- SUBTASKS SECTION COMPONENT ---
const SubtasksSection = ({ task, canManageSubtasks, API_BASE, getAuthHeaders, onUpdate, users }) => {
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [loadingAdd, setLoadingAdd] = useState(false);
  const [subtasks, setSubtasks] = useState(task.subtasks || []);
  const { showToast } = useToast();

  useEffect(() => {
    setSubtasks(task.subtasks || []);
  }, [task.subtasks]);

  const totalSubtasks = subtasks.length;
  const completedCount = subtasks.filter(st => st.completed).length;
  const progressPercent = totalSubtasks > 0 ? Math.round((completedCount / totalSubtasks) * 100) : 0;

  const getCleanTaskId = () => {
    if (!task) return '';
    const raw = task.id || task._id;
    if (!raw) return '';
    return (typeof raw === 'object' ? (raw._id || raw.id || raw) : raw).toString();
  };

  const getCleanStId = (stVal) => {
    if (!stVal) return '';
    if (typeof stVal === 'object') {
      return (stVal._id || stVal.id || stVal).toString();
    }
    return String(stVal);
  };

  const handleAddSubtask = async (e) => {
    if (e) e.preventDefault();
    if (!newSubtaskTitle.trim()) return;
    setLoadingAdd(true);

    const cleanTaskId = getCleanTaskId();

    try {
      const res = await fetch(`${API_BASE}/tasks/${cleanTaskId}/subtasks`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ title: newSubtaskTitle.trim() })
      });

      const data = await res.json();
      if (!res.ok) {
        showToast(data.message || 'Failed to add subtask', 'error');
        return;
      }

      setNewSubtaskTitle('');
      const updatedSubtasks = data.subtasks || (data.task && data.task.subtasks);
      if (updatedSubtasks) {
        setSubtasks(updatedSubtasks);
      }
      showToast('Subtask added successfully', 'success');
      await onUpdate();
    } catch (err) {
      console.error('Error adding subtask:', err);
      showToast('Error adding subtask', 'error');
    } finally {
      setLoadingAdd(false);
    }
  };

  const handleToggleSubtask = async (rawStId, currentCompleted) => {
    const cleanStId = getCleanStId(rawStId);
    const cleanTaskId = getCleanTaskId();

    setSubtasks(prev => prev.map(st => {
      const sId = getCleanStId(st.id || st._id || st);
      return sId === cleanStId ? { ...st, completed: !currentCompleted } : st;
    }));

    try {
      const res = await fetch(`${API_BASE}/tasks/${cleanTaskId}/subtasks/${cleanStId}`, {
        method: 'PUT',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ completed: !currentCompleted })
      });

      const data = await res.json();
      if (res.ok) {
        const updatedSubtasks = data.subtasks || (data.task && data.task.subtasks);
        if (updatedSubtasks) {
          setSubtasks(updatedSubtasks);
        }
        await onUpdate();
      } else {
        console.error('Failed to toggle subtask:', data.message);
        showToast(data.message || 'Failed to update subtask', 'error');
        setSubtasks(task.subtasks || []);
      }
    } catch (err) {
      console.error('Error toggling subtask:', err);
      setSubtasks(task.subtasks || []);
    }
  };

  const handleDeleteSubtask = async (rawStId) => {
    const cleanStId = getCleanStId(rawStId);
    const cleanTaskId = getCleanTaskId();

    setSubtasks(prev => prev.filter(st => {
      const sId = getCleanStId(st.id || st._id || st);
      return sId !== cleanStId;
    }));

    try {
      const res = await fetch(`${API_BASE}/tasks/${cleanTaskId}/subtasks/${cleanStId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      const data = await res.json();
      if (res.ok) {
        const updatedSubtasks = data.subtasks || (data.task && data.task.subtasks);
        if (updatedSubtasks) {
          setSubtasks(updatedSubtasks);
        }
        showToast('Subtask removed', 'info');
        await onUpdate();
      } else {
        setSubtasks(task.subtasks || []);
      }
    } catch (err) {
      console.error('Error deleting subtask:', err);
      setSubtasks(task.subtasks || []);
    }
  };

  return (
    <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-950/40 border border-slate-200/80 dark:border-slate-800 rounded-2xl space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListTodo size={16} className="text-indigo-500" />
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
            Subtasks ({completedCount}/{totalSubtasks})
          </h4>
        </div>
        {totalSubtasks > 0 && (
          <span className="text-[10px] font-extrabold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800/60">
            {progressPercent}% Done
          </span>
        )}
      </div>

      {totalSubtasks > 0 && (
        <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
          <div 
            className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}

      {/* Subtask items list */}
      {subtasks.length > 0 ? (
        <div className="space-y-1.5 pt-1">
          {subtasks.map((st, idx) => {
            const stId = st.id || st._id || idx;
            const creatorName = getOwnerDisplayName({ created_by: st.created_by }, users);
            const completerName = st.completed ? getOwnerDisplayName({ created_by: st.completed_by }, users) : null;
            return (
              <div 
                key={stId}
                className="flex items-center justify-between gap-3 p-2.5 bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 rounded-xl group transition-all hover:border-indigo-500/30"
              >
                <button
                  type="button"
                  disabled={!canManageSubtasks}
                  onClick={() => handleToggleSubtask(stId, st.completed)}
                  className="flex items-center gap-2.5 flex-1 text-left cursor-pointer disabled:cursor-default"
                >
                  <div className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-all ${st.completed ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-transparent hover:border-indigo-500'}`}>
                    <Check size={12} strokeWidth={3} className={st.completed ? 'opacity-100' : 'opacity-0'} />
                  </div>
                  <span className={`text-xs font-semibold ${st.completed ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-800 dark:text-slate-200'}`}>
                    {st.title}
                  </span>
                </button>

                <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                  {creatorName && creatorName !== 'System Admin' && (
                    <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 rounded-md">
                      by {creatorName}
                    </span>
                  )}
                  {st.completed && completerName && completerName !== 'System Admin' && (
                    <span className="text-[9px] font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-200/60 dark:border-emerald-800/60 flex items-center gap-1">
                      ✓ done by {completerName}
                    </span>
                  )}
                  {canManageSubtasks && (
                    <button
                      type="button"
                      onClick={() => handleDeleteSubtask(stId)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-500 transition-opacity cursor-pointer ml-1"
                      title="Delete subtask"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-[11px] text-slate-400 dark:text-slate-500 italic">No subtasks added yet.</p>
      )}

      {/* Add subtask input */}
      {canManageSubtasks && (
        <form onSubmit={handleAddSubtask} className="flex items-center gap-2 pt-1">
          <input
            type="text"
            placeholder="Add a new subtask..."
            value={newSubtaskTitle}
            onChange={e => setNewSubtaskTitle(e.target.value)}
            className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-2 rounded-xl text-xs text-slate-900 dark:text-slate-100 font-medium outline-none focus:border-indigo-500/50"
          />
          <button
            type="submit"
            disabled={loadingAdd || !newSubtaskTitle.trim()}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
          >
            {loadingAdd ? <Loader2 size={13} className="animate-spin" /> : <PlusCircle size={13} />}
            <span>Add Subtask</span>
          </button>
        </form>
      )}
    </div>
  );
};

// --- DETAIL MODAL COMPONENT (CLEANED & INTEGRATED) ---
const DetailModal = ({ task, currentUserId, onClose, onUpdate, getAuthHeaders, DESIGNATIONS, users, API_BASE, onPreviewFile }) => {
  const designations = DESIGNATIONS || [];
  const { showToast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [newFile, setNewFile] = useState(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  const statusConfig = {
    pending: { 
      label: 'Pending', 
      activeClass: 'bg-rose-100 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/80 text-rose-800 dark:text-rose-300 font-bold', 
      dot: 'bg-rose-600' 
    },
    current: { 
      label: 'Current', 
      activeClass: 'bg-amber-100 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/80 text-amber-800 dark:text-amber-300 font-bold', 
      dot: 'bg-amber-600' 
    },
    preview: { 
      label: 'Preview', 
      activeClass: 'bg-indigo-100 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800/80 text-indigo-800 dark:text-indigo-300 font-bold', 
      dot: 'bg-indigo-600' 
    },
    done: { 
      label: 'Completed', 
      activeClass: 'bg-emerald-100 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/80 text-emerald-800 dark:text-emerald-300 font-bold', 
      dot: 'bg-emerald-600' 
    }
  };

  const { user: liveUser } = useUser() || {};
  const storedUser = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('user')); } catch (e) { return null; }
  }, []);
  const currentUserObj = liveUser || storedUser;

  const effectiveUserId = useMemo(() => {
    if (currentUserId) return String(currentUserId).trim();
    if (currentUserObj) {
      return String(currentUserObj._id || currentUserObj.id || currentUserObj.user_id || '').trim();
    }
    return '';
  }, [currentUserId, currentUserObj]);

  const isSuperAdminUser = useMemo(() => {
    if (!currentUserObj) return false;
    const roleStr = String(currentUserObj.role || '').toLowerCase().trim();
    const roleIdStr = String(currentUserObj.role_id || currentUserObj.roleId || '').trim();
    return currentUserObj.isSuperAdmin === true || currentUserObj.is_super_admin === true || roleStr === 'superadmin' || roleIdStr === '0';
  }, [currentUserObj]);

  const isAssignee = useMemo(() => {
    if (!effectiveUserId || !task) return false;
    const list = Array.isArray(task.assigned_to) ? task.assigned_to : [task.assigned_to].filter(Boolean);
    return list.some(u => {
      const uId = (u && typeof u === 'object') ? (u._id || u.id) : u;
      return String(uId || '').trim() === effectiveUserId;
    });
  }, [task, effectiveUserId]);

  const canModify = useMemo(() => {
    if (isSuperAdminUser) return true;

    const getCreatorId = () => {
      const candidates = [
        task?.user_id,
        task?.created_by?._id,
        task?.created_by?.id,
        task?.created_by
      ];

      for (const val of candidates) {
        if (!val) continue;
        const str = (val && typeof val === 'object')
          ? (val._id || val.id || '').toString().trim()
          : (val ? val.toString().trim() : '');

        if (str && str !== '[object Object]') {
          return str;
        }
      }
      return null;
    };

    const creatorId = getCreatorId();
    return effectiveUserId && creatorId && effectiveUserId === creatorId;
  }, [task, effectiveUserId, isSuperAdminUser]);

  const canManageSubtasks = useMemo(() => {
    return canModify || isAssignee;
  }, [canModify, isAssignee]);

  const [clientsList, setClientsList] = useState([]);
  const [projectsList, setProjectsList] = useState([]);

  useEffect(() => {
    if (!API_BASE || !getAuthHeaders) return;
    fetch(`${API_BASE}/v1/clients?limit=100`, { headers: getAuthHeaders() })
      .then(res => res.json())
      .then(d => d?.success && setClientsList(d.data.clients || []))
      .catch(() => {});

    fetch(`${API_BASE}/v1/projects?limit=100`, { headers: getAuthHeaders() })
      .then(res => res.json())
      .then(d => d?.success && setProjectsList(d.data.projects || []))
      .catch(() => {});
  }, [getAuthHeaders, API_BASE]);

  useEffect(() => { 
    if (task) { 
      window.scrollTo({ top: 0, behavior: 'smooth' });
      const rawClient = (task.client && typeof task.client === 'object') ? (task.client._id || task.client.id) : (task.client || task.client_id || '');
      const rawProject = (task.project && typeof task.project === 'object') ? (task.project._id || task.project.id) : (task.project || task.project_id || '');
      
      let rawAssignedTo = [];
      if (Array.isArray(task.assigned_to)) {
        rawAssignedTo = task.assigned_to.map(u => (u && typeof u === 'object') ? (u._id || u.id || String(u)) : String(u));
      } else if (task.assigned_to) {
        rawAssignedTo = [(task.assigned_to && typeof task.assigned_to === 'object') ? (task.assigned_to._id || task.assigned_to.id || String(task.assigned_to)) : String(task.assigned_to)];
      }

      setEditForm({ ...task, assigned_to: rawAssignedTo, status: task.status || "pending", client: rawClient, project: rawProject }); 
      setIsEditing(false); 
      setNewFile(null);
    } 
  }, [task]);

  if (!task || !editForm) return null;

  const handleUpdate = async () => {
    if (isSaving) return;
    setIsSaving(true);

    const assigneesToSubmit = Array.isArray(editForm.assigned_to) ? editForm.assigned_to : (editForm.assigned_to ? [editForm.assigned_to] : []);

    const fd = new FormData();
    fd.append('title', editForm.title);
    fd.append('description', editForm.description || '');
    fd.append('assigned_to', JSON.stringify(assigneesToSubmit));
    fd.append('designation_id', editForm.designation_id);
    if (editForm.priority) fd.append('priority', editForm.priority);

    if (editForm.client) {
      const cid = (editForm.client && typeof editForm.client === 'object') ? (editForm.client._id || editForm.client.id) : editForm.client;
      if (cid) fd.append('client', cid);
    }
    if (editForm.project) {
      const pid = (editForm.project && typeof editForm.project === 'object') ? (editForm.project._id || editForm.project.id) : editForm.project;
      if (pid) fd.append('project', pid);
    }

    if (newFile) fd.append('file', newFile);
    if (editForm.dueDate) fd.append('dueDate', editForm.dueDate);

    try {
      await fetch(`${API_BASE}/tasks/update/${task.id}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: fd
      });

      if (editForm.status !== task.status) {
        await fetch(`${API_BASE}/tasks/task-status/${task.id}?status=${editForm.status}`, {
          method: "PUT",
          headers: getAuthHeaders()
        });
      }

      // Send email if task reassigned to new user(s)
      const currentAssigneeIds = Array.isArray(editForm.assigned_to)
        ? editForm.assigned_to.map(String)
        : (editForm.assigned_to ? [String(editForm.assigned_to)] : []);

      const oldAssignees = Array.isArray(task.assigned_to)
        ? task.assigned_to
        : (task.assigned_to ? [task.assigned_to] : []);

      const oldAssigneeIds = oldAssignees.map(u => (u && typeof u === 'object') ? String(u._id || u.id) : String(u));

      const newAssigneeIds = currentAssigneeIds.filter(id => !oldAssigneeIds.includes(id));
      const newAssignedUsers = newAssigneeIds
        .map(id => users?.find(u => String(u.id || u._id) === String(id)))
        .filter(u => u && u.email);

      for (const assignedUser of newAssignedUsers) {
        try {
          await sendEmail({
            to: { email: assignedUser.email, name: assignedUser.name || assignedUser.username },
            subject: `📌 Task Assigned to You: ${editForm.title}`,
            htmlContent: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
                <div style="background: linear-gradient(135deg, #c4ec0d 0%, #aed604 100%); padding: 32px; text-align: left;">
                  <span style="display: inline-block; background: #0f172a; color: #c4ec0d; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; padding: 4px 12px; border-radius: 50px; margin-bottom: 10px;">
                    Task Assigned to You
                  </span>
                  <h1 style="color: #0f172a; font-size: 22px; font-weight: 800; margin: 0; line-height: 1.3;">
                    ${editForm.title}
                  </h1>
                </div>

                <div style="padding: 32px 32px 24px 32px;">
                  <p style="font-size: 15px; color: #334155; margin-top: 0;">Hi <strong>${assignedUser.name || 'Team Member'}</strong>,</p>
                  <p style="font-size: 14px; color: #475569; margin-bottom: 20px;">A task has been reassigned to you in the CRM portal:</p>
                  
                  <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #c4ec0d; padding: 20px; border-radius: 12px; margin-bottom: 24px;">
                    <p style="margin: 0 0 10px 0; color: #0f172a; font-size: 16px; font-weight: 700;">${editForm.title}</p>
                    ${editForm.description ? `<p style="margin: 0 0 12px 0; color: #334155; font-size: 14px; line-height: 1.5;"><strong>Briefing:</strong> ${editForm.description}</p>` : ''}
                    <div style="margin-top: 12px;">
                      <span style="display: inline-block; background: #0f172a; color: #c4ec0d; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 6px; text-transform: uppercase; margin-right: 6px;">
                        Priority: ${(editForm.priority || 'medium').toUpperCase()}
                      </span>
                      ${editForm.dueDate ? `<span style="display: inline-block; background: #fee2e2; color: #991b1b; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 6px;">Due: ${formatDateTimeDisplay(editForm.dueDate)}</span>` : ''}
                    </div>
                  </div>

                  <p style="color: #64748b; font-size: 13px; margin: 0;">Please log in to your CRM dashboard to manage this task.</p>
                </div>

                <div style="background-color: #f8fafc; padding: 20px 32px; border-top: 1px solid #f1f5f9; text-align: center; color: #94a3b8; font-size: 12px;">
                  Sent via CRM System • Automated Task Dispatcher
                </div>
              </div>
            `
          });
        } catch (emailErr) {
          console.error("Failed to send task reassignment email:", emailErr);
        }
      }

      await onUpdate();
      onClose();

    } catch (e) {
      console.error("Update error:", e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    setEditForm(prev => ({ ...prev, status: newStatus }));

    try {
      await fetch(`${API_BASE}/tasks/task-status/${task.id}?status=${newStatus}`, {
        method: "PUT",
        headers: getAuthHeaders(),
      });
      await onUpdate();
    } catch (err) {
      console.error("Status update failed:", err);
    }
  };

  const handleDelete = () => {
    setIsDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    setIsDeleteConfirmOpen(false);
    setIsDeleting(true);
    try {
      const res = await fetch(`${API_BASE}/tasks/delete/${task.id}`, { 
        method: "DELETE", 
        headers: getAuthHeaders()
      });

      if (res.ok) {
        showToast("Task successfully deleted!", "success");
        await onUpdate();
        onClose();
      } else {
        showToast("Failed to delete task.", "error");
        console.warn("Backend Session Error detected, forcing UI refresh...");
        await onUpdate();
        onClose();
      }
    } catch (e) {
      showToast("Error deleting task.", "error");
      console.error("Delete error:", e);
      await onUpdate();
      onClose();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[5000] bg-slate-900/40 backdrop-blur-sm flex justify-center items-start pt-6 overflow-y-auto p-4"
    >
      <motion.div 
        initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-4xl rounded-2xl overflow-hidden flex flex-col lg:flex-row shadow-2xl"
      >
        <div className="w-full lg:w-3/12 bg-slate-50 dark:bg-slate-950/40 p-4 flex flex-col items-center justify-start gap-3 relative border-r border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-1.5 self-start">
            <div className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse" />
            <span className="text-[8px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-[0.3em]">Task</span>
          </div>

          {/* Attachments & Links Gallery in Detail Modal */}
          <div className="w-full space-y-2">
            {task.attachments && task.attachments.length > 0 ? (
              <div className="space-y-1.5 w-full">
                {task.attachments.map((att, idx) => {
                  const fileUrl = getTaskImageUrl(att);
                  const isImg = att?.fileType === 'image' || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(fileUrl || att?.name || '');
                  return (
                    <div key={idx} className="group relative w-full">
                      <a 
                        href={fileUrl} 
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-indigo-600 hover:border-indigo-500/50 transition shadow-xs cursor-pointer group w-full text-left"
                      >
                        {isImg ? (
                          <ImageIcon size={14} className="text-indigo-500 shrink-0 group-hover:scale-110 transition-transform" />
                        ) : (
                          <FileText size={14} className="text-indigo-500 shrink-0 group-hover:scale-110 transition-transform" />
                        )}
                        <span className="truncate flex-1 font-bold text-[11px]">{att.name || (isImg ? 'View Image' : 'View Document')}</span>
                        <ExternalLink size={11} className="text-slate-400 group-hover:text-indigo-500 shrink-0" />
                      </a>
                    </div>
                  );
                })}
              </div>
            ) : (
              (task.image || task.file) && (
                <a 
                  href={getTaskImageUrl(task.image || task.file)} 
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-indigo-600 hover:border-indigo-500/50 transition shadow-xs cursor-pointer group w-full text-left"
                >
                  <ImageIcon size={14} className="text-indigo-500 shrink-0 group-hover:scale-110 transition-transform" />
                  <span className="truncate flex-1 font-bold text-[11px]">View Attachment</span>
                  <ExternalLink size={11} className="text-slate-400 group-hover:text-indigo-500 shrink-0" />
                </a>
              )
            )}

            {/* Links List */}
            {task.links && task.links.length > 0 && (
              <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800 w-full">
                <span className="text-[9px] font-black text-indigo-500 uppercase tracking-wider block">Attached Links</span>
                {task.links.map((link, idx) => (
                  <a
                    key={idx}
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 rounded-xl border border-indigo-200 dark:border-indigo-800/60 text-xs font-bold hover:underline truncate w-full"
                  >
                    <ExternalLink size={12} className="shrink-0 text-indigo-500" />
                    <span className="truncate flex-1">{link.title || link.url}</span>
                  </a>
                ))}
              </div>
            )}
          </div>

          {isEditing && (
            <label className="w-full py-2 border border-dashed border-indigo-500/30 rounded-lg flex items-center justify-center gap-2 cursor-pointer hover:bg-indigo-500/5 transition-all">
              <input type="file" multiple className="hidden" onChange={(e) => setNewFile(e.target.files[0])} />
              <Camera size={13} className="text-indigo-500" />
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest truncate max-w-[120px]">
                {newFile ? newFile.name : 'Add / Replace File'}
              </span>
            </label>
          )}
        </div>

        <div className="w-full lg:w-9/12 p-5 relative flex flex-col justify-between bg-white dark:bg-slate-900">
          <button onClick={onClose} className="absolute top-4 right-4 p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 transition-all">
            <X size={16} />
          </button>

          <div>
            {/* STATUS & PRIORITY */}
            <div className="mb-3">
              {isEditing ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] text-slate-500 dark:text-slate-400 font-black uppercase tracking-widest mb-1 block ml-1">Status</label>
                    <select
                      value={editForm.status}
                      onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                      className="w-full appearance-none bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3 py-2 rounded-xl text-slate-900 dark:text-slate-100 text-xs font-black uppercase tracking-[0.15em] outline-none focus:border-indigo-500/50 cursor-pointer"
                    >
                      <option value="pending">PENDING</option>
                      <option value="current">CURRENT</option>
                      <option value="preview">PREVIEW</option>
                      <option value="done">COMPLETED</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] text-slate-500 dark:text-slate-400 font-black uppercase tracking-widest mb-1 block ml-1">Priority</label>
                    <select
                      value={editForm.priority || 'medium'}
                      onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}
                      className="w-full appearance-none bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3 py-2 rounded-xl text-slate-900 dark:text-slate-100 text-xs font-black uppercase tracking-[0.15em] outline-none focus:border-indigo-500/50 cursor-pointer"
                    >
                      <option value="high">🔴 HIGH PRIORITY</option>
                      <option value="medium">🔷 MEDIUM PRIORITY</option>
                      <option value="low">🟡 LOW PRIORITY</option>
                    </select>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${statusConfig[task.status]?.activeClass || 'bg-slate-500/10 border-slate-500/20 text-slate-600'}`}>
                    <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${statusConfig[task.status]?.dot || 'bg-slate-500'}`} />
                    <span className="font-black uppercase text-[10px] tracking-widest">
                      {statusConfig[task.status]?.label || task.status}
                    </span>
                  </div>

                  {(() => {
                    const prioKey = String(task.priority || 'medium').toLowerCase();
                    const meta = PRIORITY_META[prioKey] || PRIORITY_META.medium;
                    return (
                      <div style={meta.style} className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${meta.color}`}>
                        <div style={meta.dotStyle} className={`w-1.5 h-1.5 rounded-full animate-pulse ${meta.dot}`} />
                        <span className="font-black uppercase text-[10px] tracking-widest">
                          {meta.label}
                        </span>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {isEditing ? (
              <div className="space-y-3">
                <div>
                  <label className="text-[9px] text-slate-500 dark:text-slate-400 font-black uppercase tracking-widest mb-1 block ml-1">Title</label>
                  <input 
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3 py-2 rounded-xl text-slate-900 dark:text-slate-100 text-base font-bold outline-none focus:border-indigo-500/50" 
                    value={editForm.title} 
                    onChange={e => setEditForm({...editForm, title: e.target.value})} 
                  />
                </div>
                <div>
                  <label className="text-[9px] text-slate-500 dark:text-slate-400 font-black uppercase tracking-widest mb-1 block ml-1">Description</label>
                  <textarea 
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3 py-2 rounded-xl text-slate-900 dark:text-slate-100 text-sm h-24 outline-none focus:border-indigo-500/50 resize-none leading-relaxed" 
                    value={editForm.description} 
                    onChange={e => setEditForm({...editForm, description: e.target.value})} 
                  />
                </div>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="text-[9px] text-slate-500 dark:text-slate-400 font-black uppercase tracking-widest mb-1 block ml-1">Client</label>
                    <select
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3 py-2 rounded-xl text-slate-900 dark:text-slate-100 text-xs font-bold outline-none cursor-pointer"
                      value={(editForm.client && typeof editForm.client === 'object') ? (editForm.client._id || editForm.client.id) : (editForm.client || '')}
                      onChange={e => setEditForm({ ...editForm, client: e.target.value })}
                    >
                      <option value="">Select Client (Optional)</option>
                      {clientsList.map(c => (
                        <option key={c._id || c.id} value={c._id || c.id}>
                          {c.companyName} ({c.clientId})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] text-slate-500 dark:text-slate-400 font-black uppercase tracking-widest mb-1 block ml-1">Project</label>
                    <select
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3 py-2 rounded-xl text-slate-900 dark:text-slate-100 text-xs font-bold outline-none cursor-pointer"
                      value={(editForm.project && typeof editForm.project === 'object') ? (editForm.project._id || editForm.project.id) : (editForm.project || '')}
                      onChange={e => setEditForm({ ...editForm, project: e.target.value })}
                    >
                      <option value="">Select Active Project (Optional)</option>
                      {projectsList.map(p => (
                        <option key={p._id || p.id} value={p._id || p.id}>
                          {p.projectName} ({p.projectCode})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight leading-tight">
                  {task.title}
                </h2>
                
                {/* CLIENT & PROJECT BADGES */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold border border-slate-200 dark:border-slate-700">
                    <Building className="w-3.5 h-3.5 text-indigo-500" />
                    <span>
                      Client: {typeof task.client === 'object' && task.client ? (task.client?.companyName || task.client?.clientName) : (clientsList.find(c => String(c._id || c.id) === String(task.client || task.client_id))?.companyName || (task.client || 'General Client'))}
                    </span>
                  </div>

                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-bold border border-indigo-200 dark:border-indigo-800/60">
                    <FolderKanban className="w-3.5 h-3.5 text-indigo-500" />
                    <span>
                      Project: {typeof task.project === 'object' && task.project ? (task.project?.projectName || task.project?.projectCode) : (projectsList.find(p => String(p._id || p.id) === String(task.project || task.project_id))?.projectName || (task.project || 'Standalone Task'))}
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-950/40 border-y border-r border-slate-100 dark:border-slate-800 border-l-2 border-l-indigo-500 rounded-r-xl">
                  <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed font-medium">
                    {task.description || 'No briefing recorded.'}
                  </p>
                </div>
              </div>
            )}

            {/* Subtasks Section inside Detail Modal */}
            <SubtasksSection 
              task={task} 
              canManageSubtasks={canManageSubtasks} 
              API_BASE={API_BASE} 
              getAuthHeaders={getAuthHeaders} 
              onUpdate={onUpdate} 
              users={users} 
            />

            <TaskCollaboration
              task={task}
              currentUserId={currentUserId}
              onTaskUpdate={onUpdate}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 py-3 border-y border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/20 rounded-xl px-3 mt-3">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.3em] block">Staff</span>
                {effectiveUserId && (
                  <button
                    type="button"
                    onClick={async () => {
                      const currentList = Array.isArray(editForm?.assigned_to)
                        ? editForm.assigned_to.map(String)
                        : (editForm?.assigned_to ? [String(editForm.assigned_to)] : []);
                      
                      const isSelfAssigned = currentList.includes(String(effectiveUserId));
                      const nextList = isSelfAssigned
                        ? currentList.filter(id => id !== String(effectiveUserId))
                        : [...currentList, String(effectiveUserId)];

                      setEditForm(prev => ({ ...prev, assigned_to: nextList }));

                      try {
                        const fd = new FormData();
                        fd.append('assigned_to', JSON.stringify(nextList));
                        const res = await fetch(`${API_BASE}/tasks/update/${task.id}`, {
                          method: "PUT",
                          headers: getAuthHeaders(),
                          body: fd
                        });
                        if (res.ok) {
                          showToast(isSelfAssigned ? "Removed self assignment" : "Successfully self-assigned to this task!", "success");
                          await onUpdate();
                        } else {
                          showToast("Failed to update self assignment", "error");
                        }
                      } catch (e) {
                        console.error("Self assign error:", e);
                        showToast("Network error during self-assignment", "error");
                      }
                    }}
                    className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-0.5 rounded-lg border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition cursor-pointer flex items-center gap-1"
                  >
                    <User size={10} /> {(Array.isArray(editForm?.assigned_to) ? editForm.assigned_to : [editForm?.assigned_to]).map(String).includes(String(effectiveUserId)) ? '✓ Self Assigned' : '+ Self Assign'}
                  </button>
                )}
              </div>
              {isEditing ? (
                <div className="space-y-2">
                  {(Array.isArray(editForm.assigned_to) ? editForm.assigned_to : (editForm.assigned_to ? [editForm.assigned_to] : [])).length > 0 && (
                    <div className="flex flex-wrap gap-1 p-1.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 max-h-24 overflow-y-auto">
                      {(Array.isArray(editForm.assigned_to) ? editForm.assigned_to : [editForm.assigned_to]).map((uId) => {
                        const uObj = users.find(u => String(u.id || u._id) === String(uId));
                        const uName = uObj ? uObj.name : uId;
                        const desigName = getUserDesignationName(uObj, designations, users);
                        return (
                          <div key={uId} className="inline-flex items-center gap-1.5 bg-indigo-100 dark:bg-indigo-950 px-2.5 py-1 rounded-xl text-xs font-bold text-indigo-900 dark:text-indigo-100 border border-indigo-200 dark:border-indigo-800">
                            <div className="flex flex-col">
                              <span className="font-bold leading-tight">{uName}</span>
                              {desigName && (
                                <span className="text-[9px] text-indigo-600 dark:text-indigo-400 font-medium leading-none mt-0.5">
                                  {desigName}
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const current = Array.isArray(editForm.assigned_to) ? editForm.assigned_to : [editForm.assigned_to];
                                const next = current.filter(id => String(id) !== String(uId));
                                setEditForm({ ...editForm, assigned_to: next });
                              }}
                              className="hover:text-rose-500 p-0.5 cursor-pointer ml-1"
                            >
                              <X size={10} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <select
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2 rounded-xl text-slate-900 dark:text-slate-100 text-[11px] font-bold outline-none cursor-pointer"
                    value=""
                    onChange={e => {
                      const selectedId = e.target.value;
                      if (!selectedId) return;
                      const current = Array.isArray(editForm.assigned_to) ? editForm.assigned_to : (editForm.assigned_to ? [editForm.assigned_to] : []);
                      let next;
                      if (current.map(String).includes(String(selectedId))) {
                        next = current.filter(id => String(id) !== String(selectedId));
                      } else {
                        next = [...current, selectedId];
                      }
                      setEditForm({ ...editForm, assigned_to: next });
                    }}
                  >
                    <option value="">+ Assign / Remove Staff...</option>
                    {users.map(u => {
                      const uId = u.id || u._id;
                      const isSel = (Array.isArray(editForm.assigned_to) ? editForm.assigned_to : [editForm.assigned_to]).some(id => String(id) === String(uId));
                      const desigName = getUserDesignationName(u, designations, users);
                      return (
                        <option key={uId} value={uId} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-medium">
                          {isSel ? `✓ ${u.name}` : u.name}{desigName ? ` — (${desigName})` : ''}{isSel ? ' [Selected]' : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {(Array.isArray(task.assigned_to) ? task.assigned_to : [task.assigned_to]).filter(Boolean).map((uItem, idx) => {
                    const uName = getUserDisplayName(uItem, users);
                    const desigName = getUserDesignationName(uItem, designations, users);
                    return (
                      <div key={idx} className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800">
                        <div className="h-7 w-7 bg-indigo-500/10 rounded-full flex items-center justify-center border border-indigo-500/20 text-indigo-400 shrink-0">
                          <User size={14} />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-slate-900 dark:text-slate-100 font-bold uppercase text-xs leading-tight">
                            {uName}
                          </span>
                          {desigName && (
                            <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold leading-tight mt-0.5">
                              {desigName}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div>
              <span className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.3em] block mb-2">Due Date & Time</span>
              {isEditing ? (
                <input 
                  type="datetime-local"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 rounded-xl text-slate-900 dark:text-slate-100 text-[11px] font-bold outline-none"
                  value={getDatetimeLocalValue(editForm.dueDate)}
                  onChange={e => setEditForm({...editForm, dueDate: e.target.value})} 
                />
              ) : (
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-rose-500/10 rounded-full flex items-center justify-center border border-rose-500/20 text-rose-400">
                    <Clock size={18} />
                  </div>
                  <span className="text-slate-900 dark:text-slate-100 font-bold tracking-tight uppercase text-sm">
                    {task.dueDate ? formatDateTimeDisplay(task.dueDate) : 'No Due Date & Time'}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-end gap-2.5">
            {canModify ? (
              <>
                {isDeleteConfirmOpen ? (
                  <div className="flex items-center gap-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/50 px-3 py-1.5 rounded-xl animate-in slide-in-from-left-2 fade-in duration-200">
                    <span className="text-xs font-bold text-red-600 dark:text-red-400">Delete task?</span>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setIsDeleteConfirmOpen(false)}
                        className="px-2.5 py-1 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={handleConfirmDelete}
                        className="px-2.5 py-1 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded-lg shadow-md shadow-red-500/20 transition-colors"
                      >
                        Yes
                      </button>
                    </div>
                  </div>
                ) : (
                  <button 
                    onClick={handleDelete}
                    disabled={isSaving || isDeleting}
                    className="px-3 py-2 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center cursor-pointer"
                  >
                    {isDeleting ? <Loader2 className="animate-spin" size={13} /> : <Trash2 size={13} />}
                  </button>
                )}
                <button 
                  onClick={isEditing ? handleUpdate : () => setIsEditing(true)} 
                  disabled={isSaving || isDeleting}
                  className="px-4 py-2 bg-indigo-600 text-white font-extrabold uppercase text-[10px] tracking-[0.15em] rounded-xl flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all active:scale-95 shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {isSaving ? <Loader2 className="animate-spin" size={13} /> : isEditing ? <Save size={13} /> : <Edit3 size={13} />}
                  {isEditing ? (isSaving ? "Saving..." : "Save Changes") : "Edit Task"}
                </button>
              </>
            ) : (
              <div className="w-full py-3 bg-slate-50 dark:bg-slate-950/20 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 text-slate-500 dark:text-slate-400">
                <span className="text-[10px] uppercase tracking-widest font-black">Creator</span>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{getOwnerDisplayName(task, users)}</span>
              </div>
            )}
          </div>
        </div>

      </motion.div>
    </motion.div>
  );
};
export default Todo;
