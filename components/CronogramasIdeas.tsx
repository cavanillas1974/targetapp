import React from 'react';

interface CronogramasIdeasProps {
    isLightMode: boolean;
}

export const CronogramasIdeas: React.FC<CronogramasIdeasProps> = ({ isLightMode }) => {
    const IDEAS = [
        {
            id: 'cluster',
            title: 'Estrategia por Clúster Regional',
            description: 'Agrupar todas las tiendas de una misma zona metropolitana para minimizar el gasto de combustible y maximizar las visitas por día.',
            kpi: 'Ahorro: 15-20% en combustible',
            icon: '🗺️'
        },
        {
            id: 'express',
            title: 'Despliegue Ola Express',
            description: 'Priorizar las tiendas con mayor volumen de venta (Top 20%) para asegurar que la nueva señalética / POP esté lista en tiempo récord.',
            kpi: 'Impacto: 40% más visibilidad inicial',
            icon: '⚡'
        },
        {
            id: 'hybrid',
            title: 'Modelo Híbrido (Interno + Externo)',
            description: 'Combinar técnicos de planta para rutas urbanas y sub-contratación para zonas rurales extremas, optimizando el costo operativo.',
            kpi: 'Eficiencia: Cobertura del 100% geográfica',
            icon: '🤝'
        }
    ];

    return (
        <div className="space-y-12 animate-in fade-in zoom-in-95 duration-700">
            <div className="flex flex-col lg:flex-row items-center gap-12 bg-gradient-to-br from-blue-600 to-blue-900 rounded-[4rem] p-16 shadow-2xl relative overflow-hidden">
                {/* Background Decor */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-yellow-400/10 rounded-full translate-y-1/2 -translate-x-1/2 blur-2xl"></div>

                <div className="lg:w-1/2 space-y-8 relative z-10">
                    <div className="inline-flex items-center gap-3 px-6 py-2 bg-white/10 border border-white/20 rounded-full text-white text-[10px] font-black uppercase tracking-[0.3em] backdrop-blur-xl">
                        <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse"></span>
                        Engine Ideas v2.0
                    </div>
                    <h2 className="text-6xl font-black text-white uppercase italic tracking-tighter leading-none">
                        Potencia tu <br /> <span className="text-yellow-400">Cronograma</span>
                    </h2>
                    <p className="text-blue-100 text-lg font-medium leading-relaxed max-w-lg">
                        Nuestra IA ha detectado patrones estratégicos para tu próxima campaña. Selecciona una idea para ver cómo impactaría en tus KPis logísticos.
                    </p>
                    <button className="bg-white text-blue-900 px-12 py-5 rounded-3xl font-black uppercase tracking-widest hover:bg-yellow-400 transition-all hover:scale-105 active:scale-95 shadow-2xl shadow-blue-500/20">
                        Explorar Estrategias
                    </button>
                </div>

                <div className="lg:w-1/2 relative flex justify-center items-center">
                    <div className={`w-80 h-80 rounded-[5rem] overflow-hidden shadow-2xl ring-4 ring-white/10 bg-slate-900/40 backdrop-blur-3xl flex items-center justify-center group`}>
                        <img
                            src="/assets/banana_mascot.png"
                            alt="iamanos Tech Mascot"
                            className="w-full h-full object-cover transform scale-110 group-hover:rotate-6 group-hover:scale-125 transition-all duration-700"
                        />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {IDEAS.map((idea) => (
                    <div key={idea.id} className={`group p-10 rounded-[3.5rem] border transition-all duration-700 hover:-translate-y-4 hover:shadow-2xl ${isLightMode ? 'bg-white border-slate-100' : 'bg-slate-900/40 border-white/5 hover:border-blue-500/30'}`}>
                        <div className="w-20 h-20 rounded-3xl bg-blue-500/10 flex items-center justify-center text-4xl mb-8 group-hover:scale-110 group-hover:bg-blue-500 group-hover:text-white transition-all duration-500">
                            {idea.icon}
                        </div>
                        <h4 className={`text-2xl font-black uppercase italic tracking-tighter mb-4 ${isLightMode ? 'text-slate-900' : 'text-white'}`}>{idea.title}</h4>
                        <p className={`text-sm font-medium leading-relaxed mb-6 ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                            {idea.description}
                        </p>
                        <div className={`px-6 py-4 rounded-2xl ${isLightMode ? 'bg-emerald-50 text-emerald-700' : 'bg-emerald-500/10 text-emerald-400'} font-black text-[10px] uppercase tracking-widest inline-block`}>
                            {idea.kpi}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
