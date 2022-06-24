/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

ChromeUtils.import("resource://gre/modules/Log.jsm");
ChromeUtils.import("resource://services-common/observers.js");
ChromeUtils.import("resource://services-sync/resource.js");
ChromeUtils.import("resource://services-sync/status.js");
ChromeUtils.import("resource://services-sync/util.js");
ChromeUtils.import("resource://services-sync/browserid_identity.js");
ChromeUtils.import("resource://testing-common/services/sync/utils.js");

var fetched = false;
function server_open(metadata, response) {
  let body;
  if (metadata.method == "GET") {
    fetched = true;
    body = "This path exists";
    response.setStatusLine(metadata.httpVersion, 200, "OK");
  } else {
    body = "Wrong request method";
    response.setStatusLine(metadata.httpVersion, 405, "Method Not Allowed");
  }
  response.bodyOutputStream.write(body, body.length);
}

function server_protected(metadata, response) {
  let body;

  if (has_hawk_header(metadata)) {
    body = "This path exists and is protected";
    response.setStatusLine(metadata.httpVersion, 200, "OK, authorized");
    response.setHeader("WWW-Authenticate", 'Basic realm="secret"', false);
  } else {
    body = "This path exists and is protected - failed";
    response.setStatusLine(metadata.httpVersion, 401, "Unauthorized");
    response.setHeader("WWW-Authenticate", 'Basic realm="secret"', false);
  }

  response.bodyOutputStream.write(body, body.length);
}

function server_404(metadata, response) {
  let body = "File not found";
  response.setStatusLine(metadata.httpVersion, 404, "Not Found");
  response.bodyOutputStream.write(body, body.length);
}

var pacFetched = false;
function server_pac(metadata, response) {
  pacFetched = true;
  let body = 'function FindProxyForURL(url, host) { return "DIRECT"; }';
  response.setStatusLine(metadata.httpVersion, 200, "OK");
  response.setHeader("Content-Type", "application/x-ns-proxy-autoconfig", false);
  response.bodyOutputStream.write(body, body.length);
}


var sample_data = {
  some: "sample_data",
  injson: "format",
  number: 42
};

function server_upload(metadata, response) {
  let body;

  let input = readBytesFromInputStream(metadata.bodyInputStream);
  if (input == JSON.stringify(sample_data)) {
    body = "Valid data upload via " + metadata.method;
    response.setStatusLine(metadata.httpVersion, 200, "OK");
  } else {
    body = "Invalid data upload via " + metadata.method + ": " + input;
    response.setStatusLine(metadata.httpVersion, 500, "Internal Server Error");
  }

  response.bodyOutputStream.write(body, body.length);
}

function server_delete(metadata, response) {
  let body;
  if (metadata.method == "DELETE") {
    body = "This resource has been deleted";
    response.setStatusLine(metadata.httpVersion, 200, "OK");
  } else {
    body = "Wrong request method";
    response.setStatusLine(metadata.httpVersion, 405, "Method Not Allowed");
  }
  response.bodyOutputStream.write(body, body.length);
}

function server_json(metadata, response) {
  let body = JSON.stringify(sample_data);
  response.setStatusLine(metadata.httpVersion, 200, "OK");
  response.bodyOutputStream.write(body, body.length);
}

const TIMESTAMP = 1274380461;

function server_timestamp(metadata, response) {
  let body = "Thank you for your request";
  response.setHeader("X-Weave-Timestamp", "" + TIMESTAMP, false);
  response.setStatusLine(metadata.httpVersion, 200, "OK");
  response.bodyOutputStream.write(body, body.length);
}

function server_backoff(metadata, response) {
  let body = "Hey, back off!";
  response.setHeader("X-Weave-Backoff", "600", false);
  response.setStatusLine(metadata.httpVersion, 200, "OK");
  response.bodyOutputStream.write(body, body.length);
}

function server_quota_notice(request, response) {
  let body = "You're approaching quota.";
  response.setHeader("X-Weave-Quota-Remaining", "1048576", false);
  response.setStatusLine(request.httpVersion, 200, "OK");
  response.bodyOutputStream.write(body, body.length);
}

function server_quota_error(request, response) {
  let body = "14";
  response.setHeader("X-Weave-Quota-Remaining", "-1024", false);
  response.setStatusLine(request.httpVersion, 400, "OK");
  response.bodyOutputStream.write(body, body.length);
}

