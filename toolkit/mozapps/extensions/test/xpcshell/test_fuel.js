/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

// This just verifies that FUEL integrates to the add-ons manager

var testdata = {
  dummyid: "fuel-dummy-extension@mozilla.org",
  dummyname: "Dummy Extension",
  inspectorid: "addon1@tests.mozilla.org",
  inspectorname: "Test Addon",
  missing: "fuel.fuel-test-missing",
  dummy: "fuel.fuel-test"
};

var Application = null

function run_test() {
  var cm = AM_Cc["@mozilla.org/categorymanager;1"].
           getService(AM_Ci.nsICategoryManager);

  try {
    var contract = cm.getCategoryEntry("JavaScript-global-privileged-property",
                                       "Application");
    Application = AM_Cc[contract].getService(AM_Ci.extIApplication);
  } catch (e) {
    // This application does not include a FUEL variant.
    return;
  }

  do_test_pending();
  createAppInfo("xpcshell@tests.mozilla.org", "XPCShell", "1", "1.9.2");

  const profileDir = gProfD.clone();
  profileDir.append("extensions");

  writeInstallRDFForExtension({
    id: "addon1@tests.mozilla.org",
    version: "1.0",
    name: "Test Addon",
    targetApplications: [{
      id: "xpcshell@tests.mozilla.org",
      minVersion: "1",
      maxVersion: "1"
    }],
  }, profileDir);

  startupManager();

  Application.getExtensions(function(extensions) {
    // test to see if the extensions object is available
    Assert.notEqual(extensions, null);

    // test to see if a non-existant extension exists
    Assert.ok(!extensions.has(testdata.dummyid));

    // test to see if an extension exists
    Assert.ok(extensions.has(testdata.inspectorid));

    var inspector = extensions.get(testdata.inspectorid);
    Assert.equal(inspector.id, testdata.inspectorid);
    Assert.equal(inspector.name, testdata.inspectorname);
    Assert.equal(inspector.version, "1.0");
    Assert.ok(inspector.firstRun, true);
    Assert.ok(inspector.enabled);

    // test to see if extension find works
    Assert.equal(extensions.all.length, 1);
    // STORAGE TESTING
    // Make sure the we are given the same extension (cached) so things like .storage work right
    inspector.storage.set("test", "simple check");
    Assert.ok(inspector.storage.has("test"));

    var inspector2 = extensions.get(testdata.inspectorid);
    Assert.equal(inspector2.id, testdata.inspectorid);
    Assert.ok(inspector.storage.has("test"));
    Assert.equal(inspector2.storage.get("test", "cache"), inspector.storage.get("test", "original"));

    inspector.events.addListener("disable", onGenericEvent);
    inspector.events.addListener("enable", onGenericEvent);
    inspector.events.addListener("uninstall", onGenericEvent);
    inspector.events.addListener("cancel", onGenericEvent);

    AddonManager.getAddonByID(testdata.inspectorid, function(a) {
      a.userDisabled = true;

      Assert.equal(gLastEvent, "disable");

      // enabling after a disable will only fire a 'cancel' event
      // see - http://mxr.mozilla.org/seamonkey/source/toolkit/mozapps/extensions/src/nsExtensionManager.js.in#5216
      a.userDisabled = false;
      Assert.equal(gLastEvent, "cancel");

      a.uninstall();
      Assert.equal(gLastEvent, "uninstall");

      a.cancelUninstall();
      Assert.equal(gLastEvent, "cancel");

      // PREF TESTING
      // Reset the install event preference, so that we can test it again later
      // inspector.prefs.get("install-event-fired").reset();

      // test the value of the preference root
      Assert.equal(extensions.all[0].prefs.root, "extensions.addon1@tests.mozilla.org.");

      // test getting nonexistent values
      var itemValue = inspector.prefs.getValue(testdata.missing, "default");
      Assert.equal(itemValue, "default");

      Assert.equal(inspector.prefs.get(testdata.missing), null);

      // test setting and getting a value
      inspector.prefs.setValue(testdata.dummy, "dummy");
      itemValue = inspector.prefs.getValue(testdata.dummy, "default");
      Assert.equal(itemValue, "dummy");

      // test for overwriting an existing value
      inspector.prefs.setValue(testdata.dummy, "smarty");
      itemValue = inspector.prefs.getValue(testdata.dummy, "default");
      Assert.equal(itemValue, "smarty");

      // test setting and getting a value
      inspector.prefs.get(testdata.dummy).value = "dummy2";
      itemValue = inspector.prefs.get(testdata.dummy).value;
      Assert.equal(itemValue, "dummy2");

      // test resetting a pref [since there is no default value, the pref should disappear]
      inspector.prefs.get(testdata.dummy).reset();
      itemValue = inspector.prefs.getValue(testdata.dummy, "default");
      Assert.equal(itemValue, "default");

      // test to see if a non-existant property exists
      Assert.ok(!inspector.prefs.has(testdata.dummy));

      inspector.prefs.events.addListener("change", onPrefChange);
      inspector.prefs.setValue("fuel.fuel-test", "change event");
    });
  });
}

var gLastEvent;
function onGenericEvent(event) {
  gLastEvent = event.type;
}

function onPrefChange(evt) {
  Application.getExtensions(function(extensions) {
    var inspector3 = extensions.get(testdata.inspectorid);

    Assert.equal(evt.data, testdata.dummy);
    inspector3.prefs.events.removeListener("change", onPrefChange);

    inspector3.prefs.get("fuel.fuel-test").events.addListener("change", onPrefChange2);
    inspector3.prefs.setValue("fuel.fuel-test", "change event2");
  });
}

function onPrefChange2(evt) {
  Assert.equal(evt.data, testdata.dummy);

  executeSoon(do_test_finished);
}
