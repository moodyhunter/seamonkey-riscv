"use strict";

const { require } = Cu.import("resource://devtools/shared/Loader.jsm", {});
const { console } = Cu.import("resource://gre/modules/Console.jsm", {});

this.validator = require("devtools/client/shared/vendor/stringvalidator/validator");

function describe(suite, testFunc) {
  info(`\n                            Test suite: ${suite}`.toUpperCase());
  testFunc();
}

function it(description, testFunc) {
  info(`\n                              - ${description}:\n`.toUpperCase());
  testFunc();
}
