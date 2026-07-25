/**
 * URL Scraper Service
 *
 * Fetches a URL (business website or social media), extracts:
 * - Page title, meta description, business name
 * - Text content (for AI description generation)
 * - Logo image (from HTML img tags, SVG, favicon)
 * - Brand colors (from CSS styles, logo dominant colors)
 * - Social media links
 * - Images (for gallery/content)
 *
 * All extraction is server-side — no CORS issues.
 */

export interface ScrapedData {
  url: string;
  title: string;
  description: string;
  businessName: string;
  logoUrl: string | null;
  logoBase64: string | null;
  faviconUrl: string | null;
  brandColors: {
    primary: string | null;
    secondary: string | null;
    allColors: string[];
  };
  images: Array<{
    url: string;
    alt: string;
    width?: number;
    height?: number;
  }>;
  socialLinks: {
    instagram?: string;
    facebook?: string;
    twitter?: string;
    linkedin?: string;
    youtube?: string;
  };
  textContent: string;
  emails: string[];
  phoneNumbers: string[];
  address: string | null;
  scrapedAt: string;
}

/**
 * Scrape a URL and extract structured business data.
 */
export async function scrapeUrl(url: string): Promise<ScrapedData> {
  const normalizedUrl = normalizeUrl(url);
  console.log(`[url-scraper] Scraping: ${normalizedUrl}`);

  // Fetch the HTML
  const response = await fetch(normalizedUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; TokenizMyAppBot/1.0; +https://tokenizmyapp.vercel.app)',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(15000), // 15s timeout
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${normalizedUrl}: HTTP ${response.status}`);
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
    throw new Error(`URL returned non-HTML content type: ${contentType}`);
  }

  const html = await response.text();
  const baseUrl = new URL(normalizedUrl);

  // Extract all data from the HTML
  const title = extractTitle(html);
  const description = extractMetaDescription(html);
  const businessName = extractBusinessName(html, title, baseUrl.hostname);
  const logoUrl = extractLogoUrl(html, baseUrl);
  const faviconUrl = extractFaviconUrl(html, baseUrl);
  const brandColors = extractBrandColors(html);
  const images = extractImages(html, baseUrl);
  const socialLinks = extractSocialLinks(html, baseUrl);
  const textContent = extractTextContent(html);
  const emails = extractEmails(html);
  const phoneNumbers = extractPhoneNumbers(html);
  const address = extractAddress(html);

  // Download logo as base64 if found
  let logoBase64: string | null = null;
  if (logoUrl) {
    try {
      logoBase64 = await downloadImageAsBase64(logoUrl);
    } catch (err) {
      console.warn(`[url-scraper] Failed to download logo: ${err}`);
    }
  }

  // If no brand colors from CSS, try extracting from logo
  let finalBrandColors = brandColors;
  if (!brandColors.primary && logoBase64) {
    try {
      const logoColors = await extractColorsFromImageBase64(logoBase64);
      if (logoColors.length > 0) {
        finalBrandColors = {
          primary: logoColors[0] ?? null,
          secondary: logoColors[1] ?? logoColors[0] ?? null,
          allColors: logoColors,
        };
      }
    } catch (err) {
      console.warn(`[url-scraper] Failed to extract colors from logo: ${err}`);
    }
  }

  return {
    url: normalizedUrl,
    title,
    description,
    businessName,
    logoUrl,
    logoBase64,
    faviconUrl,
    brandColors: finalBrandColors,
    images,
    socialLinks,
    textContent,
    emails,
    phoneNumbers,
    address,
    scrapedAt: new Date().toISOString(),
  };
}

/**
 * Scrape an Instagram profile page for business info.
 */
export async function scrapeInstagram(username: string): Promise<Partial<ScrapedData>> {
  const url = `https://www.instagram.com/${username}/`;
  console.log(`[url-scraper] Scraping Instagram: ${url}`);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      throw new Error(`Instagram returned HTTP ${response.status}`);
    }

    const html = await response.text();

    // Instagram embeds JSON in a script tag
    const jsonData = extractInstagramJson(html);
    if (jsonData) {
      return {
        url,
        title: jsonData.fullName ?? username,
        description: jsonData.biography ?? '',
        businessName: jsonData.fullName ?? username,
        logoUrl: jsonData.profilePicUrl ?? null,
        logoBase64: jsonData.profilePicUrl ? await downloadImageAsBase64(jsonData.profilePicUrl).catch(() => null) : null,
        images: [],
        socialLinks: { instagram: url },
        textContent: jsonData.biography ?? '',
        scrapedAt: new Date().toISOString(),
      };
    }

    // Fallback: extract from meta tags
    return {
      url,
      title: extractTitle(html),
      description: extractMetaDescription(html),
      businessName: username,
      socialLinks: { instagram: url },
      scrapedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.warn(`[url-scraper] Instagram scraping failed: ${err}`);
    return { url, scrapedAt: new Date().toISOString() };
  }
}

