/**
 * PERMISSÃO SERVICE — RBAC por módulo e loja
 * Perfis pré-definidos e helpers para verificar acesso.
 */
import { base44 } from '@/api/base44Client';

// ─── Módulos do sistema (slug → label) ────────────────────────────────────────
export const MODULOS = [
  { slug: 'dashboard',      label: 'Dashboard',            grupo: 'Principal' },
  { slug: 'notificacoes',   label: 'Notificações',          grupo: 'Principal' },
  { slug: 'cadastros',      label: 'Cadastros (Empresas/Lojas/Fornecedores/Categorias/Produtos)', grupo: 'Cadastros' },
  { slug: 'notas_fiscais',  label: 'Notas Fiscais',         grupo: 'Compras & Estoque' },
  { slug: 'estoque',        label: 'Estoque',               grupo: 'Compras & Estoque' },
  { slug: 'movimentacoes',  label: 'Movimentações',         grupo: 'Compras & Estoque' },
  { slug: 'contagens',      label: 'Contagens',             grupo: 'Compras & Estoque' },
  { slug: 'producao',       label: 'Produção / Fichas',     grupo: 'Produção' },
  { slug: 'contas_pagar',   label: 'Contas a Pagar',        grupo: 'Financeiro' },
  { slug: 'contas_receber', label: 'Contas a Receber',      grupo: 'Financeiro' },
  { slug: 'banco_virtual',  label: 'Banco Virtual',         grupo: 'Financeiro' },
  { slug: 'dre',            label: 'DRE Gerencial',         grupo: 'Financeiro' },
  { slug: 'bancos',         label: 'Contas Bancárias / Mov. Bancárias', grupo: 'Financeiro' },
  { slug: 'auditoria',      label: 'Auditoria do Dia',      grupo: 'Financeiro' },
  { slug: 'cofres',         label: 'Cofres',                grupo: 'Financeiro' },
  { slug: 'vendas',         label: 'Vendas / Fechamento / PDV', grupo: 'Vendas' },
  { slug: 'pedidos_internos', label: 'CD → Lojas',          grupo: 'Vendas' },
  { slug: 'relatorios',     label: 'Relatórios',            grupo: 'Vendas' },
  { slug: 'checklists',     label: 'Checklists',            grupo: 'Operação' },
  { slug: 'ativos',         label: 'Ativos',                grupo: 'Operação' },
  { slug: 'manutencao',     label: 'Manutenção',            grupo: 'Operação' },
  { slug: 'ia',             label: 'IA Executora',          grupo: 'Sistema' },
  { slug: 'usuarios',       label: 'Usuários',              grupo: 'Sistema' },
  { slug: 'configuracoes',  label: 'Configurações',         grupo: 'Sistema' },
  { slug: 'admin_saas',     label: 'Admin SaaS',            grupo: 'Sistema' },
];

// ─── Permissão total ──────────────────────────────────────────────────────────
const TUDO = { ver: true, criar: true, editar: true, excluir: true };
const SO_VER = { ver: true, criar: false, editar: false, excluir: false };
const VER_CRIAR_EDITAR = { ver: true, criar: true, editar: true, excluir: false };

function gerarModulos(regras) {
  const mapa = {};
  MODULOS.forEach(m => {
    mapa[m.slug] = regras[m.slug] || { ver: false, criar: false, editar: false, excluir: false };
  });
  return mapa;
}

