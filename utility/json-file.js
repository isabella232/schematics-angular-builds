"use strict";
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.JSONFile = void 0;
const jsonc_parser_1 = require("jsonc-parser");
/** @internal */
class JSONFile {
    constructor(host, path) {
        this.host = host;
        this.path = path;
        const buffer = this.host.read(this.path);
        if (buffer) {
            this.content = buffer.toString();
        }
        else {
            throw new Error(`Could not read '${path}'.`);
        }
    }
    get JsonAst() {
        if (this._jsonAst) {
            return this._jsonAst;
        }
        const errors = [];
        this._jsonAst = jsonc_parser_1.parseTree(this.content, errors, { allowTrailingComma: true });
        if (errors.length) {
            const { error, offset } = errors[0];
            throw new Error(`Failed to parse "${this.path}" as JSON AST Object. ${jsonc_parser_1.printParseErrorCode(error)} at location: ${offset}.`);
        }
        return this._jsonAst;
    }
    get(jsonPath) {
        if (jsonPath.length === 0) {
            return jsonc_parser_1.getNodeValue(this.JsonAst);
        }
        const node = jsonc_parser_1.findNodeAtLocation(this.JsonAst, jsonPath);
        return node === undefined ? undefined : jsonc_parser_1.getNodeValue(node);
    }
    modify(jsonPath, value, insertInOrder) {
        let getInsertionIndex;
        if (insertInOrder === undefined) {
            const property = jsonPath.slice(-1)[0];
            getInsertionIndex = properties => [...properties, property].sort().findIndex(p => p === property);
        }
        else if (insertInOrder !== false) {
            getInsertionIndex = insertInOrder;
        }
        const edits = jsonc_parser_1.modify(this.content, jsonPath, value, {
            getInsertionIndex,
            formattingOptions: {
                insertSpaces: true,
                tabSize: 2,
            },
        });
        this.content = jsonc_parser_1.applyEdits(this.content, edits);
        this.host.overwrite(this.path, this.content);
        this._jsonAst = undefined;
    }
    remove(jsonPath) {
        if (this.get(jsonPath) !== undefined) {
            this.modify(jsonPath, undefined);
        }
    }
}
exports.JSONFile = JSONFile;
