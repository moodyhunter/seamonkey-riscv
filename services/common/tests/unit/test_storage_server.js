/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

ChromeUtils.import("resource://services-common/async.js");
ChromeUtils.import("resource://services-common/rest.js");
ChromeUtils.import("resource://services-common/utils.js");
ChromeUtils.import("resource://testing-common/services/common/storageserver.js");

const DEFAULT_USER = "123";
const DEFAULT_PASSWORD = "password";

/**
 * Helper function to prepare a RESTRequest against the server.
 */
function localRequest(server, path, user = DEFAULT_USER, password = DEFAULT_PASSWORD) {
  _("localRequest: " + path);
  let identity = server.server.identity;
  let url = identity.primaryScheme + "://" + identity.primaryHost + ":" +
            identity.primaryPort + path;
  _("url: " + url);
  let req = new RESTRequest(url);

  let header = basic_auth_header(user, password);
  req.setHeader("Authorization", header);
  req.setHeader("Accept", "application/json");

  return req;
}

/**
 * Helper function to validate an HTTP response from the server.
 */
function validateResponse(response) {
  Assert.ok("x-timestamp" in response.headers);

  if ("content-length" in response.headers) {
    let cl = parseInt(response.headers["content-length"]);

    if (cl != 0) {
      Assert.ok("content-type" in response.headers);
      Assert.equal("application/json", response.headers["content-type"]);
    }
  }

  if (response.status == 204 || response.status == 304) {
    Assert.ok(!"content-type" in response.headers);

    if ("content-length" in response.headers) {
      Assert.equal(response.headers["content-length"], "0");
    }
  }

  if (response.status == 405) {
    Assert.ok("allow" in response.headers);
  }
}

/**
 * Helper function to synchronously wait for a response and validate it.
 */
function waitAndValidateResponse(cb, request) {
  let error = cb.wait();

  if (!error) {
    validateResponse(request.response);
  }

  return error;
}

/**
 * Helper function to synchronously perform a GET request.
 *
 * @return Error instance or null if no error.
 */
function doGetRequest(request) {
  let cb = Async.makeSpinningCallback();
  request.get(cb);

  return waitAndValidateResponse(cb, request);
}

/**
 * Helper function to synchronously perform a PUT request.
 *
 * @return Error instance or null if no error.
 */
function doPutRequest(request, data) {
  let cb = Async.makeSpinningCallback();
  request.put(data, cb);

  return waitAndValidateResponse(cb, request);
}

/**
 * Helper function to synchronously perform a DELETE request.
 *
 * @return Error or null if no error was encountered.
 */
function doDeleteRequest(request) {
  let cb = Async.makeSpinningCallback();
  request.delete(cb);

  return waitAndValidateResponse(cb, request);
}

function run_test() {
  Log.repository.getLogger("Services.Common.Test.StorageServer").level =
    Log.Level.Trace;
  initTestLogging();

  run_next_test();
}

add_test(function test_creation() {
  _("Ensure a simple server can be created.");

  // Explicit callback for this one.
  let server = new StorageServer({
    __proto__: StorageServerCallback,
  });
  Assert.ok(!!server);

  server.start(-1, function() {
    _("Started on " + server.port);
    server.stop(run_next_test);
  });
});

add_test(function test_synchronous_start() {
  _("Ensure starting using startSynchronous works.");

  let server = new StorageServer();
  server.startSynchronous();
  server.stop(run_next_test);
});

add_test(function test_url_parsing() {
  _("Ensure server parses URLs properly.");

  let server = new StorageServer();

  // Check that we can parse a BSO URI.
  let parts = server.pathRE.exec("/2.0/12345/storage/crypto/keys");
  let [all, version, user, first, rest] = parts;
  Assert.equal(all, "/2.0/12345/storage/crypto/keys");
  Assert.equal(version, "2.0");
  Assert.equal(user, "12345");
  Assert.equal(first, "storage");
  Assert.equal(rest, "crypto/keys");
  Assert.equal(null, server.pathRE.exec("/nothing/else"));

  // Check that we can parse a collection URI.
  parts = server.pathRE.exec("/2.0/123/storage/crypto");
  [all, version, user, first, rest] = parts;
  Assert.equal(all, "/2.0/123/storage/crypto");
  Assert.equal(version, "2.0");
  Assert.equal(user, "123");
  Assert.equal(first, "storage");
  Assert.equal(rest, "crypto");

  // We don't allow trailing slash on storage URI.
  parts = server.pathRE.exec("/2.0/1234/storage/");
  Assert.equal(parts, undefined);

  // storage alone is a valid request.
  parts = server.pathRE.exec("/2.0/123456/storage");
  [all, version, user, first, rest] = parts;
  Assert.equal(all, "/2.0/123456/storage");
  Assert.equal(version, "2.0");
  Assert.equal(user, "123456");
  Assert.equal(first, "storage");
  Assert.equal(rest, undefined);

  parts = server.storageRE.exec("storage");
  let collection;
  [all, , collection, ] = parts;
  Assert.equal(all, "storage");
  Assert.equal(collection, undefined);

  run_next_test();
});

