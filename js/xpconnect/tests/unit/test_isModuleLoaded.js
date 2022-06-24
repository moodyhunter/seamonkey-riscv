function run_test() {
  // Existing module.
  Assert.ok(!Cu.isModuleLoaded("resource://gre/modules/ISO8601DateUtils.jsm"),
            "isModuleLoaded returned correct value for non-loaded module");
  ChromeUtils.import("resource://gre/modules/ISO8601DateUtils.jsm");
  Assert.ok(Cu.isModuleLoaded("resource://gre/modules/ISO8601DateUtils.jsm"),
            "isModuleLoaded returned true after loading that module");
  Cu.unload("resource://gre/modules/ISO8601DateUtils.jsm");
  Assert.ok(!Cu.isModuleLoaded("resource://gre/modules/ISO8601DateUtils.jsm"),
            "isModuleLoaded returned false after unloading that module");

  // Non-existing module
  Assert.ok(!Cu.isModuleLoaded("resource://gre/modules/ISO8601DateUtils1.jsm"),
            "isModuleLoaded returned correct value for non-loaded module");
  try {
    ChromeUtils.import("resource://gre/modules/ISO8601DateUtils1.jsm");
    Assert.ok(false,
              "Should have thrown while trying to load a non existing file");
  } catch (ex) {}
  Assert.ok(!Cu.isModuleLoaded("resource://gre/modules/ISO8601DateUtils1.jsm"),
            "isModuleLoaded returned correct value for non-loaded module");
}
