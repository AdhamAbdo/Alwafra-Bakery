import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { BusinessSection, Department, Employee, Task } from '@/lib/types';

export function useBusinessSections() {
  const [sections, setSections] = useState<BusinessSection[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('business_sections')
      .select('*')
      .order('created_at');
    setSections(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);
  return { sections, loading, refetch: fetch };
}

export function useDepartments(sectionId?: string) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('departments').select('*, business_sections(*)').order('name');
    if (sectionId) query = query.eq('business_section_id', sectionId);
    const { data } = await query;
    setDepartments(data || []);
    setLoading(false);
  }, [sectionId]);

  useEffect(() => { fetch(); }, [fetch]);
  return { departments, loading, refetch: fetch };
}

export function useEmployees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('employees')
      .select('*, departments(*), business_sections(*), profiles(*)')
      .order('full_name');
    setEmployees(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);
  return { employees, loading, refetch: fetch };
}

export function useTasks(filters?: {
  status?: string;
  priority?: string;
  sectionId?: string;
  departmentId?: string;
  employeeId?: string;
  search?: string;
}) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('tasks')
      .select('*, employees(*, departments(*), business_sections(*), profiles(*)), departments(*), business_sections(*), profiles(*)')
      .order('created_at', { ascending: false });

    if (filters?.status) query = query.eq('status', filters.status);
    if (filters?.priority) query = query.eq('priority', filters.priority);
    if (filters?.sectionId) query = query.eq('business_section_id', filters.sectionId);
    if (filters?.departmentId) query = query.eq('department_id', filters.departmentId);
    if (filters?.employeeId) query = query.eq('assigned_to', filters.employeeId);

    const { data } = await query;
    let filtered = data || [];
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.employees?.full_name?.toLowerCase().includes(q)
      );
    }
    setTasks(filtered);
    setLoading(false);
  }, [filters?.status, filters?.priority, filters?.sectionId, filters?.departmentId, filters?.employeeId, filters?.search]);

  useEffect(() => { fetch(); }, [fetch]);
  return { tasks, loading, refetch: fetch };
}

export function useMyTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('tasks')
      .select('*, departments(*), business_sections(*), profiles(*)')
      .order('created_at', { ascending: false });
    setTasks(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);
  return { tasks, loading, refetch: fetch };
}

export function useTaskNotes(taskId: string | null) {
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!taskId) return;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from('task_notes')
        .select('*, employees(*)')
        .eq('task_id', taskId)
        .order('created_at', { ascending: false });
      setNotes(data || []);
      setLoading(false);
    })();
  }, [taskId]);

  return { notes, loading, setNotes };
}
