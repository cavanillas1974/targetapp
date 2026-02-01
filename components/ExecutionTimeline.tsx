/**
 * ===================================================
 * EXECUTION TIMELINE - TIMELINE DE EJECUCIÓN DIARIA
 * ===================================================
 * Visualización tipo Gantt horizontal con fechas,
 * barras de ejecución por ruta y scroll vertical.
 */

import React, { useState, useMemo, useRef } from 'react';
import { SiteRecord } from '../types';

interface ScheduledDay {
    dayNumber: number;
    date: string;
    stores: any[];
    overnightLocation?: {
        name: string;
        distanceToNextStore: number;
    } | null;
    kmTotal: number;
    minutesTotal: number;
    startPoint: { name: string };
    endPoint: { name: string };
}

interface Route {
    id: string;
    corridorId?: string;
    corridorName?: string;
    direction?: string;
    base: string;
    hub?: { name: string };
    driverName: string;
    secondaryDriverName?: string;
    stops: SiteRecord[];
    scheduledDays?: ScheduledDay[];
    totalKm: number;
    estTimeMinutes: number;
    color: string;
    startDate?: string;
    endDate?: string;
}

interface ExecutionTimelineProps {
    routes: Route[];
    isLightMode: boolean;
    onViewRoute?: (route: Route) => void;
    onViewDay?: (route: Route, day: ScheduledDay) => void;
    maxVisibleRoutes?: number;
}

