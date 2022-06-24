/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/
 */

// This verifies that language packs can be used without restarts.
ChromeUtils.import("resource://gre/modules/Services.jsm");

// Enable loading extensions from the user scopes
Services.prefs.setIntPref("extensions.enabledScopes",
                          AddonManager.SCOPE_PROFILE + AddonManager.SCOPE_USER);
// Enable installing distribution add-ons
Services.prefs.setBoolPref("extensions.installDistroAddons", true);

createAppInfo("xpcshell@tests.mozilla.org", "XPCShell", "1", "1.9.2");

const profileDir = gProfD.clone();
profileDir.append("extensions");
const userExtDir = gProfD.clone();
userExtDir.append("extensions2");
userExtDir.append(gAppInfo.ID);
registerDirectory("XREUSysExt", userExtDir.parent);
const distroDir = gProfD.clone();
distroDir.append("distribution");
distroDir.append("extensions");
registerDirectory("XREAppDist", distroDir.parent);

var chrome = Cc["@mozilla.org/chrome/chrome-registry;1"]
  .getService(Ci.nsIXULChromeRegistry);

function do_unregister_manifest() {
  let path = getFileForAddon(profileDir, "langpack-x-testing@tests.mozilla.org");
  Components.manager.removeBootstrappedManifestLocation(path);
}

function do_check_locale_not_registered(provider) {
  let didThrow = false;
  try {
    chrome.getSelectedLocale(provider);
  } catch (e) {
    didThrow = true;
  }
  Assert.ok(didThrow);
}

function run_test() {
  do_test_pending();

  startupManager();

  run_test_1();
}

// Tests that installing doesn't require a restart
function run_test_1() {
  do_check_locale_not_registered("test-langpack");

  prepare_test({ }, [
    "onNewInstall"
  ]);

  AddonManager.getInstallForFile(do_get_addon("test_langpack"), function(install) {
    ensure_test_completed();

    Assert.notEqual(install, null);
    Assert.equal(install.type, "locale");
    Assert.equal(install.version, "1.0");
    Assert.equal(install.name, "Language Pack x-testing");
    Assert.equal(install.state, AddonManager.STATE_DOWNLOADED);
    Assert.ok(install.addon.hasResource("install.rdf"));
    Assert.ok(!install.addon.hasResource("bootstrap.js"));
    Assert.equal(install.addon.operationsRequiringRestart &
                 AddonManager.OP_NEEDS_RESTART_INSTALL, 0);

    let addon = install.addon;
    prepare_test({
      "langpack-x-testing@tests.mozilla.org": [
        ["onInstalling", false],
        "onInstalled"
      ]
    }, [
      "onInstallStarted",
      "onInstallEnded",
    ], function() {
      Assert.ok(addon.hasResource("install.rdf"));
      // spin to let the startup complete
      executeSoon(check_test_1);
    });
    install.install();
  });
}

function check_test_1() {
  AddonManager.getAllInstalls(function(installs) {
    // There should be no active installs now since the install completed and
    // doesn't require a restart.
    Assert.equal(installs.length, 0);

    AddonManager.getAddonByID("langpack-x-testing@tests.mozilla.org", function(b1) {
      Assert.notEqual(b1, null);
      Assert.equal(b1.version, "1.0");
      Assert.ok(!b1.appDisabled);
      Assert.ok(!b1.userDisabled);
      Assert.ok(b1.isActive);
      // check chrome reg that language pack is registered
      Assert.equal(chrome.getSelectedLocale("test-langpack"), "x-testing");
      Assert.ok(b1.hasResource("install.rdf"));
      Assert.ok(!b1.hasResource("bootstrap.js"));

      AddonManager.getAddonsWithOperationsByTypes(null, function(list) {
        Assert.equal(list.length, 0);

        run_test_2();
      });
    });
  });
}

// Tests that disabling doesn't require a restart
function run_test_2() {
  AddonManager.getAddonByID("langpack-x-testing@tests.mozilla.org", function(b1) {
    prepare_test({
      "langpack-x-testing@tests.mozilla.org": [
        ["onDisabling", false],
        "onDisabled"
      ]
    });

    Assert.equal(b1.operationsRequiringRestart &
                AddonManager.OP_NEEDS_RESTART_DISABLE, 0);
    b1.userDisabled = true;
    ensure_test_completed();

    Assert.notEqual(b1, null);
    Assert.equal(b1.version, "1.0");
    Assert.ok(!b1.appDisabled);
    Assert.ok(b1.userDisabled);
    Assert.ok(!b1.isActive);
    // check chrome reg that language pack is not registered
    do_check_locale_not_registered("test-langpack");

    AddonManager.getAddonByID("langpack-x-testing@tests.mozilla.org", function(newb1) {
      Assert.notEqual(newb1, null);
      Assert.equal(newb1.version, "1.0");
      Assert.ok(!newb1.appDisabled);
      Assert.ok(newb1.userDisabled);
      Assert.ok(!newb1.isActive);

      executeSoon(run_test_3);
    });
  });
}

// Test that restarting doesn't accidentally re-enable
function run_test_3() {
  shutdownManager();
  startupManager(false);
  // check chrome reg that language pack is not registered
  do_check_locale_not_registered("test-langpack");

  AddonManager.getAddonByID("langpack-x-testing@tests.mozilla.org", function(b1) {
    Assert.notEqual(b1, null);
    Assert.equal(b1.version, "1.0");
    Assert.ok(!b1.appDisabled);
    Assert.ok(b1.userDisabled);
    Assert.ok(!b1.isActive);

    run_test_4();
  });
}

