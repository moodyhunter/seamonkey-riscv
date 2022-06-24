/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

ChromeUtils.import("resource://gre/modules/XPCOMUtils.jsm");
ChromeUtils.import("resource://gre/modules/Services.jsm");
ChromeUtils.import("resource://gre/modules/FormHistory.jsm");
ChromeUtils.import("resource://services-common/async.js");
ChromeUtils.import("resource://services-common/utils.js");

_("Make sure querySpinningly will synchronously fetch rows for a query asyncly");

const SQLITE_CONSTRAINT_VIOLATION = 19;  // http://www.sqlite.org/c3ref/c_abort.html

// This test is a bit hacky - it was originally written to use the
// formhistory.sqlite database using the nsIFormHistory2 sync APIs. However,
// that's now been deprecated in favour of the async FormHistory.jsm.
// Rather than re-write the test completely, we cheat - we use FormHistory.jsm
// to initialize the database, then we just re-open it for these tests.

// Init the forms database.
FormHistory.schemaVersion;
FormHistory.shutdown();

// and open the database it just created.
let dbFile = Services.dirsvc.get("ProfD", Ci.nsIFile).clone();
dbFile.append("formhistory.sqlite");
let dbConnection = Services.storage.openUnsharedDatabase(dbFile);

registerCleanupFunction(() => {
  let cb = Async.makeSpinningCallback();
  dbConnection.asyncClose(cb);
  return cb.wait();
});

function querySpinningly(query, names) {
  let q = dbConnection.createStatement(query);
  let r = Async.querySpinningly(q, names);
  q.finalize();
  return r;
}

function run_test() {
  initTestLogging("Trace");

  _("Make sure the call is async and allows other events to process");
  let isAsync = false;
  CommonUtils.nextTick(function() { isAsync = true; });
  Assert.ok(!isAsync);

  _("Empty out the formhistory table");
  let r0 = querySpinningly("DELETE FROM moz_formhistory");
  Assert.equal(r0, null);

  _("Make sure there's nothing there");
  let r1 = querySpinningly("SELECT 1 FROM moz_formhistory");
  Assert.equal(r1, null);

  _("Insert a row");
  let r2 = querySpinningly("INSERT INTO moz_formhistory (fieldname, value) VALUES ('foo', 'bar')");
  Assert.equal(r2, null);

  _("Request a known value for the one row");
  let r3 = querySpinningly("SELECT 42 num FROM moz_formhistory", ["num"]);
  Assert.equal(r3.length, 1);
  Assert.equal(r3[0].num, 42);

  _("Get multiple columns");
  let r4 = querySpinningly("SELECT fieldname, value FROM moz_formhistory", ["fieldname", "value"]);
  Assert.equal(r4.length, 1);
  Assert.equal(r4[0].fieldname, "foo");
  Assert.equal(r4[0].value, "bar");

  _("Get multiple columns with a different order");
  let r5 = querySpinningly("SELECT fieldname, value FROM moz_formhistory", ["value", "fieldname"]);
  Assert.equal(r5.length, 1);
  Assert.equal(r5[0].fieldname, "foo");
  Assert.equal(r5[0].value, "bar");

  _("Add multiple entries (sqlite doesn't support multiple VALUES)");
  let r6 = querySpinningly("INSERT INTO moz_formhistory (fieldname, value) SELECT 'foo', 'baz' UNION SELECT 'more', 'values'");
  Assert.equal(r6, null);

  _("Get multiple rows");
  let r7 = querySpinningly("SELECT fieldname, value FROM moz_formhistory WHERE fieldname = 'foo'", ["fieldname", "value"]);
  Assert.equal(r7.length, 2);
  Assert.equal(r7[0].fieldname, "foo");
  Assert.equal(r7[1].fieldname, "foo");

  _("Make sure updates work");
  let r8 = querySpinningly("UPDATE moz_formhistory SET value = 'updated' WHERE fieldname = 'more'");
  Assert.equal(r8, null);

  _("Get the updated");
  let r9 = querySpinningly("SELECT value, fieldname FROM moz_formhistory WHERE fieldname = 'more'", ["fieldname", "value"]);
  Assert.equal(r9.length, 1);
  Assert.equal(r9[0].fieldname, "more");
  Assert.equal(r9[0].value, "updated");

  _("Grabbing fewer fields than queried is fine");
  let r10 = querySpinningly("SELECT value, fieldname FROM moz_formhistory", ["fieldname"]);
  Assert.equal(r10.length, 3);

  _("Generate an execution error");
  let query = "INSERT INTO moz_formhistory (fieldname, value) VALUES ('one', NULL)";
  let stmt = dbConnection.createStatement(query);
  let except;
  try {
    Async.querySpinningly(stmt);
  } catch (e) {
    except = e;
  }
  stmt.finalize();
  Assert.ok(!!except);
  Assert.equal(except.result, SQLITE_CONSTRAINT_VIOLATION);

  _("Cleaning up");
  querySpinningly("DELETE FROM moz_formhistory");

  _("Make sure the timeout got to run before this function ends");
  Assert.ok(isAsync);
}
