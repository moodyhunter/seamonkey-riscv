/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/
 */

const ID = "bootstrap1@tests.mozilla.org";
const ID2 = "bootstrap2@tests.mozilla.org";
const ID3 = "bootstrap3@tests.mozilla.org";

const APP_STARTUP   = 1;
const ADDON_INSTALL = 5;

function getStartupReason(id) {
  let info = BootstrapMonitor.started.get(id);
  return info ? info.reason : undefined;
}

BootstrapMonitor.init();

createAppInfo("xpcshell@tests.mozilla.org", "XPCShell", "1", "1.9.2");

startupManager();

function check_multi_disabled() {
  return Services.prefs.getBoolPref("extensions.e10sMultiBlockedByAddons", false);
}

async function check_normal(checkMultiDisabled) {
  let install = await promiseInstallFile(do_get_addon("test_bootstrap1_1"));
  Assert.equal(install.state, AddonManager.STATE_INSTALLED);
  Assert.ok(!hasFlag(install.addon.pendingOperations, AddonManager.PENDING_INSTALL));

  BootstrapMonitor.checkAddonInstalled(ID);
  BootstrapMonitor.checkAddonStarted(ID);

  let addon = await promiseAddonByID(ID);
  Assert.equal(addon, install.addon);

  if (checkMultiDisabled) {
    Assert.ok(!check_multi_disabled());
  }

  Assert.ok(!hasFlag(addon.operationsRequiringRestart, AddonManager.OP_NEEDS_RESTART_DISABLE));
  addon.userDisabled = true;
  BootstrapMonitor.checkAddonNotStarted(ID);
  Assert.ok(!addon.isActive);
  Assert.ok(!hasFlag(addon.pendingOperations, AddonManager.PENDING_DISABLE));

  Assert.ok(!hasFlag(addon.operationsRequiringRestart, AddonManager.OP_NEEDS_RESTART_ENABLE));
  addon.userDisabled = false;
  BootstrapMonitor.checkAddonStarted(ID);
  Assert.ok(addon.isActive);
  Assert.ok(!hasFlag(addon.pendingOperations, AddonManager.PENDING_ENABLE));

  Assert.ok(!hasFlag(addon.operationsRequiringRestart, AddonManager.OP_NEEDS_RESTART_UNINSTALL));
  addon.uninstall();
  BootstrapMonitor.checkAddonNotStarted(ID);
  BootstrapMonitor.checkAddonNotInstalled(ID);

  await promiseRestartManager();
}

// Installing the add-on normally doesn't require a restart
add_task(async function() {
  gAppInfo.browserTabsRemoteAutostart = false;
  Services.prefs.setBoolPref("extensions.e10sBlocksEnabling", false);

  await check_normal();
});

// Enabling the pref doesn't change anything
add_task(async function() {
  gAppInfo.browserTabsRemoteAutostart = false;
  Services.prefs.setBoolPref("extensions.e10sBlocksEnabling", true);

  await check_normal();
});

// Default e10s doesn't change anything
add_task(async function() {
  gAppInfo.browserTabsRemoteAutostart = true;
  Services.prefs.setBoolPref("extensions.e10sBlocksEnabling", false);

  await check_normal();
});

// Pref and e10s blocks install
add_task(async function() {
  gAppInfo.browserTabsRemoteAutostart = true;
  Services.prefs.setBoolPref("extensions.e10sBlocksEnabling", true);

  let install = await promiseInstallFile(do_get_addon("test_bootstrap1_1"));
  Assert.equal(install.state, AddonManager.STATE_INSTALLED);
  Assert.ok(hasFlag(install.addon.pendingOperations, AddonManager.PENDING_INSTALL));
  Assert.ok(!check_multi_disabled());

  let addon = await promiseAddonByID(ID);
  Assert.equal(addon, null);

  await promiseRestartManager();

  BootstrapMonitor.checkAddonInstalled(ID);
  BootstrapMonitor.checkAddonStarted(ID);
  Assert.equal(getStartupReason(ID), ADDON_INSTALL);

  addon = await promiseAddonByID(ID);
  Assert.notEqual(addon, null);
  Assert.ok(check_multi_disabled());

  Assert.ok(!hasFlag(addon.operationsRequiringRestart, AddonManager.OP_NEEDS_RESTART_DISABLE));
  addon.userDisabled = true;
  BootstrapMonitor.checkAddonNotStarted(ID);
  Assert.ok(!addon.isActive);
  Assert.ok(!hasFlag(addon.pendingOperations, AddonManager.PENDING_DISABLE));
  Assert.ok(!check_multi_disabled());

  Assert.ok(hasFlag(addon.operationsRequiringRestart, AddonManager.OP_NEEDS_RESTART_ENABLE));
  addon.userDisabled = false;
  BootstrapMonitor.checkAddonNotStarted(ID);
  Assert.ok(!addon.isActive);
  Assert.ok(hasFlag(addon.pendingOperations, AddonManager.PENDING_ENABLE));

  await promiseRestartManager();

  addon = await promiseAddonByID(ID);
  Assert.notEqual(addon, null);

  Assert.ok(addon.isActive);
  BootstrapMonitor.checkAddonStarted(ID);

  Assert.ok(!hasFlag(addon.operationsRequiringRestart, AddonManager.OP_NEEDS_RESTART_UNINSTALL));
  Assert.ok(check_multi_disabled());
  addon.uninstall();
  BootstrapMonitor.checkAddonNotStarted(ID);
  BootstrapMonitor.checkAddonNotInstalled(ID);

  await promiseRestartManager();
});

