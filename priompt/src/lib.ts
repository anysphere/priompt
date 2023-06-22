// TODO: add an onExclude hook. i think it should be able to do whatever, and whenever it is executed, we have a promise to re-render the whole thing afterwards. the idea is that when some things are excluded we want to actually do something more advanced than just excuding certain parts (eg summarize or something)


// TODO: add an IDE plugin or something that renders the prompt when you hover over it (and has a slider for the priority)

import { ChatCompletionRequestMessage, ChatCompletionFunctions } from 'openai';
import { CHATML_PROMPT_EXTRA_TOKEN_COUNT_CONSTANT, CHATML_PROMPT_EXTRA_TOKEN_COUNT_LINEAR_FACTOR, MAX_TOKENS, UsableLanguageModel, UsableTokenizer } from './openai';
import { estimateTokensUsingBytecount, estimateTokensUsingCharcount, getTokenizerFromName, getTokenizerName } from './tokenizer';
import { BaseProps, Node, ChatMessage, ChatPrompt, Empty, First, Prompt, PromptElement, Scope, FunctionDefinition, FunctionPrompt, TextPrompt, ChatAndFunctionPromptFunction, ChatPromptMessage, ChatUserSystemMessage, ChatAssistantMessage, ChatFunctionResultMessage } from './types';
import * as Types from './types';



export function isChatPrompt(prompt: Prompt | undefined): prompt is ChatPrompt {
	return typeof prompt === 'object' && prompt.type === 'chat';
}
export function isPlainPrompt(prompt: Prompt | undefined): prompt is string {
	return typeof prompt === 'string';
}
function isTextPromptPotentiallyWithFunctions(prompt: Prompt | undefined): prompt is ((TextPrompt & FunctionPrompt) | string) {
	return (typeof prompt === 'object' && 'text' in prompt) || typeof prompt === 'string';
}
export function promptHasFunctions(prompt: Prompt | undefined): prompt is ((ChatPrompt & FunctionPrompt) | (TextPrompt & FunctionPrompt)) {
	return typeof prompt === 'object' && 'functions' in prompt && prompt.functions !== undefined;
}
function promptGetText(prompt: Prompt | undefined): string | undefined {
	if (!isTextPromptPotentiallyWithFunctions(prompt)) {
		return undefined;
	}
	if (typeof prompt === 'string') {
		return prompt;
	}
	return prompt.text;
}

function sumPrompts(a: Prompt | undefined, b: Prompt | undefined): Prompt | undefined {
	if (a === undefined) {
		return b;
	}
	if (b === undefined) {
		return a;
	}
	if ((isChatPrompt(a) && isChatPrompt(b)) || (isChatPrompt(a) && promptGetText(b) === '') || (isChatPrompt(b) && promptGetText(a) === '')) {
		const functions = [...(promptHasFunctions(a) ? a.functions : []), ...(promptHasFunctions(b) ? b.functions : [])];
		const prompt: (ChatPrompt & FunctionPrompt) | ChatPrompt = {
			type: 'chat',
			messages: [...(isChatPrompt(a) ? a.messages : []), ...(isChatPrompt(b) ? b.messages : [])],
			functions: functions.length > 0 ? functions : undefined
		};
		return prompt;
	}
	if ((promptHasFunctions(a) || promptHasFunctions(b)) && (isTextPromptPotentiallyWithFunctions(a) && isTextPromptPotentiallyWithFunctions(b))) {
		// valid, should return TextPrompt & FunctionPrompt
		const functions = [...(promptHasFunctions(a) ? a.functions : []), ...(promptHasFunctions(b) ? b.functions : [])];
		const prompt: TextPrompt & FunctionPrompt = {
			type: 'text',
			text: (isPlainPrompt(a) ? a : a.text) + (isPlainPrompt(b) ? b : b.text),
			functions,
		};
		return prompt;
	}
	if (isPlainPrompt(a) && isPlainPrompt(b)) {
		return a + b;
	}
	throw new Error(`cannot sum prompts ${a} (${typeof a === 'string' ? 'string' : a.type}) and ${b} (${typeof b === 'string' ? 'string' : b.type})`);
}

