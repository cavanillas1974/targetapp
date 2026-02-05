import React, { useState, useRef, useEffect, useMemo } from 'react';
import { geminiService } from '../services/geminiService';
import { projectDatabase } from '../services/projectDatabase';

const ChatWindow: React.FC = () => {
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'model'; text: string }>>([
    { role: 'model', text: '👋 Hola, soy el **Cerebro Logístico OptiFlot™**.\n\nPuedo responder CUALQUIER pregunta sobre tu proyecto:\n• Cuántas tiendas\n• Cuántos kilómetros\n• Detalles de rutas\n• Ciudades\n• Fechas\n• Viaticos\n• Costos\n• Cualquier consulta logística\n\n¿Qué necesitas saber?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [apiStatus, setApiStatus] = useState<'unknown' | 'connected' | 'error'>('unknown');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Cargar contexto completo del proyecto activo
  const getProjectContext = async () => {
    try {
      const activeId = localStorage.getItem('iamanos_active_project_id');
      if (!activeId) {
        return { error: 'No hay proyecto activo' };
      }

      // Intentar cargar desde IndexedDB primero
      let project = await projectDatabase.loadProject(activeId);

      // Fallback a localStorage
      if (!project) {
        const saved = localStorage.getItem(`iamanos_project_${activeId}`);
        if (saved) {
          try {
            project = JSON.parse(saved);
          } catch {
            return { error: 'Proyecto corrupto' };
          }
        }
      }

      if (!project) {
        return { error: 'Proyecto no encontrado' };
      }

      // Extraer información relevante
      const sitesCount = project.sites?.length || 0;
      const routesCount = project.optimizedRoutes?.length || 0;

      // Calcular totales
      const totalKm = project.optimizedRoutes?.reduce((acc: number, r: any) => acc + (r.totalKm || 0), 0) || 0;

      // Rutas por fecha
      const routesByDate: Record<string, number> = {};
      project.optimizedRoutes?.forEach((route: any) => {
        const date = route.date || 'Sin fecha';
        routesByDate[date] = (routesByDate[date] || 0) + 1;
      });

      // Ciudades únicas
      const cities = new Set<string>();
      const states = new Set<string>();
      project.sites?.forEach((site: any) => {
        if (site.city) cities.add(site.city);
        if (site.state) states.add(site.state);
      });

      // Calcular días y viáticos
      let totalRouteDays = 0;
      project.optimizedRoutes?.forEach((route: any) => {
        const validDates = route.stops
          ?.map((s: any) => s.scheduled_date ? new Date(s.scheduled_date) : null)
          .filter((d: any) => d !== null && !isNaN(d.getTime())) || [];

        if (validDates.length > 0) {
          const minDate = new Date(Math.min(...validDates.map((d: any) => d.getTime())));
          const maxDate = new Date(Math.max(...validDates.map((d: any) => d.getTime())));
          const daysSpan = Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
          totalRouteDays += daysSpan;
        }
      });

      const dailyRate = 2000;
      const totalViaticos = totalRouteDays * dailyRate;
      const operationalCost = totalKm * 15;
      const subtotal = totalViaticos + operationalCost;
      const margin = subtotal * 0.30;
      const totalProjectValue = subtotal + margin;

      return {
        projectName: project.metadata?.name || 'Sin nombre',
        status: project.metadata?.status || 'PLANNING',
        tiendas: sitesCount,
        cuadrillas: routesCount,
        kilometrosTotales: Math.round(totalKm),
        diasRuta: totalRouteDays,
        viaticosTotal: totalViaticos,
        costoOperacional: operationalCost,
        valorProyecto: totalProjectValue,
        ciudades: Array.from(cities),
        estados: Array.from(states),
        rutasPorFecha: routesByDate,
        fechaInicio: project.config?.startDate,
        fechaFin: project.config?.endDate,
        tiendasPorCiudad: project.sites?.reduce((acc: any, site: any) => {
          const city = site.city || 'Sin ciudad';
          acc[city] = (acc[city] || 0) + 1;
          return acc;
        }, {}) || {},
        detallesRutas: project.optimizedRoutes?.map((r: any) => ({
          id: r.id,
          fecha: r.date,
          tiendas: r.stops?.length || 0,
          kilometros: r.totalKm || 0,
          conductor: r.driverName,
          ciudades: [...new Set(r.stops?.map((s: any) => s.city).filter(Boolean))]
        })) || []
      };
    } catch (error) {
      console.error('Error cargando contexto:', error);
      return { error: 'Error al cargar contexto del proyecto' };
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsLoading(true);

    try {
      // Cargar contexto completo
      const projectContext = await getProjectContext();

      // Crear prompt enriquecido con TODO el contexto
      const enrichedContext = projectContext.error
        ? { error: projectContext.error }
        : {
          ...projectContext,
          contextSummary: `
PROYECTO ACTIVO: ${projectContext.projectName}
STATUS: ${projectContext.status}

═══ RESUMEN EJECUTIVO ═══
• Tiendas totales: ${projectContext.tiendas}
• Cuadrillas asignadas: ${projectContext.cuadrillas}
• Kilómetros totales: ${projectContext.kilometrosTotales} km
• Días de ruta: ${projectContext.diasRuta} días
• Viáticos totales: $${projectContext.viaticosTotal?.toLocaleString()}
• Costo operacional: $${projectContext.costoOperacional?.toLocaleString()}
• Valor total del proyecto: $${projectContext.valorProyecto?.toLocaleString()}

═══ COBERTURA GEOGRÁFICA ═══
• Estados: ${projectContext.estados?.join(', ') || 'N/A'}
• Ciudades atendidas: ${projectContext.ciudades?.length || 0}
• Principales: ${projectContext.ciudades?.slice(0, 5).join(', ') || 'N/A'}

═══ FECHAS ═══
• Inicio: ${projectContext.fechaInicio || 'No definida'}
• Fin: ${projectContext.fechaFin || 'No definida'}

═══ DISTRIBUCIÓN POR CIUDAD ═══
${Object.entries(projectContext.tiendasPorCiudad || {})
              .sort(([, a]: any, [, b]: any) => b - a)
              .slice(0, 10)
              .map(([city, count]) => `• ${city}: ${count} tiendas`)
              .join('\n')}

═══ RUTAS DETALLADAS ═══
${projectContext.detallesRutas?.slice(0, 5).map((r: any, i: number) =>
                `Ruta ${i + 1} (${r.id}):
  - Fecha: ${r.fecha}
  - Tiendas: ${r.tiendas}
  - Km: ${r.kilometros}
  - Conductor: ${r.conductor}
  - Ciudades: ${r.ciudades?.join(', ') || 'N/A'}`
              ).join('\n\n')}

IMPORTANTE: Usa TODA esta información para responder preguntas específicas. Si te preguntan "cuántas tiendas", responde con el número exacto. Si preguntan sobre kilómetros, costos, ciudades, fechas, usa los datos arriba.
            `
        };

      const response = await geminiService.getChatResponse(messages, userMsg, enrichedContext);

      // Detectar si la respuesta es un mensaje de error del servicio
      if (response.startsWith('ERROR') || response.includes('Error 404') || response.includes('ERROR DE CONEXIÓN')) {
        setApiStatus('error');
      } else {
        setApiStatus('connected');
      }

      setMessages(prev => [...prev, { role: 'model', text: response }]);

    } catch (error: any) {
      console.error('Chat Error:', error);
      setApiStatus('error');

      // Mostrar error real en lugar de fallback simulado
      const errorMessage = `ERROR CRÍTICO: ${error.message || 'No se pudo conectar con el servicio de IA.'}\n\nPor favor verifique que la API Key en .env.local sea válida para Gemini (Google AI Studio) y no solo para Maps.`;
      setMessages(prev => [...prev, { role: 'model', text: errorMessage }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto h-[calc(100vh-180px)] flex flex-col bg-[#0f172a]/30 rounded-[3rem] border border-white/5 overflow-hidden shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] backdrop-blur-3xl animate-in fade-in duration-700">
      <div className="px-10 py-8 border-b border-white/[0.03] bg-white/[0.02] flex items-center justify-between">
        <div className="flex items-center gap-5">
          <div className={`w-4 h-4 rounded-full ${apiStatus === 'connected' ? 'bg-green-500' : apiStatus === 'error' ? 'bg-yellow-500' : 'bg-blue-500'} animate-pulse shadow-[0_0_15px_rgba(59,130,246,0.5)]`}></div>
          <div>
            <h3 className="font-black text-xl text-white tracking-tighter uppercase">CONSULTA LO QUE NECESITES</h3>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] mt-0.5">
              {apiStatus === 'connected' ? '🟢 Gemini Conectado' : apiStatus === 'error' ? '🔴 Error de Conexión' : 'Operación Nacional en Tiempo Real'}
            </p>
          </div>
        </div>
        <div className="px-4 py-2 bg-slate-900/50 rounded-xl border border-white/5 text-[10px] text-slate-400 font-black uppercase tracking-widest hidden md:block">
          Core: Gemini 2.0 Flash
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-10 space-y-8 custom-scrollbar">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-4 duration-500`}>
            <div className={`max-w-[75%] p-6 rounded-[2.5rem] shadow-2xl ${msg.role === 'user'
              ? 'bg-blue-600 text-white rounded-tr-none shadow-blue-600/10'
              : 'bg-slate-800/50 text-slate-200 rounded-tl-none border border-white/5 backdrop-blur-md'
              }`}>
              <p className="text-[15px] leading-relaxed font-medium whitespace-pre-wrap tracking-wide">{msg.text}</p>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start animate-in fade-in duration-300">
            <div className="bg-slate-800/40 p-6 rounded-[2.5rem] rounded-tl-none border border-white/5 flex gap-3 shadow-2xl">
              <div className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-bounce"></div>
              <div className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-bounce [animation-delay:0.2s]"></div>
              <div className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-bounce [animation-delay:0.4s]"></div>
            </div>
          </div>
        )}
      </div>

      <div className="p-8 bg-black/20 border-t border-white/[0.03]">
        <div className="relative flex items-center max-w-4xl mx-auto">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Escribe aquí tu duda logística..."
            className="w-full bg-slate-900 shadow-inner border border-white/5 rounded-[2.5rem] py-6 pl-10 pr-20 focus:outline-none focus:border-blue-500/50 transition-all text-[15px] font-medium text-slate-200"
          />
          <button
            onClick={handleSend}
            disabled={isLoading}
            className="absolute right-3 p-4 bg-blue-600 hover:bg-blue-500 rounded-[2rem] text-white transition-all disabled:opacity-50 shadow-lg shadow-blue-600/30 active:scale-90"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
          </button>
        </div>
        <div className="flex items-center justify-center gap-4 mt-6">
          <span className="h-px w-10 bg-white/5"></span>
          <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.3em]">
            iamanos × Target POP: Logística Avanzada
          </p>
          <span className="h-px w-10 bg-white/5"></span>
        </div>
      </div>
    </div>
  );
};

export default ChatWindow;
