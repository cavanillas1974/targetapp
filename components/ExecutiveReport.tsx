
import React from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    Cell, PieChart, Pie, AreaChart, Area
} from 'recharts';
import { COLORS } from '../constants';
import targetLogo from '../Images/logo.png';

interface ExecutiveReportProps {
    routes: any[];
    sites: any[];
    config: any;
    isLightMode: boolean;
}

const ExecutiveReport: React.FC<ExecutiveReportProps> = ({ routes, sites, config, isLightMode }) => {
    // Calcular métricas agregadas CORRECTAMENTE
    // ✅ Contar tiendas ÚNICAS (no duplicar)
    const uniqueStoreIds = new Set(routes.flatMap(r => r.stops?.map((s: any) => s.id) || []));
    const totalStops = uniqueStoreIds.size; // Tiendas ÚNICAS

    const totalKm = routes.reduce((acc, r) => acc + (r.totalKm || 0), 0);
    const totalRoutes = routes.length;

    // Datos para gráfico de barras: Tiendas por día
    const dailyData = routes.reduce((acc: any[], r) => {
        const date = r.date;
        const existing = acc.find(d => d.date === date);
        if (existing) {
            existing.stops += (r.stops?.length || 0);
            existing.routes += 1;
        } else {
            acc.push({ date, stops: r.stops?.length || 0, routes: 1 });
        }
        return acc;
    }, []).sort((a, b) => a.date.localeCompare(b.date));

    // Datos para distribución por base
    const baseData = routes.reduce((acc: any[], r) => {
        const existing = acc.find(b => b.name === r.base);
        if (existing) {
            existing.value += 1;
        } else {
            acc.push({ name: r.base, value: 1 });
        }
        return acc;
    }, []);

    const cardClass = isLightMode
        ? "bg-white border-slate-200 shadow-xl"
        : "bg-[#0f172a] border-white/5 shadow-2xl";

    const textTitle = isLightMode ? "text-slate-900" : "text-white";
    const textDim = isLightMode ? "text-slate-500" : "text-slate-400";

    return (
        <div id="executive-report-export" className={`p-12 space-y-12 ${isLightMode ? 'bg-slate-50' : 'bg-[#030712]'} min-h-screen font-['Inter']`} style={{ width: '1200px' }}>
            {/* Header Corporativo */}
            <div className="flex justify-between items-end border-b border-blue-500/20 pb-10">
                <div>
                    <div className="flex items-center gap-8 mb-6">
                        <div className="w-40 h-40 bg-white rounded-[2.5rem] flex items-center justify-center shadow-2xl p-6 overflow-hidden border-2 border-blue-500/10">
                            <img src={targetLogo} alt="Target Logo" className="w-full h-full object-contain scale-110 drop-shadow-2xl" />
                        </div>
                        <div className="flex flex-col gap-2">
                            <h2 className={`${textTitle} text-5xl font-black uppercase tracking-tighter`}>Informe Ejecutivo</h2>
                            <span className="text-blue-500 text-xs font-black bg-blue-500/10 px-4 py-1.5 rounded-xl border border-blue-500/20 not-italic w-fit uppercase tracking-widest">
                                Optimización de Rutas
                            </span>
                        </div>
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-[0.5em] text-blue-500/60">Informe Operativo de Optimización Logística</p>
                </div>
                <div className="text-right">
                    <p className={`${textDim} text-xs font-bold uppercase tracking-widest`}>Periodo de Ejecución</p>
                    <p className={`${textTitle} text-xl font-black mt-1`}>{config.startDate} <span className="text-blue-500">—</span> {config.endDate}</p>
                </div>
            </div>

            {/* KPI Dashboard */}
            <div className="grid grid-cols-4 gap-8">
                {[
                    { label: 'Total Rutas', value: totalRoutes, unit: 'unidades', color: 'blue' },
                    { label: 'Puntos de Venta', value: totalStops, unit: 'tiendas únicas', color: 'emerald' },
                    { label: 'Recorrido Total', value: `${Math.round(totalKm).toLocaleString()}`, unit: 'kilómetros', color: 'amber' },
                    { label: 'Viáticos y Operación', value: `$${Math.round(totalKm * 15).toLocaleString()}`, unit: 'pesos mxn', color: 'rose' },
                ].map((kpi, i) => (
                    <div key={i} className={`${cardClass} p-10 rounded-[3rem] border relative overflow-hidden group`}>
                        <div className={`absolute top-0 right-0 w-32 h-32 bg-${kpi.color}-500/5 blur-3xl -mr-16 -mt-16`}></div>
                        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 mb-4">{kpi.label}</p>
                        <div className="flex items-baseline gap-2">
                            <span className={`text-4xl font-black ${textTitle}`}>{kpi.value}</span>
                            <span className="text-[10px] font-bold text-slate-500 uppercase italic tracking-widest">{kpi.unit}</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-3 gap-8">
                <div className={`${cardClass} col-span-2 p-10 rounded-[3rem] border space-y-8`}>
                    <div className="flex justify-between items-center">
                        <h3 className={`text-lg font-black uppercase tracking-tighter ${textTitle}`}>Carga de Trabajo por Día</h3>
                        <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest bg-blue-500/10 px-3 py-1 rounded-full">Proyección Temporal</span>
                    </div>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={dailyData}>
                                <defs>
                                    <linearGradient id="colorStops" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isLightMode ? '#e2e8f0' : '#1e293b'} />
                                <XAxis dataKey="date" hide />
                                <YAxis hide />
                                <Tooltip
                                    contentStyle={{ backgroundColor: isLightMode ? '#fff' : '#0f172a', borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                                    itemStyle={{ fontWeight: 'bold', fontSize: '12px' }}
                                />
                                <Area type="monotone" dataKey="stops" stroke="#2563eb" strokeWidth={4} fillOpacity={1} fill="url(#colorStops)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className={`${cardClass} p-10 rounded-[3rem] border space-y-8`}>
                    <h3 className={`text-lg font-black uppercase tracking-tighter ${textTitle}`}>Distribución Base</h3>
                    <div className="h-[300px] w-full flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={baseData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={100}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {baseData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#2563eb' : '#10b981'} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="space-y-2">
                        {baseData.map((b, i) => (
                            <div key={i} className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full`} style={{ backgroundColor: i % 2 === 0 ? '#2563eb' : '#10b981' }}></div>
                                    <span className={`text-[10px] font-black uppercase ${textDim}`}>{b.name}</span>
                                </div>
                                <span className={`text-xs font-black ${textTitle}`}>{b.value} Rtas</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Timeline de Rutas (Gantt) */}
            <div className={`${cardClass} p-10 rounded-[3rem] border space-y-8`}>
                <div className="flex justify-between items-center">
                    <h3 className={`text-lg font-black uppercase tracking-tighter ${textTitle}`}>Cronograma de Secuencias Operativas</h3>
                    <p className="text-[10px] font-bold text-slate-500 italic uppercase">Desglose de ejecución por unidad logística</p>
                </div>

                <div className="space-y-4">
                    {routes.slice(0, 8).map((r, i) => (
                        <div key={i} className="flex items-center gap-6">
                            <div className="w-24 shrink-0">
                                <p className={`text-[10px] font-black uppercase ${textTitle}`}>Ruta {r.id}</p>
                                <p className="text-[8px] text-slate-500 font-bold uppercase tracking-tighter">{r.base}</p>
                            </div>
                            <div className="flex-1 h-3 bg-slate-800/10 rounded-full relative overflow-hidden">
                                <div
                                    className="absolute inset-y-0 bg-blue-600 rounded-full"
                                    style={{
                                        left: `${(i % 5) * 10}%`,
                                        width: `${40 + (r.stops.length * 2)}%`,
                                        backgroundColor: r.color
                                    }}
                                ></div>
                            </div>
                            <div className="w-20 text-right">
                                <span className={`text-[10px] font-black ${textTitle}`}>{r.stops.length} Tiendas</span>
                            </div>
                        </div>
                    ))}
                    {routes.length > 8 && (
                        <p className="text-center text-[10px] font-black text-slate-500 uppercase pt-4">+ {routes.length - 8} RUTAS ADICIONALES EN EL REPORTE COMPLETO</p>
                    )}
                </div>
            </div>

            <div className="pt-10 border-t border-slate-800/10 flex justify-between items-center">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em]">iamanos OptiFlot™ AI Engine v2.4.1</p>
                <p className="text-[9px] font-bold text-slate-500 italic">Generado el {new Date().toLocaleDateString()} a las {new Date().toLocaleTimeString()}</p>
            </div>
        </div>
    );
};

export default ExecutiveReport;
