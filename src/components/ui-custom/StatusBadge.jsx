import React from 'react';
import { cn } from '@/lib/utils';

const statusConfig = {
  // Genéricos
  ativo: { label: 'Ativo', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  inativo: { label: 'Inativo', color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
  pendente: { label: 'Pendente', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  cancelado: { label: 'Cancelado', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  
  // Financeiro
  pago: { label: 'Pago', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  vencido: { label: 'Vencido', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  recebido: { label: 'Recebido', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  
  // Estoque
  entrada: { label: 'Entrada', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  saida: { label: 'Saída', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  ajuste: { label: 'Ajuste', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  transferencia: { label: 'Transferência', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  
  // Produção
  planejada: { label: 'Planejada', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  em_andamento: { label: 'Em Andamento', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  concluida: { label: 'Concluída', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  
  // NF
  conferida: { label: 'Conferida', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  lancada: { label: 'Lançada', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  
  // Contagem
  aberta: { label: 'Aberta', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  em_contagem: { label: 'Em Contagem', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  aguardando_conferencia: { label: 'Aguardando Conferência', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  aprovada: { label: 'Aprovada', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  ajustada: { label: 'Ajustada', color: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400' },
  
  // Banco Virtual
  aprovado: { label: 'Aprovado', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  rejeitado: { label: 'Rejeitado', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  
  // Manutenção
  em_analise: { label: 'Em Análise', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  aguardando_pecas: { label: 'Aguardando Peças', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  em_execucao: { label: 'Em Execução', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  
  // Prioridade
  baixa: { label: 'Baixa', color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
  media: { label: 'Média', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  alta: { label: 'Alta', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  critica: { label: 'Crítica', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  
  // Pedido Interno
  draft: { label: 'Rascunho', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  confirmado: { label: 'Confirmado', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  // Pagamento parcial
  parcial: { label: 'Parcial', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  
  // Tipos
  cd: { label: 'CD', color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' },
  loja: { label: 'Loja', color: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400' },

  // RH - Funcionário
  ferias: { label: 'Férias', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  afastado: { label: 'Afastado', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  desligado: { label: 'Desligado', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },

  // RH - Contratos
  rascunho: { label: 'Rascunho', color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
  enviado: { label: 'Enviado', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  assinado_funcionario: { label: 'Assinado (Func.)', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  assinado_ambos: { label: 'Assinado', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  expirado: { label: 'Expirado', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },

  // RH - Escalas
  programada: { label: 'Programada', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  confirmada: { label: 'Confirmada', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
};

export default function StatusBadge({ status, customLabel, size = 'sm' }) {
  const config = statusConfig[status] || { 
    label: customLabel || status, 
    color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' 
  };

  const sizes = {
    xs: 'px-1.5 py-0.5 text-xs',
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm'
  };

  return (
    <span className={cn(
      'inline-flex items-center font-medium rounded-full',
      config.color,
      sizes[size]
    )}>
      {customLabel || config.label}
    </span>
  );
}