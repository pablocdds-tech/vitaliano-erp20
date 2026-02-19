import React from 'react';
import usePermissoes from './usePermissoes';
import { podeVer } from '@/components/services/permissaoService';
import AcessoNegado from './AcessoNegado';

/**
 * HOC que envolve uma página e verifica se o usuário pode ver o módulo.
 * Uso: export default withPermissao(MinhaPagina, 'estoque');
 */
export default function withPermissao(Component, moduloSlug) {
  return function ProtectedPage(props) {
    const { permissoes, loading } = usePermissoes();

    if (loading) return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );

    if (!podeVer(permissoes, moduloSlug)) {
      return <AcessoNegado modulo={moduloSlug} />;
    }

    return <Component {...props} />;
  };
}