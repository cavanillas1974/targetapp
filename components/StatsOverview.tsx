
import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { COLORS } from '../constants';
import { SavedEvidence, Route } from '../types';

const data = [
  { name: 'Lun', instaladas: 40, proyectadas: 45 },
  { name: 'Mar', instaladas: 30, proyectadas: 35 },
  { name: 'Mie', instaladas: 55, proyectadas: 50 },
  { name: 'Jue', instaladas: 72, proyectadas: 70 },
  { name: 'Vie', instaladas: 48, proyectadas: 60 },
  { name: 'Sab', instaladas: 23, proyectadas: 30 },
];

const StatsOverview: React.FC = () => {
  const [evidences, setEvidences] = useState<SavedEvidence[]>([]);
  const [activeRoutes, setActiveRoutes] = useState<Route[]>([]);
  const [selectedEvidence, setSelectedEvidence] = useState<SavedEvidence | null>(null);

  useEffect(() => {
    const loadData = () => {
      const savedEv = localStorage.getItem('iamanos_project_evidences');
      const savedRoutes = localStorage.getItem('iamanos_active_routes');
      if (savedEv) setEvidences(JSON.parse(savedEv));
      if (savedRoutes) setActiveRoutes(JSON.parse(savedRoutes));
    };

    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  const totalStops = activeRoutes.reduce((acc, r) => acc + r.stops.length, 0);
  const completionRate = totalStops > 0 ? Math.round((evidences.length / totalStops) * 100) : 0;

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Universo de Tiendas', value: totalStops, change: 'Cronograma', color: COLORS.primary },
          { label: 'Ejecución Total', value: `${completionRate}%`, change: 'Cumplimiento', color: COLORS.aqua },
          { label: 'Sincronizados AI', value: evidences.length, change: 'Evidencia Hoy', color: COLORS.lightBlue },
          { label: 'En Operación', value: totalStops - evidences.length, change: 'Pendientes', color: COLORS.accent },
        ].map((stat, i) => (
          <div key={i} className="bg-slate-800/20 p-8 rounded-[2.5rem] border border-slate-700/30 backdrop-blur-xl relative overflow-hidden group hover:bg-slate-800/40 transition-all">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-white/5 to-transparent blur-2xl"></div>
            <div className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">{stat.label}</div>
            <div className="text-5xl font-black mt-4 tracking-tighter" style={{ color: stat.color }}>{stat.value}</div>
            <div className="text-[10px] mt-5 text-slate-400 font-bold flex items-center gap-2 uppercase tracking-widest">
              <span className="text-emerald-400 font-black">↑ {stat.change}</span>
              <span className="opacity-30">•</span>
              Logística Viva
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-slate-800/20 p-10 rounded-[3.5rem] border border-slate-700/30 h-[500px] flex flex-col backdrop-blur-md shadow-2xl">
          <div className="flex justify-between items-center mb-10">
            <div>
              <h3 className="text-2xl font-black text-white tracking-tight">Rendimiento Nacional</h3>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Tendencia de Implementación Semanal</p>
            </div>
            <div className="flex gap-4">
              <div className="flex items-center gap-2 px-4 py-2 bg-slate-900/50 rounded-xl border border-slate-800">
                <div className="w-2 h-2 rounded-full bg-blue-500 shadow-lg shadow-blue-500/50"></div>
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Instaladas</span>
              </div>
            </div>
          </div>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorIns" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="name" stroke="#475569" fontSize={11} fontWeight="900" axisLine={false} tickLine={false} tickMargin={15} />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', padding: '16px' }}
                  itemStyle={{ fontSize: '12px', fontWeight: 'bold', color: '#fff' }}
                  labelStyle={{ fontSize: '10px', color: '#64748b', fontWeight: 'bold', marginBottom: '8px', textTransform: 'uppercase' }}
                />
                <Area type="monotone" dataKey="instaladas" stroke={COLORS.primary} strokeWidth={6} fillOpacity={1} fill="url(#colorIns)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-slate-800/20 p-10 rounded-[3.5rem] border border-slate-700/30 overflow-hidden flex flex-col backdrop-blur-md shadow-2xl">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-black text-white tracking-tight">Última Evidencia</h3>
            <span className="text-[10px] bg-blue-500/10 text-blue-400 px-3 py-1 rounded-lg border border-blue-500/20 font-black">LIVE</span>
          </div>
          <div className="space-y-5 flex-1 overflow-y-auto custom-scrollbar pr-2">
            {evidences.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full opacity-20 py-20">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
                <p className="text-[10px] font-black uppercase tracking-widest mt-6">Esperando datos móviles</p>
              </div>
            ) : evidences.map((ev) => (
              <div
                key={ev.id}
                onClick={() => setSelectedEvidence(ev)}
                className="flex items-center gap-5 p-5 rounded-[2.2rem] bg-slate-900/60 hover:bg-slate-800 transition-all cursor-pointer border border-transparent hover:border-blue-500/30 group shadow-lg"
              >
                <div className="relative shrink-0">
                  <img src={ev.photoAfter} className="w-16 h-16 rounded-[1.5rem] object-cover border border-slate-700 group-hover:scale-105 transition-transform" alt="Evidencia" />
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-4 border-slate-900"></div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-black truncate text-white tracking-tight">{ev.siteName}</p>
                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-1">Téc: {ev.driverName}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[9px] font-black text-emerald-500 bg-emerald-500/5 px-2 py-0.5 rounded border border-emerald-500/10">{ev.timestamp.split(',')[1] || ev.timestamp}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button className="w-full mt-8 py-5 rounded-[1.8rem] bg-slate-900/80 border border-slate-800 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-white hover:bg-slate-800 transition-all shadow-xl">Auditar Todas</button>
        </div>
      </div>

      {/* Modal Premium de Detalle */}
      {selectedEvidence && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-8 backdrop-blur-2xl bg-black/80 animate-in fade-in duration-300">
          <div className="bg-[#0f172a] border border-slate-800 rounded-[4rem] w-full max-w-5xl max-h-[90vh] overflow-hidden shadow-[0_0_100px_rgba(37,99,235,0.15)] flex flex-col">
            <div className="p-10 border-b border-white/5 flex justify-between items-center bg-gradient-to-r from-blue-600/5 via-transparent to-transparent">
              <div>
                <h2 className="text-4xl font-black text-white tracking-tighter leading-none">{selectedEvidence.siteName}</h2>
                <div className="flex items-center gap-4 mt-3">
                  <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Reporte de Operación</span>
                  <span className="opacity-20">•</span>
                  <span className="text-xs text-slate-500 font-bold italic">{selectedEvidence.timestamp}</span>
                </div>
              </div>
              <button onClick={() => setSelectedEvidence(null)} className="p-5 hover:bg-slate-800 rounded-[2rem] text-slate-500 transition-all hover:scale-110 active:scale-95 shadow-2xl">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
                <div className="space-y-10">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-2">Arribo</p>
                      <div className="relative rounded-[2.5rem] overflow-hidden border border-slate-800 shadow-2xl">
                        <img src={selectedEvidence.photoBefore} className="w-full h-64 object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.3em] ml-2">Finalizado</p>
                      <div className="relative rounded-[2.5rem] overflow-hidden border-4 border-blue-600/30 shadow-2xl">
                        <img src={selectedEvidence.photoAfter} className="w-full h-64 object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-blue-900/40 to-transparent"></div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-900/50 p-8 rounded-[3rem] border border-white/5 shadow-inner">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-8 ml-2">Checklist de Calidad</p>
                    <div className="grid grid-cols-2 gap-6">
                      {[
                        { key: 'limpieza', label: 'Área Limpia' },
                        { key: 'nivelado', label: 'Nivelación' },
                        { key: 'evidenciaInstalacion', label: 'Acordado' },
                        { key: 'materialRecibido', label: 'Firma Conforme' },
                      ].map(({ key, label }) => {
                        const val = (selectedEvidence.checklist as any)[key];
                        return (
                          <div key={key} className="flex items-center gap-4 bg-slate-950/40 p-4 rounded-2xl border border-white/5">
                            <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${val ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={val ? '#10b981' : '#ef4444'} strokeWidth="4">
                                {val ? <polyline points="20 6 9 17 4 12" /> : <line x1="18" y1="6" x2="6" y2="18" />}
                              </svg>
                            </div>
                            <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="space-y-12">
                  <div className="space-y-6">
                    <h4 className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em] ml-2">Bitácora Técnica</h4>
                    <div className="bg-slate-900/80 p-8 rounded-[3rem] text-lg font-medium text-slate-300 leading-relaxed min-h-[120px] shadow-inner italic border border-white/5">
                      "{selectedEvidence.comments || 'El técnico no reportó incidencias en este sitio.'}"
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-2">Firma Digital</h4>
                      <div className="bg-white p-6 rounded-[2.5rem] flex items-center justify-center shadow-2xl h-32 border border-slate-200">
                        <img src={selectedEvidence.signature} className="max-h-full opacity-80" />
                      </div>
                    </div>
                    <div className="space-y-4">
                      <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-2">Geolocalización</h4>
                      <div className="bg-slate-900 rounded-[2.5rem] p-6 h-32 flex flex-col items-center justify-center border border-white/5 shadow-inner">
                        <p className="text-xl font-black text-white">{selectedEvidence.gps?.lat.toFixed(4)}</p>
                        <p className="text-xl font-black text-white">{selectedEvidence.gps?.lng.toFixed(4)}</p>
                        <span className="text-[9px] font-black text-blue-500 mt-2 tracking-widest uppercase">Precisión: 5m</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-10 border-t border-white/5 grid grid-cols-2 gap-6">
                    <button className="bg-emerald-600 hover:bg-emerald-500 py-6 rounded-3xl font-black uppercase tracking-[0.2em] text-sm shadow-2xl shadow-emerald-600/20 transition-all hover:scale-[1.03] active:scale-95">
                      Validar Reporte
                    </button>
                    <button className="border border-slate-700 hover:bg-red-500/10 hover:border-red-500/40 py-6 rounded-3xl font-black uppercase tracking-[0.2em] text-[10px] text-slate-500 hover:text-red-500 transition-all">
                      Reportar Incidencia
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StatsOverview;
