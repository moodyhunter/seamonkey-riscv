/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

/* Test that legacy metadata from search-metadata.json is correctly
 * transferred to the new metadata storage. */

function run_test() {
  installTestEngine();

  do_get_file("data/metadata.json").copyTo(gProfD, "search-metadata.json");

  run_next_test();
}

add_task(async function test_sync_metadata_migration() {
  Assert.ok(!Services.search.isInitialized);
  Services.search.getEngines();
  Assert.ok(Services.search.isInitialized);
  await promiseAfterCache();

  // Check that the entries are placed as specified correctly
  let metadata = await promiseEngineMetadata();
  Assert.equal(metadata.engine.order, 1);
  Assert.equal(metadata.engine.alias, "foo");

  metadata = await promiseGlobalMetadata();
  Assert.equal(metadata.searchDefaultExpir, 1471013469846);
});
