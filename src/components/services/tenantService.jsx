/**
 * TENANT SERVICE — Utilitários Multi-Tenant
 *
 * Toda operação de escrita DEVE incluir empresa_id.
 * Operações que envolvem unidades físicas também devem incluir loja_id.
 *
 * Prepara a estrutura para futura aplicação de RLS no Supabase/Postgres:
 *   - Row Level Security por empresa_id (isolamento de dados por tenant)
 *   - Controle de acesso por loja para usuários operacionais
 *   - Compatível com Supabase Auth JWT claims (app_metadata.empresa_id)
 *
 * Para migração a Supabase Edge Functions:
 *   - getEmpresaAtiva() → lida via req.headers['x-empresa-id']
 *   - withTenant() → aplicado automaticamente no middleware de RLS
 */

import { base44 } from '@/api/base44Client';

/**
 * Enriquece dados com empresa_id (e loja_id quando aplicável).
 * Use em TODAS as operações de create para garantir isolamento de dados.
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
 * Obtém a empresa ativa.
 * Single-tenant atual: primeira empresa cadastrada.
 * SaaS multi-tenant: virá do contexto do JWT / session do usuário autenticado.
 */
export async function getEmpresaAtiva() {
  const empresas = await base44.entities.Empresa.list();
  if (!empresas?.length) throw new Error('[tenantService] Nenhuma empresa configurada no sistema');
  return empresas[0];
}

/**
 * Obtém lojas ativas de uma empresa.
 * Em produção, o usuário seleciona a loja explicitamente.
 */
export async function getLojasAtivas(empresa_id) {
  if (!empresa_id) throw new Error('[tenantService] empresa_id é obrigatório');
  return base44.entities.Loja.filter({ empresa_id, status: 'ativo' });
}

/**
 * Obtém contexto de tenant completo (empresa + lojas).
 * Usado em páginas que precisam de contexto multi-tenant ao inicializar.
 */
export async function getTenantContext() {
  const empresa = await getEmpresaAtiva();
  const lojas = await getLojasAtivas(empresa.id);
  return { empresa, lojas };
}