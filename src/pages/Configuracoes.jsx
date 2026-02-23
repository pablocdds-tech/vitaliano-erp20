import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation } from '@tanstack/react-query';
import PageHeader from '@/components/ui-custom/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings, Save, Trash2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function Configuracoes() {
  const [userData, setUserData] = useState(null);
  const [formData, setFormData] = useState({
    full_name: '',
    tema: 'system',
    fuso_horario: 'America/Sao_Paulo'
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const user = await base44.auth.me();
      setUserData(user);
      setFormData({
        full_name: user.full_name || '',
        tema: user.tema || 'system',
        fuso_horario: user.fuso_horario || 'America/Sao_Paulo'
      });
    } catch (err) {
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const updateMutation = useMutation({
    mutationFn: (data) => base44.auth.updateMe(data),
    onSuccess: () => {
      toast.success('Configurações salvas!');
      loadUserData();
    },
    onError: () => toast.error('Erro ao salvar')
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  const [resetting, setResetting] = useState(false);

  const handleReset = async () => {
    setResetting(true);
    try {
      const entities = [
        'Estoque', 'MovimentacaoEstoque', 'ContaPagar', 'ContaReceber',
        'BancoVirtual', 'NotaFiscal', 'Venda', 'Producao', 'PedidoInterno',
        'Contagem', 'ItemContagem', 'RespostaChecklist', 'AuditoriaDodia',
        'MovimentacaoCofre', 'TransacaoBancaria', 'AcaoIA', 'Notificacao'
      ];

      for (const entity of entities) {
        try {
          const records = await base44.entities[entity].list();
          for (const record of records) {
            await base44.entities[entity].delete(record.id);
          }
        } catch (e) {
          // ignora entidade inexistente
        }
      }

      toast.success('Sistema resetado! Dados operacionais apagados.');
    } catch (err) {
      toast.error('Erro ao resetar: ' + err.message);
    } finally {
      setResetting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await base44.auth.logout();
      window.location.href = '/';
    } catch (err) {
      toast.error('Erro ao desconectar');
    }
  };

  if (loading) {
    return <div className="p-6">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configurações"
        subtitle="Gerencie suas preferências"
        icon={Settings}
        breadcrumbs={[{ label: 'Dashboard', href: 'Dashboard' }, { label: 'Sistema' }, { label: 'Configurações' }]}
      />

      <div className="grid gap-6 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Perfil</CardTitle>
            <CardDescription>Informações da sua conta</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={userData?.email || ''} disabled className="bg-slate-100" />
            </div>
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={formData.full_name}
                onChange={e => setFormData({ ...formData, full_name: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Preferências</CardTitle>
            <CardDescription>Customize sua experiência</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Tema</Label>
              <Select value={formData.tema} onValueChange={v => setFormData({ ...formData, tema: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Claro</SelectItem>
                  <SelectItem value="dark">Escuro</SelectItem>
                  <SelectItem value="system">Sistema</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Fuso Horário</Label>
              <Select value={formData.fuso_horario} onValueChange={v => setFormData({ ...formData, fuso_horario: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="America/Sao_Paulo">São Paulo (BRT)</SelectItem>
                  <SelectItem value="America/Fortaleza">Fortaleza</SelectItem>
                  <SelectItem value="America/Manaus">Manaus</SelectItem>
                  <SelectItem value="America/Brasilia">Brasília</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ações</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button onClick={handleSubmit} disabled={updateMutation.isPending} className="gap-2 w-full">
              <Save className="w-4 h-4" />
              Salvar Configurações
            </Button>
            <Button onClick={handleLogout} variant="outline" className="w-full">
              Desconectar
            </Button>
          </CardContent>
        </Card>

        {userData?.role === 'admin' && (
          <Card className="border-red-200 bg-red-50">
            <CardHeader>
              <CardTitle className="text-red-700 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Zona de Perigo
              </CardTitle>
              <CardDescription className="text-red-600">
                Ações irreversíveis. Use com extremo cuidado.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-white border border-red-200 rounded-lg p-4 space-y-2">
                <p className="font-medium text-slate-800">Reset Operacional</p>
                <p className="text-sm text-slate-600">
                  Apaga todos os dados operacionais: estoque, movimentações, contas a pagar/receber, notas fiscais, vendas, produções, pedidos internos e checklists. 
                  <strong> Cadastros (produtos, fornecedores, lojas, categorias) são mantidos.</strong>
                </p>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="gap-2 mt-2" disabled={resetting}>
                      <Trash2 className="w-4 h-4" />
                      {resetting ? 'Resetando...' : 'Resetar Dados Operacionais'}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2 text-red-700">
                        <AlertTriangle className="w-5 h-5" />
                        Confirmar Reset
                      </AlertDialogTitle>
                      <AlertDialogDescription className="space-y-2">
                        <p>Esta ação é <strong>irreversível</strong>. Serão apagados:</p>
                        <ul className="list-disc list-inside text-sm space-y-1 mt-2">
                          <li>Todo o estoque e movimentações</li>
                          <li>Contas a pagar e a receber</li>
                          <li>Notas fiscais importadas</li>
                          <li>Vendas e fechamentos</li>
                          <li>Produções e pedidos internos</li>
                          <li>Banco virtual e cofres</li>
                          <li>Checklists respondidos</li>
                          <li>Notificações e logs de IA</li>
                        </ul>
                        <p className="mt-2 font-medium">Produtos, fornecedores, lojas e categorias <strong>NÃO</strong> serão apagados.</p>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleReset}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        Sim, resetar tudo
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}