add_test(function test_basic_http() {
  let server = new StorageServer();
  server.registerUser("345", "password");
  Assert.ok(server.userExists("345"));
  server.startSynchronous();

  _("Started on " + server.port);
  Assert.equal(server.requestCount, 0);
  let req = localRequest(server, "/2.0/storage/crypto/keys");
  _("req is " + req);
  req.get(function(err) {
    Assert.equal(null, err);
    Assert.equal(server.requestCount, 1);
    server.stop(run_next_test);
  });
});

add_test(function test_info_collections() {
  let server = new StorageServer();
  server.registerUser("123", "password");
  server.startSynchronous();

  let path = "/2.0/123/info/collections";

  _("info/collections on empty server should be empty object.");
  let request = localRequest(server, path, "123", "password");
  let error = doGetRequest(request);
  Assert.equal(error, null);
  Assert.equal(request.response.status, 200);
  Assert.equal(request.response.body, "{}");

  _("Creating an empty collection should result in collection appearing.");
  let coll = server.createCollection("123", "col1");
  request = localRequest(server, path, "123", "password");
  error = doGetRequest(request);
  Assert.equal(error, null);
  Assert.equal(request.response.status, 200);
  let info = JSON.parse(request.response.body);
  do_check_attribute_count(info, 1);
  Assert.ok("col1" in info);
  Assert.equal(info.col1, coll.timestamp);

  server.stop(run_next_test);
});

add_test(function test_bso_get_existing() {
  _("Ensure that BSO retrieval works.");

  let server = new StorageServer();
  server.registerUser("123", "password");
  server.createContents("123", {
    test: {"bso": {"foo": "bar"}}
  });
  server.startSynchronous();

  let coll = server.user("123").collection("test");

  let request = localRequest(server, "/2.0/123/storage/test/bso", "123",
                             "password");
  let error = doGetRequest(request);
  Assert.equal(error, null);
  Assert.equal(request.response.status, 200);
  Assert.equal(request.response.headers["content-type"], "application/json");
  let bso = JSON.parse(request.response.body);
  do_check_attribute_count(bso, 3);
  Assert.equal(bso.id, "bso");
  Assert.equal(bso.modified, coll.bso("bso").modified);
  let payload = JSON.parse(bso.payload);
  do_check_attribute_count(payload, 1);
  Assert.equal(payload.foo, "bar");

  server.stop(run_next_test);
});

add_test(function test_percent_decoding() {
  _("Ensure query string arguments with percent encoded are handled.");

  let server = new StorageServer();
  server.registerUser("123", "password");
  server.startSynchronous();

  let coll = server.user("123").createCollection("test");
  coll.insert("001", {foo: "bar"});
  coll.insert("002", {bar: "foo"});

  let request = localRequest(server, "/2.0/123/storage/test?ids=001%2C002",
                             "123", "password");
  let error = doGetRequest(request);
  Assert.equal(null, error);
  Assert.equal(request.response.status, 200);
  let items = JSON.parse(request.response.body).items;
  do_check_attribute_count(items, 2);

  server.stop(run_next_test);
});

add_test(function test_bso_404() {
  _("Ensure the server responds with a 404 if a BSO does not exist.");

  let server = new StorageServer();
  server.registerUser("123", "password");
  server.createContents("123", {
    test: {}
  });
  server.startSynchronous();

  let request = localRequest(server, "/2.0/123/storage/test/foo");
  let error = doGetRequest(request);
  Assert.equal(error, null);

  Assert.equal(request.response.status, 404);
  Assert.ok(!"content-type" in request.response.headers);

  server.stop(run_next_test);
});

