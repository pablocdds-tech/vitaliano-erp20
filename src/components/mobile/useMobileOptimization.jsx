import { useEffect, useState } from 'react';

export function useMobileOptimization() {
  const [isMobile, setIsMobile] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [screenSize, setScreenSize] = useState('md');

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      const standalone = window.navigator.standalone === true || 
                        window.matchMedia('(display-mode: standalone)').matches;
      
      setIsMobile(mobile);
      setIsStandalone(standalone);

      // Detectar tamanho exato para ajustes de UX
      if (window.innerWidth < 480) {
        setScreenSize('xs');
      } else if (window.innerWidth < 768) {
        setScreenSize('sm');
      } else if (window.innerWidth < 1024) {
        setScreenSize('md');
      } else {
        setScreenSize('lg');
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Prevenir zoom indesejado em inputs
  useEffect(() => {
    if (isMobile) {
      const viewport = document.querySelector('meta[name="viewport"]');
      if (viewport) {
        viewport.setAttribute('content', 
          'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0, viewport-fit=cover'
        );
      }
    }
  }, [isMobile]);

  // Suporte a notch (safe area)
  useEffect(() => {
    if (isMobile && isStandalone) {
      const style = document.documentElement.style;
      style.setProperty('--safe-area-inset-top', 'env(safe-area-inset-top)');
      style.setProperty('--safe-area-inset-bottom', 'env(safe-area-inset-bottom)');
    }
  }, [isMobile, isStandalone]);

  return {
    isMobile,
    isStandalone,
    screenSize,
    // Helpers para componentes
    buttonSize: isMobile ? 'lg' : 'default',
    inputSize: isMobile ? 'lg' : 'default',
    paddingBottom: isStandalone ? 'pb-8' : 'pb-0'
  };
}