add_task(async function() {
  gAppInfo.browserTabsRemoteAutostart = true;
  Services.prefs.setBoolPref("extensions.e10sBlocksEnabling", true);

  let install = await promiseInstallFile(do_get_addon("test_bootstrap1_1"));
  Assert.equal(install.state, AddonManager.STATE_INSTALLED);
  Assert.ok(hasFlag(install.addon.pendingOperations, AddonManager.PENDING_INSTALL));
  Assert.ok(!check_multi_disabled());

  let addon = await promiseAddonByID(ID);
  Assert.equal(addon, null);

  await promiseRestartManager();

  // After install and restart we should block.
  let blocked = Services.prefs.getBoolPref("extensions.e10sBlockedByAddons");
  Assert.ok(blocked);
  Assert.ok(check_multi_disabled());

  BootstrapMonitor.checkAddonInstalled(ID);
  BootstrapMonitor.checkAddonStarted(ID);
  Assert.equal(getStartupReason(ID), ADDON_INSTALL);

  addon = await promiseAddonByID(ID);
  Assert.notEqual(addon, null);

  Assert.ok(!hasFlag(addon.operationsRequiringRestart, AddonManager.OP_NEEDS_RESTART_DISABLE));
  addon.userDisabled = true;
  BootstrapMonitor.checkAddonNotStarted(ID);
  Assert.ok(!addon.isActive);
  Assert.ok(!hasFlag(addon.pendingOperations, AddonManager.PENDING_DISABLE));
  Assert.ok(hasFlag(addon.operationsRequiringRestart, AddonManager.OP_NEEDS_RESTART_ENABLE));

  await promiseRestartManager();

  // After disable and restart we should not block.
  blocked = Services.prefs.getBoolPref("extensions.e10sBlockedByAddons");
  Assert.ok(!blocked);
  Assert.ok(!check_multi_disabled());

  addon = await promiseAddonByID(ID);
  addon.userDisabled = false;
  BootstrapMonitor.checkAddonNotStarted(ID);
  Assert.ok(!addon.isActive);
  Assert.ok(hasFlag(addon.pendingOperations, AddonManager.PENDING_ENABLE));

  await promiseRestartManager();

  // After re-enable and restart we should block.
  blocked = Services.prefs.getBoolPref("extensions.e10sBlockedByAddons");
  Assert.ok(blocked);
  Assert.ok(check_multi_disabled());

  addon = await promiseAddonByID(ID);
  Assert.notEqual(addon, null);

  Assert.ok(addon.isActive);
  BootstrapMonitor.checkAddonStarted(ID);
  // This should probably be ADDON_ENABLE, but its not easy to make
  // that happen.  See bug 1304392 for discussion.
  Assert.equal(getStartupReason(ID), APP_STARTUP);

  Assert.ok(!hasFlag(addon.operationsRequiringRestart, AddonManager.OP_NEEDS_RESTART_UNINSTALL));
  addon.uninstall();
  BootstrapMonitor.checkAddonNotStarted(ID);
  BootstrapMonitor.checkAddonNotInstalled(ID);

  await promiseRestartManager();

  // After uninstall and restart we should not block.
  blocked = Services.prefs.getBoolPref("extensions.e10sBlockedByAddons");
  Assert.ok(!blocked);
  Assert.ok(!check_multi_disabled());

  restartManager();
});

