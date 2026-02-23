import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

export default function EdicaoLoteModal({ open, onClose, ids, categorias, onSubmit, loading }) {
  const [campo, setCampo] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [status, setStatus] = useState('');

  const handleSubmit = () => {
    const data = {};
    if (campo === 'categoria' && categoriaId) {
      data.categoria_id = categoriaId === '__sem__' ? '' : categoriaId;
    }
    if (campo === 'status' && status) {
      data.status = status;
    }
    if (campo === 'ambos') {
      if (categoriaId) data.categoria_id = categoriaId === '__sem__' ? '' : categoriaId;
      if (status) data.status = status;
    }
    if (Object.keys(data).length === 0) return;
    onSubmit(data);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar {ids.length} produto(s) em lote</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>O que deseja alterar?</Label>
            <Select value={campo} onValueChange={setCampo}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="categoria">Categoria</SelectItem>
                <SelectItem value="status">Status</SelectItem>
                <SelectItem value="ambos">Categoria e Status</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(campo === 'categoria' || campo === 'ambos') && (
            <div>
              <Label>Nova Categoria</Label>
              <Select value={categoriaId} onValueChange={setCategoriaId}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__sem__">Sem Categoria</SelectItem>
                  {categorias.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {(campo === 'status' || campo === 'ambos') && (
            <div>
              <Label>Novo Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                  <SelectItem value="descontinuado">Descontinuado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onClose(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading || !campo}>
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando...</> : `Aplicar a ${ids.length} produto(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}