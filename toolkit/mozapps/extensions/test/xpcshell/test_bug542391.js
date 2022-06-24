/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const URI_EXTENSION_UPDATE_DIALOG     = "chrome://mozapps/content/extensions/update.xul";
const PREF_EM_SHOW_MISMATCH_UI        = "extensions.showMismatchUI";

// The test extension uses an insecure update url.
Services.prefs.setBoolPref("extensions.checkUpdateSecurity", false);

ChromeUtils.import("resource://testing-common/MockRegistrar.jsm");
var testserver;

const profileDir = gProfD.clone();
profileDir.append("extensions");

var gInstallUpdate = false;
var gCheckUpdates = false;

// This will be called to show the compatibility update dialog.
var WindowWatcher = {
  expected: false,
  args: null,

  openWindow(parent, url, name, features, args) {
    Assert.ok(Services.startup.interrupted);
    Assert.equal(url, URI_EXTENSION_UPDATE_DIALOG);
    Assert.ok(this.expected);
    this.expected = false;
    this.args = args.QueryInterface(AM_Ci.nsIVariant);

    var updated = !gCheckUpdates;
    if (gCheckUpdates) {
      AddonManager.getAddonByID("override1x2-1x3@tests.mozilla.org", function(a6) {
        a6.findUpdates({
          onUpdateFinished() {
            AddonManagerPrivate.removeStartupChange("disabled", "override1x2-1x3@tests.mozilla.org");
            updated = true;
          }
        }, AddonManager.UPDATE_WHEN_NEW_APP_INSTALLED);
      });
    }

    var installed = !gInstallUpdate;
    if (gInstallUpdate) {
      // Simulate installing an update while in the dialog
      installAllFiles([do_get_addon("upgradeable1x2-3_2")], function() {
        AddonManagerPrivate.removeStartupChange("disabled", "upgradeable1x2-3@tests.mozilla.org");
        AddonManagerPrivate.addStartupChange("updated", "upgradeable1x2-3@tests.mozilla.org");
        installed = true;
      });
    }

    // The dialog is meant to be opened modally and the install operation can be
    // asynchronous, so we must spin an event loop (like the modal window does)
    // until the install is complete
    let tm = AM_Cc["@mozilla.org/thread-manager;1"].
             getService(AM_Ci.nsIThreadManager);

    tm.spinEventLoopUntil(() => installed && updated);
  },

  QueryInterface(iid) {
    if (iid.equals(Ci.nsIWindowWatcher)
     || iid.equals(Ci.nsISupports))
      return this;

    throw Cr.NS_ERROR_NO_INTERFACE;
  }
}

MockRegistrar.register("@mozilla.org/embedcomp/window-watcher;1", WindowWatcher);

function check_state_v1([a1, a2, a3, a4, a5, a6]) {
  Assert.notEqual(a1, null);
  Assert.ok(!a1.appDisabled);
  Assert.ok(!a1.userDisabled);
  Assert.ok(a1.isActive);
  Assert.ok(isExtensionInAddonsList(profileDir, a1.id));

  Assert.notEqual(a2, null);
  Assert.ok(!a2.appDisabled);
  Assert.ok(a2.userDisabled);
  Assert.ok(!a2.isActive);
  Assert.ok(!isExtensionInAddonsList(profileDir, a2.id));

  Assert.notEqual(a3, null);
  Assert.ok(!a3.appDisabled);
  Assert.ok(!a3.userDisabled);
  Assert.ok(a3.isActive);
  Assert.ok(isExtensionInAddonsList(profileDir, a3.id));
  Assert.equal(a3.version, "1.0");

  Assert.notEqual(a4, null);
  Assert.ok(!a4.appDisabled);
  Assert.ok(a4.userDisabled);
  Assert.ok(!a4.isActive);
  Assert.ok(!isExtensionInAddonsList(profileDir, a4.id));

  Assert.notEqual(a5, null);
  Assert.ok(!a5.appDisabled);
  Assert.ok(!a5.userDisabled);
  Assert.ok(a5.isActive);
  Assert.ok(isExtensionInAddonsList(profileDir, a5.id));

  Assert.notEqual(a6, null);
  Assert.ok(!a6.appDisabled);
  Assert.ok(!a6.userDisabled);
  Assert.ok(a6.isActive);
  Assert.ok(isExtensionInAddonsList(profileDir, a6.id));
}

