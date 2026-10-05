import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  FolderKanban, Plus, Search, Filter, Calendar, Users, LayoutGrid, List,
  Clock, AlertCircle, CheckCircle2, RefreshCw, ChevronRight, Eye, BarChart3,
  Edit, Trash2, ShieldCheck, UserCheck, ExternalLink, FileSpreadsheet, Tag
} from 'lucide-react';
import { getProjects, deleteProject } from '../services/projectService';
import ConfirmModal from '../components/ConfirmModal';
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

const ProjectsPage = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({});
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'kanban'
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');

  // Delete & Edit modal states
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [projectToEdit, setProjectToEdit] = useState(null);

  useEffect(() => {
    fetchProjects();
  }, [search, statusFilter, priorityFilter]);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const res = await getProjects({
        search,
        status: statusFilter,
        priority: priorityFilter,
        limit: 50
      });
      if (res && res.success) {
        setProjects(res.data.projects || []);
        setStats(res.data.stats || {});
      }
    } catch (err) {
      console.error("Failed to fetch projects:", err);
    } finally {
      setLoading(false);
    }
  };

  const promptDeleteProject = (id) => {
    setProjectToDelete(id);
    setDeleteModalOpen(true);
  };

  const confirmDeleteProject = async () => {
    if (!projectToDelete) return;
    try {
      const res = await deleteProject(projectToDelete);
      if (res && res.success) {
        setProjects(prev => prev.filter(p => (p._id || p.id) !== projectToDelete));
        fetchProjects();
      }
    } catch (err) {
      console.error("Failed to delete project:", err);
    } finally {
      setDeleteModalOpen(false);
      setProjectToDelete(null);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full pb-10">
      {/* Top Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/10 text-indigo-600 flex items-center justify-center shadow-xs">
              <FolderKanban className="w-5 h-5" />
            </div>
            Project Workspace & Delivery Pipeline
          </h1>
          <p className="text-xs text-slate-500 font-semibold mt-1">
            Track 10-stage development workflows, assigned employee allocations, and delivery deadlines.
          </p>
        </div>

        {/* ALWAYS VISIBLE Header Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            to="/projects/reports"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 text-xs font-bold transition-all border border-slate-200/80 dark:border-slate-700"
          >
            <BarChart3 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>Analytics & Reports</span>
          </Link>

          <Link
            to="/projects/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white text-xs font-bold shadow-lg shadow-indigo-600/20 transition-all hover:scale-[1.02]"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Project</span>
          </Link>
        </div>
      </div>

      {/* Control Bar: View Mode, Search & Filters */}
      <div className="p-4 rounded-3xl bg-white/70 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800/80 backdrop-blur-md flex flex-col md:flex-row gap-3 items-center justify-between shadow-xs">
        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* View Mode Switcher */}
          <div className="flex bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200/80 dark:border-slate-700/60">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                viewMode === 'list' ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-xs' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <List className="w-4 h-4" />
              <span>List View</span>
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                viewMode === 'kanban' ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-xs' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              <span>Grid View</span>
            </button>
          </div>

          <div className="relative flex-1 md:w-80">
            <div className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search project name, code, client, tech..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-xs rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="flex gap-2 w-full md:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-semibold focus:outline-hidden"
          >
            <option value="">All Stages</option>
            {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-semibold focus:outline-hidden"
          >
            <option value="">All Priorities</option>
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
            <option value="Urgent">Urgent</option>
          </select>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="py-20 text-center text-xs text-slate-400 font-semibold flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
          <span>Loading project workspace...</span>
        </div>
      ) : viewMode === 'list' ? (
        /* FEATURE 7: PROJECT TABLE (All action buttons ALWAYS VISIBLE) */
        <div className="rounded-3xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800/80 backdrop-blur-md overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-200/80 dark:border-slate-800 text-[11px] font-black uppercase tracking-wider text-slate-500">
                  <th className="p-4">Project & Code</th>
                  <th className="p-4">Client</th>
                  <th className="p-4">Manager / Lead</th>
                  <th className="p-4">Stage</th>
                  <th className="p-4">Assigned Team</th>
                  <th className="p-4">Completion Rate</th>
                  <th className="p-4">Deadline</th>
                  <th className="p-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                {projects.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="py-12 text-center text-slate-400 font-semibold">
                      No projects found matching filter selection.
                    </td>
                  </tr>
                ) : (
                  projects.map((project) => {
                    const id = project._id || project.id;
                    const completionPct = STAGE_PROGRESS_MAP[project.status] !== undefined 
                      ? STAGE_PROGRESS_MAP[project.status] 
                      : (project.progress || 0);
                    return (
                      <tr key={id} className="hover:bg-indigo-50/40 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="p-4">
                          <div className="flex flex-col">
                            <Link to={`/projects/${id}`} className="font-black text-slate-800 dark:text-slate-100 hover:text-indigo-600 transition-colors text-sm">
                              {project.projectName}
                            </Link>
                            <span className="text-[10px] font-mono text-slate-400 font-bold">{project.projectCode}</span>
                          </div>
                        </td>

                        <td className="p-4 font-semibold text-slate-700 dark:text-slate-300">
                          {project.client?.companyName || 'N/A'}
                        </td>

                        <td className="p-4">
                          <div className="flex flex-col text-[11px]">
                            <span className="font-bold text-slate-800 dark:text-slate-200">{project.projectManager?.name || 'Unassigned'}</span>
                            <span className="text-slate-400">{project.assignedTeamLead?.name ? `Lead: ${project.assignedTeamLead.name}` : ''}</span>
                          </div>
                        </td>

                        <td className="p-4">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            project.status === 'Completed' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400' :
                            project.status === 'Development' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400' :
                            'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                          }`}>
                            {project.status}
                          </span>
                        </td>

                        <td className="p-4">
                          <div className="flex items-center -space-x-2">
                            {(project.assignedEmployees || []).slice(0, 4).map((emp, i) => (
                              <img
                                key={emp._id || i}
                                src={emp.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${emp.name}`}
                                title={emp.name}
                                alt=""
                                className="w-7 h-7 rounded-full ring-2 ring-white dark:ring-slate-900 object-cover"
                              />
                            ))}
                            {(project.assignedEmployees || []).length > 4 && (
                              <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300 flex items-center justify-center ring-2 ring-white dark:ring-slate-900">
                                +{(project.assignedEmployees || []).length - 4}
                              </div>
                            )}
                          </div>
                        </td>

                        <td className="p-4 w-36">
                          <div className="flex flex-col gap-1">
                            <div className="flex justify-between text-[10px] font-bold text-slate-500">
                              <span>Completion Rate</span>
                              <span>{completionPct}%</span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                              <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${completionPct}%` }} />
                            </div>
                          </div>
                        </td>

                        <td className="p-4 font-semibold text-slate-600 dark:text-slate-300">
                          {project.deadline ? new Date(project.deadline).toLocaleDateString() : 'N/A'}
                        </td>

                        {/* ALWAYS VISIBLE Action Buttons */}
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <Link
                              to={`/projects/${id}`}
                              title="View Details"
                              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                            >
                              <Eye className="w-4 h-4" />
                            </Link>

                            <button
                              type="button"
                              onClick={() => {
                                setProjectToEdit(project);
                                setEditModalOpen(true);
                              }}
                              title="Edit Project"
                              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
                            >
                              <Edit className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => promptDeleteProject(id)}
                              title="Delete Project"
                              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* FEATURE 8: KANBAN / CARD VIEW (All action buttons ALWAYS VISIBLE) */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {projects.map((project) => {
            const id = project._id || project.id;
            const completionPct = STAGE_PROGRESS_MAP[project.status] !== undefined 
              ? STAGE_PROGRESS_MAP[project.status] 
              : (project.progress || 0);
            return (
              <div
                key={id}
                className="p-5 rounded-3xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800/80 backdrop-blur-md flex flex-col justify-between hover:shadow-xl hover:border-indigo-500/40 transition-all duration-200"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <span className="text-[10px] font-mono font-bold text-indigo-600 uppercase tracking-wider">
                        {project.projectCode}
                      </span>
                      <h3 className="text-base font-black text-slate-800 dark:text-slate-100">
                        {project.projectName}
                      </h3>
                      <span className="text-xs text-slate-500 font-bold">
                        {project.client?.companyName || 'Client Profile'}
                      </span>
                    </div>

                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                      project.status === 'Completed' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400' :
                      project.status === 'Development' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400' :
                      'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                    }`}>
                      {project.status}
                    </span>
                  </div>

                  {/* Progress & Deadline */}
                  <div className="flex flex-col gap-1.5 my-3">
                    <div className="flex justify-between text-xs font-bold text-slate-600 dark:text-slate-300">
                      <span>Completion Rate</span>
                      <span>{completionPct}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-full" style={{ width: `${completionPct}%` }} />
                    </div>
                  </div>

                  {/* Assigned Members */}
                  <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800/60">
                    <div className="flex items-center -space-x-2">
                      {(project.assignedEmployees || []).slice(0, 4).map((emp, i) => (
                        <img
                          key={emp._id || i}
                          src={emp.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${emp.name}`}
                          title={emp.name}
                          alt=""
                          className="w-7 h-7 rounded-full ring-2 ring-white dark:ring-slate-900 object-cover"
                        />
                      ))}
                    </div>

                    <span className="text-[11px] font-bold text-slate-500">
                      Due: {project.deadline ? new Date(project.deadline).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>
                </div>

                {/* ALWAYS VISIBLE Quick Actions Bar */}
                <div className="mt-4 pt-3 flex items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-800/60">
                  <div className="flex items-center gap-1.5">
                    <Link
                      to={`/projects/${id}`}
                      className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 hover:text-indigo-600 transition-colors"
                      title="View Details"
                    >
                      <Eye className="w-4 h-4" />
                    </Link>

                    <button
                      type="button"
                      onClick={() => {
                        setProjectToEdit(project);
                        setEditModalOpen(true);
                      }}
                      title="Edit Project"
                      className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 hover:text-indigo-600 transition-colors cursor-pointer"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => promptDeleteProject(id)}
                    title="Delete Project"
                    className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => { setDeleteModalOpen(false); setProjectToDelete(null); }}
        onConfirm={confirmDeleteProject}
        title="Delete Project Workspace"
        message="Are you sure you want to delete this project workspace? All associated milestones and activity history will be permanently deleted."
        confirmText="Delete Project"
        type="danger"
      />
      {/* Edit Project Modal */}
      <EditProjectModal
        isOpen={editModalOpen}
        onClose={() => { setEditModalOpen(false); setProjectToEdit(null); }}
        project={projectToEdit}
        onSuccess={fetchProjects}
      />
    </div>
  );
};

export default ProjectsPage;
