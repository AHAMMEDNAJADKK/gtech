import React from 'react';
import { AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import { resolveCalendarImageUrl } from '../../services/calendarService';

const WORK_STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'ready_for_review', label: 'Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'revision_requested', label: 'Revision' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' }
];

/**
 * Calendar work item card
 * Shows compact information, image thumbnail, and live status sync
 */
const CalendarWorkCard = ({
  item,
  work,
  onClick,
  onStatusChange,
  compact = true
}) => {
  const record = item || work || {};

  const getWorkStatusBadge = (status) => {
    const statusMap = {
      draft: { bg: 'bg-slate-200 dark:bg-slate-700', text: 'text-slate-700 dark:text-slate-200', label: 'Draft' },
      in_progress: { bg: 'bg-blue-200 dark:bg-blue-900/40', text: 'text-blue-700 dark:text-blue-200', label: 'In Progress' },
      ready_for_review: { bg: 'bg-amber-200 dark:bg-amber-900/40', text: 'text-amber-700 dark:text-amber-200', label: 'Review' },
      approved: { bg: 'bg-green-200 dark:bg-green-900/40', text: 'text-green-700 dark:text-green-200', label: 'Approved' },
      revision_requested: { bg: 'bg-orange-200 dark:bg-orange-900/40', text: 'text-orange-700 dark:text-orange-200', label: 'Revision' },
      completed: { bg: 'bg-emerald-200 dark:bg-emerald-900/40', text: 'text-emerald-700 dark:text-emerald-200', label: '✓ Done' },
      cancelled: { bg: 'bg-slate-200 dark:bg-slate-700', text: 'text-slate-700 dark:text-slate-200', label: 'Cancelled' }
    };
    return statusMap[status] || statusMap.draft;
  };

  const isOverdue = () => {
    if (record.postingStatus === 'posted' || !record.postingDate) return false;
    const postDate = new Date(record.postingDate);
    return postDate < new Date();
  };

  const workStatus = getWorkStatusBadge(record.workStatus);
  const postedIndicator = record.postingStatus === 'posted';
  const overdue = isOverdue();
  const imageSrc = resolveCalendarImageUrl(record.imageUrl);
  const workId = record._id || record.id;

  const getAssigneeInfo = () => {
    if (record.assignedTo) {
      if (typeof record.assignedTo === 'object') {
        return {
          name: record.assignedTo.name || record.assignedTo.email?.split('@')[0] || 'Unknown',
          initial: (record.assignedTo.name || '?').charAt(0).toUpperCase()
        };
      }
      return { name: 'Unknown', initial: '?' };
    }
    return { name: 'Unassigned', initial: '?' };
  };

  const assignee = getAssigneeInfo();

  const handleStatusChange = (event) => {
    event.stopPropagation();
    const nextStatus = event.target.value;
    if (!nextStatus || nextStatus === record.workStatus) return;
    if (onStatusChange && workId) {
      onStatusChange(workId, nextStatus);
    }
  };

  return (
    <motion.div
      onClick={onClick}
      className={`p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:shadow-md hover:border-emerald-400 dark:hover:border-emerald-600 cursor-pointer transition group ${
        overdue ? 'border-rose-300 dark:border-rose-700 bg-rose-50/50 dark:bg-rose-950/20' : ''
      }`}
      whileHover={{ y: -2 }}
    >
      <div className="flex flex-col gap-1">
        {imageSrc && (
          <img
            src={imageSrc}
            alt={record.title || 'Calendar work'}
            className="w-full h-28 object-cover rounded-lg border border-slate-700/50 mb-2"
          />
        )}

        <div className="flex items-start justify-between gap-2">
          <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate flex-1">
            {record.title}
          </h4>
          {(postedIndicator || String(record.workStatus).toLowerCase() === 'completed') && (
            <span className="shrink-0">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 stroke-[2.5]" title="Completed / Posted" />
            </span>
          )}
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
          {record.contentType?.replace(/_/g, ' ') || 'Content'}
        </p>

        <div className="flex items-center justify-between gap-2 text-xs">
          <span className={`px-2 py-0.5 rounded font-semibold ${workStatus.bg} ${workStatus.text} whitespace-nowrap`}>
            {workStatus.label}
          </span>
          {postedIndicator && (
            <span className="px-2 py-0.5 rounded font-semibold bg-emerald-200 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-200 whitespace-nowrap">
              ✓ Posted
            </span>
          )}
        </div>

        {onStatusChange && (
          <select
            value={record.workStatus || 'draft'}
            onClick={(event) => event.stopPropagation()}
            onChange={handleStatusChange}
            className="w-full mt-0.5 px-1.5 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[10px] font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            aria-label="Update work status"
          >
            {WORK_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        )}

        {record.postingTime && !postedIndicator && (
          <p className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {record.postingTime}
          </p>
        )}

        {overdue && (
          <div className="flex items-center gap-1 text-xs text-rose-600 dark:text-rose-400 font-semibold">
            <AlertTriangle className="w-3 h-3" />
            Overdue
          </div>
        )}

        {compact && assignee && (
          <div className="flex items-center gap-1 text-xs">
            <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold">
              {assignee.initial}
            </div>
            <span className="text-slate-600 dark:text-slate-400 truncate">
              {assignee.name}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 mt-1 pt-1 border-t border-slate-100 dark:border-slate-800">
          <span className="truncate">
            Updated by <strong className="text-slate-700 dark:text-slate-300 font-semibold">{record.updatedBy?.name || record.createdBy?.name || assignee.name}</strong>
          </span>
          <span className="shrink-0 text-[9px] text-slate-400 dark:text-slate-500 ml-1">
            {new Date(record.updatedAt || record.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
    </motion.div>
  );
};

export default CalendarWorkCard;
