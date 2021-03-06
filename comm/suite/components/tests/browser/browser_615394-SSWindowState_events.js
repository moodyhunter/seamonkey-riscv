/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const stateBackup = ss.getBrowserState();
const testState = {
  windows: [{
    tabs: [
      { entries: [{ url: "about:blank" }] },
      { entries: [{ url: "about:logo" }] }
    ]
  }]
};
const lameMultiWindowState = { windows: [
    {
      tabs: [
        { entries: [{ url: "http://example.org#1" }], extData: { "uniq": r() } },
        { entries: [{ url: "http://example.org#2" }], extData: { "uniq": r() } },
        { entries: [{ url: "http://example.org#3" }], extData: { "uniq": r() } },
        { entries: [{ url: "http://example.org#4" }], extData: { "uniq": r() } }
      ],
      selected: 1
    },
    {
      tabs: [
        { entries: [{ url: "http://example.com#1" }], extData: { "uniq": r() } },
        { entries: [{ url: "http://example.com#2" }], extData: { "uniq": r() } },
        { entries: [{ url: "http://example.com#3" }], extData: { "uniq": r() } },
        { entries: [{ url: "http://example.com#4" }], extData: { "uniq": r() } },
      ],
      selected: 3
    }
  ] };


function getOuterWindowID(aWindow) {
  return aWindow.QueryInterface(Ci.nsIInterfaceRequestor)
                .getInterface(Ci.nsIDOMWindowUtils).outerWindowID;
}

function test() {
  /** Test for Bug 615394 - Session Restore should notify when it is beginning and ending a restore **/
  waitForExplicitFinish();
  // Preemptively extend the timeout to prevent [orange]
  requestLongerTimeout(2);
  Services.prefs.setIntPref("browser.tabs.max_tabs_undo", 0);
  runNextTest();
}


var tests = [
  test_setTabState,
  test_duplicateTab,
  test_undoCloseTab,
  test_setWindowState,
  test_setBrowserState,
  test_undoCloseWindow
];
function runNextTest() {
  // set an empty state & run the next test, or finish
  if (tests.length) {
    // Enumerate windows and close everything but our primary window. We can't
    // use waitForFocus() because apparently it's buggy. See bug 599253.
    var windowsEnum = Services.wm.getEnumerator("navigator:browser");
    while (windowsEnum.hasMoreElements()) {
      var currentWindow = windowsEnum.getNext();
      if (currentWindow != window) {
        currentWindow.close();
      }
    }

    let currentTest = tests.shift();
    info("prepping for " + currentTest.name);
    waitForBrowserState(testState, currentTest);
  }
  else {
    Services.prefs.clearUserPref("browser.tabs.max_tabs_undo");
    ss.setBrowserState(stateBackup);
    finish();
  }
}

/**  ACTUAL TESTS  **/

function test_setTabState() {
  let tab = getBrowser().tabs[1];
  let newTabState = JSON.stringify({ entries: [{ url: "http://example.org" }], extData: { foo: "bar" } });
  let busyEventCount = 0;
  let readyEventCount = 0;

  function onSSWindowStateBusy(aEvent) {
    busyEventCount++;
  }

  function onSSWindowStateReady(aEvent) {
    readyEventCount++;
    is(ss.getTabValue(tab, "foo"), "bar");
    ss.setTabValue(tab, "baz", "qux");
  }

  function onSSTabRestored(aEvent) {
    is(busyEventCount, 1);
    is(readyEventCount, 1);
    is(ss.getTabValue(tab, "baz"), "qux");
    is(tab.linkedBrowser.currentURI.spec, "http://example.org/");

    window.removeEventListener("SSWindowStateBusy", onSSWindowStateBusy);
    window.removeEventListener("SSWindowStateReady", onSSWindowStateReady);
    getBrowser().tabContainer.removeEventListener("SSTabRestored", onSSTabRestored);

    runNextTest();
  }

  window.addEventListener("SSWindowStateBusy", onSSWindowStateBusy);
  window.addEventListener("SSWindowStateReady", onSSWindowStateReady);
  getBrowser().tabContainer.addEventListener("SSTabRestored", onSSTabRestored);
  ss.setTabState(tab, newTabState);
}