export function createElement(tag: ((props: BaseProps & Record<string, unknown>) => PromptElement) | string, props: Record<string, unknown> | null, ...children: PromptElement[]): PromptElement {
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
				const newChildren: Scope[] = [];
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

export function Fragment({ children }: { children: PromptElement[]; }): PromptElement {
	// merge all the lists
	return children.flat();
}

// TODO: should the components have access to the token limit?
// argument against: no, it should all be responsive to the token limit and we shouldn't need this
// argument for: CSS has media queries because it is very hard to have something that's fully responsive without changing any of the layout
// decision: wait for now, see if it is needed
export type RenderOptions = {
	model?: UsableLanguageModel;
	tokenLimit?: number;
	tokenizer?: UsableTokenizer;
};
export type RenderOutput = {
	prompt: Prompt;
	tokenCount: number;
	tokensReserved: number;
	priorityCutoff: number;
	durationMs?: number;
};


// priority level if it is not set becomes 1e9, i.e. it is always rendered
const BASE_PRIORITY = 1e9;

export function render(elem: PromptElement, options: RenderOptions): RenderOutput {

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

export function renderBinarySearch(elem: PromptElement, { model, tokenLimit, tokenizer }: RenderOptions): RenderOutput {
	let startTime: number | undefined;
	if (process.env.NODE_ENV !== 'production') {
		startTime = performance.now();
	}

	// set the tokenLimit to the max number of tokens per model
	if (tokenLimit === undefined) {
		if (!model) {
			throw new Error("Must specify model or tokenLimit");
		}
		tokenLimit = MAX_TOKENS[model];
	}
	if (tokenizer === undefined) {
		if (!model) {
			throw new Error("Must specify model or tokenizer");
		}
		tokenizer = getTokenizerName(model);
	}

	let startTimeValidating: number | undefined;
	if (process.env.NODE_ENV !== 'production') {
		startTimeValidating = performance.now();
	}
	validateUnrenderedPrompt(elem);
	if (process.env.NODE_ENV !== 'production') {
		const endTimeValidating = performance.now();
		console.log(`Validating prompt took ${endTimeValidating - (startTimeValidating ?? 0)} ms`);
	}

	let startTimeComputingPriorityLevels = undefined;
	if (process.env.NODE_ENV !== 'production') {
		startTimeComputingPriorityLevels = performance.now();
	}
	// for now, we do a much simple thing, which is just to render the whole thing every time
	const priorityLevels = new Set<number>();
	computePriorityLevels(elem, BASE_PRIORITY, priorityLevels);
	priorityLevels.add(BASE_PRIORITY);
	// convert to array and sort them from lowest to highest
	const sortedPriorityLevels = Array.from(priorityLevels).sort((a, b) => a - b);
	if (process.env.NODE_ENV !== 'production') {
		const endTimeComputingPriorityLevels = performance.now();
		console.log(`Computing priority levels took ${endTimeComputingPriorityLevels - (startTimeComputingPriorityLevels ?? 0)} ms`);
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
			const tokenCount = countTokensExact(tokenizer, prompt.prompt ?? "");
			const end = performance.now();
			// console.log(`Candidate level ${candidateLevel} with index ${candidateLevelIndex} took ${end - start} ms and has ${tokenCount} tokens`);
			if (tokenCount + prompt.emptyTokenCount > tokenLimit) {
				// this means that the candidateLevel is too low
				exclusiveLowerBound = candidateLevelIndex;
			} else {
				// this means the candidate level is too high or it is just right
				inclusiveUpperBound = candidateLevelIndex;
			}
		} catch {
			// this means the candidate level is too low
			exclusiveLowerBound = candidateLevelIndex;
		}
	}

	if (process.env.NODE_ENV !== 'production') {
		const endTimeRendering = performance.now();
		console.log(`Rendering prompt took ${endTimeRendering - (startTimeRendering ?? 0)} ms`);
	}

	let startExactTokenCount = undefined;
	if (process.env.NODE_ENV !== 'production') {
		startExactTokenCount = performance.now();
	}

	const prompt = renderWithLevel(elem, sortedPriorityLevels[inclusiveUpperBound]);
	const tokenCount = countTokensExact(tokenizer, prompt.prompt ?? "");

	if (tokenCount + prompt.emptyTokenCount > tokenLimit) {
		// this means that the base level prompt is too big
		// we could either return an empty string or we could throw an error here
		// this is never desirable behavior, and indicates a bug with the prompt
		// hence we throw an error
		throw new Error(`Base prompt estimated token count is ${tokenCount} with ${prompt.emptyTokenCount} tokens reserved, which is higher than the limit ${tokenLimit}. This is probably a bug in the prompt — please add some priority levels to fix this.`);
	}

	if (process.env.NODE_ENV !== 'production') {
		const endExactTokenCount = performance.now();
		console.log(`Computing exact token count took ${endExactTokenCount - (startExactTokenCount ?? 0)} ms`);
	}

	let duration: number | undefined = undefined;
	if (startTime !== undefined) {
		const endTime = performance.now();
		duration = endTime - startTime;
		if (duration > 100) {
			console.warn(`Priompt WARNING: rendering prompt took ${duration} ms, which is longer than the recommended maximum of 100 ms. Consider reducing the number of scopes you have.`)
		}
	}
	return {
		prompt: prompt.prompt ?? "",
		tokenCount: tokenCount,
		tokensReserved: prompt.emptyTokenCount,
		durationMs: duration,
		priorityCutoff: sortedPriorityLevels[inclusiveUpperBound],
	};

}

export function renderBackwardsLinearSearch(elem: PromptElement, { model, tokenLimit, tokenizer }: RenderOptions): RenderOutput {
	let startTime: number | undefined;
	if (process.env.NODE_ENV !== 'production') {
		startTime = performance.now();
	}

	// set the tokenLimit to the max number of tokens per model
	if (tokenLimit === undefined) {
		if (!model) {
			throw new Error("Must specify model or tokenLimit");
		}
		tokenLimit = MAX_TOKENS[model];
	}
	if (tokenizer === undefined) {
		if (!model) {
			throw new Error("Must specify model or tokenizer");
		}
		tokenizer = getTokenizerName(model);
	}

	let startTimeValidating: number | undefined;
	if (process.env.NODE_ENV !== 'production') {
		startTimeValidating = performance.now();
	}
	validateUnrenderedPrompt(elem);
	if (process.env.NODE_ENV !== 'production') {
		const endTimeValidating = performance.now();
		console.log(`Validating prompt took ${endTimeValidating - (startTimeValidating ?? 0)} ms`);
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
		console.log(`Normalizing prompt took ${endTimeNormalizing - (startTimeNormalizing ?? 0)} ms`);
	}

	console.log(normalizedElem, "normalizedElem");


	let startTimeComputingPriorityLevels = undefined;
	if (process.env.NODE_ENV !== 'production') {
		startTimeComputingPriorityLevels = performance.now();
	}
	// for now, we do a much simple thing, which is just to render the whole thing every time
	const priorityLevels = new Set<number>();
	computePriorityLevels(normalizedElem, BASE_PRIORITY, priorityLevels);
	priorityLevels.add(BASE_PRIORITY);
	// convert to array and sort them from highest to lowest
	const sortedPriorityLevels = Array.from(priorityLevels).sort((a, b) => b - a);
	if (process.env.NODE_ENV !== 'production') {
		const endTimeComputingPriorityLevels = performance.now();
		console.log(`Computing priority levels took ${endTimeComputingPriorityLevels - (startTimeComputingPriorityLevels ?? 0)} ms`);
	}

	// if the first one is higher than the base priority, then print a warning because it will not have any effect

	let startTimeRendering = undefined;
	if (process.env.NODE_ENV !== 'production') {
		startTimeRendering = performance.now();
	}

	// naive version: just render the whole thing for every priority level, and pick the first one that is below the limit
	let prevPrompt: {
		prompt: Prompt | undefined;
		tokenCount: number;
		emptyTokenCount: number;
	} | undefined = undefined;
	let prevLevel: number | undefined = undefined;
	let thisPrompt: {
		prompt: Prompt | undefined;
		tokenCount: number;
		emptyTokenCount: number;
	} | undefined = undefined;
	for (const level of sortedPriorityLevels) {
		thisPrompt = renderWithLevelAndCountTokens(normalizedElem, level, tokenizer);
		if (isChatPrompt(thisPrompt.prompt)) {
			thisPrompt.tokenCount += CHATML_PROMPT_EXTRA_TOKEN_COUNT_CONSTANT;
		}
		if (thisPrompt.tokenCount + thisPrompt.emptyTokenCount > tokenLimit) {
			break;
		}
		prevPrompt = thisPrompt;
		prevLevel = level;
	}

	if (process.env.NODE_ENV !== 'production') {
		const endTimeRendering = performance.now();
		console.log(`Rendering prompt took ${endTimeRendering - (startTimeRendering ?? 0)} ms`);
	}

	if (prevPrompt === undefined) {
		// this means that the base level prompt is too big
		// we could either return an empty string or we could throw an error here
		// this is never desirable behavior, and indicates a bug with the prompt
		// hence we throw an error
		throw new Error(`Base prompt estimated token count is ${thisPrompt?.tokenCount} with ${thisPrompt?.emptyTokenCount} tokens reserved, which is higher than the limit ${tokenLimit}. This is probably a bug in the prompt — please add some priority levels to fix this.`);
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
			console.warn(`Actual token count is ${exactTokenCount} with ${prevPrompt.emptyTokenCount} tokens reserved, which is higher than the limit ${tokenLimit}. This can possibly happen in rare circumstances, but should never be a problem in practice.`)
		}
	}

	if (process.env.NODE_ENV !== 'production') {
		const endExactTokenCount = performance.now();
		console.log(`Computing exact token count took ${endExactTokenCount - (startExactTokenCount ?? 0)} ms`);
	}

	let duration: number | undefined = undefined;
	if (startTime !== undefined) {
		const endTime = performance.now();
		duration = endTime - startTime;
	}
	return {
		prompt: prevPrompt.prompt ?? "",
		tokenCount: prevPrompt.tokenCount,
		tokensReserved: prevPrompt.emptyTokenCount,
		durationMs: duration,
		priorityCutoff: prevLevel ?? BASE_PRIORITY,
	};

}

