'use client';

import { useEffect } from 'react';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return <html lang="pt-BR">
    <body>
      <main style={{ alignItems: 'center', background: '#f5f0e8', color: '#39362f', display: 'grid', minHeight: '100vh', padding: '2rem', textAlign: 'center' }}>
        <section>
          <p>Tear &amp; Aconchego</p>
          <h1>Não foi possível carregar o site</h1>
          <p>Tente novamente em alguns instantes.</p>
          <button type="button" onClick={() => reset()} style={{ background: '#52604a', border: 0, borderRadius: '.25rem', color: 'white', cursor: 'pointer', marginTop: '1rem', padding: '.8rem 1rem' }}>TENTAR NOVAMENTE</button>
        </section>
      </main>
    </body>
  </html>;
}
