import React from 'react';

interface SystemReadinessProps {
    isLightMode: boolean;
    depotsCount: number;
}

export const SystemReadiness: React.FC<SystemReadinessProps> = ({ isLightMode, depotsCount }) => {
    return (
        <div className={`w-full mt-16 p-10 rounded-[3rem] border transition-all duration-700 ${isLightMode
                ? 'bg-white border-slate-200 shadow-xl'
                : 'bg-slate-900/40 border-white/5 shadow-2xl backdrop-blur-md'
            }`}>
            {/* Header del Panel */}
            <div className="flex items-center justify-between mb-8 border-b border-white/5 pb-6">
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <div className={`w-3 h-3 rounded-full ${isLightMode ? 'bg-emerald-500' : 'bg-emerald-400'} animate-ping absolute`}></div>
                        <div className={`w-3 h-3 rounded-full ${isLightMode ? 'bg-emerald-500' : 'bg-emerald-400'} relative`}></div>
                    </div>
                    <h4 className={`text-xs font-black uppercase tracking-[0.3em] ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                        System Status Check
                    </h4>
                </div>
                <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest bg-blue-500/10 px-3 py-1 rounded-lg border border-blue-500/20">
                    v2.5.0 Stable
                </span>
            </div>

            {/* Grid de Métricas */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Módulo 1: Motor */}
                <div className={`p-6 rounded-3xl border ${isLightMode ? 'bg-slate-50 border-slate-100' : 'bg-white/5 border-white/5'
                    } relative group overflow-hidden`}>
                    <div className="absolute top-0 right-0 p-4 opacity-10 text-4xl grayscale transition-all group-hover:scale-110 group-hover:opacity-20 group-hover:grayscale-0">🧠</div>
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Algoritmo de Ruteo</p>
                    <h5 className={`text-xl font-black italic uppercase ${isLightMode ? 'text-slate-900' : 'text-white'}`}>OptiFlot™ Neural</h5>
                    <div className="mt-4 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        <span className="text-[9px] font-bold text-emerald-500 uppercase">Ready to Solve</span>
                    </div>
                </div>

                {/* Módulo 2: Nodos */}
                <div className={`p-6 rounded-3xl border ${isLightMode ? 'bg-slate-50 border-slate-100' : 'bg-white/5 border-white/5'
                    } relative group overflow-hidden`}>
                    <div className="absolute top-0 right-0 p-4 opacity-10 text-4xl grayscale transition-all group-hover:scale-110 group-hover:opacity-20 group-hover:grayscale-0">📡</div>
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Bases Operativas</p>
                    <h5 className={`text-xl font-black italic uppercase ${isLightMode ? 'text-slate-900' : 'text-white'}`}>{depotsCount} Hubs Activos</h5>
                    <div className="mt-4 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                        <span className="text-[9px] font-bold text-blue-500 uppercase">Coverage: National</span>
                    </div>
                </div>

                {/* Módulo 3: Clima/Seguridad (Simulado) */}
                <div className={`p-6 rounded-3xl border ${isLightMode ? 'bg-slate-50 border-slate-100' : 'bg-white/5 border-white/5'
                    } relative group overflow-hidden`}>
                    <div className="absolute top-0 right-0 p-4 opacity-10 text-4xl grayscale transition-all group-hover:scale-110 group-hover:opacity-20 group-hover:grayscale-0">🛡️</div>
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Protocolos de Seguridad</p>
                    <h5 className={`text-xl font-black italic uppercase ${isLightMode ? 'text-slate-900' : 'text-white'}`}>Level 5 Secure</h5>
                    <div className="mt-4 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                        <span className="text-[9px] font-bold text-purple-500 uppercase">Encrypted Data</span>
                    </div>
                </div>
            </div>

            {/* Footer Téchnico */}
            <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between opacity-50 text-[9px] font-black uppercase tracking-widest text-slate-500">
                <p>Latency: 12ms</p>
                <p>Server Region: us-central-1 (GCP)</p>
                <p>Memory: 64GB Alloc</p>
            </div>
        </div>
    );
};
