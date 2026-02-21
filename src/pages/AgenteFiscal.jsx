import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, FileText, Loader2, Trash2, Paperclip, X, CheckCircle2, AlertTriangle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const SUGGESTED = [
  { icon: '📄', text: 'Envie uma foto ou PDF de uma NF para eu processar' },
  { icon: '🔍', text: 'Verificar se NF nº 001234 já está cadastrada' },
  { icon: '📊', text: 'Quais notas estão pendentes de lançamento?' },
  { icon: '⚠️', text: 'Quais NFs foram lançadas este mês?' },
];

function MessageBubble({ message }) {
  const isUser = message.role === 'user';
  const hasFiles = message.file_urls?.length > 0;

  return (
    <div className={cn('flex gap-3', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <div className="h-8 w-8 rounded-lg bg-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
          <FileText className="h-4 w-4 text-white" />
        </div>
      )}
      <div className={cn('max-w-[85%]', isUser && 'flex flex-col items-end gap-1')}>
        {hasFiles && (
          <div className="flex flex-wrap gap-2 justify-end mb-1">
            {message.file_urls.map((url, i) => (
              <div key={i} className="flex items-center gap-1.5 bg-slate-100 rounded-lg px-3 py-1.5 text-xs text-slate-600">
                <Paperclip className="h-3 w-3" />
                <span>Arquivo {i + 1}</span>
              </div>
            ))}
          </div>
        )}
        {message.content && (
          <div className={cn(
            'rounded-2xl px-4 py-3 text-sm',
            isUser
              ? 'bg-slate-800 text-white rounded-tr-sm'
              : 'bg-white border border-slate-200 text-slate-800 rounded-tl-sm shadow-sm'
          )}>
            {isUser ? (
              <p className="leading-relaxed">{message.content}</p>
            ) : (
              <ReactMarkdown
                className="prose prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
                components={{
                  p: ({ children }) => <p className="my-1 leading-relaxed">{children}</p>,
                  ul: ({ children }) => <ul className="my-1 ml-4 list-disc">{children}</ul>,
                  ol: ({ children }) => <ol className="my-1 ml-4 list-decimal">{children}</ol>,
                  li: ({ children }) => <li className="my-0.5">{children}</li>,
                  strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
                  code: ({ inline, children }) => inline
                    ? <code className="px-1 py-0.5 rounded bg-slate-100 text-slate-700 text-xs font-mono">{children}</code>
                    : <pre className="bg-slate-50 border rounded-lg p-3 text-xs overflow-x-auto my-2 font-mono whitespace-pre-wrap">{children}</pre>,
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-4 border-emerald-300 pl-3 my-2 text-slate-600 italic">{children}</blockquote>
                  ),
                  table: ({ children }) => (
                    <div className="overflow-x-auto my-2">
                      <table className="text-xs border-collapse w-full">{children}</table>
                    </div>
                  ),
                  th: ({ children }) => <th className="border border-slate-200 bg-slate-50 px-2 py-1 text-left font-semibold">{children}</th>,
                  td: ({ children }) => <td className="border border-slate-200 px-2 py-1">{children}</td>,
                  hr: () => <hr className="my-3 border-slate-200" />,
                }}
              >
                {message.content}
              </ReactMarkdown>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AgenteFiscal() {
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [attachedFiles, setAttachedFiles] = useState([]); // [{file, url, name}]
  const [uploading, setUploading] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => { initConversation(); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const initConversation = async () => {
    try {
      const conv = await base44.agents.createConversation({
        agent_name: 'agente_fiscal',
        metadata: { name: 'Sessão Fiscal' },
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

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      const uploaded = await Promise.all(
        files.map(async (file) => {
          const { file_url } = await base44.integrations.Core.UploadFile({ file });
          return { file, url: file_url, name: file.name };
        })
      );
      setAttachedFiles(prev => [...prev, ...uploaded]);
      toast.success(`${files.length} arquivo(s) pronto(s) para envio`);
    } catch {
      toast.error('Erro ao fazer upload do arquivo');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const removeFile = (idx) => setAttachedFiles(prev => prev.filter((_, i) => i !== idx));

  const sendMessage = async (text) => {
    const msg = text || input.trim();
    if ((!msg && attachedFiles.length === 0) || loading || !conversation) return;

    const fileUrls = attachedFiles.map(f => f.url);
    setInput('');
    setAttachedFiles([]);
    setLoading(true);

    try {
      await base44.agents.addMessage(conversation, {
        role: 'user',
        content: msg || 'Analise este arquivo de nota fiscal.',
        ...(fileUrls.length > 0 && { file_urls: fileUrls }),
      });
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const clearChat = async () => {
    setInitializing(true);
    setMessages([]);
    setConversation(null);
    setAttachedFiles([]);
    await initConversation();
  };

  const visibleMessages = messages.filter(m => m.role === 'user' || m.role === 'assistant');
  const isWaiting = !loading && visibleMessages.length > 0 && visibleMessages[visibleMessages.length - 1]?.role === 'user';

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-600 flex items-center justify-center">
            <FileText className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Agente Fiscal</h1>
            <p className="text-xs text-slate-500">Processamento inteligente de notas fiscais</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg">
            <AlertTriangle className="h-3.5 w-3.5" />
            Cria rascunhos somente após confirmação
          </div>
          <Button variant="ghost" size="sm" onClick={clearChat} className="text-slate-500 gap-1.5">
            <Trash2 className="h-4 w-4" /> Nova sessão
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-6 space-y-4 pr-1">
        {initializing ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
          </div>
        ) : visibleMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-6 text-center px-4">
            <div>
              <div className="h-16 w-16 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-3">
                <FileText className="h-8 w-8 text-emerald-500" />
              </div>
              <h2 className="text-lg font-semibold text-slate-800">Agente Fiscal</h2>
              <p className="text-sm text-slate-500 mt-1 max-w-md">
                Envie uma imagem ou PDF de nota fiscal. Vou extrair os dados, validar totais, verificar duplicidade e sugerir a classificação — mas só crio o rascunho com sua confirmação.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-xl">
              {SUGGESTED.map((s) => (
                <button
                  key={s.text}
                  onClick={() => s.text.startsWith('Envie') ? fileInputRef.current?.click() : sendMessage(s.text)}
                  className="text-left text-sm px-4 py-3 rounded-xl border border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50 transition-colors text-slate-700 flex items-center gap-2"
                >
                  <span className="text-lg">{s.icon}</span>
                  <span>{s.text}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {visibleMessages.map((msg, i) => (
              <MessageBubble key={i} message={msg} />
            ))}
            {isWaiting && (
              <div className="flex gap-3 justify-start">
                <div className="h-8 w-8 rounded-lg bg-emerald-600 flex items-center justify-center shrink-0">
                  <FileText className="h-4 w-4 text-white" />
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                  <div className="flex gap-1 items-center">
                    <span className="h-2 w-2 rounded-full bg-emerald-300 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="h-2 w-2 rounded-full bg-emerald-300 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="h-2 w-2 rounded-full bg-emerald-300 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* Attached files preview */}
      {attachedFiles.length > 0 && (
        <div className="flex flex-wrap gap-2 pb-2">
          {attachedFiles.map((f, i) => (
            <div key={i} className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5 text-xs text-emerald-700">
              <Paperclip className="h-3 w-3 shrink-0" />
              <span className="max-w-[120px] truncate">{f.name}</span>
              <button onClick={() => removeFile(i)} className="hover:text-red-500 ml-1">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="pt-4 border-t border-slate-200 space-y-2">
        <div className="flex gap-2">
          <input ref={fileInputRef} type="file" accept=".pdf,.xml,image/*" multiple className="hidden" onChange={handleFileSelect} />
          <Button
            variant="outline"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={initializing || uploading || loading}
            className="shrink-0 rounded-xl border-dashed"
            title="Anexar NF (PDF, imagem ou XML)"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
          </Button>
          <Input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={attachedFiles.length > 0 ? 'Adicione uma mensagem ou envie direto...' : 'Digite ou anexe uma nota fiscal...'}
            disabled={initializing || loading}
            className="flex-1 rounded-xl"
          />
          <Button
            onClick={() => sendMessage()}
            disabled={(!input.trim() && attachedFiles.length === 0) || loading || initializing}
            className="bg-emerald-600 hover:bg-emerald-700 rounded-xl px-4"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
        <div className="flex items-center justify-center gap-4 text-xs text-slate-400">
          <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-emerald-500" /> Valida totais e duplicidade</span>
          <span className="flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-amber-500" /> Cria rascunho só após confirmação</span>
        </div>
      </div>
    </div>
  );
}