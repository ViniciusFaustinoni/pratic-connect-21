// Push Notification Handler for Service Worker
// Este arquivo é importado pelo service worker principal via importScripts

self.addEventListener('push', (event) => {
  console.log('[SW Push] Notificação push recebida:', new Date().toISOString());

  if (!event.data) {
    console.log('[SW Push] Push event sem dados');
    return;
  }

  try {
    const data = event.data.json();
    console.log('[SW Push] Dados da notificação:', data);

    const options = {
      body: data.body || 'Nova notificação!',
      icon: data.icon || '/pwa-instalador-512x512.png',
      badge: data.badge || '/pwa-instalador-192x192.png',
      tag: data.tag || 'tarefa-' + Date.now(),
      requireInteraction: true,
      vibrate: [200, 100, 200, 100, 200],
      data: data.data || {},
      actions: data.actions || [
        { action: 'ver', title: 'Ver Tarefa' },
        { action: 'fechar', title: 'Fechar' }
      ]
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'PRATIC Profissional', options)
    );
  } catch (error) {
    console.error('[SW Push] Erro ao processar notificação:', error);
  }
});

self.addEventListener('notificationclick', (event) => {
  console.log('[SW Push] Clique na notificação:', event.action);
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/instalador';

  if (event.action === 'ver' || !event.action) {
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then((clientList) => {
          // Tentar focar em janela existente
          for (const client of clientList) {
            if ('focus' in client) {
              client.navigate(urlToOpen);
              return client.focus();
            }
          }
          // Abrir nova janela se não encontrar
          if (clients.openWindow) {
            return clients.openWindow(urlToOpen);
          }
        })
    );
  }
});

self.addEventListener('notificationclose', (event) => {
  console.log('[SW Push] Notificação fechada:', event.notification.tag);
});

console.log('[SW Push] Push handler carregado');
