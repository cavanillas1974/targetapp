
import React, { useState, useRef, useEffect } from 'react';
import { geminiService } from '../services/geminiService';
import { COLORS } from '../constants';
import { ChatMessage } from '../types';

const ChatWindow: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'model', text: 'Bienvenido al Centro de Mando iamanos. Soy tu estratega logístico para Target POP. ¿En qué puedo asistirte con el despliegue nacional hoy?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsLoading(true);

    try {
      const response = await geminiService.getChatResponse(messages, userMsg);
      setMessages(prev => [...prev, { role: 'model', text: response }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'model', text: 'Sistema temporalmente fuera de línea. Por favor reintente en unos momentos.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto h-[calc(100vh-180px)] flex flex-col bg-[#0f172a]/30 rounded-[3rem] border border-white/5 overflow-hidden shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] backdrop-blur-3xl animate-in fade-in duration-700">
      <div className="px-10 py-8 border-b border-white/[0.03] bg-white/[0.02] flex items-center justify-between">
        <div className="flex items-center gap-5">
          <div className="w-4 h-4 rounded-full bg-blue-500 animate-pulse shadow-[0_0_15px_rgba(59,130,246,0.5)]"></div>
          <div>
            <h3 className="font-black text-xl text-white tracking-tighter uppercase">iamanos Command AI</h3>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] mt-0.5">Operación Nacional en Tiempo Real</p>
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
            placeholder="Consultar métricas, cobertura o solicitar optimización..."
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
