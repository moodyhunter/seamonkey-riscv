/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

ChromeUtils.import("resource://gre/modules/Log.jsm");
ChromeUtils.import("resource://services-sync/constants.js");
ChromeUtils.import("resource://services-sync/rest.js");
ChromeUtils.import("resource://services-sync/service.js");
ChromeUtils.import("resource://services-sync/util.js");
ChromeUtils.import("resource://testing-common/services/sync/utils.js");

var httpProtocolHandler = Cc["@mozilla.org/network/protocol;1?name=http"]
                          .getService(Ci.nsIHttpProtocolHandler);

function run_test() {
  Log.repository.getLogger("Sync.RESTRequest").level = Log.Level.Trace;
  initTestLogging();

  run_next_test();
}

add_test(function test_user_agent_desktop() {
  let handler = httpd_handler(200, "OK");
  let server = httpd_setup({"/resource": handler});

  let expectedUA = Services.appinfo.name + "/" + Services.appinfo.version +
                   " (" + httpProtocolHandler.oscpu + ")" +
                   " FxSync/" + WEAVE_VERSION + "." +
                   Services.appinfo.appBuildID + ".desktop";

  let request = new SyncStorageRequest(server.baseURI + "/resource");
  request.onComplete = function onComplete(error) {
    Assert.equal(error, null);
    Assert.equal(this.response.status, 200);
    Assert.equal(handler.request.getHeader("User-Agent"), expectedUA);
    server.stop(run_next_test);
  };
  Assert.equal(request.get(), request);
});

add_test(function test_user_agent_mobile() {
  let handler = httpd_handler(200, "OK");
  let server = httpd_setup({"/resource": handler});

  Svc.Prefs.set("client.type", "mobile");
  let expectedUA = Services.appinfo.name + "/" + Services.appinfo.version +
                   " (" + httpProtocolHandler.oscpu + ")" +
                   " FxSync/" + WEAVE_VERSION + "." +
                   Services.appinfo.appBuildID + ".mobile";

  let request = new SyncStorageRequest(server.baseURI + "/resource");
  request.get(function(error) {
    Assert.equal(error, null);
    Assert.equal(this.response.status, 200);
    Assert.equal(handler.request.getHeader("User-Agent"), expectedUA);
    Svc.Prefs.resetBranch("");
    server.stop(run_next_test);
  });
});

add_task(async function test_auth() {
  let handler = httpd_handler(200, "OK");
  let server = httpd_setup({"/resource": handler});
  await configureIdentity({ username: "foo" }, server);

  let request = Service.getStorageRequest(server.baseURI + "/resource");
  request.get(function(error) {
    Assert.equal(error, null);
    Assert.equal(this.response.status, 200);
    Assert.ok(has_hawk_header(handler.request));

    Svc.Prefs.reset("");

    server.stop(run_next_test);
  });
});

/**
 *  The X-Weave-Timestamp header updates SyncStorageRequest.serverTime.
 */
add_test(function test_weave_timestamp() {
  const TIMESTAMP = 1274380461;
  function handler(request, response) {
    response.setHeader("X-Weave-Timestamp", "" + TIMESTAMP, false);
    response.setStatusLine(request.httpVersion, 200, "OK");
  }
  let server = httpd_setup({"/resource": handler});

  Assert.equal(SyncStorageRequest.serverTime, undefined);
  let request = new SyncStorageRequest(server.baseURI + "/resource");
  request.get(function(error) {
    Assert.equal(error, null);
    Assert.equal(this.response.status, 200);
    Assert.equal(SyncStorageRequest.serverTime, TIMESTAMP);
    delete SyncStorageRequest.serverTime;
    server.stop(run_next_test);
  });
});

/**
 * The X-Weave-Backoff header notifies an observer.
 */
add_test(function test_weave_backoff() {
  function handler(request, response) {
    response.setHeader("X-Weave-Backoff", "600", false);
    response.setStatusLine(request.httpVersion, 200, "OK");
  }
  let server = httpd_setup({"/resource": handler});

  let backoffInterval;
  Svc.Obs.add("weave:service:backoff:interval", function onBackoff(subject) {
    Svc.Obs.remove("weave:service:backoff:interval", onBackoff);
    backoffInterval = subject;
  });

  let request = new SyncStorageRequest(server.baseURI + "/resource");
  request.get(function(error) {
    Assert.equal(error, null);
    Assert.equal(this.response.status, 200);
    Assert.equal(backoffInterval, 600);
    server.stop(run_next_test);
  });
});

/**
 * X-Weave-Quota-Remaining header notifies observer on successful requests.
 */
add_test(function test_weave_quota_notice() {
  function handler(request, response) {
    response.setHeader("X-Weave-Quota-Remaining", "1048576", false);
    response.setStatusLine(request.httpVersion, 200, "OK");
  }
  let server = httpd_setup({"/resource": handler});

  let quotaValue;
  Svc.Obs.add("weave:service:quota:remaining", function onQuota(subject) {
    Svc.Obs.remove("weave:service:quota:remaining", onQuota);
    quotaValue = subject;
  });

  let request = new SyncStorageRequest(server.baseURI + "/resource");
  request.get(function(error) {
    Assert.equal(error, null);
    Assert.equal(this.response.status, 200);
    Assert.equal(quotaValue, 1048576);
    server.stop(run_next_test);
  });
});

/**
 * X-Weave-Quota-Remaining header doesn't notify observer on failed requests.
 */
add_test(function test_weave_quota_error() {
  function handler(request, response) {
    response.setHeader("X-Weave-Quota-Remaining", "1048576", false);
    response.setStatusLine(request.httpVersion, 400, "Bad Request");
  }
  let server = httpd_setup({"/resource": handler});

  let quotaValue;
  function onQuota(subject) {
    quotaValue = subject;
  }
  Svc.Obs.add("weave:service:quota:remaining", onQuota);

  let request = new SyncStorageRequest(server.baseURI + "/resource");
  request.get(function(error) {
    Assert.equal(error, null);
    Assert.equal(this.response.status, 400);
    Assert.equal(quotaValue, undefined);
    Svc.Obs.remove("weave:service:quota:remaining", onQuota);
    server.stop(run_next_test);
  });
});

add_test(function test_abort() {
  const TIMESTAMP = 1274380462;
  function handler(request, response) {
    response.setHeader("X-Weave-Timestamp", "" + TIMESTAMP, false);
    response.setHeader("X-Weave-Quota-Remaining", "1048576", false);
    response.setHeader("X-Weave-Backoff", "600", false);
    response.setStatusLine(request.httpVersion, 200, "OK");
  }
  let server = httpd_setup({"/resource": handler});

  let request = new SyncStorageRequest(server.baseURI + "/resource");

  // Aborting a request that hasn't been sent yet is pointless and will throw.
  do_check_throws(function() {
    request.abort();
  });

  function throwy() {
    do_throw("Shouldn't have gotten here!");
  }

  Svc.Obs.add("weave:service:backoff:interval", throwy);
  Svc.Obs.add("weave:service:quota:remaining", throwy);
  request.onProgress = request.onComplete = throwy;

  request.get();
  request.abort();
  Assert.equal(request.status, request.ABORTED);

  // Aborting an already aborted request is pointless and will throw.
  do_check_throws(function() {
    request.abort();
  });

  Utils.nextTick(function() {
    // Verify that we didn't try to process any of the values.
    Assert.equal(SyncStorageRequest.serverTime, undefined);

    Svc.Obs.remove("weave:service:backoff:interval", throwy);
    Svc.Obs.remove("weave:service:quota:remaining", throwy);

    server.stop(run_next_test);
  });
});
