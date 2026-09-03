import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Building, Phone, Mail, MapPin, ChevronRight, MoreVertical, 
  Trash2, Edit, ExternalLink, ShieldCheck, UserCheck, Tag, Star
} from 'lucide-react';

const ClientGridView = ({ clients, onDelete }) => {
  const [activeMenuId, setActiveMenuId] = useState(null);

  const toggleMenu = (e, id) => {
    e.stopPropagation();
    setActiveMenuId(activeMenuId === id ? null : id);
  };

  const priorityColor = (priority) => {
    switch (priority) {
      case 'VIP': return 'bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border-purple-200 dark:border-purple-800';
      case 'High': return 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border-rose-200 dark:border-rose-800';
      case 'Medium': return 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200 dark:border-amber-800';
      default: return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700';
    }
  };

  const statusColor = (status) => {
    switch (status) {
      case 'Active': return 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800';
      case 'On Hold': return 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200 dark:border-amber-800';
      case 'Lead': return 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 border-blue-200 dark:border-blue-800';
      default: return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700';
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
      {clients.map((client) => {
        const id = client._id || client.id || client.clientId;
        const managerName = client.accountManager?.name || client.primaryContact?.name || 'Unassigned';
        const teamLeadName = client.assignedTeamLead?.name;

        return (
          <div
            key={id}
            className="p-5 rounded-3xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800/80 backdrop-blur-md flex flex-col justify-between hover:shadow-xl hover:border-indigo-500/40 transition-all duration-200 group relative"
          >
            {/* Header Section */}
            <div>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  {client.companyLogo ? (
                    <img
                      src={client.companyLogo}
                      alt={client.companyName}
                      className="w-12 h-12 rounded-2xl object-cover ring-2 ring-slate-100 dark:ring-slate-800 shadow-xs"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-black text-lg flex items-center justify-center shadow-md">
                      {client.companyName?.[0] || 'C'}
                    </div>
                  )}
                  <div className="overflow-hidden">
                    <Link to={`/clients/${id}`} className="block">
                      <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 transition-colors truncate">
                        {client.companyName}
                      </h3>
                    </Link>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                        {client.clientId}
                      </span>
                      {client.priority && (
                        <span className={`px-1.5 py-0.2 text-[9px] font-black rounded-md border ${priorityColor(client.priority)}`}>
                          {client.priority}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* More Action Menu Dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={(e) => toggleMenu(e, id)}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>

                  {activeMenuId === id && (
                    <div 
                      onMouseLeave={() => setActiveMenuId(null)}
                      className="absolute right-0 top-8 w-44 p-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-30 flex flex-col gap-0.5"
                    >
                      <Link
                        to={`/clients/${id}`}
                        className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 rounded-xl transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        View Profile
                      </Link>
                      <button
                        onClick={() => { setActiveMenuId(null); onDelete?.(id); }}
                        className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors w-full text-left"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete Client
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Status & Contact Attributes */}
              <div className="flex items-center gap-2 my-2">
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${statusColor(client.status)}`}>
                  {client.status}
                </span>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  {client.clientType || 'SMB'}
                </span>
                {client.industry && (
                  <span className="px-2 py-1 rounded-full text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 truncate max-w-[110px]">
                    {client.industry}
                  </span>
                )}
              </div>

              {/* Contact Information */}
              <div className="flex flex-col gap-1.5 my-3 text-xs text-slate-600 dark:text-slate-400">
                {client.clientName && (
                  <Link to={`/clients/${id}`} className="flex items-center gap-2 hover:text-indigo-600 transition-colors">
                    <UserCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="font-semibold text-slate-700 dark:text-slate-300 truncate hover:text-indigo-600">{client.clientName}</span>
                  </Link>
                )}
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{client.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{client.phone}</span>
                </div>
                {client.city && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{client.city}, {client.country}</span>
                  </div>
                )}
              </div>

              {/* Account Team Assignment Badges */}
              <div className="flex items-center gap-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/60 text-[11px]">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 font-medium">Mgr:</span>
                  <span className="font-bold text-slate-700 dark:text-slate-300 truncate max-w-[100px]">
                    {managerName}
                  </span>
                </div>
                {teamLeadName && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400 font-medium">Lead:</span>
                    <span className="font-bold text-slate-700 dark:text-slate-300 truncate max-w-[100px]">
                      {teamLeadName}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Card Footer: Commercial Revenue & Action Link */}
            <div className="mt-4 pt-3 flex items-center justify-between border-t border-slate-100 dark:border-slate-800/60">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                  Monthly Retainer
                </span>
                <span className="text-xs font-black text-slate-900 dark:text-slate-100">
                  ₹{(client.expectedMonthlyRevenue || 0).toLocaleString()}
                </span>
              </div>

              <Link
                to={`/clients/${id}`}
                className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-500 group-hover:translate-x-0.5 transition-all"
              >
                View Profile
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ClientGridView;
