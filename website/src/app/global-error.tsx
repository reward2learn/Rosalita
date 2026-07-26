'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ background: '#0f0f14', color: '#e0e0e0', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh' }}>
          <h1 style={{ fontSize: '2rem', color: '#eb3d28' }}>Something went wrong</h1>
          <p style={{ margin: '1rem 0' }}>{error.message || 'An unexpected error occurred.'}</p>
          <button
            onClick={() => reset()}
            style={{ padding: '8px 16px', background: '#eb3d28', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: '1rem' }}
          >
            Try Again
          </button>
        </div>
      </body>
    </html>
  );
}
