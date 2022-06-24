// enable crash reporting first
var cwd = Cc["@mozilla.org/file/directory_service;1"]
      .getService(Ci.nsIProperties)
      .get("CurWorkD", Ci.nsIFile);

// get the temp dir
var env = Cc["@mozilla.org/process/environment;1"].getService(Ci.nsIEnvironment);
var _tmpd = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
_tmpd.initWithPath(env.get("XPCSHELL_TEST_TEMP_DIR"));

var crashReporter =
  Cc["@mozilla.org/toolkit/crash-reporter;1"]
    .getService(Ci.nsICrashReporter);

// We need to call this or crash events go in an undefined location.
crashReporter.UpdateCrashEventsDir();

// Setting the minidump path is not allowed in content processes
var processType = Cc["@mozilla.org/xre/runtime;1"].
      getService(Ci.nsIXULRuntime).processType;
if (processType == Ci.nsIXULRuntime.PROCESS_TYPE_DEFAULT) {
  crashReporter.minidumpPath = _tmpd;
}

var ios = Cc["@mozilla.org/network/io-service;1"]
            .getService(Ci.nsIIOService);
var protocolHandler = ios.getProtocolHandler("resource")
                        .QueryInterface(Ci.nsIResProtocolHandler);
var curDirURI = ios.newFileURI(cwd);
protocolHandler.setSubstitution("test", curDirURI);
ChromeUtils.import("resource://test/CrashTestUtils.jsm");
var crashType = CrashTestUtils.CRASH_INVALID_POINTER_DEREF;
var shouldDelay = false;
