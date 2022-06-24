function noop() {}

function run_test() {
  var contentHandler = {
    attrs: null,
    reset: function() {
        this.attrs = [];
    },
    startDocument: noop,
    endDocument: noop,

    startElement: function startElement(aNamespaceURI, aLocalName, aNodeName, aAttrs) {
      for (var i = 0; i < aAttrs.length; i++) 
        this.attrs.push(aAttrs.getQName(i));
    },

    endElement: noop,
    characters: noop,
    processingInstruction: noop,
    ignorableWhitespace: noop,
    startPrefixMapping: noop,
    endPrefixMapping: noop
  };

  const nsISAXXMLReader = Ci.nsISAXXMLReader;
  const src = "<a:x xmlns:a='foo' y='bar'/>";
  const NS_PREFIX = "http://xml.org/sax/features/namespace-prefixes";

  var saxReader = Cc["@mozilla.org/saxparser/xmlreader;1"]
                    .createInstance(nsISAXXMLReader);
  Assert.ok(!saxReader.getFeature(NS_PREFIX));
  saxReader.contentHandler = contentHandler;
  contentHandler.reset();
  saxReader.parseFromString(src, "application/xml");
  Assert.equal(contentHandler.attrs.length, 1);
  Assert.equal(contentHandler.attrs[0], "y");

  saxReader.setFeature(NS_PREFIX, true);
  Assert.ok(saxReader.getFeature(NS_PREFIX));
  contentHandler.reset();
  saxReader.parseFromString(src, "application/xml");
  Assert.equal(contentHandler.attrs.length, 2);
  Assert.equal(contentHandler.attrs[0], "xmlns:a");
  Assert.equal(contentHandler.attrs[1], "y");

  saxReader.setFeature(NS_PREFIX, false);
  Assert.ok(!saxReader.getFeature(NS_PREFIX));
  contentHandler.reset();
  saxReader.parseFromString(src, "application/xml");
  Assert.equal(contentHandler.attrs.length, 1);
  Assert.equal(contentHandler.attrs[0], "y");
}
