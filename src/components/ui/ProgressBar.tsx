interface ProgressBarProps {
  value: number;
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

export function ProgressBar({ value, showLabel = false, size = 'md' }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));
  const height = size === 'sm' ? 'h-1.5' : 'h-2.5';
  const color = clamped === 100 ? 'bg-green-500' : clamped > 0 ? 'bg-primary' : 'bg-gray-300';

  return (
    <div className="flex items-center gap-2">
      <div className={`flex-1 ${height} rounded-full bg-gray-100 overflow-hidden`}>
        <div
          className={`${height} rounded-full ${color} transition-all duration-300`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs font-medium text-navy-muted tabular-nums w-9 text-left">
          {clamped}%
        </span>
      )}
    </div>
  );
}
