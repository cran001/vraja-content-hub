import { NextResponse } from 'next/server';
import { isIsoDate } from './datedEvents';

export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: unknown) { super(message); }
}
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function uuid(value: unknown, label = 'id'): string {
  if (typeof value !== 'string' || !UUID.test(value)) throw new ApiError(400, `${label} must be a UUID.`);
  return value;
}
export function pageNumber(value: string | null, fallback: number, max = 10000): number {
  if (value === null) return fallback;
  if (!/^[1-9]\d*$/.test(value) || Number(value) > max) throw new ApiError(400, `Expected an integer between 1 and ${max}.`);
  return Number(value);
}
export function indiaDate(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
export function requestedDay(value: string | null): string {
  const day = value ?? indiaDate();
  if (!isIsoDate(day)) throw new ApiError(400, 'date must be a real YYYY-MM-DD date.');
  return day;
}
export function failure(error: unknown) {
  if (error instanceof SyntaxError) return NextResponse.json({ message: 'Malformed JSON body.' }, { status: 400 });
  if (error instanceof ApiError) return NextResponse.json({ message: error.message, details: error.details }, { status: error.status });
  const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : '';
  if (code === '40001' || code === '40P01') return NextResponse.json({ message: 'Concurrent change. Refresh and retry.', retryable: true }, { status: 409 });
  if (code === '23503') return NextResponse.json({ message: 'Referenced content exists or is missing. Resolve dependencies first.' }, { status: 409 });
  if (code === '23505') return NextResponse.json({ message: 'A conflicting record already exists.' }, { status: 409 });
  if (code === '23514' || code === 'P0001') return NextResponse.json({ message: 'Content violates a publishing or validation rule.' }, { status: 422 });
  return NextResponse.json({ message: 'Internal server error. Cached content must be retained.' }, { status: 500 });
}
