import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import OnboardingEmpresa from './OnboardingEmpresa';
import { Loader2 } from 'lucide-react';

/**
 * TenantGuard — Garante que o usuário tenha uma empresa vinculada.
 * Se não tiver, mostra o fluxo de onboarding antes de renderizar os filhos.
 */
export default function TenantGuard({ children, currentPageName }) {
  const [status, setStatus] = useState('loading'); // loading | ok | onboarding
  const [user, setUser] = useState(null);

  // Páginas que não precisam de tenant
  const publicPages = ['Onboarding', 'AdminSaaS', 'ContagemTarefa'];

  useEffect(() => {
    if (publicPages.includes(currentPageName)) {
      setStatus('ok');
      return;
    }
    checkTenant();
  }, [currentPageName]);

  const checkTenant = async () => {
    try {
      const me = await base44.auth.me();
      setUser(me);
      if (!me?.empresa_id) {
        // Superadmin não precisa de empresa vinculada
        if (me?.role === 'superadmin') {
          setStatus('ok');
        } else {
          setStatus('onboarding');
        }
      } else {
        setStatus('ok');
      }
    } catch {
      setStatus('ok'); // Se falhar auth, deixa o sistema lidar
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (status === 'onboarding') {
    return (
      <OnboardingEmpresa
        user={user}
        onComplete={() => {
          setStatus('loading');
          setTimeout(() => checkTenant(), 500);
        }}
      />
    );
  }

  return children;
}