import React, { useState, useEffect } from 'react';
import { X, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function MobileInstallBanner() {
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const isStandalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
    
    if (isMobile && !isStandalone) {
      setIsIOS(/iPhone|iPad|iPod/.test(navigator.userAgent));
      // Mostrar após 2s de permanência na página
      const timer = setTimeout(() => setShow(true), 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  if (!show) return null;

  const iOSInstructions = (
    <div className="space-y-2 text-sm">
      <p className="font-medium">Instalar na tela inicial (iOS):</p>
      <ol className="list-decimal ml-4 space-y-1">
        <li>Toque no ícone compartilhar</li>
        <li>Selecione "Adicionar à tela inicial"</li>
        <li>Confirme o nome "Vitaliano"</li>
      </ol>
    </div>
  );

  const androidInstructions = (
    <div className="space-y-2 text-sm">
      <p className="font-medium">Instalar como app (Android):</p>
      <ol className="list-decimal ml-4 space-y-1">
        <li>Toque no menu (3 pontos)</li>
        <li>Selecione "Instalar app"</li>
        <li>Confirme a instalação</li>
      </ol>
    </div>
  );

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shadow-lg z-40 animate-in slide-in-from-bottom-5">
      <div className="max-w-md mx-auto p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Smartphone className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-slate-900 dark:text-white">Usar Vitaliano como app</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Acesso mais rápido e offline</p>
            </div>
          </div>
          <button
            onClick={() => setShow(false)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
          {isIOS ? iOSInstructions : androidInstructions}
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShow(false)}
            className="flex-1"
          >
            Depois
          </Button>
          <Button
            size="sm"
            className="flex-1 bg-blue-600 hover:bg-blue-700"
            onClick={() => {
              setShow(false);
              // Analytics: usuário clicou em instalar
              if (window.base44?.analytics) {
                window.base44.analytics.track({
                  eventName: 'mobile_install_clicked',
                  properties: { platform: isIOS ? 'iOS' : 'Android' }
                });
              }
            }}
          >
            Ver instruções
          </Button>
        </div>
      </div>
    </div>
  );
}