function check_state_v1_2([a1, a2, a3, a4, a5, a6]) {
  Assert.notEqual(a1, null);
  Assert.ok(!a1.appDisabled);
  Assert.ok(!a1.userDisabled);
  Assert.ok(a1.isActive);
  Assert.ok(isExtensionInAddonsList(profileDir, a1.id));

  Assert.notEqual(a2, null);
  Assert.ok(!a2.appDisabled);
  Assert.ok(a2.userDisabled);
  Assert.ok(!a2.isActive);
  Assert.ok(!isExtensionInAddonsList(profileDir, a2.id));

  Assert.notEqual(a3, null);
  Assert.ok(a3.appDisabled);
  Assert.ok(!a3.userDisabled);
  Assert.ok(!a3.isActive);
  Assert.ok(!isExtensionInAddonsList(profileDir, a3.id));
  Assert.equal(a3.version, "2.0");

  Assert.notEqual(a4, null);
  Assert.ok(!a4.appDisabled);
  Assert.ok(a4.userDisabled);
  Assert.ok(!a4.isActive);
  Assert.ok(!isExtensionInAddonsList(profileDir, a4.id));

  Assert.notEqual(a5, null);
  Assert.ok(!a5.appDisabled);
  Assert.ok(!a5.userDisabled);
  Assert.ok(a5.isActive);
  Assert.ok(isExtensionInAddonsList(profileDir, a5.id));

  Assert.notEqual(a6, null);
  Assert.ok(!a6.appDisabled);
  Assert.ok(!a6.userDisabled);
  Assert.ok(a6.isActive);
  Assert.ok(isExtensionInAddonsList(profileDir, a6.id));
}

function check_state_v2([a1, a2, a3, a4, a5, a6]) {
  Assert.notEqual(a1, null);
  Assert.ok(a1.appDisabled);
  Assert.ok(!a1.userDisabled);
  Assert.ok(!a1.isActive);
  Assert.ok(!isExtensionInAddonsList(profileDir, a1.id));

  Assert.notEqual(a2, null);
  Assert.ok(!a2.appDisabled);
  Assert.ok(a2.userDisabled);
  Assert.ok(!a2.isActive);
  Assert.ok(!isExtensionInAddonsList(profileDir, a2.id));

  Assert.notEqual(a3, null);
  Assert.ok(!a3.appDisabled);
  Assert.ok(!a3.userDisabled);
  Assert.ok(a3.isActive);
  Assert.ok(isExtensionInAddonsList(profileDir, a3.id));
  Assert.equal(a3.version, "1.0");

  Assert.notEqual(a4, null);
  Assert.ok(!a4.appDisabled);
  Assert.ok(a4.userDisabled);
  Assert.ok(!a4.isActive);
  Assert.ok(!isExtensionInAddonsList(profileDir, a4.id));

  Assert.notEqual(a5, null);
  Assert.ok(!a5.appDisabled);
  Assert.ok(!a5.userDisabled);
  Assert.ok(a5.isActive);
  Assert.ok(isExtensionInAddonsList(profileDir, a5.id));

  Assert.notEqual(a6, null);
  Assert.ok(!a6.appDisabled);
  Assert.ok(!a6.userDisabled);
  Assert.ok(a6.isActive);
  Assert.ok(isExtensionInAddonsList(profileDir, a6.id));
}

function check_state_v3([a1, a2, a3, a4, a5, a6]) {
  Assert.notEqual(a1, null);
  Assert.ok(a1.appDisabled);
  Assert.ok(!a1.userDisabled);
  Assert.ok(!a1.isActive);
  Assert.ok(!isExtensionInAddonsList(profileDir, a1.id));

  Assert.notEqual(a2, null);
  Assert.ok(a2.appDisabled);
  Assert.ok(a2.userDisabled);
  Assert.ok(!a2.isActive);
  Assert.ok(!isExtensionInAddonsList(profileDir, a2.id));

  Assert.notEqual(a3, null);
  Assert.ok(a3.appDisabled);
  Assert.ok(!a3.userDisabled);
  Assert.ok(!a3.isActive);
  Assert.ok(!isExtensionInAddonsList(profileDir, a3.id));
  Assert.equal(a3.version, "1.0");

  Assert.notEqual(a4, null);
  Assert.ok(!a4.appDisabled);
  Assert.ok(a4.userDisabled);
  Assert.ok(!a4.isActive);
  Assert.ok(!isExtensionInAddonsList(profileDir, a4.id));

  Assert.notEqual(a5, null);
  Assert.ok(!a5.appDisabled);
  Assert.ok(!a5.userDisabled);
  Assert.ok(a5.isActive);
  Assert.ok(isExtensionInAddonsList(profileDir, a5.id));

  Assert.notEqual(a6, null);
  Assert.ok(!a6.appDisabled);
  Assert.ok(!a6.userDisabled);
  Assert.ok(a6.isActive);
  Assert.ok(isExtensionInAddonsList(profileDir, a6.id));
}

