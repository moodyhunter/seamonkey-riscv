/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/
 */

// This verifies that the themes switch as expected

const PREF_GENERAL_SKINS_SELECTEDSKIN = "general.skins.selectedSkin";

const profileDir = gProfD.clone();
profileDir.append("extensions");

async function run_test() {
  do_test_pending();
  createAppInfo("xpcshell@tests.mozilla.org", "XPCShell", "1", "1.9.2");

  writeInstallRDFForExtension({
    id: "default@tests.mozilla.org",
    version: "1.0",
    name: "Default",
    internalName: "classic/1.0",
    targetApplications: [{
      id: "xpcshell@tests.mozilla.org",
      minVersion: "1",
      maxVersion: "2"
    }]
  }, profileDir);

  writeInstallRDFForExtension({
    id: "alternate@tests.mozilla.org",
    version: "1.0",
    name: "Test 1",
    type: 4,
    internalName: "alternate/1.0",
    targetApplications: [{
      id: "xpcshell@tests.mozilla.org",
      minVersion: "1",
      maxVersion: "2"
    }]
  }, profileDir);

  await promiseStartupManager();

  Assert.equal(Services.prefs.getCharPref(PREF_GENERAL_SKINS_SELECTEDSKIN), "classic/1.0");

  AddonManager.getAddonsByIDs(["default@tests.mozilla.org",
                               "alternate@tests.mozilla.org"], function([d, a]) {
    Assert.notEqual(d, null);
    Assert.ok(!d.userDisabled);
    Assert.ok(!d.appDisabled);
    Assert.ok(d.isActive);
    Assert.ok(isThemeInAddonsList(profileDir, d.id));
    Assert.ok(!hasFlag(d.permissions, AddonManager.PERM_CAN_DISABLE));
    Assert.ok(!hasFlag(d.permissions, AddonManager.PERM_CAN_ENABLE));

    Assert.notEqual(a, null);
    Assert.ok(a.userDisabled);
    Assert.ok(!a.appDisabled);
    Assert.ok(!a.isActive);
    Assert.ok(!isThemeInAddonsList(profileDir, a.id));
    Assert.ok(!hasFlag(a.permissions, AddonManager.PERM_CAN_DISABLE));
    Assert.ok(hasFlag(a.permissions, AddonManager.PERM_CAN_ENABLE));

    run_test_1(d, a);
  });
}

function end_test() {
  executeSoon(do_test_finished);
}

// Checks switching to a different theme and back again leaves everything the
// same
function run_test_1(d, a) {
  a.userDisabled = false;

  Assert.ok(d.userDisabled);
  Assert.ok(!d.appDisabled);
  Assert.ok(d.isActive);
  Assert.ok(isThemeInAddonsList(profileDir, d.id));
  Assert.ok(!hasFlag(d.permissions, AddonManager.PERM_CAN_DISABLE));
  Assert.ok(hasFlag(d.permissions, AddonManager.PERM_CAN_ENABLE));

  Assert.ok(!a.userDisabled);
  Assert.ok(!a.appDisabled);
  Assert.ok(!a.isActive);
  Assert.ok(!isThemeInAddonsList(profileDir, a.id));
  Assert.ok(!hasFlag(a.permissions, AddonManager.PERM_CAN_DISABLE));
  Assert.ok(!hasFlag(a.permissions, AddonManager.PERM_CAN_ENABLE));

  Assert.equal(Services.prefs.getCharPref(PREF_GENERAL_SKINS_SELECTEDSKIN), "classic/1.0");

  d.userDisabled = false;

  Assert.ok(!d.userDisabled);
  Assert.ok(!d.appDisabled);
  Assert.ok(d.isActive);
  Assert.ok(isThemeInAddonsList(profileDir, d.id));
  Assert.ok(!hasFlag(d.permissions, AddonManager.PERM_CAN_DISABLE));
  Assert.ok(!hasFlag(d.permissions, AddonManager.PERM_CAN_ENABLE));

  Assert.ok(a.userDisabled);
  Assert.ok(!a.appDisabled);
  Assert.ok(!a.isActive);
  Assert.ok(!isThemeInAddonsList(profileDir, a.id));
  Assert.ok(!hasFlag(a.permissions, AddonManager.PERM_CAN_DISABLE));
  Assert.ok(hasFlag(a.permissions, AddonManager.PERM_CAN_ENABLE));

  Assert.equal(Services.prefs.getCharPref(PREF_GENERAL_SKINS_SELECTEDSKIN), "classic/1.0");

  executeSoon(run_test_2);
}

