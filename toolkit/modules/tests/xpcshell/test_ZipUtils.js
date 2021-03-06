/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const ARCHIVE = "zips/zen.zip";
const SUBDIR = "zen";
const SYMLINK = "beyond_link";
const ENTRIES = ["beyond.txt", SYMLINK, "waterwood.txt"];

ChromeUtils.import("resource://gre/modules/ZipUtils.jsm");
ChromeUtils.import("resource://gre/modules/FileUtils.jsm");
ChromeUtils.import("resource://gre/modules/Services.jsm");

const archive = do_get_file(ARCHIVE, false);
const dir = do_get_profile().clone();
dir.append("test_ZipUtils");

function ensureExtracted(target) {
  target.append(SUBDIR);
  Assert.ok(target.exists());

  for (let i = 0; i < ENTRIES.length; i++) {
    let entry = target.clone();
    entry.append(ENTRIES[i]);
    info("ENTRY " + entry.path);
    Assert.ok(entry.exists());
  }
}

function ensureHasSymlink(target) {
  // Just bail out if running on Windows, since symlinks do not exists there.
  if (Services.appinfo.OS === "WINNT") {
    return;
  }

  let entry = target.clone();
  entry.append(SYMLINK);

  info("ENTRY " + entry.path);
  Assert.ok(entry.exists());
  Assert.ok(entry.isSymlink());
}

add_task(function test_extractFiles() {
  let target = dir.clone();
  target.append("test_extractFiles");

  try {
    ZipUtils.extractFiles(archive, target);
  } catch (e) {
    do_throw("Failed to extract synchronously!");
  }

  ensureExtracted(target);
  ensureHasSymlink(target);
});

add_task(async function test_extractFilesAsync() {
  let target = dir.clone();
  target.append("test_extractFilesAsync");
  target.create(Ci.nsIFile.DIRECTORY_TYPE,
    FileUtils.PERMS_DIRECTORY);

  await ZipUtils.extractFilesAsync(archive, target).then(
    function success() {
      info("SUCCESS");
      ensureExtracted(target);
    },
    function failure() {
      info("FAILURE");
      do_throw("Failed to extract asynchronously!");
    }
  );
});
