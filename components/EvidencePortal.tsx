
import React, { useState, useEffect } from 'react';
import { COLORS } from '../constants';
import { Route, SiteRecord, Evidence } from '../types';

const EvidencePortal: React.FC = () => {
  const [step, setStep] = useState(1); // 1: Route Selection, 2: Site List, 3: Form, 4: Success
  const [activeRoutes, setActiveRoutes] = useState<any[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<any | null>(null);
  const [selectedSite, setSelectedSite] = useState<any | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [evidences, setEvidences] = useState<Evidence[]>([]);
  const [form, setForm] = useState({
    comments: '',
    checklist: {
      limpieza: false,
      nivelado: false,
      materialRecibido: false,
      evidenciaInstalacion: false
    }
  });

  useEffect(() => {
    // Cargar datos sincronizados con RoutePlanner
    const savedRoutes = localStorage.getItem('iamanos_active_routes');
    if (savedRoutes) {
      setActiveRoutes(JSON.parse(savedRoutes));
    }

    const savedEvidences = localStorage.getItem('iamanos_project_evidences'); // Simulado para el portal
    if (savedEvidences) {
      setEvidences(JSON.parse(savedEvidences));
    }
  }, []);

  const handleFinish = () => {
    if (!selectedSite || !selectedRoute) return;
    setIsSubmitting(true);

    setTimeout(() => {
      const newEvidence: Evidence = {
        id: crypto.randomUUID(),
        store_job_id: selectedSite.store_job_id,
        route_id: selectedRoute.id,
        file_type: 'photo',
        category: 'EVIDENCIA_INSTALACION',
        uploaded_by: selectedRoute.driverName,
        uploaded_at: new Date().toISOString(),
        notes: form.comments,
        file_url: `https://picsum.photos/seed/${selectedSite.id}a/600/400`,
        checksum: 'checksum_sim',
        status: 'UPLOADED'
      };

      const updatedEvidences = [newEvidence, ...evidences];
      setEvidences(updatedEvidences);
      localStorage.setItem('iamanos_project_evidences', JSON.stringify(updatedEvidences));

      setIsSubmitting(false);
      setStep(4);
    }, 1500);
  };

  const getSiteStatus = (site: any) => {
    const siteEvs = evidences.filter(e => e.store_job_id === site.store_job_id);
    const hasPhoto = siteEvs.some(e => e.category === 'EVIDENCIA_INSTALACION');
    const hasAck = siteEvs.some(e => e.category === 'ACUSE_RECIBIDO');
    if (hasPhoto && hasAck) return 'COMPLETE';
    if (hasPhoto || hasAck) return 'IN_PROGRESS';
    return 'PENDING';
  };

  if (activeRoutes.length === 0) {
    return (
      <div className="max-w-md mx-auto min-h-[600px] bg-[#030712] border border-white/5 rounded-[4rem] p-12 flex flex-col items-center justify-center text-center shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-b from-blue-600/10 to-transparent"></div>
        <div className="w-24 h-24 bg-white/5 rounded-[2.5rem] flex items-center justify-center mb-10 border border-white/10 shadow-xl">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="1.5"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
        </div>
        <h3 className="text-2xl font-black mb-4 text-white tracking-tight uppercase italic">Sin Misiones Activas</h3>
        <p className="text-slate-500 text-sm leading-relaxed px-4 font-bold uppercase tracking-widest opacity-60">
          Esperando sincronización del <span className="text-blue-400">Control Center</span>.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto min-h-[850px] bg-[#030712] border border-white/10 rounded-[4.5rem] p-8 relative shadow-[0_64px_128px_-32px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden font-sans">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-10 bg-[#000] rounded-b-[2.5rem] z-20 border-x border-b border-white/10"></div>

      <div className="h-full pt-12 flex flex-col flex-1 relative z-10">

        {step === 1 && (
          <div className="space-y-10 animate-in fade-in duration-500">
            <header className="text-center pt-4 flex flex-col items-center">
              <div className="w-24 h-24 bg-white rounded-3xl flex items-center justify-center shadow-2xl p-4 mb-8 border border-white/10">
                <img src="./images/logo.png" alt="Target Logo" className="w-full h-full object-contain scale-150" />
              </div>
              <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.4em] mb-4">Terminal de Campo v2.5</p>
              <div className="flex flex-col items-center gap-4">
                <img src="./images/iamanos.png" alt="iamanos" className="h-10 w-auto" />
                <h2 className="text-4xl font-black text-white tracking-tighter italic uppercase flex items-center gap-2">
                  <img src="./images/logo.png" alt="Logo" className="h-10" />
                </h2>
              </div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-4">SELECCIONA TU MISIÓN</p>
            </header>
            <div className="grid grid-cols-1 gap-4 overflow-y-auto max-h-[600px] pr-2 custom-scrollbar">
              {activeRoutes.map(route => (
                <div
                  key={route.id}
                  onClick={() => { setSelectedRoute(route); setStep(2); }}
                  className="p-8 rounded-[2.5rem] bg-white/[0.03] border border-white/10 hover:border-blue-500/50 transition-all active:scale-95 cursor-pointer group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-6">
                      <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-2xl" style={{ backgroundColor: route.color }}>
                        {route.id}
                      </div>
                      <div>
                        <p className="text-xl font-black text-white tracking-tight italic uppercase">{route.driverName}</p>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{route.stops.length} Tiendas asignadas</p>
                      </div>
                    </div>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-blue-500" strokeWidth="3"><polyline points="9 18 15 12 9 6" /></svg>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 2 && selectedRoute && (
          <div className="space-y-6 flex-1 animate-in slide-in-from-right-4 duration-500">
            <header className="mb-4">
              <button onClick={() => setStep(1)} className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><path d="m15 18-6-6 6-6" /></svg> Cambiar Ruta
              </button>
              <h2 className="text-3xl font-black text-white tracking-tight uppercase italic mb-1">Misión {selectedRoute.id}</h2>
              <p className="text-blue-400 text-[10px] font-black uppercase tracking-[0.3em]">{selectedRoute.driverName}</p>
            </header>

            <div className="space-y-4 pt-4 flex-1 overflow-y-auto custom-scrollbar pr-2 max-h-[550px]">
              {selectedRoute.stops.map((item: any, i: number) => {
                const status = getSiteStatus(item);
                return (
                  <div
                    key={item.store_job_id}
                    onClick={() => { setSelectedSite(item); setStep(3); }}
                    className={`p-6 rounded-[2.5rem] border transition-all active:scale-[0.98] cursor-pointer relative overflow-hidden ${status === 'COMPLETE' ? 'bg-emerald-500/10 border-emerald-500/20' :
                      status === 'IN_PROGRESS' ? 'bg-blue-500/10 border-blue-500/20' :
                        'bg-white/[0.03] border-white/5 hover:border-blue-500/30'
                      }`}
                  >
                    <div className="flex justify-between items-center relative z-10">
                      <div className="flex items-center gap-5">
                        <span className={`w-10 h-10 rounded-xl flex items-center justify-center text-[10px] font-black shadow-xl ${status === 'COMPLETE' ? 'bg-emerald-500 text-white' : 'bg-slate-900 text-slate-500 border border-white/10'
                          }`}>{i + 1}</span>
                        <div className="min-w-0 pr-4">
                          <p className="font-black text-[15px] text-white truncate tracking-tight uppercase italic">{item.name_sitio}</p>
                          <p className="text-[9px] text-slate-500 font-bold truncate tracking-widest mt-1 uppercase">{item.city}, {item.state}</p>
                        </div>
                      </div>
                      {status === 'COMPLETE' ? (
                        <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30 text-emerald-500">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><polyline points="20 6 9 17 4 12" /></svg>
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-blue-600/20 flex items-center justify-center border border-blue-600/30 text-blue-400">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><polyline points="9 18 15 12 9 6" /></svg>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {step === 3 && selectedSite && (
          <div className="flex-1 space-y-8 animate-in slide-in-from-bottom-6 duration-500 pb-10 overflow-y-auto custom-scrollbar pr-2">
            <button
              onClick={() => setStep(2)}
              disabled={isSubmitting}
              className="text-slate-500 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] bg-white/5 px-6 py-4 rounded-full border border-white/10 w-fit hover:text-white transition-all shadow-xl"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><path d="m15 18-6-6 6-6" /></svg> Lista de Tiendas
            </button>

            <div className="px-2">
              <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.4em] mb-4 bg-blue-500/10 w-fit px-4 py-1.5 rounded-lg border border-blue-500/20 italic">Protocolo de Carga iamanos</p>
              <h2 className="text-4xl font-black text-white tracking-tighter leading-none uppercase italic">{selectedSite.name_sitio}</h2>
              <p className="text-[10px] text-slate-500 mt-4 font-bold uppercase tracking-widest bg-white/[0.02] p-5 rounded-3xl border border-white/5 leading-relaxed">
                {selectedSite.direccion_completa}
              </p>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div onClick={() => alert('Abrir Cámara Simulado')} className="bg-white/[0.03] border-2 border-dashed border-white/10 rounded-[3rem] p-10 text-center cursor-pointer hover:bg-blue-600/10 transition-all hover:border-blue-500/50 group active:scale-95">
                  <div className="w-16 h-16 bg-blue-600/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-500/30 group-hover:scale-110 transition-transform shadow-[0_0_30px_rgba(37,99,235,0.2)]">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Instalación</span>
                </div>
                <div onClick={() => alert('Subir PDF Simulado')} className="bg-white/[0.03] border-2 border-dashed border-white/10 rounded-[3rem] p-10 text-center cursor-pointer hover:bg-emerald-600/10 transition-all hover:border-emerald-500/50 group active:scale-95">
                  <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/30 group-hover:scale-110 transition-transform shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Firma Acuse</span>
                </div>
              </div>

              <div className="bg-white/[0.02] rounded-[3rem] p-8 space-y-5 border border-white/5 shadow-inner">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-6">Auditoría Técnica</p>
                {[
                  { id: 'limpieza', label: 'Área de Trabajo Limpia' },
                  { id: 'nivelado', label: 'Material Nivelado / Aplomado' },
                  { id: 'evidenciaInstalacion', label: 'Instalación acorde a Guía' },
                ].map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-6 cursor-pointer group"
                    onClick={() => setForm({ ...form, checklist: { ...form.checklist, [task.id]: !form.checklist[task.id as keyof typeof form.checklist] } })}
                  >
                    <div className={`w-8 h-8 rounded-xl border-2 flex items-center justify-center transition-all ${form.checklist[task.id as keyof typeof form.checklist] ? 'bg-blue-600 border-blue-600 shadow-lg shadow-blue-500/30 rotate-12' : 'border-white/10 bg-slate-950/50 group-hover:border-blue-500/50'}`}>
                      {form.checklist[task.id as keyof typeof form.checklist] && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4"><polyline points="20 6 9 17 4 12" /></svg>}
                    </div>
                    <span className={`text-sm font-black italic tracking-tighter transition-colors ${form.checklist[task.id as keyof typeof form.checklist] ? 'text-white' : 'text-slate-500 group-hover:text-slate-400'}`}>{task.label}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={handleFinish}
                disabled={isSubmitting}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 py-10 rounded-[3rem] font-black text-2xl italic tracking-tighter shadow-[0_32px_64px_-16px_rgba(37,99,235,0.5)] active:scale-95 transition-all uppercase flex items-center justify-center gap-6 text-white mt-8"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                    SINCRONIZANDO IA...
                  </>
                ) : (
                  <>
                    SINC FINALIZAR
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><polyline points="20 6 9 17 4 12" /></svg>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="flex-1 flex flex-col items-center justify-center text-center animate-in zoom-in-95 duration-500 p-8 pt-0">
            <div className="w-40 h-40 bg-emerald-500/10 rounded-[4rem] flex items-center justify-center mb-12 border-4 border-emerald-500/20 shadow-[0_0_100px_rgba(16,185,129,0.2)] relative overflow-hidden group">
              <div className="absolute inset-0 bg-emerald-500/10 rotate-45 scale-150 animate-pulse"></div>
              <svg className="relative z-10" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3.5"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            <h2 className="text-5xl font-black mb-6 text-white tracking-tighter italic uppercase">¡Éxito Total!</h2>
            <p className="text-slate-500 text-lg leading-relaxed mb-16 px-6 font-bold uppercase tracking-widest opacity-60">
              Evidencia cargada e integrada al mapa nacional de <span className="text-blue-400">Target</span>.
            </p>
            <button
              onClick={() => { setStep(2); setForm({ comments: '', checklist: { limpieza: false, nivelado: false, materialRecibido: false, evidenciaInstalacion: false } }); }}
              className="w-full py-10 bg-white/[0.03] hover:bg-white/[0.05] rounded-[3rem] font-black uppercase tracking-[0.4em] text-white border border-white/10 shadow-2xl transition-all hover:scale-105 active:scale-95 italic text-sm"
            >
              ← Volver a la Ruta
            </button>
          </div>
        )}
      </div>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-40 h-1.5 bg-white/20 rounded-full"></div>
    </div>
  );
};

export default EvidencePortal;
