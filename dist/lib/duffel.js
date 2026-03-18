"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.duffel = void 0;
const api_1 = require("@duffel/api");
const token = process.env.DUFFEL_ACCESS_TOKEN?.trim();
if (!token) {
    console.warn('[DUFFEL] DUFFEL_ACCESS_TOKEN is missing');
}
exports.duffel = new api_1.Duffel({
    token: token || '',
});