type NormalizedString = {
	type: 'normalizedString';
	s: string;
	cachedCount: number | undefined;
}
type NormalizedScope = Omit<Scope, 'children'> & {
	children: NormalizedNode[];
};
type NormalizedFirst = Omit<First, 'children'> & {
	children: NormalizedScope[];
};
type NormalizedChatUserSystemMessage = Omit<ChatUserSystemMessage, 'children'> & {
	children: NormalizedNode[];
};
type NormalizedChatAssistantMessage = Omit<ChatAssistantMessage, 'children'> & {
	children: NormalizedNode[];
};
type NormalizedChatFunctionResultMessage = Omit<ChatFunctionResultMessage, 'children'> & {
	children: NormalizedNode[];
};
type NormalizedChatMessage = NormalizedChatUserSystemMessage | NormalizedChatAssistantMessage | NormalizedChatFunctionResultMessage;
type NormalizedFunctionDefinition = FunctionDefinition & {
	cachedCount: number | undefined;
}
type NormalizedNode = NormalizedFirst | NormalizedScope | Empty | NormalizedChatMessage | NormalizedString | NormalizedFunctionDefinition;
type NormalizedPromptElement = NormalizedNode[];
function normalizePrompt(elem: PromptElement): NormalizedPromptElement {
	// we want to merge all the strings together
	const result: NormalizedNode[] = [];
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
	}
	for (const node of elemArray) {
		if (node === undefined || node === null) {
			continue;
		}
		if (typeof node === 'string') {
			currentString += node;
		} else if (typeof node === 'number') {
			currentString += node.toString();
		} else if (typeof node === 'object') {
			pushCurrentString();
			let newNode: NormalizedNode;
			switch (node.type) {
				case 'empty': {
					newNode = node;
					break;
				}
				case 'functionDefinition': {
					newNode = {
						...node,
						cachedCount: undefined
					};
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
						}
						),
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
		} else {
			throw new Error("Invalid prompt element");
		}
	}
	pushCurrentString();
	return result;
}

