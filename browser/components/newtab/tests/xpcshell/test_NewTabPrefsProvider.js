"use strict";

ChromeUtils.import("resource://gre/modules/XPCOMUtils.jsm");
ChromeUtils.import("resource://gre/modules/Preferences.jsm");

ChromeUtils.defineModuleGetter(this, "NewTabPrefsProvider",
    "resource:///modules/NewTabPrefsProvider.jsm");

add_task(async function test_observe() {
  let prefsMap = NewTabPrefsProvider.prefs.prefsMap;
  for (let prefName of prefsMap.keys()) {
    let prefValueType = prefsMap.get(prefName);

    let beforeVal;
    let afterVal;

    switch (prefValueType) {
      case "bool":
        beforeVal = false;
        afterVal = true;
        Preferences.set(prefName, beforeVal);
        break;
      case "localized":
      case "str":
        beforeVal = "";
        afterVal = "someStr";
        Preferences.set(prefName, beforeVal);
        break;
    }
    NewTabPrefsProvider.prefs.init();
    let promise = new Promise(resolve => {
      NewTabPrefsProvider.prefs.once(prefName, (name, data) => { // jshint ignore:line
        resolve([name, data]);
      });
    });
    Preferences.set(prefName, afterVal);
    let [actualName, actualData] = await promise;
    equal(prefName, actualName, `emitter sent the correct pref: ${prefName}`);
    equal(afterVal, actualData, `emitter collected correct pref data for ${prefName}`);
    NewTabPrefsProvider.prefs.uninit();
  }
});
