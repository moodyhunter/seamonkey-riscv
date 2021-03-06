// Check that asm.js code shows up on the stack.
function run_test() {
    let p = Cc["@mozilla.org/tools/profiler;1"];

    // Just skip the test if the profiler component isn't present.
    if (!p)
        return;
    p = p.getService(Ci.nsIProfiler);
    if (!p)
        return;

    // This test assumes that it's starting on an empty profiler stack.
    // (Note that the other profiler tests also assume the profiler
    // isn't already started.)
    Assert.ok(!p.IsActive());

    let jsFuns = Cu.getJSTestingFunctions();
    if (!jsFuns.isAsmJSCompilationAvailable())
        return;

    const ms = 10;
    p.StartProfiler(10000, ms, ["js"], 1);

    let stack = null;
    function ffi_function() {
        var delayMS = 5;
        while (1) {
            let then = Date.now();
            do {
              // do nothing
            } while (Date.now() - then < delayMS);

            var thread0 = p.getProfileData().threads[0];

            if (delayMS > 30000)
                return;

            delayMS *= 2;

            if (thread0.samples.data.length == 0)
                continue;

            var lastSample = thread0.samples.data[thread0.samples.data.length - 1];
            stack = String(getInflatedStackLocations(thread0, lastSample));
            if (stack.indexOf("trampoline") !== -1)
                return;
        }
    }

    function asmjs_module(global, ffis) {
        "use asm";
        var ffi = ffis.ffi;
        function asmjs_function() {
            ffi();
        }
        return asmjs_function;
    }

    Assert.ok(jsFuns.isAsmJSModule(asmjs_module));

    var asmjs_function = asmjs_module(null, {ffi: ffi_function});
    Assert.ok(jsFuns.isAsmJSFunction(asmjs_function));

    asmjs_function();

    Assert.notEqual(stack, null);

    var i1 = stack.indexOf("entry trampoline");
    Assert.ok(i1 !== -1);
    var i2 = stack.indexOf("asmjs_function");
    Assert.ok(i2 !== -1);
    var i3 = stack.indexOf("FFI trampoline");
    Assert.ok(i3 !== -1);
    var i4 = stack.indexOf("ffi_function");
    Assert.ok(i4 !== -1);
    Assert.ok(i1 < i2);
    Assert.ok(i2 < i3);
    Assert.ok(i3 < i4);

    p.StopProfiler();
}