add_task(async function() {
  gAppInfo.browserTabsRemoteAutostart = true;
  Services.prefs.setBoolPref("extensions.e10sBlocksEnabling", true);

  let [install1, install2] = await Promise.all([
    promiseInstallFile(do_get_addon("test_bootstrap1_1")),
    promiseInstallFile(do_get_addon("test_bootstrap2_1")),
  ]);

  Assert.equal(install1.state, AddonManager.STATE_INSTALLED);
  Assert.equal(install2.state, AddonManager.STATE_INSTALLED);
  Assert.ok(hasFlag(install1.addon.pendingOperations, AddonManager.PENDING_INSTALL));
  Assert.ok(hasFlag(install2.addon.pendingOperations, AddonManager.PENDING_INSTALL));

  let addon = await promiseAddonByID(ID);
  let addon2 = await promiseAddonByID(ID2);

  Assert.equal(addon, null);
  Assert.equal(addon2, null);

  await promiseRestartManager();

  // After install and restart we should block.
  let blocked = Services.prefs.getBoolPref("extensions.e10sBlockedByAddons");
  Assert.ok(blocked);

  BootstrapMonitor.checkAddonInstalled(ID);
  BootstrapMonitor.checkAddonStarted(ID);
  Assert.equal(getStartupReason(ID), ADDON_INSTALL);

  BootstrapMonitor.checkAddonInstalled(ID2);
  BootstrapMonitor.checkAddonStarted(ID2);
  Assert.equal(getStartupReason(ID2), ADDON_INSTALL);

  addon = await promiseAddonByID(ID);
  Assert.notEqual(addon, null);
  addon2 = await promiseAddonByID(ID2);
  Assert.notEqual(addon2, null);

  Assert.ok(!hasFlag(addon.operationsRequiringRestart, AddonManager.OP_NEEDS_RESTART_DISABLE));
  addon.userDisabled = true;
  BootstrapMonitor.checkAddonNotStarted(ID);
  Assert.ok(!addon.isActive);
  Assert.ok(!hasFlag(addon.pendingOperations, AddonManager.PENDING_DISABLE));
  Assert.ok(hasFlag(addon.operationsRequiringRestart, AddonManager.OP_NEEDS_RESTART_ENABLE));

  await promiseRestartManager();

  // After disable one addon and restart we should block.
  blocked = Services.prefs.getBoolPref("extensions.e10sBlockedByAddons");
  Assert.ok(blocked);
  Assert.ok(check_multi_disabled());

  addon2 = await promiseAddonByID(ID2);

  Assert.ok(!hasFlag(addon2.operationsRequiringRestart, AddonManager.OP_NEEDS_RESTART_DISABLE));
  addon2.userDisabled = true;
  BootstrapMonitor.checkAddonNotStarted(ID2);
  Assert.ok(!addon2.isActive);
  Assert.ok(!hasFlag(addon2.pendingOperations, AddonManager.PENDING_DISABLE));
  Assert.ok(hasFlag(addon2.operationsRequiringRestart, AddonManager.OP_NEEDS_RESTART_ENABLE));

  await promiseRestartManager();

  // After disable both addons and restart we should not block.
  blocked = Services.prefs.getBoolPref("extensions.e10sBlockedByAddons");
  Assert.ok(!blocked);
  Assert.ok(!check_multi_disabled());

  addon = await promiseAddonByID(ID);
  addon.userDisabled = false;
  BootstrapMonitor.checkAddonNotStarted(ID);
  Assert.ok(!addon.isActive);
  Assert.ok(hasFlag(addon.pendingOperations, AddonManager.PENDING_ENABLE));

  await promiseRestartManager();

  // After re-enable one addon and restart we should block.
  blocked = Services.prefs.getBoolPref("extensions.e10sBlockedByAddons");
  Assert.ok(blocked);
  Assert.ok(check_multi_disabled());

  addon = await promiseAddonByID(ID);
  Assert.notEqual(addon, null);

  Assert.ok(addon.isActive);
  BootstrapMonitor.checkAddonStarted(ID);
  // Bug 1304392 again (see comment above)
  Assert.equal(getStartupReason(ID), APP_STARTUP);

  Assert.ok(!hasFlag(addon.operationsRequiringRestart, AddonManager.OP_NEEDS_RESTART_UNINSTALL));
  addon.uninstall();
  BootstrapMonitor.checkAddonNotStarted(ID);
  BootstrapMonitor.checkAddonNotInstalled(ID);

  await promiseRestartManager();

  // After uninstall the only enabled addon and restart we should not block.
  blocked = Services.prefs.getBoolPref("extensions.e10sBlockedByAddons");
  Assert.ok(!blocked);
  Assert.ok(!check_multi_disabled());

  addon2 = await promiseAddonByID(ID2);
  addon2.uninstall();

  restartManager();
});

