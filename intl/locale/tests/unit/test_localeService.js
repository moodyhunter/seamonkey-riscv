/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const { Services } = ChromeUtils.import('resource://gre/modules/Services.jsm', {});
const osPrefs = Cc["@mozilla.org/intl/ospreferences;1"].
  getService(Ci.mozIOSPreferences);

const localeService =
  Cc["@mozilla.org/intl/localeservice;1"]
  .getService(Ci.mozILocaleService);

/**
 * Make sure the locale service can be instantiated.
 */
function run_test()
{
  run_next_test();
}

add_test(function test_defaultLocale() {
  const defaultLocale = localeService.defaultLocale;
  Assert.ok(defaultLocale === "en-US", "Default locale is en-US");
  run_next_test();
});

add_test(function test_getAppLocalesAsLangTags() {
  const appLocale = localeService.getAppLocaleAsLangTag();
  Assert.ok(appLocale != "", "appLocale is non-empty");

  const appLocales = localeService.getAppLocalesAsLangTags();
  Assert.ok(Array.isArray(appLocales), "appLocales returns an array");

  Assert.ok(appLocale == appLocales[0], "appLocale matches first entry in appLocales");

  const enUSLocales = appLocales.filter(loc => loc === "en-US");
  Assert.ok(enUSLocales.length == 1, "en-US is present exactly one time");

  run_next_test();
});

const PREF_MATCH_OS_LOCALE = "intl.locale.matchOS";
const PREF_SELECTED_LOCALE = "general.useragent.locale";
const PREF_OS_LOCALE       = "intl.locale.os";
const REQ_LOC_CHANGE_EVENT = "intl:requested-locales-changed";

add_test(function test_getRequestedLocales() {
  const requestedLocales = localeService.getRequestedLocales();
  Assert.ok(Array.isArray(requestedLocales), "requestedLocales returns an array");

  run_next_test();
});

/**
 * In this test we verify that after we set an observer on the LocaleService
 * event for requested locales change, it will be fired when the
 * pref for matchOS is set to true.
 *
 * Then, we test that when the matchOS is set to true, we will retrieve
 * OS locale from getRequestedLocales.
 */
add_test(function test_getRequestedLocales_matchOS() {
  do_test_pending();

  Services.prefs.setBoolPref(PREF_MATCH_OS_LOCALE, false);
  Services.prefs.setCharPref(PREF_SELECTED_LOCALE, "ar-IR");
  Services.prefs.setCharPref(PREF_OS_LOCALE, "en-US");

  const observer = {
    observe: function (aSubject, aTopic, aData) {
      switch (aTopic) {
        case REQ_LOC_CHANGE_EVENT:
          const reqLocs = localeService.getRequestedLocales();
          Assert.ok(reqLocs[0] === osPrefs.systemLocale);
          Services.obs.removeObserver(observer, REQ_LOC_CHANGE_EVENT);
          do_test_finished();
      }
    }
  };

  Services.obs.addObserver(observer, REQ_LOC_CHANGE_EVENT);
  Services.prefs.setBoolPref(PREF_MATCH_OS_LOCALE, true);

  run_next_test();
});

/**
 * In this test we verify that after we set an observer on the LocaleService
 * event for requested locales change, it will be fired when the
 * pref for browser UI locale changes.
 */
add_test(function test_getRequestedLocales_matchOS() {
  do_test_pending();

  Services.prefs.setBoolPref(PREF_MATCH_OS_LOCALE, false);
  Services.prefs.setCharPref(PREF_SELECTED_LOCALE, "ar-IR");

  const observer = {
    observe: function (aSubject, aTopic, aData) {
      switch (aTopic) {
        case REQ_LOC_CHANGE_EVENT:
          const reqLocs = localeService.getRequestedLocales();
          Assert.ok(reqLocs[0] === "sr-RU");
          Services.obs.removeObserver(observer, REQ_LOC_CHANGE_EVENT);
          do_test_finished();
      }
    }
  };

  Services.obs.addObserver(observer, REQ_LOC_CHANGE_EVENT);
  Services.prefs.setCharPref(PREF_SELECTED_LOCALE, "sr-RU");

  run_next_test();
});

add_test(function test_getRequestedLocale() {
  Services.prefs.setBoolPref(PREF_MATCH_OS_LOCALE, false);
  Services.prefs.setCharPref(PREF_SELECTED_LOCALE, "tlh");

  let requestedLocale = localeService.getRequestedLocale();
  Assert.ok(requestedLocale === "tlh", "requestedLocale returns the right value");

  Services.prefs.setCharPref(PREF_SELECTED_LOCALE, "");

  requestedLocale = localeService.getRequestedLocale();
  Assert.ok(requestedLocale === "", "requestedLocale returns empty value value");

  Services.prefs.clearUserPref(PREF_MATCH_OS_LOCALE);
  Services.prefs.clearUserPref(PREF_SELECTED_LOCALE);

  run_next_test();
});

add_test(function test_setRequestedLocales() {
  localeService.setRequestedLocales([]);

  let matchOS = Services.prefs.getBoolPref(PREF_MATCH_OS_LOCALE);
  Assert.ok(matchOS === true);

  localeService.setRequestedLocales(['de-AT']);

  matchOS = Services.prefs.getBoolPref(PREF_MATCH_OS_LOCALE);
  Assert.ok(matchOS === false);
  let locales = localeService.getRequestedLocales();;
  Assert.ok(locales[0] === 'de-AT');

  run_next_test();
});

add_test(function test_isAppLocaleRTL() {
  Assert.ok(typeof localeService.isAppLocaleRTL === 'boolean');

  run_next_test();
});

registerCleanupFunction(() => {
  Services.prefs.clearUserPref(PREF_SELECTED_LOCALE);
  Services.prefs.clearUserPref(PREF_MATCH_OS_LOCALE);
  Services.prefs.clearUserPref(PREF_OS_LOCALE, "en-US");
});
