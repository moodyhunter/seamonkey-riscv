var nativeJSON = Cc["@mozilla.org/dom/json;1"].createInstance(Ci.nsIJSON);

function run_test()
{
  function read_file(path)
  {
    try
    {
      var f = do_get_file(path);
      var istream = Cc["@mozilla.org/network/file-input-stream;1"].createInstance(Ci.nsIFileInputStream);
      istream.init(f, -1, -1, false);
      return nativeJSON.decodeFromStream(istream, istream.available());
    }
    finally
    {
      istream.close();
    }
  }

  var x = read_file("decodeFromStream-01.json");
  Assert.equal(x["JSON Test Pattern pass3"]["The outermost value"], "must be an object or array.");
  Assert.equal(x["JSON Test Pattern pass3"]["In this test"], "It is an object.");

  x = read_file("decodeFromStream-small.json");
  Assert.equal(x.toSource(), "({})", "empty object parsed");
}
