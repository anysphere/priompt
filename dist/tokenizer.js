"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.estimateTokensUsingCharcount = exports.estimateTokensUsingBytecount = exports.numTokens = exports.getTokenizerFromName = exports.getTokenizerName = exports.getTokenizer = exports.GPT2_TOKENIZER = exports.P50_TOKENIZER = exports.CLK_TOKENIZER = void 0;
// we use tiktoken-node instead of @dqbd/tiktoken because the latter one, while having more
// github stars and being more supported, is extremely slow
// the @dqbq/tiktoken runs tiktoken in wasm, and since we're in node there is no reason
// for us not to use napi bindings to run the native tiktoken
// it may be well worth forking tiktoken-node though, as it is not super well maintained
// and we probably want to compile our own tiktoken because i'm slightly worried about
// supply-chain attacks here
const tiktoken_node_1 = __importDefault(require("tiktoken-node"));
exports.CLK_TOKENIZER = tiktoken_node_1.default.getEncoding('cl100k_base');
exports.P50_TOKENIZER = tiktoken_node_1.default.getEncoding('p50k_base');
exports.GPT2_TOKENIZER = tiktoken_node_1.default.getEncoding('gpt2');
function getTokenizer(model) {
    return getTokenizerFromName(getTokenizerName(model));
}
exports.getTokenizer = getTokenizer;
function getTokenizerName(model) {
    switch (model) {
        case 'gpt-4':
        case 'gpt-4-32k':
        case 'gpt-4-0613':
        case 'text-embedding-ada-002':
        case 'gpt-3.5-turbo':
        case 'azure-3.5-turbo':
            return 'cl100k_base';
        case 'text-davinci-003':
            return 'p50k_base';
    }
}
exports.getTokenizerName = getTokenizerName;
function getTokenizerFromName(tokenizer) {
    switch (tokenizer) {
        case 'gpt2':
            return exports.GPT2_TOKENIZER;
        case 'p50k_base':
            return exports.P50_TOKENIZER;
        case 'cl100k_base':
            return exports.CLK_TOKENIZER;
        case 'r50k_base':
            throw new Error('r50k_base not supported');
    }
}
exports.getTokenizerFromName = getTokenizerFromName;
exports.CLK_TOKENIZER.encode('test');
function numTokens(text, model) {
    const tokenizer = model ? getTokenizer(model) : exports.CLK_TOKENIZER;
    return tokenizer.encode(text).length;
}
exports.numTokens = numTokens;
const encoder = new TextEncoder();
// returns a very conservative [lower, upper] bound on the number of tokens
function estimateTokensUsingBytecount(text, tokenizer) {
    const byteLength = encoder.encode(text).length;
    switch (tokenizer) {
        case 'cl100k_base':
            return [byteLength / 10, byteLength / 2.5];
        default:
            // conservative!
            return [byteLength / 10, byteLength / 2];
    }
}
exports.estimateTokensUsingBytecount = estimateTokensUsingBytecount;
function estimateTokensUsingCharcount(text, tokenizer) {
    const length = text.length;
    switch (tokenizer) {
        case 'cl100k_base':
            return [length / 10, length / 1.5];
        default:
            // conservative!
            return [length / 10, length];
    }
}
exports.estimateTokensUsingCharcount = estimateTokensUsingCharcount;
//# sourceMappingURL=tokenizer.js.map