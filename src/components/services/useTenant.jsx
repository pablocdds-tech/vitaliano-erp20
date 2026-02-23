/**
 * Hook para obter empresa_id do usuário logado de forma reativa.
 * Usar em todas as páginas para garantir isolamento multi-tenant.
 */
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

let _cache = null;
let _cacheTime = 0;

export function useTenant() {
  const [empresa_id, setEmpresaId] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const now = Date.now();
        if (_cache && now - _cacheTime < 30000) {
          setUser(_cache);
          setEmpresaId(_cache.empresa_id || null);
          setLoading(false);
          return;
        }
        const u = await base44.auth.me();
        _cache = u;
        _cacheTime = Date.now();
        setUser(u);
        setEmpresaId(u?.empresa_id || null);
      } catch {
        setEmpresaId(null);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const isSuperAdmin = user?.role === 'superadmin';
  const isAdmin = user?.role === 'admin' || isSuperAdmin;

  return { empresa_id, user, loading, isSuperAdmin, isAdmin };
}