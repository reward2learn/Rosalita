import { NextResponse } from 'next/server';
import { createClient } from '@/lib/db';
import { getAppSettings } from '@/domain/config/app-settings-service';

export async function GET() {
  try {
    const db = createClient();
    const result = await db.appSetting.findMany();
    return NextResponse.json({ success: true, count: result.length, data: result }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : '';
    return NextResponse.json({ success: false, error: msg, stack }, { status: 500 });
  }
}

export async function PUT() {
  try {
    const db = createClient();
    await db.appSetting.upsert({
      where: { id: 'test123' },
      create: { id: 'test123', tenantSlug: 'test' },
      update: { brandLogoText: 'Test' },
    });
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : '';
    return NextResponse.json({ success: false, error: msg, stack }, { status: 500 });
  }
}
