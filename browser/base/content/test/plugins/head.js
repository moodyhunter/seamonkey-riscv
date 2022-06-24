ChromeUtils.import("resource://gre/modules/XPCOMUtils.jsm");

ChromeUtils.defineModuleGetter(this, "PlacesUtils",
  "resource://gre/modules/PlacesUtils.jsm");
ChromeUtils.defineModuleGetter(this, "PromiseUtils",
  "resource://gre/modules/PromiseUtils.jsm");

// Various tests in this directory may define gTestBrowser, to use as the
// default browser under test in some of the functions below.
/* global gTestBrowser */

// The blocklist shim running in the content process does not initialize at
// start up, so it's not active until we load content that needs to do a
// check. This helper bypasses the delay to get the svc up and running
// immediately. Note, call this after remote content has loaded.
function promiseInitContentBlocklistSvc(aBrowser) {
  return ContentTask.spawn(aBrowser, {}, async function() {
    try {
      Cc["@mozilla.org/extensions/blocklist;1"]
        .getService(Ci.nsIBlocklistService);
    } catch (ex) {
      return ex.message;
    }
    return null;
  });
}

/**
  * Waits a specified number of miliseconds.
  *
  * Usage:
  *    let wait = yield waitForMs(2000);
  *    ok(wait, "2 seconds should now have elapsed");
  *
  * @param aMs the number of miliseconds to wait for
  * @returns a Promise that resolves to true after the time has elapsed
  */
function waitForMs(aMs) {
  return new Promise((resolve) => {
    setTimeout(done, aMs);
    function done() {
      resolve(true);
    }
  });
}

function waitForEvent(subject, eventName, checkFn, useCapture, useUntrusted) {
  return new Promise((resolve, reject) => {
    subject.addEventListener(eventName, function listener(event) {
      try {
        if (checkFn && !checkFn(event)) {
          return;
        }
        subject.removeEventListener(eventName, listener, useCapture);
        resolve(event);
      } catch (ex) {
        try {
          subject.removeEventListener(eventName, listener, useCapture);
        } catch (ex2) {
          // Maybe the provided object does not support removeEventListener.
        }
        reject(ex);
      }
    }, useCapture, useUntrusted);
  });
}


/**
 * Waits for a load (or custom) event to finish in a given tab. If provided
 * load an uri into the tab.
 *
 * @param tab
 *        The tab to load into.
 * @param [optional] url
 *        The url to load, or the current url.
 * @return {Promise} resolved when the event is handled.
 * @resolves to the received event
 * @rejects if a valid load event is not received within a meaningful interval
 */
function promiseTabLoadEvent(tab, url) {
  info("Wait tab event: load");

  function handle(loadedUrl) {
    if (loadedUrl === "about:blank" || (url && loadedUrl !== url)) {
      info(`Skipping spurious load event for ${loadedUrl}`);
      return false;
    }

    info("Tab event received: load");
    return true;
  }

  let loaded = BrowserTestUtils.browserLoaded(tab.linkedBrowser, false, handle);

  if (url)
    BrowserTestUtils.loadURI(tab.linkedBrowser, url);

  return loaded;
}

function waitForCondition(condition, nextTest, errorMsg, aTries, aWait) {
  let tries = 0;
  let maxTries = aTries || 100; // 100 tries
  let maxWait = aWait || 100; // 100 msec x 100 tries = ten seconds
  let interval = setInterval(function() {
    if (tries >= maxTries) {
      ok(false, errorMsg);
      moveOn();
    }
    let conditionPassed;
    try {
      conditionPassed = condition();
    } catch (e) {
      ok(false, e + "\n" + e.stack);
      conditionPassed = false;
    }
    if (conditionPassed) {
      moveOn();
    }
    tries++;
  }, maxWait);
  let moveOn = function() { clearInterval(interval); nextTest(); };
}

