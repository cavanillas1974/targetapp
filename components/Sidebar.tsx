
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { COLORS } from '../constants';

interface SidebarProps {
  isOpen: boolean;
  toggle: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, toggle }) => {
  const location = useLocation();

  const menuItems = [
    { path: '/', label: 'MANDO GENERAL', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg> },
    { path: '/planner', label: 'PLAN MAESTRO', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg> },
    { path: '/evidence', label: 'EVIDENCIAS LIVE', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="5" y="2" width="14" height="20" rx="2" ry="2" /><line x1="12" y1="18" x2="12.01" y2="18" /></svg> },
    { path: '/chat', label: 'CENTRO IA', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 8V4H8" /><rect x="8" y="8" width="8" height="12" rx="2" /><path d="M2 14h6" /><path d="M16 14h6" /><path d="M12 20v4" /></svg> },
  ];

  return (
    <aside className={`${isOpen ? 'w-[280px]' : 'w-[100px]'} h-full bg-[#030712] border-r border-white/5 transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] flex flex-col relative z-30`}>
      <div className="p-8 flex items-center justify-between h-24">
        {isOpen ? (
          <div className="flex items-center gap-3 animate-in fade-in slide-in-from-left-2 duration-700">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-lg p-1">
              <img src="/images/iamanos.png" alt="Logo" className="w-full h-full object-contain" />
            </div>
            <img src="/images/iamanos.png" alt="iamanos" className="h-6 w-auto" />
          </div>
        ) : (
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-lg mx-auto p-1">
            <img src="/images/iamanos.png" alt="Logo" className="w-full h-full object-contain" />
          </div>
        )}
      </div>

      <nav className="flex-1 px-4 space-y-4 mt-8">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`group flex items-center gap-4 p-4 rounded-2xl transition-all duration-300 relative ${isActive
                ? 'bg-blue-600 text-white shadow-[0_15px_30px_-10px_rgba(37,99,235,0.4)]'
                : 'text-slate-500 hover:text-white hover:bg-white/5'
                }`}
            >
              <span className={`transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110 group-hover:text-blue-400'}`}>
                {item.icon}
              </span>
              {isOpen && (
                <span className={`font-black text-[13px] uppercase tracking-widest animate-in fade-in slide-in-from-left-2 duration-500`}>
                  {item.label}
                </span>
              )}
              {!isOpen && isActive && (
                <div className="absolute left-0 w-1 h-8 bg-blue-500 rounded-r-full shadow-lg"></div>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-8 mt-auto">
        <div className={`p-4 rounded-2xl bg-slate-900 border border-white/5 flex items-center gap-4 transition-all ${isOpen ? '' : 'justify-center border-none bg-transparent'}`}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center shadow-xl shrink-0">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
          </div>
          {isOpen && (
            <div className="min-w-0 animate-in fade-in duration-700">
              <p className="text-[10px] font-black text-white uppercase tracking-widest truncate">Sistema Activo</p>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter truncate mt-0.5">V2.4.1 Premium</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