function test_duplicateTab() {
  let tab = getBrowser().tabs[1];
  let busyEventCount = 0;
  let readyEventCount = 0;
  let newTab;

  // We'll look to make sure this value is on the duplicated tab
  ss.setTabValue(tab, "foo", "bar");

  function onSSWindowStateBusy(aEvent) {
    busyEventCount++;
  }

  // duplicateTab is "synchronous" in tab creation. Since restoreHistory is called
  // via setTimeout, newTab will be assigned before the SSWindowStateReady event
  function onSSWindowStateReady(aEvent) {
    readyEventCount++;
    is(ss.getTabValue(newTab, "foo"), "bar");
    ss.setTabValue(newTab, "baz", "qux");
  }

  function onSSTabRestored(aEvent) {
    is(busyEventCount, 1);
    is(readyEventCount, 1);
    is(ss.getTabValue(newTab, "baz"), "qux");
    is(newTab.linkedBrowser.currentURI.spec, "about:logo");

    window.removeEventListener("SSWindowStateBusy", onSSWindowStateBusy);
    window.removeEventListener("SSWindowStateReady", onSSWindowStateReady);
    getBrowser().tabContainer.removeEventListener("SSTabRestored", onSSTabRestored);

    runNextTest();
  }

  window.addEventListener("SSWindowStateBusy", onSSWindowStateBusy);
  window.addEventListener("SSWindowStateReady", onSSWindowStateReady);
  getBrowser().tabContainer.addEventListener("SSTabRestored", onSSTabRestored);

  newTab = ss.duplicateTab(window, tab);
}


function test_undoCloseTab() {
  let tab = getBrowser().tabs[1],
      busyEventCount = 0,
      readyEventCount = 0,
      reopenedTab;

  ss.setTabValue(tab, "foo", "bar");

  function onSSWindowStateBusy(aEvent) {
    busyEventCount++;
  }

  // undoCloseTab is "synchronous" in tab creation. Since restoreHistory is called
  // via setTimeout, reopenedTab will be assigned before the SSWindowStateReady event
  function onSSWindowStateReady(aEvent) {
    readyEventCount++;
    is(ss.getTabValue(reopenedTab, "foo"), "bar");
    ss.setTabValue(reopenedTab, "baz", "qux");
  }

  function onSSTabRestored(aEvent) {
    is(busyEventCount, 1);
    is(readyEventCount, 1);
    is(ss.getTabValue(reopenedTab, "baz"), "qux");
    is(reopenedTab.linkedBrowser.currentURI.spec, "about:logo");

    window.removeEventListener("SSWindowStateBusy", onSSWindowStateBusy);
    window.removeEventListener("SSWindowStateReady", onSSWindowStateReady);
    getBrowser().tabContainer.removeEventListener("SSTabRestored", onSSTabRestored);

    runNextTest();
  }

  window.addEventListener("SSWindowStateBusy", onSSWindowStateBusy);
  window.addEventListener("SSWindowStateReady", onSSWindowStateReady);
  getBrowser().tabContainer.addEventListener("SSTabRestored", onSSTabRestored);

  getBrowser().removeTab(tab);
  reopenedTab = ss.undoCloseTab(window, 0);
}


function test_setWindowState() {
  let testState = {
    windows: [{
      tabs: [
        { entries: [{ url: "about:mozilla" }], extData: { "foo": "bar" } },
        { entries: [{ url: "http://example.org" }], extData: { "baz": "qux" } }
      ]
    }]
  };

  let busyEventCount = 0,
      readyEventCount = 0,
      tabRestoredCount = 0;

  function onSSWindowStateBusy(aEvent) {
    busyEventCount++;
  }

  function onSSWindowStateReady(aEvent) {
    readyEventCount++;
    is(ss.getTabValue(gBrowser.tabs[0], "foo"), "bar");
    is(ss.getTabValue(gBrowser.tabs[1], "baz"), "qux");
  }

  function onSSTabRestored(aEvent) {
    if (++tabRestoredCount < 2)
      return;

    is(busyEventCount, 1);
    is(readyEventCount, 1);
    is(getBrowser().tabs[0].linkedBrowser.currentURI.spec, "about:mozilla");
    is(getBrowser().tabs[1].linkedBrowser.currentURI.spec, "http://example.org/");

    window.removeEventListener("SSWindowStateBusy", onSSWindowStateBusy);
    window.removeEventListener("SSWindowStateReady", onSSWindowStateReady);
    getBrowser().tabContainer.removeEventListener("SSTabRestored", onSSTabRestored);

    runNextTest();
  }

  window.addEventListener("SSWindowStateBusy", onSSWindowStateBusy);
  window.addEventListener("SSWindowStateReady", onSSWindowStateReady);
  getBrowser().tabContainer.addEventListener("SSTabRestored", onSSTabRestored);

  ss.setWindowState(window, JSON.stringify(testState), true);
}


