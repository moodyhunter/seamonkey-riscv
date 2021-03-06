/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Linux specific version of testing the platformIsMac part of
 * steelIApplication.
 */

function run_test() {
  Assert.ok(!Cc["@mozilla.org/steel/application;1"]
                  .getService(Ci.steelIApplication).platformIsMac);
}
