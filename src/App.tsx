import { useState } from 'react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ToastProvider } from '@/context/ToastContext';
import { NotificationProvider } from '@/context/NotificationContext';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { Login } from '@/pages/Login';
import { Header } from '@/components/layout/Header';
import { ManagerSidebar } from '@/components/layout/ManagerSidebar';
import { EmployeeSidebar } from '@/components/layout/EmployeeSidebar';
import { ManagerDashboard } from '@/pages/manager/Dashboard';
import { EmployeesPage } from '@/pages/manager/Employees';
import { EmployeeDetails } from '@/pages/manager/EmployeeDetails';
import { TasksPage } from '@/pages/manager/Tasks';
import { OrganizationPage } from '@/pages/manager/Organization';
import { ReportsPage } from '@/pages/manager/Reports';
import { SettingsPage } from '@/pages/manager/Settings';
import { EmployeeDashboard } from '@/pages/employee/EmployeeDashboard';
import { EmployeeAccount } from '@/pages/employee/EmployeeAccount';

const managerPageTitles: Record<string, string> = {
  dashboard: 'الرئيسية',
  employees: 'الموظفون',
  'employee-details': 'تفاصيل الموظف',
  tasks: 'المهام',
  organization: 'الأقسام والإدارات',
  reports: 'التقارير',
  settings: 'الإعدادات',
};

const employeePageTitles: Record<string, string> = {
  dashboard: 'الرئيسية',
  mytasks: 'مهامي',
  account: 'حسابي',
};

function AppContent() {
  const { session, profile, loading } = useAuth();
  const [page, setPage] = useState('dashboard');
  const [pageParams, setPageParams] = useState<Record<string, string>>({});
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  if (loading) return <FullPageSpinner />;
  if (!session || !profile) return <Login />;

  const navigate = (newPage: string, params?: Record<string, string>) => {
    setPage(newPage);
    setPageParams(params || {});
  };

  const isManager = profile.role === 'manager';
  const titles = isManager ? managerPageTitles : employeePageTitles;
  const title = titles[page] || 'الرئيسية';

  const renderPage = () => {
    if (isManager) {
      switch (page) {
        case 'dashboard': return <ManagerDashboard />;
        case 'employees': return <EmployeesPage onNavigate={navigate} />;
        case 'employee-details': return <EmployeeDetails employeeId={pageParams.id} onBack={() => navigate('employees')} />;
        case 'tasks': return <TasksPage onNavigate={navigate} initialTaskId={pageParams.taskId} />;
        case 'organization': return <OrganizationPage />;
        case 'reports': return <ReportsPage />;
        case 'settings': return <SettingsPage />;
        default: return <ManagerDashboard />;
      }
    } else {
      switch (page) {
        case 'dashboard':
        case 'mytasks':
          return <EmployeeDashboard />;
        case 'account':
          return <EmployeeAccount />;
        default:
          return <EmployeeDashboard />;
      }
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#F7F8FA]">
      {isManager ? (
        <ManagerSidebar active={page} onNavigate={navigate} mobileOpen={mobileSidebarOpen} onCloseMobile={() => setMobileSidebarOpen(false)} />
      ) : (
        <EmployeeSidebar active={page} onNavigate={navigate} mobileOpen={mobileSidebarOpen} onCloseMobile={() => setMobileSidebarOpen(false)} />
      )}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header title={title} onMenuClick={() => setMobileSidebarOpen(true)} onNavigate={navigate} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <NotificationProvider>
          <AppContent />
        </NotificationProvider>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
