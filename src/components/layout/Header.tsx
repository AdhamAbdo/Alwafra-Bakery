import { useState, useRef, useEffect } from 'react';
import { Menu, Bell, CheckCheck, CircleDot, ChevronLeft } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationContext';
import { getInitials, formatDateTime } from '@/lib/constants';

interface HeaderProps {
  title: string;
  onMenuClick: () => void;
  onNavigate?: (page: string, params?: Record<string, string>) => void;
}

export function Header({ title, onMenuClick, onNavigate }: HeaderProps) {
  const { profile } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [showNotif, setShowNotif] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotif(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const isManager = profile?.role === 'manager';

  const handleNotifClick = (notifId: string, taskId: string | null) => {
    markAsRead(notifId);
    setShowNotif(false);
    if (taskId && onNavigate) {
      onNavigate('tasks', { taskId });
    }
  };

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-gray-100 bg-white px-4 py-3 md:px-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="rounded-lg p-2 text-navy-light hover:bg-gray-100 md:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-bold text-navy">{title}</h1>
      </div>

      <div className="flex items-center gap-3">
        {/* Notifications - Manager only */}
        {isManager && (
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setShowNotif((s) => !s)}
              className="relative rounded-lg p-2 text-navy-light hover:bg-gray-100 transition-colors"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {showNotif && (
              <div className="absolute left-0 mt-2 w-96 max-w-[calc(100vw-2rem)] rounded-xl border border-gray-100 bg-white shadow-lg animate-fade-in overflow-hidden">
                <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                  <h3 className="text-sm font-bold text-navy">الإشعارات</h3>
                  {unreadCount > 0 && (
                    <button
                      onClick={() => markAllAsRead()}
                      className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-primary hover:bg-primary-50 transition-colors"
                    >
                      <CheckCheck className="h-3.5 w-3.5" />
                      تحديد الكل كمقروء
                    </button>
                  )}
                </div>

                <div className="max-h-96 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="py-10 text-center">
                      <Bell className="mx-auto h-8 w-8 text-gray-200" />
                      <p className="mt-2 text-sm text-navy-muted">لا توجد إشعارات</p>
                    </div>
                  ) : (
                    notifications.map((notif) => (
                      <button
                        key={notif.id}
                        onClick={() => handleNotifClick(notif.id, notif.task_id)}
                        className={`flex w-full items-start gap-3 border-b border-gray-50 px-4 py-3 text-right transition-colors hover:bg-gray-50/50 ${
                          !notif.is_read ? 'bg-primary-50/30' : ''
                        }`}
                      >
                        <div className={`mt-0.5 flex-shrink-0 ${!notif.is_read ? 'text-primary' : 'text-gray-300'}`}>
                          <CircleDot className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-navy">{notif.title}</p>
                          <p className="mt-0.5 text-xs text-navy-muted line-clamp-2">{notif.message}</p>
                          {notif.old_status && notif.new_status && (
                            <div className="mt-1 flex items-center gap-1.5 text-[11px]">
                              <span className="rounded bg-gray-100 px-1.5 py-0.5 text-navy-muted">{notif.old_status}</span>
                              <ChevronLeft className="h-3 w-3 text-gray-400" />
                              <span className="rounded bg-primary-50 px-1.5 py-0.5 font-medium text-primary">{notif.new_status}</span>
                            </div>
                          )}
                          <p className="mt-1 text-[11px] text-gray-400">{formatDateTime(notif.created_at)}</p>
                        </div>
                        {!notif.is_read && (
                          <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-primary" />
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* User Info */}
        <div className="flex items-center gap-2.5">
          <div className="hidden text-left sm:block">
            <p className="text-sm font-medium text-navy leading-tight">{profile?.full_name}</p>
            <p className="text-[11px] text-navy-muted">
              {profile?.role === 'manager' ? 'مدير' : 'موظف'}
            </p>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-50 text-sm font-bold text-primary">
            {getInitials(profile?.full_name || '')}
          </div>
        </div>
      </div>
    </header>
  );
}
