import { useState, useEffect, useMemo } from 'react';
import { ArrowRight, Mail, Phone, Building, Briefcase, Hash, UserCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/context/ToastContext';
import { Spinner } from '@/components/ui/Spinner';
import { KpiCard } from '@/components/ui/KpiCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { StatusBadge } from '@/components/ui/Badge';
import { formatDate, isOverdue, STATUS_STYLES, PRIORITY_STYLES, getInitials, type TaskStatus } from '@/lib/constants';
import { Users, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import type { Employee, Task } from '@/lib/types';

export function EmployeeDetails({ employeeId, onBack }: { employeeId: string; onBack: () => void }) {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: emp }, { data: tks }] = await Promise.all([
        supabase
          .from('employees')
          .select('*, departments(*), business_sections(*), profiles(*)')
          .eq('id', employeeId)
          .maybeSingle(),
        supabase
          .from('tasks')
          .select('*, departments(*), business_sections(*), profiles(*)')
          .eq('assigned_to', employeeId)
          .order('created_at', { ascending: false }),
      ]);
      setEmployee(emp as Employee | null);
      setTasks((tks as Task[]) || []);
      setLoading(false);
    })();
  }, [employeeId]);

  const stats = useMemo(() => {
    const completed = tasks.filter((t) => t.status === 'مكتملة').length;
    const inProgress = tasks.filter((t) => t.status === 'قيد التنفيذ').length;
    const overdue = tasks.filter((t) => isOverdue(t.due_date, t.status as TaskStatus)).length;
    const rate = tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0;
    return { completed, inProgress, overdue, rate };
  }, [tasks]);

  if (loading) return <div className="flex justify-center py-12"><Spinner size={28} /></div>;
  if (!employee) return <EmptyState icon={<UserCircle className="h-10 w-10" />} title="الموظف غير موجود" />;

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-navy-muted hover:text-navy transition-colors">
        <ArrowRight className="h-4 w-4" />
        العودة لقائمة الموظفين
      </button>

      {/* Profile Card */}
      <div className="card p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-50 text-xl font-bold text-primary flex-shrink-0">
            {getInitials(employee.full_name)}
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-navy">{employee.full_name}</h2>
            <p className="text-sm text-navy-muted">{employee.job_title}</p>
          </div>
          <div>
            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${employee.is_active ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-gray-100 text-gray-500 border border-gray-200'}`}>
              {employee.is_active ? 'نشط' : 'معطل'}
            </span>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex items-center gap-2.5 text-sm">
            <Hash className="h-4 w-4 text-navy-muted" />
            <span className="text-navy-muted">كود الموظف:</span>
            <span className="font-medium text-navy font-mono">{employee.employee_code}</span>
          </div>
          <div className="flex items-center gap-2.5 text-sm">
            <UserCircle className="h-4 w-4 text-navy-muted" />
            <span className="text-navy-muted">اسم المستخدم:</span>
            <span className="font-medium text-navy">{employee.profiles?.username || '-'}</span>
          </div>
          <div className="flex items-center gap-2.5 text-sm">
            <Phone className="h-4 w-4 text-navy-muted" />
            <span className="text-navy-muted">الهاتف:</span>
            <span className="font-medium text-navy">{employee.phone || '-'}</span>
          </div>
          <div className="flex items-center gap-2.5 text-sm">
            <Building className="h-4 w-4 text-navy-muted" />
            <span className="text-navy-muted">القسم:</span>
            <span className="font-medium text-navy">{employee.business_sections?.name || '-'}</span>
          </div>
          <div className="flex items-center gap-2.5 text-sm">
            <Briefcase className="h-4 w-4 text-navy-muted" />
            <span className="text-navy-muted">الإدارة:</span>
            <span className="font-medium text-navy">{employee.departments?.name || '-'}</span>
          </div>
          <div className="flex items-center gap-2.5 text-sm">
            <Mail className="h-4 w-4 text-navy-muted" />
            <span className="text-navy-muted">تاريخ الإنشاء:</span>
            <span className="font-medium text-navy">{formatDate(employee.created_at)}</span>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard label="إجمالي المهام" value={tasks.length} icon={Users} color="gray" />
        <KpiCard label="المهام المكتملة" value={stats.completed} icon={CheckCircle} color="green" />
        <KpiCard label="قيد التنفيذ" value={stats.inProgress} icon={Clock} color="amber" />
        <KpiCard label="المهام المتأخرة" value={stats.overdue} icon={AlertTriangle} color="red" />
      </div>

      {/* Tasks Table */}
      <div className="card overflow-hidden">
        <div className="border-b border-gray-100 px-5 py-3">
          <h3 className="text-sm font-bold text-navy">مهام الموظف ({tasks.length})</h3>
        </div>
        {tasks.length === 0 ? (
          <EmptyState icon={<CheckCircle className="h-10 w-10" />} title="لا توجد مهام" message="لم يتم إسناد أي مهام لهذا الموظف بعد" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-navy-muted">
                <tr>
                  <th className="px-4 py-3 text-right font-medium">المهمة</th>
                  <th className="px-4 py-3 text-right font-medium">الأولوية</th>
                  <th className="px-4 py-3 text-right font-medium">الاستحقاق</th>
                  <th className="px-4 py-3 text-right font-medium">الحالة</th>
                  <th className="px-4 py-3 text-right font-medium">التقدم</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {tasks.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 text-navy font-medium max-w-[240px] truncate">{t.title}</td>
                    <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${PRIORITY_STYLES[t.priority]}`}>{t.priority}</span></td>
                    <td className="px-4 py-3 text-navy-light">{formatDate(t.due_date)}</td>
                    <td className="px-4 py-3"><StatusBadge status={t.status} styles={STATUS_STYLES} /></td>
                    <td className="px-4 py-3 w-28"><ProgressBar value={t.progress_percentage} size="sm" showLabel /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
