/**
 * TENANT SERVICE — Multi-Tenant SaaS
 *
 * Cada usuário está vinculado a uma empresa via user.empresa_id.
 * Toda query de dados filtra por empresa_id automaticamente.
 * Superadmin (role=superadmin) pode ver tudo.
 */

import { base44 } from '@/api/base44Client';

// Cache de usuário em memória para evitar múltiplas chamadas
let _userCache = null;
let _cacheTime = 0;

export async function getCurrentUser() {
  const now = Date.now();
  if (_userCache && now - _cacheTime < 30000) return _userCache;
  _userCache = await base44.auth.me();
  _cacheTime = now;
  return _userCache;
}

export function clearUserCache() {
  _userCache = null;
  _cacheTime = 0;
}

/**
 * Retorna o empresa_id do usuário logado.
 * Lança erro se o usuário não tiver empresa vinculada.
 */
export async function getEmpresaIdAtual() {
  const user = await getCurrentUser();
  if (!user?.empresa_id) {
    throw new Error('EMPRESA_NAO_CONFIGURADA');
  }
  return user.empresa_id;
}

/**
 * Obtém a empresa ativa do usuário logado.
 */
export async function getEmpresaAtiva() {
  const user = await getCurrentUser();

  // Superadmin sem empresa: retorna primeira cadastrada (painel admin)
  if (user?.role === 'superadmin' && !user?.empresa_id) {
    const empresas = await base44.entities.Empresa.list();
    if (!empresas?.length) throw new Error('[tenantService] Nenhuma empresa configurada');
    return empresas[0];
  }

  if (!user?.empresa_id) {
    throw new Error('EMPRESA_NAO_CONFIGURADA');
  }

  const empresas = await base44.entities.Empresa.filter({ id: user.empresa_id });
  if (!empresas?.length) throw new Error('[tenantService] Empresa não encontrada');
  return empresas[0];
}

/**
 * Enriquece dados com empresa_id (e loja_id quando aplicável).
 * Use em TODAS as operações de create.
 */
export function withTenant(data, empresa_id, loja_id = null) {
  if (!empresa_id) throw new Error('[tenantService] empresa_id é obrigatório para esta operação');
  return {
    empresa_id,
    ...(loja_id ? { loja_id } : {}),
    ...data,
  };
}

/**
 * Valida presença de empresa_id num objeto.
 */
export function validarTenant(data) {
  if (!data?.empresa_id) throw new Error('[tenantService] empresa_id ausente — operação rejeitada');
  return true;
}

/**
 * Obtém lojas ativas de uma empresa.
 */
export async function getLojasAtivas(empresa_id) {
  if (!empresa_id) throw new Error('[tenantService] empresa_id é obrigatório');
  return base44.entities.Loja.filter({ empresa_id, status: 'ativo' });
}

/**
 * Obtém contexto de tenant completo (empresa + lojas).
 */
export async function getTenantContext() {
  const empresa = await getEmpresaAtiva();
  const lojas = await getLojasAtivas(empresa.id);
  return { empresa, lojas };
}