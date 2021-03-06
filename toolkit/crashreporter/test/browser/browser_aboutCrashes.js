add_task(async function test() {
  let appD = make_fake_appdir();
  let crD = appD.clone();
  crD.append("Crash Reports");
  let crashes = add_fake_crashes(crD, 5);
  // sanity check
  let dirSvc = Cc["@mozilla.org/file/directory_service;1"]
                 .getService(Ci.nsIProperties);
  let appDtest = dirSvc.get("UAppData", Ci.nsIFile);
  ok(appD.equals(appDtest), "directory service provider registered ok");

  await BrowserTestUtils.withNewTab({ gBrowser, url: "about:crashes" }, function(browser) {
    info("about:crashes loaded");
    return ContentTask.spawn(browser, crashes, function(crashes) {
      let doc = content.document;
      let crashlinks = doc.getElementById("submitted").querySelectorAll(".crashReport");
      Assert.equal(crashlinks.length, crashes.length,
        "about:crashes lists correct number of crash reports");
      for (let i = 0; i < crashes.length; i++) {
        Assert.equal(crashlinks[i].firstChild.textContent, crashes[i].id,
          i + ": crash ID is correct");
      }
    });
  });

  cleanup_fake_appdir();
});