// Waits for a conditional function defined by the caller to return true.
function promiseForCondition(aConditionFn, aMessage, aTries, aWait) {
  return new Promise((resolve) => {
    waitForCondition(aConditionFn, resolve,
                     (aMessage || "Condition didn't pass."),
                     aTries, aWait);
  });
}

// Returns a promise for nsIObjectLoadingContent props data.
function promiseForPluginInfo(aId, aBrowser) {
  let browser = aBrowser || gTestBrowser;
  return ContentTask.spawn(browser, aId, async function(contentId) {
    let plugin = content.document.getElementById(contentId);
    if (!(plugin instanceof Ci.nsIObjectLoadingContent))
      throw new Error("no plugin found");
    return {
      activated: plugin.activated,
      hasRunningPlugin: plugin.hasRunningPlugin,
      displayedType: plugin.displayedType,
    };
  });
}

function updateBlocklist(aCallback) {
  let blocklistNotifier = Cc["@mozilla.org/extensions/blocklist;1"]
                          .getService(Ci.nsITimerCallback);
  let observer = function() {
    Services.obs.removeObserver(observer, "blocklist-updated");
    SimpleTest.executeSoon(aCallback);
  };
  Services.obs.addObserver(observer, "blocklist-updated");
  blocklistNotifier.notify(null);
}

var _originalTestBlocklistURL = null;
function setAndUpdateBlocklist(aURL, aCallback) {
  if (!_originalTestBlocklistURL) {
    _originalTestBlocklistURL = Services.prefs.getCharPref("extensions.blocklist.url");
  }
  Services.prefs.setCharPref("extensions.blocklist.url", aURL);
  updateBlocklist(aCallback);
}

// Reset back to the blocklist we had at the start of the test run.
function resetBlocklist() {
  Services.prefs.setCharPref("extensions.blocklist.url", _originalTestBlocklistURL);
}

/**
 * Allows setting focus on a window, and waiting for that window to achieve
 * focus.
 *
 * @param aWindow
 *        The window to focus and wait for.
 *
 * @return {Promise}
 * @resolves When the window is focused.
 * @rejects Never.
 */
function promiseWaitForFocus(aWindow) {
  return new Promise((resolve) => {
    waitForFocus(resolve, aWindow);
  });
}

/**
 * Returns a Promise that resolves when a notification bar
 * for a browser is shown. Alternatively, for old-style callers,
 * can automatically call a callback before it resolves.
 *
 * @param notificationID
 *        The ID of the notification to look for.
 * @param browser
 *        The browser to check for the notification bar.
 * @param callback (optional)
 *        A function to be called just before the Promise resolves.
 *
 * @return Promise
 */
function waitForNotificationBar(notificationID, browser, callback) {
  return new Promise((resolve, reject) => {
    let notification;
    let notificationBox = gBrowser.getNotificationBox(browser);
    waitForCondition(
      () => (notification = notificationBox.getNotificationWithValue(notificationID)),
      () => {
        ok(notification, `Successfully got the ${notificationID} notification bar`);
        if (callback) {
          callback(notification);
        }
        resolve(notification);
      },
      `Waited too long for the ${notificationID} notification bar`
    );
  });
}

function promiseForNotificationBar(notificationID, browser) {
  return new Promise((resolve) => {
    waitForNotificationBar(notificationID, browser, resolve);
  });
}

/**
 * Reshow a notification and call a callback when it is reshown.
 * @param notification
 *        The notification to reshow
 * @param callback
 *        A function to be called when the notification has been reshown
 */
function waitForNotificationShown(notification, callback) {
  if (PopupNotifications.panel.state == "open") {
    executeSoon(callback);
    return;
  }
  PopupNotifications.panel.addEventListener("popupshown", function(e) {
    callback();
  }, {once: true});
  notification.reshow();
}

function promiseForNotificationShown(notification) {
  return new Promise((resolve) => {
    waitForNotificationShown(notification, resolve);
  });
}
