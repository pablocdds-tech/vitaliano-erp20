import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Settings2 } from 'lucide-react';

const SECOES_DRE = [
  { value: 'receita_operacional', label: 'Receita Operacional' },
  { value: 'impostos', label: 'Impostos sobre Receita' },
  { value: 'cmv', label: 'CMV — Custo das Mercadorias Vendidas' },
  { value: 'despesas_operacionais', label: 'Despesas Operacionais' },
  { value: 'despesas_administrativas', label: 'Despesas Administrativas' },
  { value: 'despesas_financeiras', label: 'Despesas Financeiras' },
  { value: 'receita_nao_operacional', label: 'Receita Não Operacional' },
  { value: 'outros', label: 'Outros' },
  { value: 'sem_secao', label: '— Sem seção (não soma)' },
];

const TIPO_LABELS = {
  receita: 'Receita', custo: 'Custo', despesa_fixa: 'Desp. Fixa',
  despesa_variavel: 'Desp. Variável', investimento: 'Investimento'
};

export default function DREConfig({ open, onClose, categorias }) {
  const queryClient = useQueryClient();
  const [alteracoes, setAlteracoes] = useState({});

  const handleChange = (catId, novoGrupo) => {
    setAlteracoes(prev => ({ ...prev, [catId]: novoGrupo }));
  };

  const salvarMutation = useMutation({
    mutationFn: async () => {
      const updates = Object.entries(alteracoes);
      await Promise.all(updates.map(([id, grupo]) =>
        base44.entities.CategoriaDRE.update(id, { grupo })
      ));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categorias-dre'] });
      setAlteracoes({});
      toast.success('Configuração salva com sucesso!');
      onClose();
    },
    onError: () => toast.error('Erro ao salvar configuração.')
  });

  const grupoAtual = (cat) => alteracoes[cat.id] ?? cat.grupo;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-indigo-600" />
            Configuração do DRE
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-slate-500 -mt-2 mb-4">
          Defina em qual seção do DRE cada categoria financeira deve aparecer.
        </p>

        <div className="space-y-2">
          {categorias.map(cat => {
            const grupo = grupoAtual(cat);
            const alterado = alteracoes[cat.id] !== undefined;
            return (
              <div key={cat.id} className={`flex items-center justify-between gap-3 p-3 rounded-lg border ${alterado ? 'border-indigo-300 bg-indigo-50/50 dark:bg-indigo-900/10' : 'border-slate-200 dark:border-slate-700'}`}>
                <div className="min-w-0">
                  <p className="font-medium text-sm text-slate-800 dark:text-white truncate">{cat.nome}</p>
                  <p className="text-xs text-slate-400">{TIPO_LABELS[cat.tipo] || cat.tipo}</p>
                </div>
                <Select value={grupo || 'sem_secao'} onValueChange={(v) => handleChange(cat.id, v)}>
                  <SelectTrigger className="w-60 shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SECOES_DRE.map(s => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          })}
        </div>

        {categorias.length === 0 && (
          <p className="text-center text-slate-400 py-8 text-sm">Nenhuma categoria financeira cadastrada.</p>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t mt-4">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={() => salvarMutation.mutate()}
            disabled={salvarMutation.isPending || Object.keys(alteracoes).length === 0}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            {salvarMutation.isPending ? 'Salvando...' : `Salvar${Object.keys(alteracoes).length > 0 ? ` (${Object.keys(alteracoes).length})` : ''}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}