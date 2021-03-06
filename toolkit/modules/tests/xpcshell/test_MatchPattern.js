/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

ChromeUtils.import("resource://gre/modules/MatchPattern.jsm");
ChromeUtils.import("resource://gre/modules/Services.jsm");

function test_matches() {
  function test(url, pattern) {
    let uri = Services.io.newURI(url);
    let m = new MatchPattern(pattern);
    return m.matches(uri);
  }

  function pass({url, pattern}) {
    Assert.ok(test(url, pattern), `Expected match: ${JSON.stringify(pattern)}, ${url}`);
  }

  function fail({url, pattern}) {
    Assert.ok(!test(url, pattern), `Expected no match: ${JSON.stringify(pattern)}, ${url}`);
  }

  // Invalid pattern.
  fail({url: "http://mozilla.org", pattern: ""});

  // Pattern must include trailing slash.
  fail({url: "http://mozilla.org", pattern: "http://mozilla.org"});

  // Protocol not allowed.
  fail({url: "http://mozilla.org", pattern: "gopher://wuarchive.wustl.edu/"});

  pass({url: "http://mozilla.org", pattern: "http://mozilla.org/"});
  pass({url: "http://mozilla.org/", pattern: "http://mozilla.org/"});

  pass({url: "http://mozilla.org/", pattern: "*://mozilla.org/"});
  pass({url: "https://mozilla.org/", pattern: "*://mozilla.org/"});
  fail({url: "file://mozilla.org/", pattern: "*://mozilla.org/"});
  fail({url: "ftp://mozilla.org/", pattern: "*://mozilla.org/"});

  fail({url: "http://mozilla.com", pattern: "http://*mozilla.com*/"});
  fail({url: "http://mozilla.com", pattern: "http://mozilla.*/"});
  fail({url: "http://mozilla.com", pattern: "http:/mozilla.com/"});

  pass({url: "http://google.com", pattern: "http://*.google.com/"});
  pass({url: "http://docs.google.com", pattern: "http://*.google.com/"});

  pass({url: "http://mozilla.org:8080", pattern: "http://mozilla.org/"});
  pass({url: "http://mozilla.org:8080", pattern: "*://mozilla.org/"});
  fail({url: "http://mozilla.org:8080", pattern: "http://mozilla.org:8080/"});

  // Now try with * in the path.
  pass({url: "http://mozilla.org", pattern: "http://mozilla.org/*"});
  pass({url: "http://mozilla.org/", pattern: "http://mozilla.org/*"});

  pass({url: "http://mozilla.org/", pattern: "*://mozilla.org/*"});
  pass({url: "https://mozilla.org/", pattern: "*://mozilla.org/*"});
  fail({url: "file://mozilla.org/", pattern: "*://mozilla.org/*"});
  fail({url: "http://mozilla.com", pattern: "http://mozilla.*/*"});

  pass({url: "http://google.com", pattern: "http://*.google.com/*"});
  pass({url: "http://docs.google.com", pattern: "http://*.google.com/*"});

  // Check path stuff.
  fail({url: "http://mozilla.com/abc/def", pattern: "http://mozilla.com/"});
  pass({url: "http://mozilla.com/abc/def", pattern: "http://mozilla.com/*"});
  pass({url: "http://mozilla.com/abc/def", pattern: "http://mozilla.com/a*f"});
  pass({url: "http://mozilla.com/abc/def", pattern: "http://mozilla.com/a*"});
  pass({url: "http://mozilla.com/abc/def", pattern: "http://mozilla.com/*f"});
  fail({url: "http://mozilla.com/abc/def", pattern: "http://mozilla.com/*e"});
  fail({url: "http://mozilla.com/abc/def", pattern: "http://mozilla.com/*c"});

  fail({url: "http:///a.html", pattern: "http:///a.html"});
  pass({url: "file:///foo", pattern: "file:///foo*"});
  pass({url: "file:///foo/bar.html", pattern: "file:///foo*"});

  pass({url: "http://mozilla.org/a", pattern: "<all_urls>"});
  pass({url: "https://mozilla.org/a", pattern: "<all_urls>"});
  pass({url: "ftp://mozilla.org/a", pattern: "<all_urls>"});
  pass({url: "file:///a", pattern: "<all_urls>"});
  fail({url: "gopher://wuarchive.wustl.edu/a", pattern: "<all_urls>"});

  // Multiple patterns.
  pass({url: "http://mozilla.org", pattern: ["http://mozilla.org/"]});
  pass({url: "http://mozilla.org", pattern: ["http://mozilla.org/", "http://mozilla.com/"]});
  pass({url: "http://mozilla.com", pattern: ["http://mozilla.org/", "http://mozilla.com/"]});
  fail({url: "http://mozilla.biz", pattern: ["http://mozilla.org/", "http://mozilla.com/"]});

  // Match url with fragments.
  pass({url: "http://mozilla.org/base#some-fragment", pattern: "http://mozilla.org/base"});
}