// if chat prompt, the token count will be missing the constant factor
function renderWithLevelAndCountTokens(elem: NormalizedNode[] | NormalizedNode, level: number, tokenizer: UsableTokenizer): {
	prompt: Prompt | undefined;
	tokenCount: number;
	emptyTokenCount: number;
} {
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
			}
		}
		case 'functionDefinition': {
			if (elem.cachedCount === undefined) {
				elem.cachedCount = countFunctionTokens(elem, tokenizer);
			}
			const prompt: (TextPrompt & FunctionPrompt) = {
				type: 'text',
				text: "",
				functions: [
					{
						name: elem.name,
						description: elem.description,
						parameters: elem.parameters,
					}
				]
			};
			return {
				prompt,
				tokenCount: elem.cachedCount,
				emptyTokenCount: 0
			}
		}
		case 'chat': {
			const p = renderWithLevelAndCountTokens(elem.children, level, tokenizer);
			if (isChatPrompt(p.prompt)) {
				throw new Error(`Incorrect prompt: we have nested chat messages, which is not allowed!`);
			}

			let extraTokenCount = 0;
			let message: ChatPromptMessage;
			if (elem.role === 'user' || elem.role === 'system') {
				message = {
					role: elem.role,
					content: isPlainPrompt(p.prompt) ? p.prompt : (p.prompt?.text ?? ""),
				};
			} else if (elem.role === 'assistant') {
				if (elem.functionCall !== undefined) {
					message = {
						role: elem.role,
						content: isPlainPrompt(p.prompt) ? p.prompt : (p.prompt?.text),
						functionCall: elem.functionCall,
					}
					extraTokenCount += countFunctionCallMessageTokens(elem.functionCall, tokenizer);
				} else {
					message = {
						role: elem.role,
						content: isPlainPrompt(p.prompt) ? p.prompt : (p.prompt?.text ?? ""),
					}
				}
			} else if (elem.role === 'function') {
				message = {
					role: elem.role,
					name: elem.name,
					content: isPlainPrompt(p.prompt) ? p.prompt : (p.prompt?.text ?? ""),
				}
				extraTokenCount += getTokenizerFromName(tokenizer).encode(elem.name).length;
			} else {
				throw new Error(`BUG!! Invalid role ${elem.role}`);
			}

			return {
				prompt: {
					type: 'chat',
					messages: [message],
					functions: promptHasFunctions(p.prompt) ? p.prompt.functions : undefined
				},
				tokenCount: p.tokenCount + CHATML_PROMPT_EXTRA_TOKEN_COUNT_LINEAR_FACTOR + extraTokenCount,
				emptyTokenCount: p.emptyTokenCount,
			}
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
			}
		}
		case 'normalizedString': {
			if (elem.cachedCount === undefined) {
				elem.cachedCount = getTokenizerFromName(tokenizer).encode(elem.s).length;
			}
			return {
				prompt: elem.s,
				tokenCount: elem.cachedCount,
				emptyTokenCount: 0
			};
		}
	}
}

