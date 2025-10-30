"use strict";
/**
 * Buffer utility module
 * Migrated from bitcore-lib-xpi with ESM support and TypeScript
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EMPTY_BUFFER = exports.NULL_HASH = exports.BufferUtil = void 0;
var preconditions_js_1 = require("./preconditions.js");
var BufferUtil = /** @class */ (function () {
    function BufferUtil() {
    }
    /**
     * Fill a buffer with a value.
     *
     * @param buffer Buffer to fill
     * @param value Value to fill with
     * @return Buffer
     */
    BufferUtil.fill = function (buffer, value) {
        preconditions_js_1.Preconditions.checkArgumentType(buffer, 'Buffer', 'buffer');
        preconditions_js_1.Preconditions.checkArgumentType(value, 'number', 'value');
        var length = buffer.length;
        for (var i = 0; i < length; i++) {
            buffer[i] = value;
        }
        return buffer;
    };
    /**
     * Return a copy of a buffer
     *
     * @param original Original buffer
     * @return Buffer
     */
    BufferUtil.copy = function (original) {
        var buffer = Buffer.alloc(original.length);
        original.copy(buffer);
        return buffer;
    };
    /**
     * Returns true if the given argument is an instance of a buffer. Tests for
     * both node's Buffer and Uint8Array
     *
     * @param arg Argument to test
     * @return boolean
     */
    BufferUtil.isBuffer = function (arg) {
        return Buffer.isBuffer(arg) || arg instanceof Uint8Array;
    };
    /**
     * Returns a zero-filled byte array
     *
     * @param bytes Number of bytes
     * @return Buffer
     */
    BufferUtil.emptyBuffer = function (bytes) {
        preconditions_js_1.Preconditions.checkArgumentType(bytes, 'number', 'bytes');
        var result = Buffer.alloc(bytes);
        for (var i = 0; i < bytes; i++) {
            result.write('\0', i);
        }
        return result;
    };
    /**
     * Concatenates buffers
     *
     * Shortcut for Buffer.concat
     */
    BufferUtil.concat = function (list, totalLength) {
        return Buffer.concat(list, totalLength);
    };
    /**
     * Check if two buffers are equal
     */
    BufferUtil.equals = function (a, b) {
        if (a.length !== b.length) {
            return false;
        }
        var length = a.length;
        for (var i = 0; i < length; i++) {
            if (a[i] !== b[i]) {
                return false;
            }
        }
        return true;
    };
    /**
     * Alias for equals
     */
    BufferUtil.equal = function (a, b) {
        return BufferUtil.equals(a, b);
    };
    /**
     * Transforms a number from 0 to 255 into a Buffer of size 1 with that value
     *
     * @param integer Number to convert
     * @return Buffer
     */
    BufferUtil.integerAsSingleByteBuffer = function (integer) {
        preconditions_js_1.Preconditions.checkArgumentType(integer, 'number', 'integer');
        return Buffer.from([integer & 0xff]);
    };
    /**
     * Transform a 4-byte integer into a Buffer of length 4.
     *
     * @param integer Number to convert
     * @return Buffer
     */
    BufferUtil.integerAsBuffer = function (integer) {
        preconditions_js_1.Preconditions.checkArgumentType(integer, 'number', 'integer');
        var bytes = [];
        bytes.push((integer >> 24) & 0xff);
        bytes.push((integer >> 16) & 0xff);
        bytes.push((integer >> 8) & 0xff);
        bytes.push(integer & 0xff);
        return Buffer.from(bytes);
    };
    /**
     * Transform the first 4 values of a Buffer into a number, in little endian encoding
     *
     * @param buffer Buffer to convert
     * @return number
     */
    BufferUtil.integerFromBuffer = function (buffer) {
        preconditions_js_1.Preconditions.checkArgumentType(buffer, 'Buffer', 'buffer');
        return (buffer[0] << 24) | (buffer[1] << 16) | (buffer[2] << 8) | buffer[3];
    };
    /**
     * Transforms the first byte of an array into a number ranging from -128 to 127
     * @param buffer Buffer to convert
     * @return number
     */
    BufferUtil.integerFromSingleByteBuffer = function (buffer) {
        preconditions_js_1.Preconditions.checkArgumentType(buffer, 'Buffer', 'buffer');
        return buffer[0];
    };
    /**
     * Transforms a buffer into a string with a number in hexa representation
     *
     * Shorthand for buffer.toString('hex')
     *
     * @param buffer Buffer to convert
     * @return string
     */
    BufferUtil.bufferToHex = function (buffer) {
        preconditions_js_1.Preconditions.checkArgumentType(buffer, 'Buffer', 'buffer');
        return buffer.toString('hex');
    };
    /**
     * Reverse a buffer
     * @param param Buffer to reverse
     * @return Buffer
     */
    BufferUtil.reverse = function (param) {
        return Buffer.from(param).reverse();
    };
    return BufferUtil;
}());
exports.BufferUtil = BufferUtil;
// Constants
exports.NULL_HASH = BufferUtil.fill(Buffer.alloc(32), 0);
exports.EMPTY_BUFFER = Buffer.alloc(0);
