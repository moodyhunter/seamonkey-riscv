// Copyright (c) 2012 Ecma International.  All rights reserved.
// This code is governed by the BSD license found in the LICENSE file.

/*---
es5id: 15.4.4.17-7-c-ii-10
description: Array.prototype.some - callbackfn is called with 1 formal parameter
---*/

        function callbackfn(val) {
            return val > 10;
        }

assert([11, 12].some(callbackfn), '[11, 12].some(callbackfn) !== true');

reportCompare(0, 0);