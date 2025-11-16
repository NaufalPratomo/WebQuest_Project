import { ReactNode, useEffect, type ComponentType } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { LayoutDashboard, Users, MapPin, FileText, CheckSquare, BarChart3, Download, LogOut, Menu, Truck } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  type IconType = ComponentType<{ className?: string }>;
  type MenuItem = { path: string; icon: IconType; label: string; roles: Array<'manager'|'foreman'|'employee'> };
  type MenuGroup = { label: string; items: MenuItem[] };

  const topLevel: MenuItem[] = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', roles: ['manager', 'foreman'] },
  ];

  const groups: MenuGroup[] = [
    {
      label: 'Master Data',
      items: [
        { path: '/master/employees', icon: Users, label: 'Data Karyawan', roles: ['manager'] },
        { path: '/master/locations', icon: MapPin, label: 'Data Aresta', roles: ['manager'] },
      ],
    },
    {
      label: 'Transaksi',
      items: [
        { path: '/taksasi', icon: FileText, label: 'Taksasi', roles: ['manager'] },
        { path: '/transactions/attendance', icon: CheckSquare, label: 'Absensi Harian', roles: ['manager', 'foreman'] },
        // Realisasi diletakkan tepat di bawah Taksasi
        { path: '/master/targets', icon: FileText, label: 'Realisasi', roles: ['manager'] },
        // Transaksi Panen dihilangkan sesuai permintaan
        // { path: '/transactions/panen', icon: FileText, label: 'Transaksi Panen', roles: ['manager', 'foreman'] },
        { path: '/transactions/angkut', icon: Truck, label: 'Angkutan', roles: ['manager', 'foreman'] },
      ],
    },
    {
      label: 'Report Panen',
      items: [
        { path: '/reports/taksasi', icon: BarChart3, label: 'Report Taksasi', roles: ['manager', 'foreman'] },
        { path: '/reports/statement', icon: Download, label: 'Report Realisasi', roles: ['manager', 'foreman'] },
        { path: '/reports/trend', icon: BarChart3, label: 'Laporan Tren', roles: ['manager', 'foreman'] },
      ],
    },
  ];

  const others: MenuItem[] = [
    { path: '/verification', icon: CheckSquare, label: 'Verifikasi', roles: ['foreman'] },
    { path: '/recap', icon: BarChart3, label: 'Rekapitulasi', roles: ['manager'] },
  ];

  const canSee = (item: MenuItem) => user && item.roles.includes(user.role);
  const visibleTop = topLevel.filter(canSee);
  const visibleGroups = groups
    .map(g => ({ label: g.label, items: g.items.filter(canSee) }))
    .filter(g => g.items.length > 0);
  const visibleOthers = others.filter(canSee);

  // Sidebar now shows static section labels with items always visible (no dropdowns)

  return (
    <div className="flex h-screen bg-muted/30">
      {/* Sidebar */}
      <aside
        className={cn(
          'bg-card border-r border-border transition-all duration-300',
          sidebarOpen ? 'w-64' : 'w-16'
        )}
      >
        <div className="flex h-16 items-center justify-between px-4 border-b border-border">
          {sidebarOpen && (
            <h1 className="text-lg font-bold text-primary">Kebun Sawit</h1>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>

        <nav className="p-2 space-y-1">
          {/* Top level */}
          {visibleTop.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md transition-colors',
                  isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-secondary-foreground'
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {sidebarOpen && <span>{item.label}</span>}
              </Link>
            );
          })}

          {/* Groups (static headings, not collapsible) */}
          {visibleGroups.map((group) => (
            <div key={group.label} className="mt-3">
              <div className={cn('px-3 py-2 text-muted-foreground')}> 
                {sidebarOpen ? (
                  <span className="text-xs font-semibold uppercase tracking-wide">{group.label}</span>
                ) : (
                  <div className="h-2 w-2 rounded-full bg-muted-foreground" />
                )}
              </div>
              <div className="mt-1 space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname.startsWith(item.path);
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={cn(
                        'ml-6 flex items-center gap-3 px-3 py-2 rounded-md transition-colors',
                        isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-secondary-foreground'
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {sidebarOpen && <span>{item.label}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Others */}
          {visibleOthers.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md transition-colors',
                  isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-secondary-foreground'
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {sidebarOpen && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6">
          <h2 className="text-xl font-semibold text-foreground">
            Sistem Pencatatan Kebun Sawit
          </h2>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium">{user?.name}</p>
              <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
            </div>
            <Button variant="outline" size="icon" onClick={handleLogout}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;