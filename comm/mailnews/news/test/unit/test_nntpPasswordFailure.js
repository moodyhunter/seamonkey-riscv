/**
 * This test checks to see if the nntp password failure is handled correctly.
 * The steps are:
 *   - Have an invalid password in the password database.
 *   - Check we get a prompt asking what to do.
 *   - Check retry does what it should do.
 *   - Check cancel does what it should do.
 *   - Re-initiate connection, this time select enter new password, check that
 *     we get a new password prompt and can enter the password.
 */

ChromeUtils.import("resource://gre/modules/XPCOMUtils.jsm");
ChromeUtils.import("resource:///modules/mailServices.js");
ChromeUtils.import("resource://gre/modules/Services.jsm");
load("../../../resources/logHelper.js");
load("../../../resources/asyncTestUtils.js");
load("../../../resources/alertTestUtils.js");
load("../../../resources/passwordStorage.js");
load("../../../resources/mailTestUtils.js");

var test = null;
var server;
var daemon;
var incomingServer;
var folder;
var attempt = 0;
var count = {};
var logins;

var kUserName = "testnews";
var kInvalidPassword = "newstest";
var kValidPassword = "notallama";

function alert(aDialogText, aText)
{
  // The first few attempts may prompt about the password problem, the last
  // attempt shouldn't.
  Assert.ok(attempt < 4);

  // Log the fact we've got an alert, but we don't need to test anything here.
  dump("Alert Title: " + aDialogText + "\nAlert Text: " + aText + "\n");
}

function confirmEx(aDialogTitle, aText, aButtonFlags, aButton0Title,
                   aButton1Title, aButton2Title, aCheckMsg, aCheckState) {
  switch (++attempt) {
    // First attempt, retry.
    case 1:
      dump("\nAttempting retry\n");
      return 0;
    // Second attempt, cancel.
    case 2:
      dump("\nCancelling login attempt\n");
      return 1;
    // Third attempt, retry.
    case 3:
      dump("\nAttempting Retry\n");
      return 0;
    // Fourth attempt, enter a new password.
    case 4:
      dump("\nEnter new password\n");
      return 2;
    default:
      do_throw("unexpected attempt number " + attempt);
      return 1;
  }
}

function promptUsernameAndPasswordPS(aParent, aDialogTitle, aText, aUsername,
                                     aPassword, aCheckMsg, aCheckState) {
  if (attempt == 4) {
    aUsername.value = kUserName;
    aPassword.value = kValidPassword;
    aCheckState.value = true;
    return true;
  }
  return false;
}

function getMail() {
  folder.getNewMessages(gDummyMsgWindow, urlListener);
}

var urlListener =
{
  OnStartRunningUrl: function (url) {
  },
  OnStopRunningUrl: function (url, result) {
    try {
      // On the last attempt, we should have successfully got one mail.
      Assert.equal(folder.getTotalMessages(false),
                  attempt == 4 ? 1 : 0);

      // If we've just cancelled, expect failure rather than success
      // because the server dropped the connection.
      dump("in onStopRunning, result = " + result + "\n");
      //Assert.equal(result, attempt == 2 ? Cr.NS_ERROR_FAILURE : 0);
      async_driver();
    }
    catch (e) {
      // If we have an error, clean up nicely before we throw it.
      server.stop();

      var thread = gThreadManager.currentThread;
      while (thread.hasPendingEvents())
        thread.processNextEvent(true);

      do_throw(e);
    }
  }
};

// Definition of tests
var tests = [
  getMail1,
  getMail2,
  endTest
]

function* getMail1() {
  dump("\nGet Mail 1\n");

  // Now get mail
  getMail();
  yield false;
  dump("\nGot Mail 1\n");

  Assert.equal(attempt, 2);

  // Check that we haven't forgotten the login even though we've retried and
  // canceled.
  logins = Services.logins.findLogins(count, "news://localhost", null,
                                      "news://localhost");

  Assert.equal(count.value, 1);
  Assert.equal(logins[0].username, kUserName);
  Assert.equal(logins[0].password, kInvalidPassword);

  server.resetTest();
  yield true;
}

function* getMail2() {
  dump("\nGet Mail 2\n");

  // Now get the mail
  getMail();
  yield false;
  dump("\nGot Mail 2\n");
}

function* endTest() {
  // Now check the new one has been saved.
  logins = Services.logins.findLogins(count, "news://localhost", null,
                                      "news://localhost");

  Assert.equal(count.value, 1);
  Assert.equal(logins[0].username, kUserName);
  Assert.equal(logins[0].password, kValidPassword);
  yield true;
}

function run_test()
{
  mailTestUtils.registerUMimTypProvider();

  // Disable new mail notifications
  Services.prefs.setBoolPref("mail.biff.play_sound", false);
  Services.prefs.setBoolPref("mail.biff.show_alert", false);
  Services.prefs.setBoolPref("mail.biff.show_tray_icon", false);
  Services.prefs.setBoolPref("mail.biff.animate_dock_icon", false);
  Services.prefs.setBoolPref("signon.debug", true);

  // Prepare files for passwords (generated by a script in bug 1018624).
  setupForPassword("signons-mailnews1.8.json");

  registerAlertTestUtils();

  // Set up the server
  daemon = setupNNTPDaemon();
  function createHandler(d) {
    var handler = new NNTP_RFC4643_extension(d);
    handler.expectedPassword = kValidPassword;
    return handler;
  }
  server = new nsMailServer(createHandler, daemon);
  server.start();
  incomingServer = setupLocalServer(server.port);
  folder = incomingServer.rootFolder.getChildNamed("test.subscribe.simple");

  // Check that we haven't got any messages in the folder, if we have its a test
  // setup issue.
  Assert.equal(folder.getTotalMessages(false), 0);

  async_run_tests(tests);
}
