package com.stilltime.timeout

/**
 * Error codes shared with the JS bridge.
 *
 * These strings are part of the public contract in
 * `src/native/types.ts` (`STILLTIME_ERROR_CODES`). Renaming one requires
 * changing both.
 */
internal object ErrorCodes {
    const val PERMISSION_REQUIRED = "E_PERMISSION_REQUIRED"
    const val OUT_OF_RANGE = "E_OUT_OF_RANGE"
    const val WRITE_FAILED = "E_WRITE_FAILED"
    const val VERIFY_FAILED = "E_VERIFY_FAILED"
    const val NOTHING_TO_RESTORE = "E_NOTHING_TO_RESTORE"
    const val UNSUPPORTED_PLATFORM = "E_UNSUPPORTED_PLATFORM"
    const val INTERNAL = "E_INTERNAL"
}