/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

ChromeUtils.import("resource://services-common/rest.js");
ChromeUtils.import("resource://services-sync/constants.js");
ChromeUtils.import("resource://services-sync/service.js");
ChromeUtils.import("resource://services-sync/util.js");
ChromeUtils.import("resource://testing-common/services/sync/utils.js");

var httpProtocolHandler = Cc["@mozilla.org/network/protocol;1?name=http"]
                          .getService(Ci.nsIHttpProtocolHandler);

var collections = {steam:  65.11328,
                   petrol: 82.488281,
                   diesel: 2.25488281};

function run_test() {
  Log.repository.getLogger("Sync.Service").level = Log.Level.Trace;
  Log.repository.getLogger("Sync.StorageRequest").level = Log.Level.Trace;
  initTestLogging();

  run_next_test();
}

add_task(async function test_success() {
  let handler = httpd_handler(200, "OK", JSON.stringify(collections));
  let server = httpd_setup({"/1.1/johndoe/info/collections": handler});
  await configureIdentity({ username: "johndoe" }, server);

  let request = Service.getStorageInfo("collections", function(error, info) {
    Assert.equal(error, null);
    Assert.ok(Utils.deepEquals(info, collections));

    // Ensure that the request is sent off with the right bits.
    Assert.ok(has_hawk_header(handler.request));
    let expectedUA = Services.appinfo.name + "/" + Services.appinfo.version +
                     " (" + httpProtocolHandler.oscpu + ")" +
                     " FxSync/" + WEAVE_VERSION + "." +
                     Services.appinfo.appBuildID + ".desktop";
    Assert.equal(handler.request.getHeader("User-Agent"), expectedUA);

    server.stop(run_next_test);
  });
  Assert.ok(request instanceof RESTRequest);
});

add_test(function test_invalid_type() {
  do_check_throws(function() {
    Service.getStorageInfo("invalid", function(error, info) {
      do_throw("Shouldn't get here!");
    });
  });
  run_next_test();
});

add_test(function test_network_error() {
  Service.getStorageInfo(INFO_COLLECTIONS, function(error, info) {
    Assert.equal(error.result, Cr.NS_ERROR_CONNECTION_REFUSED);
    Assert.equal(info, null);
    run_next_test();
  });
});

add_task(async function test_http_error() {
  let handler = httpd_handler(500, "Oh noez", "Something went wrong!");
  let server = httpd_setup({"/1.1/johndoe/info/collections": handler});
  await configureIdentity({ username: "johndoe" }, server);

  Service.getStorageInfo(INFO_COLLECTIONS, function(error, info) {
    Assert.equal(error.status, 500);
    Assert.equal(info, null);
    server.stop(run_next_test);
  });
});

add_task(async function test_invalid_json() {
  let handler = httpd_handler(200, "OK", "Invalid JSON");
  let server = httpd_setup({"/1.1/johndoe/info/collections": handler});
  await configureIdentity({ username: "johndoe" }, server);

  Service.getStorageInfo(INFO_COLLECTIONS, function(error, info) {
    Assert.equal(error.name, "SyntaxError");
    Assert.equal(info, null);
    server.stop(run_next_test);
  });
});