export const ExecutionTimeline: React.FC<ExecutionTimelineProps> = ({
    routes,
    isLightMode,
    onViewRoute,
    onViewDay,
    maxVisibleRoutes = 8
}) => {
    const [selectedRoute, setSelectedRoute] = useState<string | null>(null);
    const [hoveredDay, setHoveredDay] = useState<{ routeId: string; date: string } | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Calcular rango de fechas global
    const { dateRange, startDate, endDate } = useMemo(() => {
        const allDates: string[] = [];
        routes.forEach(r => {
            if (r.scheduledDays) {
                r.scheduledDays.forEach(d => allDates.push(d.date));
            }
            r.stops.forEach(s => {
                if (s.scheduled_date) allDates.push(s.scheduled_date);
            });
        });

        if (allDates.length === 0) {
            const today = new Date();
            const dateStr = today.toISOString().split('T')[0];
            return { dateRange: [dateStr], startDate: dateStr, endDate: dateStr };
        }

        const sorted = [...new Set(allDates)].sort();
        const start = sorted[0];
        const end = sorted[sorted.length - 1];

        // Generar todas las fechas en el rango
        const range: string[] = [];
        let cur = new Date(start + 'T00:00:00');
        const endD = new Date(end + 'T00:00:00');
        while (cur <= endD) {
            const y = cur.getFullYear();
            const m = (cur.getMonth() + 1).toString().padStart(2, '0');
            const d = cur.getDate().toString().padStart(2, '0');
            range.push(`${y}-${m}-${d}`);
            cur.setDate(cur.getDate() + 1);
        }

        return { dateRange: range, startDate: start, endDate: end };
    }, [routes]);

    // Estadísticas
    const stats = useMemo(() => {
        const totalStores = routes.reduce((acc, r) => acc + r.stops.length, 0);
        const totalKm = routes.reduce((acc, r) => acc + r.totalKm, 0);
        return { totalStores, totalKm };
    }, [routes]);

    const formatDateShort = (dateStr: string) => {
        const d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
    };

    const formatDateFull = (dateStr: string) => {
        const d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' });
    };

    // Calcular posición de la barra para una ruta
    const getBarPosition = (route: Route) => {
        const routeDays = route.scheduledDays || [];
        if (routeDays.length === 0) return null;

        const routeDates = routeDays.map(d => d.date).sort();
        const firstDate = routeDates[0];
        const lastDate = routeDates[routeDates.length - 1];

        const startIdx = dateRange.indexOf(firstDate);
        const endIdx = dateRange.indexOf(lastDate);

        if (startIdx === -1 || endIdx === -1) return null;

        const totalDays = dateRange.length;
        const left = (startIdx / totalDays) * 100;
        const width = ((endIdx - startIdx + 1) / totalDays) * 100;

        return { left, width, startIdx, endIdx };
    };

    // Colores vibrantes para las rutas
    const routeColors = [
        'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
        'linear-gradient(135deg, #10b981 0%, #059669 100%)',
        'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
        'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
        'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
        'linear-gradient(135deg, #ec4899 0%, #db2777 100%)',
        'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
        'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
        'linear-gradient(135deg, #84cc16 0%, #65a30d 100%)',
        'linear-gradient(135deg, #a855f7 0%, #9333ea 100%)',
    ];

    const getRouteGradient = (idx: number) => routeColors[idx % routeColors.length];

    const needsScroll = routes.length > maxVisibleRoutes;
    const additionalRoutes = routes.length > maxVisibleRoutes ? routes.length - maxVisibleRoutes : 0;

    if (routes.length === 0) {
        return (
            <div className={`p-16 text-center rounded-[2.5rem] border-2 border-dashed ${isLightMode ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/40 border-slate-700'}`}>
                <div className="w-20 h-20 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto mb-6">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                </div>
                <h3 className={`text-2xl font-black uppercase italic tracking-tighter ${isLightMode ? 'text-slate-900' : 'text-white'}`}>
                    Sin Cronograma
                </h3>
                <p className="text-slate-500 mt-3 text-sm">Genera rutas para visualizar el timeline de ejecución</p>
            </div>
        );
    }

    return (
        <div className={`${isLightMode ? 'bg-white' : 'bg-slate-900/60'} rounded-[2.5rem] border ${isLightMode ? 'border-slate-200' : 'border-white/5'} overflow-hidden animate-in fade-in duration-700`}>
            {/* Header */}
            <div className={`px-10 py-8 border-b ${isLightMode ? 'border-slate-100 bg-slate-50' : 'border-white/5 bg-slate-900/40'}`}>
                <div className="flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <span className="w-3 h-3 rounded-full bg-blue-500 animate-pulse"></span>
                            <span className="text-blue-500 text-xs font-black uppercase tracking-[0.3em]">BASE_CDMX</span>
                        </div>
                        <h2 className={`text-2xl font-black uppercase italic tracking-tight ${isLightMode ? 'text-slate-900' : 'text-white'}`}>
                            Timeline de Ejecución Diaria
                        </h2>
                        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">
                            Estimación de slots operativos {formatDateShort(startDate)} - {formatDateShort(endDate)}
                        </p>
                    </div>

                    {/* Legend */}
                    <div className="flex items-center gap-8">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-3 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full"></div>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Tránsito/Servicio</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-white/20 border border-white/30"></div>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Disponible</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Date Axis Header */}
            <div className={`px-10 py-4 border-b ${isLightMode ? 'border-slate-100' : 'border-white/5'} flex`}>
                <div className="w-32 shrink-0"></div>
                <div className="flex-1 flex relative">
                    {dateRange.map((date, i) => (
                        <div
                            key={date}
                            className="flex-1 text-center"
                            style={{ minWidth: `${100 / dateRange.length}%` }}
                        >
                            <span className={`text-[10px] font-bold uppercase tracking-wider ${isLightMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                {formatDateShort(date)}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Routes Container with Scroll */}
            <div
                ref={scrollRef}
                className={`relative ${needsScroll ? 'max-h-[480px] overflow-y-auto custom-scrollbar' : ''}`}
            >
                <div className="divide-y divide-white/5">
                    {routes.map((route, routeIdx) => {
                        const barPos = getBarPosition(route);
                        const routeDays = route.scheduledDays || [];
                        const isSelected = selectedRoute === route.id;

                        return (
                            <div
                                key={route.id}
                                className={`flex items-center px-10 py-5 transition-all duration-300 cursor-pointer ${isSelected
                                        ? (isLightMode ? 'bg-blue-50' : 'bg-blue-500/10')
                                        : 'hover:bg-white/[0.02]'
                                    }`}
                                onClick={() => {
                                    setSelectedRoute(isSelected ? null : route.id);
                                    onViewRoute?.(route);
                                }}
                            >
                                {/* Route Label */}
                                <div className="w-32 shrink-0 flex items-center gap-3">
                                    <div
                                        className="w-4 h-4 rounded-full shadow-lg"
                                        style={{ background: route.color }}
                                    ></div>
                                    <span className={`text-sm font-black uppercase tracking-tight ${isLightMode ? 'text-slate-700' : 'text-white'}`}>
                                        R-{route.id}
                                    </span>
                                </div>

                                {/* Timeline Bar Area */}
                                <div className="flex-1 h-12 relative">
                                    {/* Background Grid */}
                                    <div className="absolute inset-0 flex">
                                        {dateRange.map((date, i) => (
                                            <div
                                                key={date}
                                                className={`flex-1 border-r ${isLightMode ? 'border-slate-100' : 'border-white/5'} last:border-r-0`}
                                            ></div>
                                        ))}
                                    </div>

                                    {/* Route Bar */}
                                    {barPos && (
                                        <div
                                            className="absolute top-1 bottom-1 rounded-full flex items-center justify-center shadow-lg transition-all duration-500 hover:scale-[1.02]"
                                            style={{
                                                left: `${barPos.left}%`,
                                                width: `${barPos.width}%`,
                                                background: getRouteGradient(routeIdx),
                                                minWidth: '80px'
                                            }}
                                        >
                                            {/* Day Markers (dots) */}
                                            <div className="absolute inset-0 flex items-center justify-between px-3">
                                                {routeDays.map((day, i) => {
                                                    const isHovered = hoveredDay?.routeId === route.id && hoveredDay?.date === day.date;
                                                    return (
                                                        <div
                                                            key={i}
                                                            className={`relative group/dot`}
                                                            onMouseEnter={() => setHoveredDay({ routeId: route.id, date: day.date })}
                                                            onMouseLeave={() => setHoveredDay(null)}
                                                        >
                                                            {/* Dot */}
                                                            <div
                                                                className={`w-2.5 h-2.5 rounded-full bg-white/40 transition-all duration-200 ${isHovered ? 'scale-150 bg-white' : ''}`}
                                                            ></div>

                                                            {/* Tooltip */}
                                                            {isHovered && (
                                                                <div className={`absolute z-50 bottom-full left-1/2 transform -translate-x-1/2 mb-3 ${isLightMode ? 'bg-white' : 'bg-slate-800'} rounded-xl p-3 shadow-2xl border ${isLightMode ? 'border-slate-200' : 'border-white/10'} min-w-[160px] pointer-events-none`}>
                                                                    <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest mb-1">
                                                                        {formatDateFull(day.date)}
                                                                    </p>
                                                                    <p className={`text-sm font-black ${isLightMode ? 'text-slate-900' : 'text-white'}`}>
                                                                        {day.stores.length} tiendas
                                                                    </p>
                                                                    <p className="text-[10px] text-slate-500">{Math.round(day.kmTotal)} km</p>
                                                                    {day.overnightLocation && (
                                                                        <p className="text-[9px] text-amber-500 mt-1">🏨 {day.overnightLocation.name}</p>
                                                                    )}
                                                                    {/* Arrow */}
                                                                    <div className={`absolute left-1/2 -bottom-1.5 transform -translate-x-1/2 rotate-45 w-3 h-3 ${isLightMode ? 'bg-white border-r border-b border-slate-200' : 'bg-slate-800 border-r border-b border-white/10'}`}></div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {/* Center Label */}
                                            <div className="relative z-10 flex items-center gap-2 px-4">
                                                <span className="text-white text-xs font-black">
                                                    {route.stops.length} SITES
                                                </span>
                                                <span className="text-white/60 text-[10px] font-bold">|</span>
                                                <span className="text-white/80 text-[10px] font-bold uppercase">
                                                    {Math.round(route.totalKm)}KM
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Additional Routes Indicator */}
            {additionalRoutes > 0 && (
                <div className={`px-10 py-4 border-t ${isLightMode ? 'border-slate-100 bg-slate-50' : 'border-white/5 bg-slate-900/40'} text-center`}>
                    <span className="text-slate-500 text-xs font-bold uppercase tracking-widest">
                        + {additionalRoutes} rutas adicionales en cronograma maestro
                    </span>
                </div>
            )}

            {/* Footer Stats */}
            <div className={`px-10 py-6 border-t ${isLightMode ? 'border-slate-100 bg-slate-50' : 'border-white/5 bg-slate-900/40'} flex items-center justify-between`}>
                <div className="flex items-center gap-8">
                    <div>
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">Total Rutas</span>
                        <span className={`text-xl font-black ${isLightMode ? 'text-slate-900' : 'text-white'}`}>{routes.length}</span>
                    </div>
                    <div>
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">Total Tiendas</span>
                        <span className={`text-xl font-black ${isLightMode ? 'text-slate-900' : 'text-white'}`}>{stats.totalStores}</span>
                    </div>
                    <div>
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">Días Operación</span>
                        <span className={`text-xl font-black ${isLightMode ? 'text-slate-900' : 'text-white'}`}>{dateRange.length}</span>
                    </div>
                    <div>
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">KM Totales</span>
                        <span className={`text-xl font-black ${isLightMode ? 'text-slate-900' : 'text-white'}`}>{Math.round(stats.totalKm).toLocaleString()}</span>
                    </div>
                </div>

                <button
                    onClick={() => onViewRoute?.(routes[0])}
                    className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all hover:scale-105 shadow-lg shadow-blue-500/20"
                >
                    Ver Detalle Completo
                </button>
            </div>
        </div>
    );
};

export default ExecutionTimeline;
