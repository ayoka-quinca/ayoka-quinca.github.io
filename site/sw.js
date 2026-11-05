/**
 * Service worker « de nettoyage » à la racine du site.
 * Avant la V2.2, l'application de gestion était publiée à la racine et y avait installé
 * un service worker qui garde une vieille copie de la page. Quand le navigateur vérifie
 * s'il existe une mise à jour, il reçoit ce fichier : il efface les anciennes copies
 * de la racine (sans toucher à /gestion/), se désinstalle, puis recharge la page.
 */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const root = self.registration.scope; // https://ayoka-quinca.github.io/
    for (const key of await caches.keys()) {
      if (!key.includes(root + 'gestion/')) await caches.delete(key);
    }
    await self.registration.unregister();
    for (const client of await self.clients.matchAll({ type: 'window' })) client.navigate(client.url);
  })());
});