// ─── Perfis pré-definidos ─────────────────────────────────────────────────────
export const PERFIS = {
  admin: {
    label: 'Administrador',
    cor: 'red',
    modulos: gerarModulos(Object.fromEntries(MODULOS.map(m => [m.slug, TUDO])))
  },
  gerente_loja: {
    label: 'Gerente de Loja',
    cor: 'orange',
    modulos: gerarModulos({
      dashboard: TUDO, notificacoes: SO_VER,
      estoque: TUDO, movimentacoes: TUDO, contagens: TUDO,
      contas_pagar: TUDO, contas_receber: TUDO, banco_virtual: SO_VER,
      vendas: TUDO, pedidos_internos: TUDO, relatorios: SO_VER,
      auditoria: TUDO, checklists: TUDO, producao: TUDO,
      notas_fiscais: VER_CRIAR_EDITAR,
      cadastros: VER_CRIAR_EDITAR,
    })
  },
  financeiro: {
    label: 'Financeiro',
    cor: 'blue',
    modulos: gerarModulos({
      dashboard: SO_VER, notificacoes: SO_VER,
      contas_pagar: TUDO, contas_receber: TUDO,
      banco_virtual: TUDO, dre: TUDO, bancos: TUDO,
      auditoria: TUDO, cofres: TUDO,
      relatorios: SO_VER, vendas: SO_VER,
    })
  },
  estoque: {
    label: 'Estoque',
    cor: 'green',
    modulos: gerarModulos({
      dashboard: SO_VER, notificacoes: SO_VER,
      estoque: TUDO, movimentacoes: TUDO,
      notas_fiscais: TUDO, contagens: TUDO,
      producao: VER_CRIAR_EDITAR,
      cadastros: SO_VER,
    })
  },
  funcionario_contagem: {
    label: 'Funcionário Contagem',
    cor: 'gray',
    modulos: gerarModulos({
      dashboard: SO_VER,
      contagens: SO_VER,
    })
  },
};

// ─── Mapeamento: página → slug do módulo ─────────────────────────────────────
export const PAGE_TO_MODULE = {
  Dashboard:           'dashboard',
  Notificacoes:        'notificacoes',
  Empresas:            'cadastros',
  Lojas:               'cadastros',
  Fornecedores:        'cadastros',
  Categorias:          'cadastros',
  Produtos:            'cadastros',
  NotasFiscais:        'notas_fiscais',
  Estoque:             'estoque',
  Movimentacoes:       'movimentacoes',
  Contagens:           'contagens',
  TemplatesContagem:   'contagens',
  FichasTecnicas:      'producao',
  Producao:            'producao',
  ContasPagar:         'contas_pagar',
  ContasReceber:       'contas_receber',
  BancoVirtual:        'banco_virtual',
  DRE:                 'dre',
  ContasBancarias:     'bancos',
  MovimentacoesBancarias: 'bancos',
  AuditoriaDodia:      'auditoria',
  Cofres:              'cofres',
  Vendas:              'vendas',
  PDVMobile:           'vendas',
  PedidosInternos:     'pedidos_internos',
  Relatorios:          'relatorios',
  Checklists:          'checklists',
  Ativos:              'ativos',
  Manutencao:          'manutencao',
  IAExecutora:         'ia',
  Usuarios:            'usuarios',
  Configuracoes:       'configuracoes',
  AdminSaaS:           'admin_saas',
};

// ─── Cache local (por sessão) ─────────────────────────────────────────────────
let _cache = null;

export async function getMinhasPermissoes() {
  if (_cache) return _cache;
  const user = await base44.auth.me();
  // Admin sempre tem tudo
  if (user.role === 'admin') {
    _cache = {
      isAdmin: true,
      modulos: gerarModulos(Object.fromEntries(MODULOS.map(m => [m.slug, TUDO]))),
      loja_ids: [], // vazio = todas
    };
    return _cache;
  }
  // Busca permissões do usuário
  const [permissoes, lojaAcesso] = await Promise.all([
    base44.entities.UserPermissao.filter({ user_id: user.id }),
    base44.entities.UserLojaAcesso.filter({ user_id: user.id }),
  ]);
  const perm = permissoes[0];
  const loja = lojaAcesso[0];
  _cache = {
    isAdmin: false,
    modulos: perm?.modulos || gerarModulos({ dashboard: SO_VER }),
    loja_ids: loja?.loja_ids || [],
  };
  return _cache;
}

export function clearPermissaoCache() {
  _cache = null;
}

export function podeVer(permissoes, modulo) {
  if (permissoes?.isAdmin) return true;
  return permissoes?.modulos?.[modulo]?.ver === true;
}

export function podeCriar(permissoes, modulo) {
  if (permissoes?.isAdmin) return true;
  return permissoes?.modulos?.[modulo]?.criar === true;
}

export function podeEditar(permissoes, modulo) {
  if (permissoes?.isAdmin) return true;
  return permissoes?.modulos?.[modulo]?.editar === true;
}

export function podeExcluir(permissoes, modulo) {
  if (permissoes?.isAdmin) return true;
  return permissoes?.modulos?.[modulo]?.excluir === true;
}