function renderWithLevelAndEarlyExitWithTokenEstimation(elem: PromptElement, level: number, tokenizer: UsableTokenizer, tokenLimit: number): {
	prompt: Prompt | undefined;
	emptyTokenCount: number;
} {
	if (elem === undefined || elem === null || elem === false) {
		return {
			prompt: undefined,
			emptyTokenCount: 0
		};
	}
	if (Array.isArray(elem)) {
		return elem.map(e => renderWithLevelAndEarlyExitWithTokenEstimation(e, level, tokenizer, tokenLimit)).reduce((a, b) => {
			const sum = sumPrompts(a.prompt, b.prompt);
			const lowerBound = estimateLowerBoundTokensForPrompt(sum, tokenizer);
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
			}
		}
		case 'functionDefinition': {
			const prompt: (TextPrompt & FunctionPrompt) = {
				type: 'text',
				text: "",
				functions: [
					{
						name: elem.name,
						description: elem.description,
						parameters: elem.parameters,
					}
				]
			};
			return {
				prompt,
				emptyTokenCount: 0
			}
		}
		case 'chat': {
			const p = renderWithLevelAndEarlyExitWithTokenEstimation(elem.children, level, tokenizer, tokenLimit);
			if (isChatPrompt(p.prompt)) {
				throw new Error(`Incorrect prompt: we have nested chat messages, which is not allowed!`);
			}

			let message: ChatPromptMessage;
			if (elem.role === 'user' || elem.role === 'system') {
				message = {
					role: elem.role,
					content: isPlainPrompt(p.prompt) ? p.prompt : (p.prompt?.text ?? ""),
				};
			} else if (elem.role === 'assistant') {
				if (elem.functionCall !== undefined) {
					message = {
						role: elem.role,
						content: isPlainPrompt(p.prompt) ? p.prompt : (p.prompt?.text),
						functionCall: elem.functionCall,
					}
				} else {
					message = {
						role: elem.role,
						content: isPlainPrompt(p.prompt) ? p.prompt : (p.prompt?.text ?? ""),
					}
				}
			} else if (elem.role === 'function') {
				message = {
					role: elem.role,
					name: elem.name,
					content: isPlainPrompt(p.prompt) ? p.prompt : (p.prompt?.text ?? ""),
				}
			} else {
				throw new Error(`BUG!! Invalid role ${elem.role}`);
			}

			return {
				prompt: {
					type: 'chat',
					messages: [message],
					functions: promptHasFunctions(p.prompt) ? p.prompt.functions : undefined
				},
				emptyTokenCount: p.emptyTokenCount,
			}
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
			}
		}
	}
}

