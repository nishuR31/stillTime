import {
  WIDGET_PACKAGE_SUFFIX,
  widgetActionConstants,
  widgetComponent,
  WIDGET_PREFS_FILE,
  WIDGET_MIN_TIMEOUT_MS,
  WIDGET_MAX_TIMEOUT_MS,
  WIDGET_STAY_AWAKE_TIMEOUT_MS,
  widgetPrefsKeys,
} from './widgetContract';
import {
  DEFAULT_APP_PACKAGE,
  WIDGET_INFO_XML_RESOURCE,
} from '../../plugins/widgetTemplate';

import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * `plugins/widgetTemplate.js` has to be CommonJS so Expo's config loader can
 * require it, which means it cannot import this module. These assertions are
 * what keeps the two copies from drifting.
 */
describe('widget template constants', () => {
  it('matches the app-side contract', () => {
    expect(WIDGET_PACKAGE_SUFFIX).toBe('widget');
    expect(widgetActionConstants.actionApply).toBe(`${DEFAULT_APP_PACKAGE}.widget.action.APPLY_TIMEOUT`);
    expect(widgetActionConstants.actionToggleStayAwake).toBe(
      `${DEFAULT_APP_PACKAGE}.widget.action.TOGGLE_STAY_AWAKE`,
    );
    expect(widgetActionConstants.actionRefresh).toBe(`${DEFAULT_APP_PACKAGE}.widget.action.REFRESH`);
    expect(widgetActionConstants.appRefreshAction).toBe(`${DEFAULT_APP_PACKAGE}.action.WIDGET_REFRESH`);
    expect(widgetActionConstants.extraTimeoutMs).toBe('timeout_ms');
  });

  it('matches the app id used by the Expo config', () => {
    const config = readFileSync(path.join(__dirname, '..', '..', 'app.config.ts'), 'utf8');
    expect(config).toContain(`const PACKAGE = '${DEFAULT_APP_PACKAGE}'`);
  });

  it('builds the provider info resource from the widget xml name', () => {
    expect(WIDGET_INFO_XML_RESOURCE).toBe(`@xml/${widgetComponent.infoXmlName}`);
    expect(WIDGET_INFO_XML_RESOURCE).toBe('@xml/timeout_widget_info');
  });
});

/**
 * The Kotlin contract is the authoritative implementation, so a mismatch there
 * is a silent runtime bug rather than a compile error.
 */
describe('StilltimeWidgetContract.kt', () => {
  const kotlin = readFileSync(
    path.join(
      __dirname,
      '..',
      '..',
      'modules',
      'screen-timeout',
      'android',
      'src',
      'main',
      'java',
      'com',
      'stilltime',
      'timeout',
      'StilltimeWidgetContract.kt',
    ),
    'utf8',
  );

  it('uses the same preferences file', () => {
    expect(kotlin).toContain(`PREFS_FILE: String = "${WIDGET_PREFS_FILE}"`);
  });

  it('uses the same preference keys', () => {
    for (const key of Object.values(widgetPrefsKeys)) {
      expect(kotlin).toContain(`"${key}"`);
    }
  });

  it('uses the same broadcast actions and extras', () => {
    expect(kotlin).toContain(`ACTION_APPLY_TIMEOUT: String = "${widgetActionConstants.actionApply}"`);
    expect(kotlin).toContain(
      `ACTION_TOGGLE_STAY_AWAKE: String = "${widgetActionConstants.actionToggleStayAwake}"`,
    );
    expect(kotlin).toContain(`ACTION_REFRESH: String = "${widgetActionConstants.actionRefresh}"`);
    expect(kotlin).toContain(
      `ACTION_APP_REFRESH: String = "${widgetActionConstants.appRefreshAction}"`,
    );
    expect(kotlin).toContain(
      `EXTRA_TIMEOUT_MS: String = "${widgetActionConstants.extraTimeoutMs}"`,
    );
  });

it('uses the same bounds', () => {
    // Kotlin writes digit separators (15_000); compare on the bare number.
    const plain = kotlin.replace(/(\d)_(?=\d)/g, '$1');
    expect(plain).toContain(`MIN_TIMEOUT_MS: Int = ${WIDGET_MIN_TIMEOUT_MS}`);
    expect(plain).toContain(`MAX_TIMEOUT_MS: Int = ${WIDGET_MAX_TIMEOUT_MS}`);
    expect(plain).toContain(`STAY_AWAKE_TIMEOUT_MS: Int = ${WIDGET_STAY_AWAKE_TIMEOUT_MS}`);
  });
});

/**
 * The widget lives in the app module under the application package, and reaches
 * back into the Expo module's library for the shared contract.
 */
describe('widget Kotlin sources', () => {
  const widgetDir = path.join(__dirname, '..', '..', 'android-widget', 'kotlin');
  const provider = readFileSync(path.join(widgetDir, 'StilltimeWidgetProvider.kt'), 'utf8');

  it('declares the package through the token the plugin rewrites', () => {
    // The real application id is only known at Prebuild time.
    expect(provider).toContain(`package __STILLTIME_APP_PACKAGE__.${WIDGET_PACKAGE_SUFFIX}`);
  });

  it('extends the shared contract and names the same provider class', () => {
    expect(provider).toContain('StilltimeWidgetContract');
    expect(provider).toContain(`class ${widgetComponent.className}`);
  });

  it('imports the app R class through the package token', () => {
    expect(provider).toContain('import __STILLTIME_APP_PACKAGE__.R');
  });
});