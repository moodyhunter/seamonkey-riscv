/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const URI_EXTENSION_BLOCKLIST_DIALOG = "chrome://mozapps/content/extensions/blocklist.xul";

ChromeUtils.import("resource://testing-common/httpd.js");
ChromeUtils.import("resource://testing-common/MockRegistrar.jsm");
var gTestserver = new HttpServer();
gTestserver.start(-1);
gPort = gTestserver.identity.primaryPort;

// register static files with server and interpolate port numbers in them
mapFile("/data/bug455906_warn.xml", gTestserver);
mapFile("/data/bug455906_start.xml", gTestserver);
mapFile("/data/bug455906_block.xml", gTestserver);
mapFile("/data/bug455906_empty.xml", gTestserver);

// Workaround for Bug 658720 - URL formatter can leak during xpcshell tests
const PREF_BLOCKLIST_ITEM_URL = "extensions.blocklist.itemURL";
Services.prefs.setCharPref(PREF_BLOCKLIST_ITEM_URL, "http://localhost:" + gPort + "/blocklist/%blockID%");

function getAddonBlocklistURL(addon) {
  let entry = Services.blocklist.getAddonBlocklistEntry(addon);
  return entry && entry.url;
}

var ADDONS = [{
  // Tests how the blocklist affects a disabled add-on
  id: "test_bug455906_1@tests.mozilla.org",
  name: "Bug 455906 Addon Test 1",
  version: "5",
  appVersion: "3"
}, {
  // Tests how the blocklist affects an enabled add-on
  id: "test_bug455906_2@tests.mozilla.org",
  name: "Bug 455906 Addon Test 2",
  version: "5",
  appVersion: "3"
}, {
  // Tests how the blocklist affects an enabled add-on, to be disabled by the notification
  id: "test_bug455906_3@tests.mozilla.org",
  name: "Bug 455906 Addon Test 3",
  version: "5",
  appVersion: "3"
}, {
  // Tests how the blocklist affects a disabled add-on that was already warned about
  id: "test_bug455906_4@tests.mozilla.org",
  name: "Bug 455906 Addon Test 4",
  version: "5",
  appVersion: "3"
}, {
  // Tests how the blocklist affects an enabled add-on that was already warned about
  id: "test_bug455906_5@tests.mozilla.org",
  name: "Bug 455906 Addon Test 5",
  version: "5",
  appVersion: "3"
}, {
  // Tests how the blocklist affects an already blocked add-on
  id: "test_bug455906_6@tests.mozilla.org",
  name: "Bug 455906 Addon Test 6",
  version: "5",
  appVersion: "3"
}, {
  // Tests how the blocklist affects an incompatible add-on
  id: "test_bug455906_7@tests.mozilla.org",
  name: "Bug 455906 Addon Test 7",
  version: "5",
  appVersion: "2"
}, {
  // Spare add-on used to ensure we get a notification when switching lists
  id: "dummy_bug455906_1@tests.mozilla.org",
  name: "Dummy Addon 1",
  version: "5",
  appVersion: "3"
}, {
  // Spare add-on used to ensure we get a notification when switching lists
  id: "dummy_bug455906_2@tests.mozilla.org",
  name: "Dummy Addon 2",
  version: "5",
  appVersion: "3"
}];

var gNotificationCheck = null;
var gTestCheck = null;

// Don't need the full interface, attempts to call other methods will just
// throw which is just fine
var WindowWatcher = {
  openWindow(parent, url, name, features, windowArguments) {
    // Should be called to list the newly blocklisted items
    Assert.equal(url, URI_EXTENSION_BLOCKLIST_DIALOG);

    if (gNotificationCheck) {
      var args = windowArguments.wrappedJSObject;
      gNotificationCheck(args);
    }

    // run the code after the blocklist is closed
    Services.obs.notifyObservers(null, "addon-blocklist-closed");

    // Call the next test after the blocklist has finished up
    do_timeout(0, gTestCheck);
  },

  QueryInterface(iid) {
    if (iid.equals(Ci.nsIWindowWatcher)
     || iid.equals(Ci.nsISupports))
      return this;

    throw Cr.NS_ERROR_NO_INTERFACE;
  }
};

MockRegistrar.register("@mozilla.org/embedcomp/window-watcher;1", WindowWatcher);

