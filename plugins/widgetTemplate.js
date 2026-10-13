/**
 * Constants describing the tracked `android-widget/` template.
 *
 * `withStilltimeAndroid.js` needs these at Prebuild time, and Expo loads config
 * plugins through `@expo/require-utils`, which cannot traverse a TypeScript
 * module graph — so this file is CommonJS and deliberately dependency-free.
 *
 * `src/native/widgetContract.ts` is the app-side source of truth. The two must
 * agree; `src/native/widgetContract.test.ts` asserts that they do, and
 * `StilltimeWidgetContract.kt` is the authoritative native implementation.
 */

'use strict';

/** Package suffix the widget's Kotlin sources are placed under. */
const WIDGET_PACKAGE_SUFFIX = 'widget';

/**
 * Broadcast actions are namespaced by the *application id*, which is
 * configurable, so they are built from a base rather than hard-coded.
 */
const DEFAULT_APP_PACKAGE = 'com.stilltime.app';

const WIDGET_ACTION_BASE = `${DEFAULT_APP_PACKAGE}.widget.action`;
const APP_ACTION_BASE = `${DEFAULT_APP_PACKAGE}.action`;

/** The subset of the contract the manifest injection needs. */
const widgetActionConstants = Object.freeze({
  actionApply: `${WIDGET_ACTION_BASE}.APPLY_TIMEOUT`,
  actionToggleStayAwake: `${WIDGET_ACTION_BASE}.TOGGLE_STAY_AWAKE`,
  actionRefresh: `${WIDGET_ACTION_BASE}.REFRESH`,
  appRefreshAction: `${APP_ACTION_BASE}.WIDGET_REFRESH`,
});

const widgetComponent = Object.freeze({
  className: 'StilltimeWidgetProvider',
  configurationActivityClassName: 'StilltimeWidgetConfigureActivity',
  layoutName: 'widget_stilltime',
  infoXmlName: 'timeout_widget_info',
});

/** `<meta-data>` resource name for the AppWidgetProviderInfo XML. */
const WIDGET_INFO_XML_RESOURCE = `@xml/${widgetComponent.infoXmlName}`;

module.exports = {
  DEFAULT_APP_PACKAGE,
  WIDGET_ACTION_BASE,
  WIDGET_INFO_XML_RESOURCE,
  WIDGET_PACKAGE_SUFFIX,
  widgetActionConstants,
  widgetComponent,
};