import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Shield } from 'lucide-react';
import { toast } from 'sonner';

const PAGINAS = [
  { grupo: 'Principal', itens: [
    { href: 'Dashboard', label: 'Dashboard' },
    { href: 'Notificacoes', label: 'Notificações' },
  ]},
  { grupo: 'Cadastros', itens: [
    { href: 'Empresas', label: 'Empresas' },
    { href: 'Lojas', label: 'Lojas' },
    { href: 'Fornecedores', label: 'Fornecedores' },
    { href: 'Categorias', label: 'Categorias' },
    { href: 'Produtos', label: 'Produtos' },
  ]},
  { grupo: 'Compras & Estoque', itens: [
    { href: 'NotasFiscais', label: 'Notas Fiscais' },
    { href: 'Estoque', label: 'Estoque' },
    { href: 'Movimentacoes', label: 'Movimentações' },
    { href: 'Contagens', label: 'Contagens' },
    { href: 'TemplatesContagem', label: 'Templates Contagem' },
  ]},
  { grupo: 'Produção', itens: [
    { href: 'FichasTecnicas', label: 'Fichas Técnicas' },
    { href: 'Producao', label: 'Ordens de Produção' },
  ]},
  { grupo: 'Financeiro', itens: [
    { href: 'ContasPagar', label: 'Contas a Pagar' },
    { href: 'ContasReceber', label: 'Contas a Receber' },
    { href: 'BancoVirtual', label: 'Banco Virtual' },
    { href: 'DRE', label: 'DRE Gerencial' },
    { href: 'ContasBancarias', label: 'Contas Bancárias' },
    { href: 'MovimentacoesBancarias', label: 'Movimentações Bancárias' },
    { href: 'AuditoriaDodia', label: 'Auditoria do Dia' },
    { href: 'Cofres', label: 'Cofres' },
  ]},
  { grupo: 'Vendas', itens: [
    { href: 'PedidosInternos', label: 'CD → Lojas' },
    { href: 'PDVMobile', label: 'PDV Mobile' },
    { href: 'Vendas', label: 'Fechamento de Caixa' },
    { href: 'Relatorios', label: 'Relatórios' },
  ]},
  { grupo: 'Operação', itens: [
    { href: 'Checklists', label: 'Checklists' },
    { href: 'Ativos', label: 'Ativos' },
    { href: 'Manutencao', label: 'Manutenção' },
  ]},
  { grupo: 'Sistema', itens: [
    { href: 'AssistenteERP', label: 'Assistente ERP' },
    { href: 'AgenteFiscal', label: 'Agente Fiscal' },
    { href: 'AgenteConciliacao', label: 'Conciliação Bancária' },
    { href: 'IAExecutora', label: 'IA Executora' },
    { href: 'Usuarios', label: 'Usuários' },
    { href: 'Configuracoes', label: 'Configurações' },
  ]},
];

export default function PermissoesModal({ user, onClose, onSave }) {
  const [selecionadas, setSelecionadas] = useState([]);

  useEffect(() => {
    if (user) {
      setSelecionadas(user.paginas_permitidas || []);
    }
  }, [user]);

  const allHrefs = PAGINAS.flatMap(g => g.itens.map(i => i.href));

  const togglePagina = (href) => {
    setSelecionadas(prev =>
      prev.includes(href) ? prev.filter(p => p !== href) : [...prev, href]
    );
  };

  const toggleGrupo = (itens) => {
    const hrefs = itens.map(i => i.href);
    const allSelected = hrefs.every(h => selecionadas.includes(h));
    if (allSelected) {
      setSelecionadas(prev => prev.filter(p => !hrefs.includes(p)));
    } else {
      setSelecionadas(prev => [...new Set([...prev, ...hrefs])]);
    }
  };

  const toggleAll = () => {
    if (selecionadas.length === allHrefs.length) {
      setSelecionadas([]);
    } else {
      setSelecionadas(allHrefs);
    }
  };

  const handleSave = () => {
    onSave(user.id, selecionadas);
  };

  if (!user) return null;

  return (
    <Dialog open={!!user} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-emerald-600" />
            Permissões de {user.full_name || user.email}
          </DialogTitle>
          <p className="text-sm text-slate-500">Selecione quais páginas este usuário pode acessar.</p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-center gap-2 pb-2 border-b">
            <Checkbox
              id="all"
              checked={selecionadas.length === allHrefs.length}
              onCheckedChange={toggleAll}
            />
            <Label htmlFor="all" className="font-semibold cursor-pointer">Selecionar todas as páginas</Label>
          </div>

          {PAGINAS.map(grupo => {
            const hrefs = grupo.itens.map(i => i.href);
            const allSelected = hrefs.every(h => selecionadas.includes(h));
            const someSelected = hrefs.some(h => selecionadas.includes(h)) && !allSelected;

            return (
              <div key={grupo.grupo} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id={`grupo-${grupo.grupo}`}
                    checked={allSelected}
                    data-state={someSelected ? 'indeterminate' : allSelected ? 'checked' : 'unchecked'}
                    onCheckedChange={() => toggleGrupo(grupo.itens)}
                  />
                  <Label htmlFor={`grupo-${grupo.grupo}`} className="font-semibold text-slate-700 cursor-pointer">
                    {grupo.grupo}
                  </Label>
                </div>
                <div className="grid grid-cols-2 gap-1.5 pl-6">
                  {grupo.itens.map(item => (
                    <div key={item.href} className="flex items-center gap-2">
                      <Checkbox
                        id={item.href}
                        checked={selecionadas.includes(item.href)}
                        onCheckedChange={() => togglePagina(item.href)}
                      />
                      <Label htmlFor={item.href} className="text-sm text-slate-600 cursor-pointer">{item.label}</Label>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700">
            Salvar Permissões
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}