function create_addon(addon) {
  var installrdf = "<?xml version=\"1.0\"?>\n" +
                   "\n" +
                   "<RDF xmlns=\"http://www.w3.org/1999/02/22-rdf-syntax-ns#\"\n" +
                   "     xmlns:em=\"http://www.mozilla.org/2004/em-rdf#\">\n" +
                   "  <Description about=\"urn:mozilla:install-manifest\">\n" +
                   "    <em:id>" + addon.id + "</em:id>\n" +
                   "    <em:version>" + addon.version + "</em:version>\n" +
                   "    <em:targetApplication>\n" +
                   "      <Description>\n" +
                   "        <em:id>xpcshell@tests.mozilla.org</em:id>\n" +
                   "        <em:minVersion>" + addon.appVersion + "</em:minVersion>\n" +
                   "        <em:maxVersion>" + addon.appVersion + "</em:maxVersion>\n" +
                   "      </Description>\n" +
                   "    </em:targetApplication>\n" +
                   "    <em:name>" + addon.name + "</em:name>\n" +
                   "  </Description>\n" +
                   "</RDF>\n";
  var target = gProfD.clone();
  target.append("extensions");
  target.append(addon.id);
  target.append("install.rdf");
  target.create(target.NORMAL_FILE_TYPE, FileUtils.PERMS_FILE);
  var stream = Cc["@mozilla.org/network/file-output-stream;1"].
               createInstance(Ci.nsIFileOutputStream);
  stream.init(target,
              FileUtils.MODE_WRONLY | FileUtils.MODE_CREATE | FileUtils.MODE_TRUNCATE,
              FileUtils.PERMS_FILE, 0);
  stream.write(installrdf, installrdf.length);
  stream.close();
}

function load_blocklist(file) {
  Services.prefs.setCharPref("extensions.blocklist.url", "http://localhost:" + gPort + "/data/" + file);
  var blocklist = Cc["@mozilla.org/extensions/blocklist;1"].
                  getService(Ci.nsITimerCallback);
  blocklist.notify(null);
}

function check_addon_state(addon) {
  return addon.userDisabled + "," + addon.softDisabled + "," + addon.appDisabled;
}

function create_blocklistURL(blockID) {
  let url = Services.urlFormatter.formatURLPref(PREF_BLOCKLIST_ITEM_URL);
  url = url.replace(/%blockID%/g, blockID);
  return url;
}

// Performs the initial setup
function run_test() {
  // Setup for test
  dump("Setting up tests\n");
  // Rather than keeping lots of identical add-ons in version control, just
  // write them into the profile.
  for (let addon of ADDONS)
    create_addon(addon);

  // Copy the initial blocklist into the profile to check add-ons start in the
  // right state.
  copyBlocklistToProfile(do_get_file("data/bug455906_start.xml"));

  createAppInfo("xpcshell@tests.mozilla.org", "XPCShell", "3", "8");
  startupManager();

  do_test_pending();
  check_test_pt1();
}

// Before every main test this is the state the add-ons are meant to be in
function check_initial_state(callback) {
  AddonManager.getAddonsByIDs(ADDONS.map(a => a.id), function(addons) {
    Assert.equal(check_addon_state(addons[0]), "true,false,false");
    Assert.equal(check_addon_state(addons[1]), "false,false,false");
    Assert.equal(check_addon_state(addons[2]), "false,false,false");
    Assert.equal(check_addon_state(addons[3]), "true,true,false");
    Assert.equal(check_addon_state(addons[4]), "false,false,false");
    Assert.equal(check_addon_state(addons[5]), "false,false,true");
    Assert.equal(check_addon_state(addons[6]), "false,false,true");

    callback();
  });
}

// Tests the add-ons were installed and the initial blocklist applied as expected
function check_test_pt1() {
  dump("Checking pt 1\n");

  AddonManager.getAddonsByIDs(ADDONS.map(a => a.id), callback_soon(function(addons) {
    for (var i = 0; i < ADDONS.length; i++) {
      if (!addons[i])
        do_throw("Addon " + (i + 1) + " did not get installed correctly");
    }

    Assert.equal(check_addon_state(addons[0]), "false,false,false");
    Assert.equal(check_addon_state(addons[1]), "false,false,false");
    Assert.equal(check_addon_state(addons[2]), "false,false,false");

    // Warn add-ons should be soft disabled automatically
    Assert.equal(check_addon_state(addons[3]), "true,true,false");
    Assert.equal(check_addon_state(addons[4]), "true,true,false");

    // Blocked and incompatible should be app disabled only
    Assert.equal(check_addon_state(addons[5]), "false,false,true");
    Assert.equal(check_addon_state(addons[6]), "false,false,true");

    // Put the add-ons into the base state
    addons[0].userDisabled = true;
    addons[4].userDisabled = false;

    restartManager();
    check_initial_state(function() {
      gNotificationCheck = check_notification_pt2;
      gTestCheck = check_test_pt2;
      load_blocklist("bug455906_warn.xml");
    });
  }));
}

function check_notification_pt2(args) {
  dump("Checking notification pt 2\n");
  Assert.equal(args.list.length, 4);

  for (let addon of args.list) {
    switch (addon.item.id) {
      case "test_bug455906_2@tests.mozilla.org":
        Assert.ok(!addon.blocked);
        break;
      case "test_bug455906_3@tests.mozilla.org":
        Assert.ok(!addon.blocked);
        addon.disable = true;
        break;
      default:
        do_throw("Unknown addon: " + addon.item.id);
    }
  }
}

