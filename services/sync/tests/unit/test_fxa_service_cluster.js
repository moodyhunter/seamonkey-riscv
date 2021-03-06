/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

ChromeUtils.import("resource://services-sync/service.js");
ChromeUtils.import("resource://services-sync/util.js");
ChromeUtils.import("resource://testing-common/services/sync/fxa_utils.js");
ChromeUtils.import("resource://testing-common/services/sync/utils.js");

add_task(async function test_findCluster() {
  _("Test FxA _findCluster()");

  _("_findCluster() throws on 500 errors.");
  initializeIdentityWithTokenServerResponse({
    status: 500,
    headers: [],
    body: "",
  });

  await Service.identity.initializeWithCurrentIdentity();
  await Assert.rejects(Service.identity.whenReadyToAuthenticate.promise,
                       "should reject due to 500");

  Assert.throws(function() {
    Service._clusterManager._findCluster();
  });

  _("_findCluster() returns null on authentication errors.");
  initializeIdentityWithTokenServerResponse({
    status: 401,
    headers: {"content-type": "application/json"},
    body: "{}",
  });

  await Service.identity.initializeWithCurrentIdentity();
  await Assert.rejects(Service.identity.whenReadyToAuthenticate.promise,
                       "should reject due to 401");

  let cluster = Service._clusterManager._findCluster();
  Assert.strictEqual(cluster, null);

  _("_findCluster() works with correct tokenserver response.");
  let endpoint = "http://example.com/something";
  initializeIdentityWithTokenServerResponse({
    status: 200,
    headers: {"content-type": "application/json"},
    body:
      JSON.stringify({
        api_endpoint: endpoint,
        duration: 300,
        id: "id",
        key: "key",
        uid: "uid",
      })
  });

  await Service.identity.initializeWithCurrentIdentity();
  await Service.identity.whenReadyToAuthenticate.promise;
  cluster = Service._clusterManager._findCluster();
  // The cluster manager ensures a trailing "/"
  Assert.strictEqual(cluster, endpoint + "/");

  Svc.Prefs.resetBranch("");
});

function run_test() {
  initTestLogging();
  run_next_test();
}
