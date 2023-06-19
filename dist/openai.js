"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CHATML_PROMPT_EXTRA_TOKEN_COUNT_CONSTANT = exports.CHATML_PROMPT_EXTRA_TOKEN_COUNT_LINEAR_FACTOR = exports.MAX_TOKENS = exports.MODEL_CONTEXTS = exports.usableTokenizers = exports.usableLanguageModels = exports.usableModels = exports.AZURE_3_5_TURBO = exports.GPT2_TOKENIZER = exports.P50K_BASE = exports.R50K_BASE = exports.CL100K_BASE = exports.TEXT_DAVINCI_003 = exports.TEXT_EMBEDDING_ADA_002 = exports.GPT_4_32K = exports.GPT_4 = exports.GPT_3_5_TURBO = void 0;
exports.GPT_3_5_TURBO = 'gpt-3.5-turbo';
exports.GPT_4 = 'gpt-4';
exports.GPT_4_0613 = "gpt-4-0613"
exports.GPT_4_32K = 'gpt-4-32k';
exports.TEXT_EMBEDDING_ADA_002 = 'text-embedding-ada-002';
exports.TEXT_DAVINCI_003 = 'text-davinci-003';
exports.CL100K_BASE = 'cl100k_base';
exports.R50K_BASE = 'r50k_base';
exports.P50K_BASE = 'p50k_base';
exports.GPT2_TOKENIZER = 'gpt2';
exports.AZURE_3_5_TURBO = 'azure-3.5-turbo';
exports.usableModels = [
    exports.GPT_3_5_TURBO,
    exports.GPT_4,
    exports.GPT_4_32K,
    exports.TEXT_EMBEDDING_ADA_002,
    exports.TEXT_DAVINCI_003,
    exports.AZURE_3_5_TURBO
];
exports.usableLanguageModels = [
    exports.GPT_3_5_TURBO,
    exports.GPT_4,
    exports.GPT_4_32K,
    exports.AZURE_3_5_TURBO,
];
exports.usableTokenizers = [
    exports.CL100K_BASE,
    exports.R50K_BASE,
    exports.P50K_BASE,
    exports.GPT2_TOKENIZER
];
// (arvid) why do these not correspond to reality?
exports.MODEL_CONTEXTS = {
    [exports.GPT_3_5_TURBO]: 4000,
    [exports.AZURE_3_5_TURBO]: 4000,
    [exports.GPT_4]: 4000,
    [exports.GPT_4_32K]: 32000,
};
exports.MAX_TOKENS = {
    [exports.GPT_3_5_TURBO]: 4096,
    [exports.AZURE_3_5_TURBO]: 4096,
    [exports.GPT_4]: 8192,
    [exports.GPT_4_32K]: 32768,
};
// docs here: https://platform.openai.com/docs/guides/chat/introduction
exports.CHATML_PROMPT_EXTRA_TOKEN_COUNT_LINEAR_FACTOR = 4;
exports.CHATML_PROMPT_EXTRA_TOKEN_COUNT_CONSTANT = 2;
//# sourceMappingURL=openai.js.map