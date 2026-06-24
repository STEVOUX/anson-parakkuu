const CACHE_NAME = 'anson-parakkuu-v2';
const ASSETS = [
    '/',
    '/index.html',
    '/style.css',
    '/game.js',
    '/manifest.json',
    '/Assets/anson-title.png',
    '/Assets/anson smile.png',
    '/Assets/anson mouth.png',
    '/Assets/anson happy.png',
    '/Assets/anson hit.png',
    '/Assets/anson lip.png',
    '/Assets/bharathgas top.png',
    '/Assets/game_bg.png'
];

self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', e => {
    e.respondWith(
        caches.match(e.request).then(r => r || fetch(e.request))
    );
});
