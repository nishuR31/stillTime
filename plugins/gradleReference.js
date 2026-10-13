/**
 * Contract for reading the machine-wide Gradle reference file.
 *
 * The reference at `/home/nishu/TechStack/codes/gradle.properties` is the
 * source of truth for this machine's low-memory Android build settings. It is
 * never modified by Stilltime. Instead `withGradleReferenceProperties` reads
 * it, validates the keys Stilltime depends on, and injects them into the
 * generated `android/gradle.properties` during Prebuild.
 *
 * Missing or invalid input throws a `GradleReferenceError` and aborts the
 * build rather than silently producing different settings.
 *
 * This module is CommonJS on purpose. Expo loads `app.config.ts` through
 * `@expo/require-utils`, which cannot traverse a TypeScript module graph, so
 * config plugins and everything they import must be plain `.js`.
 */

'use strict';

const fs = require('node:fs');

/**
 * Keys that must exist and must be parseable for the build to be valid.
 * @type {readonly string[]}
 */
const REQUIRED_KEYS = Object.freeze([
  'org.gradle.daemon',
  'org.gradle.jvmargs',
  'org.gradle.parallel',
  'org.gradle.workers.max',
  'org.gradle.caching',
  'android.useAndroidX',
  'android.enablePngCrunchInReleaseBuilds',
  'reactNativeArchitectures',
  'hermesEnabled',
  'newArchEnabled',
  'edgeToEdgeEnabled',
]);

/** Boolean keys whose value must be literally `true` or `false`. */
const BOOLEAN_KEYS = Object.freeze([
  'org.gradle.daemon',
  'org.gradle.parallel',
  'org.gradle.caching',
  'android.useAndroidX',
  'android.enablePngCrunchInReleaseBuilds',
  'hermesEnabled',
  'newArchEnabled',
  'edgeToEdgeEnabled',
]);

const KNOWN_ABIS = new Set(['armeabi-v7a', 'arm64-v8a', 'x86', 'x86_64']);

/**
 * Keys Stilltime deliberately overrides, because the machine profile is shared
 * with other projects and is not authoritative for an Android-only app.
 * @type {Readonly<Record<string, string>>}
 */
const STILLTIME_OVERRIDES = Object.freeze({
  'expo.webp.enabled': 'false',
});

class GradleReferenceError extends Error {
  /**
   * @param {string} message
   * @param {'REFERENCE_MISSING' | 'REFERENCE_UNREADABLE' | 'REFERENCE_EMPTY'
   *   | 'REFERENCE_MISSING_KEY' | 'REFERENCE_INVALID_VALUE'} code
   */
  constructor(message, code) {
    super(message);
    this.name = 'GradleReferenceError';
    this.code = code;
  }
}

/**
 * Minimal, dependency-free `java.util.Properties` parser.
 *
 * Handles `#`/`!` comments, line continuations with a trailing backslash, the
 * `key=value`, `key:value` and `key value` separators, and quoting. Values may
 * contain `=` after the first separator, which matters for `org.gradle.jvmargs`.
 *
 * @param {string} contents
 * @returns {{ entries: Map<string, string>, order: string[] }}
 */
function parseGradleProperties(contents) {
  const entries = new Map();
  const order = [];

  for (const line of joinContinuations(contents)) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    if (trimmed.startsWith('#') || trimmed.startsWith('!')) continue;

    const separator = findSeparator(trimmed);
    if (separator < 0) continue;

    const key = trimmed.slice(0, separator).trim();
    if (key.length === 0) continue;

    const value = unquote(trimmed.slice(separator + 1).trim());
    entries.set(key, value);
    order.push(key);
  }

  return { entries, order };
}

/** Re-join lines that end in a backslash, stripping the continuation marks. */
function joinContinuations(contents) {
  const raw = contents.replace(/^﻿/, '').split(/\r\n|\r|\n/);
  const merged = [];
  let buffer = null;

  for (const line of raw) {
    const candidate = buffer === null ? line : buffer + line.trimStart();
    if (candidate.trimEnd().endsWith('\\')) {
      buffer = candidate.trimEnd().slice(0, -1);
      continue;
    }
    merged.push(candidate);
    buffer = null;
  }
  if (buffer !== null) merged.push(buffer);
  return merged;
}

/**
 * Locate the key/value separator using `java.util.Properties` precedence:
 * `=` wins over `:` which wins over whitespace. Without this, `key = value`
 * would split on the space and leave `= value` as the value.
 *
 * @param {string} line
 * @returns {number}
 */
function findSeparator(line) {
  const equals = line.indexOf('=');
  if (equals > 0) return equals;

  const colon = line.indexOf(':');
  if (colon > 0) return colon;

  return line.search(/\s/);
}

/** @param {string} value */
function unquote(value) {
  if (value.length >= 2) {
    const first = value[0];
    const last = value[value.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return value.slice(1, -1);
    }
  }
  return value;
}

/**
 * @param {string} filePath
 * @returns {{ filePath: string, entries: Map<string, string>, order: string[] }}
 */