add_test(function test_bso_if_modified_since_304() {
  _("Ensure the server responds properly to X-If-Modified-Since for BSOs.");

  let server = new StorageServer();
  server.registerUser("123", "password");
  server.createContents("123", {
    test: {bso: {foo: "bar"}}
  });
  server.startSynchronous();

  let coll = server.user("123").collection("test");
  Assert.notEqual(coll, null);

  // Rewind clock just in case.
  coll.timestamp -= 10000;
  coll.bso("bso").modified -= 10000;

  let request = localRequest(server, "/2.0/123/storage/test/bso",
                             "123", "password");
  request.setHeader("X-If-Modified-Since", "" + server.serverTime());
  let error = doGetRequest(request);
  Assert.equal(null, error);

  Assert.equal(request.response.status, 304);
  Assert.ok(!"content-type" in request.response.headers);

  request = localRequest(server, "/2.0/123/storage/test/bso",
                             "123", "password");
  request.setHeader("X-If-Modified-Since", "" + (server.serverTime() - 20000));
  error = doGetRequest(request);
  Assert.equal(null, error);
  Assert.equal(request.response.status, 200);
  Assert.equal(request.response.headers["content-type"], "application/json");

  server.stop(run_next_test);
});

add_test(function test_bso_if_unmodified_since() {
  _("Ensure X-If-Unmodified-Since works properly on BSOs.");

  let server = new StorageServer();
  server.registerUser("123", "password");
  server.createContents("123", {
    test: {bso: {foo: "bar"}}
  });
  server.startSynchronous();

  let coll = server.user("123").collection("test");
  Assert.notEqual(coll, null);

  let time = coll.bso("bso").modified;

  _("Ensure we get a 412 for specified times older than server time.");
  let request = localRequest(server, "/2.0/123/storage/test/bso",
                             "123", "password");
  request.setHeader("X-If-Unmodified-Since", time - 5000);
  request.setHeader("Content-Type", "application/json");
  let payload = JSON.stringify({"payload": "foobar"});
  let error = doPutRequest(request, payload);
  Assert.equal(null, error);
  Assert.equal(request.response.status, 412);

  _("Ensure we get a 204 if update goes through.");
  request = localRequest(server, "/2.0/123/storage/test/bso",
                         "123", "password");
  request.setHeader("Content-Type", "application/json");
  request.setHeader("X-If-Unmodified-Since", time + 1);
  error = doPutRequest(request, payload);
  Assert.equal(null, error);
  Assert.equal(request.response.status, 204);
  Assert.ok(coll.timestamp > time);

  // Not sure why a client would send X-If-Unmodified-Since if a BSO doesn't
  // exist. But, why not test it?
  _("Ensure we get a 201 if creation goes through.");
  request = localRequest(server, "/2.0/123/storage/test/none",
                         "123", "password");
  request.setHeader("Content-Type", "application/json");
  request.setHeader("X-If-Unmodified-Since", time);
  error = doPutRequest(request, payload);
  Assert.equal(null, error);
  Assert.equal(request.response.status, 201);

  server.stop(run_next_test);
});

add_test(function test_bso_delete_not_exist() {
  _("Ensure server behaves properly when deleting a BSO that does not exist.");

  let server = new StorageServer();
  server.registerUser("123", "password");
  server.user("123").createCollection("empty");
  server.startSynchronous();

  server.callback.onItemDeleted = function onItemDeleted(username, collection,
                                                         id) {
    do_throw("onItemDeleted should not have been called.");
  };

  let request = localRequest(server, "/2.0/123/storage/empty/nada",
                             "123", "password");
  let error = doDeleteRequest(request);
  Assert.equal(error, null);
  Assert.equal(request.response.status, 404);
  Assert.ok(!"content-type" in request.response.headers);

  server.stop(run_next_test);
});

add_test(function test_bso_delete_exists() {
  _("Ensure proper semantics when deleting a BSO that exists.");

  let server = new StorageServer();
  server.registerUser("123", "password");
  server.startSynchronous();

  let coll = server.user("123").createCollection("test");
  coll.insert("myid", {foo: "bar"});
  let timestamp = coll.timestamp;

  server.callback.onItemDeleted = function onDeleted(username, collection, id) {
    delete server.callback.onItemDeleted;
    Assert.equal(username, "123");
    Assert.equal(collection, "test");
    Assert.equal(id, "myid");
  };

  let request = localRequest(server, "/2.0/123/storage/test/myid",
                             "123", "password");
  let error = doDeleteRequest(request);
  Assert.equal(error, null);
  Assert.equal(request.response.status, 204);
  Assert.equal(coll.bsos().length, 0);
  Assert.ok(coll.timestamp > timestamp);

  _("On next request the BSO should not exist.");
  request = localRequest(server, "/2.0/123/storage/test/myid",
                         "123", "password");
  error = doGetRequest(request);
  Assert.equal(error, null);
  Assert.equal(request.response.status, 404);

  server.stop(run_next_test);
});