// ── HTML Extraction Helpers ──────────────────────────────

function normalizeUrl(url: string): string {
  let normalized = url.trim();
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = `https://${normalized}`;
  }
  return normalized;
}

function extractTitle(html: string): string {
  const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/is);
  if (titleMatch) return decodeHtml(titleMatch[1].trim());
  const ogTitleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/is);
  if (ogTitleMatch) return decodeHtml(ogTitleMatch[1].trim());
  return '';
}

function extractMetaDescription(html: string): string {
  const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/is);
  if (descMatch) return decodeHtml(descMatch[1].trim());
  const ogDescMatch = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/is);
  if (ogDescMatch) return decodeHtml(ogDescMatch[1].trim());
  return '';
}

function extractBusinessName(html: string, title: string, hostname: string): string {
  // Try JSON-LD
  const jsonLdMatch = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>(.*?)<\/script>/is);
  if (jsonLdMatch) {
    try {
      const json = JSON.parse(jsonLdMatch[1].trim());
      if (json.name) return json.name;
      if (Array.isArray(json) && json[0]?.name) return json[0].name;
    } catch {}
  }

  // Try og:site_name
  const siteNameMatch = html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/is);
  if (siteNameMatch) return decodeHtml(siteNameMatch[1].trim());

  // Fallback to title (remove common suffixes)
  if (title) {
    return title.replace(/\s*[|\-–—]\s*.*(Home|Official|Website|Welcome).*$/i, '').trim() || title;
  }

  // Fallback to hostname
  return hostname.replace(/^www\./, '').replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
}

