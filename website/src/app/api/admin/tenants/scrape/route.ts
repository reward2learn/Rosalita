/**
 * POST /api/admin/tenants/scrape
 *
 * Scrapes a URL (business website or social media) and returns:
 * - Business name, description, address, contact info
 * - Logo image (base64)
 * - Brand colors (from CSS or logo)
 * - Images for gallery
 * - Social media links
 * - Recommended template
 * - AI-generated business description prompt
 *
 * Request body:
 *   { "url": "https://example.com" | "instagram.com/business" }
 */

import { NextResponse } from 'next/server';
import { requireWriteAuth } from '@/lib/auth/guards';
import { jsonError, jsonOk } from '@/lib/api/response';
import { scrapeUrl, scrapeInstagram, recommendTemplate, generatePromptFromScraped } from '@/domain/ai/url-scraper-service';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(request: Request): Promise<NextResponse> {
  const guard = await requireWriteAuth(request);
  if (!guard.ok) return guard.response;

  let body: { url?: string };
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  if (!body.url || typeof body.url !== 'string') {
    return jsonError('url is required', 400);
  }

  const url = body.url.trim();
  if (url.length < 3) {
    return jsonError('url must be at least 3 characters', 400);
  }

  try {
    let scraped;

    // Check if it's an Instagram URL
    if (url.includes('instagram.com')) {
      const username = url.replace(/^.*instagram\.com\//, '').replace(/\/.*$/, '').replace(/[/?].*$/, '');
      if (username) {
        const igData = await scrapeInstagram(username);
        // Also try to scrape the full URL for additional data
        try {
          const fullScrape = await scrapeUrl(url);
          scraped = { ...fullScrape, ...igData, url: fullScrape.url };
        } catch {
          scraped = {
            url,
            title: igData.title ?? '',
            description: igData.description ?? '',
            businessName: igData.businessName ?? username,
            logoUrl: igData.logoUrl ?? null,
            logoBase64: igData.logoBase64 ?? null,
            faviconUrl: null,
            brandColors: { primary: null, secondary: null, allColors: [] },
            images: [],
            socialLinks: igData.socialLinks ?? {},
            textContent: igData.textContent ?? '',
            emails: [],
            phoneNumbers: [],
            address: null,
            scrapedAt: new Date().toISOString(),
          };
        }
      } else {
        return jsonError('Could not extract Instagram username from URL', 400);
      }
    } else {
      // Regular URL scrape
      scraped = await scrapeUrl(url);
    }

    // Generate recommendations
    const recommendedTemplate = recommendTemplate(scraped);
    const generatedPrompt = generatePromptFromScraped(scraped);

    return jsonOk({
      scraped,
      recommendedTemplate,
      generatedPrompt,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[scrape] Error:', msg);
    return jsonError(`Scraping failed: ${msg.slice(0, 200)}`, 500);
  }
}
