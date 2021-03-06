/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim:set ts=2 sw=2 sts=2 et: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Tests that nsSuiteGlue is correctly exporting based on preferences values,
 * and creating bookmarks backup if one does not exist for today.
 */

// Initialize nsSuiteGlue after Places.
var bg = Cc["@mozilla.org/suite/suiteglue;1"].
         getService(Ci.nsISuiteGlue);

// Initialize Places through Bookmarks Service.
var bs = PlacesUtils.bookmarks;

// Get other services.
const PREF_AUTO_EXPORT_HTML = "browser.bookmarks.autoExportHTML";

var tests = [];

//------------------------------------------------------------------------------

tests.push({
  description: "Export to bookmarks.html if autoExportHTML is true.",
  exec: function() {
    // Sanity check: we should have bookmarks on the toolbar.
    Assert.ok(bs.getIdForItemAt(bs.toolbarFolder, 0) > 0);

    // Set preferences.
    Services.prefs.setBoolPref(PREF_AUTO_EXPORT_HTML);

    // Force nsSuiteGlue::_shutdownPlaces().
    bg.QueryInterface(Ci.nsIObserver).observe(null,
                                              PlacesUtils.TOPIC_SHUTDOWN,
                                              null);

    // Check bookmarks.html has been created.
    check_bookmarks_html();
    // Check JSON backup has been created.
    check_JSON_backup();

    // Check preferences have not been reverted.
    Assert.ok(Services.prefs.getBoolPref(PREF_AUTO_EXPORT_HTML));
    // Reset preferences.
    Services.prefs.setBoolPref(PREF_AUTO_EXPORT_HTML, false);

    next_test();
  }
});

//------------------------------------------------------------------------------

tests.push({
  description: "Export to bookmarks.html if autoExportHTML is true and a bookmarks.html exists.",
  exec: function() {
    // Sanity check: we should have bookmarks on the toolbar.
    Assert.ok(bs.getIdForItemAt(bs.toolbarFolder, 0) > 0);

    // Set preferences.
    Services.prefs.setBoolPref(PREF_AUTO_EXPORT_HTML, true);

    // Create a bookmarks.html in the profile.
    let profileBookmarksHTMLFile = create_bookmarks_html("bookmarks.glue.html");
    // Get file lastModified and size.
    let lastMod = profileBookmarksHTMLFile.lastModifiedTime;
    let fileSize = profileBookmarksHTMLFile.fileSize;

    // Force nsSuiteGlue::_shutdownPlaces().
    bg.QueryInterface(Ci.nsIObserver).observe(null,
                                              PlacesUtils.TOPIC_SHUTDOWN,
                                              null);

    // Check a new bookmarks.html has been created.
    let profileBookmarksHTMLFile = check_bookmarks_html();
    //XXX not working on Linux unit boxes. Could be filestats caching issue.
    //Assert.ok(profileBookmarksHTMLFile.lastModifiedTime > lastMod);
    Assert.notEqual(profileBookmarksHTMLFile.fileSize, fileSize);

    // Check preferences have not been reverted.
    Assert.ok(Services.prefs.getBoolPref(PREF_AUTO_EXPORT_HTML));
    // Reset preferences.
    Services.prefs.setBoolPref(PREF_AUTO_EXPORT_HTML, false);

    next_test();
  }
});

//------------------------------------------------------------------------------

tests.push({
  description: "Backup to JSON should be a no-op if a backup for today already exists.",
  exec: function() {
    // Sanity check: we should have bookmarks on the toolbar.
    Assert.ok(bs.getIdForItemAt(bs.toolbarFolder, 0) > 0);

    // Create a JSON backup in the profile.
    let profileBookmarksJSONFile = create_JSON_backup("bookmarks.glue.json");
    // Get file lastModified and size.
    let lastMod = profileBookmarksJSONFile.lastModifiedTime;
    let fileSize = profileBookmarksJSONFile.fileSize;

    // Force nsSuiteGlue::_shutdownPlaces().
    bg.QueryInterface(Ci.nsIObserver).observe(null,
                                              PlacesUtils.TOPIC_SHUTDOWN,
                                              null);

    // Check a new JSON backup has not been created.
    Assert.ok(profileBookmarksJSONFile.exists());
    Assert.equal(profileBookmarksJSONFile.lastModifiedTime, lastMod);
    Assert.equal(profileBookmarksJSONFile.fileSize, fileSize);

    do_test_finished();
  }
});

//------------------------------------------------------------------------------

function finish_test() {
  do_test_finished();
}

var testIndex = 0;
function next_test() {
  // Remove bookmarks.html from profile.
  remove_bookmarks_html();
  // Remove JSON backups from profile.
  remove_all_JSON_backups();

  // Execute next test.
  let test = tests.shift();
  dump("\nTEST " + (++testIndex) + ": " + test.description);
  test.exec();
}

function run_test() {
  do_test_pending();

  // Clean up bookmarks.
  remove_all_bookmarks();

  // Create some bookmarks.
  bs.insertBookmark(bs.bookmarksMenuFolder, uri("http://mozilla.org/"),
                    bs.DEFAULT_INDEX, "bookmark-on-menu");
  bs.insertBookmark(bs.toolbarFolder, uri("http://mozilla.org/"),
                    bs.DEFAULT_INDEX, "bookmark-on-toolbar");

  // Kick-off tests.
  next_test();
}