function extractLogoUrl(html: string, baseUrl: URL): string | null {
  // 1. Look for img with "logo" in class, id, alt, or src
  const logoImgMatch = html.match(/<img[^>]*(?:class|id|alt|src)=["'][^"']*logo[^"']*["'][^>]*>/is);
  if (logoImgMatch) {
    const srcMatch = logoImgMatch[0].match(/src=["']([^"']+)["']/i);
    if (srcMatch) return resolveUrl(srcMatch[1], baseUrl);
  }

  // 2. Look for SVG with "logo" in class or id
  const svgLogoMatch = html.match(/<svg[^>]*(?:class|id)=["'][^"']*logo[^"']*["']/is);
  if (svgLogoMatch) {
    // SVGs can't be downloaded as images easily — skip for now
  }

  // 3. Look for link rel="icon" or rel="shortcut icon" (favicon as fallback)
  const iconMatch = html.match(/<link[^>]+rel=["'](?:icon|shortcut icon|apple-touch-icon)["'][^>]+href=["']([^"']+)["']/is);
  if (iconMatch) return resolveUrl(iconMatch[1], baseUrl);

  // 4. Look for og:image
  const ogImageMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/is);
  if (ogImageMatch) return resolveUrl(ogImageMatch[1], baseUrl);

  return null;
}

function extractFaviconUrl(html: string, baseUrl: URL): string | null {
  const match = html.match(/<link[^>]+rel=["'](?:icon|shortcut icon)["'][^>]+href=["']([^"']+)["']/is);
  if (match) return resolveUrl(match[1], baseUrl);
  // Default favicon location
  return `${baseUrl.origin}/favicon.ico`;
}

function extractBrandColors(html: string): { primary: string | null; secondary: string | null; allColors: string[] } {
  const colors = new Set<string>();

  // Extract from <style> tags
  const styleMatches = html.match(/<style[^>]*>(.*?)<\/style>/gis);
  if (styleMatches) {
    for (const styleContent of styleMatches) {
      // Find hex colors
      const hexColors = styleContent.matchAll(/#([0-9a-fA-F]{6})\b/g);
      for (const match of hexColors) {
        colors.add(`#${match[1].toLowerCase()}`);
      }
      // Find rgb/rgba colors
      const rgbColors = styleContent.matchAll(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g);
      for (const match of rgbColors) {
        const hex = rgbToHex(Number(match[1]), Number(match[2]), Number(match[3]));
        colors.add(hex);
      }
    }
  }

  // Extract from inline styles
  const styleAttrMatches = html.matchAll(/style=["']([^"']*)["']/gi);
  for (const match of styleAttrMatches) {
    const styleText = match[1];
    const hexColors = styleText.matchAll(/#([0-9a-fA-F]{6})\b/g);
    for (const hexMatch of hexColors) {
      colors.add(`#${hexMatch[1].toLowerCase()}`);
    }
    const rgbColors = styleText.matchAll(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g);
    for (const rgbMatch of rgbColors) {
      colors.add(rgbToHex(Number(rgbMatch[1]), Number(rgbMatch[2]), Number(rgbMatch[3])));
    }
  }

  // Filter out common non-brand colors (black, white, grays)
  const brandColors = Array.from(colors).filter(c => !isNeutralColor(c));

  // Sort by frequency (most common first)
  // For simplicity, just take the first few non-neutral colors
  const sorted = brandColors.slice(0, 10);

  return {
    primary: sorted[0] ?? null,
    secondary: sorted[1] ?? sorted[0] ?? null,
    allColors: sorted,
  };
}

function extractImages(html: string, baseUrl: URL): Array<{ url: string; alt: string; width?: number; height?: number }> {
  const images: Array<{ url: string; alt: string; width?: number; height?: number }> = [];
  const imgMatches = html.matchAll(/<img[^>]*>/gis);
  
  for (const match of imgMatches) {
    const imgTag = match[0];
    const srcMatch = imgTag.match(/src=["']([^"']+)["']/i);
    if (!srcMatch) continue;
    
    const src = srcMatch[1];
    if (src.startsWith('data:')) continue; // Skip base64 images
    
    const altMatch = imgTag.match(/alt=["']([^"']*)["']/i);
    const widthMatch = imgTag.match(/width=["'](\d+)["']/i);
    const heightMatch = imgTag.match(/height=["'](\d+)["']/i);
    
    images.push({
      url: resolveUrl(src, baseUrl),
      alt: altMatch ? decodeHtml(altMatch[1]) : '',
      width: widthMatch ? Number(widthMatch[1]) : undefined,
      height: heightMatch ? Number(heightMatch[1]) : undefined,
    });
  }
  
  return images.slice(0, 20); // Limit to 20 images
}

function extractSocialLinks(html: string, baseUrl: URL): ScrapedData['socialLinks'] {
  const links: ScrapedData['socialLinks'] = {};
  
  const patterns: Record<keyof ScrapedData['socialLinks'], RegExp> = {
    instagram: /href=["'](https?:\/\/(?:www\.)?instagram\.com\/[^"']+)["']/i,
    facebook: /href=["'](https?:\/\/(?:www\.)?facebook\.com\/[^"']+)["']/i,
    twitter: /href=["'](https?:\/\/(?:www\.)?(?:twitter|x)\.com\/[^"']+)["']/i,
    linkedin: /href=["'](https?:\/\/(?:www\.)?linkedin\.com\/[^"']+)["']/i,
    youtube: /href=["'](https?:\/\/(?:www\.)?youtube\.com\/[^"']+)["']/i,
  };
  
  for (const [platform, pattern] of Object.entries(patterns)) {
    const match = html.match(pattern);
    if (match) links[platform as keyof ScrapedData['socialLinks']] = match[1];
  }
  
  return links;
}

function extractTextContent(html: string): string {
  // Remove script and style tags
  let text = html.replace(/<script[^>]*>.*?<\/script>/gis, '');
  text = text.replace(/<style[^>]*>.*?<\/style>/gis, '');
  text = text.replace(/<nav[^>]*>.*?<\/nav>/gis, '');
  text = text.replace(/<footer[^>]*>.*?<\/footer>/gis, '');
  
  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, ' ');
  
  // Decode HTML entities
  text = decodeHtml(text);
  
  // Normalize whitespace
  text = text.replace(/\s+/g, ' ').trim();
  
  // Limit to first 5000 chars
  return text.slice(0, 5000);
}

function extractEmails(html: string): string[] {
  const emailMatches = html.matchAll(/mailto:([^"'\s>]+)/gi);
  const emails = new Set<string>();
  for (const match of emailMatches) {
    emails.add(match[1].trim());
  }
  // Also look for plain email addresses
  const plainEmails = html.matchAll(/\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/g);
  for (const match of plainEmails) {
    if (!match[1].includes('.png') && !match[1].includes('.jpg') && !match[1].includes('.gif')) {
      emails.add(match[1].trim());
    }
  }
  return Array.from(emails).slice(0, 5);
}

function extractPhoneNumbers(html: string): string[] {
  const phoneMatches = html.matchAll(/(?:tel:)?\+?(\d[\d\s\-().]{7,}\d)/g);
  const phones = new Set<string>();
  for (const match of phoneMatches) {
    const phone = match[1].trim();
    if (phone.length >= 8 && phone.length <= 20) {
      phones.add(phone);
    }
  }
  return Array.from(phones).slice(0, 3);
}

function extractAddress(html: string): string | null {
  // Try JSON-LD address
  const jsonLdMatch = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>(.*?)<\/script>/is);
  if (jsonLdMatch) {
    try {
      const json = JSON.parse(jsonLdMatch[1].trim());
      const addr = json.address ?? (Array.isArray(json) && json[0]?.address);
      if (addr) {
        const parts = [addr.streetAddress, addr.addressLocality, addr.addressRegion, addr.postalCode, addr.addressCountry]
          .filter(Boolean);
        if (parts.length > 0) return parts.join(', ');
      }
    } catch {}
  }
  return null;
}

function extractInstagramJson(html: string): any | null {
  // Instagram embeds data in a script tag with window._sharedData or a JSON-LD script
  const sharedDataMatch = html.match(/window\._sharedData\s*=\s*({.*?});/s);
  if (sharedDataMatch) {
    try {
      const data = JSON.parse(sharedDataMatch[1]);
      const user = data?.entry_data?.ProfilePage?.[0]?.graphql?.user;
      if (user) {
        return {
          fullName: user.full_name,
          biography: user.biography,
          profilePicUrl: user.profile_pic_url_hd ?? user.profile_pic_url,
          externalUrl: user.external_url,
          followerCount: user.edge_followed_by?.count,
        };
      }
    } catch {}
  }

  // Try JSON-LD
  const jsonLdMatch = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>(.*?)<\/script>/is);
  if (jsonLdMatch) {
    try {
      const json = JSON.parse(jsonLdMatch[1].trim());
      if (json['@type'] === 'Person' || json['@type'] === 'Organization') {
        return {
          fullName: json.name,
          biography: json.description,
          profilePicUrl: json.image?.url ?? json.image,
        };
      }
    } catch {}
  }

  return null;
}

// ── Utility Functions ────────────────────────────────────

function resolveUrl(src: string, baseUrl: URL): string {
  try {
    if (src.startsWith('http://') || src.startsWith('https://')) return src;
    if (src.startsWith('//')) return `https:${src}`;
    if (src.startsWith('/')) return `${baseUrl.origin}${src}`;
    return new URL(src, baseUrl.origin).href;
  } catch {
    return src;
  }
}

function decodeHtml(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(Number(num)));
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')}`;
}

function isNeutralColor(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const diff = max - min;
  // Neutral if saturation is very low (gray/black/white)
  return diff < 30 || (max > 240 && min > 240) || (max < 30 && min < 30);
}

async function downloadImageAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TokenizMyAppBot/1.0)' },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return null;
    
    const contentType = response.headers.get('content-type') ?? 'image/png';
    if (!contentType.startsWith('image/')) return null;
    
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    
    // Limit to 500KB to avoid huge base64 strings
    if (base64.length > 500_000) {
      console.warn(`[url-scraper] Image too large (${base64.length} chars), skipping`);
      return null;
    }
    
    return `data:${contentType};base64,${base64}`;
  } catch (err) {
    console.warn(`[url-scraper] Failed to download image: ${err}`);
    return null;
  }
}

/**
 * Extract dominant colors from a base64-encoded image.
 * Uses a simple histogram approach — groups similar colors and returns the most frequent.
 */
async function extractColorsFromImageBase64(base64Data: string): Promise<string[]> {
  // This is a simplified approach — in production, use a WASM color extractor
  // or a library like 'colorthief' or 'node-vibrant'
  //
  // For now, we'll parse the image headers to get average color
  // A proper implementation would decode the image pixels
  
  // Placeholder: return empty array — the CSS color extraction is the primary method
  // TODO: Implement proper color extraction from image pixels (Phase 10+)
  return [];
}

/**
 * Recommend a template based on scraped content.
 */
export function recommendTemplate(scraped: ScrapedData): string {
  const text = `${scraped.title} ${scraped.description} ${scraped.textContent}`.toLowerCase();
  const url = scraped.url.toLowerCase();
  
  const scores: Record<string, number> = {
    'financial-analytics': 0,
    'restaurant': 0,
    'hotel': 0,
    'ecommerce-retail': 0,
    'healthcare': 0,
    'supply-chain': 0,
    'real-estate': 0,
    'education': 0,
    'professional-services': 0,
    'manufacturing': 0,
    'default': 0,
  };

  // Restaurant keywords
  if (/\b(restaurant|menu|dining|food|kitchen|chef|cuisine|reservation|table|bar|cafe|bistro)\b/.test(text)) {
    scores['restaurant'] += 10;
  }
  
  // Hotel keywords
  if (/\b(hotel|resort|villa|accommodation|room|booking|check-in|checkout|hospitality|spa|pool)\b/.test(text)) {
    scores['hotel'] += 10;
  }
  
  // E-commerce keywords
  if (/\b(shop|store|product|cart|checkout|buy|price|inventory|sku|order|shipping)\b/.test(text)) {
    scores['ecommerce-retail'] += 10;
  }
  
  // Healthcare keywords
  if (/\b(hospital|clinic|doctor|patient|medical|health|treatment|pharmacy|dental|therapy)\b/.test(text)) {
    scores['healthcare'] += 10;
  }
  
  // Supply chain keywords
  if (/\b(logistics|shipping|freight|warehouse|cargo|delivery|tracking|supply chain|manifest)\b/.test(text)) {
    scores['supply-chain'] += 10;
  }
  
  // Real estate keywords
  if (/\b(property|real estate|listing|lease|rental|apartment|house|landlord|tenant|mortgage)\b/.test(text)) {
    scores['real-estate'] += 10;
  }
  
  // Education keywords
  if (/\b(school|university|college|course|student|teacher|enrollment|class|learning|education)\b/.test(text)) {
    scores['education'] += 10;
  }
  
  // Professional services keywords
  if (/\b(consulting|agency|firm|practice|client|project|invoice|service|professional|law|accounting)\b/.test(text)) {
    scores['professional-services'] += 10;
  }
  
  // Manufacturing keywords
  if (/\b(manufacturing|factory|production|assembly|quality control|bom|materials|industrial|machining)\b/.test(text)) {
    scores['manufacturing'] += 10;
  }
  
  // Financial analytics keywords
  if (/\b(finance|revenue|ebitda|p&l|profit|cost|budget|forecast|analytics|kpi|metrics)\b/.test(text)) {
    scores['financial-analytics'] += 10;
  }

  // URL-based hints
  if (url.includes('restaurant') || url.includes('cafe') || url.includes('bar')) scores['restaurant'] += 5;
  if (url.includes('hotel') || url.includes('resort')) scores['hotel'] += 5;
  if (url.includes('shop') || url.includes('store')) scores['ecommerce-retail'] += 5;
  if (url.includes('clinic') || url.includes('hospital')) scores['healthcare'] += 5;

  // Find the highest scoring template
  let bestTemplate = 'default';
  let bestScore = 0;
  for (const [template, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestTemplate = template;
    }
  }

  return bestTemplate;
}

/**
 * Generate a business description from scraped data for the AI prompt.
 */
export function generatePromptFromScraped(scraped: ScrapedData): string {
  const parts: string[] = [];
  
  parts.push(`I run ${scraped.businessName}.`);
  
  if (scraped.description) {
    parts.push(scraped.description);
  }
  
  if (scraped.textContent) {
    // Include first 500 chars of text content for context
    parts.push(`Additional context: ${scraped.textContent.slice(0, 500)}`);
  }
  
  if (scraped.address) {
    parts.push(`Location: ${scraped.address}`);
  }
  
  if (scraped.phoneNumbers.length > 0) {
    parts.push(`Phone: ${scraped.phoneNumbers[0]}`);
  }
  
  if (scraped.emails.length > 0) {
    parts.push(`Email: ${scraped.emails[0]}`);
  }
  
  if (scraped.socialLinks.instagram) {
    parts.push(`Instagram: ${scraped.socialLinks.instagram}`);
  }
  
  return parts.join(' ');
}
