import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  Building, ArrowLeft, Mail, Phone, Globe, MapPin, Calendar as CalendarIcon, 
  ShieldCheck, FolderKanban, FileText, Clock, Plus, ChevronRight, User as UserIcon, Edit,
  Video, PhoneCall, CheckCircle2, AlertCircle, CalendarDays, BarChart3, Search, CheckSquare,
  ChevronLeft, X, Trash2, Tag, Check, Pencil, CalendarClock, Layers, Eye, Activity
} from 'lucide-react';
import { 
  getClientById,
  createClientMeeting,
  updateClientMeeting,
  deleteClientMeeting,
  createClientFollowup,
  updateClientFollowup,
  deleteClientFollowup
} from '../services/clientService';
import { useToast } from '../components/ToastProvider';
import { formatApiError } from '../utils/errorUtils';
import EditClientModal from '../components/clients/EditClientModal';
import ConfirmModal from '../components/ConfirmModal';

const ClientDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [editOpen, setEditOpen] = useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null
  });

  // Sub-tabs states
  const [meetingsSubTab, setMeetingsSubTab] = useState('today'); // 'today' | 'upcoming' | 'history'
  const [followupsSubTab, setFollowupsSubTab] = useState('today'); // 'today' | 'upcoming' | 'overdue' | 'all'
  const [reportsSubTab, setReportsSubTab] = useState('meetings'); // 'meetings' | 'followups'

  // Modals & Editing states
  const [isAddMeetingOpen, setIsAddMeetingOpen] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState(null);

  // Postpone Meeting modal state
  const [isPostponeModalOpen, setIsPostponeModalOpen] = useState(false);
  const [postponingMeeting, setPostponingMeeting] = useState(null);
  const [postponeForm, setPostponeForm] = useState({
    newDate: new Date().toISOString().split('T')[0],
    newTime: '10:00 AM',
    reason: ''
  });

  const [isAddFollowUpOpen, setIsAddFollowUpOpen] = useState(false);
  const [editingFollowup, setEditingFollowup] = useState(null);

  // Calendar view & Date Details modal state
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(null);
  const [isDateDetailsOpen, setIsDateDetailsOpen] = useState(false);

  // Form states
  const [meetingForm, setMeetingForm] = useState({
    title: '',
    date: new Date().toISOString().split('T')[0],
    time: '10:00 AM',
    type: 'Online (Google Meet)',
    status: 'Scheduled',
    attendees: '',
    notes: ''
  });

  const [followUpForm, setFollowUpForm] = useState({
    title: '',
    dueDate: new Date().toISOString().split('T')[0],
    dueTime: '03:00 PM',
    priority: 'High',
    notes: '',
    status: 'Pending'
  });

  // Meetings, Follow-ups, Projects data state
  const [meetings, setMeetings] = useState([]);
  const [followups, setFollowups] = useState([]);
  const [clientProjects, setClientProjects] = useState([]);

  useEffect(() => {
    if (!id || id === 'undefined' || id === 'null') {
      setLoading(false);
      return;
    }
    fetchClientDetails();
  }, [id]);

  const fetchClientDetails = async () => {
    if (!id || id === 'undefined' || id === 'null') {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await getClientById(id);
      if (res && res.success) {
        setData(res.data);
        setClientProjects(res.data?.projects || []);

        let initialMeetings = res.data?.meetings || [];
        let initialFollowups = res.data?.followups || [];

        // Migrate any legacy localStorage items once, then clear localStorage
        const mainId = res.data?.client?._id || id;
        const legacyM = localStorage.getItem(`crm_meetings_${mainId}`) || localStorage.getItem(`crm_meetings_${id}`);
        const legacyF = localStorage.getItem(`crm_followups_${mainId}`) || localStorage.getItem(`crm_followups_${id}`);

        if (legacyM) {
          try {
            const parsedM = JSON.parse(legacyM);
            if (Array.isArray(parsedM) && parsedM.length > 0 && initialMeetings.length === 0) {
              for (const m of parsedM) {
                await createClientMeeting(mainId, {
                  title: m.title,
                  date: m.date,
                  time: m.time,
                  type: m.type,
                  status: m.status,
                  attendees: m.attendees,
                  notes: m.notes
                });
              }
              const refreshed = await getClientById(id);
              if (refreshed?.data?.meetings) initialMeetings = refreshed.data.meetings;
            }
          } catch (e) {}
          localStorage.removeItem(`crm_meetings_${mainId}`);
          localStorage.removeItem(`crm_meetings_${id}`);
        }

        if (legacyF) {
          try {
            const parsedF = JSON.parse(legacyF);
            if (Array.isArray(parsedF) && parsedF.length > 0 && initialFollowups.length === 0) {
              for (const f of parsedF) {
                await createClientFollowup(mainId, {
                  title: f.title,
                  dueDate: f.dueDate,
                  dueTime: f.dueTime,
                  priority: f.priority,
                  status: f.status,
                  notes: f.notes
                });
              }
              const refreshed = await getClientById(id);
              if (refreshed?.data?.followups) initialFollowups = refreshed.data.followups;
            }
          } catch (e) {}
          localStorage.removeItem(`crm_followups_${mainId}`);
          localStorage.removeItem(`crm_followups_${id}`);
        }

        setMeetings(initialMeetings);
        setFollowups(initialFollowups);
      } else {
        showToast(formatApiError(res, "Failed to load client details"), "error");
      }
    } catch (err) {
      console.error("Failed to fetch client details:", err);
      showToast(formatApiError(err, "Server error fetching client details"), "error");
    } finally {
      setLoading(false);
    }
  };

  // --- Meeting Actions ---
  const handleOpenAddMeeting = (initialDate = null) => {
    setEditingMeeting(null);
    setMeetingForm({
      title: '',
      date: initialDate || new Date().toISOString().split('T')[0],
      time: '10:00 AM',
      type: 'Online (Google Meet)',
      status: 'Scheduled',
      attendees: '',
      notes: ''
    });
    setIsAddMeetingOpen(true);
  };

  const handleEditMeeting = (m) => {
    setEditingMeeting(m);
    setMeetingForm({
      title: m.title || '',
      date: m.date || new Date().toISOString().split('T')[0],
      time: m.time || '10:00 AM',
      type: m.type || 'Online (Google Meet)',
      status: m.status || 'Scheduled',
      attendees: m.attendees || '',
      notes: m.notes || ''
    });
    setIsAddMeetingOpen(true);
  };

  const handleSelectMeetingStatus = async (m, nextStatus) => {
    if (nextStatus === 'Postponed') {
      setPostponingMeeting(m);
      setPostponeForm({
        newDate: m.date || new Date(Date.now() + 86400000).toISOString().split('T')[0],
        newTime: m.time || '10:00 AM',
        reason: ''
      });
      setIsPostponeModalOpen(true);
      return;
    }
    const meetingId = m._id || m.id;
    const clientId = data?.client?._id || id;
    try {
      const res = await updateClientMeeting(clientId, meetingId, { status: nextStatus });
      if (res && res.success) {
        setMeetings(prev => prev.map(item => (item._id === meetingId || item.id === meetingId) ? { ...item, status: nextStatus } : item));
        showToast(`Meeting status updated to ${nextStatus}`, 'success');
      } else {
        showToast(res?.message || 'Failed to update meeting status', 'error');
      }
    } catch (err) {
      showToast(formatApiError(err, 'Failed to update meeting status'), 'error');
    }
  };

  const handleConfirmPostpone = async (e) => {
    e.preventDefault();
    if (!postponingMeeting) return;
    if (!postponeForm.newDate) {
      showToast('Please select a new date for the postponed meeting', 'warning');
      return;
    }
    const meetingId = postponingMeeting._id || postponingMeeting.id;
    const clientId = data?.client?._id || id;
    const reasonTag = postponeForm.reason.trim() ? `[Postponed: ${postponeForm.reason.trim()}]` : '';
    const updatedNotes = postponingMeeting.notes ? `${postponingMeeting.notes} ${reasonTag}`.trim() : reasonTag;
    
    try {
      const res = await updateClientMeeting(clientId, meetingId, {
        date: postponeForm.newDate,
        time: postponeForm.newTime || postponingMeeting.time,
        status: 'Postponed',
        notes: updatedNotes
      });
      if (res && res.success) {
        setMeetings(prev => prev.map(m => (m._id === meetingId || m.id === meetingId) ? {
          ...m,
          date: postponeForm.newDate,
          time: postponeForm.newTime || m.time,
          status: 'Postponed',
          notes: updatedNotes
        } : m));
        showToast(`Meeting postponed & rescheduled to ${postponeForm.newDate} at ${postponeForm.newTime}`, 'success');
      } else {
        showToast(res?.message || 'Failed to postpone meeting', 'error');
      }
    } catch (err) {
      showToast(formatApiError(err, 'Failed to postpone meeting'), 'error');
    } finally {
      setIsPostponeModalOpen(false);
      setPostponingMeeting(null);
    }
  };

  const handleDeleteMeeting = (mId) => {
    setDeleteConfirm({
      isOpen: true,
      title: 'Delete Scheduled Meeting',
      message: 'Are you sure you want to delete this meeting? This action cannot be undone.',
      onConfirm: async () => {
        const clientId = data?.client?._id || id;
        try {
          const res = await deleteClientMeeting(clientId, mId);
          if (res && res.success) {
            setMeetings(prev => prev.filter(m => (m._id || m.id) !== mId));
            showToast('Meeting deleted successfully', 'info');
          } else {
            showToast(res?.message || 'Failed to delete meeting', 'error');
          }
        } catch (err) {
          showToast(formatApiError(err, 'Failed to delete meeting'), 'error');
        } finally {
          setDeleteConfirm(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleSaveMeeting = async (e) => {
    e.preventDefault();
    if (!meetingForm.title.trim()) {
      showToast('Please enter a meeting title', 'warning');
      return;
    }
    if (meetingForm.status === 'Postponed' && !editingMeeting) {
      setPostponingMeeting({ ...meetingForm });
      setPostponeForm({
        newDate: meetingForm.date,
        newTime: meetingForm.time,
        reason: ''
      });
      setIsAddMeetingOpen(false);
      setIsPostponeModalOpen(true);
      return;
    }

    const clientId = data?.client?._id || id;
    const payload = {
      title: meetingForm.title.trim(),
      date: meetingForm.date,
      time: meetingForm.time,
      type: meetingForm.type,
      status: meetingForm.status || 'Scheduled',
      attendees: meetingForm.attendees.trim() || 'Account Manager',
      notes: meetingForm.notes.trim() || 'No additional notes provided.'
    };

    try {
      if (editingMeeting) {
        const meetingId = editingMeeting._id || editingMeeting.id;
        const res = await updateClientMeeting(clientId, meetingId, payload);
        if (res && res.success) {
          setMeetings(prev => prev.map(m => (m._id === meetingId || m.id === meetingId) ? (res.data || { ...m, ...payload }) : m));
          showToast('Meeting updated successfully!', 'success');
        } else {
          showToast(res?.message || 'Failed to update meeting', 'error');
        }
      } else {
        const res = await createClientMeeting(clientId, payload);
        if (res && res.success) {
          setMeetings(prev => [res.data, ...prev]);
          showToast('Meeting scheduled successfully!', 'success');
        } else {
          showToast(res?.message || 'Failed to schedule meeting', 'error');
        }
      }
    } catch (err) {
      showToast(formatApiError(err, 'Failed to save meeting'), 'error');
    } finally {
      setIsAddMeetingOpen(false);
      setEditingMeeting(null);
    }
  };

  // --- Follow-up Actions ---
  const handleOpenAddFollowUp = (initialDate = null) => {
    setEditingFollowup(null);
    setFollowUpForm({
      title: '',
      dueDate: initialDate || new Date().toISOString().split('T')[0],
      dueTime: '03:00 PM',
      priority: 'High',
      notes: '',
      status: 'Pending'
    });
    setIsAddFollowUpOpen(true);
  };

  const handleEditFollowUp = (f) => {
    setEditingFollowup(f);
    setFollowUpForm({
      title: f.title || '',
      dueDate: f.dueDate || new Date().toISOString().split('T')[0],
      dueTime: f.dueTime || '03:00 PM',
      priority: f.priority || 'High',
      notes: f.notes || '',
      status: f.status || 'Pending'
    });
    setIsAddFollowUpOpen(true);
  };

  const handleDeleteFollowUp = (fId) => {
    setDeleteConfirm({
      isOpen: true,
      title: 'Delete Follow-up Task',
      message: 'Are you sure you want to delete this follow-up task? This action cannot be undone.',
      onConfirm: async () => {
        const clientId = data?.client?._id || id;
        try {
          const res = await deleteClientFollowup(clientId, fId);
          if (res && res.success) {
            setFollowups(prev => prev.filter(f => (f._id || f.id) !== fId));
            showToast('Follow-up task deleted successfully', 'info');
          } else {
            showToast(res?.message || 'Failed to delete follow-up', 'error');
          }
        } catch (err) {
          showToast(formatApiError(err, 'Failed to delete follow-up'), 'error');
        } finally {
          setDeleteConfirm(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleSaveFollowUp = async (e) => {
    e.preventDefault();
    if (!followUpForm.title.trim()) {
      showToast('Please enter a follow-up title', 'warning');
      return;
    }
    const clientId = data?.client?._id || id;

    try {
      if (editingFollowup) {
        const followupId = editingFollowup._id || editingFollowup.id;
        const payload = {
          title: followUpForm.title.trim(),
          dueDate: followUpForm.dueDate,
          dueTime: followUpForm.dueTime,
          priority: followUpForm.priority,
          notes: followUpForm.notes.trim() || 'Follow-up task updated.'
        };
        const res = await updateClientFollowup(clientId, followupId, payload);
        if (res && res.success) {
          setFollowups(prev => prev.map(f => (f._id === followupId || f.id === followupId) ? (res.data || { ...f, ...payload }) : f));
          showToast('Follow-up task updated successfully!', 'success');
        } else {
          showToast(res?.message || 'Failed to update follow-up', 'error');
        }
      } else {
        const payload = {
          title: followUpForm.title.trim(),
          dueDate: followUpForm.dueDate,
          dueTime: followUpForm.dueTime,
          priority: followUpForm.priority,
          status: 'Pending',
          notes: followUpForm.notes.trim() || 'Follow-up task scheduled.'
        };
        const res = await createClientFollowup(clientId, payload);
        if (res && res.success) {
          setFollowups(prev => [res.data, ...prev]);
          showToast('Follow-up task added successfully!', 'success');
        } else {
          showToast(res?.message || 'Failed to add follow-up', 'error');
        }
      }
    } catch (err) {
      showToast(formatApiError(err, 'Failed to save follow-up'), 'error');
    } finally {
      setIsAddFollowUpOpen(false);
      setEditingFollowup(null);
    }
  };

  const toggleFollowUpStatus = async (fId) => {
    const target = followups.find(f => (f._id || f.id) === fId);
    if (!target) return;
    const nextStatus = target.status === 'Completed' ? 'Pending' : 'Completed';
    const clientId = data?.client?._id || id;
    try {
      const res = await updateClientFollowup(clientId, fId, { status: nextStatus });
      if (res && res.success) {
        setFollowups(prev => prev.map(f => (f._id === fId || f.id === fId) ? { ...f, status: nextStatus } : f));
        showToast(`Follow-up marked as ${nextStatus}`, 'success');
      } else {
        showToast(res?.message || 'Failed to update follow-up status', 'error');
      }
    } catch (err) {
      showToast(formatApiError(err, 'Failed to update follow-up status'), 'error');
    }
  };

  // --- Project Actions ---
  const handleDeleteProjectCard = (pId) => {
    setDeleteConfirm({
      isOpen: true,
      title: 'Remove Project Card',
      message: 'Are you sure you want to remove this project from client view?',
      onConfirm: () => {
        setClientProjects(prev => prev.filter(p => (p._id || p.id) !== pId));
        showToast('Project removed successfully', 'info');
        setDeleteConfirm(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  // --- Calendar Date Click Action ---
  const handleCalendarDayClick = (dateStr) => {
    setSelectedCalendarDate(dateStr);
    setIsDateDetailsOpen(true);
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-xs text-slate-400 font-semibold">
        Loading enterprise client profile...
      </div>
    );
  }

  if (!data || !data.client) {
    return (
      <div className="py-20 text-center text-xs text-slate-400 font-semibold flex flex-col items-center gap-3">
        <Building className="w-10 h-10 text-slate-300 dark:text-slate-700" />
        <span>Client profile not found.</span>
        <button onClick={() => navigate('/clients')} className="text-indigo-600 font-bold hover:underline">
          Return to Directory
        </button>
      </div>
    );
  }

  const { client, activities = [] } = data;
  const todayStr = new Date().toISOString().split('T')[0];

  // Filtering Meetings - Postponed meetings show under Today's or Upcoming, NEVER in History
  const todayMeetings = meetings.filter(m => m.date === todayStr && m.status !== 'Completed' && m.status !== 'Cancelled');
  const upcomingMeetings = meetings.filter(m => (m.date > todayStr || m.status === 'Postponed') && m.status !== 'Completed' && m.status !== 'Cancelled');
  const historyMeetings = meetings.filter(m => m.status !== 'Postponed' && (m.status === 'Completed' || m.status === 'Cancelled' || m.date < todayStr));

  // Filtering Follow-ups
  const todayFollowups = followups.filter(f => f.dueDate === todayStr);
  const upcomingFollowups = followups.filter(f => f.dueDate > todayStr && f.status !== 'Completed');
  const overdueFollowups = followups.filter(f => f.dueDate < todayStr && f.status !== 'Completed');

  // Active Follow-ups list selection
  const activeFollowupsList = 
    followupsSubTab === 'all' ? followups :
    followupsSubTab === 'today' ? todayFollowups :
    followupsSubTab === 'upcoming' ? upcomingFollowups :
    overdueFollowups;

  // Calendar calculations
  const currYear = calendarDate.getFullYear();
  const currMonth = calendarDate.getMonth();
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const daysInMonth = new Date(currYear, currMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(currYear, currMonth, 1).getDay();

  // Events for selected calendar date modal
  const selectedDateMeetings = meetings.filter(m => m.date === selectedCalendarDate);
  const selectedDateFollowups = followups.filter(f => f.dueDate === selectedCalendarDate);

  // Unified Activity Timeline entries (ONLY showing completed meetings & system logs)
  const combinedTimeline = [
    ...activities.map(act => ({
      id: act._id || act.id || `act_${Math.random()}`,
      category: 'system',
      title: act.title || 'Client Log Recorded',
      subtitle: act.description || 'System activity logged',
      date: act.createdAt ? new Date(act.createdAt).toLocaleString() : 'Recently',
      timestamp: act.createdAt ? new Date(act.createdAt).getTime() : Date.now(),
      status: 'Logged',
      icon: Activity,
      color: 'bg-slate-500'
    })),
    ...meetings.filter(m => m.status === 'Completed').map(m => ({
      id: `m_tl_${m.id}`,
      category: 'meeting',
      title: `Completed Meeting: ${m.title}`,
      subtitle: `Date: ${m.date} at ${m.time} (${m.type}) • Attendees: ${m.attendees || 'Account Team'}`,
      date: `${m.date} ${m.time}`,
      timestamp: new Date(`${m.date} ${m.time}`).getTime() || Date.now(),
      status: m.status,
      icon: Video,
      color: 'bg-emerald-500'
    }))
  ].sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto">
      {/* Back Button */}
      <button
        onClick={() => navigate('/clients')}
        className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors w-fit cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Directory
      </button>

      {/* Profile Header Hero Card */}
      <div className="p-6 md:p-8 rounded-3xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800/80 backdrop-blur-md shadow-xl flex flex-col md:flex-row justify-between gap-6 items-start md:items-center">
        <div className="flex items-center gap-5">
          {client.companyLogo ? (
            <img src={client.companyLogo} alt="" className="w-16 h-16 rounded-2xl object-cover ring-4 ring-indigo-500/20 shadow-md" />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-black text-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              {client.companyName?.[0]}
            </div>
          )}

          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100">{client.companyName}</h1>
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-mono text-[11px] font-bold">
                {client.clientId}
              </span>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-1 flex items-center gap-3">
              <span>Primary Contact: <strong className="text-slate-700 dark:text-slate-300">{client.clientName}</strong></span>
              <span>•</span>
              <span>{client.industry || 'Technology'}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto justify-end flex-wrap">
          <button
            onClick={() => handleOpenAddMeeting()}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition-all cursor-pointer hover:scale-[1.02]"
          >
            <Video className="w-4 h-4" />
            <span>Schedule Meeting</span>
          </button>
          <button
            onClick={() => handleOpenAddFollowUp()}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-md shadow-amber-500/20 transition-all cursor-pointer hover:scale-[1.02]"
          >
            <CheckSquare className="w-4 h-4" />
            <span>Add Follow-up</span>
          </button>
          <button
            onClick={() => setEditOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-700 transition-all cursor-pointer"
          >
            <Edit className="w-4 h-4" />
            <span>Edit Client</span>
          </button>
          <Link
            to={`/projects/new?clientId=${client._id || client.id || client.clientId || id || ''}&clientName=${encodeURIComponent(client.companyName || '')}`}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-sm transition-all hover:scale-[1.02]"
          >
            <Plus className="w-4 h-4" />
            <span>Create Project</span>
          </Link>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800/80 pb-1 overflow-x-auto">
        {[
          { id: 'overview', label: 'Overview & Info', icon: Building },
          { id: 'projects', label: `Projects (${clientProjects.length})`, icon: FolderKanban },
          { id: 'meetings', label: `Meetings (${meetings.length})`, icon: Video },
          { id: 'followups', label: `Follow-ups (${followups.length})`, icon: CheckSquare },
          { id: 'calendar', label: 'Calendar', icon: CalendarDays },
          { id: 'reports', label: 'Reports', icon: BarChart3 },
          { id: 'timeline', label: `Activity Timeline (${combinedTimeline.length})`, icon: Clock }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-extrabold rounded-xl transition-all whitespace-nowrap cursor-pointer ${
                isActive 
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' 
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      {/* 1. OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 p-6 rounded-3xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800/80 backdrop-blur-md shadow-sm flex flex-col gap-6">
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center gap-2">
              <Building size={16} className="text-indigo-600" /> Commercial & Account Parameters
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col gap-1">
                <span className="text-[10px] font-extrabold uppercase text-slate-400">Account Type</span>
                <span className="text-xs font-black text-slate-900 dark:text-slate-100">{client.clientType}</span>
              </div>
              <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-2xl border border-emerald-100 dark:border-emerald-900/40 flex flex-col gap-1">
                <span className="text-[10px] font-extrabold uppercase text-emerald-600 dark:text-emerald-400">NDA Status</span>
                <span className="text-xs font-black text-emerald-700 dark:text-emerald-300">{client.ndaStatus}</span>
              </div>
              <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-2xl border border-indigo-100 dark:border-indigo-900/40 flex flex-col gap-1">
                <span className="text-[10px] font-extrabold uppercase text-indigo-600 dark:text-indigo-400">Expected Revenue</span>
                <span className="text-xs font-black text-slate-900 dark:text-slate-100">₹{(client.expectedMonthlyRevenue || 0).toLocaleString()}/mo</span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col gap-1">
                <span className="text-[10px] font-extrabold uppercase text-slate-400">Lead Source</span>
                <span className="text-xs font-black text-slate-900 dark:text-slate-100">{client.leadSource || 'Direct'}</span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col gap-1">
                <span className="text-[10px] font-extrabold uppercase text-slate-400">Support SLA</span>
                <span className="text-xs font-black text-slate-900 dark:text-slate-100">{client.supportPlan || 'Standard'}</span>
              </div>
            </div>

            {client.notes && (
              <div className="flex flex-col gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <span className="text-[11px] font-bold text-slate-400">Internal Account Notes</span>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800">
                  {client.notes}
                </p>
              </div>
            )}
          </div>

          <div className="p-6 rounded-3xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800/80 backdrop-blur-md shadow-sm flex flex-col gap-4">
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800 pb-2">
              Contact & Location
            </h2>

            <div className="flex flex-col gap-3.5 text-xs text-slate-700 dark:text-slate-300">
              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <Mail className="w-4 h-4 text-indigo-500 shrink-0" />
                <span className="font-semibold">{client.email}</span>
              </div>
              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <Phone className="w-4 h-4 text-indigo-500 shrink-0" />
                <span className="font-semibold">{client.phone}</span>
              </div>
              {client.alternativePhone && (
                <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                  <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="text-slate-500 font-semibold">{client.alternativePhone} <span className="text-[10px] text-slate-400">(Alt)</span></span>
                </div>
              )}
              {client.website && (
                <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                  <Globe className="w-4 h-4 text-indigo-500 shrink-0" />
                  <a href={client.website} target="_blank" rel="noreferrer" className="text-indigo-600 font-semibold hover:underline">
                    {client.website}
                  </a>
                </div>
              )}
              {client.address && (
                <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                  <MapPin className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                  <span className="font-semibold">{client.address}, {client.city}, {client.country}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. PROJECTS TAB */}
      {activeTab === 'projects' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clientProjects.length === 0 ? (
            <div className="col-span-3 py-12 text-center text-xs text-slate-400 font-semibold bg-white/50 dark:bg-slate-900/50 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
              No projects created for this client yet.
            </div>
          ) : (
            clientProjects.map((prj) => (
              <div key={prj._id || prj.id} className="p-4 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800/80 backdrop-blur-md shadow-sm hover:shadow-xl hover:border-indigo-500/40 hover:-translate-y-0.5 transition-all flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <h3 className="text-xs font-black text-slate-900 dark:text-slate-100 leading-snug">{prj.projectName}</h3>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-[9px] font-black text-indigo-600 border border-indigo-200 dark:border-indigo-800 uppercase tracking-wider">
                        {prj.status}
                      </span>
                      <Link
                        to={`/projects/${prj._id || prj.id}`}
                        className="p-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition"
                        title="Edit Project"
                      >
                        <Pencil size={12} />
                      </Link>
                      <button
                        onClick={() => handleDeleteProjectCard(prj._id || prj.id)}
                        className="p-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                        title="Delete Project"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">{prj.description || 'No description provided.'}</p>
                </div>

                <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 dark:border-slate-800/80">
                  <span className="text-[10px] font-mono font-bold text-slate-400">{prj.projectCode}</span>
                  <Link to={`/projects/${prj._id || prj.id}`} className="text-[11px] font-bold text-indigo-600 hover:underline flex items-center gap-0.5">
                    Manage <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* 3. MEETINGS TAB */}
      {activeTab === 'meetings' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/80 dark:bg-slate-900/80 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
            {/* Meetings Sub-tabs */}
            <div className="flex gap-2">
              {[
                { id: 'today', label: `Today's Meetings (${todayMeetings.length})` },
                { id: 'upcoming', label: `Upcoming (${upcomingMeetings.length})` },
                { id: 'history', label: `Meeting History (${historyMeetings.length})` }
              ].map(sub => (
                <button
                  key={sub.id}
                  onClick={() => setMeetingsSubTab(sub.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold cursor-pointer transition ${
                    meetingsSubTab === sub.id 
                      ? 'bg-indigo-600 text-white shadow-xs' 
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  {sub.label}
                </button>
              ))}
            </div>

            <button
              onClick={() => handleOpenAddMeeting()}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-md shadow-indigo-600/20 w-fit transition"
            >
              <Plus size={14} /> Schedule Meeting
            </button>
          </div>

          {/* Compact 3-Column Meetings Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {((meetingsSubTab === 'today' ? todayMeetings : meetingsSubTab === 'upcoming' ? upcomingMeetings : historyMeetings)).length === 0 ? (
              <div className="col-span-3 py-12 text-center text-xs text-slate-400 font-semibold bg-white/50 dark:bg-slate-900/50 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
                No meetings found in this category.
              </div>
            ) : (
              (meetingsSubTab === 'today' ? todayMeetings : meetingsSubTab === 'upcoming' ? upcomingMeetings : historyMeetings).map(m => (
                <div
                  key={m.id}
                  className={`p-4 rounded-2xl bg-white/80 dark:bg-slate-900/80 border backdrop-blur-md shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all flex flex-col justify-between space-y-3 relative overflow-hidden ${
                    m.status === 'Completed' ? 'border-emerald-500/30 border-l-4 border-l-emerald-500' :
                    m.status === 'Scheduled' ? 'border-indigo-500/30 border-l-4 border-l-indigo-500' :
                    m.status === 'Postponed' ? 'border-amber-500/30 border-l-4 border-l-amber-500' :
                    'border-rose-500/30 border-l-4 border-l-rose-500'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-1.5">
                      <h3 className="font-black text-xs text-slate-900 dark:text-white leading-snug line-clamp-2 flex-1">{m.title}</h3>
                      <div className="flex items-center gap-1 shrink-0">
                        {/* Sleek Custom Styled Status Badge Dropdown */}
                        <div className="relative inline-block">
                          <select
                            value={m.status}
                            onChange={e => handleSelectMeetingStatus(m, e.target.value)}
                            className={`appearance-none px-2 py-0.5 text-[9px] font-extrabold rounded-full uppercase tracking-wider border shadow-2xs outline-none cursor-pointer pr-5 transition-all ${
                              m.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800' :
                              m.status === 'Scheduled' ? 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800' :
                              m.status === 'Postponed' ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800 ring-2 ring-amber-400/30' :
                              'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800'
                            }`}
                            title="Click to update or postpone meeting"
                          >
                            <option value="Scheduled">Scheduled</option>
                            <option value="Completed">Completed</option>
                            <option value="Postponed">Postponed</option>
                            <option value="Cancelled">Cancelled</option>
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-1 flex items-center text-current opacity-70">
                            <svg className="w-2 h-2 fill-current" viewBox="0 0 20 20">
                              <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                            </svg>
                          </div>
                        </div>

                        <button
                          onClick={() => handleEditMeeting(m)}
                          className="p-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition cursor-pointer"
                          title="Edit Meeting Details"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          onClick={() => handleDeleteMeeting(m.id)}
                          className="p-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                          title="Delete Meeting"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-500 pt-0.5">
                      <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                        <CalendarIcon size={11} className="text-indigo-500" />
                        <span>{m.date}</span>
                      </div>
                      <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                        <Clock size={11} className="text-indigo-500" />
                        <span>{m.time}</span>
                      </div>
                      <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                        <Video size={11} className="text-indigo-500" />
                        <span className="truncate max-w-[100px]">{m.type}</span>
                      </div>
                    </div>

                    {m.notes && (
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg border border-slate-100 dark:border-slate-800 line-clamp-2">
                        {m.notes}
                      </p>
                    )}
                  </div>

                  <div className="text-[10px] text-slate-400 border-t border-slate-100 dark:border-slate-800/80 pt-2 flex items-center justify-between">
                    <span className="truncate">Attendees: <strong className="text-slate-700 dark:text-slate-300">{m.attendees}</strong></span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 4. FOLLOW-UPS TAB */}
      {activeTab === 'followups' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/80 dark:bg-slate-900/80 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
            {/* Follow-ups Sub-tabs - Total Follow-ups next to Overdue */}
            <div className="flex gap-2 flex-wrap">
              {[
                { id: 'today', label: `Today's Follow-ups (${todayFollowups.length})` },
                { id: 'upcoming', label: `Upcoming (${upcomingFollowups.length})` },
                { id: 'overdue', label: `Overdue (${overdueFollowups.length})` },
                { id: 'all', label: `Total Follow-ups (${followups.length})` }
              ].map(sub => (
                <button
                  key={sub.id}
                  onClick={() => setFollowupsSubTab(sub.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold cursor-pointer transition ${
                    followupsSubTab === sub.id 
                      ? 'bg-indigo-600 text-white shadow-xs' 
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  {sub.label}
                </button>
              ))}
            </div>

            <button
              onClick={() => handleOpenAddFollowUp()}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-md shadow-indigo-600/20 w-fit transition"
            >
              <Plus size={14} /> Add Follow-up
            </button>
          </div>

          {/* Render Active Follow-ups Sub-tab list */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeFollowupsList.length === 0 ? (
              <div className="col-span-3 py-12 text-center text-xs text-slate-400 font-semibold bg-white/50 dark:bg-slate-900/50 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
                No follow-ups found in this section.
              </div>
            ) : (
              activeFollowupsList.map(f => (
                <div
                  key={f.id}
                  className={`p-4 rounded-2xl bg-white/80 dark:bg-slate-900/80 border backdrop-blur-md shadow-sm hover:shadow-lg transition-all flex items-start justify-between gap-3 ${
                    f.priority === 'High' ? 'border-l-4 border-l-rose-500 border-slate-200/80 dark:border-slate-800/80' :
                    f.priority === 'Medium' ? 'border-l-4 border-l-amber-500 border-slate-200/80 dark:border-slate-800/80' :
                    'border-l-4 border-l-slate-400 border-slate-200/80 dark:border-slate-800/80'
                  }`}
                >
                  <div className="flex items-start gap-2.5 flex-1">
                    <button
                      onClick={() => toggleFollowUpStatus(f.id)}
                      className={`mt-0.5 p-1 rounded-lg border transition cursor-pointer ${
                        f.status === 'Completed'
                          ? 'bg-emerald-500 border-emerald-600 text-white shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-transparent hover:text-slate-400'
                      }`}
                    >
                      <Check size={13} />
                    </button>

                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-1.5">
                        <h3 className={`font-black text-xs ${f.status === 'Completed' ? 'line-through text-slate-400' : 'text-slate-900 dark:text-white'}`}>
                          {f.title}
                        </h3>
                        <span className={`px-2 py-0.5 text-[8px] font-black rounded-full uppercase tracking-wider shrink-0 ${
                          f.priority === 'High' ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200' :
                          f.priority === 'Medium' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200' : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}>
                          {f.priority}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug line-clamp-2">{f.notes}</p>

                      <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400 pt-0.5">
                        <span>Due: <strong>{f.dueDate}</strong></span>
                        {f.dueDate < todayStr && f.status !== 'Completed' && (
                          <span className="text-rose-500 font-extrabold flex items-center gap-0.5">
                            <AlertCircle size={10} /> OVERDUE
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 ml-1">
                    <button
                      onClick={() => handleEditFollowUp(f)}
                      className="p-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition cursor-pointer"
                      title="Edit Follow-up"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={() => handleDeleteFollowUp(f.id)}
                      className="p-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                      title="Delete Follow-up"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 5. CALENDAR TAB - Sleek Enterprise UI & Interactive Date Detail Modal */}
      {activeTab === 'calendar' && (
        <div className="p-6 rounded-3xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800/80 backdrop-blur-md shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50">
                <CalendarDays size={22} />
              </div>
              <div>
                <h2 className="text-base font-black text-slate-900 dark:text-slate-100">
                  {monthNames[currMonth]} {currYear}
                </h2>
                <p className="text-[11px] font-semibold text-slate-400">Click any date to view detailed meetings & follow-ups</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCalendarDate(new Date(currYear, currMonth - 1, 1))}
                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-slate-700 transition cursor-pointer"
                title="Previous Month"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                onClick={() => setCalendarDate(new Date())}
                className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-sm cursor-pointer transition"
              >
                Today
              </button>
              <button
                onClick={() => setCalendarDate(new Date(currYear, currMonth + 1, 1))}
                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-slate-700 transition cursor-pointer"
                title="Next Month"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>

          {/* Weekday Header Bar */}
          <div className="grid grid-cols-7 gap-2 text-center">
            {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(d => (
              <div key={d} className="font-black text-slate-400 dark:text-slate-500 py-1.5 uppercase text-[10px] tracking-wider bg-slate-50/60 dark:bg-slate-800/40 rounded-xl">
                {d.slice(0, 3)}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-2">
            {/* Empty slots before first day */}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty_${i}`} className="h-28 bg-slate-50/20 dark:bg-slate-800/10 rounded-2xl border border-dashed border-slate-100 dark:border-slate-800/30 opacity-30"></div>
            ))}

            {/* Days in Month */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const dateStr = `${currYear}-${String(currMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
              const dayMeetings = meetings.filter(m => m.date === dateStr);
              const dayFollowups = followups.filter(f => f.dueDate === dateStr);
              const totalEventsCount = dayMeetings.length + dayFollowups.length;
              const isToday = dateStr === todayStr;

              return (
                <div
                  key={`day_${dayNum}`}
                  onClick={() => handleCalendarDayClick(dateStr)}
                  className={`h-28 p-2 rounded-2xl border text-left flex flex-col justify-between overflow-hidden cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg hover:border-indigo-500/50 hover:ring-2 hover:ring-indigo-500/20 ${
                    isToday 
                      ? 'bg-indigo-50/90 dark:bg-indigo-950/50 border-indigo-500/60 ring-2 ring-indigo-500/30' 
                      : totalEventsCount > 0
                      ? 'bg-white dark:bg-slate-900/80 border-slate-200/90 dark:border-slate-800'
                      : 'bg-slate-50/40 dark:bg-slate-900/40 border-slate-200/50 dark:border-slate-800/50 hover:bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-[11px] font-black w-6 h-6 flex items-center justify-center rounded-full ${
                      isToday ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-700 dark:text-slate-300'
                    }`}>
                      {dayNum}
                    </span>
                    {totalEventsCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-mono text-[9px] font-bold">
                        {totalEventsCount} {totalEventsCount === 1 ? 'event' : 'events'}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1 overflow-hidden my-1">
                    {dayMeetings.slice(0, 2).map(m => (
                      <div
                        key={m.id}
                        className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-lg border truncate flex items-center gap-1 ${
                          m.status === 'Postponed' ? 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/80 dark:text-amber-300' :
                          m.status === 'Completed' ? 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-300' :
                          'bg-indigo-100 text-indigo-900 border-indigo-200 dark:bg-indigo-950/80 dark:text-indigo-300'
                        }`}
                        title={`${m.title} (${m.status})`}
                      >
                        <Video size={10} className="shrink-0" />
                        <span className="truncate">{m.title}</span>
                      </div>
                    ))}

                    {dayFollowups.slice(0, 2 - Math.min(dayMeetings.length, 2)).map(f => (
                      <div
                        key={f.id}
                        className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-lg bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800 truncate flex items-center gap-1"
                        title={`Follow-up: ${f.title}`}
                      >
                        <CheckSquare size={10} className="shrink-0 text-amber-600" />
                        <span className="truncate">{f.title}</span>
                      </div>
                    ))}

                    {totalEventsCount > 2 && (
                      <div className="text-[8px] font-bold text-slate-400 pl-1">
                        +{totalEventsCount - 2} more...
                      </div>
                    )}
                  </div>

                  <div className="text-[9px] font-semibold text-slate-400 flex items-center justify-between opacity-80 group-hover:opacity-100">
                    <span>Click for details</span>
                    <Eye size={11} className="text-indigo-500" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 6. REPORTS TAB */}
      {activeTab === 'reports' && (
        <div className="space-y-4">
          <div className="flex gap-2 bg-white/80 dark:bg-slate-900/80 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
            {[
              { id: 'meetings', label: 'Meeting Report', icon: Video },
              { id: 'followups', label: 'Follow-up Report', icon: CheckSquare }
            ].map(sub => {
              const Icon = sub.icon;
              return (
                <button
                  key={sub.id}
                  onClick={() => setReportsSubTab(sub.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 cursor-pointer transition ${
                    reportsSubTab === sub.id 
                      ? 'bg-indigo-600 text-white shadow-xs' 
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  <Icon size={14} />
                  <span>{sub.label}</span>
                </button>
              );
            })}
          </div>

          {/* MEETING REPORT */}
          {reportsSubTab === 'meetings' && (
            <div className="p-6 rounded-3xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800/80 backdrop-blur-md shadow-sm space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/40 border border-indigo-200/50 dark:border-indigo-800/50">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Total Scheduled Meetings</span>
                  <div className="text-xl font-black text-slate-900 dark:text-white mt-1">{meetings.length} Meetings</div>
                </div>
                <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/40 border border-emerald-200/50 dark:border-emerald-800/50">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Completed Meetings</span>
                  <div className="text-xl font-black text-slate-900 dark:text-white mt-1">{historyMeetings.length} Completed</div>
                </div>
                <div className="p-4 rounded-2xl bg-purple-50/50 dark:bg-purple-950/40 border border-purple-200/50 dark:border-purple-800/50">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-600 dark:text-purple-400">Upcoming Syncs</span>
                  <div className="text-xl font-black text-slate-900 dark:text-white mt-1">{upcomingMeetings.length + todayMeetings.length} Upcoming</div>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-black uppercase text-slate-700 dark:text-slate-300">Meeting Summary Breakdown</h3>
                <div className="space-y-2">
                  {meetings.map(m => (
                    <div key={m.id} className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{m.title}</span>
                        <span className="text-slate-400 ml-2">({m.date} at {m.time})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          value={m.status}
                          onChange={e => handleSelectMeetingStatus(m, e.target.value)}
                          className={`px-2.5 py-1 text-[9px] font-bold rounded-full uppercase border outline-none cursor-pointer ${
                            m.status === 'Completed' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                            m.status === 'Scheduled' ? 'bg-indigo-100 text-indigo-800 border-indigo-200' :
                            m.status === 'Postponed' ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-rose-100 text-rose-800 border-rose-200'
                          }`}
                        >
                          <option value="Scheduled">Scheduled</option>
                          <option value="Completed">Completed</option>
                          <option value="Postponed">Postponed</option>
                          <option value="Cancelled">Cancelled</option>
                        </select>
                        <button onClick={() => handleEditMeeting(m)} className="p-1 rounded text-slate-400 hover:text-indigo-600 transition cursor-pointer" title="Edit Meeting"><Pencil size={13} /></button>
                        <button onClick={() => handleDeleteMeeting(m.id)} className="p-1 rounded text-slate-400 hover:text-rose-600 transition cursor-pointer" title="Delete Meeting"><Trash2 size={13} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* FOLLOW-UP REPORT */}
          {reportsSubTab === 'followups' && (
            <div className="p-6 rounded-3xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800/80 backdrop-blur-md shadow-sm space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/40 border border-indigo-200/50 dark:border-indigo-800/50">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Total Follow-ups</span>
                  <div className="text-xl font-black text-slate-900 dark:text-white mt-1">{followups.length} Tasks</div>
                </div>
                <div className="p-4 rounded-2xl bg-rose-50/50 dark:bg-rose-950/40 border border-rose-200/50 dark:border-rose-800/50">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-600 dark:text-rose-400">Overdue Tasks</span>
                  <div className="text-xl font-black text-slate-900 dark:text-white mt-1">{overdueFollowups.length} Overdue</div>
                </div>
                <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/40 border border-emerald-200/50 dark:border-emerald-800/50">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Completion Rate</span>
                  <div className="text-xl font-black text-slate-900 dark:text-white mt-1">
                    {followups.length > 0 ? Math.round((followups.filter(f => f.status === 'Completed').length / followups.length) * 100) : 100}%
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-black uppercase text-slate-700 dark:text-slate-300">Follow-up Task Audit</h3>
                <div className="space-y-2">
                  {followups.map(f => (
                    <div key={f.id} className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{f.title}</span>
                        <span className="text-slate-400 ml-2">Due: {f.dueDate}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-0.5 text-[9px] font-bold rounded-full uppercase ${f.status === 'Completed' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-amber-100 text-amber-700 border border-amber-200'}`}>
                          {f.status}
                        </span>
                        <button onClick={() => handleEditFollowUp(f)} className="p-1 rounded text-slate-400 hover:text-indigo-600 transition cursor-pointer" title="Edit Follow-up"><Pencil size={13} /></button>
                        <button onClick={() => handleDeleteFollowUp(f.id)} className="p-1 rounded text-slate-400 hover:text-rose-600 transition cursor-pointer" title="Delete Follow-up"><Trash2 size={13} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 7. TIMELINE TAB - Activity Log showing ONLY Completed Meetings and System Logs */}
      {activeTab === 'timeline' && (
        <div className="p-6 rounded-3xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800/80 backdrop-blur-md shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <Clock size={18} className="text-indigo-600" /> Client Activity Timeline Log
              </h2>
              <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
                Unified audit trail including completed meetings and system records.
              </p>
            </div>
            <span className="px-3 py-1 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 text-xs font-bold rounded-full font-mono">
              {combinedTimeline.length} events logged
            </span>
          </div>

          <div className="space-y-3">
            {combinedTimeline.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400 font-semibold bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                No activity recorded yet for this client.
              </div>
            ) : (
              combinedTimeline.map((item) => {
                const ItemIcon = item.icon;
                return (
                  <div key={item.id} className="flex items-start gap-4 bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800/60 rounded-2xl p-4 hover:shadow-md transition-all">
                    <div className={`p-2.5 rounded-xl ${item.color} text-white shadow-xs shrink-0`}>
                      <ItemIcon size={16} />
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-extrabold text-xs text-slate-900 dark:text-slate-100 truncate">
                          {item.title}
                        </h3>
                        <span className={`px-2 py-0.5 text-[9px] font-black rounded-full uppercase tracking-wider shrink-0 ${
                          item.status === 'Completed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200' :
                          'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200'
                        }`}>
                          {item.status}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug">{item.subtitle}</p>

                      <div className="text-[10px] font-mono text-slate-400 pt-0.5">
                        <span>{item.date}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Edit Client Modal */}
      <EditClientModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        client={client}
        onSuccess={() => {
          fetchClientDetails();
          showToast('Client profile updated successfully!', 'success');
        }}
      />

      {/* Calendar Date Event Details Modal rendered via Portal */}
      {isDateDetailsOpen && createPortal(
        <div className="fixed inset-0 z-[99999] bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 space-y-5 border border-slate-200 dark:border-slate-800 shadow-2xl animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <CalendarDays className="text-indigo-600" size={20} />
                <div>
                  <h3 className="font-black text-sm text-slate-900 dark:text-white">
                    Schedule Details for {selectedCalendarDate}
                  </h3>
                  <span className="text-[11px] text-slate-400 font-semibold">
                    {selectedDateMeetings.length} meetings • {selectedDateFollowups.length} follow-ups
                  </span>
                </div>
              </div>
              <button onClick={() => setIsDateDetailsOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X size={20} />
              </button>
            </div>

            {/* Content for Selected Date */}
            {selectedDateMeetings.length === 0 && selectedDateFollowups.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400 space-y-3">
                <CalendarIcon className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto" />
                <p className="font-semibold">No meetings or follow-ups scheduled for this date.</p>
                <div className="flex items-center justify-center gap-2 pt-2">
                  <button
                    onClick={() => { setIsDateDetailsOpen(false); handleOpenAddMeeting(selectedCalendarDate); }}
                    className="px-3.5 py-2 bg-indigo-600 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm hover:bg-indigo-500"
                  >
                    <Video size={13} /> Schedule Meeting
                  </button>
                  <button
                    onClick={() => { setIsDateDetailsOpen(false); handleOpenAddFollowUp(selectedCalendarDate); }}
                    className="px-3.5 py-2 bg-amber-500 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm hover:bg-amber-400"
                  >
                    <CheckSquare size={13} /> Add Follow-up
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-5 text-xs">
                {/* Meetings List */}
                {selectedDateMeetings.length > 0 && (
                  <div className="space-y-2.5">
                    <h4 className="font-black text-xs uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center justify-between">
                      <span>Meetings ({selectedDateMeetings.length})</span>
                      <button
                        onClick={() => { setIsDateDetailsOpen(false); handleOpenAddMeeting(selectedCalendarDate); }}
                        className="text-[11px] font-bold text-indigo-600 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Plus size={12} /> Add Meeting
                      </button>
                    </h4>

                    <div className="space-y-2">
                      {selectedDateMeetings.map(m => (
                        <div key={m.id} className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <h5 className="font-black text-xs text-slate-900 dark:text-white">{m.title}</h5>
                            <div className="flex items-center gap-1.5">
                              <select
                                value={m.status}
                                onChange={e => handleSelectMeetingStatus(m, e.target.value)}
                                className={`px-2 py-0.5 text-[9px] font-bold rounded-full uppercase border outline-none cursor-pointer ${
                                  m.status === 'Completed' ? 'bg-emerald-100 text-emerald-800' :
                                  m.status === 'Scheduled' ? 'bg-indigo-100 text-indigo-800' :
                                  m.status === 'Postponed' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                <option value="Scheduled">Scheduled</option>
                                <option value="Completed">Completed</option>
                                <option value="Postponed">Postponed</option>
                                <option value="Cancelled">Cancelled</option>
                              </select>
                              <button onClick={() => { setIsDateDetailsOpen(false); handleEditMeeting(m); }} className="p-1 text-slate-400 hover:text-indigo-600"><Pencil size={12} /></button>
                              <button onClick={() => handleDeleteMeeting(m.id)} className="p-1 text-slate-400 hover:text-rose-600"><Trash2 size={12} /></button>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-500">
                            <span>🕒 {m.time}</span>
                            <span>🎥 {m.type}</span>
                          </div>
                          {m.notes && <p className="text-[11px] text-slate-600 dark:text-slate-300 italic">{m.notes}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Follow-ups List */}
                {selectedDateFollowups.length > 0 && (
                  <div className="space-y-2.5">
                    <h4 className="font-black text-xs uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center justify-between">
                      <span>Follow-up Tasks ({selectedDateFollowups.length})</span>
                      <button
                        onClick={() => { setIsDateDetailsOpen(false); handleOpenAddFollowUp(selectedCalendarDate); }}
                        className="text-[11px] font-bold text-amber-600 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Plus size={12} /> Add Task
                      </button>
                    </h4>

                    <div className="space-y-2">
                      {selectedDateFollowups.map(f => (
                        <div key={f.id} className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2.5 flex-1">
                            <button
                              onClick={() => toggleFollowUpStatus(f.id)}
                              className={`mt-0.5 p-1 rounded-lg border cursor-pointer ${f.status === 'Completed' ? 'bg-emerald-500 text-white' : 'bg-white text-transparent'}`}
                            >
                              <Check size={12} />
                            </button>
                            <div>
                              <span className={`font-extrabold text-xs block ${f.status === 'Completed' ? 'line-through text-slate-400' : 'text-slate-900 dark:text-white'}`}>
                                {f.title}
                              </span>
                              <p className="text-[11px] text-slate-500 mt-0.5">{f.notes}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button onClick={() => { setIsDateDetailsOpen(false); handleEditFollowUp(f); }} className="p-1 text-slate-400 hover:text-indigo-600"><Pencil size={12} /></button>
                            <button onClick={() => handleDeleteFollowUp(f.id)} className="p-1 text-slate-400 hover:text-rose-600"><Trash2 size={12} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setIsDateDetailsOpen(false)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Schedule / Edit Meeting Modal rendered via Portal */}
      {isAddMeetingOpen && createPortal(
        <div className="fixed inset-0 z-[99999] bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 space-y-4 border border-slate-200 dark:border-slate-800 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Video className="text-indigo-600" size={18} /> {editingMeeting ? 'Edit Client Meeting' : 'Schedule Client Meeting'}
              </h3>
              <button onClick={() => { setIsAddMeetingOpen(false); setEditingMeeting(null); }} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveMeeting} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Meeting Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Project Review & Timeline Discussion"
                  value={meetingForm.title}
                  onChange={e => setMeetingForm(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    value={meetingForm.date}
                    onChange={e => setMeetingForm(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Time *</label>
                  <input
                    type="text"
                    required
                    placeholder="10:30 AM"
                    value={meetingForm.time}
                    onChange={e => setMeetingForm(prev => ({ ...prev, time: e.target.value }))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Meeting Type</label>
                  <select
                    value={meetingForm.type}
                    onChange={e => setMeetingForm(prev => ({ ...prev, type: e.target.value }))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option>Online (Google Meet)</option>
                    <option>Online (Zoom)</option>
                    <option>In-Person (Head Office)</option>
                    <option>In-Person (Client Site)</option>
                    <option>Phone Conference</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Status</label>
                  <select
                    value={meetingForm.status}
                    onChange={e => {
                      const val = e.target.value;
                      setMeetingForm(prev => ({ ...prev, status: val }));
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Scheduled">Scheduled</option>
                    <option value="Completed">Completed</option>
                    <option value="Postponed">Postponed</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Attendees</label>
                <input
                  type="text"
                  placeholder="e.g. Client Tech Lead, Account Manager"
                  value={meetingForm.attendees}
                  onChange={e => setMeetingForm(prev => ({ ...prev, attendees: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Agenda & Notes</label>
                <textarea
                  rows={2}
                  placeholder="Key topics to discuss..."
                  value={meetingForm.notes}
                  onChange={e => setMeetingForm(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setIsAddMeetingOpen(false); setEditingMeeting(null); }}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl cursor-pointer shadow-sm"
                >
                  {editingMeeting ? 'Update Meeting' : 'Save Meeting'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Postpone & Reschedule Meeting Modal rendered via Portal */}
      {isPostponeModalOpen && createPortal(
        <div className="fixed inset-0 z-[99999] bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 space-y-4 border border-amber-200 dark:border-amber-800 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-extrabold text-sm text-amber-600 dark:text-amber-400 flex items-center gap-2">
                <CalendarClock size={18} /> Postpone & Reschedule Meeting
              </h3>
              <button onClick={() => { setIsPostponeModalOpen(false); setPostponingMeeting(null); }} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleConfirmPostpone} className="space-y-3 text-xs">
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-2xl border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200">
                <span className="font-bold block text-xs">{postponingMeeting?.title}</span>
                <span className="text-[11px] opacity-80">Currently scheduled: {postponingMeeting?.date} at {postponingMeeting?.time}</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">New Date *</label>
                  <input
                    type="date"
                    required
                    value={postponeForm.newDate}
                    onChange={e => setPostponeForm(prev => ({ ...prev, newDate: e.target.value }))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">New Time *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 11:30 AM"
                    value={postponeForm.newTime}
                    onChange={e => setPostponeForm(prev => ({ ...prev, newTime: e.target.value }))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Reason for Postponing (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Client requested delay due to travel schedule..."
                  value={postponeForm.reason}
                  onChange={e => setPostponeForm(prev => ({ ...prev, reason: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setIsPostponeModalOpen(false); setPostponingMeeting(null); }}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl cursor-pointer shadow-sm flex items-center gap-1.5"
                >
                  <CalendarClock size={14} /> Confirm Postpone & Reschedule
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Add / Edit Follow-up Modal rendered via Portal */}
      {isAddFollowUpOpen && createPortal(
        <div className="fixed inset-0 z-[99999] bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 space-y-4 border border-slate-200 dark:border-slate-800 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <CheckSquare className="text-indigo-600" size={18} /> {editingFollowup ? 'Edit Follow-up Task' : 'Add Follow-up Task'}
              </h3>
              <button onClick={() => { setIsAddFollowUpOpen(false); setEditingFollowup(null); }} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveFollowUp} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Follow-up Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Send updated SLA agreement"
                  value={followUpForm.title}
                  onChange={e => setFollowUpForm(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Due Date *</label>
                  <input
                    type="date"
                    required
                    value={followUpForm.dueDate}
                    onChange={e => setFollowUpForm(prev => ({ ...prev, dueDate: e.target.value }))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Due Time *</label>
                  <input
                    type="text"
                    required
                    placeholder="04:00 PM"
                    value={followUpForm.dueTime}
                    onChange={e => setFollowUpForm(prev => ({ ...prev, dueTime: e.target.value }))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Priority</label>
                <select
                  value={followUpForm.priority}
                  onChange={e => setFollowUpForm(prev => ({ ...prev, priority: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option>High</option>
                  <option>Medium</option>
                  <option>Normal</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Notes & Action Items</label>
                <textarea
                  rows={2}
                  placeholder="Task details..."
                  value={followUpForm.notes}
                  onChange={e => setFollowUpForm(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setIsAddFollowUpOpen(false); setEditingFollowup(null); }}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl cursor-pointer shadow-sm"
                >
                  {editingFollowup ? 'Update Task' : 'Add Task'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm(prev => ({ ...prev, isOpen: false }))}
        onConfirm={deleteConfirm.onConfirm}
        title={deleteConfirm.title}
        message={deleteConfirm.message}
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />
    </div>
  );
};

export default ClientDetailsPage;
