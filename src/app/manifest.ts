import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Phaseboard — Ideas to Action',
    short_name: 'Phaseboard',
    description: 'Capture ideas and organize tasks across project phases.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#f5f7fb',
    theme_color: '#172033',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ],
  };
}