// Tests that enabling doesn't require a restart
function run_test_4() {
  AddonManager.getAddonByID("langpack-x-testing@tests.mozilla.org", function(b1) {
    prepare_test({
      "langpack-x-testing@tests.mozilla.org": [
        ["onEnabling", false],
        "onEnabled"
      ]
    });

    Assert.equal(b1.operationsRequiringRestart &
                 AddonManager.OP_NEEDS_RESTART_ENABLE, 0);
    b1.userDisabled = false;
    ensure_test_completed();

    Assert.notEqual(b1, null);
    Assert.equal(b1.version, "1.0");
    Assert.ok(!b1.appDisabled);
    Assert.ok(!b1.userDisabled);
    Assert.ok(b1.isActive);
    // check chrome reg that language pack is registered
    Assert.equal(chrome.getSelectedLocale("test-langpack"), "x-testing");

    AddonManager.getAddonByID("langpack-x-testing@tests.mozilla.org", function(newb1) {
      Assert.notEqual(newb1, null);
      Assert.equal(newb1.version, "1.0");
      Assert.ok(!newb1.appDisabled);
      Assert.ok(!newb1.userDisabled);
      Assert.ok(newb1.isActive);

      executeSoon(run_test_5);
    });
  });
}

// Tests that a restart shuts down and restarts the add-on
function run_test_5() {
  shutdownManager();
  do_unregister_manifest();
  // check chrome reg that language pack is not registered
  do_check_locale_not_registered("test-langpack");
  startupManager(false);
  // check chrome reg that language pack is registered
  Assert.equal(chrome.getSelectedLocale("test-langpack"), "x-testing");

  AddonManager.getAddonByID("langpack-x-testing@tests.mozilla.org", function(b1) {
    Assert.notEqual(b1, null);
    Assert.equal(b1.version, "1.0");
    Assert.ok(!b1.appDisabled);
    Assert.ok(!b1.userDisabled);
    Assert.ok(b1.isActive);
    Assert.ok(!isExtensionInAddonsList(profileDir, b1.id));

    run_test_7();
  });
}

// Tests that uninstalling doesn't require a restart
function run_test_7() {
  AddonManager.getAddonByID("langpack-x-testing@tests.mozilla.org", function(b1) {
    prepare_test({
      "langpack-x-testing@tests.mozilla.org": [
        ["onUninstalling", false],
        "onUninstalled"
      ]
    });

    Assert.equal(b1.operationsRequiringRestart &
                 AddonManager.OP_NEEDS_RESTART_UNINSTALL, 0);
    b1.uninstall();

    check_test_7();
  });
}

function check_test_7() {
  ensure_test_completed();
  // check chrome reg that language pack is not registered
  do_check_locale_not_registered("test-langpack");

  AddonManager.getAddonByID("langpack-x-testing@tests.mozilla.org",
   callback_soon(function(b1) {
    Assert.equal(b1, null);

    restartManager();

    AddonManager.getAddonByID("langpack-x-testing@tests.mozilla.org", function(newb1) {
      Assert.equal(newb1, null);

      executeSoon(run_test_8);
    });
  }));
}

// Tests that a locale detected in the profile starts working immediately
function run_test_8() {
  shutdownManager();

  manuallyInstall(do_get_addon("test_langpack"), profileDir, "langpack-x-testing@tests.mozilla.org");

  startupManager(false);

  AddonManager.getAddonByID("langpack-x-testing@tests.mozilla.org",
   callback_soon(function(b1) {
    Assert.notEqual(b1, null);
    Assert.equal(b1.version, "1.0");
    Assert.ok(!b1.appDisabled);
    Assert.ok(!b1.userDisabled);
    Assert.ok(b1.isActive);
    // check chrome reg that language pack is registered
    Assert.equal(chrome.getSelectedLocale("test-langpack"), "x-testing");
    Assert.ok(b1.hasResource("install.rdf"));
    Assert.ok(!b1.hasResource("bootstrap.js"));

    shutdownManager();
    do_unregister_manifest();
    // check chrome reg that language pack is not registered
    do_check_locale_not_registered("test-langpack");
    startupManager(false);
    // check chrome reg that language pack is registered
    Assert.equal(chrome.getSelectedLocale("test-langpack"), "x-testing");

    AddonManager.getAddonByID("langpack-x-testing@tests.mozilla.org", function(b2) {
      prepare_test({
        "langpack-x-testing@tests.mozilla.org": [
          ["onUninstalling", false],
          "onUninstalled"
        ]
      });

      b2.uninstall();
      ensure_test_completed();
      executeSoon(run_test_9);
    });
  }));
}

// Tests that a locale from distribution/extensions gets installed and starts
// working immediately
function run_test_9() {
  shutdownManager();
  manuallyInstall(do_get_addon("test_langpack"), distroDir, "langpack-x-testing@tests.mozilla.org");
  gAppInfo.version = "2.0";
  startupManager(true);

  AddonManager.getAddonByID("langpack-x-testing@tests.mozilla.org", callback_soon(function(b1) {
    Assert.notEqual(b1, null);
    Assert.equal(b1.version, "1.0");
    Assert.ok(!b1.appDisabled);
    Assert.ok(!b1.userDisabled);
    Assert.ok(b1.isActive);
    // check chrome reg that language pack is registered
    Assert.equal(chrome.getSelectedLocale("test-langpack"), "x-testing");
    Assert.ok(b1.hasResource("install.rdf"));
    Assert.ok(!b1.hasResource("bootstrap.js"));

    shutdownManager();
    do_unregister_manifest();
    // check chrome reg that language pack is not registered
    do_check_locale_not_registered("test-langpack");
    startupManager(false);
    // check chrome reg that language pack is registered
    Assert.equal(chrome.getSelectedLocale("test-langpack"), "x-testing");

    do_test_finished();
  }));
}
