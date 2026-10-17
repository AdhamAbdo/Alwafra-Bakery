import { useState } from 'react';
import { Plus, Edit, Building2, Layers, ChevronLeft, ChevronRight } from 'lucide-react';
import { useBusinessSections, useDepartments } from '@/hooks/useData';
import { useToast } from '@/context/ToastContext';
import { supabase } from '@/lib/supabase';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import type { BusinessSection, Department } from '@/lib/types';

export function OrganizationPage() {
  const { sections, loading: sectionsLoading, refetch: refetchSections } = useBusinessSections();
  const { departments, loading: deptLoading, refetch: refetchDepts } = useDepartments();
  const { showToast } = useToast();

  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [sectionModal, setSectionModal] = useState<{ mode: 'add' | 'edit'; section?: BusinessSection } | null>(null);
  const [deptModal, setDeptModal] = useState<{ mode: 'add' | 'edit'; department?: Department; sectionId?: string } | null>(null);

  const refetch = () => { refetchSections(); refetchDepts(); };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Business Sections */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
            <h3 className="text-sm font-bold text-navy flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              الأقسام الرئيسية
            </h3>
            <button onClick={() => setSectionModal({ mode: 'add' })} className="btn-ghost text-primary">
              <Plus className="h-4 w-4" />
              إضافة
            </button>
          </div>
          {sectionsLoading ? (
            <div className="flex justify-center py-8"><Spinner size={24} /></div>
          ) : sections.length === 0 ? (
            <EmptyState icon={<Building2 className="h-10 w-10" />} title="لا توجد أقسام" />
          ) : (
            <div className="divide-y divide-gray-50">
              {sections.map((s) => {
                const deptCount = departments.filter((d) => d.business_section_id === s.id).length;
                const expanded = expandedSection === s.id;
                return (
                  <div key={s.id}>
                    <div className="flex items-center justify-between px-5 py-3 hover:bg-gray-50/50">
                      <button
                        onClick={() => setExpandedSection(expanded ? null : s.id)}
                        className="flex flex-1 items-center gap-2 text-right"
                      >
                        {expanded ? <ChevronLeft className="h-4 w-4 text-navy-muted" /> : <ChevronRight className="h-4 w-4 text-navy-muted" />}
                        <div>
                          <p className="text-sm font-medium text-navy">{s.name}</p>
                          <p className="text-xs text-navy-muted">{deptCount} إدارة · {s.is_active ? 'نشط' : 'معطل'}</p>
                        </div>
                      </button>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setSectionModal({ mode: 'edit', section: s })} className="rounded p-1.5 text-navy-light hover:bg-gray-100">
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={async () => {
                            await supabase.from('business_sections').update({ is_active: !s.is_active }).eq('id', s.id);
                            showToast(s.is_active ? 'تم تعطيل القسم' : 'تم تفعيل القسم');
                            refetch();
                          }}
                          className={`rounded px-2 py-1 text-xs font-medium ${s.is_active ? 'text-amber-600 hover:bg-amber-50' : 'text-green-600 hover:bg-green-50'}`}
                        >
                          {s.is_active ? 'تعطيل' : 'تفعيل'}
                        </button>
                      </div>
                    </div>
                    {expanded && (
                      <div className="bg-gray-50/50 px-5 py-3 space-y-2 animate-fade-in">
                        {departments.filter((d) => d.business_section_id === s.id).map((d) => (
                          <div key={d.id} className="flex items-center justify-between rounded-lg bg-white border border-gray-100 px-3 py-2">
                            <div className="flex items-center gap-2">
                              <Layers className="h-3.5 w-3.5 text-navy-muted" />
                              <div>
                                <p className="text-sm text-navy">{d.name}</p>
                                {d.description && <p className="text-xs text-navy-muted">{d.description}</p>}
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <button onClick={() => setDeptModal({ mode: 'edit', department: d })} className="rounded p-1 text-navy-light hover:bg-gray-100">
                                <Edit className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={async () => {
                                  await supabase.from('departments').update({ is_active: !d.is_active }).eq('id', d.id);
                                  showToast(d.is_active ? 'تم تعطيل الإدارة' : 'تم تفعيل الإدارة');
                                  refetch();
                                }}
                                className={`rounded px-2 py-0.5 text-xs ${d.is_active ? 'text-amber-600 hover:bg-amber-50' : 'text-green-600 hover:bg-green-50'}`}
                              >
                                {d.is_active ? 'تعطيل' : 'تفعيل'}
                              </button>
                            </div>
                          </div>
                        ))}
                        <button
                          onClick={() => setDeptModal({ mode: 'add', sectionId: s.id })}
                          className="flex w-full items-center gap-2 rounded-lg border border-dashed border-gray-200 px-3 py-2 text-sm text-navy-muted hover:border-primary hover:text-primary transition-colors"
                        >
                          <Plus className="h-4 w-4" />
                          إضافة إدارة
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Departments Overview */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
            <h3 className="text-sm font-bold text-navy flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              جميع الإدارات
            </h3>
          </div>
          {deptLoading ? (
            <div className="flex justify-center py-8"><Spinner size={24} /></div>
          ) : (
            <div className="divide-y divide-gray-50 max-h-[500px] overflow-y-auto">
              {departments.map((d) => (
                <div key={d.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50/50">
                  <div>
                    <p className="text-sm font-medium text-navy">{d.name}</p>
                    <p className="text-xs text-navy-muted">{d.business_sections?.name || '-'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${d.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {d.is_active ? 'نشط' : 'معطل'}
                    </span>
                    <button onClick={() => setDeptModal({ mode: 'edit', department: d })} className="rounded p-1 text-navy-light hover:bg-gray-100">
                      <Edit className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {sectionModal && (
        <SectionFormModal
          mode={sectionModal.mode}
          section={sectionModal.section}
          onClose={() => setSectionModal(null)}
          onSuccess={() => { setSectionModal(null); refetch(); }}
        />
      )}

      {deptModal && (
        <DepartmentFormModal
          mode={deptModal.mode}
          department={deptModal.department}
          sectionId={deptModal.sectionId}
          sections={sections}
          onClose={() => setDeptModal(null)}
          onSuccess={() => { setDeptModal(null); refetch(); }}
        />
      )}
    </div>
  );
}

function SectionFormModal({ mode, section, onClose, onSuccess }: { mode: 'add' | 'edit'; section?: BusinessSection; onClose: () => void; onSuccess: () => void }) {
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(section?.name || '');
  const [description, setDescription] = useState(section?.description || '');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('الاسم مطلوب'); return; }
    setSaving(true);
    try {
      if (mode === 'add') {
        const { error } = await supabase.from('business_sections').insert({ name, description: description || null });
        if (error) throw error;
        showToast('تم إضافة القسم');
      } else if (section) {
        const { error } = await supabase.from('business_sections').update({ name, description: description || null }).eq('id', section.id);
        if (error) throw error;
        showToast('تم تحديث القسم');
      }
      onSuccess();
    } catch {
      showToast('تعذر حفظ القسم', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={true} onClose={onClose} title={mode === 'add' ? 'إضافة قسم' : 'تعديل قسم'} size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label-field">اسم القسم *</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="input-field" />
          {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
        </div>
        <div>
          <label className="label-field">الوصف</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="input-field min-h-[60px] resize-y" />
        </div>
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="btn-secondary">إلغاء</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? <Spinner size={16} /> : null}حفظ</button>
        </div>
      </form>
    </Modal>
  );
}

function DepartmentFormModal({ mode, department, sectionId, sections, onClose, onSuccess }: { mode: 'add' | 'edit'; department?: Department; sectionId?: string; sections: BusinessSection[]; onClose: () => void; onSuccess: () => void }) {
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(department?.name || '');
  const [businessSectionId, setBusinessSectionId] = useState(department?.business_section_id || sectionId || '');
  const [description, setDescription] = useState(department?.description || '');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('الاسم مطلوب'); return; }
    if (!businessSectionId) { setError('القسم مطلوب'); return; }
    setSaving(true);
    try {
      if (mode === 'add') {
        const { error } = await supabase.from('departments').insert({ name, business_section_id: businessSectionId, description: description || null });
        if (error) throw error;
        showToast('تم إضافة الإدارة');
      } else if (department) {
        const { error } = await supabase.from('departments').update({ name, business_section_id: businessSectionId, description: description || null }).eq('id', department.id);
        if (error) throw error;
        showToast('تم تحديث الإدارة');
      }
      onSuccess();
    } catch {
      showToast('تعذر حفظ الإدارة', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={true} onClose={onClose} title={mode === 'add' ? 'إضافة إدارة' : 'تعديل إدارة'} size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label-field">القسم *</label>
          <select value={businessSectionId} onChange={(e) => setBusinessSectionId(e.target.value)} className="input-field">
            <option value="">اختر القسم</option>
            {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label-field">اسم الإدارة *</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="input-field" />
          {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
        </div>
        <div>
          <label className="label-field">الوصف</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="input-field min-h-[60px] resize-y" />
        </div>
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="btn-secondary">إلغاء</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? <Spinner size={16} /> : null}حفظ</button>
        </div>
      </form>
    </Modal>
  );
}
