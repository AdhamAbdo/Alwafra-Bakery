import { useState, useMemo } from 'react';
import { Plus, Search, Eye, Edit, Trash2, KeyRound, UserCheck, UserX, Users } from 'lucide-react';
import { useEmployees, useBusinessSections, useDepartments } from '@/hooks/useData';
import { useToast } from '@/context/ToastContext';
import { supabase } from '@/lib/supabase';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { isOverdue, formatDate, getInitials, type TaskStatus } from '@/lib/constants';
import type { Employee } from '@/lib/types';

export function EmployeesPage({ onNavigate }: { onNavigate: (page: string, params?: Record<string, string>) => void }) {
  const { employees, loading, refetch } = useEmployees();
  const { sections } = useBusinessSections();
  const { departments } = useDepartments();
  const { showToast } = useToast();

  const [search, setSearch] = useState('');
  const [filterSection, setFilterSection] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [viewingEmployee, setViewingEmployee] = useState<Employee | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);
  const [resetTarget, setResetTarget] = useState<Employee | null>(null);
  const [newPassword, setNewPassword] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [taskCounts, setTaskCounts] = useState<Record<string, { total: number; completed: number; overdue: number }>>({});

  // Fetch task counts for employees
  useMemo(() => {
    if (employees.length === 0) return;
    (async () => {
      const counts: Record<string, { total: number; completed: number; overdue: number }> = {};
      const { data: tasks } = await supabase.from('tasks').select('assigned_to, status, due_date');
      (tasks || []).forEach((t: any) => {
        if (!counts[t.assigned_to]) counts[t.assigned_to] = { total: 0, completed: 0, overdue: 0 };
        counts[t.assigned_to].total++;
        if (t.status === 'مكتملة') counts[t.assigned_to].completed++;
        if (isOverdue(t.due_date, t.status)) counts[t.assigned_to].overdue++;
      });
      setTaskCounts(counts);
    })();
  }, [employees]);

  const filtered = useMemo(() => {
    return employees.filter((e) => {
      if (search) {
        const q = search.toLowerCase();
        if (!e.full_name.toLowerCase().includes(q) && !e.employee_code.toLowerCase().includes(q) && !e.profiles?.username?.toLowerCase().includes(q)) return false;
      }
      if (filterSection && e.business_section_id !== filterSection) return false;
      if (filterDept && e.department_id !== filterDept) return false;
      if (filterStatus === 'active' && !e.is_active) return false;
      if (filterStatus === 'inactive' && e.is_active) return false;
      return true;
    });
  }, [employees, search, filterSection, filterDept, filterStatus]);

  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);
  const totalPages = Math.ceil(filtered.length / pageSize);

  const filteredDepartments = filterSection
    ? departments.filter((d) => d.business_section_id === filterSection)
    : departments;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="card p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-1 gap-2">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="بحث بالاسم أو الكود أو اسم المستخدم..."
                className="input-field pr-10"
              />
            </div>
            <select value={filterSection} onChange={(e) => { setFilterSection(e.target.value); setFilterDept(''); }} className="input-field max-w-[140px]">
              <option value="">كل الأقسام</option>
              {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select value={filterDept} onChange={(e) => setFilterDept(e.target.value)} className="input-field max-w-[140px]">
              <option value="">كل الإدارات</option>
              {filteredDepartments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="input-field max-w-[120px]">
              <option value="">الكل</option>
              <option value="active">نشط</option>
              <option value="inactive">معطل</option>
            </select>
          </div>
          <button onClick={() => setShowAddModal(true)} className="btn-primary">
            <Plus className="h-4 w-4" />
            إضافة موظف
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><Spinner size={28} /></div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<Users className="h-10 w-10" />} title="لا يوجد موظفون" message="ابدأ بإضافة أول موظف للنظام" action={<button onClick={() => setShowAddModal(true)} className="btn-primary"><Plus className="h-4 w-4" />إضافة موظف</button>} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-navy-muted">
                  <tr>
                    <th className="px-4 py-3 text-right font-medium">اسم الموظف</th>
                    <th className="px-4 py-3 text-right font-medium">كود الموظف</th>
                    <th className="px-4 py-3 text-right font-medium">اسم المستخدم</th>
                    <th className="px-4 py-3 text-right font-medium">القسم</th>
                    <th className="px-4 py-3 text-right font-medium">الإدارة</th>
                    <th className="px-4 py-3 text-right font-medium">المهام</th>
                    <th className="px-4 py-3 text-right font-medium">الإنجاز</th>
                    <th className="px-4 py-3 text-right font-medium">الحالة</th>
                    <th className="px-4 py-3 text-right font-medium">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {paginated.map((e) => {
                    const counts = taskCounts[e.id] || { total: 0, completed: 0, overdue: 0 };
                    const rate = counts.total > 0 ? Math.round((counts.completed / counts.total) * 100) : 0;
                    return (
                      <tr key={e.id} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-50 text-xs font-bold text-primary flex-shrink-0">
                              {getInitials(e.full_name)}
                            </div>
                            <div>
                              <p className="font-medium text-navy">{e.full_name}</p>
                              <p className="text-xs text-navy-muted">{e.job_title}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-navy-light font-mono text-xs">{e.employee_code}</td>
                        <td className="px-4 py-3 text-navy-light">{e.profiles?.username || '-'}</td>
                        <td className="px-4 py-3 text-navy-light">{e.business_sections?.name || '-'}</td>
                        <td className="px-4 py-3 text-navy-light">{e.departments?.name || '-'}</td>
                        <td className="px-4 py-3 text-navy-light tabular-nums">{counts.total}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <div className="w-12 h-1.5 rounded-full bg-gray-100"><div className="h-1.5 rounded-full bg-primary" style={{ width: `${rate}%` }} /></div>
                            <span className="text-xs text-navy-muted tabular-nums">{rate}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${e.is_active ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-gray-100 text-gray-500 border border-gray-200'}`}>
                            {e.is_active ? 'نشط' : 'معطل'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button onClick={() => onNavigate('employee-details', { id: e.id })} className="rounded p-1.5 text-blue-600 hover:bg-blue-50 transition-colors" title="عرض"><Eye className="h-4 w-4" /></button>
                            <button onClick={() => setEditingEmployee(e)} className="rounded p-1.5 text-navy-light hover:bg-gray-100 transition-colors" title="تعديل"><Edit className="h-4 w-4" /></button>
                            <button onClick={async () => { await supabase.rpc('set_employee_active_state', { p_employee_id: e.id, p_active: !e.is_active }); refetch(); showToast(e.is_active ? 'تم تعطيل الموظف' : 'تم تفعيل الموظف'); }} className={`rounded p-1.5 transition-colors ${e.is_active ? 'text-amber-600 hover:bg-amber-50' : 'text-green-600 hover:bg-green-50'}`} title={e.is_active ? 'تعطيل' : 'تفعيل'}>{e.is_active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}</button>
                            <button onClick={() => setResetTarget(e)} className="rounded p-1.5 text-orange-600 hover:bg-orange-50 transition-colors" title="إعادة تعيين كلمة المرور"><KeyRound className="h-4 w-4" /></button>
                            <button onClick={() => setDeleteTarget(e)} className="rounded p-1.5 text-red-600 hover:bg-red-50 transition-colors" title="حذف"><Trash2 className="h-4 w-4" /></button>
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
        <EmployeeForm
          sections={sections}
          departments={departments}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => { setShowAddModal(false); refetch(); }}
        />
      )}

      {editingEmployee && (
        <EmployeeForm
          sections={sections}
          departments={departments}
          employee={editingEmployee}
          onClose={() => setEditingEmployee(null)}
          onSuccess={() => { setEditingEmployee(null); refetch(); }}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          open={true}
          onClose={() => setDeleteTarget(null)}
          onConfirm={async () => {
            const { error } = await supabase.from('employees').delete().eq('id', deleteTarget.id);
            if (error) showToast('تعذر حذف الموظف', 'error');
            else { showToast('تم حذف الموظف'); refetch(); }
          }}
          title="حذف الموظف"
          message={`هل أنت متأكد من حذف الموظف "${deleteTarget.full_name}"؟ لا يمكن التراجع عن هذا الإجراء.`}
          confirmText="حذف"
          danger
        />
      )}

      {resetTarget && (
        <ConfirmDialog
          open={true}
          onClose={() => { setResetTarget(null); setNewPassword(null); }}
          onConfirm={async () => {
            const { data, error } = await supabase.rpc('reset_employee_password', { p_employee_id: resetTarget.id });
            if (error) { showToast('تعذر إعادة تعيين كلمة المرور', 'error'); return; }
            setNewPassword(data as string);
            showToast('تم إعادة تعيين كلمة المرور');
          }}
          title="إعادة تعيين كلمة المرور"
          message={`سيتم إنشاء كلمة مرور جديدة للموظف "${resetTarget.full_name}". سيتم عرضها مرة واحدة فقط.`}
          confirmText="إعادة التعيين"
        />
      )}

      {newPassword && resetTarget && (
        <Modal open={true} onClose={() => { setNewPassword(null); setResetTarget(null); }} title="كلمة المرور الجديدة" size="sm">
          <div className="space-y-4">
            <p className="text-sm text-navy-light">تم إنشاء كلمة مرور جديدة للموظف <strong>{resetTarget.full_name}</strong>:</p>
            <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 text-center">
              <p className="text-lg font-mono font-bold text-navy tracking-wider">{newPassword}</p>
            </div>
            <p className="text-xs text-amber-600">يرجى حفظ كلمة المرور ومشاركتها مع الموظف بأمان. لن يتم عرضها مرة أخرى.</p>
            <button onClick={() => { setNewPassword(null); setResetTarget(null); }} className="btn-primary w-full">تم</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

interface EmployeeFormProps {
  sections: any[];
  departments: any[];
  employee?: Employee;
  onClose: () => void;
  onSuccess: () => void;
}

function EmployeeForm({ sections, departments, employee, onClose, onSuccess }: EmployeeFormProps) {
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: employee?.full_name || '',
    username: employee?.profiles?.username || '',
    password: '',
    employee_code: employee?.employee_code || '',
    job_title: employee?.job_title || '',
    business_section_id: employee?.business_section_id || '',
    department_id: employee?.department_id || '',
    phone: employee?.phone || '',
    email: (employee as any)?.email || '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const filteredDepartments = form.business_section_id
    ? departments.filter((d) => d.business_section_id === form.business_section_id)
    : [];

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.full_name.trim()) e.full_name = 'الاسم مطلوب';
    if (!form.employee_code.trim()) e.employee_code = 'كود الموظف مطلوب';
    if (!form.job_title.trim()) e.job_title = 'المسمى الوظيفي مطلوب';
    if (!form.business_section_id) e.business_section_id = 'القسم مطلوب';
    if (!form.department_id) e.department_id = 'الإدارة مطلوبة';
    if (!employee && !form.username.trim()) e.username = 'اسم المستخدم مطلوب';
    if (!employee && form.password.length < 6) e.password = 'كلمة المرور 6 أحرف على الأقل';
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
      if (employee) {
        const { error } = await supabase
          .from('employees')
          .update({
            full_name: form.full_name,
            employee_code: form.employee_code,
            job_title: form.job_title,
            business_section_id: form.business_section_id,
            department_id: form.department_id,
            phone: form.phone || null,
            email: form.email.trim() || null,
          })
          .eq('id', employee.id);
        if (error) throw error;
        if (form.username !== employee.profiles?.username) {
          await supabase.from('profiles').update({ username: form.username }).eq('id', employee.profile_id);
        }
        showToast('تم تحديث بيانات الموظف');
      } else {
        const { error } = await supabase.rpc('create_employee_account', {
          p_full_name: form.full_name,
          p_username: form.username,
          p_password: form.password,
          p_employee_code: form.employee_code,
          p_job_title: form.job_title,
          p_department_id: form.department_id,
          p_business_section_id: form.business_section_id,
          p_phone: form.phone || null,
        });
        if (error) throw error;

        // Save email and send welcome email if provided
        if (form.email.trim()) {
          const { data: newEmp } = await supabase
            .from('employees')
            .select('id')
            .eq('employee_code', form.employee_code)
            .maybeSingle();
          if (newEmp) {
            await supabase.from('employees').update({ email: form.email.trim() }).eq('id', newEmp.id);
          }
          // Send welcome email (fire and forget)
          try {
            await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-welcome-email`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
                apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
              },
              body: JSON.stringify({
                to: form.email.trim(),
                employeeName: form.full_name,
                username: form.username,
                password: form.password,
                employeeId: newEmp?.id,
              }),
            });
          } catch { /* email is best-effort */ }
        }
        showToast('تم إنشاء حساب الموظف بنجاح');
      }
      onSuccess();
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.includes('already') || msg.includes('مستخدم')) {
        showToast('اسم المستخدم أو كود الموظف مستخدم بالفعل', 'error');
      } else {
        showToast('تعذر حفظ بيانات الموظف', 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={true} onClose={onClose} title={employee ? 'تعديل موظف' : 'إضافة موظف جديد'} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="label-field">اسم الموظف *</label>
            <input type="text" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="input-field" />
            {errors.full_name && <p className="mt-1 text-xs text-red-500">{errors.full_name}</p>}
          </div>
          <div>
            <label className="label-field">كود الموظف *</label>
            <input type="text" value={form.employee_code} onChange={(e) => setForm({ ...form, employee_code: e.target.value })} className="input-field" />
            {errors.employee_code && <p className="mt-1 text-xs text-red-500">{errors.employee_code}</p>}
          </div>
          <div>
            <label className="label-field">اسم المستخدم *</label>
            <input type="text" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="input-field" disabled={!!employee} />
            {errors.username && <p className="mt-1 text-xs text-red-500">{errors.username}</p>}
          </div>
          {!employee && (
            <div>
              <label className="label-field">كلمة المرور *</label>
              <input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="input-field" />
              {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password}</p>}
            </div>
          )}
          <div>
            <label className="label-field">المسمى الوظيفي *</label>
            <input type="text" value={form.job_title} onChange={(e) => setForm({ ...form, job_title: e.target.value })} className="input-field" />
            {errors.job_title && <p className="mt-1 text-xs text-red-500">{errors.job_title}</p>}
          </div>
          <div>
            <label className="label-field">رقم الهاتف</label>
            <input type="text" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="label-field">البريد الإلكتروني</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input-field" placeholder="example@email.com" />
          </div>
          <div>
            <label className="label-field">القسم *</label>
            <select
              value={form.business_section_id}
              onChange={(e) => setForm({ ...form, business_section_id: e.target.value, department_id: '' })}
              className="input-field"
            >
              <option value="">اختر القسم</option>
              {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {errors.business_section_id && <p className="mt-1 text-xs text-red-500">{errors.business_section_id}</p>}
          </div>
          <div>
            <label className="label-field">الإدارة *</label>
            <select
              value={form.department_id}
              onChange={(e) => setForm({ ...form, department_id: e.target.value })}
              className="input-field"
              disabled={!form.business_section_id}
            >
              <option value="">اختر الإدارة</option>
              {filteredDepartments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            {errors.department_id && <p className="mt-1 text-xs text-red-500">{errors.department_id}</p>}
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">إلغاء</button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? <Spinner size={16} /> : null}
            {employee ? 'حفظ التعديلات' : 'إنشاء الموظف'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
