"use strict";
// TODO: add an onExclude hook. i think it should be able to do whatever, and whenever it is executed, we have a promise to re-render the whole thing afterwards. the idea is that when some things are excluded we want to actually do something more advanced than just excuding certain parts (eg summarize or something)
Object.defineProperty(exports, "__esModule", { value: true });
exports.promptToOpenAIChat = exports.renderBackwardsLinearSearch = exports.renderBinarySearch = exports.render = exports.Fragment = exports.createElement = void 0;
const openai_1 = require("./openai");
const tokenizer_1 = require("./tokenizer");
function isChatPrompt(prompt) {
    return typeof prompt === 'object' && prompt.type === 'chat';
}
function isPlainPrompt(prompt) {
    return typeof prompt === 'string';
}
function sumPrompts(a, b) {
    if (a === undefined) {
        return b;
    }
    if (b === undefined) {
        return a;
    }
    if (isChatPrompt(a) && isChatPrompt(b)) {
        return {
            type: 'chat',
            messages: [...a.messages, ...b.messages]
        };
    }
    if (isPlainPrompt(a) && isPlainPrompt(b)) {
        return a + b;
    }
    throw new Error(`cannot sum prompts ${a} and ${b}`);
}
function createElement(tag, props, ...children) {
    if (typeof tag === 'function') {
        // we scope each tag so we can add priorities to it
        return {
            type: 'scope',
            children: [tag({ ...props, children: children })].flat(),
            absolutePriority: (props && typeof props.p === 'number') ? props.p : undefined,
            relativePriority: (props && typeof props.prel === 'number') ? props.prel : undefined
        };
    }
    if (!(typeof tag === 'string')) {
        throw new Error(`tag must be a string or a function, got ${tag}`);
    }
    switch (tag) {
        case 'scope':
            {
                return {
                    type: 'scope',
                    children: children.flat(),
                    relativePriority: (props && typeof props.prel === 'number') ? props.prel : undefined,
                    absolutePriority: (props && typeof props.p === 'number') ? props.p : undefined
                };
            }
        case 'br':
            {
                if (children.length > 0) {
                    throw new Error(`br tag must have no children, got ${children}`);
                }
                return {
                    type: 'scope',
                    children: ['\n'],
                    absolutePriority: (props && typeof props.p === 'number') ? props.p : undefined,
                    relativePriority: (props && typeof props.prel === 'number') ? props.prel : undefined
                };
            }
        case 'hr':
            {
                if (children.length > 0) {
                    throw new Error(`hr tag must have no children, got ${children}`);
                }
                return {
                    type: 'scope',
                    children: ['\n\n-------\n\n'],
                    absolutePriority: (props && typeof props.p === 'number') ? props.p : undefined,
                    relativePriority: (props && typeof props.prel === 'number') ? props.prel : undefined
                };
            }
        case 'first':
            {
                const newChildren = [];
                // assert that all children are scopes
                for (const child of children.flat()) {
                    if (child === null || typeof child !== 'object') {
                        throw new Error(`first tag must have only scope children, got ${child}`);
                    }
                    if (child.type !== 'scope') {
                        throw new Error(`first tag must have only scope children, got ${child}`);
                    }
                    newChildren.push(child);
                }
                return {
                    type: 'first',
                    children: newChildren
                };
            }
        case 'empty':
            {
                if (children.length > 0) {
                    throw new Error(`empty tag must have no children, got ${children}`);
                }
                if (!props || typeof props.tokens !== 'number') {
                    throw new Error(`empty tag must have a tokens prop, got ${props}`);
                }
                return {
                    type: 'scope',
                    children: [{
                            type: 'empty',
                            tokenCount: props.tokens,
                        }],
                    absolutePriority: (typeof props.p === 'number') ? props.p : undefined,
                    relativePriority: (typeof props.prel === 'number') ? props.prel : undefined
                };
            }
        default:
            throw new Error(`Unknown tag ${tag}`);
    }
}
exports.createElement = createElement;
function Fragment({ children }) {
    // merge all the lists
    return children.flat();
}
exports.Fragment = Fragment;
// priority level if it is not set becomes 1e9, i.e. it is always rendered
const BASE_PRIORITY = 1e9;
function render(elem, options) {
    // TODO: we need to performance optimize this.
    // the problem is if there are a lot of scopes.
    // the linear search, even though it caches results, is slow because the traversal over tree is quite slow
    // additionally, the linear search is surprisingly inaccurate, because tokens apparently cross boundaries more often
    // than you'd think
    // the binary search is slow because it needs to do a lot of passes
    // i'm not sure what the right solution is! it's possible that the correct approach is just that priompt is too slow to be used for every single line of a file if the file has more than 10K lines
    // one idea is to just force the user to have coarse scopes
    // another idea is to implement this in Rust, and use the napi-rs library to call it from JS. in rust, implementing this would be trivial, because we would actually have a good data structure and memory management and parallelism (i think)
    // return renderBackwardsLinearSearch(elem, options);
    return renderBinarySearch(elem, options);
}
exports.render = render;
function renderBinarySearch(elem, { model, tokenLimit, tokenizer }) {
    var _a, _b, _c;
    let startTime;
    if (process.env.NODE_ENV !== 'production') {
        startTime = performance.now();
    }
    // set the tokenLimit to the max number of tokens per model
    if (tokenLimit === undefined) {
        if (!model) {
            throw new Error("Must specify model or tokenLimit");
        }
        tokenLimit = openai_1.MAX_TOKENS[model];
    }
    if (tokenizer === undefined) {
        if (!model) {
            throw new Error("Must specify model or tokenizer");
        }
        tokenizer = (0, tokenizer_1.getTokenizerName)(model);
    }
    let startTimeValidating;
    if (process.env.NODE_ENV !== 'production') {
        startTimeValidating = performance.now();
    }
    validateUnrenderedPrompt(elem);
    if (process.env.NODE_ENV !== 'production') {
        const endTimeValidating = performance.now();
        console.log(`Validating prompt took ${endTimeValidating - (startTimeValidating !== null && startTimeValidating !== void 0 ? startTimeValidating : 0)} ms`);
    }
    let startTimeComputingPriorityLevels = undefined;
    if (process.env.NODE_ENV !== 'production') {
        startTimeComputingPriorityLevels = performance.now();
    }
    // for now, we do a much simple thing, which is just to render the whole thing every time
    const priorityLevels = new Set();
    computePriorityLevels(elem, BASE_PRIORITY, priorityLevels);
    priorityLevels.add(BASE_PRIORITY);
    // convert to array and sort them from lowest to highest
    const sortedPriorityLevels = Array.from(priorityLevels).sort((a, b) => a - b);
    if (process.env.NODE_ENV !== 'production') {
        const endTimeComputingPriorityLevels = performance.now();
        console.log(`Computing priority levels took ${endTimeComputingPriorityLevels - (startTimeComputingPriorityLevels !== null && startTimeComputingPriorityLevels !== void 0 ? startTimeComputingPriorityLevels : 0)} ms`);
    }
    // if the first one is higher than the base priority, then print a warning because it will not have any effect
    let startTimeRendering = undefined;
    if (process.env.NODE_ENV !== 'production') {
        startTimeRendering = performance.now();
    }
    // the lowest priority level is as far as the cutoff can go
    // we choose an exclusive lower bound and an inclusive upper bound because we get the information
    // if TOKEN LIMIT OK: then the answer has to be <= to the candidate
    // if TOKEN LIMIT NOT OK: then the answer has to be > than the candidate
    let exclusiveLowerBound = -1;
    let inclusiveUpperBound = sortedPriorityLevels.length - 1;
    while (exclusiveLowerBound < inclusiveUpperBound - 1) {
        const candidateLevelIndex = Math.floor((exclusiveLowerBound + inclusiveUpperBound) / 2);
        const candidateLevel = sortedPriorityLevels[candidateLevelIndex];
        // console.log(`Trying candidate level ${candidateLevel} with index ${candidateLevelIndex}`)
        try {
            const start = performance.now();
            const prompt = renderWithLevelAndEarlyExitWithTokenEstimation(elem, candidateLevel, tokenizer, tokenLimit);
            // const prompt = renderWithLevel(elem, candidateLevel);
            const tokenCount = countTokensExact(tokenizer, (_a = prompt.prompt) !== null && _a !== void 0 ? _a : "");
            const end = performance.now();
            // console.log(`Candidate level ${candidateLevel} with index ${candidateLevelIndex} took ${end - start} ms and has ${tokenCount} tokens`);
            if (tokenCount + prompt.emptyTokenCount > tokenLimit) {
                // this means that the candidateLevel is too low
                exclusiveLowerBound = candidateLevelIndex;
            }
            else {
                // this means the candidate level is too high or it is just right
                inclusiveUpperBound = candidateLevelIndex;
            }
        }
        catch {
            // this means the candidate level is too low
            exclusiveLowerBound = candidateLevelIndex;
        }
    }
    if (process.env.NODE_ENV !== 'production') {
        const endTimeRendering = performance.now();
        console.log(`Rendering prompt took ${endTimeRendering - (startTimeRendering !== null && startTimeRendering !== void 0 ? startTimeRendering : 0)} ms`);
    }
    let startExactTokenCount = undefined;
    if (process.env.NODE_ENV !== 'production') {
        startExactTokenCount = performance.now();
    }
    const prompt = renderWithLevel(elem, sortedPriorityLevels[inclusiveUpperBound]);
    const tokenCount = countTokensExact(tokenizer, (_b = prompt.prompt) !== null && _b !== void 0 ? _b : "");
    if (tokenCount + prompt.emptyTokenCount > tokenLimit) {
        // this means that the base level prompt is too big
        // we could either return an empty string or we could throw an error here
        // this is never desirable behavior, and indicates a bug with the prompt
        // hence we throw an error
        throw new Error(`Base prompt estimated token count is ${tokenCount} with ${prompt.emptyTokenCount} tokens reserved, which is higher than the limit ${tokenLimit}. This is probably a bug in the prompt — please add some priority levels to fix this.`);
    }
    if (process.env.NODE_ENV !== 'production') {
        const endExactTokenCount = performance.now();
        console.log(`Computing exact token count took ${endExactTokenCount - (startExactTokenCount !== null && startExactTokenCount !== void 0 ? startExactTokenCount : 0)} ms`);
    }
    let duration = undefined;
    if (startTime !== undefined) {
        const endTime = performance.now();
        duration = endTime - startTime;
        if (duration > 100) {
            console.warn(`Priompt WARNING: rendering prompt took ${duration} ms, which is longer than the recommended maximum of 100 ms. Consider reducing the number of scopes you have.`);
        }
    }
    return {
        prompt: (_c = prompt.prompt) !== null && _c !== void 0 ? _c : "",
        tokenCount: tokenCount,
        tokensReserved: prompt.emptyTokenCount,
        durationMs: duration,
        priorityCutoff: sortedPriorityLevels[inclusiveUpperBound],
    };
}
exports.renderBinarySearch = renderBinarySearch;
function renderBackwardsLinearSearch(elem, { model, tokenLimit, tokenizer }) {
    var _a;
    let startTime;
    if (process.env.NODE_ENV !== 'production') {
        startTime = performance.now();
    }
    // set the tokenLimit to the max number of tokens per model
    if (tokenLimit === undefined) {
        if (!model) {
            throw new Error("Must specify model or tokenLimit");
        }
        tokenLimit = openai_1.MAX_TOKENS[model];
    }
    if (tokenizer === undefined) {
        if (!model) {
            throw new Error("Must specify model or tokenizer");
        }
        tokenizer = (0, tokenizer_1.getTokenizerName)(model);
    }
    let startTimeValidating;
    if (process.env.NODE_ENV !== 'production') {
        startTimeValidating = performance.now();
    }
    validateUnrenderedPrompt(elem);
    if (process.env.NODE_ENV !== 'production') {
        const endTimeValidating = performance.now();
        console.log(`Validating prompt took ${endTimeValidating - (startTimeValidating !== null && startTimeValidating !== void 0 ? startTimeValidating : 0)} ms`);
    }
    // ALGORITHM:
    // 1. Build a sorted list of all priorities.
    // 2. Compute an estimated lower/upper bound on the level using the number of bytes + a linear scan.
    // 3. For each block present in the lower level, compute the real token count.
    // 4. Now do a linear scan in priority level until the real token count is at or below the limit + create an upper bound where the sum of the tokens are #nodes more than the limit.
    // 5. Finally, do binary search on the updated lower/upper bound where we tokenize the full prompt every time.
    // TODO: actually implement this, instead of doing the super naive version we are doing right now
    // actually..... we do an additive approach instead. this has slightly different semantics for the <first> tag, but it is very simple and easy to reason about
    // so we go from the highest possible priority, adding in things at each time
    // FOR NOW: we do an additive search from highest cutoff to lowest, caching the token count of each element (where an element is a scope — strings themselves will be merged first, because we want as big chunks as possible to feed into tiktoken for both efficiency and accuracy reasons)
    // TODO: come up with a better algorithm here. this one is fine for now. just doesn't work if someone creates really low-character scopes but why would they
    let startTimeNormalizing = undefined;
    if (process.env.NODE_ENV !== 'production') {
        startTimeNormalizing = performance.now();
    }
    const normalizedElem = normalizePrompt(elem);
    if (process.env.NODE_ENV !== 'production') {
        const endTimeNormalizing = performance.now();
        console.log(`Normalizing prompt took ${endTimeNormalizing - (startTimeNormalizing !== null && startTimeNormalizing !== void 0 ? startTimeNormalizing : 0)} ms`);
    }
    console.log(normalizedElem, "normalizedElem");
    let startTimeComputingPriorityLevels = undefined;
    if (process.env.NODE_ENV !== 'production') {
        startTimeComputingPriorityLevels = performance.now();
    }
    // for now, we do a much simple thing, which is just to render the whole thing every time
    const priorityLevels = new Set();
    computePriorityLevels(normalizedElem, BASE_PRIORITY, priorityLevels);
    priorityLevels.add(BASE_PRIORITY);
    // convert to array and sort them from highest to lowest
    const sortedPriorityLevels = Array.from(priorityLevels).sort((a, b) => b - a);
    if (process.env.NODE_ENV !== 'production') {
        const endTimeComputingPriorityLevels = performance.now();
        console.log(`Computing priority levels took ${endTimeComputingPriorityLevels - (startTimeComputingPriorityLevels !== null && startTimeComputingPriorityLevels !== void 0 ? startTimeComputingPriorityLevels : 0)} ms`);
    }
    // if the first one is higher than the base priority, then print a warning because it will not have any effect
    let startTimeRendering = undefined;
    if (process.env.NODE_ENV !== 'production') {
        startTimeRendering = performance.now();
    }
    // naive version: just render the whole thing for every priority level, and pick the first one that is below the limit
    let prevPrompt = undefined;
    let prevLevel = undefined;
    let thisPrompt = undefined;
    for (const level of sortedPriorityLevels) {
        thisPrompt = renderWithLevelAndCountTokens(normalizedElem, level, tokenizer);
        if (isChatPrompt(thisPrompt.prompt)) {
            thisPrompt.tokenCount += openai_1.CHATML_PROMPT_EXTRA_TOKEN_COUNT_CONSTANT;
        }
        if (thisPrompt.tokenCount + thisPrompt.emptyTokenCount > tokenLimit) {
            break;
        }
        prevPrompt = thisPrompt;
        prevLevel = level;
    }
    if (process.env.NODE_ENV !== 'production') {
        const endTimeRendering = performance.now();
        console.log(`Rendering prompt took ${endTimeRendering - (startTimeRendering !== null && startTimeRendering !== void 0 ? startTimeRendering : 0)} ms`);
    }
    if (prevPrompt === undefined) {
        // this means that the base level prompt is too big
        // we could either return an empty string or we could throw an error here
        // this is never desirable behavior, and indicates a bug with the prompt
        // hence we throw an error
        throw new Error(`Base prompt estimated token count is ${thisPrompt === null || thisPrompt === void 0 ? void 0 : thisPrompt.tokenCount} with ${thisPrompt === null || thisPrompt === void 0 ? void 0 : thisPrompt.emptyTokenCount} tokens reserved, which is higher than the limit ${tokenLimit}. This is probably a bug in the prompt — please add some priority levels to fix this.`);
    }
    let startExactTokenCount = undefined;
    if (process.env.NODE_ENV !== 'production') {
        startExactTokenCount = performance.now();
    }
    // now get the *actual* token count
    // the reason this might be different is tokens that span scopes
    // we do this because maybe sometimes you want the actually correct token count?
    // this token count should be smaller than the estimated token count (since now boundaries are allowed), but there might be an edge case where this actually yields a larger token count
    // in that case, it is normally fine to just have the token count be slightly too big to fit
    // because you always have a gap to fill anyways
    // consider adding a mode that if this happens, backtracks
    if (prevPrompt.prompt !== undefined) {
        const exactTokenCount = countTokensExact(tokenizer, prevPrompt.prompt);
        console.log(`Discrepancy: (estimated token count) - (actual token count) = ${prevPrompt.tokenCount} - ${exactTokenCount} = ${prevPrompt.tokenCount - exactTokenCount}`);
        prevPrompt.tokenCount = exactTokenCount;
        if (exactTokenCount + prevPrompt.emptyTokenCount > tokenLimit) {
            console.warn(`Actual token count is ${exactTokenCount} with ${prevPrompt.emptyTokenCount} tokens reserved, which is higher than the limit ${tokenLimit}. This can possibly happen in rare circumstances, but should never be a problem in practice.`);
        }
    }
    if (process.env.NODE_ENV !== 'production') {
        const endExactTokenCount = performance.now();
        console.log(`Computing exact token count took ${endExactTokenCount - (startExactTokenCount !== null && startExactTokenCount !== void 0 ? startExactTokenCount : 0)} ms`);
    }
    let duration = undefined;
    if (startTime !== undefined) {
        const endTime = performance.now();
        duration = endTime - startTime;
    }
    return {
        prompt: (_a = prevPrompt.prompt) !== null && _a !== void 0 ? _a : "",
        tokenCount: prevPrompt.tokenCount,
        tokensReserved: prevPrompt.emptyTokenCount,
        durationMs: duration,
        priorityCutoff: prevLevel !== null && prevLevel !== void 0 ? prevLevel : BASE_PRIORITY,
    };
}
exports.renderBackwardsLinearSearch = renderBackwardsLinearSearch;
function normalizePrompt(elem) {
    // we want to merge all the strings together
    const result = [];
    let currentString = "";
    const elemArray = Array.isArray(elem) ? elem : [elem];
    const pushCurrentString = () => {
        if (currentString.length > 0) {
            result.push({
                type: 'normalizedString',
                s: currentString,
                cachedCount: undefined
            });
            currentString = "";
        }
    };
    for (const node of elemArray) {
        if (node === undefined || node === null) {
            continue;
        }
        if (typeof node === 'string') {
            currentString += node;
        }
        else if (typeof node === 'number') {
            currentString += node.toString();
        }
        else if (typeof node === 'object') {
            pushCurrentString();
            let newNode;
            switch (node.type) {
                case 'empty': {
                    newNode = node;
                    break;
                }
                case 'first': {
                    newNode = {
                        ...node,
                        children: node.children.map(c => {
                            return {
                                ...c,
                                children: normalizePrompt(c.children)
                            };
                        }),
                    };
                    break;
                }
                case 'chat':
                case 'scope': {
                    newNode = {
                        ...node,
                        children: normalizePrompt(node.children)
                    };
                    break;
                }
            }
            result.push(newNode);
        }
        else {
            throw new Error("Invalid prompt element");
        }
    }
    pushCurrentString();
    return result;
}
// if chat prompt, the token count will be missing the constant factor
function renderWithLevelAndCountTokens(elem, level, tokenizer) {
    var _a;
    if (Array.isArray(elem)) {
        return elem.map(e => renderWithLevelAndCountTokens(e, level, tokenizer)).reduce((a, b) => {
            return {
                prompt: sumPrompts(a.prompt, b.prompt),
                tokenCount: a.tokenCount + b.tokenCount,
                emptyTokenCount: a.emptyTokenCount + b.emptyTokenCount
            };
        }, {
            prompt: undefined,
            tokenCount: 0,
            emptyTokenCount: 0
        });
    }
    switch (elem.type) {
        case 'first': {
            for (const child of elem.children) {
                if (child.absolutePriority === undefined) {
                    throw new Error(`BUG!! computePriorityLevels should have set absolutePriority for all children of first`);
                }
                if (child.absolutePriority >= level) {
                    return renderWithLevelAndCountTokens(child, level, tokenizer);
                }
            }
            // nothing returned from first, which is ok
            return {
                prompt: undefined,
                tokenCount: 0,
                emptyTokenCount: 0
            };
        }
        case 'empty': {
            return {
                prompt: undefined,
                tokenCount: 0,
                emptyTokenCount: elem.tokenCount
            };
        }
        case 'chat': {
            const p = renderWithLevelAndCountTokens(elem.children, level, tokenizer);
            if (isChatPrompt(p.prompt)) {
                throw new Error(`Incorrect prompt: we have nested chat messages, which is not allowed!`);
            }
            return {
                prompt: {
                    type: 'chat',
                    messages: [{
                            role: elem.role,
                            content: (_a = p.prompt) !== null && _a !== void 0 ? _a : "",
                        }]
                },
                tokenCount: p.tokenCount + openai_1.CHATML_PROMPT_EXTRA_TOKEN_COUNT_LINEAR_FACTOR,
                emptyTokenCount: p.emptyTokenCount,
            };
        }
        case 'scope': {
            if (elem.absolutePriority === undefined) {
                throw new Error(`BUG!! computePriorityLevels should have set absolutePriority for all scopes`);
            }
            if (elem.absolutePriority >= level) {
                return renderWithLevelAndCountTokens(elem.children, level, tokenizer);
            }
            return {
                prompt: undefined,
                tokenCount: 0,
                emptyTokenCount: 0
            };
        }
        case 'normalizedString': {
            if (elem.cachedCount === undefined) {
                elem.cachedCount = (0, tokenizer_1.getTokenizerFromName)(tokenizer).encode(elem.s).length;
            }
            return {
                prompt: elem.s,
                tokenCount: elem.cachedCount,
                emptyTokenCount: 0
            };
        }
    }
}
function renderWithLevelAndEarlyExitWithTokenEstimation(elem, level, tokenizer, tokenLimit) {
    var _a;
    if (elem === undefined || elem === null || elem === false) {
        return {
            prompt: undefined,
            emptyTokenCount: 0
        };
    }
    if (Array.isArray(elem)) {
        return elem.map(e => renderWithLevelAndEarlyExitWithTokenEstimation(e, level, tokenizer, tokenLimit)).reduce((a, b) => {
            const sum = sumPrompts(a.prompt, b.prompt);
            const lowerBound = isChatPrompt(sum) ? sum.messages.reduce((a, b) => (a + (0, tokenizer_1.estimateTokensUsingCharcount)(b.content, tokenizer)[0]), 0) : (sum === undefined ? 0 : (0, tokenizer_1.estimateTokensUsingCharcount)(sum, tokenizer)[0]);
            if (lowerBound > tokenLimit) {
                throw new Error(`Token limit exceeded!`);
            }
            return {
                prompt: sum,
                emptyTokenCount: a.emptyTokenCount + b.emptyTokenCount
            };
        }, {
            prompt: undefined,
            emptyTokenCount: 0
        });
    }
    if (typeof elem === 'string') {
        return {
            prompt: elem,
            emptyTokenCount: 0
        };
    }
    if (typeof elem === 'number') {
        return {
            prompt: elem.toString(),
            emptyTokenCount: 0
        };
    }
    switch (elem.type) {
        case 'first': {
            for (const child of elem.children) {
                if (child.absolutePriority === undefined) {
                    throw new Error(`BUG!! computePriorityLevels should have set absolutePriority for all children of first`);
                }
                if (child.absolutePriority >= level) {
                    return renderWithLevelAndEarlyExitWithTokenEstimation(child, level, tokenizer, tokenLimit);
                }
            }
            // nothing returned from first, which is ok
            return {
                prompt: undefined,
                emptyTokenCount: 0
            };
        }
        case 'empty': {
            return {
                prompt: undefined,
                emptyTokenCount: elem.tokenCount
            };
        }
        case 'chat': {
            const p = renderWithLevelAndEarlyExitWithTokenEstimation(elem.children, level, tokenizer, tokenLimit);
            if (isChatPrompt(p.prompt)) {
                throw new Error(`Incorrect prompt: we have nested chat messages, which is not allowed!`);
            }
            return {
                prompt: {
                    type: 'chat',
                    messages: [{
                            role: elem.role,
                            content: (_a = p.prompt) !== null && _a !== void 0 ? _a : "",
                        }]
                },
                emptyTokenCount: p.emptyTokenCount,
            };
        }
        case 'scope': {
            if (elem.absolutePriority === undefined) {
                throw new Error(`BUG!! computePriorityLevels should have set absolutePriority for all scopes`);
            }
            if (elem.absolutePriority >= level) {
                return renderWithLevelAndEarlyExitWithTokenEstimation(elem.children, level, tokenizer, tokenLimit);
            }
            return {
                prompt: undefined,
                emptyTokenCount: 0
            };
        }
    }
}
function renderWithLevel(elem, level) {
    var _a;
    if (elem === undefined || elem === null || elem === false) {
        return {
            prompt: undefined,
            emptyTokenCount: 0
        };
    }
    if (Array.isArray(elem)) {
        return elem.map(e => renderWithLevel(e, level)).reduce((a, b) => {
            return {
                prompt: sumPrompts(a.prompt, b.prompt),
                emptyTokenCount: a.emptyTokenCount + b.emptyTokenCount
            };
        }, {
            prompt: undefined,
            emptyTokenCount: 0
        });
    }
    if (typeof elem === 'string') {
        return {
            prompt: elem,
            emptyTokenCount: 0
        };
    }
    if (typeof elem === 'number') {
        return {
            prompt: elem.toString(),
            emptyTokenCount: 0
        };
    }
    switch (elem.type) {
        case 'first': {
            for (const child of elem.children) {
                if (child.absolutePriority === undefined) {
                    throw new Error(`BUG!! computePriorityLevels should have set absolutePriority for all children of first`);
                }
                if (child.absolutePriority >= level) {
                    return renderWithLevel(child, level);
                }
            }
            // nothing returned from first, which is ok
            return {
                prompt: undefined,
                emptyTokenCount: 0
            };
        }
        case 'empty': {
            return {
                prompt: undefined,
                emptyTokenCount: elem.tokenCount
            };
        }
        case 'chat': {
            const p = renderWithLevel(elem.children, level);
            if (isChatPrompt(p.prompt)) {
                throw new Error(`Incorrect prompt: we have nested chat messages, which is not allowed!`);
            }
            return {
                prompt: {
                    type: 'chat',
                    messages: [{
                            role: elem.role,
                            content: (_a = p.prompt) !== null && _a !== void 0 ? _a : "",
                        }]
                },
                emptyTokenCount: p.emptyTokenCount,
            };
        }
        case 'scope': {
            if (elem.absolutePriority === undefined) {
                throw new Error(`BUG!! computePriorityLevels should have set absolutePriority for all scopes`);
            }
            if (elem.absolutePriority >= level) {
                return renderWithLevel(elem.children, level);
            }
            return {
                prompt: undefined,
                emptyTokenCount: 0
            };
        }
    }
}
// TODO: make this into eslint rules so they can be shown in the IDE
function validateUnrenderedPrompt(elem) {
    validateNoChildrenHigherPriorityThanParent(elem);
    // print a warning if any scope has both an absolute and relative priority
    validateNotBothAbsoluteAndRelativePriority(elem);
}
function validateNotBothAbsoluteAndRelativePriority(elem) {
    if (Array.isArray(elem)) {
        for (const child of elem) {
            validateUnrenderedPrompt(child);
        }
        return;
    }
    if (elem === undefined || elem === null || elem === false) {
        return;
    }
    if (typeof elem === 'string') {
        return;
    }
    if (typeof elem === 'number') {
        return;
    }
    switch (elem.type) {
        case 'chat':
        case 'first': {
            for (const child of elem.children) {
                validateNotBothAbsoluteAndRelativePriority(child);
            }
            return;
        }
        case 'empty': {
            return;
        }
        case 'scope': {
            if (elem.absolutePriority !== undefined && elem.relativePriority !== undefined) {
                console.warn(`Priompt WARNING: scope has both absolute and relative priority.This is discouraged.Ignoring relative priority.`);
            }
            for (const child of elem.children) {
                validateNotBothAbsoluteAndRelativePriority(child);
            }
            return;
        }
    }
}
function validateNoChildrenHigherPriorityThanParent(elem, parentPriority = BASE_PRIORITY) {
    if (Array.isArray(elem)) {
        for (const child of elem) {
            validateNoChildrenHigherPriorityThanParent(child, parentPriority);
        }
        return;
    }
    if (elem === undefined || elem === null || elem === false) {
        return;
    }
    if (typeof elem === 'string') {
        return;
    }
    if (typeof elem === 'number') {
        return;
    }
    switch (elem.type) {
        case 'chat':
        case 'first': {
            for (const child of elem.children) {
                validateNoChildrenHigherPriorityThanParent(child, parentPriority);
            }
            return;
        }
        case 'empty': {
            return;
        }
        case 'scope': {
            const priority = computePriority(elem, parentPriority);
            if (priority > parentPriority) {
                console.warn(`Priompt WARNING: child scope has a higher priority(${priority}) than its parent(${parentPriority}).This is discouraged, because the child will only be included if the parent is, and thus the effective priority of the child is just the parent's priority.`);
            }
            for (const child of elem.children) {
                validateNoChildrenHigherPriorityThanParent(child, priority);
            }
            return;
        }
    }
}
function computePriority(elem, parentPriority) {
    var _a, _b;
    return (_a = elem.absolutePriority) !== null && _a !== void 0 ? _a : (parentPriority + ((_b = elem.relativePriority) !== null && _b !== void 0 ? _b : 0));
}
function computePriorityLevels(elem, parentPriority, levels) {
    if (Array.isArray(elem)) {
        for (const child of elem) {
            computePriorityLevels(child, parentPriority, levels);
        }
        return;
    }
    if (elem === undefined || elem === null || elem === false) {
        return;
    }
    if (typeof elem === 'string') {
        return;
    }
    if (typeof elem === 'number') {
        return;
    }
    switch (elem.type) {
        case 'chat':
        case 'first': {
            // just do it for each child
            for (const child of elem.children) {
                computePriorityLevels(child, parentPriority, levels);
            }
            return;
        }
        case 'empty': {
            // nothing happens
            return;
        }
        case 'scope': {
            // compute the priority of this scope
            // the absolutePriority takes precedence over the relativePriority
            const priority = computePriority(elem, parentPriority);
            levels.add(priority);
            // we make the elem have this priority, so that we don't need to redo the priority calculation
            elem.absolutePriority = priority;
            // then for each child
            for (const child of elem.children) {
                computePriorityLevels(child, priority, levels);
            }
            return;
        }
        case 'normalizedString': {
            // nothing happens
            return;
        }
    }
    console.log('ELEM', elem);
    throw new Error(`BUG!! computePriorityLevels got an invalid node of type ${typeof elem} (see the console log above)`);
}
function countTokensExact(tokenizer, prompt) {
    const tokenizerObj = (0, tokenizer_1.getTokenizerFromName)(tokenizer);
    if (isPlainPrompt(prompt)) {
        return tokenizerObj.encode(prompt).length;
    }
    else if (isChatPrompt(prompt)) {
        const msgTokens = prompt.messages.map(msg => tokenizerObj.encode(msg.content).length);
        // docs here: https://platform.openai.com/docs/guides/chat/introduction
        return msgTokens.reduce((a, b) => a + b, 0) + openai_1.CHATML_PROMPT_EXTRA_TOKEN_COUNT_LINEAR_FACTOR * (prompt.messages.length) + openai_1.CHATML_PROMPT_EXTRA_TOKEN_COUNT_CONSTANT;
    }
    throw new Error(`BUG!! countTokensExact got an invalid prompt`);
}
function promptToOpenAIChat(prompt) {
    if (isPlainPrompt(prompt)) {
        return [
            {
                role: 'user',
                content: prompt
            }
        ];
    }
    else if (isChatPrompt(prompt)) {
        return prompt.messages.map(msg => {
            return {
                role: msg.role,
                content: msg.content
            };
        });
    }
    throw new Error(`BUG!! promptToOpenAIChat got an invalid prompt`);
}
exports.promptToOpenAIChat = promptToOpenAIChat;
//# sourceMappingURL=lib.js.map