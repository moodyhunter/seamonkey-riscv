/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * This file runs a Storage Service server.
 *
 * It is meant to be executed with an xpcshell.
 *
 * The Makefile in this directory contains a target to run it:
 *
 *   $ make storage-server
 */

// Disable eslint no-undef rule for this file, as it is simple and is complicated
// to check all the imports.
/* eslint no-undef:off */

ChromeUtils.import("resource://testing-common/services/common/storageserver.js");

initTestLogging();

var server = new StorageServer();
server.allowAllUsers = true;
server.startSynchronous(SERVER_PORT);
_("Storage server started on port " + SERVER_PORT);

// Launch the thread manager.
_do_main();
