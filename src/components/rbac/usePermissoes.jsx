import { useState, useEffect } from 'react';
import { getMinhasPermissoes } from '@/components/services/permissaoService';

/**
 * Hook que retorna as permissões do usuário logado.
 * Usa cache em memória — limpar com clearPermissaoCache() após salvar.
 */
export default function usePermissoes() {
  const [permissoes, setPermissoes] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMinhasPermissoes()
      .then(setPermissoes)
      .catch(() => setPermissoes(null))
      .finally(() => setLoading(false));
  }, []);

  return { permissoes, loading };
}