import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Edit2, Trash2, Calendar, Clock, User, AlertTriangle, CheckCircle2, ExternalLink } from 'lucide-react';
import ConfirmModal from '../../components/ConfirmModal';
import { resolveCalendarImageUrl } from '../../services/calendarService';

/**
 * Detailed view modal for calendar work items
 * Shows all information and allows status updates
 */
const CalendarWorkDetails = ({
  isOpen,
  onClose,
  work,
  onEdit,
  onDelete,
  onStatusUpdate,
  onPostingStatusUpdate,
  loading = false
}) => {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [statusUpdateOpen, setStatusUpdateOpen] = useState(false);
  const [postingStatusUpdateOpen, setPostingStatusUpdateOpen] = useState(false);
  const [selectedWorkStatus, setSelectedWorkStatus] = useState(work?.workStatus || '');
  const [selectedPostingStatus, setSelectedPostingStatus] = useState(work?.postingStatus || '');
  const [postUrl, setPostUrl] = useState('');
  const [postingNotes, setPostingNotes] = useState('');
  const [statusSaving, setStatusSaving] = useState(false);

  useEffect(() => {
    setSelectedWorkStatus(work?.workStatus || '');
    setSelectedPostingStatus(work?.postingStatus || '');
    setPostUrl('');
    setPostingNotes('');
  }, [work]);

  if (!isOpen || !work) return null;

  const workStatuses = [
    'draft', 'in_progress', 'ready_for_review', 'approved', 'revision_requested', 'completed'
  ];

  const postingStatuses = [
    'not_scheduled', 'scheduled', 'ready_to_post', 'posted', 'failed', 'cancelled'
  ];

  const getStatusColor = (status, type = 'work') => {
    if (type === 'posting') {
      const colors = {
        not_scheduled: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200',
        scheduled: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-200',
        ready_to_post: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-200',
        posted: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-200',
        failed: 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-200',
        cancelled: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
      };
      return colors[status] || colors.not_scheduled;
    }

    const colors = {
      draft: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200',
      in_progress: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-200',
      ready_for_review: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-200',
      approved: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-200',
      revision_requested: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-200',
      completed: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-200'
    };
    return colors[status] || colors.draft;
  };

  const isOverdue = () => {
    if (work.postingStatus === 'posted') return false;
    const postDate = new Date(work.postingDate);
    return postDate < new Date();
  };

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
        />

        {/* Modal */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          transition={{ type: "spring", duration: 0.4, bounce: 0.1 }}
          className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-2xl z-10 max-h-[90vh] overflow-y-auto"
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            className="sticky top-4 right-4 float-right p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition z-10"
            aria-label="Close modal"
          >
            <X size={20} />
          </button>

          <div className="p-6">
            {/* Header */}
            <div className="mb-6">
              <div className="flex items-start justify-between gap-4 mb-4">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {work.title}
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => onEdit && onEdit(work)}
                    className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition"
                    title="Edit"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    onClick={() => setDeleteConfirmOpen(true)}
                    className="p-2 rounded-lg bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 hover:bg-rose-200 dark:hover:bg-rose-900/50 transition"
                    title="Delete"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              {/* Overdue Alert */}
              {isOverdue() && work.postingStatus !== 'posted' && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800 mb-4">
                  <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-rose-700 dark:text-rose-200">Overdue</p>
                    <p className="text-xs text-rose-600 dark:text-rose-300">
                      This content was scheduled to be posted on {new Date(work.postingDate).toLocaleDateString()} but hasn't been posted yet.
                    </p>
                  </div>
                </div>
              )}

              {/* Posted Indicator */}
              {work.postingStatus === 'posted' && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 mb-4">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-200">✓ Posted</p>
                    {work.actualPostTime && (
                      <p className="text-xs text-emerald-600 dark:text-emerald-300">
                        Posted on {new Date(work.actualPostTime).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {work.description && (
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                  {work.description}
                </p>
              )}

              {work.imageUrl && (
                <img
                  src={resolveCalendarImageUrl(work.imageUrl)}
                  alt={work.title || 'Calendar work'}
                  className="w-full h-28 object-cover rounded-lg border border-slate-700/50 mb-2 mt-4"
                />
              )}
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              {/* Content Type */}
              <div>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Content Type</p>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {work.contentType?.replace(/_/g, ' ') || 'Not specified'}
                </p>
              </div>

              {/* Assigned To */}
              <div>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Assigned To</p>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <User size={14} />
                  {work.assignedTo?.name || 'Unknown'}
                </p>
              </div>

              {/* Work Status */}
              <div>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Work Status</p>
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${getStatusColor(work.workStatus)}`}>
                    {work.workStatus?.replace(/_/g, ' ')}
                  </span>
                  <select
                    value={work.workStatus || selectedWorkStatus || 'draft'}
                    disabled={loading || statusSaving}
                    onChange={async (event) => {
                      const nextStatus = event.target.value;
                      setSelectedWorkStatus(nextStatus);
                      if (!onStatusUpdate || nextStatus === work.workStatus) return;
                      setStatusSaving(true);
                      try {
                        await onStatusUpdate(work._id || work.id, nextStatus);
                      } finally {
                        setStatusSaving(false);
                      }
                    }}
                    className="px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    aria-label="Update work status"
                  >
                    {workStatuses.map((status) => (
                      <option key={status} value={status}>
                        {status.replace(/_/g, ' ')}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Posting Status */}
              <div>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Posting Status</p>
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${getStatusColor(work.postingStatus, 'posting')}`}>
                    {work.postingStatus?.replace(/_/g, ' ')}
                  </span>
                  <button
                    onClick={() => setPostingStatusUpdateOpen(true)}
                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    Change
                  </button>
                </div>
              </div>

              {/* Work Date */}
              {work.workDate && (
                <div>
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Work Date</p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Calendar size={14} />
                    {new Date(work.workDate).toLocaleDateString()}
                  </p>
                </div>
              )}

              {/* Due Date */}
              {work.workDueDate && (
                <div>
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Due Date</p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Calendar size={14} />
                    {new Date(work.workDueDate).toLocaleDateString()}
                  </p>
                </div>
              )}

              {/* Posting Date & Time */}
              {work.postingDate && (
                <div>
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Posting Date</p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Calendar size={14} />
                    {new Date(work.postingDate).toLocaleDateString()}
                  </p>
                </div>
              )}

              {work.postingTime && (
                <div>
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Posting Time</p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Clock size={14} />
                    {work.postingTime}
                  </p>
                </div>
              )}

              {/* Campaign */}
              {work.campaign && (
                <div className="col-span-2">
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Campaign</p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{work.campaign}</p>
                </div>
              )}

              {/* Tags */}
              {work.tags && work.tags.length > 0 && (
                <div className="col-span-2">
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Tags</p>
                  <div className="flex flex-wrap gap-2">
                    {work.tags.map(tag => (
                      <span
                        key={tag}
                        className="px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Social Media Links */}
              {work.socialMediaLinks && work.socialMediaLinks.length > 0 && (
                <div className="col-span-2">
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Social Media Links</p>
                  <div className="flex flex-col gap-2">
                    {work.socialMediaLinks.map((link, idx) => (
                      <a
                        key={idx}
                        href={link.postUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-2"
                      >
                        <ExternalLink size={14} />
                        {link.platform}: {link.postUrl.substring(0, 50)}...
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Created & Last Updated Summary */}
              {work.createdAt && (
                <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200/50 dark:border-slate-800">
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Created By</p>
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {work.createdBy?.name || 'System / Admin'}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {new Date(work.createdAt).toLocaleString()}
                  </p>
                </div>
              )}

              {work.updatedAt && (
                <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200/50 dark:border-slate-800">
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Last Updated By</p>
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {work.updatedBy?.name || work.createdBy?.name || 'System / Admin'}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {new Date(work.updatedAt).toLocaleString()}
                  </p>
                </div>
              )}

              {/* UPDATE AUDIT LOGS TIMELINE */}
              <div className="col-span-2 mt-2 pt-4 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1.5">
                    <Clock size={13} className="text-indigo-500" />
                    Update History & Audit Logs ({(() => {
                      const logs = [];
                      if (Array.isArray(work.updateLogs)) {
                        work.updateLogs.forEach((ul, idx) => {
                          logs.push({
                            id: `ul-${idx}`,
                            user: ul.updatedBy?.name || work.updatedBy?.name || work.createdBy?.name || 'System User',
                            timestamp: new Date(ul.updatedAt || ul.createdAt || work.updatedAt),
                            action: ul.action || 'Updated Details',
                            notes: ul.notes || '',
                            type: 'update'
                          });
                        });
                      }
                      if (Array.isArray(work.workStatusHistory)) {
                        work.workStatusHistory.forEach((sh, idx) => {
                          const userName = typeof sh.changedBy === 'object' ? sh.changedBy?.name : (work.updatedBy?.name || work.createdBy?.name || 'System User');
                          logs.push({
                            id: `wsh-${idx}`,
                            user: userName,
                            timestamp: new Date(sh.changedAt),
                            action: `Work Status: ${String(sh.status).replace(/_/g, ' ')}`,
                            notes: sh.notes || '',
                            type: 'status'
                          });
                        });
                      }
                      if (Array.isArray(work.postingStatusHistory)) {
                        work.postingStatusHistory.forEach((ph, idx) => {
                          const userName = typeof ph.changedBy === 'object' ? ph.changedBy?.name : (work.updatedBy?.name || work.createdBy?.name || 'System User');
                          logs.push({
                            id: `psh-${idx}`,
                            user: userName,
                            timestamp: new Date(ph.changedAt),
                            action: `Posting Status: ${String(ph.status).replace(/_/g, ' ')}`,
                            notes: ph.notes || '',
                            type: 'posting'
                          });
                        });
                      }
                      if (logs.length === 0 && work.createdAt) {
                        logs.push({
                          id: 'created-0',
                          user: work.createdBy?.name || 'System User',
                          timestamp: new Date(work.createdAt),
                          action: 'Created Work Item',
                          notes: 'Initial creation',
                          type: 'creation'
                        });
                      }
                      return logs.length;
                    })()})
                  </p>
                </div>
                <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                  {(() => {
                    const logs = [];
                    if (Array.isArray(work.updateLogs)) {
                      work.updateLogs.forEach((ul, idx) => {
                        logs.push({
                          id: `ul-${idx}`,
                          user: ul.updatedBy?.name || work.updatedBy?.name || work.createdBy?.name || 'System User',
                          timestamp: new Date(ul.updatedAt || ul.createdAt || work.updatedAt),
                          action: ul.action || 'Updated Details',
                          notes: ul.notes || '',
                          type: 'update'
                        });
                      });
                    }
                    if (Array.isArray(work.workStatusHistory)) {
                      work.workStatusHistory.forEach((sh, idx) => {
                        const userName = typeof sh.changedBy === 'object' ? sh.changedBy?.name : (work.updatedBy?.name || work.createdBy?.name || 'System User');
                        logs.push({
                          id: `wsh-${idx}`,
                          user: userName,
                          timestamp: new Date(sh.changedAt),
                          action: `Work Status: ${String(sh.status).replace(/_/g, ' ')}`,
                          notes: sh.notes || '',
                          type: 'status'
                        });
                      });
                    }
                    if (Array.isArray(work.postingStatusHistory)) {
                      work.postingStatusHistory.forEach((ph, idx) => {
                        const userName = typeof ph.changedBy === 'object' ? ph.changedBy?.name : (work.updatedBy?.name || work.createdBy?.name || 'System User');
                        logs.push({
                          id: `psh-${idx}`,
                          user: userName,
                          timestamp: new Date(ph.changedAt),
                          action: `Posting Status: ${String(ph.status).replace(/_/g, ' ')}`,
                          notes: ph.notes || '',
                          type: 'posting'
                        });
                      });
                    }
                    if (logs.length === 0 && work.createdAt) {
                      logs.push({
                        id: 'created-0',
                        user: work.createdBy?.name || 'System User',
                        timestamp: new Date(work.createdAt),
                        action: 'Created Work Item',
                        notes: 'Initial creation',
                        type: 'creation'
                      });
                    }
                    logs.sort((a, b) => b.timestamp - a.timestamp);
                    return logs.map((log) => (
                      <div
                        key={log.id}
                        className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 text-xs flex items-start justify-between gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-800 dark:text-slate-200">
                              {log.user}
                            </span>
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-800/50 capitalize">
                              {log.action}
                            </span>
                          </div>
                          {log.notes && (
                            <p className="text-slate-600 dark:text-slate-400 mt-1 text-[11px] leading-relaxed">
                              {log.notes}
                            </p>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0 font-medium">
                          {log.timestamp.toLocaleDateString()} {log.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 font-bold text-sm transition"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={() => {
          onDelete(work._id);
          setDeleteConfirmOpen(false);
          onClose();
        }}
        title="Delete Calendar Work"
        message={`Are you sure you want to delete "${work.title}"? This action cannot be undone.`}
        confirmText="Delete"
        type="danger"
      />

      {/* Status Update Modal */}
      <ConfirmModal
        isOpen={statusUpdateOpen}
        onClose={() => setStatusUpdateOpen(false)}
        onConfirm={() => {
          onStatusUpdate(work._id, selectedWorkStatus);
          setStatusUpdateOpen(false);
        }}
        title="Update Work Status"
        message={`Update work status to ${selectedWorkStatus.replace(/_/g, ' ')}?`}
        confirmText="Update"
        type="warning"
      />

      {/* Posting Status Update Modal */}
      <ConfirmModal
        isOpen={postingStatusUpdateOpen}
        onClose={() => setPostingStatusUpdateOpen(false)}
        onConfirm={() => {
          onPostingStatusUpdate(work._id, {
            status: selectedPostingStatus,
            actualPostTime: selectedPostingStatus === 'posted' ? new Date() : undefined,
            notes: postingNotes
          });
          setPostingStatusUpdateOpen(false);
        }}
        title="Update Posting Status"
        message={`Update posting status to ${selectedPostingStatus.replace(/_/g, ' ')}?`}
        confirmText="Update"
        type="warning"
      />
    </AnimatePresence>,
    document.body
  );
};

export default CalendarWorkDetails;
