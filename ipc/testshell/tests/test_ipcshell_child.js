const runtime = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULRuntime);

if (typeof(run_test) == "undefined") {
  run_test = function() {
    Assert.equal(runtime.processType, Ci.nsIXULRuntime.PROCESS_TYPE_DEFAULT);
  }}
