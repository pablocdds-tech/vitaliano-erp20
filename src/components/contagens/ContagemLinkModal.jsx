import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Copy, ExternalLink, MessageCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export default function ContagemLinkModal({ open, onClose, tarefa }) {
  if (!tarefa) return null;

  const getUrl = () => {
    const base = `${window.location.origin}${window.location.pathname}`;
    return `${base}#/ContagemTarefa?token=${tarefa.token}`;
  };

  const url = getUrl();

  const handleCopy = () => {
    navigator.clipboard.writeText(url);
    toast.success('Link copiado!');
  };

  const handleOpen = () => {
    window.open(url, '_blank');
  };

  const handleWhatsApp = () => {
    const msg = encodeURIComponent(
      `Olá ${tarefa.responsavel_nome}! 📋\n\nPor favor faça a contagem de estoque — ${tarefa.grupo || 'Geral'} (${tarefa.total_itens} itens)\n\nAcesse aqui:\n${url}`
    );
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            Contagem Criada!
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Envie o link abaixo para <strong>{tarefa.responsavel_nome}</strong> iniciar a contagem de <strong>{tarefa.total_itens}</strong> itens.
          </p>

          <div className="flex gap-2">
            <Input value={url} readOnly className="text-xs" />
            <Button variant="outline" size="icon" onClick={handleCopy}>
              <Copy className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 gap-2" onClick={handleCopy}>
              <Copy className="w-4 h-4" /> Copiar Link
            </Button>
            <Button variant="outline" className="gap-2" onClick={handleOpen}>
              <ExternalLink className="w-4 h-4" /> Abrir
            </Button>
            <Button className="flex-1 gap-2 bg-green-600 hover:bg-green-700" onClick={handleWhatsApp}>
              <MessageCircle className="w-4 h-4" /> WhatsApp
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}