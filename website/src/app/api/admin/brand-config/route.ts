/**
 * Admin Brand Config API
 *
 * GET  /api/admin/brand-config
 *   Returns: full brand config including both text and image URL
 *
 * PUT  /api/admin/brand-config   (multipart/form-data)
 *   Fields:
 *     brandLogoText — text string for the header logo
 *     brandLogoUrl  — URL or base64 data-URI of the uploaded logo image
 *   Returns: updated brand config
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/db';
import { requireWriteAuth } from '@/lib/auth/guards';
import { sessionIsPlatformAdmin } from '@/lib/auth/jwt';
import { jsonError, jsonOk } from '@/lib/api/response';
import { getAppSettings, updateAppSettings } from '@/domain/config/app-settings-service';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const putSchema = z.object({
  brandLogoText: z.string().max(100).optional(),
  brandLogoUrl: z.string().max(50000).optional(), // base64 data-URIs can be large
  brandPrimaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a hex color like #eb3d28').optional(),
  brandSecondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a hex color like #0af9fe').optional(),
});

// ── GET ─────────────────────────────────────────────────

export async function GET(request: Request): Promise<NextResponse> {
  const guard = await requireWriteAuth(request);
  if (!guard.ok) return guard.response;
  if (!sessionIsPlatformAdmin(guard.session)) return jsonError('Platform admin only', 403);

  const db = createClient();
  const settings = await getAppSettings(db);

  return jsonOk({
    brandLogoText: settings.brandLogoText,
    brandLogoUrl: settings.brandLogoUrl,
    brandPrimaryColor: settings.brandPrimaryColor,
    brandSecondaryColor: settings.brandSecondaryColor,
    updatedAt: settings.updatedAt.toISOString(),
  });
}

// ── PUT (multipart) ─────────────────────────────────────

export async function PUT(request: Request): Promise<NextResponse> {
  const guard = await requireWriteAuth(request);
  if (!guard.ok) return guard.response;
  if (!sessionIsPlatformAdmin(guard.session)) return jsonError('Platform admin only', 403);

  let brandLogoText: string | undefined;
  let brandLogoUrl: string | undefined;
  let brandPrimaryColor: string | undefined;
  let brandSecondaryColor: string | undefined;

  const contentType = request.headers.get('content-type') ?? '';

  if (contentType.includes('multipart/form-data')) {
    // Handle file upload + text field via FormData
    try {
      const formData = await request.formData();

      const textField = formData.get('brandLogoText');
      if (textField && typeof textField === 'string') {
        brandLogoText = textField;
      }

      const fileField = formData.get('brandLogo');
      if (fileField instanceof File && fileField.size > 0) {
        if (fileField.size > 2 * 1024 * 1024) {
          return jsonError('Logo image must be under 2 MB', 400);
        }
        const buffer = Buffer.from(await fileField.arrayBuffer());
        const base64 = buffer.toString('base64');
        const mime = fileField.type || 'image/png';
        brandLogoUrl = `data:${mime};base64,${base64}`;
      }

      // Also allow a direct URL override via a separate form field
      const urlField = formData.get('brandLogoUrl');
      if (urlField && typeof urlField === 'string' && urlField.trim()) {
        brandLogoUrl = urlField.trim();
      }

      const primaryField = formData.get('brandPrimaryColor');
      if (primaryField && typeof primaryField === 'string' && /^#[0-9a-fA-F]{6}$/.test(primaryField.trim())) {
        brandPrimaryColor = primaryField.trim();
      }

      const secondaryField = formData.get('brandSecondaryColor');
      if (secondaryField && typeof secondaryField === 'string' && /^#[0-9a-fA-F]{6}$/.test(secondaryField.trim())) {
        brandSecondaryColor = secondaryField.trim();
      }
    } catch {
      return jsonError('Failed to parse multipart form data', 400);
    }
  } else {
    // Handle JSON body
    try {
      const body = await request.json();
      const parsed = putSchema.safeParse(body);
      if (!parsed.success) {
        return jsonError('Invalid request body — expected { brandLogoText?: string, brandLogoUrl?: string }', 400);
      }
      brandLogoText = parsed.data.brandLogoText;
      brandLogoUrl = parsed.data.brandLogoUrl;
    } catch {
      return jsonError('Expected JSON or multipart/form-data body', 400);
    }
  }

  const db = createClient();
  const settings = await updateAppSettings(db, {
    ...(brandLogoText !== undefined ? { brandLogoText } : {}),
    ...(brandLogoUrl !== undefined ? { brandLogoUrl } : {}),
    ...(brandPrimaryColor !== undefined ? { brandPrimaryColor } : {}),
    ...(brandSecondaryColor !== undefined ? { brandSecondaryColor } : {}),
  });

  return jsonOk({
    brandLogoText: settings.brandLogoText,
    brandLogoUrl: settings.brandLogoUrl,
    brandPrimaryColor: settings.brandPrimaryColor,
    brandSecondaryColor: settings.brandSecondaryColor,
    updatedAt: settings.updatedAt.toISOString(),
  });
}
