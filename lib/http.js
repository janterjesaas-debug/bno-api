"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.postJson = postJson;
// lib/http.ts
const axios_1 = __importDefault(require("axios"));
async function postJson(url, body) {
    const res = await axios_1.default.post(url, body, {
        headers: { 'Content-Type': 'application/json' },
    });
    return res.data;
}
