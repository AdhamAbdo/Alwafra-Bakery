import { Loader2 } from 'lucide-react';

interface SpinnerProps {
  size?: number;
  className?: string;
}

export function Spinner({ size = 20, className = '' }: SpinnerProps) {
  return <Loader2 className={`animate-spin text-primary ${className}`} style={{ width: size, height: size }} />;
}

export function FullPageSpinner({ message = 'جاري التحميل...' }: { message?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#F7F8FA]">
      <Spinner size={32} />
      <p className="text-sm text-navy-muted">{message}</p>
    </div>
  );
}
