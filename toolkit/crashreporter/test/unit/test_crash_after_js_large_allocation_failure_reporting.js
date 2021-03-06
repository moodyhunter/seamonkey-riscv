function run_test() {
  if (!("@mozilla.org/toolkit/crash-reporter;1" in Cc)) {
    dump("INFO | test_crash_after_js_oom_reporting.js | Can't test crashreporter in a non-libxul build.\n");
    return;
  }

  do_crash(
    function() {
      crashType = CrashTestUtils.CRASH_MOZ_CRASH;
      crashReporter.annotateCrashReport("TestingOOMCrash", "Yes");

      function crashWhileReporting() {
        CrashTestUtils.crash(crashType);
      }

      var observerService = Cc["@mozilla.org/observer-service;1"]
        .getService(Ci.nsIObserverService);
      observerService.addObserver(crashWhileReporting, "memory-pressure");
      Cu.getJSTestingFunctions().reportLargeAllocationFailure();
    },
    function(mdump, extra) {
      Assert.equal(extra.TestingOOMCrash, "Yes");
      Assert.equal(extra.JSLargeAllocationFailure, "Reporting");
    },
    true);
}