function renderWithLevel(elem: PromptElement, level: number): {
	prompt: Prompt | undefined;
	emptyTokenCount: number;
} {
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
			}
		}
		case 'functionDefinition': {
			const prompt: (TextPrompt & FunctionPrompt) = {
				type: 'text',
				text: "",
				functions: [
					{
						name: elem.name,
						description: elem.description,
						parameters: elem.parameters,
					}
				]
			};
			return {
				prompt,
				emptyTokenCount: 0
			}
		}
		case 'chat': {
			const p = renderWithLevel(elem.children, level);
			if (isChatPrompt(p.prompt)) {
				throw new Error(`Incorrect prompt: we have nested chat messages, which is not allowed!`);
			}

			let message: ChatPromptMessage;
			if (elem.role === 'user' || elem.role === 'system') {
				message = {
					role: elem.role,
					content: isPlainPrompt(p.prompt) ? p.prompt : (p.prompt?.text ?? ""),
				};
			} else if (elem.role === 'assistant') {
				if (elem.functionCall !== undefined) {
					message = {
						role: elem.role,
						content: isPlainPrompt(p.prompt) ? p.prompt : (p.prompt?.text),
						functionCall: elem.functionCall,
					}
				} else {
					message = {
						role: elem.role,
						content: isPlainPrompt(p.prompt) ? p.prompt : (p.prompt?.text ?? ""),
					}
				}
			} else if (elem.role === 'function') {
				message = {
					role: elem.role,
					name: elem.name,
					content: isPlainPrompt(p.prompt) ? p.prompt : (p.prompt?.text ?? ""),
				}
			} else {
				throw new Error(`BUG!! Invalid role ${elem.role}`);
			}

			return {
				prompt: {
					type: 'chat',
					messages: [message],
					functions: promptHasFunctions(p.prompt) ? p.prompt.functions : undefined
				},
				emptyTokenCount: p.emptyTokenCount,
			}
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
			}
		}
	}
}

