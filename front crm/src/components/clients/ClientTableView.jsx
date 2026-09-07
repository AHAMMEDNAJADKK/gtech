import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Building, ChevronRight, ArrowUpDown, ExternalLink, 
  Trash2, Mail, Phone, UserCheck, ShieldCheck, Tag 
} from 'lucide-react';

const ClientTableView = ({ clients, sortBy, sortOrder, onSort, onDelete }) => {
  const navigate = useNavigate();
  const [selectedIds, setSelectedIds] = useState([]);

  const toggleSelectAll = () => {
    if (selectedIds.length === clients.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(clients.map(c => c._id || c.id));
    }
  };

  const toggleSelectOne = (id) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(i => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleSortTrigger = (field) => {
    if (onSort) {
      if (sortBy === field) {
        onSort(field, sortOrder === 'asc' ? 'desc' : 'asc');
      } else {
        onSort(field, 'asc');
      }
    }
  };

  const priorityColor = (priority) => {
    switch (priority) {
      case 'VIP': return 'bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300';
      case 'High': return 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300';
      case 'Medium': return 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300';
      default: return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
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
    <div className="w-full overflow-hidden rounded-3xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800/80 backdrop-blur-md shadow-lg">
      <div className="overflow-x-auto max-w-full">
        <table className="w-full text-left border-collapse min-w-[900px]">
          <thead>
            <tr className="border-b border-slate-200/80 dark:border-slate-800/80 bg-slate-50/80 dark:bg-slate-800/50 text-[11px] font-black uppercase text-slate-500 tracking-wider">
              <th className="py-4 px-4 w-10 text-center">
                <input
                  type="checkbox"
                  checked={clients.length > 0 && selectedIds.length === clients.length}
                  onChange={toggleSelectAll}
                  className="rounded-md border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
              </th>
              
              <th 
                className="py-4 px-4 cursor-pointer hover:text-indigo-600 transition-colors"
                onClick={() => handleSortTrigger('companyName')}
              >
                <div className="flex items-center gap-1.5">
                  <span>Company Name</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>

              <th className="py-4 px-4">Contact Person</th>

              <th className="py-4 px-4">Client ID</th>

              <th className="py-4 px-4">Industry</th>

              <th className="py-4 px-4">Contact Details</th>

              <th 
                className="py-4 px-4 cursor-pointer hover:text-indigo-600 transition-colors"
                onClick={() => handleSortTrigger('status')}
              >
                <div className="flex items-center gap-1.5">
                  <span>Status</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>

              <th 
                className="py-4 px-4 cursor-pointer hover:text-indigo-600 transition-colors"
                onClick={() => handleSortTrigger('priority')}
              >
                <div className="flex items-center gap-1.5">
                  <span>Priority</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>

              <th className="py-4 px-4">Account Manager</th>

              <th 
                className="py-4 px-4 text-right cursor-pointer hover:text-indigo-600 transition-colors"
                onClick={() => handleSortTrigger('revenue')}
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span>Monthly Rev</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>

              <th className="py-4 px-4 text-center">Actions</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
            {clients.map((client) => {
              const id = client._id || client.id || client.clientId;
              const isSelected = selectedIds.includes(id);
              const managerName = client.accountManager?.name || 'Unassigned';

              return (
                <tr
                  key={id}
                  onClick={() => navigate(`/clients/${id}`)}
                  className={`hover:bg-indigo-50/40 dark:hover:bg-slate-800/50 transition-colors cursor-pointer ${
                    isSelected ? 'bg-indigo-50/60 dark:bg-slate-800/80' : ''
                  }`}
                >
                  <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelectOne(id)}
                      className="rounded-md border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                  </td>

                  {/* Company Column */}
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-3">
                      {client.companyLogo ? (
                        <img
                          src={client.companyLogo}
                          alt=""
                          className="w-8 h-8 rounded-xl object-cover ring-1 ring-slate-200 dark:ring-slate-700"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-black text-xs flex items-center justify-center shadow-xs">
                          {client.companyName?.[0] || 'C'}
                        </div>
                      )}
                      <div>
                        <div className="font-bold text-slate-800 dark:text-slate-100 hover:text-indigo-600 transition-colors">
                          {client.companyName}
                        </div>
                        <div className="text-[10px] text-slate-400 font-semibold">{client.clientType || 'SMB'}</div>
                      </div>
                    </div>
                  </td>

                  {/* Primary Contact */}
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-slate-700 dark:text-slate-300 hover:text-indigo-600 transition-colors">
                      {client.clientName || client.primaryContact?.name || '-'}
                    </div>
                  </td>

                  {/* Client ID */}
                  <td className="py-3.5 px-4 font-mono font-bold text-[11px] text-slate-500 uppercase">
                    {client.clientId}
                  </td>

                  {/* Industry */}
                  <td className="py-3.5 px-4">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      {client.industry || 'Technology'}
                    </span>
                  </td>

                  {/* Contact Details */}
                  <td className="py-3.5 px-4">
                    <div className="flex flex-col gap-0.5 text-[11px] text-slate-600 dark:text-slate-400">
                      <div className="truncate max-w-[160px]">{client.email}</div>
                      <div className="text-slate-400 font-mono">{client.phone}</div>
                    </div>
                  </td>

                  {/* Status */}
                  <td className="py-3.5 px-4">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${statusColor(client.status)}`}>
                      {client.status}
                    </span>
                  </td>

                  {/* Priority */}
                  <td className="py-3.5 px-4">
                    {client.priority ? (
                      <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded-md ${priorityColor(client.priority)}`}>
                        {client.priority}
                      </span>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>

                  {/* Account Manager */}
                  <td className="py-3.5 px-4">
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {managerName}
                    </span>
                  </td>

                  {/* Revenue */}
                  <td className="py-3.5 px-4 text-right font-black text-slate-800 dark:text-slate-100">
                    ₹{(client.expectedMonthlyRevenue || 0).toLocaleString()}
                  </td>

                  {/* Actions */}
                  <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => navigate(`/clients/${id}`)}
                        title="View Profile"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors cursor-pointer"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => onDelete?.(id)}
                        title="Delete Client"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ClientTableView;
