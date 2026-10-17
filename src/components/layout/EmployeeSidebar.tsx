import { LayoutDashboard, ClipboardList, UserCircle, LogOut, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface EmployeeSidebarProps {
  active: string;
  onNavigate: (page: string) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const navItems = [
  { id: 'dashboard', label: 'الرئيسية', icon: LayoutDashboard },
  { id: 'mytasks', label: 'مهامي', icon: ClipboardList },
  { id: 'account', label: 'حسابي', icon: UserCircle },
];

export function EmployeeSidebar({ active, onNavigate, mobileOpen, onCloseMobile }: EmployeeSidebarProps) {
  const { signOut } = useAuth();

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-navy/30 md:hidden" onClick={onCloseMobile} />
      )}
      <aside
        className={`fixed md:static inset-y-0 right-0 z-40 flex w-64 flex-col border-l border-gray-100 bg-white transition-transform duration-200 ${
          mobileOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'
        }`}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <img src="/OIP.webp" alt="الوفرة" className="h-9 w-9 object-contain" />
            <div>
              <p className="text-sm font-bold text-navy leading-tight">الوفرة للمخبوزات</p>
              <p className="text-[11px] text-navy-muted">مساحة الموظف</p>
            </div>
          </div>
          <button onClick={onCloseMobile} className="md:hidden text-gray-400 hover:text-navy">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onNavigate(item.id);
                  onCloseMobile();
                }}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary-50 text-primary'
                    : 'text-navy-light hover:bg-gray-50'
                }`}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-gray-100 p-3">
          <button
            onClick={signOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut className="h-5 w-5 flex-shrink-0" />
            تسجيل الخروج
          </button>
        </div>
      </aside>
    </>
  );
}
