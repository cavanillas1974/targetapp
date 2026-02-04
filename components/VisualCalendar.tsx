import React from 'react';
import { SiteRecord } from '../types';
import targetLogo from '../Images/logo.png';

interface Route {
    id: string;
    base: string;
    date: string;
    driverName: string;
    secondaryDriverName?: string;
    stops: SiteRecord[];
    totalKm: number;
    estTimeMinutes: number;
    color: string;
}

interface VisualCalendarProps {
    routes: Route[];
    isLightMode: boolean;
    onViewRoute?: (route: Route) => void;
}

export const VisualCalendar: React.FC<VisualCalendarProps> = ({ routes, isLightMode, onViewRoute }) => {
    // Organizar rutas por fecha
    const routesByDate = routes.reduce((acc, route) => {
        if (!acc[route.date]) acc[route.date] = [];
        acc[route.date].push(route);
        return acc;
    }, {} as Record<string, Route[]>);

    // Obtener rango de fechas
    const dates = Object.keys(routesByDate).sort();
    if (dates.length === 0) return (
        <div className={`p-20 text-center rounded-[3rem] border-2 border-dashed ${isLightMode ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/40 border-slate-800'}`}>
            <div className="w-24 h-24 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto mb-6 scale-125">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
            </div>
            <h3 className={`text-2xl font-black uppercase italic tracking-tighter ${isLightMode ? 'text-slate-900' : 'text-white'}`}>Sin Cronograma Activo</h3>
            <p className="text-slate-500 mt-2 font-bold uppercase text-[10px] tracking-widest">Genera una ruta en la pestaña de Ingesta para visualizar el calendario</p>
        </div>
    );

    return (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-10 duration-1000">
            {/* Header Visual */}
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex flex-col gap-4 mb-4">
                        <img src={targetLogo} alt="Client Logo" className="h-20 w-auto object-contain self-start drop-shadow-lg" />
                        <h2 className={`text-5xl font-black uppercase italic tracking-tighter ${isLightMode ? 'text-slate-900' : 'text-white'}`}>Cronograma <span className="text-blue-500">Master</span></h2>
                    </div>
                    <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.4em] mt-2 flex items-center gap-3">
                        Visualización de Ejecución Operativa
                    </p>
                </div>

                <div className="flex gap-4">
                    <div className={`${isLightMode ? 'bg-white' : 'bg-slate-900/60'} px-8 py-4 rounded-3xl border ${isLightMode ? 'border-slate-200' : 'border-white/5'} flex flex-col items-end`}>
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Total Días</span>
                        <span className={`text-2xl font-black ${isLightMode ? 'text-blue-600' : 'text-white'}`}>{dates.length}</span>
                    </div>
                    <div className={`${isLightMode ? 'bg-white' : 'bg-slate-900/60'} px-8 py-4 rounded-3xl border ${isLightMode ? 'border-slate-200' : 'border-white/5'} flex flex-col items-end`}>
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Total Rutas</span>
                        <span className={`text-2xl font-black ${isLightMode ? 'text-emerald-500' : 'text-white'}`}>{routes.length}</span>
                    </div>
                </div>
            </div>

            {/* Grid de Calendario Estilo Timeline */}
            <div className="grid grid-cols-1 gap-8">
                {dates.map((dateStr) => {
                    const dayRoutes = routesByDate[dateStr];
                    const dateObj = new Date(dateStr + 'T00:00:00');
                    const dayName = dateObj.toLocaleDateString('es-MX', { weekday: 'long' });
                    const dayNum = dateObj.getDate();
                    const monthName = dateObj.toLocaleDateString('es-MX', { month: 'long' });

                    return (
                        <div key={dateStr} className={`group relative transition-all duration-700 ${isLightMode ? 'bg-white' : 'bg-slate-900/30'} border ${isLightMode ? 'border-slate-100' : 'border-white/5'} rounded-[3.5rem] p-10 hover:border-blue-500/30`}>
                            <div className="flex flex-col lg:flex-row gap-10">
                                {/* Date Label Sidebar */}
                                <div className="lg:w-48 shrink-0 flex items-center lg:items-start lg:flex-col justify-between lg:justify-start gap-4">
                                    <div className={`w-24 h-24 rounded-[2.5rem] flex flex-col items-center justify-center shadow-2xl transition-transform group-hover:scale-110 duration-700 ${isLightMode ? 'bg-slate-900 text-white' : 'bg-blue-600 text-white'}`}>
                                        <span className="text-[10px] font-black uppercase tracking-widest opacity-60">{dayName.slice(0, 3)}</span>
                                        <span className="text-4xl font-black italic -mt-1">{dayNum}</span>
                                    </div>
                                    <div className="lg:mt-4 text-right lg:text-left">
                                        <p className={`text-xs font-black uppercase tracking-[0.2em] italic ${isLightMode ? 'text-slate-900' : 'text-white'}`}>{monthName}</p>
                                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] mt-1">{dateStr}</p>
                                    </div>
                                </div>

                                {/* Routes on this Day */}
                                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                    {dayRoutes.map((route) => (
                                        <div
                                            key={route.id}
                                            className={`relative overflow-hidden rounded-[2.5rem] border ${isLightMode ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/50 border-white/5 shadow-2xl'} p-8 group/card transition-all duration-500 hover:-translate-y-2 cursor-pointer`}
                                            onClick={() => onViewRoute?.(route)}
                                        >
                                            {/* Color Accent Bar */}
                                            <div className="absolute top-0 left-0 w-full h-2" style={{ backgroundColor: route.color }}></div>

                                            <div className="flex justify-between items-start mb-6">
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${isLightMode ? 'bg-slate-200 text-slate-600' : 'bg-white/5 text-slate-400'}`}>Ruta {route.id}</span>
                                                        <span className="text-blue-500 font-black text-[8px] uppercase tracking-widest italic">{route.base}</span>
                                                    </div>
                                                    <h4 className={`text-lg font-black uppercase italic tracking-tighter mt-1 ${isLightMode ? 'text-slate-900' : 'text-white'}`}>{route.driverName}</h4>
                                                </div>
                                                <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shadow-inner group-hover/card:bg-blue-600 group-hover/card:border-blue-400/50 transition-all duration-500">
                                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-blue-400 group-hover/card:text-white transition-colors"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div className={`p-4 rounded-2xl ${isLightMode ? 'bg-white' : 'bg-slate-900/60'} border ${isLightMode ? 'border-slate-100' : 'border-white/5'}`}>
                                                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Paradas</p>
                                                    <p className={`text-sm font-black ${isLightMode ? 'text-slate-900' : 'text-white'}`}>{route.stops.length} <span className="text-[9px] text-slate-500 font-bold italic">SITES</span></p>
                                                </div>
                                                <div className={`p-4 rounded-2xl ${isLightMode ? 'bg-white' : 'bg-slate-900/60'} border ${isLightMode ? 'border-slate-100' : 'border-white/5'}`}>
                                                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Distancia</p>
                                                    <p className={`text-sm font-black ${isLightMode ? 'text-slate-900' : 'text-white'}`}>{route.totalKm} <span className="text-[9px] text-slate-500 font-bold italic">KM</span></p>
                                                </div>
                                            </div>

                                            {/* Progress Sparkles (Preview of Stops) */}
                                            <div className="mt-6 flex gap-1.5 opacity-40 group-hover/card:opacity-100 transition-opacity duration-700">
                                                {route.stops.slice(0, 10).map((_, i) => (
                                                    <div key={i} className="h-1 flex-1 rounded-full" style={{ backgroundColor: route.color }}></div>
                                                ))}
                                                {route.stops.length > 10 && <span className="text-[8px] font-black text-slate-500">+</span>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
