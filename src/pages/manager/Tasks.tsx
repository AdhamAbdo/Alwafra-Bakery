import { useState, useMemo, useEffect } from 'react';
import { Plus, Search, Eye, Edit, Trash2, ClipboardList, Calendar } from 'lucide-react';
import { useTasks, useEmployees, useBusinessSections, useDepartments, useTaskNotes } from '@/hooks/useData';
import { useToast } from '@/context/ToastContext';
import { supabase } from '@/lib/supabase';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { StatusBadge } from '@/components/ui/Badge';
import { formatDate, formatDateTime, isOverdue, STATUS_STYLES, PRIORITY_STYLES, PRIORITIES, type TaskStatus, type TaskPriority } from '@/lib/constants';
import type { Task } from '@/lib/types';

export function TasksPage({ onNavigate, initialTaskId }: { onNavigate: (page: string, params?: Record<string, string>) => void; initialTaskId?: string }) {
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterSection, setFilterSection] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [viewingTask, setViewingTask] = useState<Task | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const { sections } = useBusinessSections();
  const { departments } = useDepartments();
  const { employees } = useEmployees();

  const filters = useMemo(() => ({
    status: filterStatus || undefined,
    priority: filterPriority || undefined,
    sectionId: filterSection || undefined,
    departmentId: filterDept || undefined,
    search: search || undefined,
  }), [filterStatus, filterPriority, filterSection, filterDept, search]);

  const { tasks, loading, refetch } = useTasks(filters);

  // Auto-open task details when navigated from notification
  useEffect(() => {
    if (initialTaskId && tasks.length > 0) {
      const task = tasks.find((t) => t.id === initialTaskId);
      if (task) setViewingTask(task);
    }
  }, [initialTaskId, tasks]);

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (filterSection && t.business_section_id !== filterSection) return false;
      if (filterDept && t.department_id !== filterDept) return false;
      return true;
    });
  }, [tasks, filterSection, filterDept]);

  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);
  const totalPages = Math.ceil(filtered.length / pageSize);

  const filteredDepartments = filterSection
    ? departments.filter((d) => d.business_section_id === filterSection)
    : departments;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="card p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-wrap gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="بحث بعنوان المهمة أو اسم الموظف..."
                className="input-field pr-10"
              />
            </div>
            <select value={filterSection} onChange={(e) => { setFilterSection(e.target.value); setFilterDept(''); }} className="input-field max-w-[130px]">
              <option value="">كل الأقسام</option>
              {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select value={filterDept} onChange={(e) => setFilterDept(e.target.value)} className="input-field max-w-[130px]">
              <option value="">كل الإدارات</option>
              {filteredDepartments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="input-field max-w-[120px]">
              <option value="">كل الحالات</option>
              <option value="جديدة">جديدة</option>
              <option value="قيد التنفيذ">قيد التنفيذ</option>
              <option value="مكتملة">مكتملة</option>
              <option value="متأخرة">متأخرة</option>
              <option value="ملغاة">ملغاة</option>
            </select>
            <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} className="input-field max-w-[120px]">
              <option value="">كل الأولويات</option>
              {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <button onClick={() => setShowAddModal(true)} className="btn-primary">
            <Plus className="h-4 w-4" />
            إنشاء مهمة
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><Spinner size={28} /></div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<ClipboardList className="h-10 w-10" />} title="لا توجد مهام" message="ابدأ بإنشاء أول مهمة" action={<button onClick={() => setShowAddModal(true)} className="btn-primary"><Plus className="h-4 w-4" />إنشاء مهمة</button>} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-navy-muted">
                  <tr>
                    <th className="px-4 py-3 text-right font-medium">المهمة</th>
                    <th className="px-4 py-3 text-right font-medium">الموظف</th>
                    <th className="px-4 py-3 text-right font-medium">القسم</th>
                    <th className="px-4 py-3 text-right font-medium">الأولوية</th>
                    <th className="px-4 py-3 text-right font-medium">الاستحقاق</th>
                    <th className="px-4 py-3 text-right font-medium">الحالة</th>
                    <th className="px-4 py-3 text-right font-medium">التقدم</th>
                    <th className="px-4 py-3 text-right font-medium">آخر تحديث</th>
                    <th className="px-4 py-3 text-right font-medium">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {paginated.map((t) => {
                    const overdue = isOverdue(t.due_date, t.status);
                    return (
                      <tr key={t.id} className={`hover:bg-gray-50/50 ${overdue ? 'bg-red-50/30' : ''}`}>
                        <td className="px-4 py-3 text-navy font-medium max-w-[200px] truncate">{t.title}</td>
                        <td className="px-4 py-3 text-navy-light">{t.employees?.full_name || '-'}</td>
                        <td className="px-4 py-3 text-navy-light">{t.business_sections?.name || '-'}</td>
                        <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${PRIORITY_STYLES[t.priority]}`}>{t.priority}</span></td>
                        <td className="px-4 py-3">
                          <span className={overdue ? 'text-red-600 font-medium' : 'text-navy-light'}>{formatDate(t.due_date)}</span>
                        </td>
                        <td className="px-4 py-3"><StatusBadge status={t.status} styles={STATUS_STYLES} /></td>
                        <td className="px-4 py-3 w-28"><ProgressBar value={t.progress_percentage} size="sm" showLabel /></td>
                        <td className="px-4 py-3 text-xs text-navy-muted">{formatDateTime(t.updated_at)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button onClick={() => setViewingTask(t)} className="rounded p-1.5 text-blue-600 hover:bg-blue-50 transition-colors" title="عرض"><Eye className="h-4 w-4" /></button>
                            <button onClick={() => setEditingTask(t)} className="rounded p-1.5 text-navy-light hover:bg-gray-100 transition-colors" title="تعديل"><Edit className="h-4 w-4" /></button>
                            <button onClick={() => setDeleteTarget(t)} className="rounded p-1.5 text-red-600 hover:bg-red-50 transition-colors" title="حذف"><Trash2 className="h-4 w-4" /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
                <p className="text-xs text-navy-muted">صفحة {page} من {totalPages}</p>
                <div className="flex gap-1">
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-ghost disabled:opacity-30">السابق</button>
                  <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn-ghost disabled:opacity-30">التالي</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {showAddModal && (
        <TaskForm
          sections={sections}
          departments={departments}
          employees={employees}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => { setShowAddModal(false); refetch(); }}
        />
      )}

      {editingTask && (
        <TaskForm
          sections={sections}
          departments={departments}
          employees={employees}
          task={editingTask}
          onClose={() => setEditingTask(null)}
          onSuccess={() => { setEditingTask(null); refetch(); }}
        />
      )}

      {viewingTask && (
        <TaskDetailsModal task={viewingTask} onClose={() => setViewingTask(null)} />
      )}

      {deleteTarget && (
        <ConfirmDialog
          open={true}
          onClose={() => setDeleteTarget(null)}
          onConfirm={async () => {
            const { error } = await supabase.from('tasks').delete().eq('id', deleteTarget.id);
            if (error) showToast('تعذر حذف المهمة', 'error');
            else { showToast('تم حذف المهمة'); refetch(); }
          }}
          title="حذف المهمة"
          message={`هل أنت متأكد من حذف المهمة "${deleteTarget.title}"؟`}
          confirmText="حذف"
          danger
        />
      )}
    </div>
  );
}

interface TaskFormProps {
  sections: any[];
  departments: any[];
  employees: any[];
  task?: Task;
  onClose: () => void;
  onSuccess: () => void;
}

function TaskForm({ sections, departments, employees, task, onClose, onSuccess }: TaskFormProps) {
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: task?.title || '',
    description: task?.description || '',
    assigned_to: task?.assigned_to || '',
    priority: task?.priority || 'متوسطة' as TaskPriority,
    due_date: task?.due_date || '',
    manager_notes: task?.manager_notes || '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const selectedEmployee = employees.find((e) => e.id === form.assigned_to);
  const employeeSection = selectedEmployee?.business_section_id || task?.business_section_id || '';
  const employeeDept = selectedEmployee?.department_id || task?.department_id || '';

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.title.trim()) e.title = 'عنوان المهمة مطلوب';
    if (!form.assigned_to) e.assigned_to = 'الموظف مطلوب';
    if (!form.due_date) e.due_date = 'تاريخ الاستحقاق مطلوب';
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setSaving(true);
    try {
      if (task) {
        const { error } = await supabase
          .from('tasks')
          .update({
            title: form.title,
            description: form.description || null,
            assigned_to: form.assigned_to,
            department_id: employeeDept,
            business_section_id: employeeSection,
            priority: form.priority,
            due_date: form.due_date,
            manager_notes: form.manager_notes || null,
          })
          .eq('id', task.id);
        if (error) throw error;
        showToast('تم تحديث المهمة');
      } else {
        const { data: userData } = await supabase.auth.getUser();
        const { data: insertedTask, error } = await supabase.from('tasks').insert({
          title: form.title,
          description: form.description || null,
          assigned_to: form.assigned_to,
          created_by: userData.user?.id,
          department_id: employeeDept,
          business_section_id: employeeSection,
          priority: form.priority,
          due_date: form.due_date,
          manager_notes: form.manager_notes || null,
        }).select().single();
        if (error) throw error;
        showToast('تم إنشاء المهمة بنجاح');

        // Send task assignment email if employee has email
        const emp = employees.find((e) => e.id === form.assigned_to);
        if (emp?.email && insertedTask) {
          try {
            await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-task-email`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
                apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
              },
              body: JSON.stringify({
                to: emp.email,
                employeeName: emp.full_name,
                taskTitle: form.title,
                taskDescription: form.description || '',
                section: emp.business_sections?.name || '',
                department: emp.departments?.name || '',
                priority: form.priority,
                dueDate: form.due_date,
                status: 'جديدة',
                managerName: userData.user?.user_metadata?.full_name || 'المدير',
                taskId: insertedTask.id,
              }),
            });
          } catch { /* email is best-effort */ }
        }
      }
      onSuccess();
    } catch {
      showToast('تعذر حفظ المهمة', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={true} onClose={onClose} title={task ? 'تعديل مهمة' : 'إنشاء مهمة جديدة'} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label-field">عنوان المهمة *</label>
          <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input-field" />
          {errors.title && <p className="mt-1 text-xs text-red-500">{errors.title}</p>}
        </div>
        <div>
          <label className="label-field">وصف المهمة</label>
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input-field min-h-[80px] resize-y" />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="label-field">الموظف المسؤول *</label>
            <select value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })} className="input-field">
              <option value="">اختر الموظف</option>
              {employees.filter((e) => e.is_active).map((e) => (
                <option key={e.id} value={e.id}>{e.full_name} - {e.business_sections?.name} / {e.departments?.name}</option>
              ))}
            </select>
            {errors.assigned_to && <p className="mt-1 text-xs text-red-500">{errors.assigned_to}</p>}
          </div>
          <div>
            <label className="label-field">الأولوية</label>
            <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as TaskPriority })} className="input-field">
              {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="label-field">تاريخ الاستحقاق *</label>
            <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className="input-field" />
            {errors.due_date && <p className="mt-1 text-xs text-red-500">{errors.due_date}</p>}
          </div>
          {selectedEmployee && (
            <div className="flex items-end gap-2 text-xs">
              <div className="rounded-lg bg-gray-50 px-3 py-2.5 flex-1">
                <span className="text-navy-muted">القسم: </span>
                <span className="font-medium text-navy">{selectedEmployee.business_sections?.name}</span>
                <span className="text-navy-muted mx-2">|</span>
                <span className="text-navy-muted">الإدارة: </span>
                <span className="font-medium text-navy">{selectedEmployee.departments?.name}</span>
              </div>
            </div>
          )}
        </div>
        <div>
          <label className="label-field">ملاحظات المدير</label>
          <textarea value={form.manager_notes} onChange={(e) => setForm({ ...form, manager_notes: e.target.value })} className="input-field min-h-[60px] resize-y" />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">إلغاء</button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? <Spinner size={16} /> : null}
            {task ? 'حفظ التعديلات' : 'إنشاء المهمة'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function TaskDetailsModal({ task, onClose }: { task: Task; onClose: () => void }) {
  const { notes } = useTaskNotes(task.id);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
              <p className="text-xs text-navy-muted mb-1">الموظف المسؤول</p>
              <p className="font-medium text-navy">{task.employees?.full_name || '-'}</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs text-navy-muted mb-1">القسم / الإدارة</p>
              <p className="font-medium text-navy">{task.business_sections?.name} / {task.departments?.name}</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs text-navy-muted mb-1">الأولوية</p>
              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${PRIORITY_STYLES[task.priority]}`}>{task.priority}</span>
            </div>
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs text-navy-muted mb-1">الحالة</p>
              <StatusBadge status={task.status} styles={STATUS_STYLES} />
            </div>
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs text-navy-muted mb-1">تاريخ الاستحقاق</p>
              <p className="font-medium text-navy flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />{formatDate(task.due_date)}</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs text-navy-muted mb-1">التقدم</p>
              <ProgressBar value={task.progress_percentage} size="sm" showLabel />
            </div>
          </div>

          {task.manager_notes && (
            <div className="rounded-lg border border-orange-100 bg-orange-50/50 p-3">
              <p className="text-xs font-medium text-primary mb-1">ملاحظات المدير</p>
              <p className="text-sm text-navy-light">{task.manager_notes}</p>
            </div>
          )}

          {/* Notes */}
          <div>
            <h4 className="text-sm font-bold text-navy mb-2">ملاحظات الموظف ({notes.length})</h4>
            {notes.length === 0 ? (
              <p className="text-sm text-navy-muted py-2">لا توجد ملاحظات</p>
            ) : (
              <div className="space-y-2">
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
            <h4 className="text-sm font-bold text-navy mb-2">سجل تغييرات الحالة</h4>
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
