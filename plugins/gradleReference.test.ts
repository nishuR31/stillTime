import {
  GradleReferenceError,
  parseGradleProperties,
  resolveGradleReferenceProperties,
  STILLTIME_OVERRIDES,
  validateGradleReference,
  readGradleReference,
} from './gradleReference';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const VALID = `
org.gradle.daemon=true
org.gradle.jvmargs=-Xmx2048m -XX:MaxMetaspaceSize=512m -Dfile.encoding=UTF-8
org.gradle.parallel=false
org.gradle.workers.max=2
org.gradle.caching=true
android.useAndroidX=true
android.enablePngCrunchInReleaseBuilds=false
reactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64
hermesEnabled=true
newArchEnabled=true
edgeToEdgeEnabled=true
expo.gif.enabled=true
expo.webp.enabled=true
`;

function withTempFile(contents: string, run: (file: string) => void): void {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stilltime-gradle-'));
  const file = path.join(dir, 'gradle.properties');
  fs.writeFileSync(file, contents, 'utf8');
  try {
    run(file);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

describe('parseGradleProperties', () => {
  it('parses booleans, numbers and strings as strings', () => {
    const parsed = parseGradleProperties(VALID);
    expect(parsed.entries.get('org.gradle.daemon')).toBe('true');
    expect(parsed.entries.get('org.gradle.workers.max')).toBe('2');
    expect(parsed.entries.get('reactNativeArchitectures')).toBe('armeabi-v7a,arm64-v8a,x86,x86_64');
  });

  it('ignores comments and blank lines', () => {
    const parsed = parseGradleProperties('# comment\n\n! bang comment\nkey=value\n');
    expect([...parsed.entries.keys()]).toEqual(['key']);
  });

  it('keeps everything after the first separator in a value', () => {
    const parsed = parseGradleProperties('org.gradle.jvmargs=-Xmx1g -XX:MaxMetaspaceSize=512m\n');
    expect(parsed.entries.get('org.gradle.jvmargs')).toBe('-Xmx1g -XX:MaxMetaspaceSize=512m');
  });

  it('supports colon and space separators', () => {
    const parsed = parseGradleProperties('a:1\nb 2\n');
    expect(parsed.entries.get('a')).toBe('1');
    expect(parsed.entries.get('b')).toBe('2');
  });

  it('joins lines continued with a trailing backslash', () => {
    const parsed = parseGradleProperties('key = one \\\n  two\n');
    expect(parsed.entries.get('key')).toBe('one two');
  });

  it('strips matching quotes', () => {
    expect(parseGradleProperties('key="quoted value"\n').entries.get('key')).toBe('quoted value');
  });

  it('preserves the file order', () => {
    const parsed = parseGradleProperties('z=1\na=2\nm=3\n');
    expect(parsed.order).toEqual(['z', 'a', 'm']);
  });
});

describe('validateGradleReference', () => {
  it('accepts a well-formed reference', () => {
    withTempFile(VALID, (file) => {
      expect(() => validateGradleReference(readGradleReference(file))).not.toThrow();
    });
  });

  it('rejects a missing file', () => {
    expect(() => resolveGradleReferenceProperties('/definitely/not/here.properties')).toThrow(
      GradleReferenceError,
    );
  });

  it('rejects an empty file', () => {
    withTempFile('# nothing but a comment\n', (file) => {
      expect(() => resolveGradleReferenceProperties(file)).toThrow(/no properties/);
    });
  });

  it('rejects a file missing a required key', () => {
    const incomplete = VALID.replace('org.gradle.caching=true\n', '');
    withTempFile(incomplete, (file) => {
      expect(() => resolveGradleReferenceProperties(file)).toThrow(/org\.gradle\.caching/);
    });
  });

  it('rejects a jvmargs value without a heap ceiling', () => {
    const bad = VALID.replace('-Xmx2048m', '');
    withTempFile(bad, (file) => {
      expect(() => resolveGradleReferenceProperties(file)).toThrow(/-Xmx/);
    });
  });

  it('rejects an absurd heap size', () => {
    const bad = VALID.replace('-Xmx2048m', '-Xmx64g');
    withTempFile(bad, (file) => {
      expect(() => resolveGradleReferenceProperties(file)).toThrow(/outside the supported/);
    });
  });

  it('rejects a non-integer worker count', () => {
    const bad = VALID.replace('org.gradle.workers.max=2', 'org.gradle.workers.max=lots');
    withTempFile(bad, (file) => {
      expect(() => resolveGradleReferenceProperties(file)).toThrow(/workers\.max/);
    });
  });

  it('rejects unknown ABIs', () => {
    const bad = VALID.replace('armeabi-v7a,arm64-v8a,x86,x86_64', 'armeabi-v7a,mips');
    withTempFile(bad, (file) => {
      expect(() => resolveGradleReferenceProperties(file)).toThrow(/unknown ABI/);
    });
  });

  it('rejects a non-boolean flag', () => {
    const bad = VALID.replace('hermesEnabled=true', 'hermesEnabled=yes');
    withTempFile(bad, (file) => {
      expect(() => resolveGradleReferenceProperties(file)).toThrow(/hermesEnabled/);
    });
  });
});

describe('resolveGradleReferenceProperties', () => {
  it('preserves the reference order and overrides matching keys in place', () => {
    withTempFile(VALID, (file) => {
      const { properties } = resolveGradleReferenceProperties(file);
      const reference = readGradleReference(file);

      expect(properties.length).toBe(reference.order.length);
      reference.order.forEach((key, index) => {
        if (Object.prototype.hasOwnProperty.call(STILLTIME_OVERRIDES, key)) return;
        expect(properties[index]?.value).toBe(reference.entries.get(key));
      });
    });
  });

  it('replaces the reference value for keys Stilltime overrides', () => {
    withTempFile(VALID, (file) => {
      const { properties, overrides } = resolveGradleReferenceProperties(file);
      const index = readGradleReference(file).order.indexOf('expo.webp.enabled');

      // The reference says `true`; Stilltime forces it off.
      expect(readGradleReference(file).entries.get('expo.webp.enabled')).toBe('true');
      expect(overrides['expo.webp.enabled']).toBe('false');
      expect(properties[index]?.value).toBe('false');
    });
  });

  it('appends overrides that the reference does not mention', () => {
    const withoutKey = VALID.replace('expo.webp.enabled=true\n', '');
    withTempFile(withoutKey, (file) => {
      const { properties } = resolveGradleReferenceProperties(file);
      const values = properties.map((entry) => entry.value);
      expect(values).toContain('false');
      expect(properties[properties.length - 1]?.value).toBe('false');
    });
  });
});

describe('the machine reference file', () => {
  const REFERENCE = '/home/nishu/TechStack/codes/gradle.properties';
  const available = fs.existsSync(REFERENCE);
  const machineIt = available ? it : it.skip;

  machineIt('is readable and valid', () => {
    const { referencePath, properties } = resolveGradleReferenceProperties(REFERENCE);
    expect(referencePath).toBe(REFERENCE);
    expect(properties.length).toBeGreaterThan(10);
  });

  machineIt('reproduces the machine tuning Stilltime depends on', () => {
    const reference = readGradleReference(REFERENCE);
    const { properties } = resolveGradleReferenceProperties(REFERENCE);

    // `resolveGradleReferenceProperties` keeps the reference's own order, so
    // the i-th resolved property corresponds to the i-th reference key.
    const resolved = new Map<string, string>();
    reference.order.forEach((key, index) => {
      resolved.set(key, properties[index]?.value ?? '');
    });

    expect(resolved.get('reactNativeArchitectures')).toBe('armeabi-v7a,arm64-v8a,x86,x86_64');
    expect(resolved.get('org.gradle.workers.max')).toBe('2');
    expect(resolved.get('org.gradle.parallel')).toBe('false');
    expect(resolved.get('hermesEnabled')).toBe('true');
    expect(resolved.get('newArchEnabled')).toBe('true');
    expect(resolved.get('edgeToEdgeEnabled')).toBe('true');
    expect(resolved.get('org.gradle.jvmargs')).toContain('-Xmx2048m');
  });
});