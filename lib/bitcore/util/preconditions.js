"use strict";
/**
 * Preconditions utility module
 * Migrated from bitcore-lib-xpi with ESM support and TypeScript
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Preconditions = void 0;
var errors_js_1 = require("../errors.js");
var Preconditions = /** @class */ (function () {
    function Preconditions() {
    }
    Preconditions.checkState = function (condition, message) {
        if (!condition) {
            throw new errors_js_1.BitcoreError.Precondition.InvalidState(message);
        }
    };
    Preconditions.checkArgument = function (condition, argumentName, message, docsPath) {
        if (!condition) {
            throw new errors_js_1.BitcoreError.Precondition.InvalidArgument(argumentName, message, docsPath);
        }
    };
    Preconditions.checkArgumentType = function (argument, type, argumentName) {
        argumentName = argumentName || '(unknown name)';
        if (typeof type === 'string') {
            if (type === 'Buffer') {
                if (!Buffer.isBuffer(argument)) {
                    throw new errors_js_1.BitcoreError.Precondition.InvalidArgumentType(argument, type, argumentName);
                }
            }
            else if (typeof argument !== type) {
                throw new errors_js_1.BitcoreError.Precondition.InvalidArgumentType(argument, type, argumentName);
            }
        }
        else {
            // Handle constructor/class type checking
            if (!(argument instanceof type)) {
                throw new errors_js_1.BitcoreError.Precondition.InvalidArgumentType(argument, type.name, argumentName);
            }
        }
    };
    return Preconditions;
}());
exports.Preconditions = Preconditions;