// Check that the rollout policy sets work as expected
add_task(async function() {
  gAppInfo.browserTabsRemoteAutostart = true;
  Services.prefs.setBoolPref("extensions.e10sBlocksEnabling", true);
  Services.prefs.setCharPref("extensions.e10s.rollout.policy", "xpcshell-test");

  // Both 'bootstrap1' and 'bootstrap2' addons are part of the allowed policy
  // set, because they are marked as mpc=true.
  await check_normal();

  // Check that the two add-ons can be installed together correctly as
  // check_normal() only perform checks on bootstrap1.
  let [install1, install2] = await Promise.all([
    promiseInstallFile(do_get_addon("test_bootstrap1_1")),
    promiseInstallFile(do_get_addon("test_bootstrap2_1")),
  ]);

  Assert.equal(install1.state, AddonManager.STATE_INSTALLED);
  Assert.equal(install2.state, AddonManager.STATE_INSTALLED);
  Assert.ok(!hasFlag(install1.addon.pendingOperations, AddonManager.PENDING_INSTALL));
  Assert.ok(!hasFlag(install2.addon.pendingOperations, AddonManager.PENDING_INSTALL));

  let addon = await promiseAddonByID(ID);
  let addon2 = await promiseAddonByID(ID2);

  Assert.notEqual(addon, null);
  Assert.notEqual(addon2, null);

  BootstrapMonitor.checkAddonInstalled(ID);
  BootstrapMonitor.checkAddonStarted(ID);

  BootstrapMonitor.checkAddonInstalled(ID2);
  BootstrapMonitor.checkAddonStarted(ID2);

  await promiseRestartManager();

  // After install and restart e10s should not be blocked.
  let blocked = Services.prefs.getBoolPref("extensions.e10sBlockedByAddons");
  Assert.ok(!blocked);

  // Check that adding bootstrap2 to the blocklist will trigger a disable of e10s.
  Services.prefs.setCharPref("extensions.e10s.rollout.blocklist", ID2);
  blocked = Services.prefs.getBoolPref("extensions.e10sBlockedByAddons");
  Assert.ok(blocked);

  await promiseRestartManager();

  // Check that after restarting, e10s continues to be blocked.
  blocked = Services.prefs.getBoolPref("extensions.e10sBlockedByAddons");
  Assert.ok(blocked);

  // Check that uninstalling bootstrap2 (which is in the blocklist) will
  // cause e10s to be re-enabled.
  addon2 = await promiseAddonByID(ID2);
  Assert.ok(!hasFlag(addon2.operationsRequiringRestart, AddonManager.OP_NEEDS_RESTART_UNINSTALL));
  addon2.uninstall();
  BootstrapMonitor.checkAddonNotStarted(ID2);
  BootstrapMonitor.checkAddonNotInstalled(ID2);

  await promiseRestartManager();

  // After uninstall the blocklisted addon and restart we should not block.
  blocked = Services.prefs.getBoolPref("extensions.e10sBlockedByAddons");
  Assert.ok(!blocked);


  // Let's perform similar checks again, now that bootstrap2 is in the blocklist.
  // The bootstrap1 add-on should install and start correctly, but bootstrap2 should not.
  addon = await promiseAddonByID(ID);
  addon.uninstall();
  BootstrapMonitor.checkAddonNotStarted(ID);
  BootstrapMonitor.checkAddonNotInstalled(ID);

  await promiseRestartManager();

  [install1, install2] = await Promise.all([
    promiseInstallFile(do_get_addon("test_bootstrap1_1")),
    promiseInstallFile(do_get_addon("test_bootstrap2_1")),
  ]);

  Assert.equal(install1.state, AddonManager.STATE_INSTALLED);
  Assert.equal(install2.state, AddonManager.STATE_INSTALLED);
  Assert.ok(!hasFlag(install1.addon.pendingOperations, AddonManager.PENDING_INSTALL));
  Assert.ok(hasFlag(install2.addon.pendingOperations, AddonManager.PENDING_INSTALL));

  addon = await promiseAddonByID(ID);
  addon2 = await promiseAddonByID(ID2);

  Assert.notEqual(addon, null);
  Assert.equal(addon2, null);

  BootstrapMonitor.checkAddonInstalled(ID);
  BootstrapMonitor.checkAddonStarted(ID);

  BootstrapMonitor.checkAddonNotInstalled(ID2);
  BootstrapMonitor.checkAddonNotStarted(ID2);

  await promiseRestartManager();

  blocked = Services.prefs.getBoolPref("extensions.e10sBlockedByAddons");
  Assert.ok(blocked);

  // Now let's test that an add-on that is not mpc=true doesn't get installed,
  // since the rollout policy is restricted to only mpc=true addons.
  let install3 = await promiseInstallFile(do_get_addon("test_bootstrap3_1"));

  Assert.equal(install3.state, AddonManager.STATE_INSTALLED);
  Assert.ok(hasFlag(install3.addon.pendingOperations, AddonManager.PENDING_INSTALL));

  let addon3 = await promiseAddonByID(ID3);

  Assert.equal(addon3, null);

  BootstrapMonitor.checkAddonNotInstalled(ID3);
  BootstrapMonitor.checkAddonNotStarted(ID3);

  await promiseRestartManager();

  blocked = Services.prefs.getBoolPref("extensions.e10sBlockedByAddons");
  Assert.ok(blocked);

  // Clean-up
  addon = await promiseAddonByID(ID);
  addon2 = await promiseAddonByID(ID2);
  addon3 = await promiseAddonByID(ID3);

  addon.uninstall();
  BootstrapMonitor.checkAddonNotStarted(ID);
  BootstrapMonitor.checkAddonNotInstalled(ID);

  addon2.uninstall();
  BootstrapMonitor.checkAddonNotStarted(ID2);
  BootstrapMonitor.checkAddonNotInstalled(ID2);

  addon3.uninstall();
  BootstrapMonitor.checkAddonNotStarted(ID3);
  BootstrapMonitor.checkAddonNotInstalled(ID3);

  Services.prefs.clearUserPref("extensions.e10s.rollout.policy");
  Services.prefs.clearUserPref("extensions.e10s.rollout.blocklist");

  await promiseRestartManager();
});

