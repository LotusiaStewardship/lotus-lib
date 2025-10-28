"use strict";
/**
 * JavaScript utility functions
 * Migrated from bitcore-lib-xpi with ESM support
 */
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JSUtil = void 0;
var JSUtil = /** @class */ (function () {
    function JSUtil() {
    }
    /**
     * Determines whether a string contains only hexadecimal values
     */
    JSUtil.isHexa = function (value) {
        if (typeof value !== 'string') {
            return false;
        }
        return /^[0-9a-fA-F]+$/.test(value);
    };
    JSUtil.isHexaString = function (str) {
        return typeof str === 'string' && /^[0-9a-fA-F]+$/.test(str);
    };
    /**
     * Test if an argument is a valid JSON object
     */
    JSUtil.isValidJSON = function (arg) {
        if (typeof arg !== 'string') {
            return false;
        }
        try {
            var parsed = JSON.parse(arg);
            return typeof parsed === 'object';
        }
        catch (e) {
            return false;
        }
    };
    /**
     * Clone an array
     */
    JSUtil.cloneArray = function (arr) {
        return __spreadArray([], arr, true);
    };
    /**
     * Check if a value is a natural number
     */
    JSUtil.isNaturalNumber = function (value) {
        return (typeof value === 'number' &&
            isFinite(value) &&
            Math.floor(value) === value &&
            value >= 0);
    };
    /**
     * Define immutable properties on an object
     */
    JSUtil.defineImmutable = function (obj, properties) {
        Object.keys(properties).forEach(function (key) {
            Object.defineProperty(obj, key, {
                value: properties[key],
                writable: false,
                enumerable: true,
                configurable: false,
            });
        });
        return obj;
    };
    return JSUtil;
}());
exports.JSUtil = JSUtil;
