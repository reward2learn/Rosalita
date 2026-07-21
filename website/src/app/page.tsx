import { redirect } from 'next/navigation';

export default async function HomePage() {
  let defaultPath = '/dashboard';
  try {
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';
    const res = await fetch(`${baseUrl}/api/default-route`, {
      cache: 'no-store',
    });
    if (res.ok) {
      const data = await res.json();
      if (data.path) defaultPath = data.path;
    }
  } catch {
    // fallback to /dashboard
  }
  redirect(defaultPath as '/dashboard');
}
