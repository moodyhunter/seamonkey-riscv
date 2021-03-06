/* Any copyright is dedicated to the Public Domain.
 *    http://creativecommons.org/publicdomain/zero/1.0/ */

/*
 * Test that a search engine's identifier can be extracted from the filename.
 */

"use strict";

const SEARCH_APP_DIR = 1;

function run_test() {
  removeMetadata();
  removeCacheFile();
  do_load_manifest("data/chrome.manifest");

  configureToLoadJarEngines();

  run_next_test();
}

add_test(function test_identifier() {
  let engineFile = gProfD.clone();
  engineFile.append("searchplugins");
  engineFile.append("test-search-engine.xml");
  engineFile.parent.create(Ci.nsIFile.DIRECTORY_TYPE, FileUtils.PERMS_DIRECTORY);

  // Copy the test engine to the test profile.
  let engineTemplateFile = do_get_file("data/engine.xml");
  engineTemplateFile.copyTo(engineFile.parent, "test-search-engine.xml");

  Services.search.init(function initComplete(aResult) {
    info("init'd search service");
    Assert.ok(Components.isSuccessCode(aResult));

    let profileEngine = Services.search.getEngineByName("Test search engine");
    let jarEngine = Services.search.getEngineByName("bug645970");

    Assert.ok(profileEngine instanceof Ci.nsISearchEngine);
    Assert.ok(jarEngine instanceof Ci.nsISearchEngine);

    // An engine loaded from the profile directory won't have an identifier,
    // because it's not built-in.
    Assert.equal(profileEngine.identifier, null);

    // An engine loaded from a JAR will have an identifier corresponding to
    // the filename inside the JAR. (In this case it's the same as the name.)
    Assert.equal(jarEngine.identifier, "bug645970");

    removeMetadata();
    removeCacheFile();
    run_next_test();
  });
});
