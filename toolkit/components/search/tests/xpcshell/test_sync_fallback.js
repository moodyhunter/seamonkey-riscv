/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

function run_test() {
  do_test_pending();

  removeMetadata();
  removeCacheFile();

  do_load_manifest("data/chrome.manifest");

  configureToLoadJarEngines();

  Assert.ok(!Services.search.isInitialized);

  Services.search.init(function search_initialized(aStatus) {
    Assert.ok(Components.isSuccessCode(aStatus));
    Assert.ok(Services.search.isInitialized);

    // test engines from dir are not loaded.
    let engines = Services.search.getEngines();
    Assert.equal(engines.length, 1);

    // test jar engine is loaded ok.
    let engine = Services.search.getEngineByName("bug645970");
    Assert.notEqual(engine, null);

    do_test_finished();
  });

  Assert.ok(!Services.search.isInitialized);

  // test engines from dir are not loaded.
  let engines = Services.search.getEngines();
  Assert.equal(engines.length, 1);

  Assert.ok(Services.search.isInitialized);

  // test jar engine is loaded ok.
  let engine = Services.search.getEngineByName("bug645970");
  Assert.notEqual(engine, null);
}
