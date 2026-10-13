/**
 * Injects the machine-wide Gradle reference properties into the generated
 * `android/gradle.properties`.
 *
 * A missing or invalid reference file throws and aborts Prebuild, rather than
 * quietly building with different settings than the machine profile intends.
 *
 * CommonJS on purpose: see the note in `./gradleReference.js`.
 */

'use strict';

const { createRunOncePlugin, withGradleProperties } = require('expo/config-plugins');

const {
  GradleReferenceError,
  resolveGradleReferenceProperties,
} = require('./gradleReference');

const DEFAULT_REFERENCE_PATH = '/home/nishu/TechStack/codes/gradle.properties';

const withGradleReferenceProperties = createRunOncePlugin(
  (config) => {
    const referencePath =
      config.extra?.gradleReferencePath ??
      process.env.STILLTIME_GRADLE_REFERENCE ??
      DEFAULT_REFERENCE_PATH;

    let resolved;
    try {
      resolved = resolveGradleReferenceProperties(referencePath);
    } catch (error) {
      if (error instanceof GradleReferenceError) {
        throw new Error(
          `[stilltime] Gradle reference rejected (${error.code}): ${error.message}`,
          { cause: error },
        );
      }
      throw error;
    }

    console.log(
      `[stilltime] Applied ${resolved.properties.length} Gradle properties from ${resolved.referencePath}`,
    );
    const overrides = Object.entries(resolved.overrides);
    if (overrides.length > 0) {
      console.log(
        `[stilltime] Stilltime overrides: ${overrides
          .map(([key, value]) => `${key}=${value}`)
          .join(', ')}`,
      );
    }

    return withGradleProperties(config, (cfg) => {
      // Other plugins (expo-build-properties, the Expo defaults) also register
      // gradle.properties mods. Replacing `modResults` would silently discard
      // their keys, so only the keys Stilltime's reference actually declares are
      // replaced; everything else is left in place.
      const stilltimeKeys = new Set(resolved.properties.map((property) => property.key));
      const preserved = (cfg.modResults ?? []).filter((item) => !stilltimeKeys.has(item.key));

      cfg.modResults = [...preserved, ...resolved.properties];
      return cfg;
    });
  },
  'withGradleReferenceProperties',
  '1.0.0',
);

module.exports = withGradleReferenceProperties;
module.exports.default = withGradleReferenceProperties;
module.exports.GradleReferenceError = GradleReferenceError;
module.exports.resolveGradleReferenceProperties = resolveGradleReferenceProperties;