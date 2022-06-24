/* -*- js-indent-level: 2; indent-tabs-mode: nil -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

ChromeUtils.import("resource://gre/modules/Log.jsm", this);
ChromeUtils.import("resource://gre/modules/Services.jsm", this);
ChromeUtils.import("resource://gre/modules/TelemetryUtils.jsm", this);
ChromeUtils.import("resource://gre/modules/XPCOMUtils.jsm", this);

ChromeUtils.defineModuleGetter(this, "TelemetryController",
                               "resource://gre/modules/TelemetryController.jsm");

const LOGGER_NAME = "Toolkit.Telemetry";
const PING_TYPE = "update";
const UPDATE_DOWNLOADED_TOPIC = "update-downloaded";

this.EXPORTED_SYMBOLS = ["UpdatePing"];

/**
 * This module is responsible for listening to all the relevant update
 * signals, gathering the needed information and assembling the "update"
 * ping.
 */
this.UpdatePing = {
  earlyInit() {
    this._log = Log.repository.getLoggerWithMessagePrefix(LOGGER_NAME, "UpdatePing::");
    this._enabled = Services.prefs.getBoolPref(TelemetryUtils.Preferences.UpdatePing, false);

    this._log.trace("init - enabled: " + this._enabled);

    if (!this._enabled) {
      return;
    }

    Services.obs.addObserver(this, UPDATE_DOWNLOADED_TOPIC);
  },

  /**
   * Generate an "update" ping with reason "ready" and dispatch it
   * to the Telemetry system.
   *
   * @param {String} aUpdateState The state of the downloaded patch. See
   *        nsIUpdateService.idl for a list of possible values.
   */
  _handleUpdateReady(aUpdateState) {
    return;
  },

  /**
   * The notifications handler.
   */
  observe(aSubject, aTopic, aData) {
    this._log.trace("observe - aTopic: " + aTopic);
    if (aTopic == UPDATE_DOWNLOADED_TOPIC) {
      this._handleUpdateReady(aData);
    }
  },

  shutdown() {
    if (!this._enabled) {
      return;
    }
    Services.obs.removeObserver(this, UPDATE_DOWNLOADED_TOPIC);
  },
};
