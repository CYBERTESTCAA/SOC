import { useState, useRef, useEffect } from 'react';
import { Shield, Bell, Settings, User, LogOut, ChevronDown, X, AlertTriangle, CheckCircle, Clock, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { useSOC } from '@/context/SOCContext';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface HeaderProps {
  onViewChange?: (view: string) => void;
}

interface Notification {
  id: string;
  type: 'critical' | 'warning' | 'info' | 'success';
  title: string;
  message: string;
  time: Date;
  read: boolean;
}

// Les notifications seront gérées via Teams webhooks - pas de fausses données
const mockNotifications: Notification[] = [];

export function Header({ onViewChange }: HeaderProps) {
  const { user, logout } = useAuth();
  const { isConfigured, data } = useSOC();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>(mockNotifications);
  
  const notifRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;
  const criticalIncidents = data.incidents.filter(i => i.severity === 'critical' && i.status === 'active').length;

  const markAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const deleteNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'critical': return <AlertTriangle className="w-4 h-4 text-critical" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-medium" />;
      case 'success': return <CheckCircle className="w-4 h-4 text-low" />;
      default: return <Bell className="w-4 h-4 text-info" />;
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border">
      <div className="flex items-center justify-between h-16 px-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 glow-primary">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight gradient-text">
              SOC Portal
            </h1>
            <p className="text-xs text-muted-foreground">
              Microsoft Cloud Security Center
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* System Status */}
          <div className="hidden md:flex items-center gap-2 mr-4 px-3 py-1.5 rounded-full bg-low/10 border border-low/20">
            <span className="status-indicator low pulse-dot" />
            <span className="text-xs font-medium text-low">
              {isConfigured ? 'Connecté' : 'Non configuré'}
            </span>
          </div>

          {/* Critical Alert Badge */}
          {criticalIncidents > 0 && (
            <button 
              onClick={() => onViewChange?.('incidents')}
              className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-critical/10 border border-critical/20 hover:bg-critical/20 transition-colors"
            >
              <AlertTriangle className="w-4 h-4 text-critical" />
              <span className="text-xs font-medium text-critical">{criticalIncidents} critique(s)</span>
            </button>
          )}

          {/* Notifications */}
          <div className="relative" ref={notifRef}>
            <Button 
              variant="ghost" 
              size="icon" 
              className="relative"
              onClick={() => setShowNotifications(!showNotifications)}
              title="Notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-critical text-[10px] font-bold flex items-center justify-center text-critical-foreground">
                  {unreadCount}
                </span>
              )}
            </Button>

            {/* Notifications Dropdown */}
            {showNotifications && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-background border border-border rounded-lg shadow-xl z-50">
                <div className="flex items-center justify-between p-3 border-b border-border">
                  <h3 className="font-semibold">Notifications</h3>
                  {unreadCount > 0 && (
                    <button 
                      onClick={markAllAsRead}
                      className="text-xs text-primary hover:underline"
                    >
                      Tout marquer comme lu
                    </button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length > 0 ? notifications.map((notif) => (
                    <div
                      key={notif.id}
                      className={cn(
                        'p-3 border-b border-border/50 last:border-0 hover:bg-muted/50 transition-colors',
                        !notif.read && 'bg-primary/5'
                      )}
                    >
                      <div className="flex items-start gap-3">
                        {getNotificationIcon(notif.type)}
                        <div className="flex-1 min-w-0">
                          <p className={cn('text-sm font-medium', !notif.read && 'text-foreground')}>
                            {notif.title}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">{notif.message}</p>
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDistanceToNow(notif.time, { addSuffix: true, locale: fr })}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          {!notif.read && (
                            <button
                              onClick={() => markAsRead(notif.id)}
                              className="p-1 hover:bg-muted rounded"
                              title="Marquer comme lu"
                            >
                              <CheckCircle className="w-4 h-4 text-muted-foreground" />
                            </button>
                          )}
                          <button
                            onClick={() => deleteNotification(notif.id)}
                            className="p-1 hover:bg-muted rounded"
                            title="Supprimer"
                          >
                            <Trash2 className="w-4 h-4 text-muted-foreground" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )) : (
                    <div className="p-6 text-center text-muted-foreground">
                      Aucune notification
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Settings */}
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => onViewChange?.('settings')}
            title="Paramètres"
          >
            <Settings className="w-5 h-5" />
          </Button>

          {/* User Menu */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="ml-2 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                <User className="w-4 h-4 text-primary" />
              </div>
              <div className="hidden md:block text-left">
                <p className="text-sm font-medium">{user?.displayName || 'Admin SOC'}</p>
                <p className="text-xs text-muted-foreground">{user?.email || ''}</p>
              </div>
              <ChevronDown className="w-4 h-4 text-muted-foreground hidden md:block" />
            </button>

            {/* User Dropdown */}
            {showUserMenu && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-background border border-border rounded-lg shadow-xl z-50">
                <div className="p-2">
                  <button
                    onClick={() => { onViewChange?.('profile'); setShowUserMenu(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded hover:bg-muted transition-colors text-sm"
                  >
                    <User className="w-4 h-4" />
                    Mon Profil
                  </button>
                  <button
                    onClick={() => { onViewChange?.('settings'); setShowUserMenu(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded hover:bg-muted transition-colors text-sm"
                  >
                    <Settings className="w-4 h-4" />
                    Paramètres
                  </button>
                  <hr className="my-2 border-border" />
                  <button
                    onClick={logout}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded hover:bg-critical/10 transition-colors text-sm text-critical"
                  >
                    <LogOut className="w-4 h-4" />
                    Déconnexion
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
