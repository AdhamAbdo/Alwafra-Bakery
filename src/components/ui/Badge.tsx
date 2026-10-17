interface BadgeProps {
  text: string;
  className?: string;
}

export function Badge({ text, className = '' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}>
      {text}
    </span>
  );
}

interface StatusBadgeProps {
  status: string;
  styles: Record<string, string>;
}

export function StatusBadge({ status, styles }: StatusBadgeProps) {
  const style = styles[status] || 'bg-gray-100 text-gray-700 border border-gray-200';
  return <Badge text={status} className={style} />;
}
