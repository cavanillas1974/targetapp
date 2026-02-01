/**
 * ===================================================
 * ROUTE EDITOR - EDITOR DE RUTAS Y TIENDAS
 * ===================================================
 * Componente para mover tiendas entre rutas de forma
 * visual, intuitiva y con inserción precisa.
 */

import React, { useState, useMemo } from 'react';
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
    const [selectedStore, setSelectedStore] = useState<{ store: SiteRecord; routeId: string } | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedRoutes, setExpandedRoutes] = useState<Set<string>>(new Set(routes.map(r => r.id)));
    const [hasChanges, setHasChanges] = useState(false);

    // Estadísticas
    const stats = useMemo(() => {
        return {
            totalRoutes: localRoutes.length,
            totalStores: localRoutes.reduce((acc, r) => acc + r.stops.length, 0),
            totalKm: localRoutes.reduce((acc, r) => acc + r.totalKm, 0)
        };
    }, [localRoutes]);

    // Filtrar tiendas por búsqueda
    const getFilteredStores = (stores: SiteRecord[]) => {
        if (!searchTerm.trim()) return stores;
        const term = searchTerm.toLowerCase();
        return stores.filter(s =>
            s.name_sitio?.toLowerCase().includes(term) ||
            s.site_id?.toLowerCase().includes(term) ||
            s.direccion_completa?.toLowerCase().includes(term) ||
            s.region?.toLowerCase().includes(term)
        );
    };

    // Mover tienda a otra ruta
    const moveStore = (store: SiteRecord, fromRouteId: string, toRouteId: string, index?: number) => {
        if (fromRouteId === toRouteId) return;

        const updatedRoutes = localRoutes.map(route => {
            if (route.id === fromRouteId) {
                return {
                    ...route,
                    stops: route.stops.filter(s => s.id !== store.id)
                };
            }
            if (route.id === toRouteId) {
                const newStops = [...route.stops];
                const cleanStore = { ...store, routeId: toRouteId };

                if (typeof index === 'number' && index >= 0) {
                    newStops.splice(index, 0, cleanStore);
                } else {
                    newStops.push(cleanStore);
                }

                return {
                    ...route,
                    stops: newStops
                };
            }
            return route;
        });

        setLocalRoutes(updatedRoutes);
        setSelectedStore(null);
        setHasChanges(true);
    };

    // Confirmar cambios
    const handleConfirm = () => {
        onRoutesUpdate(localRoutes);
        onClose();
    };

    // Toggle expansión de ruta
    const toggleRoute = (routeId: string) => {
        const newExpanded = new Set(expandedRoutes);
        if (newExpanded.has(routeId)) {
            newExpanded.delete(routeId);
        } else {
            newExpanded.add(routeId);
        }
        setExpandedRoutes(newExpanded);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                onClick={onClose}
            ></div>

            {/* Modal */}
            <div className={`relative w-full max-w-6xl max-h-[90vh] ${isLightMode ? 'bg-white' : 'bg-slate-900'} rounded-[3rem] border ${isLightMode ? 'border-slate-200' : 'border-white/10'} shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300`}>
                {/* Header */}
                <div className={`px-10 py-8 border-b ${isLightMode ? 'border-slate-100 bg-slate-50' : 'border-white/5 bg-slate-800/40'}`}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-lg">
                                <span className="text-2xl">✏️</span>
                            </div>
                            <div>
                                <h2 className={`text-3xl font-black uppercase italic tracking-tight ${isLightMode ? 'text-slate-900' : 'text-white'}`}>
                                    Editor de Rutas
                                </h2>
                                <p className="text-slate-500 text-sm font-medium mt-1">
                                    Mueve tiendas entre rutas • Selecciona una tienda para ver opciones de inserción
                                </p>
                            </div>
                        </div>

                        <button
                            onClick={onClose}
                            className={`p-3 rounded-xl ${isLightMode ? 'hover:bg-slate-100' : 'hover:bg-white/10'} transition-colors`}
                        >
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path d="M18 6L6 18M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Stats & Search */}
                    <div className="flex items-center gap-6 mt-6">
                        <div className="flex gap-4">
                            {[
                                { label: 'Rutas', value: stats.totalRoutes, color: 'blue' },
                                { label: 'Tiendas', value: stats.totalStores, color: 'emerald' },
                                { label: 'KM Total', value: Math.round(stats.totalKm).toLocaleString(), color: 'purple' }
                            ].map((stat) => (
                                <div key={stat.label} className={`${isLightMode ? 'bg-white' : 'bg-white/5'} px-4 py-2 rounded-xl border ${isLightMode ? 'border-slate-100' : 'border-white/5'}`}>
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{stat.label}</span>
                                    <span className={`ml-2 font-black ${isLightMode ? 'text-slate-900' : 'text-white'}`}>{stat.value}</span>
                                </div>
                            ))}
                        </div>

                        <div className="flex-1">
                            <div className={`flex items-center gap-3 px-4 py-3 rounded-xl ${isLightMode ? 'bg-white border-slate-200' : 'bg-white/5 border-white/10'} border`}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2">
                                    <circle cx="11" cy="11" r="8" />
                                    <path d="M21 21l-4.35-4.35" />
                                </svg>
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Buscar tienda por nombre, ID o dirección..."
                                    className={`flex-1 bg-transparent outline-none text-sm ${isLightMode ? 'text-slate-900 placeholder:text-slate-400' : 'text-white placeholder:text-slate-600'}`}
                                />
                                {searchTerm && (
                                    <button onClick={() => setSearchTerm('')} className="text-slate-500 hover:text-white">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M18 6L6 18M6 6l12 12" />
                                        </svg>
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Instructions */}
                {selectedStore && (
                    <div className={`px-10 py-4 ${isLightMode ? 'bg-blue-50 border-blue-100' : 'bg-blue-500/10 border-blue-500/20'} border-b flex items-center gap-4`}>
                        <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center text-white">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path d="M5 12h14M12 5l7 7-7 7" />
                            </svg>
                        </div>
                        <div className="flex-1">
                            <p className={`font-bold ${isLightMode ? 'text-blue-900' : 'text-blue-300'}`}>
                                Tienda seleccionada: <span className="font-black">{selectedStore.store.name_sitio}</span>
                            </p>
                            <p className={`text-sm ${isLightMode ? 'text-blue-700' : 'text-blue-400'}`}>
                                Selecciona <strong>"Mover al Final"</strong> en una ruta o haz clic en las <strong>barras de inserción</strong> entre tiendas para colocarla en una posición específica.
                            </p>
                        </div>
                        <button
                            onClick={() => setSelectedStore(null)}
                            className="px-4 py-2 bg-blue-500 text-white rounded-xl text-sm font-bold hover:bg-blue-400 transition-colors"
                        >
                            Cancelar
                        </button>
                    </div>
                )}

                {/* Routes Grid */}
                <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {localRoutes.map((route) => {
                            const isExpanded = expandedRoutes.has(route.id);
                            const isTargetable = selectedStore && selectedStore.routeId !== route.id;
                            const filteredStores = getFilteredStores(route.stops);

                            return (
                                <div
                                    key={route.id}
                                    className={`${isLightMode ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/5'} rounded-3xl border overflow-hidden transition-all ${isTargetable ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-900' : ''
                                        }`}
                                >
                                    {/* Route Header */}
                                    <div
                                        className={`px-6 py-4 flex items-center justify-between cursor-pointer ${isLightMode ? 'hover:bg-slate-100' : 'hover:bg-white/5'} transition-colors`}
                                        onClick={() => toggleRoute(route.id)}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div
                                                className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black shadow-lg"
                                                style={{ backgroundColor: route.color }}
                                            >
                                                {route.id}
                                            </div>
                                            <div>
                                                <p className={`font-black uppercase tracking-tight ${isLightMode ? 'text-slate-900' : 'text-white'}`}>
                                                    {route.corridorName || route.driverName}
                                                </p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${isLightMode ? 'bg-slate-200 text-slate-600' : 'bg-white/10 text-slate-400'}`}>
                                                        {route.direction || route.base}
                                                    </span>
                                                    <span className="text-[10px] text-slate-500">
                                                        {route.stops.length} tiendas • {Math.round(route.totalKm)} km
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {isTargetable ? (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    moveStore(selectedStore.store, selectedStore.routeId, route.id);
                                                }}
                                                className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-xl text-sm font-bold hover:bg-blue-600 transition-colors z-10 shadow-lg shadow-blue-500/30"
                                            >
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                    <path d="M5 12h14M12 5l7 7-7 7" />
                                                </svg>
                                                Mover al Final
                                            </button>
                                        ) : (
                                            <button
                                                className={`p-2 rounded-lg transition-colors ${isLightMode ? 'hover:bg-slate-200' : 'hover:bg-white/10'}`}
                                            >
                                                <svg
                                                    width="20" height="20"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                    className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
                                                >
                                                    <path d="M6 9l6 6 6-6" />
                                                </svg>
                                            </button>
                                        )}
                                    </div>

                                    {/* Stores List */}
                                    {isExpanded && (
                                        <div className={`border-t ${isLightMode ? 'border-slate-200' : 'border-white/5'} max-h-[400px] overflow-y-auto custom-scrollbar`}>
                                            {filteredStores.length === 0 ? (
                                                <div className="p-6 text-center">
                                                    <p className="text-slate-500 text-sm">
                                                        {searchTerm ? 'No se encontraron tiendas con ese criterio' : 'Sin tiendas asignadas'}
                                                    </p>
                                                    {isTargetable && (
                                                        <button
                                                            onClick={() => moveStore(selectedStore.store, selectedStore.routeId, route.id, 0)}
                                                            className="mt-4 text-blue-500 font-bold hover:underline"
                                                        >
                                                            + Insertar aquí como primera tienda
                                                        </button>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="divide-y divide-white/5">
                                                    {filteredStores.map((store, idx) => {
                                                        const isSelected = selectedStore?.store.id === store.id;
                                                        // Find actual index in the master route array to ensure correct insertion
                                                        const actualIndex = route.stops.findIndex(s => s.id === store.id);

                                                        return (
                                                            <React.Fragment key={store.id}>
                                                                {/* Insertion Zone (Before Item) - Only when targetable */}
                                                                {isTargetable && (
                                                                    <div
                                                                        className={`h-2 hover:h-8 transition-all duration-200 flex items-center justify-center cursor-pointer group ${isLightMode ? 'hover:bg-blue-50' : 'hover:bg-blue-500/10'}`}
                                                                        onClick={() => moveStore(selectedStore.store, selectedStore.routeId, route.id, actualIndex)}
                                                                    >
                                                                        <div className="w-full h-[1px] bg-blue-500/0 group-hover:bg-blue-500/50 relative flex items-center justify-center">
                                                                            <span className="opacity-0 group-hover:opacity-100 bg-blue-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold shadow-sm transform scale-0 group-hover:scale-100 transition-all">
                                                                                + Insertar en Posición {actualIndex + 1}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                <div
                                                                    className={`px-6 py-3 flex items-center gap-4 cursor-pointer transition-all ${isSelected
                                                                        ? (isLightMode ? 'bg-blue-100' : 'bg-blue-500/20')
                                                                        : (isLightMode ? 'hover:bg-slate-100' : 'hover:bg-white/5')
                                                                        }`}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        if (isSelected) {
                                                                            setSelectedStore(null);
                                                                        } else {
                                                                            setSelectedStore({ store, routeId: route.id });
                                                                        }
                                                                    }}
                                                                >
                                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black ${isSelected
                                                                        ? 'bg-blue-500 text-white'
                                                                        : isLightMode ? 'bg-slate-200 text-slate-600' : 'bg-white/10 text-slate-400'
                                                                        }`}>
                                                                        {idx + 1}
                                                                    </div>

                                                                    <div className="flex-1 min-w-0">
                                                                        <p className={`font-bold truncate ${isLightMode ? 'text-slate-900' : 'text-white'}`}>
                                                                            {store.name_sitio}
                                                                        </p>
                                                                        <p className="text-[10px] text-slate-500 truncate">
                                                                            {store.formatted_address || store.direccion_completa}
                                                                        </p>
                                                                    </div>

                                                                    <div className="flex items-center gap-2">
                                                                        {store.region && (
                                                                            <span className={`text-[8px] font-bold uppercase tracking-widest px-2 py-1 rounded ${isLightMode ? 'bg-slate-100 text-slate-600' : 'bg-white/5 text-slate-500'}`}>
                                                                                {store.region}
                                                                            </span>
                                                                        )}
                                                                        {/* Dropdown Legacy - Mover directamente al final de otra ruta */}
                                                                        <select
                                                                            value=""
                                                                            onChange={(e) => {
                                                                                e.stopPropagation();
                                                                                if (e.target.value) {
                                                                                    moveStore(store, route.id, e.target.value);
                                                                                }
                                                                            }}
                                                                            onClick={(e) => e.stopPropagation()}
                                                                            className={`text-[10px] font-bold rounded-lg px-2 py-1 cursor-pointer ${isLightMode
                                                                                ? 'bg-blue-100 text-blue-700 border-blue-200'
                                                                                : 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                                                                                } border outline-none hover:bg-blue-500/30 transition-colors`}
                                                                        >
                                                                            <option value="">📦 Mover a...</option>
                                                                            {localRoutes
                                                                                .filter(r => r.id !== route.id)
                                                                                .map(r => (
                                                                                    <option key={r.id} value={r.id}>
                                                                                        R-{String(r.id).padStart(2, '0')} | {r.corridorName || r.driverName}
                                                                                    </option>
                                                                                ))
                                                                            }
                                                                        </select>
                                                                    </div>
                                                                </div>
                                                            </React.Fragment>
                                                        );
                                                    })}

                                                    {/* Insertion Zone (After Last Item) - Only when targetable */}
                                                    {isTargetable && filteredStores.length > 0 && (
                                                        <div
                                                            className={`h-2 hover:h-8 transition-all duration-200 flex items-center justify-center cursor-pointer group ${isLightMode ? 'hover:bg-blue-50' : 'hover:bg-blue-500/10'}`}
                                                            onClick={() => moveStore(selectedStore.store, selectedStore.routeId, route.id, route.stops.length)}
                                                        >
                                                            <div className="w-full h-[1px] bg-blue-500/0 group-hover:bg-blue-500/50 relative flex items-center justify-center">
                                                                <span className="opacity-0 group-hover:opacity-100 bg-blue-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold shadow-sm transform scale-0 group-hover:scale-100 transition-all">
                                                                    + Insertar al Final
                                                                </span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Footer */}
                <div className={`px-10 py-6 border-t ${isLightMode ? 'border-slate-100 bg-slate-50' : 'border-white/5 bg-slate-800/40'} flex items-center justify-between`}>
                    <div className="flex items-center gap-4">
                        {hasChanges && (
                            <p className="text-amber-500 text-sm font-bold flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                                Cambios sin guardar
                            </p>
                        )}
                    </div>

                    <div className="flex items-center gap-4">
                        <button
                            onClick={onClose}
                            className={`px-6 py-3 rounded-xl font-bold text-sm ${isLightMode ? 'bg-slate-200 text-slate-700 hover:bg-slate-300' : 'bg-white/10 text-white hover:bg-white/20'} transition-colors`}
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={!hasChanges}
                            className={`px-8 py-3 rounded-xl font-bold text-sm transition-all ${hasChanges
                                ? 'bg-emerald-500 text-white hover:bg-emerald-400 shadow-lg shadow-emerald-500/30'
                                : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                                }`}
                        >
                            {hasChanges ? '✓ Guardar Cambios' : 'Sin Cambios'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RouteEditor;
