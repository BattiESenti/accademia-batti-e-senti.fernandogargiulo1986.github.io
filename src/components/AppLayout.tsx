import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface NavItem {
  to: string;
  label: string;
  icon: string;
}

export function AppLayout() {
  const { user, profile, signOut } = useAuth();
  const isAdmin = profile?.ruolo === 'admin';

  const navItems: NavItem[] = [
    { to: '/', label: 'Calendario', icon: '📅' },
    { to: '/notes', label: 'Appuntamenti & Note', icon: '📝' },
    ...(isAdmin ? [
      { to: '/admin', label: 'Amministrazione', icon: '⚙️' },
      { to: '/summary', label: 'Riepilogo Lezioni', icon: '📊' },
    ] : []),
  ];

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `nav-link flex md:flex-row flex-col items-center justify-center md:justify-start gap-0.5 md:gap-2 px-2 md:px-4 py-2 rounded-md text-gray-700 text-[0.7rem] md:text-base flex-1 md:flex-initial ${
      isActive ? 'bg-gray-200 font-bold' : 'hover:bg-gray-200'
    }`;

  return (
    <div className="h-full flex flex-col">
      <header className="bg-white shadow-md flex-shrink-0">
        <nav className="container mx-auto px-4 sm:px-6 py-3 flex justify-between items-center">
          <h1 className="text-lg sm:text-xl font-bold text-indigo-600">Registro Appuntamenti</h1>
          <div className="flex items-center space-x-2 sm:space-x-4">
            <span className="text-xs sm:text-sm text-gray-600 truncate max-w-[100px] sm:max-w-xs">
              {user?.email}
            </span>
            <button
              onClick={() => signOut()}
              className="px-3 py-1 text-sm font-medium text-white bg-red-500 rounded-md hover:bg-red-600"
            >
              Logout
            </button>
          </div>
        </nav>
      </header>

      <main className="container mx-auto px-4 sm:px-6 py-4 flex-grow flex flex-col md:flex-row overflow-hidden pb-20 md:pb-4">
        <aside className="hidden md:block w-full md:w-64 md:mr-8 mb-4 md:mb-0 flex-shrink-0">
          <nav className="space-y-2">
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.to === '/'} className={linkClass}>
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <div className="w-full flex-grow flex flex-col overflow-hidden">
          <Outlet />
        </div>
      </main>

      {/* Bottom tab bar per mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-[0_-2px_6px_rgba(0,0,0,0.06)] z-40 flex">
        {navItems.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.to === '/'} className={linkClass}>
            <span className="text-xl leading-none">{item.icon}</span>
            <span>{item.label === 'Appuntamenti & Note' ? 'Note' : item.label === 'Amministrazione' ? 'Admin' : item.label === 'Riepilogo Lezioni' ? 'Riepilogo' : item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
