/**
 * JSON-LD Schema.org Generator
 *
 * Generates schema.org JSON-LD structured data for any template.
 * Looks up the template's `schemaOrgType` from the registry, builds a
 * base entity (`@context`, `@type`, `name`, `url`, `description`),
 * merges template-specific properties, and merges page-specific data
 * (e.g., a restaurant menu page emits `hasMenu` with menu items).
 *
 * Phase 7 of the TOKENIZMYAPP roadmap.
 *
 * @see https://schema.org
 * @see https://developers.google.com/search/docs/appearance/structured-data
 */

import { getTemplateSchema } from '../schema/registry';

// ── Public Types ─────────────────────────────────────────

export interface TenantConfig {
  /** Human-readable business name (maps to schema.org `name`) */
  displayName: string;
  /** Canonical app URL (maps to schema.org `url`) */
  appUrl: string;
  /** Optional description / tagline (maps to schema.org `description`) */
  description?: string;
}

export interface PageData {
  /** Page slug — appended to `appUrl` to form the page URL */
  slug?: string;
  /**
   * Page-loaded model rows keyed by model name.
   * e.g., `{ MenuItem: [...], TableReservation: [...] }`
   * The generator inspects these to emit page-specific properties
   * such as `hasMenu` (restaurant) or `hasOffer` (ecommerce).
   */
  models?: Record<string, unknown[]>;
}

type TemplateGenerator = (
  config: TenantConfig,
  data?: PageData,
) => Record<string, unknown>;

// ── Internal Helpers ─────────────────────────────────────

/** Build the canonical page URL from the app URL and optional slug. */
function buildBaseUrl(appUrl: string, slug?: string): string {
  const base = appUrl.replace(/\/+$/, '');
  if (!slug) return base;
  return `${base}/${slug.replace(/^\/+/, '')}`;
}

/** Build the base JSON-LD object shared by every template. */
function buildBase(
  schemaOrgType: string | string[],
  tenantConfig: TenantConfig,
  pageData?: PageData,
): Record<string, unknown> {
  const base: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': schemaOrgType,
    name: tenantConfig.displayName,
    url: buildBaseUrl(tenantConfig.appUrl, pageData?.slug),
  };
  if (tenantConfig.description) {
    base.description = tenantConfig.description;
  }
  return base;
}

/** Coerce an unknown value to a typed array (empty if not an array). */
function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

/** Coerce an unknown value to a string (empty if null/undefined). */
function str(value: unknown): string {
  return value == null ? '' : String(value);
}

/** Build an Offer object from a price/currency pair. */
function offer(price: unknown, currency = 'IDR', label?: string): Record<string, unknown> {
  const o: Record<string, unknown> = {
    '@type': 'Offer',
    price: str(price ?? '0'),
    priceCurrency: currency,
  };
  if (label) o.description = label;
  return o;
}

// ── Template-specific Generators ─────────────────────────

/**
 * financial-analytics → schema.org FinancialService
 * Properties: serviceType, areaServed, offers
 */
export function generateFinancialServiceJsonLd(
  tenantConfig: TenantConfig,
  pageData?: PageData,
): Record<string, unknown> {
  const base = buildBase('FinancialService', tenantConfig, pageData);
  const extra: Record<string, unknown> = {
    serviceType: 'Financial Performance Analytics',
    areaServed: { '@type': 'Country', name: 'Indonesia' },
  };

  const projections = asArray<Record<string, unknown>>(pageData?.models?.FinancialProjection);
  if (projections.length > 0) {
    const totalRevenue = projections.reduce(
      (sum, p) => sum + Number(p.revenue ?? 0),
      0,
    );
    extra.offers = offer(
      totalRevenue,
      'IDR',
      'Multi-scenario P&L projections, KPI monitoring, and executive reporting.',
    );
  } else {
    extra.offers = {
      '@type': 'Offer',
      description:
        'Multi-scenario P&L projections, KPI monitoring, and executive reporting.',
    };
  }

  return { ...base, ...extra };
}

