/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

this.EXPORTED_SYMBOLS = [ "PluginContent" ];

ChromeUtils.import("resource://gre/modules/XPCOMUtils.jsm");
ChromeUtils.import("resource://gre/modules/Services.jsm");
ChromeUtils.import("resource://gre/modules/Timer.jsm");
ChromeUtils.import("resource://gre/modules/BrowserUtils.jsm");

XPCOMUtils.defineLazyGetter(this, "gNavigatorBundle", function() {
  const url = "chrome://browser/locale/browser.properties";
  return Services.strings.createBundle(url);
});

ChromeUtils.defineModuleGetter(this, "AppConstants",
  "resource://gre/modules/AppConstants.jsm");

this.PluginContent = function(global) {
  this.init(global);
}

PluginContent.prototype = {
  init(global) {
    this.global = global;
    // Need to hold onto the content window or else it'll get destroyed
    this.content = this.global.content;
    // Cache of plugin actions for the current page.
    this.pluginData = new Map();
    // Cache of plugin crash information sent from the parent
    this.pluginCrashData = new Map();

    // Note that the XBL binding is untrusted
    global.addEventListener("PluginCrashed", this, true);
    global.addEventListener("unload", this);
  },

  uninit() {
    let global = this.global;

    global.removeEventListener("PluginCrashed", this, true);
    global.removeEventListener("unload", this);

    delete this.global;
    delete this.content;
  },

  receiveMessage(msg) {
  },

  handleEvent(event) {
    let eventType = event.type;

    if (eventType == "unload") {
      this.uninit();
      return;
    }

    if (eventType == "PluginCrashed" &&
        !(event.target instanceof Ci.nsIObjectLoadingContent)) {
      // If the event target is not a plugin object (i.e., an <object> or
      // <embed> element), this call is for a window-global plugin.
      this.onPluginCrashed(event.target, event);
      return;
    }
  },

  submitReport: function submitReport(plugin) {
    if (!AppConstants.MOZ_CRASHREPORTER) {
      return;
    }
    if (!plugin) {
      Cu.reportError("Attempted to submit crash report without an associated plugin.");
      return;
    }
    if (!(plugin instanceof Ci.nsIObjectLoadingContent)) {
      Cu.reportError("Attempted to submit crash report on plugin that does not" +
                     "implement nsIObjectLoadingContent.");
      return;
    }

    let runID = plugin.runID;
    let submitURLOptIn = this.getPluginUI(plugin, "submitURLOptIn").checked;
    let keyVals = {};
    let userComment = this.getPluginUI(plugin, "submitComment").value.trim();
    if (userComment)
      keyVals.PluginUserComment = userComment;
    if (submitURLOptIn)
      keyVals.PluginContentURL = plugin.ownerDocument.URL;

    this.global.sendAsyncMessage("PluginContent:SubmitReport",
                                 { runID, keyVals, submitURLOptIn });
  },

  removeNotification(name) {
    this.global.sendAsyncMessage("PluginContent:RemoveNotification", { name });
  },

  clearPluginCaches() {
    this.pluginData.clear();
    this.pluginCrashData.clear();
  },

  /**
   * Determines whether or not the crashed plugin is contained within current
   * full screen DOM element.
   * @param fullScreenElement (DOM element)
   *   The DOM element that is currently full screen, or null.
   * @param domElement
   *   The DOM element which contains the crashed plugin, or the crashed plugin
   *   itself.
   * @returns bool
   *   True if the plugin is a descendant of the full screen DOM element, false otherwise.
   **/
  isWithinFullScreenElement(fullScreenElement, domElement) {

    /**
     * Traverses down iframes until it find a non-iframe full screen DOM element.
     * @param fullScreenIframe
     *  Target iframe to begin searching from.
     * @returns DOM element
     *  The full screen DOM element contained within the iframe (could be inner iframe), or the original iframe if no inner DOM element is found.
     **/
    let getTrueFullScreenElement = fullScreenIframe => {
      if (typeof fullScreenIframe.contentDocument !== "undefined" && fullScreenIframe.contentDocument.mozFullScreenElement) {
        return getTrueFullScreenElement(fullScreenIframe.contentDocument.mozFullScreenElement);
      }
      return fullScreenIframe;
    };

    if (fullScreenElement.tagName === "IFRAME") {
      fullScreenElement = getTrueFullScreenElement(fullScreenElement);
    }

    if (fullScreenElement.contains(domElement)) {
      return true;
    }
    let parentIframe = domElement.ownerGlobal.frameElement;
    if (parentIframe) {
      return this.isWithinFullScreenElement(fullScreenElement, parentIframe);
    }
    return false;
  },

  /**
   * The PluginCrashed event handler. Note that the PluginCrashed event is
   * fired for Gecko Media plugins. In this case, the target of the event is
   * the document that the GMP is being used in.
   */
  onPluginCrashed(target, aEvent) {
    if (!(aEvent instanceof this.content.PluginCrashedEvent))
      return;

    let fullScreenElement = this.content.document.mozFullScreenElement;
    if (fullScreenElement) {
      if (this.isWithinFullScreenElement(fullScreenElement, target)) {
        this.content.document.mozCancelFullScreen();
      }
    }

    if (aEvent.gmpPlugin) {
      this.GMPCrashed(aEvent);
      return;
    }

    return;
  },

  GMPCrashed(aEvent) {
    let target          = aEvent.target;
    let pluginName      = aEvent.pluginName;
    let gmpPlugin       = aEvent.gmpPlugin;
    let pluginID        = aEvent.pluginID;
    let doc             = target.document;

    if (!gmpPlugin || !doc) {
      // TODO: Throw exception? How did we get here?
      return;
    }

    let messageString =
      gNavigatorBundle.formatStringFromName("crashedpluginsMessage.title",
                                            [pluginName], 1);

    this.global.sendAsyncMessage("PluginContent:ShowPluginCrashedNotification",
                                 { messageString, pluginID });
  },
};
