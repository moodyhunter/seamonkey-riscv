/* -*- indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* vim:set ts=2 sw=2 sts=2 et: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const nsIFile              = Ci.nsIFile;
const nsIProperties        = Ci.nsIProperties;
const nsIFileInputStream   = Ci.nsIFileInputStream;
const nsIInputStream       = Ci.nsIInputStream;

const nsIDOMParser         = Ci.nsIDOMParser;
const nsIDOMSerializer     = Ci.nsIDOMSerializer;
const nsIDOMDocument       = Ci.nsIDOMDocument;
const nsIDOMElement        = Ci.nsIDOMElement;
const nsIDOMNode           = Ci.nsIDOMNode;
const nsIDOMCharacterData  = Ci.nsIDOMCharacterData;
const nsIDOMAttr           = Ci.nsIDOMAttr;
const nsIDOMNodeList       = Ci.nsIDOMNodeList;
const nsIDOMXULElement     = Ci.nsIDOMXULElement;
const nsIDOMProcessingInstruction = Ci.nsIDOMProcessingInstruction;

function DOMParser() {
  var parser = Cc["@mozilla.org/xmlextras/domparser;1"].createInstance(nsIDOMParser);
  parser.init();
  return parser;
}

var __testsDirectory = null;

function ParseFile(file) {
  if (typeof(file) == "string") {
    if (!__testsDirectory) {
      __testsDirectory = do_get_cwd();
    }
    var fileObj = __testsDirectory.clone();
    fileObj.append(file);
    file = fileObj;
  }

  Assert.equal(file instanceof nsIFile, true);

  var fileStr = Cc["@mozilla.org/network/file-input-stream;1"]
                 .createInstance(nsIFileInputStream);
  // Init for readonly reading
  fileStr.init(file,  0x01, 0o400, nsIFileInputStream.CLOSE_ON_EOF);
  return ParseXML(fileStr);
}

function ParseXML(data) {
  if (typeof(data) == "string") {
    return DOMParser().parseFromString(data, "application/xml");
  }

  Assert.equal(data instanceof nsIInputStream, true);
  
  return DOMParser().parseFromStream(data, "UTF-8", data.available(),
                                     "application/xml");
}

function DOMSerializer() {
  return Cc["@mozilla.org/xmlextras/xmlserializer;1"]
          .createInstance(nsIDOMSerializer);
}

function SerializeXML(node) {
  return DOMSerializer().serializeToString(node);
}

function roundtrip(obj) {
  if (typeof(obj) == "string") {
    return SerializeXML(ParseXML(obj));
  }

  Assert.equal(obj instanceof nsIDOMNode, true);
  return ParseXML(SerializeXML(obj));
}

function do_compare_attrs(e1, e2) {
  const xmlns = "http://www.w3.org/2000/xmlns/";

  var a1 = e1.attributes;
  var a2 = e2.attributes;
  for (var i = 0; i < a1.length; ++i) {
    var att = a1.item(i);
    // Don't test for namespace decls, since those can just sorta be
    // scattered about
    if (att.namespaceURI != xmlns) {
      var att2 = a2.getNamedItemNS(att.namespaceURI, att.localName);
      if (!att2) {
        do_throw("Missing attribute with namespaceURI '" + att.namespaceURI +
                 "' and localName '" + att.localName + "'");
      }
      Assert.equal(att.QueryInterface(nsIDOMAttr).value, 
                   att2.QueryInterface(nsIDOMAttr).value);
    }
  }
}

function do_check_equiv(dom1, dom2) {
  Assert.equal(dom1.nodeType, dom2.nodeType);
  // There's no classinfo around, so we'll need to do some QIing to
  // make sure the right interfaces are flattened as needed.
  switch (dom1.nodeType) {
  case nsIDOMNode.PROCESSING_INSTRUCTION_NODE:
    Assert.equal(dom1.QueryInterface(nsIDOMProcessingInstruction).target, 
                 dom2.QueryInterface(nsIDOMProcessingInstruction).target);
    Assert.equal(dom1.data, dom2.data);
  case nsIDOMNode.TEXT_NODE:
  case nsIDOMNode.CDATA_SECTION_NODE:
  case nsIDOMNode.COMMENT_NODE:
    Assert.equal(dom1.QueryInterface(nsIDOMCharacterData).data,
                 dom2.QueryInterface(nsIDOMCharacterData).data);
    break;
  case nsIDOMNode.ELEMENT_NODE:
    Assert.equal(dom1.namespaceURI, dom2.namespaceURI);
    Assert.equal(dom1.localName, dom2.localName);
    // Compare attrs in both directions -- do_compare_attrs does a
    // subset check.
    do_compare_attrs(dom1, dom2);
    do_compare_attrs(dom2, dom1);
    // Fall through
  case nsIDOMNode.DOCUMENT_NODE:
    Assert.equal(dom1.childNodes.length, dom2.childNodes.length);
    for (var i = 0; i < dom1.childNodes.length; ++i) {
      do_check_equiv(dom1.childNodes.item(i), dom2.childNodes.item(i));
    }
    break;
  }
}

function do_check_serialize(dom) {
  do_check_equiv(dom, roundtrip(dom));
}

function Pipe() {
  var p = Cc["@mozilla.org/pipe;1"].createInstance(Ci.nsIPipe);
  p.init(false, false, 0, 0xffffffff, null);
  return p;
}

function ScriptableInput(arg) {
  if (arg instanceof Ci.nsIPipe) {
    arg = arg.inputStream;
  }

  var str = Cc["@mozilla.org/scriptableinputstream;1"].
    createInstance(Ci.nsIScriptableInputStream);

  str.init(arg);

  return str;
}