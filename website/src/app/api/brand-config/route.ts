/**
 * Public Brand Config API
 *
 * GET /api/brand-config
 *   Returns: { brandLogoText, brandLogoUrl, brandPrimaryColor, brandSecondaryColor }
 *   No auth required — called by the header and theme on every page load.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/db';
import { getAppSettings } from '@/domain/config/app-settings-service';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  // Graceful fallback when no DB is configured (local dev, demo mode)
  if (!process.env.POSTGRES_URL && !process.env.DATABASE_URL) {
    return NextResponse.json({
      brandLogoText: '',
      brandLogoUrl: '',
      brandPrimaryColor: '#eb3d28',
      brandSecondaryColor: '#0af9fe',
    });
  }

  try {
    const db = createClient();
    const settings = await getAppSettings(db);
    return NextResponse.json({
      brandLogoText: settings.brandLogoText,
      brandLogoUrl: settings.brandLogoUrl,
      brandPrimaryColor: settings.brandPrimaryColor,
      brandSecondaryColor: settings.brandSecondaryColor,
    });
  } catch (err) {
    console.error('[brand-config] Failed to read:', err);
    // Return defaults so the UI never breaks
    return NextResponse.json({
      brandLogoText: '',
      brandLogoUrl: '',
      brandPrimaryColor: '#eb3d28',
      brandSecondaryColor: '#0af9fe',
    });
  }
}