function readGradleReference(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new GradleReferenceError(
      `Gradle reference file not found at ${filePath}. ` +
        'Set STILLTIME_GRADLE_REFERENCE to a valid gradle.properties file.',
      'REFERENCE_MISSING',
    );
  }

  let contents;
  try {
    contents = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    throw new GradleReferenceError(
      `Gradle reference file at ${filePath} could not be read: ${error.message}`,
      'REFERENCE_UNREADABLE',
    );
  }

  const { entries, order } = parseGradleProperties(contents);
  if (entries.size === 0) {
    throw new GradleReferenceError(
      `Gradle reference file at ${filePath} contains no properties.`,
      'REFERENCE_EMPTY',
    );
  }

  const missing = REQUIRED_KEYS.filter((key) => !entries.has(key));
  if (missing.length > 0) {
    throw new GradleReferenceError(
      `Gradle reference file at ${filePath} is missing required keys: ${missing.join(', ')}`,
      'REFERENCE_MISSING_KEY',
    );
  }

  return { filePath, entries, order };
}

/** @param {{ filePath: string, entries: Map<string, string> }} reference */
function validateGradleReference(reference) {
  const { filePath, entries } = reference;
  const get = (key) => entries.get(key) ?? '';

  for (const key of BOOLEAN_KEYS) {
    const value = get(key);
    if (value !== 'true' && value !== 'false') {
      throw new GradleReferenceError(
        `${key}="${value}" in ${filePath} must be either "true" or "false".`,
        'REFERENCE_INVALID_VALUE',
      );
    }
  }

  const jvmArgs = get('org.gradle.jvmargs');
  if (!jvmArgs.includes('-Xmx') || !jvmArgs.includes('-XX:MaxMetaspaceSize')) {
    throw new GradleReferenceError(
      `org.gradle.jvmargs in ${filePath} must define -Xmx and -XX:MaxMetaspaceSize ` +
        `for a bounded-memory build. Got: "${jvmArgs}"`,
      'REFERENCE_INVALID_VALUE',
    );
  }

  const xmx = /-Xmx(\d+)([kmg])?/i.exec(jvmArgs);
  if (!xmx) {
    throw new GradleReferenceError(
      `Could not parse a heap size from org.gradle.jvmargs="${jvmArgs}" in ${filePath}.`,
      'REFERENCE_INVALID_VALUE',
    );
  }
  const unit = (xmx[2] ?? 'm').toLowerCase();
  const multiplier = unit === 'g' ? 1024 : unit === 'k' ? 1 / 1024 : 1;
  const heapMb = Number(xmx[1]) * multiplier;
  if (!(heapMb > 0) || heapMb > 8192) {
    throw new GradleReferenceError(
      `org.gradle.jvmargs heap of ${heapMb}MB in ${filePath} is outside the supported ` +
        '0 < heap <= 8192MB range.',
      'REFERENCE_INVALID_VALUE',
    );
  }

  const workersRaw = get('org.gradle.workers.max');
  const workers = Number(workersRaw);
  if (!Number.isInteger(workers) || workers < 1 || workers > 16) {
    throw new GradleReferenceError(
      `org.gradle.workers.max="${workersRaw}" in ${filePath} must be an integer between 1 and 16.`,
      'REFERENCE_INVALID_VALUE',
    );
  }

  const architectures = get('reactNativeArchitectures');
  const abis = architectures
    .split(',')
    .map((abi) => abi.trim())
    .filter((abi) => abi.length > 0);
  const unknown = abis.filter((abi) => !KNOWN_ABIS.has(abi));
  if (abis.length === 0 || unknown.length > 0) {
    throw new GradleReferenceError(
      `reactNativeArchitectures="${architectures}" in ${filePath} contains unknown ABI values: ` +
        `${unknown.join(', ') || '(empty list)'}`,
      'REFERENCE_INVALID_VALUE',
    );
  }
}

/**
 * Read, validate and apply Stilltime's overrides.
 *
 * Precedence (highest first):
 *   1. Stilltime's explicit overrides, applied in place when the reference
 *      already declares the key and appended otherwise.
 *   2. The reference file's own values, in the reference's own order.
 *   3. Whatever Expo generated (never reaches the output for a declared key).
 *
 * @param {string} filePath
 * @returns {{ properties: { type: 'property', key: string, value: string }[],
 *   referencePath: string, overrides: Readonly<Record<string, string>> }}
 */
function resolveGradleReferenceProperties(filePath) {
  const reference = readGradleReference(filePath);
  validateGradleReference(reference);

  const order = [...reference.order];
  for (const key of Object.keys(STILLTIME_OVERRIDES)) {
    if (!reference.entries.has(key)) order.push(key);
  }

  const properties = order.map((key) => ({
    type: 'property',
    key,
    value: Object.prototype.hasOwnProperty.call(STILLTIME_OVERRIDES, key)
      ? STILLTIME_OVERRIDES[key]
      : reference.entries.get(key),
  }));

  return { properties, referencePath: reference.filePath, overrides: STILLTIME_OVERRIDES };
}

module.exports = {
  BOOLEAN_KEYS,
  GradleReferenceError,
  REQUIRED_KEYS,
  STILLTIME_OVERRIDES,
  parseGradleProperties,
  readGradleReference,
  resolveGradleReferenceProperties,
  validateGradleReference,
};