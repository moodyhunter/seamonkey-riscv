function run_test() {

  var sb = new Cu.Sandbox('http://www.example.com');
  function checkThrows(str, rgxp) {
    try {
      sb.eval(str);
      Assert.ok(false);
    } catch (e) {
      Assert.ok(rgxp.test(e));
    }
  }

  sb.exposed = {
    get getterProp() { return 42; },
    set setterProp(x) { },
    get getterSetterProp() { return 42; },
    set getterSetterProp(x) { },
    simpleValueProp: 42,
    objectValueProp: { val: 42, __exposedProps__: { val: 'r' } },
    contentCallableValueProp: new sb.Function('return 42'),
    chromeCallableValueProp: function() {},
    __exposedProps__: { getterProp : 'r',
                        setterProp : 'w',
                        getterSetterProp: 'rw',
                        simpleValueProp: 'r',
                        objectValueProp: 'r',
                        contentCallableValueProp: 'r',
                        chromeCallableValueProp: 'r' }
  };

  Assert.equal(sb.eval('exposed.simpleValueProp'), 42);
  Assert.equal(sb.eval('exposed.objectValueProp.val'), 42);
  checkThrows('exposed.getterProp;', /privileged accessor/i);
  checkThrows('exposed.setterProp = 42;', /privileged accessor/i);
  checkThrows('exposed.getterSetterProp;', /privileged accessor/i);
  checkThrows('exposed.getterSetterProp = 42;', /privileged accessor/i);
  Assert.equal(sb.eval('exposed.contentCallableValueProp()'), 42);
  checkThrows('exposed.chromeCallableValueProp();', /privileged or cross-origin callable/i);
}
