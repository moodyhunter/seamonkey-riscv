/* import-globals-from crasher_subprocess_head.js */

// Let the event loop process a bit before crashing.
if (shouldDelay) {
  let shouldCrashNow = false;
  let tm = Cc["@mozilla.org/thread-manager;1"]
             .getService(Ci.nsIThreadManager);

  tm.dispatchToMainThread({ run: () => { shouldCrashNow = true; } })

  tm.spinEventLoopUntil(() => shouldCrashNow);
}

// now actually crash
CrashTestUtils.crash(crashType);
