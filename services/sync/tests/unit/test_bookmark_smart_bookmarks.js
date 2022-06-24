/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

ChromeUtils.import("resource://gre/modules/Log.jsm");
ChromeUtils.import("resource://services-sync/engines.js");
ChromeUtils.import("resource://services-sync/engines/bookmarks.js");
ChromeUtils.import("resource://services-sync/service.js");
ChromeUtils.import("resource://services-sync/util.js");
ChromeUtils.import("resource://testing-common/services/sync/utils.js");

const SMART_BOOKMARKS_ANNO = "Places/SmartBookmark";
const IOService = Cc["@mozilla.org/network/io-service;1"]
                .getService(Ci.nsIIOService);

function newSmartBookmark(parent, uri, position, title, queryID) {
  let id = PlacesUtils.bookmarks.insertBookmark(parent, uri, position, title);
  PlacesUtils.annotations.setItemAnnotation(id, SMART_BOOKMARKS_ANNO,
                                            queryID, 0,
                                            PlacesUtils.annotations.EXPIRE_NEVER);
  return id;
}

function smartBookmarkCount() {
  // We do it this way because PlacesUtils.annotations.getItemsWithAnnotation
  // doesn't work the same (or at all?) between 3.6 and 4.0.
  let out = {};
  PlacesUtils.annotations.getItemsWithAnnotation(SMART_BOOKMARKS_ANNO, out);
  return out.value;
}

function clearBookmarks() {
  _("Cleaning up existing items.");
  PlacesUtils.bookmarks.removeFolderChildren(PlacesUtils.bookmarks.bookmarksMenuFolder);
  PlacesUtils.bookmarks.removeFolderChildren(PlacesUtils.bookmarks.tagsFolder);
  PlacesUtils.bookmarks.removeFolderChildren(PlacesUtils.bookmarks.toolbarFolder);
  PlacesUtils.bookmarks.removeFolderChildren(PlacesUtils.bookmarks.unfiledBookmarksFolder);
}

let engine;
let store;

add_task(async function setup() {
  await Service.engineManager.register(BookmarksEngine);
  engine = Service.engineManager.get("bookmarks");
  store = engine._store;
});

