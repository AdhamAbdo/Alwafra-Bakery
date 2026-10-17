import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { supabase } from '@/lib/supabase';
import { Spinner } from '@/components/ui/Spinner';
import { UserCircle, Mail, Phone, Building, Briefcase, Hash, Shield } from 'lucide-react';

export function EmployeeAccount() {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [employee, setEmployee] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('employees')
        .select('*, departments(*), business_sections(*)')
        .eq('profile_id', profile!.id)
        .maybeSingle();
      setEmployee(data);
      setLoading(false);
    })();
  }, [profile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) { showToast('الاسم مطلوب', 'error'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('profiles').update({ full_name: fullName }).eq('id', profile!.id);
      if (error) throw error;
      showToast('تم حفظ التغييرات');
    } catch {
      showToast('تعذر حفظ التغييرات', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center py-12"><Spinner size={28} /></div>;

  return (
    <div className="max-w-2xl space-y-4">
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-5">
          <UserCircle className="h-5 w-5 text-primary" />
          <h3 className="text-sm font-bold text-navy">معلوماتي</h3>
        </div>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="label-field">الاسم الكامل</label>
            <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="label-field">اسم المستخدم</label>
            <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3.5 py-2.5 text-sm text-navy-muted">
              <Hash className="h-4 w-4" />
              {profile?.username}
            </div>
          </div>
          <div>
            <label className="label-field">الدور</label>
            <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3.5 py-2.5 text-sm text-navy-muted">
              <Shield className="h-4 w-4" />
              موظف
            </div>
          </div>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? <Spinner size={16} /> : null}
            حفظ التغييرات
          </button>
        </form>
      </div>

      {employee && (
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Briefcase className="h-5 w-5 text-primary" />
            <h3 className="text-sm font-bold text-navy">البيانات الوظيفية</h3>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-2 border-b border-gray-50">
              <span className="text-navy-muted flex items-center gap-1.5"><Hash className="h-3.5 w-3.5" /> كود الموظف</span>
              <span className="font-medium text-navy font-mono">{employee.employee_code}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-50">
              <span className="text-navy-muted flex items-center gap-1.5"><Briefcase className="h-3.5 w-3.5" /> المسمى الوظيفي</span>
              <span className="font-medium text-navy">{employee.job_title}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-50">
              <span className="text-navy-muted flex items-center gap-1.5"><Building className="h-3.5 w-3.5" /> القسم</span>
              <span className="font-medium text-navy">{employee.business_sections?.name || '-'}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-50">
              <span className="text-navy-muted flex items-center gap-1.5"><Building className="h-3.5 w-3.5" /> الإدارة</span>
              <span className="font-medium text-navy">{employee.departments?.name || '-'}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-navy-muted flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> الهاتف</span>
              <span className="font-medium text-navy">{employee.phone || '-'}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
