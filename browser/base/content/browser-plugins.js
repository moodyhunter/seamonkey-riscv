/* -*- indent-tabs-mode: nil; js-indent-level: 2 -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var gPluginHandler = {
  MESSAGES: [
    "PluginContent:RemoveNotification",
    "PluginContent:ShowPluginCrashedNotification",
    "PluginContent:SubmitReport",
  ],

  init() {
    const mm = window.messageManager;
    for (let msg of this.MESSAGES) {
      mm.addMessageListener(msg, this);
    }
    window.addEventListener("unload", this);
  },

  uninit() {
    const mm = window.messageManager;
    for (let msg of this.MESSAGES) {
      mm.removeMessageListener(msg, this);
    }
    window.removeEventListener("unload", this);
  },

  handleEvent(event) {
    if (event.type == "unload") {
      this.uninit();
    }
  },

  receiveMessage(msg) {
    switch (msg.name) {
      case "PluginContent:RemoveNotification":
        this.removeNotification(msg.target, msg.data.name);
        break;
      case "PluginContent:ShowPluginCrashedNotification":
        this.showPluginCrashedNotification(msg.target, msg.data.messageString,
                                           msg.data.pluginID);
        break;
      case "PluginContent:SubmitReport":
        if (AppConstants.MOZ_CRASHREPORTER) {
          this.submitReport(msg.data.runID, msg.data.keyVals, msg.data.submitURLOptIn);
        }
        break;
      default:
        Cu.reportError("gPluginHandler did not expect to handle message " + msg.name);
        break;
    }
  },

  submitReport: function submitReport(runID, keyVals, submitURLOptIn) {
    if (!AppConstants.MOZ_CRASHREPORTER) {
      return;
    }
    Services.prefs.setBoolPref("dom.ipc.plugins.reportCrashURL", submitURLOptIn);
    PluginCrashReporter.submitCrashReport(runID, keyVals);
  },

  removeNotification(browser, name) {
    let notification = PopupNotifications.getNotification(name, browser);
    if (notification)
      PopupNotifications.remove(notification);
  },

  /**
   * Shows a plugin-crashed notification bar for a browser that has had an
   * invisiable GMP plugin crash.
   *
   * @param browser
   *        The browser to show the notification for.
   * @param messageString
   *        The string to put in the notification bar
   * @param pluginID
   *        The unique-per-process identifier for the NPAPI plugin or GMP.
   *        For a GMP, this is the pluginID. For NPAPI plugins (where "pluginID"
   *        means something different), this is the runID.
   */
  showPluginCrashedNotification(browser, messageString, pluginID) {
    // If there's already an existing notification bar, don't do anything.
    let notificationBox = gBrowser.getNotificationBox(browser);
    let notification = notificationBox.getNotificationWithValue("plugin-crashed");
    if (notification) {
      return;
    }

    // Configure the notification bar
    let priority = notificationBox.PRIORITY_WARNING_MEDIUM;
    let iconURL = "chrome://mozapps/skin/plugins/notifyPluginCrashed.png";
    let reloadLabel = gNavigatorBundle.getString("crashedpluginsMessage.reloadButton.label");
    let reloadKey   = gNavigatorBundle.getString("crashedpluginsMessage.reloadButton.accesskey");

    let buttons = [{
      label: reloadLabel,
      accessKey: reloadKey,
      popup: null,
      callback() { browser.reload(); },
    }];

    if (AppConstants.MOZ_CRASHREPORTER &&
        PluginCrashReporter.hasCrashReport(pluginID)) {
      let submitLabel = gNavigatorBundle.getString("crashedpluginsMessage.submitButton.label");
      let submitKey   = gNavigatorBundle.getString("crashedpluginsMessage.submitButton.accesskey");
      let submitButton = {
        label: submitLabel,
        accessKey: submitKey,
        popup: null,
        callback: () => {
          PluginCrashReporter.submitCrashReport(pluginID);
        },
      };

      buttons.push(submitButton);
    }

    notification = notificationBox.appendNotification(messageString, "plugin-crashed",
                                                      iconURL, priority, buttons);

    // Add the "learn more" link.
    let XULNS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
    let link = notification.ownerDocument.createElementNS(XULNS, "label");
    link.className = "text-link";
    link.setAttribute("value", gNavigatorBundle.getString("crashedpluginsMessage.learnMore"));
    let crashurl = formatURL("app.support.baseURL", true);
    crashurl += "plugin-crashed-notificationbar";
    link.href = crashurl;
    let description = notification.ownerDocument.getAnonymousElementByAttribute(notification, "anonid", "messageText");
    description.appendChild(link);
  },
};

gPluginHandler.init();