// The hotfix is unaffected
add_task(async function() {
  gAppInfo.browserTabsRemoteAutostart = true;
  Services.prefs.setBoolPref("extensions.e10sBlocksEnabling", true);
  Services.prefs.setCharPref("extensions.hotfix.id", ID);
  Services.prefs.setBoolPref("extensions.hotfix.cert.checkAttributes", false);

  await check_normal(true);
});

// Test non-restarless add-on should block multi
add_task(async function() {
  await promiseInstallAllFiles([do_get_addon("test_install1")], true);

  let non_restartless_ID = "addon1@tests.mozilla.org";
  let addon = await promiseAddonByID(non_restartless_ID);

  // non-restartless add-on is installed and started
  Assert.equal(addon, null);

  await promiseRestartManager();

  Assert.ok(check_multi_disabled());

  addon = await promiseAddonByID(non_restartless_ID);
  addon.uninstall();

  BootstrapMonitor.checkAddonNotInstalled(non_restartless_ID);
  BootstrapMonitor.checkAddonNotStarted(non_restartless_ID);

  await promiseRestartManager();
});

// Test experiment add-on should not block multi
add_task(async function() {
  await promiseInstallAllFiles([do_get_addon("test_experiment1")], true);

  let experiment_ID = "experiment1@tests.mozilla.org";

  BootstrapMonitor.checkAddonInstalled(experiment_ID, "1.0");
  BootstrapMonitor.checkAddonNotStarted(experiment_ID);

  let addon = await promiseAddonByID(experiment_ID);

  // non-restartless add-on is installed and started
  Assert.notEqual(addon, null);

  Assert.ok(!check_multi_disabled());

  addon.uninstall();

  BootstrapMonitor.checkAddonNotInstalled(experiment_ID);
  BootstrapMonitor.checkAddonNotStarted(experiment_ID);

  await promiseRestartManager();
});

const { GlobalManager } = ChromeUtils.import("resource://gre/modules/Extension.jsm", {});

// Test web extension add-on's should not block multi
add_task(async function() {

  await promiseInstallAllFiles([do_get_addon("webextension_1")], true),

  restartManager();

  await promiseWebExtensionStartup();

  let we_ID = "webextension1@tests.mozilla.org";

  Assert.equal(GlobalManager.extensionMap.size, 1);

  let addon = await promiseAddonByID(we_ID);

  Assert.notEqual(addon, null);

  Assert.ok(!check_multi_disabled());

  addon.uninstall();

  BootstrapMonitor.checkAddonNotInstalled(we_ID);
  BootstrapMonitor.checkAddonNotStarted(we_ID);

  await promiseRestartManager();
});
