/**
 * ===================================================
 * MASTER SCHEDULE GANTT - CRONOGRAMA MAESTRO VISUAL
 * ===================================================
 * Visualización tipo Gantt interactiva de todas las rutas
 * con fechas de ejecución, pernoctas, y progreso.
 */

import React, { useState, useMemo } from 'react';
import { SiteRecord } from '../types';
import { ExecutionTimeline } from './ExecutionTimeline';

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

interface MasterScheduleGanttProps {
    routes: Route[];
    isLightMode: boolean;
    onViewRoute?: (route: Route) => void;
    onViewDay?: (route: Route, day: ScheduledDay) => void;
}

export const MasterScheduleGantt: React.FC<MasterScheduleGanttProps> = ({
    routes,
    isLightMode,
    onViewRoute,
    onViewDay
}) => {
    const [selectedRoute, setSelectedRoute] = useState<string | null>(null);
    const [hoveredDay, setHoveredDay] = useState<{ routeId: string; dayNum: number } | null>(null);
    const [viewMode, setViewMode] = useState<'GANTT' | 'TIMELINE' | 'LIST'>('GANTT');

    // Calcular rango de fechas global
    const { dateRange, totalDays, startDate, endDate } = useMemo(() => {
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
            return {
                dateRange: [],
                totalDays: 0,
                startDate: today.toISOString().split('T')[0],
                endDate: today.toISOString().split('T')[0]
            };
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

        return {
            dateRange: range,
            totalDays: range.length,
            startDate: start,
            endDate: end
        };
    }, [routes]);

    // Estadísticas globales
    const stats = useMemo(() => {
        const totalStores = routes.reduce((acc, r) => acc + r.stops.length, 0);
        const totalKm = routes.reduce((acc, r) => acc + r.totalKm, 0);
        const totalDaysWork = routes.reduce((acc, r) => acc + (r.scheduledDays?.length || 0), 0);
        const avgStoresPerDay = totalDaysWork > 0 ? (totalStores / totalDays).toFixed(1) : 0;

        return { totalStores, totalKm, totalDaysWork, avgStoresPerDay };
    }, [routes, totalDays]);

    if (routes.length === 0) {
        return (
            <div className={`p-20 text-center rounded-[3rem] border-2 border-dashed ${isLightMode ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/40 border-slate-800'}`}>
                <div className="w-32 h-32 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center mx-auto mb-8">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                </div>
                <h3 className={`text-3xl font-black uppercase italic tracking-tighter ${isLightMode ? 'text-slate-900' : 'text-white'}`}>
                    Sin Cronograma Activo
                </h3>
                <p className="text-slate-500 mt-4 font-medium max-w-md mx-auto">
                    Genera rutas en el motor AntiGravity para visualizar el cronograma maestro con todas las rutas en paralelo.
                </p>
            </div>
        );
    }

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
    };

    const getDayOfWeek = (dateStr: string) => {
        const d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString('es-MX', { weekday: 'short' }).toUpperCase();
    };

    const isWeekend = (dateStr: string) => {
        const d = new Date(dateStr + 'T00:00:00');
        return d.getDay() === 0 || d.getDay() === 6;
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000">
            {/* Header Section */}
            <div className={`${isLightMode ? 'bg-white border-slate-200' : 'bg-gradient-to-br from-slate-900/80 to-slate-950/80 border-white/5'} rounded-[3rem] border p-10 backdrop-blur-xl`}>
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
                    {/* Title */}
                    <div>
                        <div className="flex items-center gap-4 mb-3">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                                <span className="text-2xl">📊</span>
                            </div>
                            <div>
                                <p className="text-[9px] font-black text-blue-500 uppercase tracking-[0.4em]">Cronograma Maestro</p>
                                <h2 className={`text-4xl font-black uppercase italic tracking-tighter ${isLightMode ? 'text-slate-900' : 'text-white'}`}>
                                    Control de <span className="text-blue-500">Despliegue</span>
                                </h2>
                            </div>
                        </div>
                        <p className="text-slate-500 text-sm font-medium mt-2">
                            {routes.length} rutas paralelas • {formatDate(startDate)} → {formatDate(endDate)}
                        </p>
                    </div>

                    {/* View Mode Toggles */}
                    <div className="flex items-center gap-3">
                        {['GANTT', 'TIMELINE', 'LIST'].map((mode) => (
                            <button
                                key={mode}
                                onClick={() => setViewMode(mode as any)}
                                className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === mode
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                                    : isLightMode
                                        ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        : 'bg-white/5 text-slate-400 hover:bg-white/10'
                                    }`}
                            >
                                {mode === 'GANTT' && '📊'} {mode === 'TIMELINE' && '📅'} {mode === 'LIST' && '📋'} {mode}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Stats Bar */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
                    {[
                        { label: 'Rutas Activas', value: routes.length, icon: '🚐', color: 'blue' },
                        { label: 'Total Tiendas', value: stats.totalStores, icon: '🏪', color: 'emerald' },
                        { label: 'Días Operación', value: totalDays, icon: '📅', color: 'purple' },
                        { label: 'KM Totales', value: Math.round(stats.totalKm).toLocaleString(), icon: '🛣️', color: 'amber' }
                    ].map((stat, i) => (
                        <div key={i} className={`${isLightMode ? 'bg-slate-50' : 'bg-white/5'} rounded-2xl p-5 border ${isLightMode ? 'border-slate-100' : 'border-white/5'}`}>
                            <div className="flex items-center gap-3 mb-2">
                                <span className="text-lg">{stat.icon}</span>
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{stat.label}</span>
                            </div>
                            <p className={`text-2xl font-black ${isLightMode ? 'text-slate-900' : 'text-white'}`}>{stat.value}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* GANTT View - Tactical Operation Stream */}
            {viewMode === 'GANTT' && (
                <div className={`${isLightMode ? 'bg-white border-slate-200' : 'bg-[#0B1121] border-white/5'} rounded-[2.5rem] border shadow-2xl overflow-hidden relative`}>

                    {/* Floating Legend */}
                    <div className="absolute top-6 right-8 z-20 flex gap-4 text-[9px] font-black uppercase tracking-widest bg-black/20 backdrop-blur-md px-4 py-2 rounded-full border border-white/5">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                            <span>Operación Activa</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                            <span>Hotel / Pernocta Logic</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs">🚗</span>
                            <span>Tránsito Puro</span>
                        </div>
                    </div>

                    <div className="overflow-auto custom-scrollbar max-h-[800px] relative">
                        {/* THE MATRIX */}
                        <div className="min-w-max">
                            {/* Header Row */}
                            <div className="flex sticky top-0 z-10 bg-[#0f172a] shadow-lg border-b border-white/5">
                                <div className="sticky left-0 z-20 w-80 p-6 bg-[#0f172a] border-r border-white/5 flex items-center shadow-[4px_0_24px_rgba(0,0,0,0.5)]">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Unidad Operativa</span>
                                </div>
                                {dateRange.map((date, i) => (
                                    <div
                                        key={date}
                                        className={`w-32 py-4 text-center border-r border-white/5 flex flex-col justify-center relative group ${isWeekend(date) ? 'bg-amber-500/5' : ''}`}
                                    >
                                        <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${isWeekend(date) ? 'text-amber-500' : 'text-slate-500'}`}>
                                            {getDayOfWeek(date)}
                                        </p>
                                        <p className="text-xl font-black text-white leading-none">
                                            {formatDate(date).split(' ')[0]}
                                        </p>

                                        {/* Date Indicator Line */}
                                        <div className="absolute inset-x-0 bottom-0 h-0.5 bg-blue-500/0 group-hover:bg-blue-500/50 transition-all"></div>
                                    </div>
                                ))}
                            </div>

                            {/* Data Rows */}
                            <div className="divide-y divide-white/5">
                                {routes.map((route) => {
                                    const routeDays = route.scheduledDays || [];
                                    const routeDates = routeDays.map(d => d.date);

                                    return (
                                        <div key={route.id} className="flex group/row hover:bg-white/[0.02] transition-colors relative">

                                            {/* Sticky Route Name Column */}
                                            <div
                                                className="sticky left-0 z-10 w-80 p-5 bg-[#0B1121] border-r border-white/5 flex items-center gap-4 shadow-[4px_0_24px_rgba(0,0,0,0.3)] cursor-pointer group-hover/row:bg-[#0f172a] transition-colors"
                                                onClick={() => setSelectedRoute(selectedRoute === route.id ? null : route.id)}
                                            >
                                                <div
                                                    className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-black text-sm shadow-lg transform group-hover/row:scale-110 transition-transform duration-300"
                                                    style={{ backgroundColor: route.color, boxShadow: `0 0 20px ${route.color}40` }}
                                                >
                                                    {route.id}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-black text-white uppercase tracking-tight truncate">
                                                        {route.corridorName || route.driverName}
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">{route.stops.length} Tiendas</span>
                                                        <span className="w-1 h-1 bg-slate-600 rounded-full"></span>
                                                        <span className="text-[9px] text-blue-400 uppercase font-bold tracking-wider">{Math.round(route.totalKm).toLocaleString()} km</span>
                                                    </div>
                                                </div>

                                                {/* Active Indicator Arrow */}
                                                {selectedRoute === route.id && (
                                                    <div className="absolute right-4 text-blue-500">
                                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M9 18l6-6-6-6" /></svg>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Cells Grid */}
                                            {dateRange.map((date) => {
                                                const dayInfo = routeDays.find(d => d.date === date);
                                                const isActive = !!dayInfo;
                                                const isOvernight = !!dayInfo?.overnightLocation;

                                                return (
                                                    <div
                                                        key={date}
                                                        className={`w-32 min-h-[100px] border-r border-white/5 relative p-2 flex flex-col justify-center transition-all ${isActive ? 'bg-white/[0.01]' : ''} ${selectedRoute === route.id ? 'bg-blue-500/5' : ''}`}
                                                    >
                                                        {/* Connection Line Background */}
                                                        {isActive && (
                                                            <div className="absolute top-1/2 left-0 w-full h-px bg-white/10 z-0"></div>
                                                        )}

                                                        {isActive && dayInfo && (
                                                            <div
                                                                className="relative z-10 w-full bg-[#1e293b] border border-white/10 rounded-xl p-3 shadow-xl hover:scale-105 hover:border-blue-500/50 hover:bg-[#0f172a] transition-all cursor-pointer group/cell overflow-hidden"
                                                                onClick={() => onViewDay?.(route, dayInfo)}
                                                            >
                                                                {/* Accent Bar */}
                                                                <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: route.color }}></div>

                                                                {/* Cell Content */}
                                                                <div className="pl-2">
                                                                    <div className="flex justify-between items-start mb-2">
                                                                        <span className="text-[10px] font-black text-white">{dayInfo.stores.length} SITIOS</span>
                                                                        {isOvernight && <span className="text-xs" title="Pernocta">🏨</span>}
                                                                    </div>

                                                                    {/* Mini Progress Bar */}
                                                                    <div className="w-full h-1 bg-slate-700 rounded-full mb-2 overflow-hidden">
                                                                        <div className="h-full bg-blue-500 w-full opacity-80"></div>
                                                                    </div>

                                                                    <p className="text-[8px] text-slate-400 font-mono truncate">
                                                                        {dayInfo.kmTotal} km
                                                                    </p>
                                                                </div>

                                                                {/* Hover Tooltip (Portal-like) */}
                                                                <div className="absolute opacity-0 group-hover/cell:opacity-100 transition-opacity inset-0 bg-black/90 flex flex-col items-center justify-center text-center p-2 backdrop-blur-sm z-20">
                                                                    <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1">DETALLE</p>
                                                                    <p className="text-[10px] text-white font-bold mb-1">{dayInfo.stores.length} Tiendas</p>
                                                                    <p className="text-[8px] text-slate-400 uppercase leading-tight">
                                                                        {dayInfo.stores[0]?.city || 'En ruta...'}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {!isActive && isWeekend(date) && (
                                                            <div className="w-full h-full flex items-center justify-center opacity-10">
                                                                <div className="w-1 h-1 bg-amber-500 rounded-full"></div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TIMELINE View - Execution Timeline with horizontal bars */}
            {viewMode === 'TIMELINE' && (
                <ExecutionTimeline
                    routes={routes}
                    isLightMode={isLightMode}
                    onViewRoute={onViewRoute}
                    onViewDay={onViewDay}
                    maxVisibleRoutes={10}
                />
            )}

            {/* LIST View */}
            {viewMode === 'LIST' && (
                <div className={`${isLightMode ? 'bg-white border-slate-200' : 'bg-slate-900/40 border-white/5'} rounded-[3rem] border overflow-hidden`}>
                    {/* Table Header */}
                    <div className={`grid grid-cols-12 gap-4 p-6 border-b ${isLightMode ? 'border-slate-100 bg-slate-50' : 'border-white/5 bg-slate-900/60'} text-[10px] font-black text-slate-500 uppercase tracking-widest`}>
                        <div className="col-span-1">#</div>
                        <div className="col-span-3">Corredor / Ruta</div>
                        <div className="col-span-2">Hub Origen</div>
                        <div className="col-span-1">Tiendas</div>
                        <div className="col-span-1">Días</div>
                        <div className="col-span-2">Inicio → Fin</div>
                        <div className="col-span-1">KM</div>
                        <div className="col-span-1">Estado</div>
                    </div>

                    {/* Table Rows */}
                    <div className="divide-y divide-white/5">
                        {routes.map((route) => {
                            const days = route.scheduledDays || [];
                            const firstDate = days[0]?.date || route.startDate || '-';
                            const lastDate = days[days.length - 1]?.date || route.endDate || '-';

                            return (
                                <div
                                    key={route.id}
                                    className={`grid grid-cols-12 gap-4 p-6 items-center cursor-pointer transition-all hover:bg-white/[0.02] ${selectedRoute === route.id ? (isLightMode ? 'bg-blue-50' : 'bg-blue-500/10') : ''}`}
                                    onClick={() => {
                                        setSelectedRoute(route.id);
                                        onViewRoute?.(route);
                                    }}
                                >
                                    <div className="col-span-1">
                                        <div
                                            className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-sm"
                                            style={{ backgroundColor: route.color }}
                                        >
                                            {route.id}
                                        </div>
                                    </div>
                                    <div className="col-span-3">
                                        <p className={`font-black uppercase tracking-tight ${isLightMode ? 'text-slate-900' : 'text-white'}`}>
                                            {route.corridorName || route.driverName}
                                        </p>
                                        <p className="text-[10px] text-slate-500 mt-1">{route.direction}</p>
                                    </div>
                                    <div className="col-span-2">
                                        <span className={`px-3 py-1 rounded-lg text-[10px] font-black ${isLightMode ? 'bg-slate-100 text-slate-700' : 'bg-white/5 text-slate-400'}`}>
                                            {route.hub?.name || route.base}
                                        </span>
                                    </div>
                                    <div className="col-span-1">
                                        <span className={`text-lg font-black ${isLightMode ? 'text-slate-900' : 'text-white'}`}>{route.stops.length}</span>
                                    </div>
                                    <div className="col-span-1">
                                        <span className={`text-lg font-black ${isLightMode ? 'text-slate-900' : 'text-white'}`}>{days.length}</span>
                                    </div>
                                    <div className="col-span-2">
                                        <span className="text-[10px] text-slate-500">
                                            {formatDate(firstDate)} → {formatDate(lastDate)}
                                        </span>
                                    </div>
                                    <div className="col-span-1">
                                        <span className={`font-black ${isLightMode ? 'text-slate-900' : 'text-white'}`}>{Math.round(route.totalKm).toLocaleString()}</span>
                                    </div>
                                    <div className="col-span-1">
                                        <span className="px-3 py-1 rounded-full text-[9px] font-black uppercase bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                                            Activo
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Selected Route Detail Panel */}
            {selectedRoute && (
                <div className={`${isLightMode ? 'bg-white border-slate-200' : 'bg-gradient-to-br from-slate-900/80 to-slate-950/80 border-white/5'} rounded-[3rem] border p-10 animate-in slide-in-from-bottom-4 duration-500`}>
                    {(() => {
                        const route = routes.find(r => r.id === selectedRoute);
                        if (!route) return null;

                        return (
                            <>
                                <div className="flex items-center justify-between mb-8">
                                    <div className="flex items-center gap-4">
                                        <div
                                            className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-lg"
                                            style={{ backgroundColor: route.color }}
                                        >
                                            {route.id}
                                        </div>
                                        <div>
                                            <h3 className={`text-2xl font-black uppercase italic tracking-tight ${isLightMode ? 'text-slate-900' : 'text-white'}`}>
                                                {route.corridorName || route.driverName}
                                            </h3>
                                            <p className="text-slate-500 font-medium">{route.secondaryDriverName}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setSelectedRoute(null)}
                                        className="p-3 rounded-xl hover:bg-white/10 transition-colors"
                                    >
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                            <path d="M18 6L6 18M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>

                                {/* Days Grid */}
                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                    {(route.scheduledDays || []).map((day) => (
                                        <div
                                            key={day.dayNumber}
                                            className={`${isLightMode ? 'bg-slate-50 hover:bg-slate-100' : 'bg-white/5 hover:bg-white/10'} rounded-2xl p-5 cursor-pointer transition-all hover:scale-105`}
                                            onClick={() => onViewDay?.(route, day)}
                                        >
                                            <div className="flex items-center justify-between mb-3">
                                                <span
                                                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-[10px] font-black"
                                                    style={{ backgroundColor: route.color }}
                                                >
                                                    D{day.dayNumber}
                                                </span>
                                                {day.overnightLocation && <span className="text-sm">🏨</span>}
                                            </div>
                                            <div className="space-y-2 mb-2 min-h-[3rem]">
                                                {day.stores.slice(0, 3).map((s: any, i: number) => (
                                                    <div key={i} className="leading-tight">
                                                        <p className={`text-xs font-black uppercase tracking-tight truncate ${isLightMode ? 'text-slate-900' : 'text-white'}`} title={s.name_sitio || s.name}>
                                                            {s.name_sitio || s.name || `Tienda ${i + 1}`}
                                                        </p>
                                                        {(s.state || s.estado || s.direccion_normalizada) && (
                                                            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1">
                                                                <span className="opacity-50">📍</span>
                                                                {s.state || s.estado || (s.direccion_normalizada ? s.direccion_normalizada.split(',').slice(-2, -1)[0]?.trim() : 'MX')}
                                                            </p>
                                                        )}
                                                    </div>
                                                ))}
                                                {day.stores.length > 3 && (
                                                    <p className="text-[9px] text-slate-400 italic">...y {day.stores.length - 3} más</p>
                                                )}
                                                {day.stores.length === 0 && (
                                                    <p className="text-[10px] text-slate-400 italic">Solo Tránsito</p>
                                                )}
                                            </div>
                                            <p className="text-[10px] text-slate-500 font-bold mt-1">{formatDate(day.date)}</p>
                                            <p className="text-[9px] text-slate-500 mt-1">{day.kmTotal} km • {Math.round(day.minutesTotal / 60)}h</p>
                                            {day.overnightLocation && (
                                                <p className="text-[8px] text-amber-500 mt-2 truncate">🏨 {day.overnightLocation.name}</p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </>
                        );
                    })()}
                </div>
            )}
        </div>
    );
};

export default MasterScheduleGantt;
