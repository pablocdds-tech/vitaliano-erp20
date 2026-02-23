import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Loader2 } from 'lucide-react';
import PassivoDetalheContent from '../components/passivos/PassivoDetalheContent';
import { getEmpresaIdAtual } from '../components/services/tenantService';

export default function PassivoDetalhe() {
  const urlParams = new URLSearchParams(window.location.search);
  const passivoId = urlParams.get('id');
  const queryClient = useQueryClient();

  const { data: empresaId } = useQuery({
    queryKey: ['empresa-id-passivo-detalhe'],
    queryFn: getEmpresaIdAtual
  });

  const { data: passivos = [], isLoading: loadingPassivo } = useQuery({
    queryKey: ['passivo-detalhe', passivoId],
    queryFn: () => base44.entities.PassivoFinanceiro.filter({ id: passivoId }),
    enabled: !!passivoId
  });

  const { data: parcelas = [], isLoading: loadingParcelas } = useQuery({
    queryKey: ['parcelas-detalhe', passivoId, empresaId],
    queryFn: () => base44.entities.ParcelaPassivo.filter({ empresa_id: empresaId, passivo_id: passivoId }),
    enabled: !!passivoId && !!empresaId
  });

  const passivo = passivos[0];

  if (loadingPassivo || loadingParcelas) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
  }

  if (!passivo) {
    return <div className="text-center py-20 text-muted-foreground">Passivo não encontrado</div>;
  }

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['passivo-detalhe', passivoId] });
    queryClient.invalidateQueries({ queryKey: ['parcelas-detalhe', passivoId] });
  };

  return <PassivoDetalheContent passivo={passivo} parcelas={parcelas} onRefresh={handleRefresh} />;
}