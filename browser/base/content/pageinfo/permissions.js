/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* import-globals-from pageInfo.js */

ChromeUtils.import("resource:///modules/SitePermissions.jsm");
ChromeUtils.import("resource://gre/modules/BrowserUtils.jsm");

const nsIQuotaManagerService = Ci.nsIQuotaManagerService;

var gPermURI;
var gPermPrincipal;
var gUsageRequest;

// Array of permissionIDs sorted alphabetically by label.
var gPermissions = SitePermissions.listPermissions().sort((a, b) => {
  let firstLabel = SitePermissions.getPermissionLabel(a);
  let secondLabel = SitePermissions.getPermissionLabel(b);
  return firstLabel.localeCompare(secondLabel);
});

var permissionObserver = {
  observe(aSubject, aTopic, aData) {
    if (aTopic == "perm-changed") {
      var permission = aSubject.QueryInterface(Ci.nsIPermission);
      if (permission.matchesURI(gPermURI, true) && gPermissions.includes(permission.type)) {
          initRow(permission.type);
      }
    }
  }
};

function onLoadPermission(uri, principal) {
  var permTab = document.getElementById("permTab");
  if (SitePermissions.isSupportedURI(uri)) {
    gPermURI = uri;
    gPermPrincipal = principal;
    var hostText = document.getElementById("hostText");
    hostText.value = gPermURI.prePath;

    for (var i of gPermissions)
      initRow(i);
    var os = Cc["@mozilla.org/observer-service;1"]
               .getService(Ci.nsIObserverService);
    os.addObserver(permissionObserver, "perm-changed");
    onUnloadRegistry.push(onUnloadPermission);
    permTab.hidden = false;
  } else
    permTab.hidden = true;
}

function onUnloadPermission() {
  var os = Cc["@mozilla.org/observer-service;1"]
             .getService(Ci.nsIObserverService);
  os.removeObserver(permissionObserver, "perm-changed");

  if (gUsageRequest) {
    gUsageRequest.cancel();
    gUsageRequest = null;
  }
}

function initRow(aPartId) {
  createRow(aPartId);

  var checkbox = document.getElementById(aPartId + "Def");
  var command  = document.getElementById("cmd_" + aPartId + "Toggle");
  var {state} = SitePermissions.get(gPermURI, aPartId);

  if (state != SitePermissions.UNKNOWN) {
    checkbox.checked = false;
    command.removeAttribute("disabled");
  } else {
    checkbox.checked = true;
    command.setAttribute("disabled", "true");
    state = SitePermissions.getDefault(aPartId);
  }
  setRadioState(aPartId, state);

  if (aPartId == "indexedDB") {
    initIndexedDBRow();
  }
}

function createRow(aPartId) {
  let rowId = "perm-" + aPartId + "-row";
  if (document.getElementById(rowId))
    return;

  let commandId = "cmd_" + aPartId + "Toggle";
  let labelId = "perm-" + aPartId + "-label";
  let radiogroupId = aPartId + "RadioGroup";

  let command = document.createElement("command");
  command.setAttribute("id", commandId);
  command.setAttribute("oncommand", "onRadioClick('" + aPartId + "');");
  document.getElementById("pageInfoCommandSet").appendChild(command);

  let row = document.createElement("vbox");
  row.setAttribute("id", rowId);
  row.setAttribute("class", "permission");

  let label = document.createElement("label");
  label.setAttribute("id", labelId);
  label.setAttribute("control", radiogroupId);
  label.setAttribute("value", SitePermissions.getPermissionLabel(aPartId));
  label.setAttribute("class", "permissionLabel");
  row.appendChild(label);

  let controls = document.createElement("hbox");
  controls.setAttribute("role", "group");
  controls.setAttribute("aria-labelledby", labelId);

  let checkbox = document.createElement("checkbox");
  checkbox.setAttribute("id", aPartId + "Def");
  checkbox.setAttribute("oncommand", "onCheckboxClick('" + aPartId + "');");
  checkbox.setAttribute("label", gBundle.getString("permissions.useDefault"));
  controls.appendChild(checkbox);

  let spacer = document.createElement("spacer");
  spacer.setAttribute("flex", "1");
  controls.appendChild(spacer);

  let radiogroup = document.createElement("radiogroup");
  radiogroup.setAttribute("id", radiogroupId);
  radiogroup.setAttribute("orient", "horizontal");
  for (let state of SitePermissions.getAvailableStates(aPartId)) {
    let radio = document.createElement("radio");
    radio.setAttribute("id", aPartId + "#" + state);
    radio.setAttribute("label", SitePermissions.getMultichoiceStateLabel(state));
    radio.setAttribute("command", commandId);
    radiogroup.appendChild(radio);
  }
  controls.appendChild(radiogroup);

  row.appendChild(controls);

  document.getElementById("permList").appendChild(row);
}

