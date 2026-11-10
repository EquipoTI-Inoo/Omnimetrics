import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot, User, Loader2, Minimize2 } from 'lucide-react';
import { getSupportResponse } from '../services/geminiService';

interface Message {
    id: string;
    role: 'user' | 'model';
    text: string;
}

export const SupportChat: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        { id: 'welcome', role: 'model', text: '¡Hola! Soy OmniBot 🤖. ¿Tienes problemas para conectar tus APIs o dudas sobre el dashboard? Estoy aquí para ayudarte 24/7.' }
    ]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        if (isOpen) scrollToBottom();
    }, [messages, isOpen]);

    const handleSend = async () => {
        if (!inputValue.trim()) return;

        const userText = inputValue;
        setInputValue('');
        
        // Add User Message
        const userMsg: Message = { id: Date.now().toString(), role: 'user', text: userText };
        const newHistory = [...messages, userMsg];
        setMessages(newHistory);
        setIsLoading(true);

        // Prepare context for API (exclude welcome message ID if strictly needed, but Gemini handles it well)
        // We map to the format expected by the service
        const apiHistory = newHistory.map(m => ({ role: m.role, text: m.text }));

        // Call AI
        const responseText = await getSupportResponse(apiHistory, userText);
        
        // Add AI Response
        setMessages(prev => [...prev, {
            id: (Date.now() + 1).toString(),
            role: 'model',
            text: responseText
        }]);
        setIsLoading(false);
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 flex flex-col items-end pointer-events-none">
            
            {/* CHAT WINDOW */}
            {isOpen && (
                <div className="pointer-events-auto bg-white dark:bg-slate-900 w-[calc(100vw-2rem)] max-w-80 sm:w-96 sm:max-w-96 h-[500px] max-h-[calc(100dvh-7rem)] rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700 flex flex-col overflow-hidden mb-4 animate-in slide-in-from-bottom-5 duration-300">
                    
                    {/* Header */}
                    <div className="bg-indigo-600 p-4 flex justify-between items-center text-white">
                        <div className="flex items-center space-x-2">
                            <div className="bg-white/20 p-1.5 rounded-full">
                                <Bot className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <h3 className="font-bold text-sm">Soporte OmniMetrics</h3>
                                <p className="text-xs text-indigo-200 flex items-center">
                                    <span className="h-1.5 w-1.5 bg-green-400 rounded-full mr-1.5 animate-pulse"></span>
                                    En línea
                                </p>
                            </div>
                        </div>
                        <button 
                            onClick={() => setIsOpen(false)} 
                            className="text-white/80 hover:text-white hover:bg-white/10 p-1 rounded transition-colors"
                        >
                            <Minimize2 className="h-5 w-5" />
                        </button>
                    </div>

                    {/* Messages Area */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-slate-950">
                        {messages.map((msg) => (
                            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                                    msg.role === 'user' 
                                    ? 'bg-indigo-600 text-white rounded-br-none' 
                                    : 'bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-slate-700 rounded-bl-none'
                                }`}>
                                    {/* Simple Markdown-like parsing for bold text */}
                                    {msg.text.split('**').map((part, i) => 
                                        i % 2 === 1 ? <strong key={i}>{part}</strong> : part
                                    )}
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex justify-start">
                                <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl rounded-bl-none border border-gray-200 dark:border-slate-700 shadow-sm">
                                    <Loader2 className="h-4 w-4 text-indigo-600 animate-spin" />
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className="p-3 bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-700">
                        <div className="flex items-center space-x-2">
                            <input
                                type="text"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyDown={handleKeyPress}
                                placeholder="Escribe tu duda aquí..."
                                className="flex-1 bg-gray-100 dark:bg-slate-800 text-gray-900 dark:text-white text-sm rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 border border-transparent"
                            />
                            <button 
                                onClick={handleSend}
                                disabled={!inputValue.trim() || isLoading}
                                className={`p-2 rounded-full transition-all ${
                                    inputValue.trim() && !isLoading 
                                    ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md' 
                                    : 'bg-gray-200 dark:bg-slate-700 text-gray-400 cursor-not-allowed'
                                }`}
                            >
                                <Send className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="text-center mt-2">
                             <p className="text-[10px] text-gray-400">Powered by Gemini AI • Puede cometer errores</p>
                        </div>
                    </div>
                </div>
            )}

            {/* FLOATING ACTION BUTTON (FAB) */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`pointer-events-auto h-14 w-14 rounded-full shadow-xl flex items-center justify-center transition-all duration-300 transform hover:scale-105 ${
                    isOpen 
                    ? 'bg-gray-700 text-white rotate-90' 
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                }`}
            >
                {isOpen ? <X className="h-6 w-6" /> : <MessageCircle className="h-7 w-7" />}
                
                {/* Notification Dot if closed and default message exists */}
                {!isOpen && (
                    <span className="absolute top-0 right-0 -mt-1 -mr-1 flex h-4 w-4">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500"></span>
                    </span>
                )}
            </button>
        </div>
    );
};