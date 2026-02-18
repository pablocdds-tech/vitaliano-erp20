import { useEffect, useState } from 'react';

export function useNotificationPermission() {
  const [permission, setPermission] = useState('default');
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    const checkSupport = async () => {
      const isSupported = 'Notification' in window && 'serviceWorker' in navigator;
      setSupported(isSupported);

      if (isSupported) {
        setPermission(Notification.permission);
      }
    };

    checkSupport();
  }, []);

  const requestPermission = async () => {
    if (!supported) {
      console.warn('Notificações não suportadas neste dispositivo');
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result === 'granted';
    } catch (error) {
      console.error('Erro ao solicitar permissão de notificação:', error);
      return false;
    }
  };

  const registerDeviceToken = async () => {
    if (permission !== 'granted' || !supported) {
      return null;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      // Pronto para receber token de push (futura implementação em B17)
      // Aqui seria: const subscription = await registration.pushManager.subscribe(...)
      return registration;
    } catch (error) {
      console.error('Erro ao registrar device para notificações:', error);
      return null;
    }
  };

  return {
    permission,
    supported,
    requestPermission,
    registerDeviceToken,
    isGranted: permission === 'granted'
  };
}