function onCheckboxClick(aPartId) {
  var command  = document.getElementById("cmd_" + aPartId + "Toggle");
  var checkbox = document.getElementById(aPartId + "Def");
  if (checkbox.checked) {
    SitePermissions.remove(gPermURI, aPartId);
    command.setAttribute("disabled", "true");
    var perm = SitePermissions.getDefault(aPartId);
    setRadioState(aPartId, perm);
  } else {
    onRadioClick(aPartId);
    command.removeAttribute("disabled");
  }
}

function onRadioClick(aPartId) {
  var radioGroup = document.getElementById(aPartId + "RadioGroup");
  var id = radioGroup.selectedItem.id;
  var permission = id.split("#")[1];
  SitePermissions.set(gPermURI, aPartId, permission);
}

function setRadioState(aPartId, aValue) {
  var radio = document.getElementById(aPartId + "#" + aValue);
  if (radio) {
    radio.radioGroup.selectedItem = radio;
  }
}

function initIndexedDBRow() {
  // IndexedDB information is not shown for pages with a null principal
  // such as sandboxed pages because these pages do not have access to indexedDB.
  if (gPermPrincipal.isNullPrincipal)
    return;

  let row = document.getElementById("perm-indexedDB-row");
  let extras = document.getElementById("perm-indexedDB-extras");

  row.appendChild(extras);

  var quotaManagerService =
    Cc["@mozilla.org/dom/quota-manager-service;1"]
      .getService(nsIQuotaManagerService);
  gUsageRequest =
    quotaManagerService.getUsageForPrincipal(gPermPrincipal,
                                             onIndexedDBUsageCallback);

  var status = document.getElementById("indexedDBStatus");
  var button = document.getElementById("indexedDBClear");

  status.value = "";
  status.setAttribute("hidden", "true");
  button.setAttribute("hidden", "true");
}

function onIndexedDBClear() {
  Cc["@mozilla.org/dom/quota-manager-service;1"]
    .getService(nsIQuotaManagerService)
    .clearStoragesForPrincipal(gPermPrincipal);

  Cc["@mozilla.org/serviceworkers/manager;1"]
    .getService(Ci.nsIServiceWorkerManager)
    .removeAndPropagate(gPermURI.host);

  SitePermissions.remove(gPermURI, "indexedDB");
  initIndexedDBRow();
}

function onIndexedDBUsageCallback(request) {
  let uri = request.principal.URI;
  if (!uri.equals(gPermURI)) {
    throw new Error("Callback received for bad URI: " + uri);
  }

  let usage = request.result.usage;
  if (usage) {
    if (!("DownloadUtils" in window)) {
      ChromeUtils.import("resource://gre/modules/DownloadUtils.jsm");
    }

    var status = document.getElementById("indexedDBStatus");
    var button = document.getElementById("indexedDBClear");

    status.value =
      gBundle.getFormattedString("indexedDBUsage",
                                 DownloadUtils.convertByteUnits(usage));
    status.removeAttribute("hidden");
    button.removeAttribute("hidden");
  }
}
