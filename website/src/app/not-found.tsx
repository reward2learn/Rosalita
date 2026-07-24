import Link from 'next/link';

export default function NotFound() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', fontFamily: 'system-ui, sans-serif', background: '#0f0f14', color: '#e0e0e0' }}>
      <h1 style={{ fontSize: '4rem', margin: 0, color: '#eb3d28' }}>404</h1>
      <p style={{ fontSize: '1.25rem', margin: '1rem 0' }}>This page could not be found.</p>
      <Link href="/dashboard" style={{ color: '#0af9fe', textDecoration: 'none', fontSize: '1rem' }}>
        Back to Dashboard
      </Link>
    </div>
  );
}
