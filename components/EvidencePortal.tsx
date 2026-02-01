
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

  // Estado sin rutas activas
  if (activeRoutes.length === 0) {
    return (
      <div className="min-h-screen bg-[#030712] flex flex-col items-center justify-center text-center p-6 safe-area-inset">
        <div className="w-20 h-20 sm:w-24 sm:h-24 bg-white/5 rounded-3xl flex items-center justify-center mb-8 border border-white/10 shadow-xl">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="1.5"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
        </div>
        <h3 className="text-xl sm:text-2xl font-black mb-3 text-white tracking-tight uppercase italic">Sin Misiones Activas</h3>
        <p className="text-slate-500 text-xs sm:text-sm leading-relaxed px-4 font-bold uppercase tracking-widest opacity-60">
          Esperando sincronización del <span className="text-blue-400">Control Center</span>.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#030712] flex flex-col safe-area-inset">
      {/* Header fijo */}
      <header className="sticky top-0 z-50 bg-[#030712]/95 backdrop-blur-xl border-b border-white/5 px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div className="flex items-center gap-3">
            <img src="./images/logo.png" alt="Target Logo" className="h-8 sm:h-10 w-auto" />
            <div>
              <p className="text-[9px] sm:text-[10px] font-black text-blue-500 uppercase tracking-wider">Terminal Campo</p>
              <p className="text-[8px] text-slate-600 uppercase tracking-widest">v2.5 • iamanos</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-[9px] font-bold text-emerald-500 uppercase">En línea</span>
          </div>
        </div>
      </header>

      {/* Contenido principal */}
      <main className="flex-1 px-4 py-6 sm:px-6 overflow-y-auto">
        <div className="max-w-lg mx-auto">

          {/* STEP 1: Selección de Ruta */}
          {step === 1 && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="text-center mb-6">
                <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight italic uppercase">Selecciona tu Misión</h2>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-2">{activeRoutes.length} rutas asignadas</p>
              </div>

              <div className="space-y-3">
                {activeRoutes.map(route => (
                  <div
                    key={route.id}
                    onClick={() => { setSelectedRoute(route); setStep(2); }}
                    className="p-5 sm:p-6 rounded-2xl bg-white/[0.03] border border-white/10 active:scale-[0.98] transition-transform cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center text-white font-black text-lg shadow-lg" style={{ backgroundColor: route.color }}>
                          {route.id}
                        </div>
                        <div>
                          <p className="text-base sm:text-lg font-black text-white tracking-tight italic uppercase">{route.driverName}</p>
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{route.stops.length} Tiendas • {Math.round(route.totalKm || 0)} km</p>
                        </div>
                      </div>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="3"><polyline points="9 18 15 12 9 6" /></svg>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 2: Lista de Tiendas */}
          {step === 2 && selectedRoute && (
            <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
              <button
                onClick={() => setStep(1)}
                className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 active:text-white transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m15 18-6-6 6-6" /></svg>
                Cambiar Ruta
              </button>

              <div className="flex items-center gap-4 p-4 bg-white/[0.02] rounded-2xl border border-white/5">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-black text-lg shadow-lg" style={{ backgroundColor: selectedRoute.color }}>
                  {selectedRoute.id}
                </div>
                <div>
                  <h2 className="text-xl font-black text-white tracking-tight uppercase italic">{selectedRoute.driverName}</h2>
                  <p className="text-blue-400 text-[10px] font-black uppercase tracking-wider">{selectedRoute.stops.length} tiendas pendientes</p>
                </div>
              </div>

              <div className="space-y-2">
                {selectedRoute.stops.map((item: any, i: number) => {
                  const status = getSiteStatus(item);
                  return (
                    <div
                      key={item.store_job_id}
                      onClick={() => { setSelectedSite(item); setStep(3); }}
                      className={`p-4 rounded-xl border transition-transform active:scale-[0.98] cursor-pointer ${status === 'COMPLETE' ? 'bg-emerald-500/10 border-emerald-500/20' :
                          status === 'IN_PROGRESS' ? 'bg-blue-500/10 border-blue-500/20' :
                            'bg-white/[0.02] border-white/5'
                        }`}
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0 ${status === 'COMPLETE' ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-400 border border-white/10'
                            }`}>{i + 1}</span>
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-sm text-white truncate">{item.name_sitio}</p>
                            <p className="text-[9px] text-slate-500 font-bold truncate uppercase">{item.city}, {item.state}</p>
                          </div>
                        </div>
                        {status === 'COMPLETE' ? (
                          <div className="w-7 h-7 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-500 shrink-0">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><polyline points="20 6 9 17 4 12" /></svg>
                          </div>
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-blue-600/20 flex items-center justify-center text-blue-400 shrink-0">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="9 18 15 12 9 6" /></svg>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 3: Formulario de Evidencias */}
          {step === 3 && selectedSite && (
            <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-300 pb-6">
              <button
                onClick={() => setStep(2)}
                disabled={isSubmitting}
                className="text-slate-400 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest active:text-white transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m15 18-6-6 6-6" /></svg>
                Lista de Tiendas
              </button>

              <div>
                <p className="text-[9px] font-black text-blue-500 uppercase tracking-wider mb-2">Tienda #{selectedSite.store_job_id?.split('_')[0] || '01'}</p>
                <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight uppercase italic">{selectedSite.name_sitio}</h2>
                <p className="text-[10px] text-slate-500 mt-3 font-bold uppercase tracking-wide bg-white/[0.02] p-3 rounded-xl border border-white/5 leading-relaxed">
                  📍 {selectedSite.direccion_completa || `${selectedSite.city}, ${selectedSite.state}`}
                </p>
              </div>

              {/* Botones de captura */}
              <div className="grid grid-cols-2 gap-3">
                <div
                  onClick={() => alert('Abrir Cámara')}
                  className="bg-white/[0.03] border-2 border-dashed border-white/10 rounded-2xl p-6 text-center cursor-pointer active:bg-blue-600/10 transition-colors"
                >
                  <div className="w-12 h-12 bg-blue-600/20 rounded-xl flex items-center justify-center mx-auto mb-3 border border-blue-500/30">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">📸 Foto</span>
                </div>
                <div
                  onClick={() => alert('Subir PDF')}
                  className="bg-white/[0.03] border-2 border-dashed border-white/10 rounded-2xl p-6 text-center cursor-pointer active:bg-emerald-600/10 transition-colors"
                >
                  <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center mx-auto mb-3 border border-emerald-500/30">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">📝 Acuse</span>
                </div>
              </div>

              {/* Checklist */}
              <div className="bg-white/[0.02] rounded-2xl p-5 space-y-4 border border-white/5">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider">✓ Checklist de Instalación</p>
                {[
                  { id: 'limpieza', label: 'Área de trabajo limpia', icon: '🧹' },
                  { id: 'nivelado', label: 'Material nivelado', icon: '📐' },
                  { id: 'evidenciaInstalacion', label: 'Instalación correcta', icon: '✅' },
                ].map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-4 cursor-pointer active:opacity-80 transition-opacity"
                    onClick={() => setForm({ ...form, checklist: { ...form.checklist, [task.id]: !form.checklist[task.id as keyof typeof form.checklist] } })}
                  >
                    <div className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-all ${form.checklist[task.id as keyof typeof form.checklist]
                        ? 'bg-blue-600 border-blue-600'
                        : 'border-white/20 bg-slate-900'
                      }`}>
                      {form.checklist[task.id as keyof typeof form.checklist] && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4"><polyline points="20 6 9 17 4 12" /></svg>
                      )}
                    </div>
                    <span className={`text-sm font-bold transition-colors ${form.checklist[task.id as keyof typeof form.checklist] ? 'text-white' : 'text-slate-500'
                      }`}>
                      {task.icon} {task.label}
                    </span>
                  </div>
                ))}
              </div>

              {/* Botón finalizar */}
              <button
                onClick={handleFinish}
                disabled={isSubmitting}
                className="w-full bg-blue-600 active:bg-blue-500 disabled:bg-slate-800 py-5 rounded-2xl font-black text-lg tracking-tight shadow-lg transition-all flex items-center justify-center gap-3 text-white uppercase"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Sincronizando...
                  </>
                ) : (
                  <>
                    ✓ Finalizar Instalación
                  </>
                )}
              </button>
            </div>
          )}

          {/* STEP 4: Éxito */}
          {step === 4 && (
            <div className="flex flex-col items-center justify-center text-center py-12 animate-in zoom-in-95 duration-300">
              <div className="w-28 h-28 bg-emerald-500/10 rounded-full flex items-center justify-center mb-8 border-2 border-emerald-500/20">
                <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
              </div>
              <h2 className="text-3xl font-black mb-4 text-white tracking-tight italic uppercase">¡Éxito!</h2>
              <p className="text-slate-500 text-sm leading-relaxed mb-10 px-4 font-bold uppercase tracking-widest">
                Evidencia sincronizada con <span className="text-blue-400">Control Center</span>.
              </p>
              <button
                onClick={() => { setStep(2); setForm({ comments: '', checklist: { limpieza: false, nivelado: false, materialRecibido: false, evidenciaInstalacion: false } }); }}
                className="w-full py-5 bg-white/[0.03] active:bg-white/[0.05] rounded-2xl font-black uppercase tracking-widest text-white border border-white/10 transition-all text-sm"
              >
                ← Siguiente Tienda
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Bottom Navigation Bar - Mobile */}
      <nav className="sticky bottom-0 bg-[#030712]/95 backdrop-blur-xl border-t border-white/5 px-4 py-3 safe-area-bottom">
        <div className="max-w-lg mx-auto flex justify-around">
          <button
            onClick={() => setStep(1)}
            className={`flex flex-col items-center gap-1 ${step === 1 ? 'text-blue-500' : 'text-slate-500'}`}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
            <span className="text-[8px] font-bold uppercase">Inicio</span>
          </button>
          <button
            onClick={() => selectedRoute && setStep(2)}
            className={`flex flex-col items-center gap-1 ${step === 2 ? 'text-blue-500' : 'text-slate-500'}`}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" /><path d="M9 21v-8" /><path d="M21 21V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v16" /></svg>
            <span className="text-[8px] font-bold uppercase">Tiendas</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-slate-500">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
            <span className="text-[8px] font-bold uppercase">Historial</span>
          </button>
        </div>
      </nav>
    </div>
  );
};

export default EvidencePortal;
