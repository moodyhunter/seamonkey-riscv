/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

// Load OS.File from a module loaded with the CommonJS/addon-sdk loader

var {Cu} = require("chrome");
ChromeUtils.import("resource://gre/modules/osfile.jsm");
