/* import-globals-from pageloader.js */

var gChildProcess = true;
var gMemCallback = null;


/*
 * Initialize memory collector.  Determine if we have a child process.
 */
function initializeMemoryCollector(callback, args) {
    gMemCallback = function() { return callback(args); };

    var os = Cc["@mozilla.org/observer-service;1"].
        getService(Ci.nsIObserverService);

    os.addObserver(function() {
        var os = Cc["@mozilla.org/observer-service;1"].
            getService(Ci.nsIObserverService);

        memTimer.cancel();
        memTimer = null;

        os.removeObserver(arguments.callee, "child-memory-reporter-update");
        os.addObserver(collectAndReport, "child-memory-reporter-update");
        gMemCallback();
    }, "child-memory-reporter-update");

   /*
    * Assume we have a child process, but if timer fires before we call the observer
    * we will assume there is no child process.
    */
    var event = {
      notify(timer) {
        memTimer = null;
        gChildProcess = false;
        gMemCallback();
      }
    }

    var memTimer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
    memTimer.initWithCallback(event, 10000, Ci.nsITimer.TYPE_ONE_SHOT);

    os.notifyObservers(null, "child-memory-reporter-request", "generation=1 anonymize=0 minimize=0 DMDident=0");
}

/*
 * Collect memory from all processes and callback when done collecting.
 */
function collectMemory(callback, args) {
  gMemCallback = function() { return callback(args); };

  if (gChildProcess) {
    var os = Cc["@mozilla.org/observer-service;1"].
        getService(Ci.nsIObserverService);

    os.notifyObservers(null, "child-memory-reporter-request");
  } else {
    collectAndReport(null, null, null);
  }
}

function collectAndReport(aSubject, aTopic, aData) {
  dumpLine(collectRSS());
  gMemCallback();
}

function collectRSS() {
  var mgr = Cc["@mozilla.org/memory-reporter-manager;1"].
      getService(Ci.nsIMemoryReporterManager);
  return "RSS: Main: " + mgr.resident + "\n";
}

/*
 * Cleanup and stop memory collector.
 */
function stopMemCollector() {
  if (gChildProcess) {
    var os = Cc["@mozilla.org/observer-service;1"].
        getService(Ci.nsIObserverService);
    os.removeObserver(collectAndReport, "child-memory-reporter-update");
  }
}
