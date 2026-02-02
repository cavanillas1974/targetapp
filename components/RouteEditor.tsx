/**
 * ===================================================
 * ROUTE EDITOR - DRAG & DROP INTUITIVO (ESCUELA PRIMARIA)
 * ===================================================
 * "Arrastra y suelta" para mover tiendas.
 * Extremadamente visual y fácil de usar.
 */

import React, { useState, useMemo, useRef } from 'react';
import { SiteRecord } from '../types';

interface Route {
    id: string;
    corridorId?: string;
    corridorName?: string;
    direction?: string;
    base: string;
    hub?: { name: string };
    driverName: string;
    stops: SiteRecord[];
    totalKm: number;
    color: string;
}

interface RouteEditorProps {
    routes: Route[];
    isLightMode: boolean;
    onRoutesUpdate: (updatedRoutes: Route[]) => void;
    onClose: () => void;
}

export const RouteEditor: React.FC<RouteEditorProps> = ({
    routes,
    isLightMode,
    onRoutesUpdate,
    onClose
}) => {
    const [localRoutes, setLocalRoutes] = useState<Route[]>([...routes]);
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedRoutes, setExpandedRoutes] = useState<Set<string>>(new Set(routes.map(r => r.id)));
    const [hasChanges, setHasChanges] = useState(false);

    // Drag & Drop State
    const [draggingItem, setDraggingItem] = useState<{ store: SiteRecord, fromRouteId: string } | null>(null);
    const [dragOverRouteId, setDragOverRouteId] = useState<string | null>(null);

    // Estadísticas
    const stats = useMemo(() => {
        return {
            totalRoutes: localRoutes.length,
            totalStores: localRoutes.reduce((acc, r) => acc + r.stops.length, 0),
            totalKm: localRoutes.reduce((acc, r) => acc + r.totalKm, 0)
        };
    }, [localRoutes]);

    // Filtrar tiendas
    const getFilteredStores = (stops: SiteRecord[]) => {
        if (!searchTerm.trim()) return stops;
        const term = searchTerm.toLowerCase();
        return stops.filter(s =>
            s.name_sitio?.toLowerCase().includes(term) ||
            s.site_id?.toLowerCase().includes(term) ||
            s.direccion_completa?.toLowerCase().includes(term)
        );
    };

    // Toggle expansión de ruta
    const toggleRoute = (routeId: string) => {
        const newExpanded = new Set(expandedRoutes);
        if (newExpanded.has(routeId)) newExpanded.delete(routeId);
        else newExpanded.add(routeId);
        setExpandedRoutes(newExpanded);
    };

    // --- LOGICA DRAG & DROP ---

    const handleDragStart = (e: React.DragEvent, store: SiteRecord, fromRouteId: string) => {
        setDraggingItem({ store, fromRouteId });
        e.dataTransfer.effectAllowed = "move";
        // Ghost image styling logic can be added here if needed
        // e.dataTransfer.setDragImage(img, 0, 0);
    };

    const handleDragOver = (e: React.DragEvent, routeId: string) => {
        e.preventDefault(); // Necesario para permitir Drop
        if (draggingItem && draggingItem.fromRouteId !== routeId) {
            setDragOverRouteId(routeId);
        }
    };

    const handleDragLeave = () => {
        setDragOverRouteId(null);
    };

    const handleDrop = (e: React.DragEvent, targetRouteId: string) => {
        e.preventDefault();
        setDragOverRouteId(null);

        if (!draggingItem) return;
        if (draggingItem.fromRouteId === targetRouteId) return;

        // Ejecutar el movimiento
        const updatedRoutes = localRoutes.map(route => {
            // 1. Quitar de la ruta origen
            if (route.id === draggingItem.fromRouteId) {
                return {
                    ...route,
                    stops: route.stops.filter(s => s.id !== draggingItem.store.id)
                };
            }
            // 2. Agregar a la ruta destino (al final por defecto en modo "Drop en Caja")
            if (route.id === targetRouteId) {
                return {
                    ...route,
                    stops: [...route.stops, { ...draggingItem.store, routeId: targetRouteId }]
                };
            }
            return route;
        });

        setLocalRoutes(updatedRoutes);
        setHasChanges(true);
        setDraggingItem(null);
    };

    const handleConfirm = () => {
        onRoutesUpdate(localRoutes);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

            <div className={`relative w-full max-w-7xl h-[90vh] ${isLightMode ? 'bg-[#F0F4F8]' : 'bg-[#0B1121]'} rounded-[2.5rem] border ${isLightMode ? 'border-white' : 'border-white/10'} shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300`}>

                {/* Header Intuitivo */}
                <div className={`px-10 py-6 border-b ${isLightMode ? 'bg-white border-slate-200' : 'bg-[#0f172a] border-white/5'} flex justify-between items-center z-20`}>
                    <div className="flex items-center gap-6">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20 transform hover:scale-110 transition-transform">
                            <span className="text-3xl">🖐️</span>
                        </div>
                        <div>
                            <h2 className={`text-4xl font-black uppercase italic tracking-tighter ${isLightMode ? 'text-slate-800' : 'text-white'}`}>
                                Editor Táctil
                            </h2>
                            <p className={`text-sm font-bold uppercase tracking-widest ${isLightMode ? 'text-blue-500' : 'text-blue-400'}`}>
                                {hasChanges ? '⚠️ Tienes cambios pendientes' : 'Arrastra las tiendas para moverlas de ruta'}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className={`flex items-center gap-3 px-6 py-4 rounded-xl ${isLightMode ? 'bg-slate-100' : 'bg-black/20'} border border-transparent focus-within:border-blue-500 transition-all w-96`}>
                            <span className="text-2xl">🔍</span>
                            <input
                                type="text"
                                placeholder="Buscar tienda..."
                                className="bg-transparent border-none outline-none w-full font-bold text-lg"
                                style={{ color: isLightMode ? '#334155' : 'white' }}
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <button
                            onClick={onClose}
                            className={`w-14 h-14 rounded-full flex items-center justify-center ${isLightMode ? 'bg-slate-200 hover:bg-slate-300 text-slate-600' : 'bg-white/10 hover:bg-white/20 text-white'} transition-all`}
                        >
                            <svg width="24" height="24" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" /></svg>
                        </button>
                    </div>
                </div>

                {/* Grid de Rutas (Zona de Juego) */}
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-repeat" style={{ backgroundImage: isLightMode ? 'radial-gradient(#cbd5e1 1px, transparent 1px)' : 'radial-gradient(#1e293b 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 items-start">
                        {localRoutes.map((route) => {
                            const isExpanded = expandedRoutes.has(route.id);
                            // Estado Visual: ¿Es esta ruta un destino válido para soltar?
                            const isDropTarget = dragOverRouteId === route.id && draggingItem?.fromRouteId !== route.id;
                            const isSource = draggingItem?.fromRouteId === route.id;

                            return (
                                <div
                                    key={route.id}
                                    onDragOver={(e) => handleDragOver(e, route.id)}
                                    onDragLeave={handleDragLeave}
                                    onDrop={(e) => handleDrop(e, route.id)}
                                    className={`
                                        relative flex flex-col rounded-[2rem] transition-all duration-300
                                        ${isDropTarget
                                            ? 'scale-105 ring-4 ring-emerald-400 bg-emerald-900/20 border-emerald-500 shadow-2xl z-10'
                                            : (isLightMode ? 'bg-white border-slate-200 shadow-xl' : 'bg-[#0f172a] border-white/5 shadow-lg')
                                        }
                                        border-2
                                    `}
                                >
                                    {/* Overlay de "Suelta Aquí" */}
                                    {isDropTarget && (
                                        <div className="absolute inset-0 bg-emerald-500/10 z-50 flex items-center justify-center rounded-[2rem] backdrop-blur-[2px] pointer-events-none">
                                            <div className="bg-emerald-500 text-white px-6 py-2 rounded-full font-black text-xl uppercase tracking-widest shadow-xl transform scale-110 animate-bounce">
                                                Suelta Aquí
                                            </div>
                                        </div>
                                    )}

                                    {/* Route Header Card */}
                                    <div
                                        className={`p-5 cursor-pointer rounded-t-[2rem] ${isDropTarget ? 'bg-emerald-500/10' : ''}`}
                                        onClick={() => toggleRoute(route.id)}
                                    >
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-black text-lg shadow-md" style={{ backgroundColor: route.color }}>
                                                {String(route.id).replace(/\D/g, '')}
                                            </div>
                                            <div className="text-right">
                                                <span className={`block text-[10px] font-bold uppercase tracking-widest ${isLightMode ? 'text-slate-400' : 'text-slate-500'}`}>KM Total</span>
                                                <span className={`block text-lg font-black ${isLightMode ? 'text-slate-800' : 'text-white'}`}>{Math.round(route.totalKm)}</span>
                                            </div>
                                        </div>

                                        <h3 className={`text-lg font-black uppercase leading-tight mb-1 truncate ${isLightMode ? 'text-slate-800' : 'text-white'}`}>
                                            {route.driverName || 'Sin Asignar'}
                                        </h3>
                                        <p className={`text-xs font-bold uppercase tracking-wider ${isLightMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                            {route.stops.length} Tiendas • {route.direction || 'Ruta'}
                                        </p>
                                    </div>

                                    {/* Lista de Tiendas Dragables */}
                                    {isExpanded && (
                                        <div className={`flex-1 p-2 max-h-[400px] overflow-y-auto custom-scrollbar ${isDropTarget ? 'bg-emerald-500/5' : ''}`}>
                                            <div className="space-y-2">
                                                {getFilteredStores(route.stops).map((store, idx) => (
                                                    <div
                                                        key={store.id}
                                                        draggable
                                                        onDragStart={(e) => handleDragStart(e, store, route.id)}
                                                        className={`
                                                            group relative p-3 rounded-xl border transition-all cursor-grab active:cursor-grabbing
                                                            ${isLightMode
                                                                ? 'bg-slate-50 border-slate-100 hover:bg-white hover:shadow-md'
                                                                : 'bg-white/5 border-white/5 hover:bg-[#1e293b] hover:border-blue-500/30'
                                                            }
                                                            ${draggingItem?.store.id === store.id ? 'opacity-50 scale-95 ring-2 ring-blue-500' : ''}
                                                        `}
                                                    >
                                                        {/* Handle Visual */}
                                                        <div className={`absolute left-2 top-1/2 -translate-y-1/2 flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 text-slate-400`}>
                                                            <div className="w-1 h-1 rounded-full bg-current"></div>
                                                            <div className="w-1 h-1 rounded-full bg-current"></div>
                                                            <div className="w-1 h-1 rounded-full bg-current"></div>
                                                        </div>

                                                        <div className="pl-6">
                                                            <p className={`text-[10px] font-bold ${isLightMode ? 'text-slate-400' : 'text-blue-400'} uppercase mb-0.5`}>
                                                                #{idx + 1}
                                                            </p>
                                                            <p className={`text-xs font-black uppercase leading-tight mb-1 ${isLightMode ? 'text-slate-700' : 'text-slate-200'}`}>
                                                                {store.name_sitio}
                                                            </p>
                                                            <p className="text-[9px] text-slate-500 truncate font-medium">
                                                                {store.city || store.municipio}
                                                            </p>
                                                        </div>
                                                    </div>
                                                ))}
                                                {getFilteredStores(route.stops).length === 0 && (
                                                    <div className="text-center py-8 opacity-40">
                                                        <p className="text-4xl mb-2">👻</p>
                                                        <p className="text-xs font-bold uppercase">Ruta Vacía</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Botón de Toggle si está colapsado */}
                                    {!isExpanded && (
                                        <button
                                            onClick={() => toggleRoute(route.id)}
                                            className={`mx-5 mb-5 mt-2 py-3 rounded-xl text-xs font-bold uppercase tracking-widest ${isLightMode ? 'bg-slate-100 text-slate-500 hover:bg-slate-200' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
                                        >
                                            Ver Tiendas
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Footer Flotante de Confirmación */}
                <div className={`p-6 border-t ${isLightMode ? 'bg-white border-slate-200' : 'bg-[#0f172a] border-white/5'} flex justify-between items-center z-50`}>
                    <div className="flex items-center gap-4 text-xs font-bold text-slate-500 uppercase tracking-widest">
                        <span>📊 Resumen Global:</span>
                        <span className="bg-blue-500/10 text-blue-500 px-3 py-1 rounded-lg">{stats.totalStores} Tiendas</span>
                        <span className="bg-emerald-500/10 text-emerald-500 px-3 py-1 rounded-lg">{Math.round(stats.totalKm)} KM</span>
                    </div>
                    <div className="flex gap-4">
                        <button
                            onClick={onClose}
                            className={`px-8 py-4 rounded-2xl font-bold uppercase tracking-widest text-xs transition-colors ${isLightMode ? 'bg-slate-100 text-slate-500 hover:bg-slate-200' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={!hasChanges}
                            className={`px-10 py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl transition-all transform hover:scale-105 ${hasChanges ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:shadow-blue-500/40' : 'bg-slate-800 text-slate-600 cursor-not-allowed'}`}
                        >
                            {hasChanges ? '💾 Guardar Cambios' : 'Sin Cambios'}
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default RouteEditor;