/**
 * restaurant → schema.org Restaurant
 * Properties: servesCuisine, priceRange, acceptsReservations, hasMenu, starRating
 */
export function generateRestaurantJsonLd(
  tenantConfig: TenantConfig,
  pageData?: PageData,
): Record<string, unknown> {
  const base = buildBase('Restaurant', tenantConfig, pageData);
  const extra: Record<string, unknown> = {
    servesCuisine: ['Indonesian', 'International'],
    priceRange: '$$',
    acceptsReservations: true,
  };

  const menuItems = asArray<Record<string, unknown>>(pageData?.models?.MenuItem);
  if (menuItems.length > 0) {
    extra.hasMenu = {
      '@type': 'Menu',
      hasMenuSection: buildMenuSections(menuItems),
    };
  }

  return { ...base, ...extra };
}

/** Group menu items by category into schema.org MenuSection objects. */
function buildMenuSections(
  menuItems: Record<string, unknown>[],
): Record<string, unknown>[] {
  const byCategory = new Map<string, Record<string, unknown>[]>();
  for (const item of menuItems) {
    const category = str(item.category ?? 'other') || 'other';
    const list = byCategory.get(category) ?? [];
    const menuItem: Record<string, unknown> = {
      '@type': 'MenuItem',
      name: str(item.name),
      offers: offer(item.price, str(item.currency ?? 'IDR')),
    };
    if (item.description) menuItem.description = str(item.description);
    if (item.imageUrl) menuItem.image = str(item.imageUrl);
    list.push(menuItem);
    byCategory.set(category, list);
  }
  return Array.from(byCategory.entries()).map(([name, hasMenuItem]) => ({
    '@type': 'MenuSection',
    name,
    hasMenuItem,
  }));
}

/**
 * hotel → schema.org Hotel / LodgingBusiness
 * Properties: starRating, numberOfRooms, amenityFeature, checkinTime, checkoutTime
 */
export function generateHotelJsonLd(
  tenantConfig: TenantConfig,
  pageData?: PageData,
): Record<string, unknown> {
  const base = buildBase(['Hotel', 'LodgingBusiness'], tenantConfig, pageData);
  const extra: Record<string, unknown> = {
    starRating: { '@type': 'Rating', ratingValue: '4' },
    checkinTime: '14:00',
    checkoutTime: '11:00',
  };

  const roomTypes = asArray<Record<string, unknown>>(pageData?.models?.RoomType);
  if (roomTypes.length > 0) {
    extra.numberOfRooms = roomTypes.reduce(
      (sum, rt) => sum + Number(rt.totalRooms ?? 0),
      0,
    );
    const amenities = new Set<string>();
    for (const rt of roomTypes) {
      const list = asArray<string>(rt.amenities);
      for (const a of list) amenities.add(String(a));
    }
    if (amenities.size > 0) {
      extra.amenityFeature = Array.from(amenities).map((name) => ({
        '@type': 'LocationFeatureSpecification',
        name,
      }));
    }
  }

  const bookings = asArray<Record<string, unknown>>(pageData?.models?.Booking);
  if (bookings.length > 0) {
    extra.acceptsReservations = true;
  }

  return { ...base, ...extra };
}

/**
 * ecommerce-retail → schema.org Store / Product
 * Properties: hasOffer, inventoryLevel, brand, category
 */