add_test(function test_bso_delete_unmodified() {
  _("Ensure X-If-Unmodified-Since works when deleting BSOs.");

  let server = new StorageServer();
  server.startSynchronous();
  server.registerUser("123", "password");
  let coll = server.user("123").createCollection("test");
  let bso = coll.insert("myid", {foo: "bar"});

  let modified = bso.modified;

  _("Issuing a DELETE with an older time should fail.");
  let path = "/2.0/123/storage/test/myid";
  let request = localRequest(server, path, "123", "password");
  request.setHeader("X-If-Unmodified-Since", modified - 1000);
  let error = doDeleteRequest(request);
  Assert.equal(error, null);
  Assert.equal(request.response.status, 412);
  Assert.ok(!"content-type" in request.response.headers);
  Assert.notEqual(coll.bso("myid"), null);

  _("Issuing a DELETE with a newer time should work.");
  request = localRequest(server, path, "123", "password");
  request.setHeader("X-If-Unmodified-Since", modified + 1000);
  error = doDeleteRequest(request);
  Assert.equal(error, null);
  Assert.equal(request.response.status, 204);
  Assert.ok(coll.bso("myid").deleted);

  server.stop(run_next_test);
});

add_test(function test_collection_get_unmodified_since() {
  _("Ensure conditional unmodified get on collection works when it should.");

  let server = new StorageServer();
  server.registerUser("123", "password");
  server.startSynchronous();
  let collection = server.user("123").createCollection("testcoll");
  collection.insert("bso0", {foo: "bar"});

  let serverModified = collection.timestamp;

  let request1 = localRequest(server, "/2.0/123/storage/testcoll",
                              "123", "password");
  request1.setHeader("X-If-Unmodified-Since", serverModified);
  let error = doGetRequest(request1);
  Assert.equal(null, error);
  Assert.equal(request1.response.status, 200);

  let request2 = localRequest(server, "/2.0/123/storage/testcoll",
                              "123", "password");
  request2.setHeader("X-If-Unmodified-Since", serverModified - 1);
  error = doGetRequest(request2);
  Assert.equal(null, error);
  Assert.equal(request2.response.status, 412);

  server.stop(run_next_test);
});

add_test(function test_bso_get_unmodified_since() {
  _("Ensure conditional unmodified get on BSO works appropriately.");

  let server = new StorageServer();
  server.registerUser("123", "password");
  server.startSynchronous();
  let collection = server.user("123").createCollection("testcoll");
  let bso = collection.insert("bso0", {foo: "bar"});

  let serverModified = bso.modified;

  let request1 = localRequest(server, "/2.0/123/storage/testcoll/bso0",
                              "123", "password");
  request1.setHeader("X-If-Unmodified-Since", serverModified);
  let error = doGetRequest(request1);
  Assert.equal(null, error);
  Assert.equal(request1.response.status, 200);

  let request2 = localRequest(server, "/2.0/123/storage/testcoll/bso0",
                              "123", "password");
  request2.setHeader("X-If-Unmodified-Since", serverModified - 1);
  error = doGetRequest(request2);
  Assert.equal(null, error);
  Assert.equal(request2.response.status, 412);

  server.stop(run_next_test);
});

add_test(function test_missing_collection_404() {
  _("Ensure a missing collection returns a 404.");

  let server = new StorageServer();
  server.registerUser("123", "password");
  server.startSynchronous();

  let request = localRequest(server, "/2.0/123/storage/none", "123", "password");
  let error = doGetRequest(request);
  Assert.equal(error, null);
  Assert.equal(request.response.status, 404);
  Assert.ok(!"content-type" in request.response.headers);

  server.stop(run_next_test);
});

add_test(function test_get_storage_405() {
  _("Ensure that a GET on /storage results in a 405.");

  let server = new StorageServer();
  server.registerUser("123", "password");
  server.startSynchronous();

  let request = localRequest(server, "/2.0/123/storage", "123", "password");
  let error = doGetRequest(request);
  Assert.equal(error, null);
  Assert.equal(request.response.status, 405);
  Assert.equal(request.response.headers.allow, "DELETE");

  server.stop(run_next_test);
});

