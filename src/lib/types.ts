export type UserRole = 'manager' | 'employee';

export type TaskPriority = 'منخفضة' | 'متوسطة' | 'عالية' | 'عاجلة';
export type TaskStatus = 'جديدة' | 'قيد التنفيذ' | 'مكتملة' | 'متأخرة' | 'ملغاة';

export interface Profile {
  id: string;
  full_name: string;
  username: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BusinessSection {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Department {
  id: string;
  name: string;
  business_section_id: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  business_sections?: BusinessSection;
}

export interface Employee {
  id: string;
  profile_id: string;
  employee_code: string;
  full_name: string;
  job_title: string;
  department_id: string;
  business_section_id: string;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  departments?: Department;
  business_sections?: BusinessSection;
  profiles?: Profile;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  assigned_to: string;
  created_by: string;
  department_id: string;
  business_section_id: string;
  priority: TaskPriority;
  status: TaskStatus;
  progress_percentage: number;
  due_date: string;
  completed_at: string | null;
  manager_notes: string | null;
  created_at: string;
  updated_at: string;
  employees?: Employee;
  departments?: Department;
  business_sections?: BusinessSection;
  profiles?: Profile;
}

export interface TaskNote {
  id: string;
  task_id: string;
  employee_id: string;
  note: string;
  created_at: string;
  updated_at: string;
  employees?: Employee;
}

export interface TaskStatusHistory {
  id: string;
  task_id: string;
  old_status: TaskStatus | null;
  new_status: TaskStatus;
  changed_by: string;
  created_at: string;
  profiles?: Profile;
}

export interface EmployeeWithStats extends Employee {
  total_tasks?: number;
  completed_tasks?: number;
  in_progress_tasks?: number;
  overdue_tasks?: number;
  completion_rate?: number;
}

export interface TaskWithDetails extends Task {
  task_notes?: TaskNote[];
  task_status_history?: TaskStatusHistory[];
}
