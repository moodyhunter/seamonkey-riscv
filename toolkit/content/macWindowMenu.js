// -*- indent-tabs-mode: nil; js-indent-level: 2 -*-

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function macWindowMenuDidShow() {
  var windowManagerDS =
    Cc["@mozilla.org/rdf/datasource;1?name=window-mediator"]
      .getService(Ci.nsIWindowDataSource);
  var sep = document.getElementById("sep-window-list");
  // Using double parens to avoid warning
  while ((sep = sep.nextSibling)) {
    var url = sep.getAttribute("id");
    var win = windowManagerDS.getWindowForResource(url);
    if (win.document.documentElement.getAttribute("inwindowmenu") == "false")
      sep.hidden = true;
    else if (win == window)
      sep.setAttribute("checked", "true");
  }
}

function toOpenWindow( aWindow ) {
  // deminiaturize the window, if it's in the Dock
  if (aWindow.windowState == window.STATE_MINIMIZED)
    aWindow.restore();
  aWindow.document.commandDispatcher.focusedWindow.focus();
}

function ShowWindowFromResource( node ) {
  var windowManagerDS =
    Cc["@mozilla.org/rdf/datasource;1?name=window-mediator"]
      .getService(Ci.nsIWindowDataSource);

  var desiredWindow = null;
  var url = node.getAttribute("id");
  desiredWindow = windowManagerDS.getWindowForResource( url );
  if (desiredWindow)
    toOpenWindow(desiredWindow);
}

function zoomWindow() {
  if (window.windowState == window.STATE_NORMAL)
    window.maximize();
  else
    window.restore();
}
