/**
 * This test checks to see if the pop3 password failure is handled correctly.
 * The steps are:
 *   - Have an invalid password in the password database.
 *   - Check we get a prompt asking what to do.
 *   - Check retry does what it should do.
 *   - Check cancel does what it should do.
 *   - Re-initiate connection, this time select enter new password, check that
 *     we get a new password prompt and can enter the password.
 */

ChromeUtils.import("resource:///modules/mailServices.js");
ChromeUtils.import("resource://gre/modules/Services.jsm");
ChromeUtils.import("resource://gre/modules/XPCOMUtils.jsm");

load("../../../resources/logHelper.js");
load("../../../resources/alertTestUtils.js");
load("../../../resources/passwordStorage.js");
load("../../../resources/mailTestUtils.js");
load("../../../resources/asyncTestUtils.js");

var test = null;
var server;
var daemon;
var incomingServer;
var attempt = 0;

var kUserName = "testpop3";
var kInvalidPassword = "pop3test";
var kValidPassword = "testpop3";

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

function promptPasswordPS(aParent, aDialogTitle, aText, aPassword, aCheckMsg,
                          aCheckState) {
  if (attempt == 4) {
    aPassword.value = kValidPassword;
    aCheckState.value = true;
    return true;
  }
  return false;
}

function getPopMail() {
  MailServices.pop3.GetNewMail(gDummyMsgWindow, urlListener, localAccountUtils.inboxFolder,
                               incomingServer);

  server.performTest();
  return false;
}

var urlListener =
{
  OnStartRunningUrl: function (url) {
  },
  OnStopRunningUrl: function (url, result) {
    try {
      var transaction = server.playTransaction();

      // On the last attempt, we should have successfully got one mail.
      Assert.equal(localAccountUtils.inboxFolder.getTotalMessages(false),
                  attempt == 4 ? 1 : 0);

      // If we've just cancelled, expect binding aborted rather than success.
      Assert.equal(result, attempt == 2 ? Cr.NS_BINDING_ABORTED : 0);
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
  end_test
]

function actually_run_test() {
  daemon.setMessages(["message1.eml"]);
  async_run_tests(tests);
}

function* getMail1()
{
  dump("\nGet Mail 1\n");

  // Now get mail
  getPopMail();
  yield false;

  dump("\nGot Mail 1\n");

  Assert.equal(attempt, 2);

  // Check that we haven't forgotten the login even though we've retried and
  // canceled.
  let count = {};
  let logins = Services.logins.findLogins(count, "mailbox://localhost", null,
                                          "mailbox://localhost");

  Assert.equal(count.value, 1);
  Assert.equal(logins[0].username, kUserName);
  Assert.equal(logins[0].password, kInvalidPassword);

  server.resetTest();
  yield true;
}

function* getMail2()
{
  dump("\nGet Mail 2\n");

  // Now get the mail
  getPopMail();
  yield false;
  dump("\nGot Mail 2\n");

  // Now check the new one has been saved.
  let count = {};
  let logins = Services.logins.findLogins(count, "mailbox://localhost", null,
                                          "mailbox://localhost");

  Assert.equal(count.value, 1);
  Assert.equal(logins[0].username, kUserName);
  Assert.equal(logins[0].password, kValidPassword);
  yield true;
}

function* end_test()
{
  do_test_finished();
}

add_task(async function () {
  // Disable new mail notifications
  Services.prefs.setBoolPref("mail.biff.play_sound", false);
  Services.prefs.setBoolPref("mail.biff.show_alert", false);
  Services.prefs.setBoolPref("mail.biff.show_tray_icon", false);
  Services.prefs.setBoolPref("mail.biff.animate_dock_icon", false);
  Services.prefs.setBoolPref("signon.debug", true);

  // Prepare files for passwords (generated by a script in bug 1018624).
  await setupForPassword("signons-mailnews1.8.json");

  registerAlertTestUtils();

  // Set up the Server
  var serverArray = setupServerDaemon();
  daemon = serverArray[0];
  server = serverArray[1];
  var handler = serverArray[2];
  server.start();

  // Login information needs to match the one stored in the signons json file.
  handler.kUsername = kUserName;
  handler.kPassword = kValidPassword;

  // Set up the basic accounts and folders.
  // We would use createPop3ServerAndLocalFolders() however we want to have
  // a different username and NO password for this test (as we expect to load
  // it from the signons json file in which the login information is stored).
  localAccountUtils.loadLocalMailAccount();

  incomingServer = MailServices.accounts.createIncomingServer(kUserName, "localhost", "pop3");

  incomingServer.port = server.port;

  // Check that we haven't got any messages in the folder, if we have its a test
  // setup issue.
  Assert.equal(localAccountUtils.inboxFolder.getTotalMessages(false), 0);

  do_test_pending();

  actually_run_test();
});

function run_test() {
  run_next_test();
}