export function generateEcommerceRetailJsonLd(
  tenantConfig: TenantConfig,
  pageData?: PageData,
): Record<string, unknown> {
  const base = buildBase(['Store', 'Product'], tenantConfig, pageData);
  const extra: Record<string, unknown> = {};

  const products = asArray<Record<string, unknown>>(pageData?.models?.Product);
  if (products.length > 0) {
    extra.hasOffer = products.map((p) => ({
      '@type': 'Offer',
      name: str(p.name),
      price: str(p.price ?? '0'),
      priceCurrency: 'IDR',
      ...(p.sku ? { sku: str(p.sku) } : {}),
      ...(p.imageUrl ? { image: str(p.imageUrl) } : {}),
    }));
    const brands = new Set<string>();
    const categories = new Set<string>();
    for (const p of products) {
      if (p.brand) brands.add(str(p.brand));
      if (p.category) categories.add(str(p.category));
    }
    if (brands.size > 0) extra.brand = Array.from(brands).join(', ');
    if (categories.size > 0) extra.category = Array.from(categories).join(', ');
  }

  const inventory = asArray<Record<string, unknown>>(pageData?.models?.InventoryItem);
  if (inventory.length > 0) {
    const totalQty = inventory.reduce(
      (sum, item) => sum + Number(item.quantityOnHand ?? 0),
      0,
    );
    extra.inventoryLevel = { '@type': 'QuantitativeValue', value: totalQty };
  }

  return { ...base, ...extra };
}

/**
 * healthcare → schema.org MedicalOrganization / Hospital
 * Properties: medicalSpecialty, availableService, acceptedInsurance
 */
export function generateHealthcareJsonLd(
  tenantConfig: TenantConfig,
  pageData?: PageData,
): Record<string, unknown> {
  const base = buildBase(['MedicalOrganization', 'Hospital'], tenantConfig, pageData);
  const extra: Record<string, unknown> = {
    medicalSpecialty: ['General', 'Emergency'],
  };

  const encounters = asArray<Record<string, unknown>>(pageData?.models?.Encounter);
  if (encounters.length > 0) {
    const departments = new Set<string>();
    for (const e of encounters) {
      if (e.department) departments.add(str(e.department));
    }
    if (departments.size > 0) {
      extra.medicalSpecialty = Array.from(departments);
    }
    extra.availableService = encounters.map((e) => ({
      '@type': 'MedicalProcedure',
      name: str(e.reason ?? 'Consultation'),
      status: str(e.status ?? 'scheduled'),
    }));
  }

  const patients = asArray<Record<string, unknown>>(pageData?.models?.Patient);
  if (patients.length > 0) {
    const insurers = new Set<string>();
    for (const p of patients) {
      if (p.insuranceProvider) insurers.add(str(p.insuranceProvider));
    }
    if (insurers.size > 0) {
      extra.acceptedInsurance = Array.from(insurers);
    }
  }

  return { ...base, ...extra };
}

/**
 * supply-chain → schema.org DeliveryEvent / ParcelDelivery
 * Properties: trackingNumber, deliveryStatus, carrier
 */
export function generateSupplyChainJsonLd(
  tenantConfig: TenantConfig,
  pageData?: PageData,
): Record<string, unknown> {
  const base = buildBase(['DeliveryEvent', 'ParcelDelivery'], tenantConfig, pageData);
  const extra: Record<string, unknown> = {};

  const shipments = asArray<Record<string, unknown>>(pageData?.models?.Shipment);
  if (shipments.length > 0) {
    if (shipments.length === 1) {
      const s = shipments[0]!;
      extra.trackingNumber = str(s.trackingNumber);
      extra.deliveryStatus = str(s.status ?? 'pending');
      if (s.origin) extra.originAddress = { '@type': 'PostalAddress', addressLocality: str(s.origin) };
      if (s.destination) extra.deliveryAddress = { '@type': 'PostalAddress', addressLocality: str(s.destination) };
    } else {
      extra.hasDeliveryEvent = shipments.map((s) => ({
        '@type': 'ParcelDelivery',
        trackingNumber: str(s.trackingNumber),
        deliveryStatus: str(s.status ?? 'pending'),
      }));
    }
  }

  const carriers = asArray<Record<string, unknown>>(pageData?.models?.Carrier);
  if (carriers.length > 0) {
    extra.carrier = carriers.map((c) => ({
      '@type': 'Organization',
      name: str(c.name),
      ...(c.trackingUrl ? { url: str(c.trackingUrl) } : {}),
    }));
  }

  return { ...base, ...extra };
}

