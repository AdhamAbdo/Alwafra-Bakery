import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { supabase } from '@/lib/supabase';
import { Spinner } from '@/components/ui/Spinner';
import { UserCircle, Building, Shield } from 'lucide-react';

export function SettingsPage() {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [username, setUsername] = useState(profile?.username || '');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) { showToast('الاسم مطلوب', 'error'); return; }
    if (!username.trim()) { showToast('اسم المستخدم مطلوب', 'error'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('profiles').update({ full_name: fullName }).eq('id', profile!.id);
      if (error) throw error;

      if (username.trim() !== profile?.username) {
        const { error: usernameError } = await supabase.rpc('update_own_username', { p_new_username: username.trim() });
        if (usernameError) throw usernameError;
      }
      showToast('تم حفظ الإعدادات');
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.includes('مستخدم بالفعل')) {
        showToast('اسم المستخدم مستخدم بالفعل', 'error');
      } else {
        showToast('تعذر حفظ الإعدادات', 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-4">
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-5">
          <UserCircle className="h-5 w-5 text-primary" />
          <h3 className="text-sm font-bold text-navy">الملف الشخصي</h3>
        </div>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="label-field">الاسم الكامل</label>
            <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="label-field">اسم المستخدم</label>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="label-field">الدور</label>
            <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3.5 py-2.5 text-sm text-navy-muted">
              <Shield className="h-4 w-4" />
              {profile?.role === 'manager' ? 'مدير' : 'موظف'}
            </div>
          </div>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? <Spinner size={16} /> : null}
            حفظ التغييرات
          </button>
        </form>
      </div>

      <div className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Building className="h-5 w-5 text-primary" />
          <h3 className="text-sm font-bold text-navy">معلومات النظام</h3>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between py-2 border-b border-gray-50">
            <span className="text-navy-muted">اسم الشركة</span>
            <span className="font-medium text-navy">الوفرة للمخبوزات</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-50">
            <span className="text-navy-muted">إصدار النظام</span>
            <span className="font-medium text-navy">1.0.0</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-navy-muted">قاعدة البيانات</span>
            <span className="font-medium text-green-600">Supabase - متصل</span>
          </div>
        </div>
      </div>
    </div>
  );
}
