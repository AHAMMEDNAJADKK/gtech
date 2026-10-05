import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  FolderKanban, ArrowLeft, Calendar, Users, Eye, CheckCircle2, Clock, 
  FileText, MessageSquare, ShieldCheck, GitBranch, Globe, Plus, ChevronRight,
  BarChart3, Edit, UserCheck, Briefcase, Building, ListTodo, CheckSquare, User
} from 'lucide-react';
import { getProjectById, updateProjectStatus } from '../services/projectService';
import EditProjectModal from '../components/EditProjectModal';

const STAGES = [
  'Planning', 'Requirement Gathering', 'UI Design', 'Development', 
  'Testing', 'Client Review', 'Changes', 'Deployment', 'Completed',
  'On Hold', 'Cancelled'
];

const STAGE_PROGRESS_MAP = {
  'Planning': 10,
  'Requirement Gathering': 20,
  'UI Design': 35,
  'Development': 55,
  'Testing': 70,
  'Client Review': 80,
  'Changes': 85,
  'Deployment': 95,
  'Completed': 100,
  'Cancelled': 0
};

const TASK_STATUS_CONFIG = {
  pending: { label: 'Pending', bg: 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800' },
  current: { label: 'In Progress', bg: 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800' },
  preview: { label: 'Preview', bg: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800' },
  done: { label: 'Completed', bg: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' },
};

const ProjectDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  useEffect(() => {
    fetchDetails();
  }, [id]);

  const fetchDetails = async () => {
    setLoading(true);
    try {
      const res = await getProjectById(id);
      if (res && res.success) {
        setData(res.data);
      }
    } catch (err) {
      console.error("Failed to fetch project details:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleStageTransition = async (newStage) => {
    setUpdatingStatus(true);
    try {
      const stageProgress = STAGE_PROGRESS_MAP[newStage];
      const payload = { status: newStage };
      if (stageProgress !== undefined && stageProgress !== null) {
        payload.progress = stageProgress;
      }
      const res = await updateProjectStatus(id, payload);
      if (res && res.success) {
        fetchDetails();
      }
    } catch (err) {
      console.error("Failed to update status:", err);
    } finally {
      setUpdatingStatus(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-xs text-slate-400 font-semibold flex flex-col items-center gap-3">
        <Clock className="w-8 h-8 text-indigo-500 animate-spin" />
        <span>Loading project workspace details...</span>
      </div>
    );
  }

  if (!data || !data.project) {
    return (
      <div className="py-20 text-center text-xs text-slate-400 font-semibold flex flex-col items-center gap-3">
        <FolderKanban className="w-10 h-10 text-slate-300 dark:text-slate-700" />
        <span>Project record not found.</span>
        <button onClick={() => navigate('/projects')} className="text-indigo-600 font-bold hover:underline">
          Return to Projects
        </button>
      </div>
    );
  }

  const { project, activities = [], comments = [], documents = [], tasks = [] } = data;

  // Task metrics calculation
  const totalTasksCount = tasks.length;
  const completedTasksCount = tasks.filter(t => ['done', 'Completed', 'completed', 'Done', 'DONE'].includes(t.status)).length;
  const pendingTasksCount = tasks.filter(t => t.status === 'pending').length;
  const inProgressTasksCount = tasks.filter(t => t.status === 'current').length;
  const previewTasksCount = tasks.filter(t => t.status === 'preview').length;
  const computedCompletionPct = STAGE_PROGRESS_MAP[project.status] !== undefined 
    ? STAGE_PROGRESS_MAP[project.status] 
    : (project.progress || 0);

  // Group Assigned Employees by Department (Feature 3)
  const groupedEmployees = (project.assignedEmployees || []).reduce((acc, emp) => {
    const dept = emp.department || 'General Operations';
    if (!acc[dept]) acc[dept] = [];
    acc[dept].push(emp);
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto pb-10">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <button
          onClick={() => navigate('/projects')}
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Projects Directory
        </button>

        {/* ALWAYS VISIBLE Header Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsEditModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-600 hover:text-white text-xs font-bold transition-all border border-indigo-200/80 dark:border-indigo-800 cursor-pointer"
          >
            <Edit className="w-4 h-4" />
            <span>Edit Project</span>
          </button>

          <Link
            to="/projects/reports"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 text-xs font-bold transition-all border border-slate-200/80 dark:border-slate-700"
          >
            <BarChart3 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>Analytics & Reports</span>
          </Link>
        </div>
      </div>

      {/* Hero Banner */}
      <div className="p-6 md:p-8 rounded-3xl bg-white/70 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800/80 backdrop-blur-md shadow-xl flex flex-col gap-6">
        <div className="flex flex-col md:flex-row justify-between gap-4 items-start md:items-center">
          <div>
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 font-mono text-[11px] font-bold">
                {project.projectCode}
              </span>
              <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100">{project.projectName}</h1>
            </div>

            <p className="text-xs text-slate-500 font-semibold mt-1">
              Client: <strong className="text-slate-700 dark:text-slate-300">{project.client?.companyName || 'Enterprise Client'}</strong> • PM: <strong className="text-slate-700 dark:text-slate-300">{project.projectManager?.name || 'Unassigned'}</strong> {project.assignedTeamLead?.name ? `• Lead: ${project.assignedTeamLead.name}` : ''}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500">Stage:</span>
            <select
              value={project.status}
              disabled={updatingStatus}
              onChange={(e) => handleStageTransition(e.target.value)}
              className="px-3.5 py-2 text-xs font-bold rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 focus:outline-hidden cursor-pointer"
            >
              {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* Progress Bar & Completion Rate */}
        <div className="flex flex-col gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
            <div className="flex items-center gap-2">
              <ListTodo className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Completion Rate: <strong className="text-indigo-600 dark:text-indigo-400">{computedCompletionPct}%</strong></span>
            </div>
          </div>

          <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
            <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${computedCompletionPct}%` }} title={`Completion Rate (${computedCompletionPct}%)`} />
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800/80 pb-1 overflow-x-auto">
        {[
          { id: 'overview', label: 'Overview & Details', icon: FolderKanban },
          { id: 'team', label: `Grouped Team Members (${(project.assignedEmployees || []).length})`, icon: Users },
          // { id: 'milestones', label: `Milestones (${milestones.length})`, icon: CheckCircle2 },
          { id: 'timeline', label: 'Activity Log', icon: Clock }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-extrabold rounded-xl transition-all ${
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

      {/* Tab Content 1: Overview */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 p-6 rounded-3xl bg-white/70 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800/80 backdrop-blur-md flex flex-col gap-6">
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800 pb-2">
              Project Description & Tech Stack
            </h2>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {project.description || 'No detailed scope description provided.'}
            </p>

            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-bold text-slate-400">Technology Stack</span>
              <div className="flex flex-wrap gap-1.5">
                {(project.technologyStack || []).map((tech, i) => (
                  <span key={i} className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 text-xs font-bold">
                    {tech}
                  </span>
                ))}
              </div>
            </div>

            {/* PROJECT ASSIGNED TASKS WIDGET */}
            <div className="flex flex-col gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ListTodo className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    Project Tasks ({tasks.length})
                  </h3>
                </div>
                {tasks.length > 0 ? (
                  <button
                    onClick={() => setActiveTab('tasks')}
                    className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                  >
                    <span>View All Tasks ({tasks.length})</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <Link
                    to="/todo"
                    className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Assign Task in Todo</span>
                  </Link>
                )}
              </div>

              {tasks.length === 0 ? (
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/40 border border-dashed border-slate-200 dark:border-slate-800 text-center flex flex-col items-center gap-1.5">
                  <span className="text-xs font-semibold text-slate-500">No tasks currently assigned to this project.</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {tasks.slice(0, 4).map(t => {
                    const assignedUser = typeof t.assigned_to === 'object' ? t.assigned_to : t.assignedTo;
                    const statusConf = TASK_STATUS_CONFIG[t.status] || { label: t.status, bg: 'bg-slate-100 text-slate-700' };
                    return (
                      <div key={t._id || t.id} className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-800 flex flex-col gap-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${statusConf.bg}`}>
                            {statusConf.label}
                          </span>
                          {t.dueDate && (
                            <span className="text-[9px] font-semibold text-slate-400 flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5" />
                              {new Date(t.dueDate).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 line-clamp-1">{t.title}</h4>
                        <div className="flex items-center justify-between pt-1 text-[10px] text-slate-500">
                          <span className="font-semibold">{assignedUser?.name || 'Unassigned'}</span>
                          <Link to="/todo" className="text-indigo-600 font-bold hover:underline">Open Todo</Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="p-6 rounded-3xl bg-white/70 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800/80 backdrop-blur-md flex flex-col gap-4">
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800 pb-2">
              Schedule & Budget
            </h2>

            <div className="flex flex-col gap-3 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400 font-bold">Estimated Budget:</span>
                <span className="font-black text-slate-800 dark:text-slate-200">₹{(project.estimatedBudget || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-bold">Start Date:</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {project.startDate ? new Date(project.startDate).toLocaleDateString() : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-bold">Deadline:</span>
                <span className="font-semibold text-rose-600 dark:text-rose-400">
                  {project.deadline ? new Date(project.deadline).toLocaleDateString() : 'N/A'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}



      {/* Tab Content 2: FEATURE 3 - ASSIGNED TEAM MEMBERS GROUPED BY DEPARTMENT */}
      {activeTab === 'team' && (
        <div className="flex flex-col gap-6">
          {/* Key Leadership Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {project.projectManager && (
              <div className="p-5 rounded-3xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-800/60 flex items-center gap-4">
                <img
                  src={project.projectManager.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${project.projectManager.name}`}
                  alt=""
                  className="w-12 h-12 rounded-2xl object-cover ring-2 ring-indigo-500/30"
                />
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider">Project Manager</span>
                  <span className="text-sm font-black text-slate-900 dark:text-slate-100">{project.projectManager.name}</span>
                  <span className="text-xs text-slate-500 font-semibold">{project.projectManager.email}</span>
                </div>
              </div>
            )}

            {project.assignedTeamLead && (
              <div className="p-5 rounded-3xl bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200/60 dark:border-purple-800/60 flex items-center gap-4">
                <img
                  src={project.assignedTeamLead.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${project.assignedTeamLead.name}`}
                  alt=""
                  className="w-12 h-12 rounded-2xl object-cover ring-2 ring-purple-500/30"
                />
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase text-purple-600 dark:text-purple-400 tracking-wider">Team Lead</span>
                  <span className="text-sm font-black text-slate-900 dark:text-slate-100">{project.assignedTeamLead.name}</span>
                  <span className="text-xs text-slate-500 font-semibold">{project.assignedTeamLead.email}</span>
                </div>
              </div>
            )}
          </div>

          {/* Grouped Employees by Department */}
          {Object.keys(groupedEmployees).length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 font-semibold">No assigned employees recorded.</div>
          ) : (
            Object.entries(groupedEmployees).map(([dept, members]) => (
              <div key={dept} className="flex flex-col gap-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                  <Building className="w-4 h-4 text-indigo-600" />
                  <span>{dept} Department ({members.length} Members)</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {members.map((emp) => (
                    <div key={emp._id || emp.id} className="p-4 rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800/80 backdrop-blur-md flex items-center gap-3">
                      <img
                        src={emp.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${emp.name}`}
                        alt=""
                        className="w-10 h-10 rounded-2xl object-cover ring-2 ring-indigo-500/20"
                      />
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-slate-800 dark:text-slate-100">{emp.name}</span>
                        <span className="text-[10px] text-slate-400 font-semibold">{emp.designation || emp.role || 'Staff'}</span>
                        <span className="text-[9px] text-indigo-500 font-mono">ID: #{emp.employeeId || 'EMP'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab Content 3: Milestones */}
      {activeTab === 'milestones' && (
        <div className="flex flex-col gap-3">
          {milestones.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 font-semibold">No project milestones created yet.</div>
          ) : (
            milestones.map((m) => (
              <div key={m._id} className="p-4 rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className={`w-5 h-5 ${m.status === 'Completed' ? 'text-emerald-500' : 'text-slate-300'}`} />
                  <div>
                    <h4 className="text-xs font-black text-slate-800 dark:text-slate-100">{m.title}</h4>
                    <span className="text-[10px] text-slate-400">Due: {new Date(m.dueDate).toLocaleDateString()}</span>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  {m.status}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab Content 4: Activity Timeline */}
      {activeTab === 'timeline' && (
        <div className="flex flex-col gap-3">
          {activities.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 font-semibold">No activity logs recorded yet.</div>
          ) : (
            activities.map((act) => (
              <div key={act._id} className="p-4 rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800/80 flex items-start gap-3">
                <Clock className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{act.title}</span>
                  <span className="text-xs text-slate-500">{act.description}</span>
                  <span className="text-[10px] text-slate-400 mt-1">{new Date(act.createdAt).toLocaleString()}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
      {/* Edit Project Modal */}
      <EditProjectModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        project={project}
        onSuccess={fetchDetails}
      />
    </div>
  );
};

export default ProjectDetailsPage;