function check_test_pt2() {
  restartManager();
  dump("Checking results pt 2\n");

  AddonManager.getAddonsByIDs(ADDONS.map(a => a.id), callback_soon(function(addons) {
    // Should have disabled this add-on as requested
    Assert.equal(check_addon_state(addons[2]), "true,true,false");

    // The blocked add-on should have changed to soft disabled
    Assert.equal(check_addon_state(addons[5]), "true,true,false");
    Assert.equal(check_addon_state(addons[6]), "true,true,true");

    // These should have been unchanged
    Assert.equal(check_addon_state(addons[0]), "true,false,false");
    Assert.equal(check_addon_state(addons[1]), "false,false,false");
    Assert.equal(check_addon_state(addons[3]), "true,true,false");
    Assert.equal(check_addon_state(addons[4]), "false,false,false");

    // Back to starting state
    addons[2].userDisabled = false;
    addons[5].userDisabled = false;
    restartManager();
    gNotificationCheck = null;
    gTestCheck = run_test_pt3;
    load_blocklist("bug455906_start.xml");
  }));
}

function run_test_pt3() {
  restartManager();
  check_initial_state(function() {
    gNotificationCheck = check_notification_pt3;
    gTestCheck = check_test_pt3;
    load_blocklist("bug455906_block.xml");
  });
}

function check_notification_pt3(args) {
  dump("Checking notification pt 3\n");
  Assert.equal(args.list.length, 6);

  for (let addon of args.list) {
    switch (addon.item.id) {
      case "test_bug455906_2@tests.mozilla.org":
        Assert.ok(addon.blocked);
        break;
      case "test_bug455906_3@tests.mozilla.org":
        Assert.ok(addon.blocked);
        break;
      case "test_bug455906_5@tests.mozilla.org":
        Assert.ok(addon.blocked);
        break;
      default:
        do_throw("Unknown addon: " + addon.item.id);
    }
  }
}

function check_test_pt3() {
  restartManager();
  dump("Checking results pt 3\n");

  AddonManager.getAddonsByIDs(ADDONS.map(a => a.id), function(addons) {
    // All should have gained the blocklist state, user disabled as previously
    Assert.equal(check_addon_state(addons[0]), "true,false,true");
    Assert.equal(check_addon_state(addons[1]), "false,false,true");
    Assert.equal(check_addon_state(addons[2]), "false,false,true");
    Assert.equal(check_addon_state(addons[4]), "false,false,true");

    // Should have gained the blocklist state but no longer be soft disabled
    Assert.equal(check_addon_state(addons[3]), "false,false,true");

    // Check blockIDs are correct
    Assert.equal(getAddonBlocklistURL(addons[0]), create_blocklistURL(addons[0].id));
    Assert.equal(getAddonBlocklistURL(addons[1]), create_blocklistURL(addons[1].id));
    Assert.equal(getAddonBlocklistURL(addons[2]), create_blocklistURL(addons[2].id));
    Assert.equal(getAddonBlocklistURL(addons[3]), create_blocklistURL(addons[3].id));
    Assert.equal(getAddonBlocklistURL(addons[4]), create_blocklistURL(addons[4].id));

    // Shouldn't be changed
    Assert.equal(check_addon_state(addons[5]), "false,false,true");
    Assert.equal(check_addon_state(addons[6]), "false,false,true");

    // Back to starting state
    gNotificationCheck = null;
    gTestCheck = run_test_pt4;
    load_blocklist("bug455906_start.xml");
  });
}

function run_test_pt4() {
  AddonManager.getAddonByID(ADDONS[4].id, callback_soon(function(addon) {
    addon.userDisabled = false;
    restartManager();
    check_initial_state(function() {
      gNotificationCheck = check_notification_pt4;
      gTestCheck = check_test_pt4;
      load_blocklist("bug455906_empty.xml");
    });
  }));
}

function check_notification_pt4(args) {
  dump("Checking notification pt 4\n");

  // Should be just the dummy add-on to force this notification
  Assert.equal(args.list.length, 1);
  Assert.equal(args.list[0].item.id, "dummy_bug455906_2@tests.mozilla.org");
}

function check_test_pt4() {
  restartManager();
  dump("Checking results pt 4\n");

  AddonManager.getAddonsByIDs(ADDONS.map(a => a.id), function(addons) {
    // This should have become unblocked
    Assert.equal(check_addon_state(addons[5]), "false,false,false");

    // Should get re-enabled
    Assert.equal(check_addon_state(addons[3]), "false,false,false");

    // No change for anything else
    Assert.equal(check_addon_state(addons[0]), "true,false,false");
    Assert.equal(check_addon_state(addons[1]), "false,false,false");
    Assert.equal(check_addon_state(addons[2]), "false,false,false");
    Assert.equal(check_addon_state(addons[4]), "false,false,false");
    Assert.equal(check_addon_state(addons[6]), "false,false,true");

    finish();
  });
}

function finish() {
  gTestserver.stop(do_test_finished);
}