import { useState, useMemo } from 'react';
import { FileBarChart, Download, FileText, FileSpreadsheet, Filter } from 'lucide-react';
import { useEmployees, useTasks, useBusinessSections, useDepartments } from '@/hooks/useData';
import { useToast } from '@/context/ToastContext';
import { KpiCard } from '@/components/ui/KpiCard';
import { StatusBadge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { isOverdue, formatDate, formatDateTime, STATUS_STYLES, PRIORITY_STYLES, type TaskStatus } from '@/lib/constants';
import { Users, CheckCircle, Clock, AlertTriangle, TrendingUp } from 'lucide-react';

type ReportType = 'employees' | 'departments' | 'sections' | 'tasks' | 'completed' | 'overdue' | 'productivity' | 'period';

const reportTypes: { id: ReportType; label: string }[] = [
  { id: 'employees', label: 'تقرير أداء الموظفين' },
  { id: 'departments', label: 'تقرير أداء الإدارات' },
  { id: 'sections', label: 'تقرير أداء الأقسام' },
  { id: 'tasks', label: 'تقرير المهام' },
  { id: 'completed', label: 'تقرير المهام المكتملة' },
  { id: 'overdue', label: 'تقرير المهام المتأخرة' },
  { id: 'productivity', label: 'تقرير الإنتاجية' },
  { id: 'period', label: 'تقرير الإنجاز خلال فترة زمنية' },
];

export function ReportsPage() {
  const { showToast } = useToast();
  const { sections } = useBusinessSections();
  const { departments } = useDepartments();
  const { employees } = useEmployees();
  const [reportType, setReportType] = useState<ReportType>('employees');
  const [filters, setFilters] = useState({
    sectionId: '',
    departmentId: '',
    employeeId: '',
    status: '',
    priority: '',
    dateFrom: '',
    dateTo: '',
  });

  const filteredDepartments = filters.sectionId
    ? departments.filter((d) => d.business_section_id === filters.sectionId)
    : departments;

  const { tasks } = useTasks({
    sectionId: filters.sectionId || undefined,
    departmentId: filters.departmentId || undefined,
    employeeId: filters.employeeId || undefined,
    status: filters.status || undefined,
    priority: filters.priority || undefined,
  });

  const reportData = useMemo(() => {
    let filtered = [...tasks];
    if (filters.dateFrom) filtered = filtered.filter((t) => new Date(t.created_at) >= new Date(filters.dateFrom));
    if (filters.dateTo) filtered = filtered.filter((t) => new Date(t.created_at) <= new Date(filters.dateTo + 'T23:59:59'));

    switch (reportType) {
      case 'completed':
        return filtered.filter((t) => t.status === 'مكتملة');
      case 'overdue':
        return filtered.filter((t) => isOverdue(t.due_date, t.status as TaskStatus));
      default:
        return filtered;
    }
  }, [tasks, reportType, filters]);

  const summary = useMemo(() => {
    const completed = reportData.filter((t) => t.status === 'مكتملة').length;
    const inProgress = reportData.filter((t) => t.status === 'قيد التنفيذ').length;
    const overdue = reportData.filter((t) => isOverdue(t.due_date, t.status as TaskStatus)).length;
    const rate = reportData.length > 0 ? Math.round((completed / reportData.length) * 100) : 0;
    return { total: reportData.length, completed, inProgress, overdue, rate };
  }, [reportData]);

  const exportCSV = () => {
    const headers = ['العنوان', 'الموظف', 'القسم', 'الإدارة', 'الأولوية', 'الحالة', 'التقدم', 'تاريخ الاستحقاق', 'تاريخ الإنشاء'];
    const rows = reportData.map((t) => [
      t.title,
      t.employees?.full_name || '-',
      t.business_sections?.name || '-',
      t.departments?.name || '-',
      t.priority,
      t.status,
      `${t.progress_percentage}%`,
      formatDate(t.due_date),
      formatDateTime(t.created_at),
    ]);
    const csv = '\uFEFF' + [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `alwafra-report-${reportType}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('تم تصدير التقرير بصيغة CSV');
  };

  const exportExcel = () => {
    const headers = ['العنوان', 'الموظف', 'القسم', 'الإدارة', 'الأولوية', 'الحالة', 'التقدم', 'تاريخ الاستحقاق', 'تاريخ الإنشاء'];
    const rows = reportData.map((t) => [
      t.title, t.employees?.full_name || '-', t.business_sections?.name || '-', t.departments?.name || '-',
      t.priority, t.status, `${t.progress_percentage}%`, formatDate(t.due_date), formatDateTime(t.created_at),
    ]);
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" dir="rtl"><head><meta charset="UTF-8"></head><body><table border="1"><tr>${headers.map((h) => `<th style="background:#FA593C;color:white;padding:8px">${h}</th>`).join('')}</tr>${rows.map((r) => `<tr>${r.map((c) => `<td style="padding:6px;border:1px solid #ddd">${c}</td>`).join('')}</tr>`).join('')}</table></body></html>`;
    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `alwafra-report-${reportType}-${new Date().toISOString().split('T')[0]}.xls`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('تم تصدير التقرير بصيغة Excel');
  };

  const exportPDF = () => {
    const printWin = window.open('', '_blank');
    if (!printWin) { showToast('تعذر فتح نافذة الطباعة', 'error'); return; }
    const headers = ['العنوان', 'الموظف', 'القسم', 'الأولوية', 'الحالة', 'التقدم', 'الاستحقاق'];
    const rows = reportData.map((t) => `
      <tr>
        <td style="padding:6px;border:1px solid #ddd">${t.title}</td>
        <td style="padding:6px;border:1px solid #ddd">${t.employees?.full_name || '-'}</td>
        <td style="padding:6px;border:1px solid #ddd">${t.business_sections?.name || '-'}</td>
        <td style="padding:6px;border:1px solid #ddd">${t.priority}</td>
        <td style="padding:6px;border:1px solid #ddd">${t.status}</td>
        <td style="padding:6px;border:1px solid #ddd">${t.progress_percentage}%</td>
        <td style="padding:6px;border:1px solid #ddd">${formatDate(t.due_date)}</td>
      </tr>`).join('');

    printWin.document.write(`
      <html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>تقرير - الوفرة للمخبوزات</title>
      <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap" rel="stylesheet">
      <style>*{font-family:'Tajawal',sans-serif}body{padding:40px;color:#383C47}.header{display:flex;align-items:center;gap:16px;border-bottom:2px solid #FA593C;padding-bottom:16px;margin-bottom:24px}.header img{width:60px;height:60px}.header h1{font-size:20px;margin:0}.header p{font-size:13px;color:#888;margin:4px 0 0}.summary{display:flex;gap:16px;margin-bottom:24px}.summary div{flex:1;background:#f7f8fa;border-radius:8px;padding:12px;text-align:center}.summary .label{font-size:12px;color:#888}.summary .value{font-size:20px;font-weight:bold;color:#383C47}table{width:100%;border-collapse:collapse}th{background:#FA593C;color:white;padding:8px;font-size:13px}td{padding:6px;border:1px solid #ddd;font-size:13px}.footer{margin-top:24px;text-align:center;font-size:11px;color:#aaa}</style>
      </head><body>
        <div class="header"><img src="${window.location.origin}/OIP.webp" alt="logo"><div><h1>الوفرة للمخبوزات</h1><p>${reportTypes.find((r) => r.id === reportType)?.label}</p><p>تاريخ التقرير: ${formatDateTime(new Date().toISOString())}</p></div></div>
        <div class="summary">
          <div><div class="label">إجمالي المهام</div><div class="value">${summary.total}</div></div>
          <div><div class="label">المكتملة</div><div class="value">${summary.completed}</div></div>
          <div><div class="label">قيد التنفيذ</div><div class="value">${summary.inProgress}</div></div>
          <div><div class="label">المتأخرة</div><div class="value">${summary.overdue}</div></div>
          <div><div class="label">نسبة الإنجاز</div><div class="value">${summary.rate}%</div></div>
        </div>
        <table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>
        <div class="footer">© ${new Date().getFullYear()} الوفرة للمخبوزات - تقرير تم إنشاؤه بواسطة نظام إدارة الموظفين والمهام</div>
      </body></html>`);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => printWin.print(), 500);
    showToast('تم تصدير التقرير بصيغة PDF');
  };

  return (
    <div className="space-y-4">
      {/* Report Type Selection */}
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-3">
          <FileBarChart className="h-5 w-5 text-primary" />
          <h3 className="text-sm font-bold text-navy">نوع التقرير</h3>
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {reportTypes.map((r) => (
            <button
              key={r.id}
              onClick={() => setReportType(r.id)}
              className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors text-right ${
                reportType === r.id ? 'border-primary bg-primary-50 text-primary' : 'border-gray-200 text-navy-light hover:bg-gray-50'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-4 w-4 text-navy-muted" />
          <h3 className="text-sm font-medium text-navy">الفلاتر</h3>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <select value={filters.sectionId} onChange={(e) => setFilters({ ...filters, sectionId: e.target.value, departmentId: '' })} className="input-field">
            <option value="">كل الأقسام</option>
            {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={filters.departmentId} onChange={(e) => setFilters({ ...filters, departmentId: e.target.value })} className="input-field">
            <option value="">كل الإدارات</option>
            {filteredDepartments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select value={filters.employeeId} onChange={(e) => setFilters({ ...filters, employeeId: e.target.value })} className="input-field">
            <option value="">كل الموظفين</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
          </select>
          <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className="input-field">
            <option value="">كل الحالات</option>
            <option value="جديدة">جديدة</option>
            <option value="قيد التنفيذ">قيد التنفيذ</option>
            <option value="مكتملة">مكتملة</option>
            <option value="متأخرة">متأخرة</option>
            <option value="ملغاة">ملغاة</option>
          </select>
          <select value={filters.priority} onChange={(e) => setFilters({ ...filters, priority: e.target.value })} className="input-field">
            <option value="">كل الأولويات</option>
            <option value="منخفضة">منخفضة</option>
            <option value="متوسطة">متوسطة</option>
            <option value="عالية">عالية</option>
            <option value="عاجلة">عاجلة</option>
          </select>
          <input type="date" value={filters.dateFrom} onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })} className="input-field" title="من تاريخ" />
          <input type="date" value={filters.dateTo} onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })} className="input-field" title="إلى تاريخ" />
          <button onClick={() => setFilters({ sectionId: '', departmentId: '', employeeId: '', status: '', priority: '', dateFrom: '', dateTo: '' })} className="btn-secondary">مسح الفلاتر</button>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <KpiCard label="إجمالي المهام" value={summary.total} icon={FileBarChart} color="gray" />
        <KpiCard label="المكتملة" value={summary.completed} icon={CheckCircle} color="green" />
        <KpiCard label="قيد التنفيذ" value={summary.inProgress} icon={Clock} color="amber" />
        <KpiCard label="المتأخرة" value={summary.overdue} icon={AlertTriangle} color="red" />
        <KpiCard label="نسبة الإنجاز" value={summary.rate} icon={TrendingUp} color="primary" suffix="%" />
      </div>

      {/* Export Buttons */}
      <div className="flex gap-2">
        <button onClick={exportCSV} className="btn-secondary"><Download className="h-4 w-4" />CSV</button>
        <button onClick={exportExcel} className="btn-secondary"><FileSpreadsheet className="h-4 w-4" />Excel</button>
        <button onClick={exportPDF} className="btn-secondary"><FileText className="h-4 w-4" />PDF</button>
      </div>

      {/* Report Table */}
      <div className="card overflow-hidden">
        <div className="border-b border-gray-100 px-5 py-3">
          <h3 className="text-sm font-bold text-navy">{reportTypes.find((r) => r.id === reportType)?.label}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-navy-muted">
              <tr>
                <th className="px-4 py-3 text-right font-medium">المهمة</th>
                <th className="px-4 py-3 text-right font-medium">الموظف</th>
                <th className="px-4 py-3 text-right font-medium">القسم</th>
                <th className="px-4 py-3 text-right font-medium">الإدارة</th>
                <th className="px-4 py-3 text-right font-medium">الأولوية</th>
                <th className="px-4 py-3 text-right font-medium">الحالة</th>
                <th className="px-4 py-3 text-right font-medium">التقدم</th>
                <th className="px-4 py-3 text-right font-medium">الاستحقاق</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {reportData.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-navy-muted">لا توجد بيانات في هذا التقرير</td></tr>
              ) : (
                reportData.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 text-navy font-medium max-w-[200px] truncate">{t.title}</td>
                    <td className="px-4 py-3 text-navy-light">{t.employees?.full_name || '-'}</td>
                    <td className="px-4 py-3 text-navy-light">{t.business_sections?.name || '-'}</td>
                    <td className="px-4 py-3 text-navy-light">{t.departments?.name || '-'}</td>
                    <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${PRIORITY_STYLES[t.priority]}`}>{t.priority}</span></td>
                    <td className="px-4 py-3"><StatusBadge status={t.status} styles={STATUS_STYLES} /></td>
                    <td className="px-4 py-3 w-24"><ProgressBar value={t.progress_percentage} size="sm" showLabel /></td>
                    <td className="px-4 py-3 text-navy-light">{formatDate(t.due_date)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