add_test(function test_delete_storage() {
  _("Ensure that deleting all of storage works.");

  let server = new StorageServer();
  server.registerUser("123", "password");
  server.createContents("123", {
    foo: {a: {foo: "bar"}, b: {bar: "foo"}},
    baz: {c: {bob: "law"}, blah: {law: "blog"}}
  });

  server.startSynchronous();

  let request = localRequest(server, "/2.0/123/storage", "123", "password");
  let error = doDeleteRequest(request);
  Assert.equal(error, null);
  Assert.equal(request.response.status, 204);
  do_check_attribute_count(server.users["123"].collections, 0);

  server.stop(run_next_test);
});

add_test(function test_x_num_records() {
  let server = new StorageServer();
  server.registerUser("123", "password");

  server.createContents("123", {
    crypto: {foos: {foo: "bar"},
             bars: {foo: "baz"}}
  });
  server.startSynchronous();
  let bso = localRequest(server, "/2.0/123/storage/crypto/foos");
  bso.get(function(err) {
    // BSO fetches don't have one.
    Assert.ok(!"x-num-records" in this.response.headers);
    let col = localRequest(server, "/2.0/123/storage/crypto");
    col.get(function(err2) {
      // Collection fetches do.
      Assert.equal(this.response.headers["x-num-records"], "2");
      server.stop(run_next_test);
    });
  });
});

add_test(function test_put_delete_put() {
  _("Bug 790397: Ensure BSO deleted flag is reset on PUT.");

  let server = new StorageServer();
  server.registerUser("123", "password");
  server.createContents("123", {
    test: {bso: {foo: "bar"}}
  });
  server.startSynchronous();

  _("Ensure we can PUT an existing record.");
  let request1 = localRequest(server, "/2.0/123/storage/test/bso", "123", "password");
  request1.setHeader("Content-Type", "application/json");
  let payload1 = JSON.stringify({"payload": "foobar"});
  let error1 = doPutRequest(request1, payload1);
  Assert.equal(null, error1);
  Assert.equal(request1.response.status, 204);

  _("Ensure we can DELETE it.");
  let request2 = localRequest(server, "/2.0/123/storage/test/bso", "123", "password");
  let error2 = doDeleteRequest(request2);
  Assert.equal(error2, null);
  Assert.equal(request2.response.status, 204);
  Assert.ok(!"content-type" in request2.response.headers);

  _("Ensure we can PUT a previously deleted record.");
  let request3 = localRequest(server, "/2.0/123/storage/test/bso", "123", "password");
  request3.setHeader("Content-Type", "application/json");
  let payload3 = JSON.stringify({"payload": "foobar"});
  let error3 = doPutRequest(request3, payload3);
  Assert.equal(null, error3);
  Assert.equal(request3.response.status, 201);

  _("Ensure we can GET the re-uploaded record.");
  let request4 = localRequest(server, "/2.0/123/storage/test/bso", "123", "password");
  let error4 = doGetRequest(request4);
  Assert.equal(error4, null);
  Assert.equal(request4.response.status, 200);
  Assert.equal(request4.response.headers["content-type"], "application/json");

  server.stop(run_next_test);
});

add_test(function test_collection_get_newer() {
  _("Ensure get with newer argument on collection works.");

  let server = new StorageServer();
  server.registerUser("123", "password");
  server.startSynchronous();

  let coll = server.user("123").createCollection("test");
  let bso1 = coll.insert("001", {foo: "bar"});
  let bso2 = coll.insert("002", {bar: "foo"});

  // Don't want both records to have the same timestamp.
  bso2.modified = bso1.modified + 1000;

  function newerRequest(newer) {
    return localRequest(server, "/2.0/123/storage/test?newer=" + newer,
                        "123", "password");
  }

  let request1 = newerRequest(0);
  let error1 = doGetRequest(request1);
  Assert.equal(null, error1);
  Assert.equal(request1.response.status, 200);
  let items1 = JSON.parse(request1.response.body).items;
  do_check_attribute_count(items1, 2);

  let request2 = newerRequest(bso1.modified + 1);
  let error2 = doGetRequest(request2);
  Assert.equal(null, error2);
  Assert.equal(request2.response.status, 200);
  let items2 = JSON.parse(request2.response.body).items;
  do_check_attribute_count(items2, 1);

  let request3 = newerRequest(bso2.modified + 1);
  let error3 = doGetRequest(request3);
  Assert.equal(null, error3);
  Assert.equal(request3.response.status, 200);
  let items3 = JSON.parse(request3.response.body).items;
  do_check_attribute_count(items3, 0);

  server.stop(run_next_test);
});
