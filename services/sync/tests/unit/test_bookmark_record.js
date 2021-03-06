/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

ChromeUtils.import("resource://gre/modules/Log.jsm");
ChromeUtils.import("resource://services-sync/engines/bookmarks.js");
ChromeUtils.import("resource://services-sync/keys.js");
ChromeUtils.import("resource://services-sync/record.js");
ChromeUtils.import("resource://services-sync/service.js");
ChromeUtils.import("resource://services-sync/util.js");
ChromeUtils.import("resource://testing-common/services/sync/utils.js");

function prepareBookmarkItem(collection, id) {
  let b = new Bookmark(collection, id);
  b.cleartext.stuff = "my payload here";
  return b;
}

add_task(async function test_bookmark_record() {
  await configureIdentity();

  generateNewKeys(Service.collectionKeys);
  let keyBundle = Service.identity.syncKeyBundle;

  let log = Log.repository.getLogger("Test");
  Log.repository.rootLogger.addAppender(new Log.DumpAppender());

  log.info("Creating a record");

  let placesItem = new PlacesItem("bookmarks", "foo", "bookmark");
  let bookmarkItem = prepareBookmarkItem("bookmarks", "foo");

  log.info("Checking getTypeObject");
  Assert.equal(placesItem.getTypeObject(placesItem.type), Bookmark);
  Assert.equal(bookmarkItem.getTypeObject(bookmarkItem.type), Bookmark);

  bookmarkItem.encrypt(keyBundle);
  log.info("Ciphertext is " + bookmarkItem.ciphertext);
  Assert.ok(bookmarkItem.ciphertext != null);

  log.info("Decrypting the record");

  let payload = bookmarkItem.decrypt(keyBundle);
  Assert.equal(payload.stuff, "my payload here");
  Assert.equal(bookmarkItem.getTypeObject(bookmarkItem.type), Bookmark);
  Assert.notEqual(payload, bookmarkItem.payload); // wrap.data.payload is the encrypted one
});