/**
 * real-estate → schema.org RealEstateAgent
 * Properties: address, geo, priceRange
 */
export function generateRealEstateJsonLd(
  tenantConfig: TenantConfig,
  pageData?: PageData,
): Record<string, unknown> {
  const base = buildBase('RealEstateAgent', tenantConfig, pageData);
  const extra: Record<string, unknown> = {};

  const properties = asArray<Record<string, unknown>>(pageData?.models?.Property);
  if (properties.length > 0) {
    const addresses = properties
      .filter((p) => p.address)
      .map((p) => ({ '@type': 'PostalAddress', streetAddress: str(p.address) }));
    if (addresses.length === 1) {
      extra.address = addresses[0]!;
    } else if (addresses.length > 1) {
      extra.address = addresses;
    }
  }

  const listings = asArray<Record<string, unknown>>(pageData?.models?.Listing);
  if (listings.length > 0) {
    const prices = listings
      .map((l) => Number(l.listingPrice ?? 0))
      .filter((n) => n > 0);
    if (prices.length > 0) {
      const min = Math.min(...prices);
      const max = Math.max(...prices);
      extra.priceRange = `${min}-${max} IDR`;
    }
  }

  return { ...base, ...extra };
}

/**
 * education → schema.org EducationalOrganization / Course
 * Properties: courseCode, hasCourseInstance, provider
 */
export function generateEducationJsonLd(
  tenantConfig: TenantConfig,
  pageData?: PageData,
): Record<string, unknown> {
  const base = buildBase(['EducationalOrganization', 'Course'], tenantConfig, pageData);
  const extra: Record<string, unknown> = {};

  const courses = asArray<Record<string, unknown>>(pageData?.models?.Course);
  if (courses.length > 0) {
    if (courses.length === 1) {
      const c = courses[0]!;
      extra.courseCode = str(c.code);
      extra.hasCourseInstance = {
        '@type': 'CourseInstance',
        courseMode: 'onsite',
        ...(c.startDate ? { startDate: str(c.startDate) } : {}),
        ...(c.endDate ? { endDate: str(c.endDate) } : {}),
      };
      if (c.instructor) {
        extra.provider = { '@type': 'Person', name: str(c.instructor) };
      }
    } else {
      extra.hasCourseInstance = courses.map((c) => ({
        '@type': 'CourseInstance',
        courseCode: str(c.code),
        name: str(c.title),
        courseMode: 'onsite',
        ...(c.startDate ? { startDate: str(c.startDate) } : {}),
        ...(c.endDate ? { endDate: str(c.endDate) } : {}),
      }));
    }
  }

  return { ...base, ...extra };
}

/**
 * professional-services → schema.org ProfessionalService
 * Properties: serviceType, areaServed, offers
 */
export function generateProfessionalServiceJsonLd(
  tenantConfig: TenantConfig,
  pageData?: PageData,
): Record<string, unknown> {
  const base = buildBase('ProfessionalService', tenantConfig, pageData);
  const extra: Record<string, unknown> = {
    serviceType: 'Consulting & Professional Services',
    areaServed: { '@type': 'Country', name: 'Indonesia' },
  };

  const projects = asArray<Record<string, unknown>>(pageData?.models?.Project);
  if (projects.length > 0) {
    const types = new Set<string>();
    for (const p of projects) {
      if (p.status) types.add(str(p.status));
    }
    if (types.size > 0) {
      extra.serviceType = Array.from(types).join(', ');
    }
  }

  const invoices = asArray<Record<string, unknown>>(pageData?.models?.Invoice);
  if (invoices.length > 0) {
    const total = invoices.reduce((sum, inv) => sum + Number(inv.total ?? 0), 0);
    extra.offers = offer(total, 'IDR', 'Project billing & invoicing');
  }

  return { ...base, ...extra };
}

