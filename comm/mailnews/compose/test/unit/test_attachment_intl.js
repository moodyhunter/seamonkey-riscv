/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/*
 * attachment test using non-ascii character
 */

var nonAsciiUrl = "http://\u65e5\u672c\u8a9e.jp";
var prettyResult = "\u65e5\u672c\u8a9e.jp";

function doAttachmentUrlTest() {
  // handles non-ascii url in nsIMsgAttachment

  var attachment = Cc["@mozilla.org/messengercompose/attachment;1"]
                     .createInstance(Ci.nsIMsgAttachment);
  attachment.url = nonAsciiUrl;

  Assert.equal(attachment.url, nonAsciiUrl);
}

function doPrettyNameTest() {
  // handles non-ascii url in nsIMsgCompose

  var msgCompose = Cc["@mozilla.org/messengercompose/compose;1"]
                     .createInstance(Ci.nsIMsgCompose);

  Assert.equal(msgCompose.AttachmentPrettyName(nonAsciiUrl, null),
              prettyResult);
}

function run_test() {
  doAttachmentUrlTest();
  doPrettyNameTest();

  do_test_finished();
}

