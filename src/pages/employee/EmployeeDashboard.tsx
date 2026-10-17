import { useState, useEffect, useMemo } from 'react';
import { ClipboardList, CheckCircle, Clock, AlertTriangle, FilePlus, Eye } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { KpiCard } from '@/components/ui/KpiCard';
import { StatusBadge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { isOverdue, formatDate, formatDateTime, STATUS_STYLES, PRIORITY_STYLES, STATUSES, type TaskStatus } from '@/lib/constants';
import type { Task } from '@/lib/types';
import { EmployeeTaskDetails } from './EmployeeTaskDetails';

export function EmployeeDashboard() {
  const { profile } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingTaskId, setViewingTaskId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('tasks')
        .select('*, departments(*), business_sections(*), profiles(*)')
        .order('created_at', { ascending: false });
      setTasks((data as Task[]) || []);
      setLoading(false);
    })();
  }, []);

  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter((t) => t.status === 'مكتملة').length;
    const inProgress = tasks.filter((t) => t.status === 'قيد التنفيذ').length;
    const newTasks = tasks.filter((t) => t.status === 'جديدة').length;
    const overdue = tasks.filter((t) => isOverdue(t.due_date, t.status as TaskStatus)).length;
    return { total, completed, inProgress, newTasks, overdue };
  }, [tasks]);

  const viewingTask = tasks.find((t) => t.id === viewingTaskId);

  if (loading) return <div className="flex justify-center py-12"><Spinner size={28} /></div>;

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-gradient-to-l from-primary-50 to-white border border-primary-100 p-6">
        <h2 className="text-xl font-bold text-navy">مرحباً، {profile?.full_name}</h2>
        <p className="mt-1 text-sm text-navy-muted">إليك نظرة على مهامك الحالية</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <KpiCard label="إجمالي المهام" value={stats.total} icon={ClipboardList} color="gray" />
        <KpiCard label="المهام الجديدة" value={stats.newTasks} icon={FilePlus} color="blue" />
        <KpiCard label="قيد التنفيذ" value={stats.inProgress} icon={Clock} color="amber" />
        <KpiCard label="المكتملة" value={stats.completed} icon={CheckCircle} color="green" />
        <KpiCard label="المتأخرة" value={stats.overdue} icon={AlertTriangle} color="red" />
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-gray-100 px-5 py-3">
          <h3 className="text-sm font-bold text-navy">مهامي ({tasks.length})</h3>
        </div>
        {tasks.length === 0 ? (
          <EmptyState icon={<ClipboardList className="h-10 w-10" />} title="لا توجد مهام" message="لم يتم إسناد أي مهام إليك بعد" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-navy-muted">
                <tr>
                  <th className="px-4 py-3 text-right font-medium">اسم المهمة</th>
                  <th className="px-4 py-3 text-right font-medium">الأولوية</th>
                  <th className="px-4 py-3 text-right font-medium">تاريخ الاستحقاق</th>
                  <th className="px-4 py-3 text-right font-medium">الحالة</th>
                  <th className="px-4 py-3 text-right font-medium">نسبة التقدم</th>
                  <th className="px-4 py-3 text-right font-medium">آخر تحديث</th>
                  <th className="px-4 py-3 text-right font-medium">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {tasks.map((t) => {
                  const overdue = isOverdue(t.due_date, t.status);
                  return (
                    <tr key={t.id} className={`hover:bg-gray-50/50 ${overdue ? 'bg-red-50/30' : ''}`}>
                      <td className="px-4 py-3 text-navy font-medium max-w-[200px] truncate">{t.title}</td>
                      <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${PRIORITY_STYLES[t.priority]}`}>{t.priority}</span></td>
                      <td className="px-4 py-3"><span className={overdue ? 'text-red-600 font-medium' : 'text-navy-light'}>{formatDate(t.due_date)}</span></td>
                      <td className="px-4 py-3"><StatusBadge status={t.status} styles={STATUS_STYLES} /></td>
                      <td className="px-4 py-3 w-28"><ProgressBar value={t.progress_percentage} size="sm" showLabel /></td>
                      <td className="px-4 py-3 text-xs text-navy-muted">{formatDateTime(t.updated_at)}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => setViewingTaskId(t.id)} className="rounded p-1.5 text-blue-600 hover:bg-blue-50 transition-colors" title="عرض"><Eye className="h-4 w-4" /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {viewingTask && (
        <EmployeeTaskDetails
          task={viewingTask}
          onClose={() => setViewingTaskId(null)}
          onUpdate={() => {
            setViewingTaskId(null);
            // refetch
            (async () => {
              const { data } = await supabase.from('tasks').select('*, departments(*), business_sections(*), profiles(*)').order('created_at', { ascending: false });
              setTasks((data as Task[]) || []);
            })();
          }}
        />
      )}
    </div>
  );
}
