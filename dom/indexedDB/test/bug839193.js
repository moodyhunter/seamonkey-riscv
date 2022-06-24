/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const nsIQuotaManagerService = Ci.nsIQuotaManagerService;

var gURI = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService).newURI("http://localhost");

function onUsageCallback(request) {}

function onLoad()
{
  var quotaManagerService =
    Cc["@mozilla.org/dom/quota-manager-service;1"]
      .getService(nsIQuotaManagerService);
  let principal = Cc["@mozilla.org/scriptsecuritymanager;1"]
                    .getService(Ci.nsIScriptSecurityManager)
                    .createCodebasePrincipal(gURI, {});
  var quotaRequest = quotaManagerService.getUsageForPrincipal(principal,
                                                              onUsageCallback);
  quotaRequest.cancel();
  Cc["@mozilla.org/observer-service;1"]
    .getService(Ci.nsIObserverService)
    .notifyObservers(window, "bug839193-loaded");
}

function onUnload()
{
  Cc["@mozilla.org/observer-service;1"]
    .getService(Ci.nsIObserverService)
    .notifyObservers(window, "bug839193-unloaded");
}