// TODO: make this into eslint rules so they can be shown in the IDE
function validateUnrenderedPrompt(elem: PromptElement): void {
	validateNoChildrenHigherPriorityThanParent(elem);

	// print a warning if any scope has both an absolute and relative priority
	validateNotBothAbsoluteAndRelativePriority(elem);
}


function validateNotBothAbsoluteAndRelativePriority(elem: PromptElement): void {
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
		case 'functionDefinition':
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

function validateNoChildrenHigherPriorityThanParent(elem: PromptElement, parentPriority: number = BASE_PRIORITY): void {
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
		case 'functionDefinition':
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

function computePriority(elem: Scope | NormalizedScope, parentPriority: number) {
	return elem.absolutePriority ?? (parentPriority + (elem.relativePriority ?? 0));
}

type AnyNode = NormalizedNode | Node;

function computePriorityLevels(elem: AnyNode[] | AnyNode, parentPriority: number, levels: Set<number>): void {
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
		case 'functionDefinition':
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


function countTokensExact(tokenizer: UsableTokenizer, prompt: Prompt): number {
	const tokenizerObj = getTokenizerFromName(tokenizer);
	let tokens = 0;
	if (isPlainPrompt(prompt)) {
		tokens += tokenizerObj.encode(prompt).length;
	} else if (isChatPrompt(prompt)) {
		const msgTokens = prompt.messages.map(msg => countMessageTokens(msg, tokenizer));
		// docs here: https://platform.openai.com/docs/guides/chat/introduction
		tokens += msgTokens.reduce((a, b) => a + b, 0) + CHATML_PROMPT_EXTRA_TOKEN_COUNT_LINEAR_FACTOR * (prompt.messages.length) + CHATML_PROMPT_EXTRA_TOKEN_COUNT_CONSTANT;
	} else {
		tokens += tokenizerObj.encode(prompt.text).length;
	}
	if (promptHasFunctions(prompt)) {
		// we assume an extra 2 tokens per function
		tokens += prompt.functions.reduce((a, b) => a + countFunctionTokens(b, tokenizer) + 2, 0);
	}
	return tokens;
}

export function promptToOpenAIChatRequest(prompt: Prompt): { messages: Array<ChatCompletionRequestMessage>; functions: ChatCompletionFunctions[] | undefined } {
	const functions = promptHasFunctions(prompt) ? prompt.functions : undefined;
	const messages = promptToOpenAIChatMessages(prompt);
	return {
		messages,
		functions
	};
}

export function promptToOpenAIChatMessages(prompt: Prompt): Array<ChatCompletionRequestMessage> {
	if (isPlainPrompt(prompt)) {
		return [
			{
				role: 'user',
				content: prompt
			}
		];
	} else if (isChatPrompt(prompt)) {
		return prompt.messages.map(msg => {
			if (msg.role === 'function') {
				return {
					role: msg.role,
					name: msg.name,
					content: msg.content,
				}
			} else if (msg.role === 'assistant' && msg.functionCall !== undefined) {
				return {
					role: msg.role,
					content: msg.content ?? "", // openai is lying when they say this should not be provided
					function_call: msg.functionCall,
				}
			} else {
				return {
					role: msg.role,
					content: msg.content,
				}
			}
		});
	}
	throw new Error(`BUG!! promptToOpenAIChatMessagesgot an invalid prompt`);
}

function countMessageTokens(message: ChatPromptMessage, tokenizer: UsableTokenizer): number {
	const tokenizerObj = getTokenizerFromName(tokenizer);
	if (message.role === 'function') {
		// add an extra 2 tokens for good measure
		return tokenizerObj.encode(message.name).length + tokenizerObj.encode(message.content).length + 2;
	} else if (message.role === 'assistant' && message.functionCall !== undefined) {
		return countFunctionCallMessageTokens(message.functionCall, tokenizer) + (message.content !== undefined ? tokenizerObj.encode(message.content).length : 0);
	} else {
		return tokenizerObj.encode(message.content ?? "").length;
	}
}

function countFunctionCallMessageTokens(functionCall: { name: string; arguments: string; }, tokenizer: UsableTokenizer): number {
	const tokenizerObj = getTokenizerFromName(tokenizer);
	// add some constant factor here because who knows what's actually going on with functions
	return tokenizerObj.encode(functionCall.name).length + tokenizerObj.encode(functionCall.arguments).length + 5;
}

function countFunctionTokens(functionDefinition: ChatAndFunctionPromptFunction, tokenizer: UsableTokenizer): number {
	// hmmmm how do we count these tokens? openai has been quite unclear
	// for now we JSON stringify and count tokens, and hope that that is reasonably close
	const stringifiedFunction = JSON.stringify({
		name: functionDefinition.name,
		description: functionDefinition.description,
		parameters: functionDefinition.parameters,
	}, null, 2);
	// we multiply by 1.5 and add 10 just to be safe until we've done more testing
	const raw = getTokenizerFromName(tokenizer).encode(stringifiedFunction).length;
	return Math.ceil(raw * 1.5) + 10;
}

function estimateFunctionTokensUsingCharcount(functionDefinition: ChatAndFunctionPromptFunction, tokenizer: UsableTokenizer): [number, number] {
	const stringifiedFunction = JSON.stringify({
		name: functionDefinition.name,
		description: functionDefinition.description,
		parameters: functionDefinition.parameters,
	}, null, 2);
	const raw = estimateTokensUsingCharcount(stringifiedFunction, tokenizer);
	// we multiply by 1.5 and add 10 just to be safe until we've done more testing for the upper bound
	return [Math.ceil(raw[0] * 0.5), Math.ceil(raw[1] * 1.5) + 10];
}

function estimateLowerBoundTokensForPrompt(prompt: Prompt | undefined, tokenizer: UsableTokenizer): number {
	if (prompt === undefined) {
		return 0;
	}
	let contentTokens;
	if (isChatPrompt(prompt)) {
		contentTokens = prompt.messages.reduce((a, b) => {
			if (b.role === 'function') {
				// since this is a lower bound, we assume there are no extra tokens here
				return a + estimateTokensUsingCharcount(b.name + b.content, tokenizer)[0];
			} else if (b.role === 'assistant' && b.functionCall !== undefined) {
				return a + estimateTokensUsingCharcount(b.functionCall.name + b.functionCall.arguments + (b.content ?? ""), tokenizer)[0];
			} else {
				return a + estimateTokensUsingCharcount(b.content ?? "", tokenizer)[0];
			}
		}, 0);
	} else if (isPlainPrompt(prompt)) {
		contentTokens = estimateTokensUsingCharcount(prompt, tokenizer)[0];
	} else {
		contentTokens = estimateTokensUsingCharcount(prompt.text, tokenizer)[0];
	}

	const functionTokens = (promptHasFunctions(prompt) ? prompt.functions.reduce((a, b) => (a + estimateFunctionTokensUsingCharcount(b, tokenizer)[0]), 0) : 0);

	return contentTokens + functionTokens;
}