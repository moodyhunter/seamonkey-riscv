/* exported startup, shutdown, install, uninstall */

ChromeUtils.import("resource:///modules/experiments/Experiments.jsm");

var gStarted = false;

function startup(data, reasonCode) {
  if (gStarted) {
    return;
  }
  gStarted = true;

  // delay realstartup to trigger the race condition
  Cc["@mozilla.org/thread-manager;1"].getService(Ci.nsIThreadManager).dispatchToMainThread(realstartup);
}

function realstartup() {
  let experiments = Experiments.instance();
  let experiment = experiments._getActiveExperiment();
  if (experiment.branch) {
    Cu.reportError("Found pre-existing branch: " + experiment.branch);
    return;
  }

  let branch = "racy-set";
  experiments.setExperimentBranch(experiment.id, branch)
    .catch(Cu.reportError);
}

function shutdown() { }
function install() { }
function uninstall() { }
