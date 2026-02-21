import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Bot, Loader2, Trash2, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';

const SUGGESTED_QUESTIONS = [
  'Qual loja teve maior CMV este mês?',
  'Quanto cada loja deve no banco virtual?',
  'Quais compras diretas foram feitas fora do CD?',
  'Qual fornecedor está com mais contas a pagar em aberto?',
  'Qual loja tem mais estoque parado?',
  'Quais contas a pagar estão vencidas hoje?',
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
        {message.content && (
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
        )}
        {/* Tool calls indicator */}
        {message.tool_calls?.length > 0 && !isUser && (
          <div className="flex items-center gap-1 mt-1 ml-1 text-xs text-slate-400">
            <Sparkles className="h-3 w-3" />
            <span>Consultando dados do sistema...</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AssistenteERP() {
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    initConversation();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const initConversation = async () => {
    try {
      const conv = await base44.agents.createConversation({
        agent_name: 'assistente_erp',
        metadata: { name: 'Sessão ERP' },
      });
      setConversation(conv);
      setMessages(conv.messages || []);

      base44.agents.subscribeToConversation(conv.id, (data) => {
        setMessages([...(data.messages || [])]);
      });
    } finally {
      setInitializing(false);
    }
  };

  const sendMessage = async (text) => {
    const msg = text || input.trim();
    if (!msg || loading || !conversation) return;

    setInput('');
    setLoading(true);

    try {
      await base44.agents.addMessage(conversation, { role: 'user', content: msg });
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = async () => {
    setInitializing(true);
    setMessages([]);
    setConversation(null);
    await initConversation();
  };

  const visibleMessages = messages.filter(m => m.role === 'user' || m.role === 'assistant');
  const isWaiting = loading || (visibleMessages.length > 0 && visibleMessages[visibleMessages.length - 1]?.role === 'user');

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] max-w-4xl mx-auto">
      {/* Header */}
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
        <Button variant="ghost" size="sm" onClick={clearChat} className="text-slate-500 gap-1.5">
          <Trash2 className="h-4 w-4" /> Nova conversa
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-6 space-y-4 pr-1">
        {initializing ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
          </div>
        ) : visibleMessages.length === 0 ? (
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
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="text-left text-sm px-4 py-3 rounded-xl border border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50 transition-colors text-slate-700"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {visibleMessages.map((msg, i) => (
              <MessageBubble key={i} message={msg} />
            ))}
            {isWaiting && !loading && (
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

      {/* Input */}
      <div className="pt-4 border-t border-slate-200">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Pergunte sobre CMV, estoque, compras, fornecedores..."
            disabled={initializing || loading}
            className="flex-1 rounded-xl"
          />
          <Button
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading || initializing}
            className="bg-indigo-600 hover:bg-indigo-700 rounded-xl px-4"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
        <p className="text-xs text-slate-400 mt-2 text-center">
          O assistente consulta dados reais do sistema — nunca edita ou deleta registros.
        </p>
      </div>
    </div>
  );
}