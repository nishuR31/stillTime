package com.stilltime.timeout

import expo.modules.kotlin.exception.CodedException

/**
 * A coded failure that surfaces on the JS side as `{ code, message }` and is
 * normalised into a `StilltimeError` by `src/native/errors.ts`.
 *
 * `CodedException` exposes `code` as a final property backed by a `providedCode`
 * field, so the code is supplied to the constructor rather than overridden.
 */
internal class StilltimeCodedException(
    code: String,
    message: String?,
) : CodedException(code, message, null)