function test_setBrowserState() {
  // We'll track events per window so we are sure that they are each happening once
  // pre window.
  let windowEvents = {};
  windowEvents[getOuterWindowID(window)] = { busyEventCount: 0, readyEventCount: 0 };

  // waitForBrowserState does it's own observing for windows, but doesn't attach
  // the listeners we want here, so do it ourselves.
  let newWindow;
  function windowObserver(aSubject, aTopic, aData) {
    if (aTopic == "domwindowopened") {
      newWindow = aSubject.QueryInterface(Ci.nsIDOMWindow);
      newWindow.addEventListener("load", function newWindowLoad() {
        newWindow.removeEventListener("load", newWindowLoad, false);

        Services.ww.unregisterNotification(windowObserver);

        windowEvents[getOuterWindowID(newWindow)] = { busyEventCount: 0, readyEventCount: 0 };

        newWindow.addEventListener("SSWindowStateBusy", onSSWindowStateBusy, false);
        newWindow.addEventListener("SSWindowStateReady", onSSWindowStateReady, false);
      }, false);
    }
  }

  function onSSWindowStateBusy(aEvent) {
    windowEvents[getOuterWindowID(aEvent.originalTarget)].busyEventCount++;
  }

  function onSSWindowStateReady(aEvent) {
    windowEvents[getOuterWindowID(aEvent.originalTarget)].readyEventCount++;
  }

  window.addEventListener("SSWindowStateBusy", onSSWindowStateBusy, false);
  window.addEventListener("SSWindowStateReady", onSSWindowStateReady, false);
  Services.ww.registerNotification(windowObserver);

  waitForBrowserState(lameMultiWindowState, function() {
    let checkedWindows = 0;
    for (let [id, winEvents] of Object.entries(windowEvents)) {
      is(winEvents.busyEventCount, 1,
         "[test_setBrowserState] window" + id + " busy event count correct");
      is(winEvents.readyEventCount, 1,
         "[test_setBrowserState] window" + id + " ready event count correct");
      checkedWindows++;
    }
    is(checkedWindows, 2,
       "[test_setBrowserState] checked 2 windows");
    window.removeEventListener("SSWindowStateBusy", onSSWindowStateBusy, false);
    window.removeEventListener("SSWindowStateReady", onSSWindowStateReady, false);
    newWindow.removeEventListener("SSWindowStateBusy", onSSWindowStateBusy, false);
    newWindow.removeEventListener("SSWindowStateReady", onSSWindowStateReady, false);
    runNextTest();
  });
}


function test_undoCloseWindow() {
  let newWindow, reopenedWindow;

  function firstWindowObserver(aSubject, aTopic, aData) {
    if (aTopic == "domwindowopened") {
      newWindow = aSubject.QueryInterface(Ci.nsIDOMWindow);
      Services.ww.unregisterNotification(firstWindowObserver);
    }
  }
  Services.ww.registerNotification(firstWindowObserver);

  waitForBrowserState(lameMultiWindowState, function() {
    // Close the window which isn't window
    newWindow.close();
    reopenedWindow = ss.undoCloseWindow(0);
    reopenedWindow.addEventListener("SSWindowStateBusy", onSSWindowStateBusy);
    reopenedWindow.addEventListener("SSWindowStateReady", onSSWindowStateReady);

    reopenedWindow.addEventListener("load", function reopenWindowLoad() {
      reopenedWindow.removeEventListener("load", reopenWindowLoad);

      reopenedWindow.getBrowser().tabContainer.addEventListener("SSTabRestored", onSSTabRestored);
    });
  });

  let busyEventCount = 0,
      readyEventCount = 0,
      tabRestoredCount = 0;
  // These will listen to the reopened closed window...
  function onSSWindowStateBusy(aEvent) {
    busyEventCount++;
  }

  function onSSWindowStateReady(aEvent) {
    readyEventCount++;
  }

  function onSSTabRestored(aEvent) {
    if (++tabRestoredCount < 4)
      return;

    is(busyEventCount, 1);
    is(readyEventCount, 1);

    reopenedWindow.removeEventListener("SSWindowStateBusy", onSSWindowStateBusy);
    reopenedWindow.removeEventListener("SSWindowStateReady", onSSWindowStateReady);
    reopenedWindow.gBrowser.tabContainer.removeEventListener("SSTabRestored", onSSTabRestored);

    reopenedWindow.close();

    runNextTest();
  }
}
