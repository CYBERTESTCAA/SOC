import { SignInLog } from '@/types/soc';
import { SeverityBadge } from './SeverityBadge';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { CheckCircle2, XCircle, MapPin, Monitor } from 'lucide-react';

interface SignInLogRowProps {
  log: SignInLog;
  className?: string;
}

export function SignInLogRow({ log, className }: SignInLogRowProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-4 p-3 rounded-lg bg-card/50 border border-border/50',
        'hover:bg-muted/30 transition-colors',
        className
      )}
    >
      <div className="flex-shrink-0">
        {log.status === 'success' ? (
          <CheckCircle2 className="w-5 h-5 text-low" />
        ) : (
          <XCircle className="w-5 h-5 text-critical" />
        )}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-sm truncate">
            {log.userPrincipalName}
          </span>
          <SeverityBadge severity={log.riskLevel} />
        </div>
        
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {log.location}
          </span>
          <span className="flex items-center gap-1">
            <Monitor className="w-3 h-3" />
            {log.appDisplayName}
          </span>
        </div>
      </div>
      
      <div className="text-right flex-shrink-0">
        <p className="font-mono text-xs text-muted-foreground">
          {log.ipAddress}
        </p>
        <p className="text-xs text-muted-foreground">
          {format(log.timestamp, 'HH:mm:ss')}
        </p>
      </div>
    </div>
  );
}
