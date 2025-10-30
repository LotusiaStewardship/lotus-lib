"use strict";
/**
 * Base32 encoding/decoding utility
 * Migrated from bitcore-lib-xpi with ESM support and TypeScript
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Base32 = void 0;
var preconditions_js_1 = require("./preconditions.js");
/**
 * Charset containing the 32 symbols used in the base32 encoding.
 */
var CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
/**
 * Inverted index mapping each symbol into its index within the charset.
 */
var CHARSET_INVERSE_INDEX = {
    'q': 0,
    'p': 1,
    'z': 2,
    'r': 3,
    'y': 4,
    '9': 5,
    'x': 6,
    '8': 7,
    'g': 8,
    'f': 9,
    '2': 10,
    't': 11,
    'v': 12,
    'd': 13,
    'w': 14,
    '0': 15,
    's': 16,
    '3': 17,
    'j': 18,
    'n': 19,
    '5': 20,
    '4': 21,
    'k': 22,
    'h': 23,
    'c': 24,
    'e': 25,
    '6': 26,
    'm': 27,
    'u': 28,
    'a': 29,
    '7': 30,
    'l': 31,
};
var Base32 = /** @class */ (function () {
    function Base32() {
    }
    /**
     * Encodes the given array of 5-bit integers as a base32-encoded string.
     *
     * @param data Array of integers between 0 and 31 inclusive.
     */
    Base32.encode = function (data) {
        preconditions_js_1.Preconditions.checkArgument(Array.isArray(data), 'data', 'Must be Array');
        var base32 = '';
        for (var i = 0; i < data.length; i++) {
            var value = data[i];
            preconditions_js_1.Preconditions.checkArgument(0 <= value && value < 32, 'value', "value ".concat(value));
            base32 += CHARSET[value];
        }
        return base32;
    };
    /**
     * Decodes the given base32-encoded string into an array of 5-bit integers.
     *
     * @param base32 Base32-encoded string
     */
    Base32.decode = function (base32) {
        preconditions_js_1.Preconditions.checkArgument(typeof base32 === 'string', 'base32', 'Must be base32-encoded string');
        var data = [];
        for (var i = 0; i < base32.length; i++) {
            var value = base32[i];
            preconditions_js_1.Preconditions.checkArgument(value in CHARSET_INVERSE_INDEX, 'value', "value ".concat(value));
            data.push(CHARSET_INVERSE_INDEX[value]);
        }
        return data;
    };
    return Base32;
}());
exports.Base32 = Base32;
