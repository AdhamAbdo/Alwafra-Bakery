import { type LucideIcon } from 'lucide-react';

interface KpiCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  color?: 'primary' | 'blue' | 'green' | 'amber' | 'red' | 'gray';
  suffix?: string;
}

const colorMap = {
  primary: { bg: 'bg-primary-50', text: 'text-primary' },
  blue: { bg: 'bg-blue-50', text: 'text-blue-600' },
  green: { bg: 'bg-green-50', text: 'text-green-600' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-600' },
  red: { bg: 'bg-red-50', text: 'text-red-600' },
  gray: { bg: 'bg-gray-50', text: 'text-navy-muted' },
};

export function KpiCard({ label, value, icon: Icon, color = 'primary', suffix }: KpiCardProps) {
  const c = colorMap[color];
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-navy-muted">{label}</p>
          <p className="mt-1.5 text-2xl font-bold text-navy tabular-nums">
            {value}
            {suffix && <span className="text-base font-medium text-navy-muted mr-1">{suffix}</span>}
          </p>
        </div>
        <div className={`rounded-xl ${c.bg} p-3`}>
          <Icon className={`h-6 w-6 ${c.text}`} />
        </div>
      </div>
    </div>
  );
}