function check_state_v3_2([a1, a2, a3, a4, a5, a6]) {
  Assert.notEqual(a1, null);
  Assert.ok(a1.appDisabled);
  Assert.ok(!a1.userDisabled);
  Assert.ok(!a1.isActive);
  Assert.ok(!isExtensionInAddonsList(profileDir, a1.id));

  Assert.notEqual(a2, null);
  Assert.ok(a2.appDisabled);
  Assert.ok(a2.userDisabled);
  Assert.ok(!a2.isActive);
  Assert.ok(!isExtensionInAddonsList(profileDir, a2.id));

  Assert.notEqual(a3, null);
  Assert.ok(!a3.appDisabled);
  Assert.ok(!a3.userDisabled);
  Assert.ok(a3.isActive);
  Assert.ok(isExtensionInAddonsList(profileDir, a3.id));
  Assert.equal(a3.version, "2.0");

  Assert.notEqual(a4, null);
  Assert.ok(!a4.appDisabled);
  Assert.ok(a4.userDisabled);
  Assert.ok(!a4.isActive);
  Assert.ok(!isExtensionInAddonsList(profileDir, a4.id));

  Assert.notEqual(a5, null);
  Assert.ok(!a5.appDisabled);
  Assert.ok(!a5.userDisabled);
  Assert.ok(a5.isActive);
  Assert.ok(isExtensionInAddonsList(profileDir, a5.id));

  Assert.notEqual(a6, null);
  Assert.ok(!a6.appDisabled);
  Assert.ok(!a6.userDisabled);
  Assert.ok(a6.isActive);
  Assert.ok(isExtensionInAddonsList(profileDir, a6.id));
}

// Install all the test add-ons, disable two of them and "upgrade" the app to
// version 2 which will appDisable one.
add_task(async function init() {
  createAppInfo("xpcshell@tests.mozilla.org", "XPCShell", "1", "1");

  Services.prefs.setBoolPref(PREF_EM_SHOW_MISMATCH_UI, true);

  // Add an extension to the profile to make sure the dialog doesn't show up
  // on new profiles
  var dest = writeInstallRDFForExtension({
    id: "addon1@tests.mozilla.org",
    version: "1.0",
    targetApplications: [{
      id: "xpcshell@tests.mozilla.org",
      minVersion: "1",
      maxVersion: "1"
    }],
    name: "Test Addon 1",
  }, profileDir);

  // Create and configure the HTTP server.
  testserver = createHttpServer(4444);
  testserver.registerDirectory("/data/", do_get_file("data"));
  testserver.registerDirectory("/addons/", do_get_file("addons"));

  startupManager();

  // Remove the add-on we installed directly in the profile directory;
  // this should show as uninstalled on next restart
  dest.remove(true);

  // Load up an initial set of add-ons
  await promiseInstallAllFiles([do_get_addon("min1max1"),
                                do_get_addon("min1max2"),
                                do_get_addon("upgradeable1x2-3_1"),
                                do_get_addon("min1max3"),
                                do_get_addon("min1max3b"),
                                do_get_addon("override1x2-1x3")]);
  await promiseRestartManager();

  check_startup_changes("installed", []);
  check_startup_changes("updated", []);
  check_startup_changes("uninstalled", ["addon1@tests.mozilla.org"]);
  check_startup_changes("disabled", []);
  check_startup_changes("enabled", []);

  // user-disable two add-ons
  let [a2, a4] = await promiseAddonsByIDs(["min1max2@tests.mozilla.org",
                                           "min1max3@tests.mozilla.org"]);
  Assert.ok(a2 != null && a4 != null);
  a2.userDisabled = true;
  a4.userDisabled = true;
  await promiseRestartManager();
  check_startup_changes("installed", []);
  check_startup_changes("updated", []);
  check_startup_changes("uninstalled", []);
  check_startup_changes("disabled", []);
  check_startup_changes("enabled", []);

  let addons = await promiseAddonsByIDs(["min1max1@tests.mozilla.org",
                                         "min1max2@tests.mozilla.org",
                                         "upgradeable1x2-3@tests.mozilla.org",
                                         "min1max3@tests.mozilla.org",
                                         "min1max3b@tests.mozilla.org",
                                         "override1x2-1x3@tests.mozilla.org"]);
  check_state_v1(addons);

  // Restart as version 2, add-on _1 should become app-disabled
  WindowWatcher.expected = true;
  await promiseRestartManager("2");
  check_startup_changes("installed", []);
  check_startup_changes("updated", []);
  check_startup_changes("uninstalled", []);
  check_startup_changes("disabled", ["min1max1@tests.mozilla.org"]);
  check_startup_changes("enabled", []);
  Assert.ok(!WindowWatcher.expected);

  addons = await promiseAddonsByIDs(["min1max1@tests.mozilla.org",
                                     "min1max2@tests.mozilla.org",
                                     "upgradeable1x2-3@tests.mozilla.org",
                                     "min1max3@tests.mozilla.org",
                                     "min1max3b@tests.mozilla.org",
                                     "override1x2-1x3@tests.mozilla.org"]);
  check_state_v2(addons);
});

