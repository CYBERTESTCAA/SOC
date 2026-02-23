import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { useSOC } from '@/context/SOCContext';
import {
  LayoutDashboard,
  AlertTriangle,
  Users,
  Laptop,
  Mail,
  FileText,
  Settings,
  Shield,
  LogOut,
  Search,
  User,
  Crown,
  Eye,
} from 'lucide-react';

interface SidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
}

export function Sidebar({ activeView, onViewChange }: SidebarProps) {
  const { user, logout, isAdmin, userRole } = useAuth();
  const { data } = useSOC();

  // Navigation items with role-based access
  // adminOnly: true = only visible to admins
  // undefined or false = visible to all authenticated users
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'incidents', label: 'Incidents', icon: AlertTriangle },
    { id: 'signins', label: 'Connexions', icon: Users },
    { id: 'devices', label: 'Appareils', icon: Laptop },
    { id: 'exchange', label: 'Exchange', icon: Mail, adminOnly: true },
    { id: 'investigation', label: 'Investigation', icon: Search, adminOnly: true },
    { id: 'reports', label: 'Rapports', icon: FileText },
    { id: 'settings', label: 'Paramètres', icon: Settings, adminOnly: true },
  ];

  // Filter items based on user role
  const visibleNavItems = navItems.filter(item => !item.adminOnly || isAdmin);

  return (
    <aside className="fixed left-0 top-16 bottom-0 w-64 bg-sidebar border-r border-sidebar-border z-40 hidden lg:block">
      <div className="flex flex-col h-full py-4">
        <nav className="flex-1 px-3 space-y-1">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-lg'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                )}
              >
                <Icon className="w-5 h-5" />
                {item.label}
                {item.adminOnly && (
                  <span title="Admin uniquement">
                    <Crown className="w-3 h-3 ml-auto text-yellow-500" />
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="px-3 pt-4 mt-4 border-t border-sidebar-border space-y-3">
          {/* User Info */}
          <div className="p-3 rounded-lg bg-sidebar-accent/50 border border-sidebar-border">
            <div className="flex items-center gap-2">
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center",
                isAdmin ? "bg-yellow-500/20" : "bg-primary/20"
              )}>
                {isAdmin ? (
                  <Crown className="w-4 h-4 text-yellow-500" />
                ) : (
                  <Eye className="w-4 h-4 text-primary" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user?.displayName || 'Utilisateur'}</p>
                <p className="text-xs text-muted-foreground">
                  {isAdmin ? 'Administrateur' : 'Utilisateur'} SOC
                </p>
              </div>
            </div>
          </div>

          {/* Logout Button */}
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-critical hover:bg-critical/10 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Déconnexion
          </button>
        </div>
      </div>
    </aside>
  );
}