function test_overlaps() {
  function test(filter, hosts, optional) {
    const f = new MatchPattern(filter);
    return f.overlapsPermissions(new MatchPattern(hosts), new MatchPattern(optional));
  }

  function pass({filter = [], hosts = [], optional = []}) {
    ok(test(filter, hosts, optional), `Expected overlap: ${filter}, ${hosts} (${optional})`);
  }

  function fail({filter = [], hosts = [], optional = []}) {
    ok(!test(filter, hosts, optional), `Expected no overlap: ${filter}, ${hosts} (${optional})`);
  }

  // Direct comparison.
  pass({hosts: "http://ab.cd/", filter: "http://ab.cd/"});
  fail({hosts: "http://ab.cd/", filter: "ftp://ab.cd/"});

  // Wildcard protocol.
  pass({hosts: "*://ab.cd/", filter: "https://ab.cd/"});
  fail({hosts: "*://ab.cd/", filter: "ftp://ab.cd/"});

  // Wildcard subdomain.
  pass({hosts: "http://*.ab.cd/", filter: "http://ab.cd/"});
  pass({hosts: "http://*.ab.cd/", filter: "http://www.ab.cd/"});
  fail({hosts: "http://*.ab.cd/", filter: "http://ab.cd.ef/"});
  fail({hosts: "http://*.ab.cd/", filter: "http://www.cd/"});

  // Wildcard subsumed.
  pass({hosts: "http://*.ab.cd/", filter: "http://*.cd/"});
  fail({hosts: "http://*.cd/", filter: "http://*.xy/"});

  // Subdomain vs substring.
  fail({hosts: "http://*.ab.cd/", filter: "http://fake-ab.cd/"});
  fail({hosts: "http://*.ab.cd/", filter: "http://*.fake-ab.cd/"});

  // Wildcard domain.
  pass({hosts: "http://*/", filter: "http://ab.cd/"});
  fail({hosts: "http://*/", filter: "https://ab.cd/"});

  // Wildcard wildcards.
  pass({hosts: "<all_urls>", filter: "ftp://ab.cd/"});
  fail({hosts: "<all_urls>", filter: ""});
  fail({hosts: "<all_urls>"});

  // Multiple hosts.
  pass({hosts: ["http://ab.cd/"], filter: ["http://ab.cd/"]});
  pass({hosts: ["http://ab.cd/", "http://ab.xy/"], filter: "http://ab.cd/"});
  pass({hosts: ["http://ab.cd/", "http://ab.xy/"], filter: "http://ab.xy/"});
  fail({hosts: ["http://ab.cd/", "http://ab.xy/"], filter: "http://ab.zz/"});

  // Multiple Multiples.
  pass({hosts: ["http://*.ab.cd/"], filter: ["http://ab.cd/", "http://www.ab.cd/"]});
  pass({hosts: ["http://ab.cd/", "http://ab.xy/"], filter: ["http://ab.cd/", "http://ab.xy/"]});
  fail({hosts: ["http://ab.cd/", "http://ab.xy/"], filter: ["http://ab.cd/", "http://ab.zz/"]});

  // Optional.
  pass({hosts: [], optional: "http://ab.cd/", filter: "http://ab.cd/"});
  pass({hosts: "http://ab.cd/", optional: "http://ab.xy/", filter: ["http://ab.cd/", "http://ab.xy/"]});
  fail({hosts: "http://ab.cd/", optional: "https://ab.xy/", filter: "http://ab.xy/"});
}

function run_test() {
  test_matches();
  test_overlaps();
}
