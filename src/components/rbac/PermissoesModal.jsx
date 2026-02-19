import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Shield, Store } from 'lucide-react';
import { toast } from 'sonner';
import { MODULOS, PERFIS, clearPermissaoCache } from '@/components/services/permissaoService';
import { getEmpresaAtiva } from '@/components/services/tenantService';

const ACOES = [
  { key: 'ver',     label: 'Ver' },
  { key: 'criar',   label: 'Criar' },
  { key: 'editar',  label: 'Editar' },
  { key: 'excluir', label: 'Excluir' },
];

function initModulos() {
  const m = {};
  MODULOS.forEach(mod => {
    m[mod.slug] = { ver: false, criar: false, editar: false, excluir: false };
  });
  return m;
}

export default function PermissoesModal({ open, onClose, usuario }) {
  const qc = useQueryClient();
  const [perfil, setPerfil] = useState('personalizado');
  const [modulos, setModulos] = useState(initModulos());
  const [lojasSelecionadas, setLojasSelecionadas] = useState([]);
  const [empresaId, setEmpresaId] = useState(null);

  // Lojas disponíveis
  const { data: lojas = [] } = useQuery({
    queryKey: ['lojas-ativas'],
    queryFn: () => base44.entities.Loja.filter({ status: 'ativo' }),
    enabled: open,
  });

  // Carrega permissões existentes
  const { data: permExistente } = useQuery({
    queryKey: ['user-permissao', usuario?.id],
    queryFn: () => base44.entities.UserPermissao.filter({ user_id: usuario.id }),
    enabled: open && !!usuario?.id,
  });

  const { data: lojaAcessoExistente } = useQuery({
    queryKey: ['user-loja-acesso', usuario?.id],
    queryFn: () => base44.entities.UserLojaAcesso.filter({ user_id: usuario.id }),
    enabled: open && !!usuario?.id,
  });

  // Carrega empresa_id na abertura
  useEffect(() => {
    if (open) {
      getEmpresaAtiva().then(e => setEmpresaId(e.id)).catch(() => {});
    }
  }, [open]);

  // Preenche form com dados existentes
  useEffect(() => {
    if (!open) return;
    if (permExistente?.[0]) {
      const p = permExistente[0];
      setPerfil(p.perfil || 'personalizado');
      setModulos({ ...initModulos(), ...(p.modulos || {}) });
    } else {
      setPerfil('personalizado');
      setModulos(initModulos());
    }
    if (lojaAcessoExistente?.[0]) {
      setLojasSelecionadas(lojaAcessoExistente[0].loja_ids || []);
    } else {
      setLojasSelecionadas([]);
    }
  }, [permExistente, lojaAcessoExistente, open]);

  const aplicarPerfil = (slug) => {
    setPerfil(slug);
    if (PERFIS[slug]) {
      setModulos({ ...initModulos(), ...PERFIS[slug].modulos });
    }
  };

  const toggleAcao = (moduloSlug, acao) => {
    setModulos(prev => {
      const atual = { ...prev[moduloSlug] };
      atual[acao] = !atual[acao];
      // Se marcar criar/editar/excluir, ver é obrigatório
      if (['criar', 'editar', 'excluir'].includes(acao) && !atual.ver && atual[acao]) {
        atual.ver = true;
      }
      return { ...prev, [moduloSlug]: atual };
    });
    setPerfil('personalizado');
  };

  const toggleLoja = (lojaId) => {
    setLojasSelecionadas(prev =>
      prev.includes(lojaId) ? prev.filter(id => id !== lojaId) : [...prev, lojaId]
    );
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!usuario?.id || !empresaId) throw new Error('Dados incompletos');

      // Salva UserPermissao (upsert: deleta e recria)
      const permList = await base44.entities.UserPermissao.filter({ user_id: usuario.id });
      if (permList[0]) {
        await base44.entities.UserPermissao.update(permList[0].id, {
          perfil, modulos, empresa_id: empresaId,
        });
      } else {
        await base44.entities.UserPermissao.create({
          user_id: usuario.id, empresa_id: empresaId, perfil, modulos,
        });
      }

      // Salva UserLojaAcesso
      const lojaList = await base44.entities.UserLojaAcesso.filter({ user_id: usuario.id });
      if (lojaList[0]) {
        await base44.entities.UserLojaAcesso.update(lojaList[0].id, {
          loja_ids: lojasSelecionadas, empresa_id: empresaId,
        });
      } else {
        await base44.entities.UserLojaAcesso.create({
          user_id: usuario.id, empresa_id: empresaId, loja_ids: lojasSelecionadas,
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user-permissao', usuario?.id] });
      qc.invalidateQueries({ queryKey: ['user-loja-acesso', usuario?.id] });
      clearPermissaoCache();
      toast.success('Permissões salvas!');
      onClose();
    },
    onError: e => toast.error('Erro ao salvar: ' + e.message),
  });

  // Agrupa módulos por grupo
  const grupos = [...new Set(MODULOS.map(m => m.grupo))];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-emerald-500" />
            Permissões — {usuario?.full_name || usuario?.email}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Lojas */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 font-semibold">
              <Store className="w-4 h-4" /> Lojas permitidas
            </Label>
            <p className="text-xs text-slate-500">Nenhuma selecionada = acesso a todas as lojas</p>
            <div className="flex flex-wrap gap-2">
              {lojas.map(loja => (
                <button
                  key={loja.id}
                  type="button"
                  onClick={() => toggleLoja(loja.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    lojasSelecionadas.includes(loja.id)
                      ? 'bg-emerald-500 text-white border-emerald-500'
                      : 'bg-white text-slate-600 border-slate-300 hover:border-emerald-400'
                  }`}
                >
                  {loja.nome}
                </button>
              ))}
              {lojas.length === 0 && (
                <span className="text-xs text-slate-400">Nenhuma loja cadastrada</span>
              )}
            </div>
          </div>

          {/* Perfil */}
          <div className="space-y-2">
            <Label className="font-semibold">Perfil de acesso</Label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(PERFIS).map(([slug, p]) => (
                <button
                  key={slug}
                  type="button"
                  onClick={() => aplicarPerfil(slug)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    perfil === slug
                      ? 'bg-slate-800 text-white border-slate-800'
                      : 'bg-white text-slate-600 border-slate-300 hover:border-slate-500'
                  }`}
                >
                  {p.label}
                </button>
              ))}
              {perfil === 'personalizado' && (
                <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700 border border-purple-300">
                  Personalizado
                </span>
              )}
            </div>
          </div>

          {/* Matriz de permissões */}
          <div className="space-y-1">
            <Label className="font-semibold">Permissões por módulo</Label>
            <p className="text-xs text-slate-500 mb-3">Selecione um perfil para preencher automaticamente, ou edite manualmente.</p>

            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800 border-b">
                    <th className="text-left px-3 py-2 font-medium text-slate-600 dark:text-slate-300 w-full">Módulo</th>
                    {ACOES.map(a => (
                      <th key={a.key} className="px-3 py-2 text-center font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap w-16">{a.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {grupos.map(grupo => (
                    <React.Fragment key={grupo}>
                      <tr className="bg-slate-100 dark:bg-slate-700/50">
                        <td colSpan={5} className="px-3 py-1 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                          {grupo}
                        </td>
                      </tr>
                      {MODULOS.filter(m => m.grupo === grupo).map(mod => (
                        <tr key={mod.slug} className="border-b last:border-0 hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                          <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{mod.label}</td>
                          {ACOES.map(a => (
                            <td key={a.key} className="px-3 py-2 text-center">
                              <Checkbox
                                checked={modulos[mod.slug]?.[a.key] === true}
                                onCheckedChange={() => toggleAcao(mod.slug, a.key)}
                                className="mx-auto"
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {saveMutation.isPending ? 'Salvando...' : 'Salvar permissões'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}