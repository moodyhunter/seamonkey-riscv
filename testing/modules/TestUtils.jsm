/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Contains a limited number of testing functions that are commonly used in a
 * wide variety of situations, for example waiting for an event loop tick or an
 * observer notification.
 *
 * More complex functions are likely to belong to a separate test-only module.
 * Examples include Assert.jsm for generic assertions, FileTestUtils.jsm to work
 * with local files and their contents, and BrowserTestUtils.jsm to work with
 * browser windows and tabs.
 *
 * Individual components also offer testing functions to other components, for
 * example LoginTestUtils.jsm.
 */

"use strict";

this.EXPORTED_SYMBOLS = [
  "TestUtils",
];

ChromeUtils.import("resource://gre/modules/XPCOMUtils.jsm");
ChromeUtils.import("resource://gre/modules/Services.jsm");

this.TestUtils = {
  executeSoon(callbackFn) {
    Services.tm.dispatchToMainThread(callbackFn);
  },

  /**
   * Waits for the specified topic to be observed.
   *
   * @param {string} topic
   *        The topic to observe.
   * @param {function} checkFn [optional]
   *        Called with (subject, data) as arguments, should return true if the
   *        notification is the expected one, or false if it should be ignored
   *        and listening should continue. If not specified, the first
   *        notification for the specified topic resolves the returned promise.
   *
   * @note Because this function is intended for testing, any error in checkFn
   *       will cause the returned promise to be rejected instead of waiting for
   *       the next notification, since this is probably a bug in the test.
   *
   * @return {Promise}
   * @resolves The array [subject, data] from the observed notification.
   */
  topicObserved(topic, checkFn) {
    return new Promise((resolve, reject) => {
      Services.obs.addObserver(function observer(subject, topic, data) {
        try {
          if (checkFn && !checkFn(subject, data)) {
            return;
          }
          Services.obs.removeObserver(observer, topic);
          resolve([subject, data]);
        } catch (ex) {
          Services.obs.removeObserver(observer, topic);
          reject(ex);
        }
      }, topic);
    });
  },

  /**
   * Takes a screenshot of an area and returns it as a data URL.
   *
   * @param eltOrRect
   *        The DOM node or rect ({left, top, width, height}) to screenshot.
   * @param win
   *        The current window.
   */
  screenshotArea(eltOrRect, win) {
    if (eltOrRect instanceof Ci.nsIDOMElement) {
      eltOrRect = eltOrRect.getBoundingClientRect();
    }
    let { left, top, width, height } = eltOrRect;
    let canvas = win.document.createElementNS("http://www.w3.org/1999/xhtml", "canvas");
    let ctx = canvas.getContext("2d");
    let ratio = win.devicePixelRatio;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    ctx.scale(ratio, ratio);
    ctx.drawWindow(win, left, top, width, height, "#fff");
    return canvas.toDataURL();
  }
};
