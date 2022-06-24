/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

function run_test() {
  do_test_pending();

  removeMetadata();
  removeCacheFile();

  do_load_manifest("data/chrome.manifest");

  configureToLoadJarEngines();
  installAddonEngine();

  Assert.ok(!Services.search.isInitialized);

  Services.search.init(function search_initialized(aStatus) {
    Assert.ok(Components.isSuccessCode(aStatus));
    Assert.ok(Services.search.isInitialized);

    // test the add-on engine is loaded in addition to our jar engine
    let engines = Services.search.getEngines();
    Assert.equal(engines.length, 2);

    // test jar engine is loaded ok.
    let engine = Services.search.getEngineByName("addon");
    Assert.notEqual(engine, null);

    Assert.equal(engine.description, "addon");

    do_test_finished();
  });
}
