"use strict";
/**
 * Convert bits utility
 * Migrated from bitcore-lib-xpi with ESM support and TypeScript
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertBits = convertBits;
var preconditions_js_1 = require("./preconditions.js");
/**
 * Converts an array of integers made up of `from` bits into an
 * array of integers made up of `to` bits. The output array is
 * zero-padded if necessary, unless strict mode is true.
 * Original by Pieter Wuille: https://github.com/sipa/bech32.
 *
 * @param data Array of integers made up of `from` bits.
 * @param from Length in bits of elements in the input array.
 * @param to Length in bits of elements in the output array.
 * @param strict Require the conversion to be completed without padding.
 */
function convertBits(data, from, to, strict) {
    if (strict === void 0) { strict = false; }
    var accumulator = 0;
    var bits = 0;
    var result = [];
    var mask = (1 << to) - 1;
    for (var i = 0; i < data.length; i++) {
        var value = data[i];
        preconditions_js_1.Preconditions.checkArgument(!(value < 0 || value >> from !== 0), 'value', "value ".concat(value));
        accumulator = (accumulator << from) | value;
        bits += from;
        while (bits >= to) {
            bits -= to;
            result.push((accumulator >> bits) & mask);
        }
    }
    if (!strict) {
        if (bits > 0) {
            result.push((accumulator << (to - bits)) & mask);
        }
    }
    else {
        preconditions_js_1.Preconditions.checkState(!(bits >= from || (accumulator << (to - bits)) & mask), 'Conversion requires padding but strict mode was used');
    }
    return result;
}
