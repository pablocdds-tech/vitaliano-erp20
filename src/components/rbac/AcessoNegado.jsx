import { ShieldOff, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function AcessoNegado({ modulo }) {
  const navigate = useNavigate();
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center px-4">
      <div className="p-4 rounded-full bg-red-50 dark:bg-red-900/20">
        <ShieldOff className="w-10 h-10 text-red-400" />
      </div>
      <h2 className="text-xl font-bold text-slate-800 dark:text-white">Acesso negado</h2>
      <p className="text-slate-500 text-sm max-w-xs">
        Você não tem permissão para acessar este módulo
        {modulo ? ` (${modulo})` : ''}.
        Contate um administrador.
      </p>
      <Button variant="outline" onClick={() => navigate(createPageUrl('Dashboard'))}>
        <ArrowLeft className="w-4 h-4 mr-2" /> Voltar ao Dashboard
      </Button>
    </div>
  );
}