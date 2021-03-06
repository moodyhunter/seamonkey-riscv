function run_test()
{
  let rgn = Cc["@mozilla.org/gfx/region;1"].createInstance(Ci.nsIScriptableRegion);
  Assert.ok (rgn.getRects() === null);
  rgn.unionRect(0,0,80,60);
  Assert.ok (rgn.getRects().toString() == "0,0,80,60");
  rgn.unionRect(90,70,1,1);
  Assert.ok (rgn.getRects().toString() == "0,0,80,60,90,70,1,1");
}
