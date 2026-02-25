import React, { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Bot, Loader2, Trash2, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';

const SYSTEM_PROMPT = `Você é um assistente especializado em ERP financeiro para redes de lojas de alimentação. 
Ajude com análises de CMV, contas a pagar/receber, estoque, compras, banco virtual, fornecedores e DRE.
Seja objetivo, use tabelas quando útil e responda sempre em português.`;

const SUGGESTED_QUESTIONS = [
  'Como calcular o CMV do mês?',
  'Como analisar contas a pagar vencidas?',
  'O que é banco virtual e como funciona?',
  'Como fazer uma análise de DRE gerencial?',
  'Como controlar o estoque de forma eficiente?',
  'Quais indicadores financeiros devo monitorar?',
];



function MessageBubble({ message }) {
  const isUser = message.role === 'user';
  return (
    <div className={cn('flex gap-3', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
          <Bot className="h-4 w-4 text-white" />
        </div>
      )}
      <div className={cn('max-w-[80%]', isUser && 'flex flex-col items-end')}>
        <div className={cn(
          'rounded-2xl px-4 py-3 text-sm leading-relaxed',
          isUser
            ? 'bg-indigo-600 text-white rounded-tr-sm'
            : 'bg-white border border-slate-200 text-slate-800 rounded-tl-sm shadow-sm'
        )}>
          {isUser ? (
            <p>{message.content}</p>
          ) : (
            <ReactMarkdown
              className="prose prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
              components={{
                p: ({ children }) => <p className="my-1">{children}</p>,
                ul: ({ children }) => <ul className="my-1 ml-4 list-disc">{children}</ul>,
                ol: ({ children }) => <ol className="my-1 ml-4 list-decimal">{children}</ol>,
                li: ({ children }) => <li className="my-0.5">{children}</li>,
                strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
                table: ({ children }) => <div className="overflow-x-auto my-2"><table className="text-xs border-collapse w-full">{children}</table></div>,
                th: ({ children }) => <th className="border border-slate-200 bg-slate-50 px-2 py-1 text-left font-semibold">{children}</th>,
                td: ({ children }) => <td className="border border-slate-200 px-2 py-1">{children}</td>,
              }}
            >
              {message.content}
            </ReactMarkdown>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AssistenteERP() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text) => {
    const msg = text || input.trim();
    if (!msg || loading) return;

    const newMessages = [...messages, { role: 'user', content: msg }];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const res = await base44.functions.invoke('chatOpenAI', {
        messages: newMessages,
        systemPrompt: SYSTEM_PROMPT,
      });
      setMessages([...newMessages, { role: 'assistant', content: res.data.reply }]);
    } catch (e) {
      setMessages([...newMessages, { role: 'assistant', content: `Erro: ${e.message}` }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] max-w-4xl mx-auto">
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-indigo-600 flex items-center justify-center">
            <Bot className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Assistente ERP</h1>
            <p className="text-xs text-slate-500">Consultas inteligentes sobre o seu negócio</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setMessages([])} className="text-slate-500 gap-1.5">
            <Trash2 className="h-4 w-4" /> Limpar
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-6 space-y-4 pr-1">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-6 text-center px-4">
            <div>
              <div className="h-16 w-16 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-3">
                <Sparkles className="h-8 w-8 text-indigo-500" />
              </div>
              <h2 className="text-lg font-semibold text-slate-800">Como posso ajudar?</h2>
              <p className="text-sm text-slate-500 mt-1">Faça perguntas sobre finanças, estoque, compras e muito mais.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-xl">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button key={q} onClick={() => sendMessage(q)}
                  className="text-left text-sm px-4 py-3 rounded-xl border border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50 transition-colors text-slate-700">
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => <MessageBubble key={i} message={msg} />)}
            {loading && (
              <div className="flex gap-3 justify-start">
                <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
                  <Bot className="h-4 w-4 text-white" />
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                  <div className="flex gap-1">
                    <span className="h-2 w-2 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="h-2 w-2 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="h-2 w-2 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      <div className="pt-4 border-t border-slate-200">
        <div className="flex gap-2">
          <Input ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
            placeholder="Pergunte sobre CMV, estoque, compras, fornecedores..." disabled={loading} className="flex-1 rounded-xl" />
          <Button onClick={() => sendMessage()} disabled={!input.trim() || loading} className="bg-indigo-600 hover:bg-indigo-700 rounded-xl px-4">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
        <p className="text-xs text-slate-400 mt-2 text-center">🤖 ChatGPT — sem consumo de créditos Base44</p>
      </div>
    </div>
  );
}