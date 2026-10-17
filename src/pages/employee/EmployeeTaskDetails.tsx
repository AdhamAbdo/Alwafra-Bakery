import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';
import { useTaskNotes } from '@/hooks/useData';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { StatusBadge } from '@/components/ui/Badge';
import { formatDate, formatDateTime, isOverdue, STATUS_STYLES, PRIORITY_STYLES, STATUSES, type TaskStatus } from '@/lib/constants';
import { Calendar, User, Building, Flag, CheckCircle2, StickyNote } from 'lucide-react';
import type { Task } from '@/lib/types';

interface Props {
  task: Task;
  onClose: () => void;
  onUpdate: () => void;
}

export function EmployeeTaskDetails({ task, onClose, onUpdate }: Props) {
  const { showToast } = useToast();
  const { profile } = useAuth();
  const { notes } = useTaskNotes(task.id);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState('');
  const [updating, setUpdating] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(task.status);
  const [currentProgress, setCurrentProgress] = useState(task.progress_percentage);

  useEffect(() => {
    (async () => {
      const { data: historyData } = await supabase
        .from('task_status_history')
        .select('*, profiles(*)')
        .eq('task_id', task.id)
        .order('created_at', { ascending: false });
      setHistory(historyData || []);
      setLoading(false);
    })();
  }, [task.id]);

  const handleStatusChange = async () => {
    if (currentStatus === task.status && currentProgress === task.progress_percentage) return;
    setUpdating(true);
    try {
      const { error } = await supabase.rpc('update_task_status', {
        p_task_id: task.id,
        p_new_status: currentStatus,
        p_progress: currentStatus !== 'مكتملة' ? currentProgress : null,
      });
      if (error) throw error;
      showToast('تم تحديث المهمة');
      onUpdate();
    } catch {
      showToast('تعذر تحديث المهمة', 'error');
    } finally {
      setUpdating(false);
    }
  };

  const handleComplete = async () => {
    setUpdating(true);
    try {
      const { error } = await supabase.rpc('update_task_status', {
        p_task_id: task.id,
        p_new_status: 'مكتملة',
        p_progress: 100,
      });
      if (error) throw error;
      showToast('تم إكمال المهمة');
      onUpdate();
    } catch {
      showToast('تعذر إكمال المهمة', 'error');
    } finally {
      setUpdating(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    setUpdating(true);
    try {
      const { data: emp } = await supabase
        .from('employees')
        .select('id')
        .eq('profile_id', profile!.id)
        .maybeSingle();
      if (!emp) throw new Error('Employee not found');
      const { error } = await supabase.from('task_notes').insert({
        task_id: task.id,
        employee_id: emp.id,
        note: newNote.trim(),
      });
      if (error) throw error;
      setNewNote('');
      showToast('تمت إضافة الملاحظة');
    } catch {
      showToast('تعذر إضافة الملاحظة', 'error');
    } finally {
      setUpdating(false);
    }
  };

  const overdue = isOverdue(task.due_date, task.status);

  return (
    <Modal open={true} onClose={onClose} title="تفاصيل المهمة" size="lg">
      {loading ? (
        <div className="flex justify-center py-8"><Spinner size={24} /></div>
      ) : (
        <div className="space-y-5">
          <div>
            <h3 className="text-lg font-bold text-navy">{task.title}</h3>
            {task.description && <p className="mt-2 text-sm text-navy-light leading-relaxed">{task.description}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs text-navy-muted mb-1 flex items-center gap-1"><Calendar className="h-3 w-3" /> تاريخ الاستحقاق</p>
              <p className={`font-medium ${overdue ? 'text-red-600' : 'text-navy'}`}>{formatDate(task.due_date)}</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs text-navy-muted mb-1 flex items-center gap-1"><Flag className="h-3 w-3" /> الأولوية</p>
              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${PRIORITY_STYLES[task.priority]}`}>{task.priority}</span>
            </div>
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs text-navy-muted mb-1 flex items-center gap-1"><Building className="h-3 w-3" /> القسم / الإدارة</p>
              <p className="font-medium text-navy">{task.business_sections?.name} / {task.departments?.name}</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs text-navy-muted mb-1 flex items-center gap-1"><User className="h-3 w-3" /> أنشأها</p>
              <p className="font-medium text-navy">{task.profiles?.full_name || '-'}</p>
            </div>
          </div>

          {task.manager_notes && (
            <div className="rounded-lg border border-orange-100 bg-orange-50/50 p-3">
              <p className="text-xs font-medium text-primary mb-1">ملاحظات المدير</p>
              <p className="text-sm text-navy-light">{task.manager_notes}</p>
            </div>
          )}

          {/* Current Status & Progress */}
          <div className="rounded-lg border border-gray-100 p-4 space-y-4">
            <h4 className="text-sm font-bold text-navy">تحديث المهمة</h4>
            <div>
              <label className="label-field">الحالة</label>
              <select value={currentStatus} onChange={(e) => setCurrentStatus(e.target.value as TaskStatus)} className="input-field">
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label-field">نسبة التقدم: {currentProgress}%</label>
              <input
                type="range"
                min="0"
                max="100"
                value={currentProgress}
                onChange={(e) => setCurrentProgress(Number(e.target.value))}
                className="w-full accent-primary"
                disabled={currentStatus === 'مكتملة'}
              />
              <div className="mt-2"><ProgressBar value={currentProgress} size="sm" showLabel /></div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleStatusChange} disabled={updating} className="btn-primary flex-1">
                {updating ? <Spinner size={16} /> : null}
                حفظ التحديث
              </button>
              <button onClick={handleComplete} disabled={updating || task.status === 'مكتملة'} className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-500 px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-green-600 disabled:opacity-50">
                <CheckCircle2 className="h-4 w-4" />
                إكمال المهمة
              </button>
            </div>
          </div>

          {/* Notes */}
          <div>
            <h4 className="text-sm font-bold text-navy mb-2 flex items-center gap-1.5"><StickyNote className="h-4 w-4" /> ملاحظاتي</h4>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="أضف ملاحظة..."
                className="input-field"
                onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
              />
              <button onClick={handleAddNote} disabled={updating || !newNote.trim()} className="btn-primary">إضافة</button>
            </div>
            {notes.length === 0 ? (
              <p className="text-sm text-navy-muted py-2">لا توجد ملاحظات</p>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {notes.map((n) => (
                  <div key={n.id} className="rounded-lg bg-gray-50 p-3">
                    <p className="text-sm text-navy">{n.note}</p>
                    <p className="mt-1.5 text-xs text-navy-muted">{formatDateTime(n.created_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* History */}
          <div>
            <h4 className="text-sm font-bold text-navy mb-2">سجل الحالة</h4>
            {history.length === 0 ? (
              <p className="text-sm text-navy-muted py-2">لا توجد تغييرات مسجلة</p>
            ) : (
              <div className="space-y-2">
                {history.map((h) => (
                  <div key={h.id} className="flex items-center gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      {h.old_status && <StatusBadge status={h.old_status} styles={STATUS_STYLES} />}
                      <span className="text-navy-muted">←</span>
                      <StatusBadge status={h.new_status} styles={STATUS_STYLES} />
                    </div>
                    <span className="text-navy-muted text-xs">{h.profiles?.full_name || '-'}</span>
                    <span className="text-navy-muted text-xs">{formatDateTime(h.created_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
