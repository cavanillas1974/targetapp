
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import StatsOverview from './components/StatsOverview';
import RoutePlanner from './components/RoutePlanner';
import EvidencePortal from './components/EvidencePortal';
import ChatWindow from './components/ChatWindow';
import { COLORS } from './constants';

const AppContent: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const location = useLocation();

  return (
    <div className="flex h-screen overflow-hidden bg-[#030712] text-slate-100 font-['Inter'] selection:bg-blue-600/30 selection:text-white">
      <Sidebar isOpen={isSidebarOpen} toggle={() => setIsSidebarOpen(!isSidebarOpen)} />

      <main className="flex-1 flex flex-col overflow-hidden relative">
        <header className="h-24 border-b border-white/[0.03] flex items-center justify-between px-10 bg-[#030712]/40 backdrop-blur-3xl sticky top-0 z-20">
          <div className="flex items-center gap-8">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-3 hover:bg-white/5 rounded-xl text-slate-400 hover:text-white transition-all active:scale-95"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
            </button>
            <div>
              <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.4em] mb-1">Centro de Comando</p>
              <h1 className="text-2xl font-black tracking-tighter text-white">
                {location.pathname === '/' && 'MANDO GENERAL'}
                {location.pathname === '/planner' && 'PLAN MAESTRO'}
                {location.pathname === '/evidence' && 'EVIDENCIAS LIVE'}
                {location.pathname === '/chat' && 'INTELIGENCIA LOGÍSTICA'}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-8">
            <div className="hidden lg:flex flex-col items-end">
              <div className="flex items-center gap-3 bg-white/5 border border-white/5 px-4 py-2 rounded-2xl shadow-inner">
                <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-xl shadow-emerald-500/50"></div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">Sync Master Activo</span>
              </div>
            </div>

            <div className="h-10 w-[1px] bg-white/5 mx-2"></div>

            <div className="flex items-center gap-4 group cursor-pointer">
              <div className="text-right">
                <p className="text-[11px] font-black text-white uppercase tracking-tighter">Admin Principal</p>
                <p className="text-[10px] text-slate-500 font-bold italic">Control Maestro</p>
              </div>
              <div className="relative">
                <img src="https://ui-avatars.com/api/?name=IA+Manos&background=2563eb&color=fff" className="w-12 h-12 rounded-2xl border-2 border-slate-800 shadow-2xl group-hover:scale-105 transition-transform" alt="Avatar" />
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-blue-600 rounded-full border-4 border-[#030712]"></div>
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-10 custom-scrollbar relative">
          <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-blue-600/[0.02] to-transparent pointer-events-none"></div>
          <Routes>
            <Route path="/" element={<StatsOverview />} />
            <Route path="/planner" element={<RoutePlanner />} />
            <Route path="/evidence" element={<EvidencePortal />} />
            <Route path="/chat" element={<ChatWindow />} />
          </Routes>
        </div>

        {location.pathname !== '/chat' && (
          <Link to="/chat" className="fixed bottom-10 right-10 w-20 h-20 rounded-[2.5rem] bg-blue-600 shadow-[0_30px_60px_-15px_rgba(37,99,235,0.6)] flex items-center justify-center hover:scale-110 active:scale-90 transition-all cursor-pointer group z-50 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-tr from-blue-700 to-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <svg className="relative z-10" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-4 border-blue-600 animate-pulse"></div>
          </Link>
        )}
      </main>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <HashRouter>
      <AppContent />
    </HashRouter>
  );
};

export default App;
