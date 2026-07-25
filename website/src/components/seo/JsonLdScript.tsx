/**
 * JSON-LD Script Component
 *
 * Renders a `<script type="application/ld+json">` tag containing the
 * provided schema.org structured data. Use this in page layouts to
 * emit structured data for Google Rich Results.
 *
 * Phase 7 of the TOKENIZMYAPP roadmap.
 */

'use client';

import React from 'react';

export interface JsonLdScriptProps {
  /** The schema.org JSON-LD object to serialize into the script tag. */
  data: Record<string, unknown>;
}

export function JsonLdScript({ data }: JsonLdScriptProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
