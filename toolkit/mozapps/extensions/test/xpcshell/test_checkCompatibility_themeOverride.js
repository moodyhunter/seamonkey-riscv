/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/
 */

// This verifies that the (temporary)
// extensions.checkCompatibility.temporaryThemeOverride_minAppVersion
// preference works.

var ADDONS = [{
  id: "addon1@tests.mozilla.org",
  type: 4,
  internalName: "theme1/1.0",
  version: "1.0",
  name: "Test 1",
  targetApplications: [{
    id: "xpcshell@tests.mozilla.org",
    minVersion: "1.0",
    maxVersion: "1.0"
  }]
}, {
  id: "addon2@tests.mozilla.org",
  type: 4,
  internalName: "theme2/1.0",
  version: "1.0",
  name: "Test 2",
  targetApplications: [{
    id: "xpcshell@tests.mozilla.org",
    minVersion: "2.0",
    maxVersion: "2.0"
  }]
}];

const profileDir = gProfD.clone();
profileDir.append("extensions");


function run_test() {
  do_test_pending();
  createAppInfo("xpcshell@tests.mozilla.org", "XPCShell", "3.0", "1");

  for (let a of ADDONS) {
    writeInstallRDFForExtension(a, profileDir);
  }

  startupManager();

  run_test_1();
}

function run_test_1() {
  AddonManager.getAddonsByIDs(["addon1@tests.mozilla.org",
                               "addon2@tests.mozilla.org"],
                               function([a1, a2]) {

    Assert.notEqual(a1, null);
    Assert.ok(!a1.isActive);
    Assert.ok(!a1.isCompatible);
    Assert.ok(a1.appDisabled);

    Assert.notEqual(a2, null);
    Assert.ok(!a2.isActive);
    Assert.ok(!a2.isCompatible);
    Assert.ok(a1.appDisabled);

    executeSoon(run_test_2);
  });
}

function run_test_2() {
  Services.prefs.setCharPref("extensions.checkCompatibility.temporaryThemeOverride_minAppVersion", "2.0");
  if (isNightlyChannel())
    Services.prefs.setBoolPref("extensions.checkCompatibility.nightly", false);
  else
    Services.prefs.setBoolPref("extensions.checkCompatibility.3.0", false);
  restartManager();

  AddonManager.getAddonsByIDs(["addon1@tests.mozilla.org",
                               "addon2@tests.mozilla.org"],
                               function([a1, a2]) {

    Assert.notEqual(a1, null);
    Assert.ok(!a1.isActive);
    Assert.ok(!a1.isCompatible);
    Assert.ok(a1.appDisabled);

    Assert.notEqual(a2, null);
    Assert.ok(!a2.isActive);
    Assert.ok(!a2.isCompatible);
    Assert.ok(!a2.appDisabled);

    executeSoon(do_test_finished);
  });
}
