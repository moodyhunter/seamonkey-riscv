/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


var prefObserver = {
    setCalledNum: 0,
    onContentPrefSet(aGroup, aName, aValue) {
        this.setCalledNum++;
    },
    removedCalledNum: 0,
    onContentPrefRemoved(aGroup, aName) {
        this.removedCalledNum++;
    }
};

function run_test() {
  var cps = new ContentPrefInstance(loadContext);
  cps.removeGroupedPrefs();

  var uri = ContentPrefTest.getURI("http://www.example.com/");
  var group = cps.grouper.group(uri);

  // first, set a pref in normal mode
  cps.setPref(uri, "value", "foo");
  cps.setPref(null, "value-global", "foo-global");

  var num;
  cps.addObserver("value", prefObserver);
  cps.addObserver("value-global", prefObserver);

  enterPBMode(cps);

  // test setPref
  num = prefObserver.setCalledNum;
  cps.setPref(uri, "value", "foo-private-browsing");
  Assert.equal(cps.hasPref(uri, "value"), true);
  Assert.equal(cps.getPref(uri, "value"), "foo-private-browsing");
  Assert.equal(prefObserver.setCalledNum, num + 1);

  num = prefObserver.setCalledNum;
  cps.setPref(null, "value-global", "foo-private-browsing-global");
  Assert.equal(cps.hasPref(null, "value-global"), true);
  Assert.equal(cps.getPref(null, "value-global"), "foo-private-browsing-global");
  Assert.equal(prefObserver.setCalledNum, num + 1);

  // test removePref
  num = prefObserver.removedCalledNum;
  cps.removePref(uri, "value");
  Assert.equal(cps.hasPref(uri, "value"), true);
  // fallback to non private mode value
  Assert.equal(cps.getPref(uri, "value"), "foo");
  Assert.equal(prefObserver.removedCalledNum, num + 1);

  num = prefObserver.removedCalledNum;
  cps.removePref(null, "value-global");
  Assert.equal(cps.hasPref(null, "value-global"), true);
  // fallback to non private mode value
  Assert.equal(cps.getPref(null, "value-global"), "foo-global") ;
  Assert.equal(prefObserver.removedCalledNum, num + 1);

  // test removeGroupedPrefs
  cps.setPref(uri, "value", "foo-private-browsing");
  cps.removeGroupedPrefs();
  Assert.equal(cps.hasPref(uri, "value"), false);
  Assert.equal(cps.getPref(uri, "value"), undefined);

  cps.setPref(null, "value-global", "foo-private-browsing-global");
  cps.removeGroupedPrefs();
  Assert.equal(cps.hasPref(null, "value-global"), true);
  Assert.equal(cps.getPref(null, "value-global"), "foo-private-browsing-global");

  // test removePrefsByName
  num = prefObserver.removedCalledNum;
  cps.setPref(uri, "value", "foo-private-browsing");
  cps.removePrefsByName("value");
  Assert.equal(cps.hasPref(uri, "value"), false);
  Assert.equal(cps.getPref(uri, "value"), undefined);
  Assert.ok(prefObserver.removedCalledNum > num);

  num = prefObserver.removedCalledNum;
  cps.setPref(null, "value-global", "foo-private-browsing");
  cps.removePrefsByName("value-global");
  Assert.equal(cps.hasPref(null, "value-global"), false);
  Assert.equal(cps.getPref(null, "value-global"), undefined);
  Assert.ok(prefObserver.removedCalledNum > num);

  // test getPrefs
  cps.setPref(uri, "value", "foo-private-browsing");
  Assert.equal(cps.getPrefs(uri).getProperty("value"), "foo-private-browsing");

  cps.setPref(null, "value-global", "foo-private-browsing-global");
  Assert.equal(cps.getPrefs(null).getProperty("value-global"), "foo-private-browsing-global");

  // test getPrefsByName
  Assert.equal(cps.getPrefsByName("value").getProperty(group), "foo-private-browsing");
  Assert.equal(cps.getPrefsByName("value-global").getProperty(null), "foo-private-browsing-global");

  cps.removeObserver("value", prefObserver);
  cps.removeObserver("value-global", prefObserver);
}