// Verify that Places smart bookmarks have their annotation uploaded and
// handled locally.
add_task(async function test_annotation_uploaded() {
  let server = serverForFoo(engine);
  await SyncTestingInfrastructure(server);

  let startCount = smartBookmarkCount();

  _("Start count is " + startCount);

  if (startCount > 0) {
    // This can happen in XULRunner.
    clearBookmarks();
    _("Start count is now " + startCount);
  }

  _("Create a smart bookmark in the toolbar.");
  let parent = PlacesUtils.toolbarFolderId;
  let uri =
    Utils.makeURI("place:sort=" +
                  Ci.nsINavHistoryQueryOptions.SORT_BY_VISITCOUNT_DESCENDING +
                  "&maxResults=10");
  let title = "Most Visited";

  let mostVisitedID = newSmartBookmark(parent, uri, -1, title, "MostVisited");

  _("New item ID: " + mostVisitedID);
  Assert.ok(!!mostVisitedID);

  let annoValue = PlacesUtils.annotations.getItemAnnotation(mostVisitedID,
                                              SMART_BOOKMARKS_ANNO);
  _("Anno: " + annoValue);
  Assert.equal("MostVisited", annoValue);

  let guid = await store.GUIDForId(mostVisitedID);
  _("GUID: " + guid);
  Assert.ok(!!guid);

  _("Create record object and verify that it's sane.");
  let record = await store.createRecord(guid);
  Assert.ok(record instanceof Bookmark);
  Assert.ok(record instanceof BookmarkQuery);

  Assert.equal(record.bmkUri, uri.spec);

  _("Make sure the new record carries with it the annotation.");
  Assert.equal("MostVisited", record.queryId);

  _("Our count has increased since we started.");
  Assert.equal(smartBookmarkCount(), startCount + 1);

  _("Sync record to the server.");
  let collection = server.user("foo").collection("bookmarks");

  try {
    await sync_engine_and_validate_telem(engine, false);
    let wbos = collection.keys(function(id) {
                 return ["menu", "toolbar", "mobile", "unfiled"].indexOf(id) == -1;
               });
    Assert.equal(wbos.length, 1);

    _("Verify that the server WBO has the annotation.");
    let serverGUID = wbos[0];
    Assert.equal(serverGUID, guid);
    let serverWBO = collection.wbo(serverGUID);
    Assert.ok(!!serverWBO);
    let body = JSON.parse(JSON.parse(serverWBO.payload).ciphertext);
    Assert.equal(body.queryId, "MostVisited");

    _("We still have the right count.");
    Assert.equal(smartBookmarkCount(), startCount + 1);

    _("Clear local records; now we can't find it.");

    // "Clear" by changing attributes: if we delete it, apparently it sticks
    // around as a deleted record...
    PlacesUtils.bookmarks.setItemTitle(mostVisitedID, "Not Most Visited");
    PlacesUtils.bookmarks.changeBookmarkURI(
      mostVisitedID, Utils.makeURI("http://something/else"));
    PlacesUtils.annotations.removeItemAnnotation(mostVisitedID,
                                                 SMART_BOOKMARKS_ANNO);
    await store.wipe();
    await engine.resetClient();
    Assert.equal(smartBookmarkCount(), startCount);

    _("Sync. Verify that the downloaded record carries the annotation.");
    await sync_engine_and_validate_telem(engine, false);

    _("Verify that the Places DB now has an annotated bookmark.");
    _("Our count has increased again.");
    Assert.equal(smartBookmarkCount(), startCount + 1);

    _("Find by GUID and verify that it's annotated.");
    let newID = await store.idForGUID(serverGUID);
    let newAnnoValue = PlacesUtils.annotations.getItemAnnotation(
      newID, SMART_BOOKMARKS_ANNO);
    Assert.equal(newAnnoValue, "MostVisited");
    Assert.equal(PlacesUtils.bookmarks.getBookmarkURI(newID).spec, uri.spec);

    _("Test updating.");
    let newRecord = await store.createRecord(serverGUID);
    Assert.equal(newRecord.queryId, newAnnoValue);
    newRecord.queryId = "LeastVisited";
    await store.update(newRecord);
    Assert.equal("LeastVisited", PlacesUtils.annotations.getItemAnnotation(
      newID, SMART_BOOKMARKS_ANNO));


  } finally {
    // Clean up.
    await store.wipe();
    Svc.Prefs.resetBranch("");
    Service.recordManager.clearCache();
    await promiseStopServer(server);
  }
});

add_task(async function test_smart_bookmarks_duped() {
  let server = serverForFoo(engine);
  await SyncTestingInfrastructure(server);

  let parent = PlacesUtils.toolbarFolderId;
  let uri =
    Utils.makeURI("place:sort=" +
                  Ci.nsINavHistoryQueryOptions.SORT_BY_VISITCOUNT_DESCENDING +
                  "&maxResults=10");
  let title = "Most Visited";
  let mostVisitedID = newSmartBookmark(parent, uri, -1, title, "MostVisited");
  let mostVisitedGUID = await store.GUIDForId(mostVisitedID);

  let record = await store.createRecord(mostVisitedGUID);

  _("Prepare sync.");
  try {
    await engine._syncStartup();

    _("Verify that mapDupe uses the anno, discovering a dupe regardless of URI.");
    Assert.equal(mostVisitedGUID, (await engine._mapDupe(record)));

    record.bmkUri = "http://foo/";
    Assert.equal(mostVisitedGUID, (await engine._mapDupe(record)));
    Assert.notEqual(PlacesUtils.bookmarks.getBookmarkURI(mostVisitedID).spec,
                 record.bmkUri);

    _("Verify that different annos don't dupe.");
    let other = new BookmarkQuery("bookmarks", "abcdefabcdef");
    other.queryId = "LeastVisited";
    other.parentName = "Bookmarks Toolbar";
    other.bmkUri = "place:foo";
    other.title = "";
    Assert.equal(undefined, (await engine._findDupe(other)));

    _("Handle records without a queryId entry.");
    record.bmkUri = uri;
    delete record.queryId;
    Assert.equal(mostVisitedGUID, (await engine._mapDupe(record)));

    await engine._syncFinish();

  } finally {
    // Clean up.
    await store.wipe();
    await promiseStopServer(server);
    Svc.Prefs.resetBranch("");
    Service.recordManager.clearCache();
  }
});

function run_test() {
  initTestLogging("Trace");
  Log.repository.getLogger("Sync.Engine.Bookmarks").level = Log.Level.Trace;

  generateNewKeys(Service.collectionKeys);

  run_next_test();
}
