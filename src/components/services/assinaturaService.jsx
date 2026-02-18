/**
 * SERVIÇO DE ASSINATURA SAAS
 * Controla planos, limites e bloqueios por empresa.
 * Nunca altera dados operacionais — apenas lê e valida.
 */
import { base44 } from '@/api/base44Client';
import { format, addDays } from 'date-fns';

const PLANOS_PADRAO = [
  { nome: 'Trial', codigo: 'trial', limite_lojas: 2, limite_usuarios: 5, acesso_ia: true, acesso_cd: true, acesso_relatorios_avancados: false, dias_trial: 14, preco_mensal: 0 },
  { nome: 'Starter', codigo: 'starter', limite_lojas: 1, limite_usuarios: 3, acesso_ia: false, acesso_cd: false, acesso_relatorios_avancados: false, preco_mensal: 197 },
  { nome: 'Professional', codigo: 'professional', limite_lojas: 5, limite_usuarios: 15, acesso_ia: true, acesso_cd: true, acesso_relatorios_avancados: true, preco_mensal: 497 },
  { nome: 'Enterprise', codigo: 'enterprise', limite_lojas: 9999, limite_usuarios: 9999, acesso_ia: true, acesso_cd: true, acesso_relatorios_avancados: true, preco_mensal: 997 },
];

/** Garante que os planos padrão existem no banco */
export async function garantirPlanosPadrao() {
  const existentes = await base44.entities.PlanoAssinatura.list();
  for (const plano of PLANOS_PADRAO) {
    if (!existentes.find(p => p.codigo === plano.codigo)) {
      await base44.entities.PlanoAssinatura.create({ ...plano, ativo: true });
    }
  }
  return base44.entities.PlanoAssinatura.list();
}

/** Busca assinatura ativa de uma empresa */
export async function getAssinaturaEmpresa(empresa_id) {
  const lista = await base44.entities.AssinaturaEmpresa.filter({ empresa_id }, '-created_date', 1);
  return lista[0] || null;
}

/** Busca plano por código */
export async function getPlanoPorCodigo(codigo) {
  const lista = await base44.entities.PlanoAssinatura.filter({ codigo });
  return lista[0] || null;
}

/**
 * Cria assinatura trial para empresa recém-criada.
 * Chamado automaticamente no onboarding.
 */
export async function criarAssinaturaTrial(empresa_id, user_email) {
  const planos = await garantirPlanosPadrao();
  const planoTrial = planos.find(p => p.codigo === 'trial');
  if (!planoTrial) throw new Error('Plano trial não encontrado.');

  const hoje = format(new Date(), 'yyyy-MM-dd');
  const vencimento = format(addDays(new Date(), planoTrial.dias_trial || 14), 'yyyy-MM-dd');

  return base44.entities.AssinaturaEmpresa.create({
    empresa_id,
    plano_id: planoTrial.id,
    plano_codigo: 'trial',
    status_assinatura: 'trial',
    data_inicio: hoje,
    data_vencimento: vencimento,
    alterado_por: user_email || 'sistema',
  });
}

/**
 * Verifica se assinatura está ativa (trial ou paga dentro do prazo).
 * Retorna { valida, status, motivo, plano }
 */
export async function verificarAcessoEmpresa(empresa_id) {
  const hoje = format(new Date(), 'yyyy-MM-dd');

  const assinatura = await getAssinaturaEmpresa(empresa_id);
  if (!assinatura) return { valida: false, status: 'sem_assinatura', motivo: 'Empresa sem assinatura ativa.' };

  if (assinatura.status_assinatura === 'bloqueada') {
    return { valida: false, status: 'bloqueada', motivo: assinatura.motivo_bloqueio || 'Empresa bloqueada pelo administrador.' };
  }

  if (assinatura.data_vencimento < hoje) {
    // Atualiza status para vencida se ainda não está
    if (assinatura.status_assinatura !== 'vencida') {
      await base44.entities.AssinaturaEmpresa.update(assinatura.id, { status_assinatura: 'vencida' });
    }
    return { valida: false, status: 'vencida', motivo: `Assinatura vencida em ${assinatura.data_vencimento}.` };
  }

  const planos = await base44.entities.PlanoAssinatura.list();
  const plano = planos.find(p => p.id === assinatura.plano_id) || PLANOS_PADRAO.find(p => p.codigo === assinatura.plano_codigo) || PLANOS_PADRAO[0];

  return { valida: true, status: assinatura.status_assinatura, assinatura, plano };
}

/** Verifica se empresa pode usar um recurso específico */
export function verificarRecurso(plano, recurso) {
  if (!plano) return false;
  const mapa = {
    ia: plano.acesso_ia,
    cd: plano.acesso_cd,
    relatorios_avancados: plano.acesso_relatorios_avancados,
  };
  return !!mapa[recurso];
}

/** Altera plano de uma empresa (admin SaaS) */
export async function alterarPlanoEmpresa(empresa_id, novo_plano_codigo, admin_email, dias_vigencia = 30) {
  const plano = await getPlanoPorCodigo(novo_plano_codigo);
  if (!plano) throw new Error('Plano não encontrado.');

  const hoje = format(new Date(), 'yyyy-MM-dd');
  const vencimento = format(addDays(new Date(), dias_vigencia), 'yyyy-MM-dd');

  const assinatura = await getAssinaturaEmpresa(empresa_id);
  const dados = {
    empresa_id,
    plano_id: plano.id,
    plano_codigo: plano.codigo,
    status_assinatura: novo_plano_codigo === 'trial' ? 'trial' : 'ativa',
    data_inicio: hoje,
    data_vencimento: vencimento,
    alterado_por: admin_email,
  };

  if (assinatura) {
    return base44.entities.AssinaturaEmpresa.update(assinatura.id, dados);
  }
  return base44.entities.AssinaturaEmpresa.create(dados);
}

/** Bloqueia/desbloqueia empresa (admin SaaS) */
export async function alterarBloqueioEmpresa(empresa_id, bloquear, motivo, admin_email) {
  const assinatura = await getAssinaturaEmpresa(empresa_id);
  if (!assinatura) throw new Error('Empresa sem assinatura registrada.');
  return base44.entities.AssinaturaEmpresa.update(assinatura.id, {
    status_assinatura: bloquear ? 'bloqueada' : 'ativa',
    motivo_bloqueio: bloquear ? motivo : null,
    data_bloqueio: bloquear ? format(new Date(), 'yyyy-MM-dd') : null,
    alterado_por: admin_email,
  });
}

/** Estende trial de uma empresa (admin SaaS) */
export async function estenderTrial(empresa_id, dias_extras, admin_email) {
  const assinatura = await getAssinaturaEmpresa(empresa_id);
  if (!assinatura) throw new Error('Empresa sem assinatura registrada.');
  const novoVencimento = format(addDays(new Date(assinatura.data_vencimento + 'T12:00:00'), dias_extras), 'yyyy-MM-dd');
  return base44.entities.AssinaturaEmpresa.update(assinatura.id, {
    data_vencimento: novoVencimento,
    status_assinatura: 'trial',
    alterado_por: admin_email,
  });
}