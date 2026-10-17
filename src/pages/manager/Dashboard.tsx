import { useMemo, useState } from 'react';
import { Users, UserCheck, ClipboardList, CheckCircle, Clock, AlertTriangle, FilePlus, TrendingUp } from 'lucide-react';
import { KpiCard } from '@/components/ui/KpiCard';
import { useEmployees, useTasks, useBusinessSections, useDepartments } from '@/hooks/useData';
import { isOverdue, formatDate, STATUS_STYLES, PRIORITY_STYLES } from '@/lib/constants';
import { StatusBadge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import type { Task, TaskStatus } from '@/lib/types';

export function ManagerDashboard() {
  const { employees } = useEmployees();
  const { sections } = useBusinessSections();
  const { departments } = useDepartments();
  const [filters, setFilters] = useState({
    sectionId: '',
    departmentId: '',
    employeeId: '',
    status: '',
    priority: '',
  });

  const filterParams = Object.fromEntries(
    Object.entries(filters).filter(([, v]) => v)
  );
  const { tasks } = useTasks(filterParams);

  const stats = useMemo(() => {
    const activeEmployees = employees.filter((e) => e.is_active).length;
    const completed = tasks.filter((t) => t.status === 'مكتملة').length;
    const inProgress = tasks.filter((t) => t.status === 'قيد التنفيذ').length;
    const newTasks = tasks.filter((t) => t.status === 'جديدة').length;
    const overdue = tasks.filter((t) => isOverdue(t.due_date, t.status as TaskStatus)).length;
    const completionRate = tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0;

    const byDepartment = departments.map((d) => {
      const dTasks = tasks.filter((t) => t.department_id === d.id);
      return { name: d.name, count: dTasks.length, completed: dTasks.filter((t) => t.status === 'مكتملة').length };
    }).filter((d) => d.count > 0);

    const bySection = sections.map((s) => {
      const sTasks = tasks.filter((t) => t.business_section_id === s.id);
      return { name: s.name, count: sTasks.length };
    }).filter((s) => s.count > 0);

    const byStatus = ['جديدة', 'قيد التنفيذ', 'مكتملة', 'متأخرة', 'ملغاة'].map((s) => ({
      name: s,
      count: tasks.filter((t) => t.status === s || (s === 'متأخرة' && isOverdue(t.due_date, t.status as TaskStatus))).length,
    }));

    const employeePerformance = employees.map((e) => {
      const eTasks = tasks.filter((t) => t.assigned_to === e.id);
      const eCompleted = eTasks.filter((t) => t.status === 'مكتملة').length;
      const eOverdue = eTasks.filter((t) => isOverdue(t.due_date, t.status as TaskStatus)).length;
      return {
        name: e.full_name,
        total: eTasks.length,
        completed: eCompleted,
        overdue: eOverdue,
        rate: eTasks.length > 0 ? Math.round((eCompleted / eTasks.length) * 100) : 0,
      };
    }).filter((e) => e.total > 0).sort((a, b) => b.total - a.total).slice(0, 5);

    return { activeEmployees, completed, inProgress, newTasks, overdue, completionRate, byDepartment, bySection, byStatus, employeePerformance };
  }, [employees, tasks, departments, sections]);

  const maxDeptCount = Math.max(...stats.byDepartment.map((d) => d.count), 1);
  const maxSectionCount = Math.max(...stats.bySection.map((s) => s.count), 1);
  const maxStatusCount = Math.max(...stats.byStatus.map((s) => s.count), 1);

  const filteredDepartments = filters.sectionId
    ? departments.filter((d) => d.business_section_id === filters.sectionId)
    : departments;

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="card p-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <select
            value={filters.sectionId}
            onChange={(e) => setFilters((f) => ({ ...f, sectionId: e.target.value, departmentId: '' }))}
            className="input-field"
          >
            <option value="">كل الأقسام</option>
            {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select
            value={filters.departmentId}
            onChange={(e) => setFilters((f) => ({ ...f, departmentId: e.target.value }))}
            className="input-field"
          >
            <option value="">كل الإدارات</option>
            {filteredDepartments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select
            value={filters.employeeId}
            onChange={(e) => setFilters((f) => ({ ...f, employeeId: e.target.value }))}
            className="input-field"
          >
            <option value="">كل الموظفين</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
          </select>
          <select
            value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
            className="input-field"
          >
            <option value="">كل الحالات</option>
            <option value="جديدة">جديدة</option>
            <option value="قيد التنفيذ">قيد التنفيذ</option>
            <option value="مكتملة">مكتملة</option>
            <option value="متأخرة">متأخرة</option>
            <option value="ملغاة">ملغاة</option>
          </select>
          <select
            value={filters.priority}
            onChange={(e) => setFilters((f) => ({ ...f, priority: e.target.value }))}
            className="input-field"
          >
            <option value="">كل الأولويات</option>
            <option value="منخفضة">منخفضة</option>
            <option value="متوسطة">متوسطة</option>
            <option value="عالية">عالية</option>
            <option value="عاجلة">عاجلة</option>
          </select>
        </div>
        {(filters.sectionId || filters.departmentId || filters.employeeId || filters.status || filters.priority) && (
          <button
            onClick={() => setFilters({ sectionId: '', departmentId: '', employeeId: '', status: '', priority: '' })}
            className="mt-3 text-sm text-primary hover:underline"
          >
            مسح الفلاتر
          </button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard label="إجمالي الموظفين" value={employees.length} icon={Users} color="gray" />
        <KpiCard label="الموظفين النشطين" value={stats.activeEmployees} icon={UserCheck} color="green" />
        <KpiCard label="إجمالي المهام" value={tasks.length} icon={ClipboardList} color="blue" />
        <KpiCard label="المهام المكتملة" value={stats.completed} icon={CheckCircle} color="green" />
        <KpiCard label="قيد التنفيذ" value={stats.inProgress} icon={Clock} color="amber" />
        <KpiCard label="المهام المتأخرة" value={stats.overdue} icon={AlertTriangle} color="red" />
        <KpiCard label="المهام الجديدة" value={stats.newTasks} icon={FilePlus} color="blue" />
        <KpiCard label="نسبة الإنجاز" value={stats.completionRate} icon={TrendingUp} color="primary" suffix="%" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <h3 className="text-sm font-bold text-navy mb-4">توزيع المهام حسب القسم</h3>
          <div className="space-y-3">
            {stats.bySection.length === 0 ? (
              <p className="text-sm text-navy-muted py-4 text-center">لا توجد بيانات</p>
            ) : (
              stats.bySection.map((s) => (
                <div key={s.name}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-navy-light">{s.name}</span>
                    <span className="text-navy-muted">{s.count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100">
                    <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${(s.count / maxSectionCount) * 100}%` }} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-bold text-navy mb-4">توزيع المهام حسب الإدارة</h3>
          <div className="space-y-3">
            {stats.byDepartment.length === 0 ? (
              <p className="text-sm text-navy-muted py-4 text-center">لا توجد بيانات</p>
            ) : (
              stats.byDepartment.map((d) => (
                <div key={d.name}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-navy-light">{d.name}</span>
                    <span className="text-navy-muted">{d.completed}/{d.count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100">
                    <div className="h-2 rounded-full bg-blue-500 transition-all" style={{ width: `${(d.count / maxDeptCount) * 100}%` }} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-bold text-navy mb-4">حالة المهام</h3>
          <div className="space-y-3">
            {stats.byStatus.map((s) => (
              <div key={s.name}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-navy-light">{s.name}</span>
                  <span className="text-navy-muted">{s.count}</span>
                </div>
                <div className="h-2 rounded-full bg-gray-100">
                  <div className="h-2 rounded-full bg-navy transition-all" style={{ width: `${maxStatusCount > 0 ? (s.count / maxStatusCount) * 100 : 0}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-bold text-navy mb-4">أداء الموظفين (أكثر المهام)</h3>
          <div className="space-y-3">
            {stats.employeePerformance.length === 0 ? (
              <p className="text-sm text-navy-muted py-4 text-center">لا توجد بيانات</p>
            ) : (
              stats.employeePerformance.map((e) => (
                <div key={e.name} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-navy-light">{e.name}</span>
                      <span className="text-navy-muted">{e.completed}/{e.total} · {e.rate}%</span>
                    </div>
                    <ProgressBar value={e.rate} size="sm" />
                  </div>
                  {e.overdue > 0 && (
                    <span className="text-xs text-red-600 font-medium">{e.overdue} متأخرة</span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Recent Tasks */}
      <div className="card overflow-hidden">
        <div className="border-b border-gray-100 px-5 py-3">
          <h3 className="text-sm font-bold text-navy">أحدث المهام</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-navy-muted">
              <tr>
                <th className="px-4 py-3 text-right font-medium">المهمة</th>
                <th className="px-4 py-3 text-right font-medium">الموظف</th>
                <th className="px-4 py-3 text-right font-medium">الأولوية</th>
                <th className="px-4 py-3 text-right font-medium">الاستحقاق</th>
                <th className="px-4 py-3 text-right font-medium">الحالة</th>
                <th className="px-4 py-3 text-right font-medium">التقدم</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {tasks.slice(0, 8).map((t) => (
                <tr key={t.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 text-navy font-medium max-w-[200px] truncate">{t.title}</td>
                  <td className="px-4 py-3 text-navy-light">{t.employees?.full_name || '-'}</td>
                  <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${PRIORITY_STYLES[t.priority]}`}>{t.priority}</span></td>
                  <td className="px-4 py-3 text-navy-light">{formatDate(t.due_date)}</td>
                  <td className="px-4 py-3"><StatusBadge status={t.status} styles={STATUS_STYLES} /></td>
                  <td className="px-4 py-3 w-28"><ProgressBar value={t.progress_percentage} size="sm" showLabel /></td>
                </tr>
              ))}
              {tasks.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-navy-muted">لا توجد مهام</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
