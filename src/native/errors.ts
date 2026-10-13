/**
 * Error model for the native bridge.
 *
 * The Kotlin module throws `CodedException`s. `expo-modules-core` surfaces them
 * on the JS side as an `Error` carrying `code` and `message`. We normalise that
 * into a discriminated union so the UI never has to string-match.
 */

import { STILLTIME_ERROR_CODES, type StilltimeErrorCode } from './types';

export class StilltimeError extends Error {
  override readonly name = 'StilltimeError';
  readonly code: StilltimeErrorCode;
  /** What the user can actually do about it. */
  readonly remedy: string;

  constructor(code: StilltimeErrorCode, message: string, remedy: string) {
    super(message);
    this.code = code;
    this.remedy = remedy;
  }
}

export function isStilltimeErrorCode(value: unknown): value is StilltimeErrorCode {
  return (
    typeof value === 'string' && (STILLTIME_ERROR_CODES as readonly string[]).includes(value)
  );
}

function remedyFor(code: StilltimeErrorCode): string {
  switch (code) {
    case 'E_PERMISSION_REQUIRED':
      return 'Allow Stilltime to modify system settings, then try again.';
    case 'E_OUT_OF_RANGE':
      return 'Pick a time between 15 seconds and 1 hour.';
    case 'E_WRITE_FAILED':
      return 'Android refused the change. Unlock the device and try again.';
    case 'E_VERIFY_FAILED':
      return 'The value did not stick. Check for a manufacturer restriction in Battery settings.';
    case 'E_NOTHING_TO_RESTORE':
      return 'There is no previous value to restore.';
    case 'E_UNSUPPORTED_PLATFORM':
      return 'This build only supports Android.';
    case 'E_INTERNAL':
      return 'Something went wrong inside Stilltime. Please report this.';
    default:
      return 'Try again.';
  }
}

/** Normalise anything thrown by the native module into a `StilltimeError`. */
export function toStilltimeError(cause: unknown): StilltimeError {
  if (cause instanceof StilltimeError) return cause;

  const code = extractCode(cause);
  const message = extractMessage(cause) ?? 'The native module reported an unknown error.';

  if (code) {
    return new StilltimeError(code, message, remedyFor(code));
  }
  return new StilltimeError('E_INTERNAL', message, remedyFor('E_INTERNAL'));
}

function extractCode(cause: unknown): StilltimeErrorCode | null {
  if (typeof cause !== 'object' || cause === null) return null;
  const record = cause as { code?: unknown; nativeStackAndroid?: unknown };
  if (isStilltimeErrorCode(record.code)) return record.code;
  return null;
}

function extractMessage(cause: unknown): string | null {
  if (cause instanceof Error && cause.message.length > 0) return cause.message;
  if (typeof cause === 'string' && cause.length > 0) return cause;
  if (typeof cause === 'object' && cause !== null) {
    const record = cause as { message?: unknown };
    if (typeof record.message === 'string' && record.message.length > 0) return record.message;
  }
  return null;
}