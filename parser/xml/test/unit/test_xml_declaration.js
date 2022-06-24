function noop() {}

function run_test() {
  var evts;

  var contentHandler = {
    attrs: null,
    startDocument: function() {
      evts.push("startDocument");
    },
    endDocument: noop,

    startElement: function startElement() {
      evts.push("startElement");
    },

    endElement: noop,
    characters: noop,
    processingInstruction: noop,
    ignorableWhitespace: noop,
    startPrefixMapping: noop,
    endPrefixMapping: noop
  };

  function XMLDeclHandler(version, encoding, standalone) {
    evts.splice(evts.length, 0, version, encoding, standalone);
  }

  const nsISAXXMLReader = Ci.nsISAXXMLReader;
  var saxReader = Cc["@mozilla.org/saxparser/xmlreader;1"]
                    .createInstance(nsISAXXMLReader);
  saxReader.contentHandler = contentHandler;
  saxReader.declarationHandler = XMLDeclHandler;

  evts = [];
  saxReader.parseFromString("<root/>", "application/xml");
  Assert.equal(evts.length, 2);
  Assert.equal(evts[0], "startDocument");
  Assert.equal(evts[1], "startElement");

  evts = [];
  saxReader.parseFromString("<?xml version='1.0'?><root/>", "application/xml");
  Assert.equal(evts.length, 5);
  Assert.equal(evts[0], "startDocument");
  Assert.equal(evts[1], "1.0");
  Assert.equal(evts[2], "");
  Assert.ok(!evts[3]);
  Assert.equal(evts[4], "startElement");

  evts = [];
  saxReader.parseFromString("<?xml version='1.0' encoding='UTF-8'?><root/>", "application/xml");
  Assert.equal(evts.length, 5);
  Assert.equal(evts[0], "startDocument");
  Assert.equal(evts[1], "1.0");
  Assert.equal(evts[2], "UTF-8");
  Assert.ok(!evts[3]);
  Assert.equal(evts[4], "startElement");

  evts = [];
  saxReader.parseFromString("<?xml version='1.0' standalone='yes'?><root/>", "application/xml");
  Assert.equal(evts.length, 5);
  Assert.equal(evts[0], "startDocument");
  Assert.equal(evts[1], "1.0");
  Assert.equal(evts[2], "");
  Assert.ok(evts[3]);
  Assert.equal(evts[4], "startElement");

  evts = [];
  saxReader.parseFromString("<?xml version='1.0' encoding='UTF-8' standalone='yes'?><root/>", "application/xml");
  Assert.equal(evts.length, 5);
  Assert.equal(evts[0], "startDocument");
  Assert.equal(evts[1], "1.0");
  Assert.equal(evts[2], "UTF-8");
  Assert.ok(evts[3]);
  Assert.equal(evts[4], "startElement");

  evts = [];
  // Not well-formed
  saxReader.parseFromString("<?xml encoding='UTF-8'?><root/>", "application/xml");
  Assert.equal(evts.length, 1);
  Assert.equal(evts[0], "startDocument");  
}
