/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

function run_test() {
  removeMetadata();
  removeCacheFile();

  do_load_manifest("data/chrome.manifest");

  configureToLoadJarEngines();

  // Unless we unset the XPCSHELL_TEST_PROFILE_DIR environment variable,
  // engine._isDefault will be true for engines from the resource:// scheme,
  // bypassing the codepath we want to test.
  let env = Cc["@mozilla.org/process/environment;1"]
              .getService(Ci.nsIEnvironment);
  env.set("XPCSHELL_TEST_PROFILE_DIR", "");

  do_get_file("data/langpack-metadata.json").copyTo(gProfD, "search-metadata.json");

  Assert.ok(!Services.search.isInitialized);

  run_next_test();
}

add_task(async function async_init() {
  let commitPromise = promiseAfterCache();
  await asyncInit();

  let engine = Services.search.getEngineByName("bug645970");
  Assert.notEqual(engine, null);
  Assert.equal(engine.wrappedJSObject._id, "[app]/bug645970.xml");

  await commitPromise;
  let metadata = await promiseEngineMetadata();
  Assert.equal(metadata.bug645970.alias, "lp");
});
