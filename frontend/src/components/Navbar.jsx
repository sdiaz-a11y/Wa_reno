import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  SquaresFour,
  FileText,
  AddressBook,
  CalendarBlank,
  ClockCounterClockwise,
  List,
  X,
  SignOut,
} from 'phosphor-react';
import { useAuth } from '../hooks/useAuth';

const LINKS = [
  { to: '/', label: 'Dashboard', icon: SquaresFour },
  { to: '/plantillas', label: 'Plantillas', icon: FileText },
  { to: '/contactos', label: 'Contactos', icon: AddressBook },
  { to: '/campanas', label: 'Campañas', icon: CalendarBlank },
  { to: '/historial', label: 'Historial', icon: ClockCounterClockwise },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const { logout } = useAuth();

  return (
    <>
      <nav className="fixed left-1/2 top-6 z-40 hidden w-max -translate-x-1/2 items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-2 backdrop-blur-2xl md:flex">
        {LINKS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium transition-all duration-500 ease-fluid ${
                isActive ? 'bg-emerald-glow/90 text-black' : 'text-white/60 hover:bg-white/5 hover:text-white'
              }`
            }
          >
            <Icon size={15} weight="light" />
            {label}
          </NavLink>
        ))}
        <button
          onClick={logout}
          className="ml-1 flex h-8 w-8 items-center justify-center rounded-full text-white/40 transition-colors duration-300 hover:bg-white/5 hover:text-red-400"
          title="Cerrar sesión"
        >
          <SignOut size={15} weight="light" />
        </button>
      </nav>

      <div className="fixed left-1/2 top-6 z-40 flex w-[calc(100%-2rem)] -translate-x-1/2 items-center justify-between rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 backdrop-blur-2xl md:hidden">
        <span className="font-display text-sm font-semibold">Wasend</span>
        <button onClick={() => setOpen(!open)} className="relative h-6 w-6">
          <List size={22} weight="light" className={`absolute inset-0 transition-all duration-500 ease-fluid ${open ? 'rotate-45 opacity-0' : 'rotate-0 opacity-100'}`} />
          <X size={22} weight="light" className={`absolute inset-0 transition-all duration-500 ease-fluid ${open ? 'rotate-0 opacity-100' : '-rotate-45 opacity-0'}`} />
        </button>
      </div>

      <div
        className={`fixed inset-0 z-30 flex flex-col items-center justify-center gap-2 bg-black/85 backdrop-blur-3xl transition-opacity duration-500 ease-fluid md:hidden ${
          open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        {LINKS.map(({ to, label, icon: Icon }, i) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onClick={() => setOpen(false)}
            style={{ transitionDelay: open ? `${100 + i * 60}ms` : '0ms' }}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-full px-6 py-3 text-lg font-medium transition-all duration-700 ease-fluid ${
                open ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'
              } ${isActive ? 'text-emerald-glow' : 'text-white/70'}`
            }
          >
            <Icon size={20} weight="light" />
            {label}
          </NavLink>
        ))}
        <button
          onClick={() => {
            setOpen(false);
            logout();
          }}
          className="mt-4 flex items-center gap-3 rounded-full px-6 py-3 text-sm text-white/40"
        >
          <SignOut size={18} weight="light" />
          Cerrar sesión
        </button>
      </div>
    </>
  );
}
