import { NextResponse } from 'next/server';

export function jsonOk<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json({ success: true, data }, init);
}

export function jsonError(error: string, status = 400): NextResponse {
  return NextResponse.json({ success: false, error }, { status });
}

/** Legacy-compatible error shape (no success flag). */
export function legacyError(error: string, status = 400): NextResponse {
  return NextResponse.json({ error }, { status });
}
