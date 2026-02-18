/**
 * Hook: usePlano
 * Retorna o plano ativo da empresa atual e helpers de verificação de recurso.
 * Uso: const { plano, assinatura, podeUsar, bloqueado, motivo } = usePlano();
 */
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { verificarAcessoEmpresa } from '@/components/services/assinaturaService';

export function usePlano(empresa_id) {
  const { data, isLoading } = useQuery({
    queryKey: ['plano-empresa', empresa_id],
    queryFn: () => empresa_id ? verificarAcessoEmpresa(empresa_id) : Promise.resolve(null),
    enabled: !!empresa_id,
    staleTime: 5 * 60 * 1000, // cache 5 min
  });

  const plano = data?.plano || null;
  const valida = data?.valida ?? true; // permissivo se ainda carregando
  const motivo = data?.motivo || '';
  const status = data?.status || '';

  return {
    plano,
    assinatura: data?.assinatura,
    valida,
    bloqueado: !valida,
    motivo,
    status,
    isLoading,
    podeUsar: (recurso) => {
      if (!plano) return true; // permissivo se plano não carregado
      const mapa = {
        ia: plano.acesso_ia,
        cd: plano.acesso_cd,
        relatorios_avancados: plano.acesso_relatorios_avancados,
      };
      return !!mapa[recurso];
    },
    dentroDoLimite: (tipo, atual) => {
      if (!plano) return true;
      if (tipo === 'lojas') return atual < (plano.limite_lojas || 9999);
      if (tipo === 'usuarios') return atual < (plano.limite_usuarios || 9999);
      return true;
    }
  };
}