// Upgrade to version 3 which will appDisable addons
// upgradeable1x2-3 and override1x2-1x3
// Only the newly disabled add-ons should be passed to the
// upgrade window
add_task(async function run_test_1() {
  gCheckUpdates = true;
  WindowWatcher.expected = true;

  await promiseRestartManager("3");
  check_startup_changes("installed", []);
  check_startup_changes("updated", []);
  check_startup_changes("uninstalled", []);
  check_startup_changes("disabled", ["upgradeable1x2-3@tests.mozilla.org"]);
  check_startup_changes("enabled", []);
  Assert.ok(!WindowWatcher.expected);
  gCheckUpdates = false;

  let addons = await promiseAddonsByIDs(["min1max1@tests.mozilla.org",
                                         "min1max2@tests.mozilla.org",
                                         "upgradeable1x2-3@tests.mozilla.org",
                                         "min1max3@tests.mozilla.org",
                                         "min1max3b@tests.mozilla.org",
                                         "override1x2-1x3@tests.mozilla.org"]);
  check_state_v3(addons);

  Assert.equal(WindowWatcher.args.length, 2);
  Assert.ok(WindowWatcher.args.indexOf("upgradeable1x2-3@tests.mozilla.org") >= 0);
  Assert.ok(WindowWatcher.args.indexOf("override1x2-1x3@tests.mozilla.org") >= 0);
});

// Downgrade to version 2 which will remove appDisable from two add-ons
// Still displays the compat window, because metadata is not recently updated
add_task(async function run_test_2() {
  WindowWatcher.expected = true;
  await promiseRestartManager("2");
  check_startup_changes("installed", []);
  check_startup_changes("updated", []);
  check_startup_changes("uninstalled", []);
  check_startup_changes("disabled", []);
  check_startup_changes("enabled", ["upgradeable1x2-3@tests.mozilla.org"]);
  Assert.ok(!WindowWatcher.expected);

  let addons = await promiseAddonsByIDs(["min1max1@tests.mozilla.org",
                                         "min1max2@tests.mozilla.org",
                                         "upgradeable1x2-3@tests.mozilla.org",
                                         "min1max3@tests.mozilla.org",
                                         "min1max3b@tests.mozilla.org",
                                         "override1x2-1x3@tests.mozilla.org"]);
  check_state_v2(addons);
});

// Upgrade back to version 3 which should only appDisable
// upgradeable1x2-3, because we already have the override
// stored in our DB for override1x2-1x3. Ensure that when
// the upgrade dialog updates an add-on no restart is necessary
add_task(async function run_test_5() {
  Services.prefs.setBoolPref(PREF_EM_SHOW_MISMATCH_UI, true);
  // tell the mock compatibility window to install the available upgrade
  gInstallUpdate = true;

  WindowWatcher.expected = true;
  await promiseRestartManager("3");
  check_startup_changes("installed", []);
  check_startup_changes("updated", ["upgradeable1x2-3@tests.mozilla.org"]);
  check_startup_changes("uninstalled", []);
  check_startup_changes("disabled", []);
  check_startup_changes("enabled", []);
  Assert.ok(!WindowWatcher.expected);
  gInstallUpdate = false;

  let addons = await promiseAddonsByIDs(["min1max1@tests.mozilla.org",
                                         "min1max2@tests.mozilla.org",
                                         "upgradeable1x2-3@tests.mozilla.org",
                                         "min1max3@tests.mozilla.org",
                                         "min1max3b@tests.mozilla.org",
                                         "override1x2-1x3@tests.mozilla.org"]);
  check_state_v3_2(addons);

  Assert.equal(WindowWatcher.args.length, 1);
  Assert.ok(WindowWatcher.args.indexOf("upgradeable1x2-3@tests.mozilla.org") >= 0);
});

// Downgrade to version 1 which will appEnable all the add-ons
// except upgradeable1x2-3; the update we installed isn't compatible with 1
add_task(async function run_test_6() {
  WindowWatcher.expected = true;
  await promiseRestartManager("1");
  check_startup_changes("installed", []);
  check_startup_changes("updated", []);
  check_startup_changes("uninstalled", []);
  check_startup_changes("disabled", ["upgradeable1x2-3@tests.mozilla.org"]);
  check_startup_changes("enabled", ["min1max1@tests.mozilla.org"]);
  Assert.ok(!WindowWatcher.expected);

  let addons = await promiseAddonsByIDs(["min1max1@tests.mozilla.org",
                                         "min1max2@tests.mozilla.org",
                                         "upgradeable1x2-3@tests.mozilla.org",
                                         "min1max3@tests.mozilla.org",
                                         "min1max3b@tests.mozilla.org",
                                         "override1x2-1x3@tests.mozilla.org"]);
  check_state_v1_2(addons);
});
