import React, { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, FileText, Loader2, Trash2, Paperclip, X, CheckCircle2, AlertTriangle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const SYSTEM_PROMPT = `Você é um especialista em notas fiscais e documentos fiscais brasileiros.
Analise imagens e PDFs de notas fiscais, extraia dados (fornecedor, CNPJ, itens, valores, totais, datas), 
valide os totais, verifique duplicidades e sugira classificações contábeis.
Seja preciso, use tabelas para listar itens e responda sempre em português.`;

const SUGGESTED = [
  { icon: '📄', text: 'Envie uma foto ou PDF de uma NF para eu processar' },
  { icon: '🔍', text: 'O que devo conferir ao receber uma NF?' },
  { icon: '📊', text: 'Quais dados são obrigatórios em uma NF?' },
  { icon: '⚠️', text: 'Como identificar fraudes em notas fiscais?' },
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
                <Paperclip className="h-3 w-3" /><span>Arquivo {i + 1}</span>
              </div>
            ))}
          </div>
        )}
        {message.content && (
          <div className={cn('rounded-2xl px-4 py-3 text-sm',
            isUser ? 'bg-slate-800 text-white rounded-tr-sm' : 'bg-white border border-slate-200 text-slate-800 rounded-tl-sm shadow-sm')}>
            {isUser ? <p className="leading-relaxed">{message.content}</p> : (
              <ReactMarkdown className="prose prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
                components={{
                  p: ({ children }) => <p className="my-1 leading-relaxed">{children}</p>,
                  ul: ({ children }) => <ul className="my-1 ml-4 list-disc">{children}</ul>,
                  li: ({ children }) => <li className="my-0.5">{children}</li>,
                  strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
                  table: ({ children }) => <div className="overflow-x-auto my-2"><table className="text-xs border-collapse w-full">{children}</table></div>,
                  th: ({ children }) => <th className="border border-slate-200 bg-slate-50 px-2 py-1 text-left font-semibold">{children}</th>,
                  td: ({ children }) => <td className="border border-slate-200 px-2 py-1">{children}</td>,
                }}>{message.content}</ReactMarkdown>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AgenteFiscal() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      const uploaded = await Promise.all(files.map(async (file) => {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        return { file, url: file_url, name: file.name };
      }));
      setAttachedFiles(prev => [...prev, ...uploaded]);
      toast.success(`${files.length} arquivo(s) pronto(s)`);
    } catch { toast.error('Erro ao fazer upload'); }
    finally { setUploading(false); e.target.value = ''; }
  };

  const sendMessage = async (text) => {
    const msg = text || input.trim();
    if ((!msg && attachedFiles.length === 0) || loading) return;

    const fileInfo = attachedFiles.length > 0
      ? `\n\n[Arquivo(s) anexado(s): ${attachedFiles.map(f => f.name).join(', ')} — URLs: ${attachedFiles.map(f => f.url).join(', ')}]`
      : '';

    const fullMsg = (msg || 'Analise este arquivo de nota fiscal.') + fileInfo;
    const newMessages = [...messages, { role: 'user', content: fullMsg, file_urls: attachedFiles.map(f => f.url) }];
    setMessages(newMessages);
    setInput('');
    setAttachedFiles([]);
    setLoading(true);

    try {
      const res = await base44.functions.invoke('chatOpenAI', {
        messages: newMessages.map(m => ({ role: m.role, content: m.content })),
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
            <AlertTriangle className="h-3.5 w-3.5" /> Confirme antes de lançar
          </div>
          <Button variant="ghost" size="sm" onClick={() => setMessages([])} className="text-slate-500 gap-1.5">
            <Trash2 className="h-4 w-4" /> Limpar
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-6 space-y-4 pr-1">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-6 text-center px-4">
            <div>
              <div className="h-16 w-16 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-3">
                <FileText className="h-8 w-8 text-emerald-500" />
              </div>
              <h2 className="text-lg font-semibold text-slate-800">Agente Fiscal</h2>
              <p className="text-sm text-slate-500 mt-1 max-w-md">Envie imagens ou PDFs de notas fiscais. Extraio os dados, valido totais e sugiro classificação.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-xl">
              {SUGGESTED.map((s) => (
                <button key={s.text} onClick={() => s.text.startsWith('Envie') ? fileInputRef.current?.click() : sendMessage(s.text)}
                  className="text-left text-sm px-4 py-3 rounded-xl border border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50 transition-colors text-slate-700 flex items-center gap-2">
                  <span className="text-lg">{s.icon}</span><span>{s.text}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => <MessageBubble key={i} message={msg} />)}
            {loading && (
              <div className="flex gap-3 justify-start">
                <div className="h-8 w-8 rounded-lg bg-emerald-600 flex items-center justify-center shrink-0">
                  <FileText className="h-4 w-4 text-white" />
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                  <div className="flex gap-1">
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

      {attachedFiles.length > 0 && (
        <div className="flex flex-wrap gap-2 pb-2">
          {attachedFiles.map((f, i) => (
            <div key={i} className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5 text-xs text-emerald-700">
              <Paperclip className="h-3 w-3 shrink-0" />
              <span className="max-w-[120px] truncate">{f.name}</span>
              <button onClick={() => setAttachedFiles(prev => prev.filter((_, j) => j !== i))} className="hover:text-red-500 ml-1"><X className="h-3 w-3" /></button>
            </div>
          ))}
        </div>
      )}

      <div className="pt-4 border-t border-slate-200 space-y-2">
        <div className="flex gap-2">
          <input ref={fileInputRef} type="file" accept=".pdf,.xml,image/*" multiple className="hidden" onChange={handleFileSelect} />
          <Button variant="outline" size="icon" onClick={() => fileInputRef.current?.click()} disabled={uploading || loading} className="shrink-0 rounded-xl border-dashed" title="Anexar NF">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
          </Button>
          <Input ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
            placeholder={attachedFiles.length > 0 ? 'Adicione uma mensagem...' : 'Digite ou anexe uma nota fiscal...'} disabled={loading} className="flex-1 rounded-xl" />
          <Button onClick={() => sendMessage()} disabled={(!input.trim() && attachedFiles.length === 0) || loading} className="bg-emerald-600 hover:bg-emerald-700 rounded-xl px-4">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
        <div className="flex items-center justify-center gap-4 text-xs text-slate-400">
          <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-emerald-500" /> Usando 🤖 ChatGPT</span>
          <span className="flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-amber-500" /> Sem consumo de créditos Base44</span>
        </div>
      </div>
    </div>
  );
}