function server_headers(metadata, response) {
  let ignore_headers = ["host", "user-agent", "accept", "accept-language",
                        "accept-encoding", "accept-charset", "keep-alive",
                        "connection", "pragma", "cache-control",
                        "content-length"];
  let headers = metadata.headers;
  let header_names = [];
  while (headers.hasMoreElements()) {
    let header = headers.getNext().toString();
    if (ignore_headers.indexOf(header) == -1) {
      header_names.push(header);
    }
  }
  header_names = header_names.sort();

  headers = {};
  for (let header of header_names) {
    headers[header] = metadata.getHeader(header);
  }
  let body = JSON.stringify(headers);
  response.setStatusLine(metadata.httpVersion, 200, "OK");
  response.bodyOutputStream.write(body, body.length);
}

add_task(async function test() {
  initTestLogging("Trace");

  let logger = Log.repository.getLogger("Test");
  Log.repository.rootLogger.addAppender(new Log.DumpAppender());

  let server = httpd_setup({
    "/open": server_open,
    "/protected": server_protected,
    "/404": server_404,
    "/upload": server_upload,
    "/delete": server_delete,
    "/json": server_json,
    "/timestamp": server_timestamp,
    "/headers": server_headers,
    "/backoff": server_backoff,
    "/pac1": server_pac,
    "/quota-notice": server_quota_notice,
    "/quota-error": server_quota_error
  });

  Svc.Prefs.set("network.numRetries", 1); // speed up test

  // This apparently has to come first in order for our PAC URL to be hit.
  // Don't put any other HTTP requests earlier in the file!
  _("Testing handling of proxy auth redirection.");
  PACSystemSettings.PACURI = server.baseURI + "/pac1";
  installFakePAC();
  let proxiedRes = new Resource(server.baseURI + "/open");
  let content = await proxiedRes.get();
  Assert.ok(pacFetched);
  Assert.ok(fetched);
  Assert.equal(content, "This path exists");
  pacFetched = fetched = false;
  uninstallFakePAC();

  _("Resource object members");
  let res = new Resource(server.baseURI + "/open");
  Assert.ok(res.uri instanceof Ci.nsIURI);
  Assert.equal(res.uri.spec, server.baseURI + "/open");
  Assert.equal(res.spec, server.baseURI + "/open");
  Assert.equal(typeof res.headers, "object");
  Assert.equal(typeof res.authenticator, "object");
  // Initially res.data is null since we haven't performed a GET or
  // PUT/POST request yet.
  Assert.equal(res.data, null);

  _("GET a non-password-protected resource");
  content = await res.get();
  Assert.equal(content, "This path exists");
  Assert.equal(content.status, 200);
  Assert.ok(content.success);
  // res.data has been updated with the result from the request
  Assert.equal(res.data, content);

  // Observe logging messages.
  logger = res._log;
  let dbg    = logger.debug;
  let debugMessages = [];
  logger.debug = function(msg) {
    debugMessages.push(msg);
    dbg.call(this, msg);
  };

  // Since we didn't receive proper JSON data, accessing content.obj
  // will result in a SyntaxError from JSON.parse.
  // Furthermore, we'll have logged.
  let didThrow = false;
  try {
    content.obj;
  } catch (ex) {
    didThrow = true;
  }
  Assert.ok(didThrow);
  Assert.equal(debugMessages.length, 1);
  Assert.equal(debugMessages[0],
              "Parse fail: Response body starts: \"\"This path exists\"\".");
  logger.debug = dbg;

  _("GET a password protected resource (test that it'll fail w/o pass, no throw)");
  let res2 = new Resource(server.baseURI + "/protected");
  content = await res2.get();
  Assert.equal(content, "This path exists and is protected - failed");
  Assert.equal(content.status, 401);
  Assert.ok(!content.success);

  _("GET a password protected resource");
  let res3 = new Resource(server.baseURI + "/protected");
  let identityConfig = makeIdentityConfig();
  let browseridManager = Status._authManager;
  configureFxAccountIdentity(browseridManager, identityConfig);
  let auth = browseridManager.getResourceAuthenticator();
  res3.authenticator = auth;
  Assert.equal(res3.authenticator, auth);
  content = await res3.get();
  Assert.equal(content, "This path exists and is protected");
  Assert.equal(content.status, 200);
  Assert.ok(content.success);

  _("GET a non-existent resource (test that it'll fail, but not throw)");
  let res4 = new Resource(server.baseURI + "/404");
  content = await res4.get();
  Assert.equal(content, "File not found");
  Assert.equal(content.status, 404);
  Assert.ok(!content.success);

  // Check some headers of the 404 response
  Assert.equal(content.headers.connection, "close");
  Assert.equal(content.headers.server, "httpd.js");
  Assert.equal(content.headers["content-length"], 14);

  _("PUT to a resource (string)");
  let res5 = new Resource(server.baseURI + "/upload");
  content = await res5.put(JSON.stringify(sample_data));
  Assert.equal(content, "Valid data upload via PUT");
  Assert.equal(content.status, 200);
  Assert.equal(res5.data, content);

  _("PUT to a resource (object)");
  content = await res5.put(sample_data);
  Assert.equal(content, "Valid data upload via PUT");
  Assert.equal(content.status, 200);
  Assert.equal(res5.data, content);

  _("PUT without data arg (uses resource.data) (string)");
  res5.data = JSON.stringify(sample_data);
  content = await res5.put();
  Assert.equal(content, "Valid data upload via PUT");
  Assert.equal(content.status, 200);
  Assert.equal(res5.data, content);

  _("PUT without data arg (uses resource.data) (object)");
  res5.data = sample_data;
  content = await res5.put();
  Assert.equal(content, "Valid data upload via PUT");
  Assert.equal(content.status, 200);
  Assert.equal(res5.data, content);

  _("POST to a resource (string)");
  content = await res5.post(JSON.stringify(sample_data));
  Assert.equal(content, "Valid data upload via POST");
  Assert.equal(content.status, 200);
  Assert.equal(res5.data, content);

  _("POST to a resource (object)");
  content = await res5.post(sample_data);
  Assert.equal(content, "Valid data upload via POST");
  Assert.equal(content.status, 200);
  Assert.equal(res5.data, content);

  _("POST without data arg (uses resource.data) (string)");
  res5.data = JSON.stringify(sample_data);
  content = await res5.post();
  Assert.equal(content, "Valid data upload via POST");
  Assert.equal(content.status, 200);
  Assert.equal(res5.data, content);

  _("POST without data arg (uses resource.data) (object)");
  res5.data = sample_data;
  content = await res5.post();
  Assert.equal(content, "Valid data upload via POST");
  Assert.equal(content.status, 200);
  Assert.equal(res5.data, content);

  _("DELETE a resource");
  let res6 = new Resource(server.baseURI + "/delete");
  content = await res6.delete();
  Assert.equal(content, "This resource has been deleted");
  Assert.equal(content.status, 200);

  _("JSON conversion of response body");
  let res7 = new Resource(server.baseURI + "/json");
  content = await res7.get();
  Assert.equal(content, JSON.stringify(sample_data));
  Assert.equal(content.status, 200);
  Assert.equal(JSON.stringify(content.obj), JSON.stringify(sample_data));

  _("X-Weave-Timestamp header updates AsyncResource.serverTime");
  // Before having received any response containing the
  // X-Weave-Timestamp header, AsyncResource.serverTime is null.
  Assert.equal(AsyncResource.serverTime, null);
  let res8 = new Resource(server.baseURI + "/timestamp");
  content = await res8.get();
  Assert.equal(AsyncResource.serverTime, TIMESTAMP);

  _("GET: no special request headers");
  let res9 = new Resource(server.baseURI + "/headers");
  content = await res9.get();
  Assert.equal(content, "{}");

  _("PUT: Content-Type defaults to text/plain");
  content = await res9.put("data");
  Assert.equal(content, JSON.stringify({"content-type": "text/plain"}));

  _("POST: Content-Type defaults to text/plain");
  content = await res9.post("data");
  Assert.equal(content, JSON.stringify({"content-type": "text/plain"}));

  _("setHeader(): setting simple header");
  res9.setHeader("X-What-Is-Weave", "awesome");
  Assert.equal(res9.headers["x-what-is-weave"], "awesome");
  content = await res9.get();
  Assert.equal(content, JSON.stringify({"x-what-is-weave": "awesome"}));

  _("setHeader(): setting multiple headers, overwriting existing header");
  res9.setHeader("X-WHAT-is-Weave", "more awesomer");
  res9.setHeader("X-Another-Header", "hello world");
  Assert.equal(res9.headers["x-what-is-weave"], "more awesomer");
  Assert.equal(res9.headers["x-another-header"], "hello world");
  content = await res9.get();
  Assert.equal(content, JSON.stringify({"x-another-header": "hello world",
                                       "x-what-is-weave": "more awesomer"}));

  _("Setting headers object");
  res9.headers = {};
  content = await res9.get();
  Assert.equal(content, "{}");

  _("PUT/POST: override default Content-Type");
  res9.setHeader("Content-Type", "application/foobar");
  Assert.equal(res9.headers["content-type"], "application/foobar");
  content = await res9.put("data");
  Assert.equal(content, JSON.stringify({"content-type": "application/foobar"}));
  content = await res9.post("data");
  Assert.equal(content, JSON.stringify({"content-type": "application/foobar"}));


  _("X-Weave-Backoff header notifies observer");
  let backoffInterval;
  function onBackoff(subject, data) {
    backoffInterval = subject;
  }
  Observers.add("weave:service:backoff:interval", onBackoff);

  let res10 = new Resource(server.baseURI + "/backoff");
  content = await res10.get();
  Assert.equal(backoffInterval, 600);


  _("X-Weave-Quota-Remaining header notifies observer on successful requests.");
  let quotaValue;
  function onQuota(subject, data) {
    quotaValue = subject;
  }
  Observers.add("weave:service:quota:remaining", onQuota);

  res10 = new Resource(server.baseURI + "/quota-error");
  content = await res10.get();
  Assert.equal(content.status, 400);
  Assert.equal(quotaValue, undefined); // HTTP 400, so no observer notification.

  res10 = new Resource(server.baseURI + "/quota-notice");
  content = await res10.get();
  Assert.equal(content.status, 200);
  Assert.equal(quotaValue, 1048576);


  _("Error handling in _request() preserves exception information");
  let error;
  let res11 = new Resource("http://localhost:12345/does/not/exist");
  try {
    content = await res11.get();
  } catch (ex) {
    error = ex;
  }
  Assert.equal(error.result, Cr.NS_ERROR_CONNECTION_REFUSED);
  Assert.equal(error.message, "NS_ERROR_CONNECTION_REFUSED");
  Assert.equal(typeof error.stack, "string");

  _("Checking handling of errors in onProgress.");
  let res18 = new Resource(server.baseURI + "/json");
  let onProgress = function(rec) {
    // Provoke an XPC exception without a Javascript wrapper.
    Services.io.newURI("::::::::");
  };
  res18._onProgress = onProgress;
  let warnings = [];
  res18._log.warn = function(msg) { warnings.push(msg); };
  error = undefined;
  try {
    content = await res18.get();
  } catch (ex) {
    error = ex;
  }

  // It throws and logs.
  Assert.equal(error.result, Cr.NS_ERROR_MALFORMED_URI);
  Assert.equal(error.message, "NS_ERROR_MALFORMED_URI");
  // Note the strings haven't been formatted yet, but that's OK for this test.
  Assert.equal(warnings.pop(), "${action} request to ${url} failed: ${ex}");
  Assert.equal(warnings.pop(),
              "Got exception calling onProgress handler during fetch of " +
              server.baseURI + "/json");

  // And this is what happens if JS throws an exception.
  res18 = new Resource(server.baseURI + "/json");
  onProgress = function(rec) {
    throw new Error("BOO!");
  };
  res18._onProgress = onProgress;
  let oldWarn = res18._log.warn;
  warnings = [];
  res18._log.warn = function(msg) { warnings.push(msg); };
  error = undefined;
  try {
    content = await res18.get();
  } catch (ex) {
    error = ex;
  }

  // It throws and logs.
  Assert.equal(error.result, Cr.NS_ERROR_XPC_JAVASCRIPT_ERROR_WITH_DETAILS);
  Assert.equal(error.message, "NS_ERROR_XPC_JAVASCRIPT_ERROR_WITH_DETAILS");
  Assert.equal(warnings.pop(), "${action} request to ${url} failed: ${ex}");
  Assert.equal(warnings.pop(),
              "Got exception calling onProgress handler during fetch of " +
              server.baseURI + "/json");

  res18._log.warn = oldWarn;

  _("Ensure channel timeouts are thrown appropriately.");
  let res19 = new Resource(server.baseURI + "/json");
  res19.ABORT_TIMEOUT = 0;
  error = undefined;
  try {
    content = await res19.get();
  } catch (ex) {
    error = ex;
  }
  Assert.equal(error.result, Cr.NS_ERROR_NET_TIMEOUT);

  _("Testing URI construction.");
  let args = [];
  args.push("newer=" + 1234);
  args.push("limit=" + 1234);
  args.push("sort=" + 1234);

  let query = "?" + args.join("&");

  let uri1 = Utils.makeURI("http://foo/" + query)
                  .QueryInterface(Ci.nsIURL);
  let uri2 = Utils.makeURI("http://foo/")
                  .QueryInterface(Ci.nsIURL);
  uri2.query = query;
  Assert.equal(uri1.query, uri2.query);
  server.stop(do_test_finished);
});