/**
 * manufacturing → schema.org Manufacturer
 * Properties: makesOffer, productionDate, material
 */
export function generateManufacturingJsonLd(
  tenantConfig: TenantConfig,
  pageData?: PageData,
): Record<string, unknown> {
  const base = buildBase('Manufacturer', tenantConfig, pageData);
  const extra: Record<string, unknown> = {};

  const orders = asArray<Record<string, unknown>>(pageData?.models?.ProductionOrder);
  if (orders.length > 0) {
    extra.productionDate = orders
      .map((o) => str(o.startDate))
      .filter(Boolean)
      .sort()[0];
    extra.makesOffer = orders.map((o) => ({
      '@type': 'Offer',
      name: str(o.orderNumber),
      sku: str(o.productCode),
      ...(o.quantity ? { inventoryLevel: { '@type': 'QuantitativeValue', value: Number(o.quantity) } } : {}),
    }));
  }

  const boms = asArray<Record<string, unknown>>(pageData?.models?.BillOfMaterial);
  if (boms.length > 0) {
    const materials = new Set<string>();
    for (const bom of boms) {
      const components = asArray<Record<string, unknown>>(bom.components);
      for (const c of components) {
        if (c.material) materials.add(str(c.material));
        else if (c.name) materials.add(str(c.name));
      }
    }
    if (materials.size > 0) {
      extra.material = Array.from(materials);
    }
  }

  return { ...base, ...extra };
}

// ── Dispatch Map ─────────────────────────────────────────

const TEMPLATE_GENERATORS: Record<string, TemplateGenerator> = {
  'financial-analytics': generateFinancialServiceJsonLd,
  'restaurant': generateRestaurantJsonLd,
  'hotel': generateHotelJsonLd,
  'ecommerce-retail': generateEcommerceRetailJsonLd,
  'healthcare': generateHealthcareJsonLd,
  'supply-chain': generateSupplyChainJsonLd,
  'real-estate': generateRealEstateJsonLd,
  'education': generateEducationJsonLd,
  'professional-services': generateProfessionalServiceJsonLd,
  'manufacturing': generateManufacturingJsonLd,
};

// ── Main Generator ───────────────────────────────────────

/**
 * Generate schema.org JSON-LD structured data for a template.
 *
 * 1. Looks up the template's `schemaOrgType` from the registry.
 * 2. Builds a base entity (`@context`, `@type`, `name`, `url`, `description`).
 * 3. Merges template-specific properties (e.g., Restaurant gets
 *    `servesCuisine`, `priceRange`, `acceptsReservations`).
 * 4. Merges page-specific data (e.g., a menu page gets `hasMenu`).
 * 5. Returns the complete JSON-LD object.
 *
 * Falls back to a generic `Organization`/`LocalBusiness` entity when the
 * template ID is unknown.
 */
export function generateJsonLd(
  templateId: string,
  tenantConfig: TenantConfig,
  pageData?: PageData,
): Record<string, unknown> {
  const generator = TEMPLATE_GENERATORS[templateId];
  if (generator) {
    return generator(tenantConfig, pageData);
  }

  // Unknown template — fall back to the registry's schemaOrgType or a
  // generic Organization/LocalBusiness entity.
  const schema = getTemplateSchema(templateId);
  const schemaOrgType = schema?.schemaOrgType ?? ['Organization', 'LocalBusiness'];
  return buildBase(schemaOrgType, tenantConfig, pageData);
}

// ── Script Tag Helper ────────────────────────────────────

/**
 * Serialize a JSON-LD object into the string content for a
 * `<script type="application/ld+json">` tag.
 *
 * Use this in non-React contexts (e.g., server-side HTML generation,
 * PDF templates). In React, prefer the `<JsonLdScript>` component.
 */
export function generateJsonLdScript(jsonLd: Record<string, unknown>): string {
  return JSON.stringify(jsonLd);
}
