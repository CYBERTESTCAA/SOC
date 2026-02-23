import { DeviceCompliance } from '@/types/soc';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CheckCircle2, XCircle, Clock, Lock, LockOpen, AlertTriangle } from 'lucide-react';

interface DeviceComplianceRowProps {
  device: DeviceCompliance;
  className?: string;
}

export function DeviceComplianceRow({ device, className }: DeviceComplianceRowProps) {
  const complianceConfig = {
    compliant: {
      icon: CheckCircle2,
      label: 'Conforme',
      className: 'text-low',
    },
    nonCompliant: {
      icon: XCircle,
      label: 'Non conforme',
      className: 'text-critical',
    },
    pending: {
      icon: Clock,
      label: 'En attente',
      className: 'text-medium',
    },
  };

  const config = complianceConfig[device.complianceState];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        'flex items-center gap-4 p-3 rounded-lg bg-card/50 border border-border/50',
        'hover:bg-muted/30 transition-colors',
        className
      )}
    >
      <div className={cn('flex-shrink-0', config.className)}>
        <Icon className="w-5 h-5" />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-sm truncate">
            {device.deviceName}
          </span>
          <span className={cn('text-xs px-2 py-0.5 rounded-full', {
            'bg-low/20 text-low': device.complianceState === 'compliant',
            'bg-critical/20 text-critical': device.complianceState === 'nonCompliant',
            'bg-medium/20 text-medium': device.complianceState === 'pending',
          })}>
            {config.label}
          </span>
        </div>
        
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>{device.userPrincipalName.split('@')[0]}</span>
          <span>{device.osVersion}</span>
          <span className="flex items-center gap-1">
            {device.encryptionStatus ? (
              <Lock className="w-3 h-3 text-low" />
            ) : (
              <LockOpen className="w-3 h-3 text-critical" />
            )}
            {device.encryptionStatus ? 'Chiffré' : 'Non chiffré'}
          </span>
        </div>
        
        {device.issues && device.issues.length > 0 && (
          <div className="flex items-center gap-1 mt-1 text-xs text-high">
            <AlertTriangle className="w-3 h-3" />
            {device.issues.join(' • ')}
          </div>
        )}
      </div>
      
      <div className="text-right flex-shrink-0">
        <p className="text-xs text-muted-foreground">
          Dernier check-in
        </p>
        <p className="text-xs text-muted-foreground">
          {formatDistanceToNow(device.lastCheckIn, { addSuffix: true, locale: fr })}
        </p>
      </div>
    </div>
  );
}
