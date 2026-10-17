import type { TaskPriority, TaskStatus } from './types';
export type { TaskPriority, TaskStatus };

export const PRIORITIES: TaskPriority[] = ['منخفضة', 'متوسطة', 'عالية', 'عاجلة'];
export const STATUSES: TaskStatus[] = ['جديدة', 'قيد التنفيذ', 'مكتملة', 'متأخرة', 'ملغاة'];

export const PRIORITY_STYLES: Record<TaskPriority, string> = {
  'منخفضة': 'bg-gray-100 text-gray-700 border border-gray-200',
  'متوسطة': 'bg-blue-50 text-blue-700 border border-blue-200',
  'عالية': 'bg-orange-50 text-orange-700 border border-orange-200',
  'عاجلة': 'bg-red-50 text-red-700 border border-red-200',
};

export const STATUS_STYLES: Record<TaskStatus, string> = {
  'جديدة': 'bg-blue-50 text-blue-700 border border-blue-200',
  'قيد التنفيذ': 'bg-amber-50 text-amber-700 border border-amber-200',
  'مكتملة': 'bg-green-50 text-green-700 border border-green-200',
  'متأخرة': 'bg-red-50 text-red-700 border border-red-200',
  'ملغاة': 'bg-gray-100 text-gray-500 border border-gray-200',
};

export const PRIORITY_ORDER: Record<TaskPriority, number> = {
  'عاجلة': 4,
  'عالية': 3,
  'متوسطة': 2,
  'منخفضة': 1,
};

export function isOverdue(dueDate: string, status: TaskStatus): boolean {
  if (status === 'مكتملة' || status === 'ملغاة') return false;
  return new Date(dueDate) < new Date(new Date().toDateString());
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  timeZone: 'UTC',
  });
}

export function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString('ar-EG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getInitials(name: string): string {
  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return parts[0]?.substring(0, 2).toUpperCase() || '';
}
