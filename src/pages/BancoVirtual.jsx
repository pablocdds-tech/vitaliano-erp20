import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import PageHeader from '@/components/ui-custom/PageHeader';
import DataTable from '@/components/ui-custom/DataTable';
import StatusBadge from '@/components/ui-custom/StatusBadge';
import MoneyDisplay from '@/components/ui-custom/MoneyDisplay';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PiggyBank } from 'lucide-react';
import { format } from 'date-fns';

export default function BancoVirtual() {
  const { data: bancoVirtual = [], isLoading } = useQuery({
    queryKey: ['banco-virtual'],
    queryFn: () => base44.entities.BancoVirtual.list('-data', 1000)
  });

  const { data: lojas = [] } = useQuery({
    queryKey: ['lojas'],
    queryFn: () => base44.entities.Loja.list()
  });

  const getSaldoLoja = (lojaId) => {
    return bancoVirtual
      .filter(m => m.loja_id === lojaId)
      .reduce((s, m) => {
        if (m.tipo === 'credito') return s + (m.valor || 0);
        if (m.tipo === 'debito') return s - (m.valor || 0);
        return s;
      }, 0);
  };

  const columns = [
    {
      key: 'data',
      label: 'Data',
      sortable: true,
      render: (v) => format(new Date(v), 'dd/MM/yyyy HH:mm')
    },
    {
      key: 'loja_id',
      label: 'Loja',
      render: (v) => lojas.find(l => l.id === v)?.nome || '-'
    },
    {
      key: 'tipo',
      label: 'Tipo',
      render: (v) => <StatusBadge status={v === 'credito' ? 'entrada' : 'saida'} customLabel={v === 'credito' ? 'Crédito' : 'Débito'} />
    },
    { key: 'valor', label: 'Valor', sortable: true, render: (v) => <MoneyDisplay value={v || 0} colorize size="sm" /> },
    {
      key: 'motivo',
      label: 'Motivo',
      render: (v) => <span className="text-sm">{v || '-'}</span>
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Banco Virtual"
        subtitle="Transferências internas entre lojas e CD"
        icon={PiggyBank}
        breadcrumbs={[
          { label: 'Dashboard', href: 'Dashboard' },
          { label: 'Banco Virtual' }
        ]}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {lojas.map(loja => {
          const saldo = getSaldoLoja(loja.id);
          return (
            <Card key={loja.id} className={saldo < 0 ? 'border-red-200 dark:border-red-900' : ''}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{loja.nome}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${saldo < 0 ? 'text-red-600' : saldo > 0 ? 'text-emerald-600' : 'text-slate-600'}`}>
                  {MoneyDisplay({ value: saldo })}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {saldo < 0 ? 'Devendo ao banco virtual' : saldo > 0 ? 'Creditado no banco virtual' : 'Saldo zero'}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de Movimentações</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={bancoVirtual}
            loading={isLoading}
            searchPlaceholder="Buscar movimentações..."
            emptyTitle="Nenhuma movimentação"
          />
        </CardContent>
      </Card>
    </div>
  );
}