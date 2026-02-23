import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { cn } from '@/lib/utils';
import Logo from '../ui-custom/Logo';
import { base44 } from '@/api/base44Client';
import {
  LayoutDashboard,
  Building2,
  Smartphone,
  Package,
  ShoppingCart,
  FileText,
  Wallet,
  TrendingUp,
  BarChart3,
  ClipboardCheck,
  CheckSquare,
  Wrench,
  Settings,
  Users,
  Bot,
  Sparkles,
  ChevronDown,
  Store,
  Truck,
  Tags,
  Boxes,
  ArrowLeftRight,
  Receipt,
  CreditCard,
  PiggyBank,
  FileBarChart,
  ClipboardList,
  HardDrive,
  Bell,
  Landmark,
  Vault,
  ShoppingBag,
  Shield
} from 'lucide-react';

const menuGroups = [
  {
    label: 'Principal',
    items: [
      { icon: LayoutDashboard, label: 'Dashboard', href: 'Dashboard' },
      { icon: Bell, label: 'Notificações', href: 'Notificacoes' }
    ]
  },
  {
    label: 'Cadastros',
    items: [
      { icon: Building2, label: 'Empresas', href: 'Empresas' },
      { icon: Store, label: 'Lojas', href: 'Lojas' },
      { icon: Truck, label: 'Fornecedores', href: 'Fornecedores' },
      { icon: Tags, label: 'Categorias', href: 'Categorias' },
      { icon: Package, label: 'Produtos', href: 'Produtos' }
    ]
  },
  {
    label: 'Compras & Estoque',
    items: [
      { icon: FileText, label: 'Notas Fiscais', href: 'NotasFiscais' },
      { icon: Boxes, label: 'Estoque', href: 'Estoque' },
      { icon: ArrowLeftRight, label: 'Movimentações', href: 'Movimentacoes' },
      { icon: ClipboardList, label: 'Contagens', href: 'Contagens' },
      { icon: ClipboardCheck, label: 'Templates Contagem', href: 'TemplatesContagem' }
    ]
  },
  {
    label: 'Produção',
    items: [
      { icon: Receipt, label: 'Fichas Técnicas', href: 'FichasTecnicas' },
      { icon: ShoppingCart, label: 'Ordens de Produção', href: 'Producao' }
    ]
  },
  {
    label: 'Financeiro',
    items: [
      { icon: CreditCard, label: 'Contas a Pagar', href: 'ContasPagar' },
      { icon: Wallet, label: 'Contas a Receber', href: 'ContasReceber' },
      { icon: PiggyBank, label: 'Banco Virtual', href: 'BancoVirtual' },
      { icon: FileBarChart, label: 'DRE Gerencial', href: 'DRE' },
      { icon: Landmark, label: 'Contas Bancárias', href: 'ContasBancarias' },
      { icon: Receipt, label: 'Movimentações Bancárias', href: 'MovimentacoesBancarias' },
      { icon: ClipboardCheck, label: 'Auditoria do Dia', href: 'AuditoriaDodia' },
      { icon: Vault, label: 'Cofres', href: 'Cofres' }
    ]
  },
  {
    label: 'Vendas',
    items: [
      { icon: ShoppingBag, label: 'CD → Lojas', href: 'PedidosInternos' },
      { icon: Smartphone, label: 'PDV Mobile', href: 'PDVMobile' },
      { icon: TrendingUp, label: 'Fechamento de Caixa', href: 'Vendas' },
      { icon: BarChart3, label: 'Relatórios', href: 'Relatorios' }
    ]
  },
  {
    label: 'Operação',
    items: [
      { icon: CheckSquare, label: 'Checklists', href: 'Checklists' },
      { icon: HardDrive, label: 'Ativos', href: 'Ativos' },
      { icon: Wrench, label: 'Manutenção', href: 'Manutencao' }
    ]
  },
  {
    label: 'Sistema',
    items: [
      { icon: Sparkles, label: 'Assistente ERP', href: 'AssistenteERP' },
      { icon: FileText, label: 'Agente Fiscal', href: 'AgenteFiscal' },
      { icon: Landmark, label: 'Conciliação Bancária', href: 'AgenteConciliacao' },
      { icon: Bot, label: 'IA Executora', href: 'IAExecutora' },
      { icon: Users, label: 'Usuários', href: 'Usuarios' },
      { icon: Settings, label: 'Configurações', href: 'Configuracoes' },
      { icon: Shield, label: 'Admin SaaS', href: 'AdminSaaS' }
    ]
  }
];

export default function Sidebar({ collapsed, onToggle }) {
  const location = useLocation();
  const [currentUser, setCurrentUser] = React.useState(null);

  React.useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  const paginasPermitidas = currentUser?.paginas_permitidas;
  const isAdmin = currentUser?.role === 'admin';

  const filterItems = (items) => {
    if (isAdmin || !paginasPermitidas || paginasPermitidas.length === 0) return items;
    return items.filter(item => paginasPermitidas.includes(item.href));
  };

  const [expandedGroups, setExpandedGroups] = React.useState(
    Object.fromEntries(menuGroups.map(g => [g.label, false]))
  );

  const toggleGroup = (label) => {
    setExpandedGroups(prev => ({
      ...prev,
      [label]: !prev[label]
    }));
  };

  const isActive = (href) => {
    const currentPath = location.pathname.replace('/', '');
    return currentPath === href || currentPath.startsWith(href + '/');
  };

  return (
    <aside className={cn(
      'fixed left-0 top-0 h-full w-[260px] bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 z-40 transition-transform duration-300 lg:transform-none',
      collapsed && window.innerWidth < 1024 ? '-translate-x-full' : 'translate-x-0'
    )}>
      <div className="h-16 flex items-center justify-between px-4 border-b border-slate-200 dark:border-slate-800">
        <Logo size="sm" showText={true} />
      </div>

      <nav className="p-3 h-[calc(100vh-64px)] overflow-y-auto scrollbar-thin">
        {menuGroups.map((group) => (
          <div key={group.label} className="mb-4">
            <button
              onClick={() => toggleGroup(group.label)}
              className="w-full flex items-center justify-between px-2 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider hover:text-slate-600 dark:hover:text-slate-300"
            >
              {group.label}
              <ChevronDown className={cn(
                'w-3.5 h-3.5 transition-transform',
                expandedGroups[group.label] ? 'rotate-180' : ''
              )} />
            </button>
            
            <div className={cn(
              'space-y-0.5 mt-1',
              expandedGroups[group.label] && 'hidden'
            )}>
              {group.items.map((item) => (
                <Link
                  key={item.href}
                  to={createPageUrl(item.href)}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group',
                    isActive(item.href)
                      ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                  )}
                >
                  <item.icon className={cn(
                    'w-5 h-5 flex-shrink-0',
                    isActive(item.href) ? '' : 'group-hover:scale-110 transition-transform'
                  )} />
                  <span className="text-sm font-medium truncate">{item.label}</span>
                  {isActive(item.href) && (
                    <div className="absolute left-0 w-1 h-6 bg-emerald-500 rounded-r-full" />
                  )}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}