// Tests that after the restart themes can be changed as expected
function run_test_2() {
  restartManager();
  AddonManager.getAddonsByIDs(["default@tests.mozilla.org",
                               "alternate@tests.mozilla.org"], function([d, a]) {
    Assert.equal(Services.prefs.getCharPref(PREF_GENERAL_SKINS_SELECTEDSKIN), "classic/1.0");

    Assert.notEqual(d, null);
    Assert.ok(!d.userDisabled);
    Assert.ok(!d.appDisabled);
    Assert.ok(d.isActive);
    Assert.ok(isThemeInAddonsList(profileDir, d.id));
    Assert.ok(!hasFlag(d.permissions, AddonManager.PERM_CAN_DISABLE));
    Assert.ok(!hasFlag(d.permissions, AddonManager.PERM_CAN_ENABLE));

    Assert.notEqual(a, null);
    Assert.ok(a.userDisabled);
    Assert.ok(!a.appDisabled);
    Assert.ok(!a.isActive);
    Assert.ok(!isThemeInAddonsList(profileDir, a.id));
    Assert.ok(!hasFlag(a.permissions, AddonManager.PERM_CAN_DISABLE));
    Assert.ok(hasFlag(a.permissions, AddonManager.PERM_CAN_ENABLE));

    Assert.equal(Services.prefs.getCharPref(PREF_GENERAL_SKINS_SELECTEDSKIN), "classic/1.0");

    a.userDisabled = false;

    Assert.ok(d.userDisabled);
    Assert.ok(!d.appDisabled);
    Assert.ok(d.isActive);
    Assert.ok(isThemeInAddonsList(profileDir, d.id));
    Assert.ok(!hasFlag(d.permissions, AddonManager.PERM_CAN_DISABLE));
    Assert.ok(hasFlag(d.permissions, AddonManager.PERM_CAN_ENABLE));

    Assert.ok(!a.userDisabled);
    Assert.ok(!a.appDisabled);
    Assert.ok(!a.isActive);
    Assert.ok(!isThemeInAddonsList(profileDir, a.id));
    Assert.ok(!hasFlag(a.permissions, AddonManager.PERM_CAN_DISABLE));
    Assert.ok(!hasFlag(a.permissions, AddonManager.PERM_CAN_ENABLE));

    Assert.equal(Services.prefs.getCharPref(PREF_GENERAL_SKINS_SELECTEDSKIN), "classic/1.0");

    d.userDisabled = false;

    Assert.ok(!d.userDisabled);
    Assert.ok(!d.appDisabled);
    Assert.ok(d.isActive);
    Assert.ok(isThemeInAddonsList(profileDir, d.id));
    Assert.ok(!hasFlag(d.permissions, AddonManager.PERM_CAN_DISABLE));
    Assert.ok(!hasFlag(d.permissions, AddonManager.PERM_CAN_ENABLE));

    Assert.ok(a.userDisabled);
    Assert.ok(!a.appDisabled);
    Assert.ok(!a.isActive);
    Assert.ok(!isThemeInAddonsList(profileDir, a.id));
    Assert.ok(!hasFlag(a.permissions, AddonManager.PERM_CAN_DISABLE));
    Assert.ok(hasFlag(a.permissions, AddonManager.PERM_CAN_ENABLE));

    Assert.equal(Services.prefs.getCharPref(PREF_GENERAL_SKINS_SELECTEDSKIN), "classic/1.0");

    a.userDisabled = false;

    Assert.ok(d.userDisabled);
    Assert.ok(!d.appDisabled);
    Assert.ok(d.isActive);
    Assert.ok(isThemeInAddonsList(profileDir, d.id));
    Assert.ok(!hasFlag(d.permissions, AddonManager.PERM_CAN_DISABLE));
    Assert.ok(hasFlag(d.permissions, AddonManager.PERM_CAN_ENABLE));

    Assert.ok(!a.userDisabled);
    Assert.ok(!a.appDisabled);
    Assert.ok(!a.isActive);
    Assert.ok(!isThemeInAddonsList(profileDir, a.id));
    Assert.ok(!hasFlag(a.permissions, AddonManager.PERM_CAN_DISABLE));
    Assert.ok(!hasFlag(a.permissions, AddonManager.PERM_CAN_ENABLE));

    Assert.equal(Services.prefs.getCharPref(PREF_GENERAL_SKINS_SELECTEDSKIN), "classic/1.0");

    executeSoon(check_test_2);
  });
}

function check_test_2() {
  restartManager();
  AddonManager.getAddonsByIDs(["default@tests.mozilla.org",
                               "alternate@tests.mozilla.org"], callback_soon(function([d, a]) {
    Assert.equal(Services.prefs.getCharPref(PREF_GENERAL_SKINS_SELECTEDSKIN), "alternate/1.0");

    Assert.ok(d.userDisabled);
    Assert.ok(!d.appDisabled);
    Assert.ok(!d.isActive);
    Assert.ok(!isThemeInAddonsList(profileDir, d.id));
    Assert.ok(!hasFlag(d.permissions, AddonManager.PERM_CAN_DISABLE));
    Assert.ok(hasFlag(d.permissions, AddonManager.PERM_CAN_ENABLE));

    Assert.ok(!a.userDisabled);
    Assert.ok(!a.appDisabled);
    Assert.ok(a.isActive);
    Assert.ok(isThemeInAddonsList(profileDir, a.id));
    Assert.ok(!hasFlag(a.permissions, AddonManager.PERM_CAN_DISABLE));
    Assert.ok(!hasFlag(a.permissions, AddonManager.PERM_CAN_ENABLE));

    d.userDisabled = false;

    Assert.ok(!d.userDisabled);
    Assert.ok(!d.appDisabled);
    Assert.ok(!d.isActive);
    Assert.ok(!isThemeInAddonsList(profileDir, d.id));
    Assert.ok(!hasFlag(d.permissions, AddonManager.PERM_CAN_DISABLE));
    Assert.ok(!hasFlag(d.permissions, AddonManager.PERM_CAN_ENABLE));

    Assert.ok(a.userDisabled);
    Assert.ok(!a.appDisabled);
    Assert.ok(a.isActive);
    Assert.ok(isThemeInAddonsList(profileDir, a.id));
    Assert.ok(!hasFlag(a.permissions, AddonManager.PERM_CAN_DISABLE));
    Assert.ok(hasFlag(a.permissions, AddonManager.PERM_CAN_ENABLE));

    Assert.equal(Services.prefs.getCharPref(PREF_GENERAL_SKINS_SELECTEDSKIN), "alternate/1.0");

    restartManager();

    Assert.equal(Services.prefs.getCharPref(PREF_GENERAL_SKINS_SELECTEDSKIN), "classic/1.0");

    AddonManager.getAddonsByIDs(["default@tests.mozilla.org",
                                 "alternate@tests.mozilla.org"], function([d2, a2]) {
      Assert.notEqual(d2, null);
      Assert.ok(!d2.userDisabled);
      Assert.ok(!d2.appDisabled);
      Assert.ok(d2.isActive);
      Assert.ok(isThemeInAddonsList(profileDir, d2.id));
      Assert.ok(!hasFlag(d2.permissions, AddonManager.PERM_CAN_DISABLE));
      Assert.ok(!hasFlag(d2.permissions, AddonManager.PERM_CAN_ENABLE));

      Assert.notEqual(a2, null);
      Assert.ok(a2.userDisabled);
      Assert.ok(!a2.appDisabled);
      Assert.ok(!a2.isActive);
      Assert.ok(!isThemeInAddonsList(profileDir, a2.id));
      Assert.ok(!hasFlag(a2.permissions, AddonManager.PERM_CAN_DISABLE));
      Assert.ok(hasFlag(a2.permissions, AddonManager.PERM_CAN_ENABLE));

      end_test();
    });
  }));
}
