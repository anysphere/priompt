// TODO: add an onExclude hook. i think it should be able to do whatever, and whenever it is executed, we have a promise to re-render the whole thing afterwards. the idea is that when some things are excluded we want to actually do something more advanced than just excuding certain parts (eg summarize or something)


// TODO: add an IDE plugin or something that renders the prompt when you hover over it (and has a slider for the priority)

import { ChatCompletionRequestMessage, ChatCompletionFunctions, ChatCompletionResponseMessage, CreateChatCompletionResponse, CreateChatCompletionRequest } from 'openai';
import { CHATML_PROMPT_EXTRA_TOKEN_COUNT_CONSTANT, CHATML_PROMPT_EXTRA_TOKEN_COUNT_LINEAR_FACTOR, MAX_TOKENS, UsableLanguageModel, UsableTokenizer, isUsableLanguageModel, usableLanguageModels } from './openai';
import { estimateTokensUsingBytecount, estimateTokensUsingCharcount, getTokenizerName, numTokens, tokenizerObject } from './tokenizer';
import { BaseProps, PromptElement, ChatMessage, ChatPrompt, Empty, First, RenderedPrompt, PromptNode, Scope, FunctionDefinition, FunctionPrompt, TextPrompt, ChatAndFunctionPromptFunction, ChatPromptMessage, ChatUserSystemMessage, ChatAssistantMessage, ChatFunctionResultMessage, Capture, OutputHandler, PromptProps, CaptureProps, BasePromptProps, ReturnProps, Isolate, RenderOutput, RenderOptions, PromptString, Prompt, BreakToken } from './types';
import { NewOutputCatcher } from './outputCatcher.ai';
import { PreviewManager } from './preview';
import { SpecialTokenAction, SupportedEncoding } from '@anysphere/tiktoken-node';



export function isChatPrompt(prompt: RenderedPrompt | undefined): prompt is ChatPrompt {
	return typeof prompt === 'object' && !Array.isArray(prompt) && prompt.type === 'chat';
}
export function isPlainPrompt(prompt: RenderedPrompt | undefined): prompt is PromptString {
	return typeof prompt === 'string' || Array.isArray(prompt);
}
function isTextPromptPotentiallyWithFunctions(prompt: RenderedPrompt | undefined): prompt is ((TextPrompt & FunctionPrompt) | PromptString) {
	return (typeof prompt === 'object' && 'text' in prompt) || typeof prompt === 'string';
}
export function promptHasFunctions(prompt: RenderedPrompt | undefined): prompt is ((ChatPrompt & FunctionPrompt) | (TextPrompt & FunctionPrompt)) {
	return typeof prompt === 'object' && 'functions' in prompt && prompt.functions !== undefined;
}
export function promptStringToString(promptString: PromptString): string {
	return Array.isArray(promptString) ? promptString.join('') : promptString;
}
function promptGetText(prompt: RenderedPrompt | undefined): string | undefined {
	if (!isTextPromptPotentiallyWithFunctions(prompt)) {
		return undefined;
	}
	if (isPlainPrompt(prompt)) {
		return promptStringToString(prompt);
	}
	return promptStringToString(prompt.text);
}

function sumPromptStrings(a: PromptString, b: PromptString): PromptString {
	if (Array.isArray(a) && Array.isArray(b)) {
		return [...a.slice(0, -1), a[a.length - 1] + b[0], ...b.slice(1)];
	}
	if (Array.isArray(a)) {
		return [...a.slice(0, -1), a[a.length - 1] + b,];
	}
	if (Array.isArray(b)) {
		return [a + b[0], ...b.slice(1)];
	}
	return a + b;
}

function sumPrompts(a: RenderedPrompt | undefined, b: RenderedPrompt | undefined): RenderedPrompt | undefined {
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
			text: sumPromptStrings((isPlainPrompt(a) ? a : a.text), (isPlainPrompt(b) ? b : b.text)),
			functions,
		};
		return prompt;
	}
	if (isPlainPrompt(a) && isPlainPrompt(b)) {
		return sumPromptStrings(a, b);
	}
	throw new Error(`cannot sum prompts ${a} (${isPlainPrompt(a) ? 'string' : a.type}) and ${b} (${isPlainPrompt(b) ? 'string' : b.type})`);
}

export function createElement(tag: ((props: BaseProps & Record<string, unknown>) => PromptNode) | string, props: Record<string, unknown> | null, ...children: PromptNode[]): PromptElement {
	if (typeof tag === 'function') {
		// we scope each tag so we can add priorities to it
		return {
			type: 'scope',
			children: [tag({ ...props, children: children })],
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
					children,
					relativePriority: (props && typeof props.prel === 'number') ? props.prel : undefined,
					absolutePriority: (props && typeof props.p === 'number') ? props.p : undefined,
					onEject: props && typeof props.onEject === 'function' ? props.onEject as () => void : undefined,
					onInclude: props && typeof props.onInclude === 'function' ? props.onInclude as () => void : undefined,
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
		case 'breaktoken':
			{
				if (children.length > 0) {
					throw new Error(`breaktoken tag must have no children, got ${children}`);
				}
				return {
					type: 'scope',
					children: [{
						type: 'breaktoken',
					}],
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
				// assert that all children are scopes
				const newChildren: Scope[] = children.map(child => {
					if (child === null || typeof child !== 'object' || !("type" in child) || child.type !== 'scope') {
						throw new Error(`first tag must have only scope children, got ${child}`);
					}
					return child;
				});
				return {
					type: 'first',
					children: newChildren,
					onEject: props && typeof props.onEject === 'function' ? props.onEject as () => void : undefined,
					onInclude: props && typeof props.onInclude === 'function' ? props.onInclude as () => void : undefined,
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
		case 'isolate':
			{
				// must have tokenLimit
				if (!props || typeof props.tokenLimit !== 'number') {
					throw new Error(`isolate tag must have a tokenLimit prop, got ${props}`);
				}

				return {
					type: 'scope',
					children: [{
						type: 'isolate',
						tokenLimit: props.tokenLimit,
						cachedRenderOutput: undefined,
						children,
					}],
					absolutePriority: (typeof props.p === 'number') ? props.p : undefined,
					relativePriority: (typeof props.prel === 'number') ? props.prel : undefined
				};
			}
		case 'capture':
			{
				if (children.length > 0) {
					throw new Error(`capture tag must have no children, got ${children}`);
				}
				if (!props || ('onOutput' in props && typeof props.onOutput !== 'function')) {
					throw new Error(`capture tag must have an onOutput prop that's a function, got ${props}`);
				}
				if ('onStream' in props && typeof props.onStream !== 'function') {
					throw new Error(`capture tag must have an onStream prop and it must be a function, got ${props}`);
				}


				return {
					type: 'scope',
					children: [{
						type: 'capture',
						onOutput: ('onOutput' in props && props.onOutput !== undefined) ? props.onOutput as OutputHandler<ChatCompletionResponseMessage> : undefined,
						onStream: ('onStream' in props && props.onStream !== undefined) ? props.onStream as OutputHandler<AsyncIterable<ChatCompletionResponseMessage>> : undefined,
					}],
					absolutePriority: (typeof props.p === 'number') ? props.p : undefined,
					relativePriority: (typeof props.prel === 'number') ? props.prel : undefined
				};
			}
		default:
			throw new Error(`Unknown tag ${tag}`);
	}
}

export function Fragment({ children }: { children: PromptNode; }): PromptNode {
	return children;
}

// priority level if it is not set becomes 1e9, i.e. it is always rendered
const BASE_PRIORITY = 1e9;

export async function render(elem: PromptNode, options: RenderOptions): Promise<RenderOutput> {

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

	return await renderBinarySearch(elem, options);
}

// returns the highest-priority onOutput call
// may throw
export async function renderun<
	ReturnT,
	PropsT extends Record<string, unknown>
>({
	prompt,
	props,
	renderOptions,
	modelCall,
	loggingOptions,
	renderedMessagesCallback = (messages: ChatCompletionResponseMessage[]) => { },
}: {
	prompt: (props: PromptProps<PropsT, ReturnT>) => PromptNode;
	props: Omit<PropsT, "onReturn">;
	renderOptions: RenderOptions;
	renderedMessagesCallback?: (messages: ChatCompletionResponseMessage[]) => void
	modelCall: (
		args: ReturnType<typeof promptToOpenAIChatRequest>
	) => Promise<{ type: "output", value: CreateChatCompletionResponse } | { type: "stream", value: AsyncIterable<ChatCompletionResponseMessage> }>;
	loggingOptions?: {
		promptElementRef?: { current: PromptNode | undefined };
		renderOutputRef?: { current: RenderOutput | undefined };
	}
}): Promise<ReturnT> {
	console.log('Running renderun')
	// create an output catcher
	const outputCatcher = NewOutputCatcher<ReturnT>();

	const baseProps: Omit<BasePromptProps<PropsT>, "onReturn"> = props;

	const returnProps: ReturnProps<ReturnT> = {
		onReturn: (x) => outputCatcher.onOutput(x),
	};

	// this is fine because onOutput will get overridden
	const realProps: PromptProps<PropsT, ReturnT> = {
		...baseProps,
		...returnProps,
	} as PromptProps<PropsT, ReturnT>;

	PreviewManager.maybeDump<PropsT, ReturnT>(prompt, props);

	// first render
	const promptElement = prompt(realProps);
	if (loggingOptions?.promptElementRef !== undefined) {
		loggingOptions.promptElementRef.current = promptElement;
	}
	const rendered = await render(promptElement, renderOptions);
	if (loggingOptions?.renderOutputRef !== undefined) {
		loggingOptions.renderOutputRef.current = rendered;
	}


	const modelRequest = promptToOpenAIChatRequest(rendered.prompt);
	renderedMessagesCallback(modelRequest.messages);

	// now do the model call
	const modelOutput = await modelCall(modelRequest);


	// call all of them and wait all of them in parallel
	if (modelOutput.type === "output") {

		if (modelOutput.value.choices.length === 0) {
			throw new Error(`model returned no choices`);
		}

		const modelOutputMessage = modelOutput.value.choices[0].message;

		if (modelOutputMessage === undefined) {
			throw new Error(`model returned no message`);
		}

		await Promise.all(
			rendered.outputHandlers.map((handler) => handler(modelOutputMessage))
		);
	} else {
		// If no stream handlers, the default is to just return the first output
		if (rendered.streamHandlers.length === 0) {
			const awaitable = async function* (): AsyncIterable<ChatCompletionResponseMessage> {
				for await (const message of modelOutput.value) {
					yield message
				}
			}
			await outputCatcher.onOutput(awaitable() as ReturnT);
		} else {
			await Promise.all(
				rendered.streamHandlers.map((handler) => handler(modelOutput.value))
			);

		}
	}

	// now return the first output
	const firstOutput = outputCatcher.getOutput();

	if (firstOutput === undefined) {
		// bad bad! let's throw an error
		throw new Error(
			`No output was captured. Did you forget to include a <capture> element?`
		);
	} else {
		return firstOutput;
	}
}

export async function renderBinarySearch(elem: PromptNode, { model, tokenLimit, tokenizer, lastMessageIsIncomplete }: RenderOptions): Promise<RenderOutput> {
	let startTime: number | undefined;
	if (process.env.NODE_ENV === 'development') {
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
	if (process.env.NODE_ENV === 'development') {
		startTimeValidating = performance.now();
	}
	validateUnrenderedPrompt(elem);
	if (process.env.NODE_ENV === 'development') {
		const endTimeValidating = performance.now();
		console.log(`Validating prompt took ${endTimeValidating - (startTimeValidating ?? 0)} ms`);
	}

	let startTimeComputingPriorityLevels = undefined;
	if (process.env.NODE_ENV === 'development') {
		startTimeComputingPriorityLevels = performance.now();
	}
	// for now, we do a much simple thing, which is just to render the whole thing every time
	const priorityLevels = new Set<number>();
	computePriorityLevels(elem, BASE_PRIORITY, priorityLevels);
	priorityLevels.add(BASE_PRIORITY);
	// convert to array and sort them from lowest to highest
	const sortedPriorityLevels = Array.from(priorityLevels).sort((a, b) => a - b);
	if (process.env.NODE_ENV === 'development') {
		const endTimeComputingPriorityLevels = performance.now();
		console.log(`Computing priority levels took ${endTimeComputingPriorityLevels - (startTimeComputingPriorityLevels ?? 0)} ms`);
	}

	// now we hydrate the isolates
	let startTimeHydratingIsolates = undefined;
	if (process.env.NODE_ENV === 'development') {
		startTimeHydratingIsolates = performance.now();
	}
	await hydrateIsolates(elem, tokenizer);
	if (process.env.NODE_ENV === 'development') {
		const endTimeHydratingIsolates = performance.now();
		console.log(`Hydrating isolates took ${endTimeHydratingIsolates - (startTimeHydratingIsolates ?? 0)} ms`);
	}


	// if the first one is higher than the base priority, then print a warning because it will not have any effect

	let startTimeRendering = undefined;
	if (process.env.NODE_ENV === 'development') {
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
		if (process.env.NODE_ENV === 'development') {
			console.log(`Trying candidate level ${candidateLevel} with index ${candidateLevelIndex}`)
		}
		let start: number | undefined;
		if (process.env.NODE_ENV === 'development') {
			start = performance.now();
		}
		let countStart: number | undefined;
		let tokenCount = -1;
		try {
			const prompt = renderWithLevelAndEarlyExitWithTokenEstimation(elem, candidateLevel, tokenizer, tokenLimit);
			if (process.env.NODE_ENV === 'development') {
				countStart = performance.now();
			}
			// const prompt = renderWithLevel(elem, candidateLevel);
			tokenCount = await countTokensExact(tokenizer, prompt.prompt ?? "", { lastMessageIsIncomplete });
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
		} finally {
			if (process.env.NODE_ENV === 'development') {
				const end = performance.now();
				console.log(`Candidate level ${candidateLevel} with index ${candidateLevelIndex} took ${end - (start ?? 0)} ms and has ${tokenCount} tokens (-1 means early exit, counting took ${end - (countStart ?? 0)})`);
			}
		}
	}

	if (process.env.NODE_ENV === 'development') {
		const endTimeRendering = performance.now();
		console.log(`Rendering prompt took ${endTimeRendering - (startTimeRendering ?? 0)} ms`);
	}

	let startExactTokenCount = undefined;
	if (process.env.NODE_ENV === 'development') {
		startExactTokenCount = performance.now();
	}

	const prompt = renderWithLevel(elem, sortedPriorityLevels[inclusiveUpperBound], tokenizer, true);
	const tokenCount = await countTokensExact(tokenizer, prompt.prompt ?? "", { lastMessageIsIncomplete });

	if (tokenCount + prompt.emptyTokenCount > tokenLimit) {
		// this means that the base level prompt is too big
		// we could either return an empty string or we could throw an error here
		// this is never desirable behavior, and indicates a bug with the prompt
		// hence we throw an error
		throw new Error(`Base prompt estimated token count is ${tokenCount} with ${prompt.emptyTokenCount} tokens reserved, which is higher than the limit ${tokenLimit}. This is probably a bug in the prompt — please add some priority levels to fix this.`);
	}

	if (process.env.NODE_ENV === 'development') {
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
		tokenLimit: tokenLimit,
		tokenizer,
		durationMs: duration,
		outputHandlers: prompt.outputHandlers,
		streamHandlers: prompt.streamHandlers,
		priorityCutoff: sortedPriorityLevels[inclusiveUpperBound],
	};

}

export async function renderBackwardsLinearSearch(elem: PromptNode, { model, tokenLimit, tokenizer, lastMessageIsIncomplete }: RenderOptions): Promise<RenderOutput> {
	let startTime: number | undefined;
	if (process.env.NODE_ENV === 'development') {
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
	if (process.env.NODE_ENV === 'development') {
		startTimeValidating = performance.now();
		// only validate in debug
		validateUnrenderedPrompt(elem);
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
	if (process.env.NODE_ENV === 'development') {
		startTimeNormalizing = performance.now();
	}
	const normalizedElem = normalizePrompt(elem);
	if (process.env.NODE_ENV === 'development') {
		const endTimeNormalizing = performance.now();
		console.log(`Normalizing prompt took ${endTimeNormalizing - (startTimeNormalizing ?? 0)} ms`);
	}

	console.log(normalizedElem, "normalizedElem");


	let startTimeComputingPriorityLevels = undefined;
	if (process.env.NODE_ENV === 'development') {
		startTimeComputingPriorityLevels = performance.now();
	}
	// for now, we do a much simple thing, which is just to render the whole thing every time
	const priorityLevels = new Set<number>();
	computePriorityLevels(normalizedElem, BASE_PRIORITY, priorityLevels);
	priorityLevels.add(BASE_PRIORITY);
	// convert to array and sort them from highest to lowest
	const sortedPriorityLevels = Array.from(priorityLevels).sort((a, b) => b - a);
	if (process.env.NODE_ENV === 'development') {
		const endTimeComputingPriorityLevels = performance.now();
		console.log(`Computing priority levels took ${endTimeComputingPriorityLevels - (startTimeComputingPriorityLevels ?? 0)} ms`);
	}

	// if the first one is higher than the base priority, then print a warning because it will not have any effect

	let startTimeRendering = undefined;
	if (process.env.NODE_ENV === 'development') {
		startTimeRendering = performance.now();
	}

	// naive version: just render the whole thing for every priority level, and pick the first one that is below the limit
	let prevPrompt: {
		prompt: RenderedPrompt | undefined;
		tokenCount: number;
		emptyTokenCount: number;
		outputHandlers: OutputHandler<ChatCompletionResponseMessage>[];
		streamHandlers: OutputHandler<AsyncIterable<ChatCompletionResponseMessage>>[];
	} | undefined = undefined;
	let prevLevel: number | undefined = undefined;
	let thisPrompt: {
		prompt: RenderedPrompt | undefined;
		tokenCount: number;
		emptyTokenCount: number;
		outputHandlers: OutputHandler<ChatCompletionResponseMessage>[];
		streamHandlers: OutputHandler<AsyncIterable<ChatCompletionResponseMessage>>[];
	} | undefined = undefined;
	for (const level of sortedPriorityLevels) {
		thisPrompt = await renderWithLevelAndCountTokens(normalizedElem, level, tokenizer);
		if (isChatPrompt(thisPrompt.prompt)) {
			thisPrompt.tokenCount += CHATML_PROMPT_EXTRA_TOKEN_COUNT_CONSTANT;
		}
		if (thisPrompt.tokenCount + thisPrompt.emptyTokenCount > tokenLimit) {
			break;
		}
		prevPrompt = thisPrompt;
		prevLevel = level;
	}

	if (process.env.NODE_ENV === 'development') {
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
	if (process.env.NODE_ENV === 'development') {
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
		const exactTokenCount = await countTokensExact(tokenizer, prevPrompt.prompt, { lastMessageIsIncomplete });
		console.log(`Discrepancy: (estimated token count) - (actual token count) = ${prevPrompt.tokenCount} - ${exactTokenCount} = ${prevPrompt.tokenCount - exactTokenCount}`);
		prevPrompt.tokenCount = exactTokenCount;
		if (exactTokenCount + prevPrompt.emptyTokenCount > tokenLimit) {
			console.warn(`Actual token count is ${exactTokenCount} with ${prevPrompt.emptyTokenCount} tokens reserved, which is higher than the limit ${tokenLimit}. This can possibly happen in rare circumstances, but should never be a problem in practice.`)
		}
	}

	if (process.env.NODE_ENV === 'development') {
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
		tokenLimit: tokenLimit,
		tokenizer,
		outputHandlers: prevPrompt.outputHandlers,
		streamHandlers: prevPrompt.streamHandlers,
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
	children: NormalizedNode;
};
type NormalizedFirst = Omit<First, 'children'> & {
	children: NormalizedScope[];
};
type NormalizedChatUserSystemMessage = Omit<ChatUserSystemMessage, 'children'> & {
	children: NormalizedNode;
};
type NormalizedChatAssistantMessage = Omit<ChatAssistantMessage, 'children'> & {
	children: NormalizedNode;
};
type NormalizedChatFunctionResultMessage = Omit<ChatFunctionResultMessage, 'children'> & {
	children: NormalizedNode;
};
type NormalizedChatMessage = NormalizedChatUserSystemMessage | NormalizedChatAssistantMessage | NormalizedChatFunctionResultMessage;
type NormalizedFunctionDefinition = FunctionDefinition & {
	cachedCount: number | undefined;
}
type NormalizedElement = NormalizedFirst | NormalizedScope | BreakToken | Empty | Isolate | Capture | NormalizedChatMessage | NormalizedString | NormalizedFunctionDefinition;
type NormalizedNode = NormalizedElement | NormalizedNode[];

function normalizePrompt(elem: PromptNode): NormalizedElement[] {
	// we want to merge all the strings together
	const result: NormalizedElement[] = [];
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
		if (Array.isArray(node)) {
			pushCurrentString();
			result.push(...normalizePrompt(node));
		} else if (typeof node === 'string') {
			currentString += node;
		} else if (typeof node === 'number') {
			currentString += node.toString();
		} else if (typeof node === 'object') {
			pushCurrentString();
			let newNode: NormalizedElement;
			switch (node.type) {
				case 'capture':
				case 'isolate':
				case 'breaktoken':
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
async function renderWithLevelAndCountTokens(elem: NormalizedNode, level: number, tokenizer: UsableTokenizer): Promise<{
	prompt: RenderedPrompt | undefined;
	tokenCount: number;
	emptyTokenCount: number;
	outputHandlers: OutputHandler<ChatCompletionResponseMessage>[];
	streamHandlers: OutputHandler<AsyncIterable<ChatCompletionResponseMessage>>[];
}> {
	if (Array.isArray(elem)) {
		return (await Promise.all(elem.map(e => renderWithLevelAndCountTokens(e, level, tokenizer)))).reduce((a, b) => {
			return {
				prompt: sumPrompts(a.prompt, b.prompt),
				tokenCount: a.tokenCount + b.tokenCount,
				emptyTokenCount: a.emptyTokenCount + b.emptyTokenCount,
				outputHandlers: [...a.outputHandlers, ...b.outputHandlers],
				streamHandlers: [...a.streamHandlers, ...b.streamHandlers]
			};
		}, {
			prompt: undefined,
			tokenCount: 0,
			emptyTokenCount: 0,
			outputHandlers: [],
			streamHandlers: []
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
				emptyTokenCount: 0,
				outputHandlers: [],
				streamHandlers: []
			};
		}
		case 'capture': {
			return {
				prompt: undefined,
				tokenCount: 0,
				emptyTokenCount: 0,
				outputHandlers: elem.onOutput ? [elem.onOutput] : [],
				streamHandlers: elem.onStream ? [elem.onStream] : []
			}
		}
		case 'breaktoken': {
			return {
				// a breaktoken is just a split!
				prompt: ['', ''],
				tokenCount: 0,
				emptyTokenCount: 0,
				outputHandlers: [],
				streamHandlers: []
			}
		}
		case 'empty': {
			return {
				prompt: undefined,
				tokenCount: 0,
				emptyTokenCount: elem.tokenCount,
				outputHandlers: [],
				streamHandlers: []
			}
		}
		case 'functionDefinition': {
			if (elem.cachedCount === undefined) {
				elem.cachedCount = await countFunctionTokens(elem, tokenizer);
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
				emptyTokenCount: 0,
				outputHandlers: [],
				streamHandlers: []
			}
		}
		case 'isolate': {
			// check if we have a cached prompt
			if (elem.cachedRenderOutput === undefined) {
				elem.cachedRenderOutput = await render(elem.children, {
					tokenizer,
					tokenLimit: elem.tokenLimit,
				})
			}
			return {
				prompt: elem.cachedRenderOutput.prompt,
				tokenCount: elem.cachedRenderOutput.tokenCount,
				emptyTokenCount: elem.cachedRenderOutput.tokensReserved,
				outputHandlers: elem.cachedRenderOutput.outputHandlers,
				streamHandlers: elem.cachedRenderOutput.streamHandlers
			}
		}
		case 'chat': {
			const p = await renderWithLevelAndCountTokens(elem.children, level, tokenizer);
			if (isChatPrompt(p.prompt)) {
				throw new Error(`Incorrect prompt: we have nested chat messages, which is not allowed!`);
			}

			let extraTokenCount = 0;
			let message: ChatPromptMessage;
			if (elem.role === 'user' || elem.role === 'system') {
				message = {
					role: elem.role,
					name: elem.name,
					content: isPlainPrompt(p.prompt) ? p.prompt : (p.prompt?.text ?? ""),
				};
			} else if (elem.role === 'assistant') {
				if (elem.functionCall !== undefined) {
					message = {
						role: elem.role,
						content: isPlainPrompt(p.prompt) ? p.prompt : (p.prompt?.text),
						functionCall: elem.functionCall,
					}
					extraTokenCount += await countFunctionCallMessageTokens(elem.functionCall, tokenizer);
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
				extraTokenCount += await numTokens(elem.name, { tokenizer });
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
				outputHandlers: p.outputHandlers,
				streamHandlers: p.streamHandlers
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
				emptyTokenCount: 0,
				outputHandlers: [],
				streamHandlers: []
			}
		}
		case 'normalizedString': {
			if (elem.cachedCount === undefined) {
				elem.cachedCount = await numTokens(elem.s, { tokenizer });
			}
			return {
				prompt: elem.s,
				tokenCount: elem.cachedCount,
				emptyTokenCount: 0,
				outputHandlers: [],
				streamHandlers: []
			};
		}
	}
}

// WARNING: do not attempt to make this function async!!! it will make it a lot slower!
function renderWithLevelAndEarlyExitWithTokenEstimation(elem: PromptNode, level: number, tokenizer: UsableTokenizer, tokenLimit: number): {
	prompt: RenderedPrompt | undefined;
	emptyTokenCount: number;
} {
	if (elem === undefined || elem === null || elem === false) {
		return {
			prompt: undefined,
			emptyTokenCount: 0
		};
	}
	if (Array.isArray(elem)) {
		const results = elem.map(e => renderWithLevelAndEarlyExitWithTokenEstimation(e, level, tokenizer, tokenLimit));
		return results.reduce((a, b) => {
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
		case 'capture': {
			// we're not rendering the capture here
			return {
				prompt: undefined,
				emptyTokenCount: 0
			}
		}
		case 'breaktoken': {
			return {
				prompt: ['', ''],
				emptyTokenCount: 0
			}
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
		case 'isolate': {
			// check if we have a cached prompt
			if (elem.cachedRenderOutput === undefined) {
				// throw error! we need to hydrate the isolates first!
				throw new Error(`BUG!! Isolates should have been hydrated before calling renderWithLevelAndEarlyExitWithTokenEstimation`);
			}
			return {
				prompt: elem.cachedRenderOutput.prompt,
				emptyTokenCount: elem.cachedRenderOutput.tokensReserved,
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
					name: elem.name,
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

function recursivelyEject(elem: PromptNode) {
	if (elem === undefined || elem === null || elem === false || typeof elem === 'string' || typeof elem === 'number') {
		return;
	}
	if (Array.isArray(elem)) {
		elem.forEach(e => recursivelyEject(e));
	} else {
		if ('onEject' in elem && elem.onEject !== undefined && typeof elem.onEject === 'function') {
			elem.onEject();
		}
		if ('children' in elem && elem.children !== undefined && Array.isArray(elem.children)) {
			elem.children.forEach(e => recursivelyEject(e));
		}
	}
}

function hydrateIsolates(elem: PromptNode, tokenizer: UsableTokenizer): Promise<void> | undefined {
	if (elem === undefined || elem === null || elem === false) {
		return;
	}
	if (Array.isArray(elem)) {
		const results = elem.map(e => hydrateIsolates(e, tokenizer));
		if (results.some(r => r !== undefined)) {
			return Promise.all(results.filter(r => r !== undefined)).then(() => { });
		} else {
			return undefined;
		}
	}
	if (typeof elem === 'string') {
		return;
	}
	if (typeof elem === 'number') {
		return;
	}
	switch (elem.type) {
		case 'first': {
			return hydrateIsolates(elem.children, tokenizer);
		}
		case 'capture':
		case 'empty':
		case 'breaktoken':
		case 'functionDefinition': {
			return;
		}
		case 'isolate': {
			// check if we have a cached prompt
			if (elem.cachedRenderOutput === undefined) {
				const promise = (async () => {
					elem.cachedRenderOutput = await render(elem.children, {
						tokenizer,
						tokenLimit: elem.tokenLimit,
					})
				})();
				return promise;
			}
			return;
		}
		case 'chat': {
			return hydrateIsolates(elem.children, tokenizer);
		}
		case 'scope': {
			return hydrateIsolates(elem.children, tokenizer);
		}
	}
}

// WARNING: do not attempt to make this function async!!! it will make it a lot slower!
function renderWithLevel(elem: PromptNode, level: number, tokenizer: UsableTokenizer, callEjectedCallback?: boolean): {
	prompt: RenderedPrompt | undefined;
	emptyTokenCount: number;
	outputHandlers: OutputHandler<ChatCompletionResponseMessage>[];
	streamHandlers: OutputHandler<AsyncIterable<ChatCompletionResponseMessage>>[];
} {
	if (elem === undefined || elem === null || elem === false) {
		return {
			prompt: undefined,
			emptyTokenCount: 0,
			outputHandlers: [],
			streamHandlers: []
		};
	}
	if (Array.isArray(elem)) {
		const results = elem.map(e => renderWithLevel(e, level, tokenizer, callEjectedCallback));
		return results.reduce((a, b) => {
			return {
				prompt: sumPrompts(a.prompt, b.prompt),
				emptyTokenCount: a.emptyTokenCount + b.emptyTokenCount,
				outputHandlers: a.outputHandlers.concat(b.outputHandlers),
				streamHandlers: a.streamHandlers.concat(b.streamHandlers)
			};
		}, {
			prompt: undefined,
			emptyTokenCount: 0,
			outputHandlers: [],
			streamHandlers: []
		});
	}
	if (typeof elem === 'string') {
		return {
			prompt: elem,
			emptyTokenCount: 0,
			outputHandlers: [],
			streamHandlers: []
		};
	}
	if (typeof elem === 'number') {
		return {
			prompt: elem.toString(),
			emptyTokenCount: 0,
			outputHandlers: [],
			streamHandlers: []
		};
	}
	switch (elem.type) {
		case 'first': {
			for (const child of elem.children) {
				if (child.absolutePriority === undefined) {
					throw new Error(`BUG!! computePriorityLevels should have set absolutePriority for all children of first`);
				}
				if (child.absolutePriority >= level) {
					elem.onInclude?.();
					return renderWithLevel(child, level, tokenizer, callEjectedCallback);
				} else if (callEjectedCallback === true) {
					recursivelyEject(child);
				}
			}
			// nothing returned from first, which is ok
			return {
				prompt: undefined,
				emptyTokenCount: 0,
				outputHandlers: [],
				streamHandlers: []
			};
		}
		case 'capture': {
			return {
				prompt: undefined,
				emptyTokenCount: 0,
				outputHandlers: elem.onOutput ? [
					elem.onOutput
				] : [],
				streamHandlers: elem.onStream ? [
					elem.onStream
				] : []
			}
		}
		case 'breaktoken': {
			return {
				prompt: ['', ''],
				emptyTokenCount: 0,
				outputHandlers: [],
				streamHandlers: []
			}
		}
		case 'empty': {
			return {
				prompt: undefined,
				emptyTokenCount: elem.tokenCount,
				outputHandlers: [],
				streamHandlers: []
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
				emptyTokenCount: 0,
				outputHandlers: [],
				streamHandlers: []
			}
		}
		case 'isolate': {
			// check if we have a cached prompt
			if (elem.cachedRenderOutput === undefined) {
				// throw error! we need to hydrate the isolates first!
				throw new Error(`BUG!! Isolates should have been hydrated before calling renderWithLevelAndEarlyExitWithTokenEstimation`);
			}
			return {
				prompt: elem.cachedRenderOutput.prompt,
				emptyTokenCount: elem.cachedRenderOutput.tokensReserved,
				outputHandlers: elem.cachedRenderOutput.outputHandlers,
				streamHandlers: elem.cachedRenderOutput.streamHandlers
			}
		}
		case 'chat': {
			const p = renderWithLevel(elem.children, level, tokenizer, callEjectedCallback);
			if (isChatPrompt(p.prompt)) {
				throw new Error(`Incorrect prompt: we have nested chat messages, which is not allowed!`);
			}

			let message: ChatPromptMessage;
			if (elem.role === 'user' || elem.role === 'system') {
				message = {
					role: elem.role,
					name: elem.name,
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
				outputHandlers: p.outputHandlers,
				streamHandlers: p.streamHandlers
			}
		}
		case 'scope': {
			if (elem.absolutePriority === undefined) {
				throw new Error(`BUG!! computePriorityLevels should have set absolutePriority for all scopes`);
			}
			if (elem.absolutePriority >= level) {
				elem.onInclude?.();
				return renderWithLevel(elem.children, level, tokenizer, callEjectedCallback);
			} else if (callEjectedCallback === true) {
				recursivelyEject(elem);
			}

			return {
				prompt: undefined,
				emptyTokenCount: 0,
				outputHandlers: [],
				streamHandlers: []
			}
		}
	}
}

// TODO: make this into eslint rules so they can be shown in the IDE
function validateUnrenderedPrompt(elem: PromptNode): void {
	validateNoChildrenHigherPriorityThanParent(elem);

	// print a warning if any scope has both an absolute and relative priority
	validateNotBothAbsoluteAndRelativePriority(elem);
}


function validateNotBothAbsoluteAndRelativePriority(elem: PromptNode): void {
	if (Array.isArray(elem)) {
		elem.forEach(e => validateNotBothAbsoluteAndRelativePriority(e));
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
		case 'isolate':
		case 'first': {
			validateNotBothAbsoluteAndRelativePriority(elem.children);
			return;
		}
		case 'capture':
		case 'breaktoken':
		case 'functionDefinition':
		case 'empty': {
			return;
		}
		case 'scope': {
			if (elem.absolutePriority !== undefined && elem.relativePriority !== undefined) {
				console.warn(`Priompt WARNING: scope has both absolute and relative priority.This is discouraged.Ignoring relative priority.`);
			}
			validateNotBothAbsoluteAndRelativePriority(elem.children);
			return;
		}
	}
}

function validateNoChildrenHigherPriorityThanParent(elem: PromptNode, parentPriority: number = BASE_PRIORITY): void {
	if (Array.isArray(elem)) {
		elem.forEach(e => validateNoChildrenHigherPriorityThanParent(e, parentPriority));
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
			validateNoChildrenHigherPriorityThanParent(elem.children, parentPriority);
			return;
		}
		case 'isolate': {
			// we explicitly do not send in the parent priority because the isolate is isolated!!
			validateNoChildrenHigherPriorityThanParent(elem.children);
			return;
		}
		case 'capture':
		case 'breaktoken':
		case 'functionDefinition':
		case 'empty': {
			return;
		}
		case 'scope': {
			const priority = computePriority(elem, parentPriority);
			if (priority > parentPriority) {
				console.warn(`Priompt WARNING: child scope has a higher priority(${priority}) than its parent(${parentPriority}).This is discouraged, because the child will only be included if the parent is, and thus the effective priority of the child is just the parent's priority.`);
			}
			validateNoChildrenHigherPriorityThanParent(elem.children, priority);
			return;
		}
	}
}

function computePriority(elem: Scope | NormalizedScope, parentPriority: number) {
	return elem.absolutePriority ?? (parentPriority + (elem.relativePriority ?? 0));
}

type AnyNode = NormalizedNode | PromptNode;

function computePriorityLevels(elem: AnyNode, parentPriority: number, levels: Set<number>): void {
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
			// just do it for children
			computePriorityLevels(elem.children, parentPriority, levels);
			return;
		}
		case 'capture':
		case 'functionDefinition':
		case 'breaktoken':
		case 'empty': {
			// nothing happens
			return;
		}
		case 'isolate': {
			// nothing happens because we fully re-render
			return;
		}
		case 'scope': {
			// compute the priority of this scope
			// the absolutePriority takes precedence over the relativePriority
			const priority = computePriority(elem, parentPriority);
			levels.add(priority);
			// we make the elem have this priority, so that we don't need to redo the priority calculation
			elem.absolutePriority = priority;
			// then for children
			computePriorityLevels(elem.children, priority, levels);
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

async function numTokensPromptString(p: PromptString, tokenizer: UsableTokenizer): Promise<number> {
	if (Array.isArray(p)) {
		// should be tokenized independently!!!!!!!
		const t = await Promise.all(p.map(s => numTokens(s, { tokenizer })));
		return t.reduce((a, b) => a + b, 0);
	}
	return numTokens(p, { tokenizer });
}


async function countTokensExact(tokenizer: UsableTokenizer, prompt: RenderedPrompt, options: {
	lastMessageIsIncomplete?: boolean;
}): Promise<number> {
	let tokens = 0;
	if (isPlainPrompt(prompt)) {
		tokens += await numTokensPromptString(prompt, tokenizer);
	} else if (isChatPrompt(prompt)) {
		const msgTokens = await Promise.all(prompt.messages.map(msg => countMessageTokens(msg, tokenizer)));
		// docs here: https://platform.openai.com/docs/guides/chat/introduction
		tokens += msgTokens.reduce((a, b) => a + b, 0) + CHATML_PROMPT_EXTRA_TOKEN_COUNT_LINEAR_FACTOR * (prompt.messages.length) + CHATML_PROMPT_EXTRA_TOKEN_COUNT_CONSTANT;
		if (options.lastMessageIsIncomplete === true) {
			// one for the <|im_end|>
			tokens = tokens - (CHATML_PROMPT_EXTRA_TOKEN_COUNT_CONSTANT + 1);
		}
	} else {
		tokens += await numTokensPromptString(prompt.text, tokenizer);
	}
	if (promptHasFunctions(prompt)) {
		// we assume an extra 2 tokens per function
		const functionTokens = await Promise.all(prompt.functions.map(async (func) => {
			return await countFunctionTokens(func, tokenizer) + 2;
		}));
		tokens += functionTokens.reduce((a, b) => a + b, 0);
	}
	return tokens;
}

export function promptToOpenAIChatRequest(prompt: RenderedPrompt): { messages: Array<ChatCompletionRequestMessage>; functions: ChatCompletionFunctions[] | undefined } {
	const functions = promptHasFunctions(prompt) ? prompt.functions : undefined;
	const messages = promptToOpenAIChatMessages(prompt);
	return {
		messages,
		functions
	};
}

const CL100K_SYSTEM_TOKENS = [100264, 9125, 100266];
const CL100K_USER_TOKENS = [100264, 882, 100266];
const CL100K_ASSISTANT_TOKENS = [100264, 78191, 100266];
const CL100K_END_TOKEN = [100265];

async function injectName(tokens: number[], name: string): Promise<number[]> {
	// i don't really know if this is the right way to format it....
	const nameTokens = await tokenizerObject.encodeCl100KNoSpecialTokens(":" + name);
	return [...tokens.slice(0, -1), ...nameTokens, tokens[tokens.length - 1]];
}

export async function promptToTokens(prompt: RenderedPrompt, tokenizer: UsableTokenizer): Promise<number[]> {
	if (tokenizer !== 'cl100k_base') {
		throw new Error("promptToTokens only supports the cl100k_base tokenizer for now!")
	}
	if (isPlainPrompt(prompt)) {
		// we should just encode it as a plain prompt!
		if (Array.isArray(prompt)) {
			const tokens = await Promise.all(prompt.map(s => tokenizerObject.encodeCl100KNoSpecialTokens(s)));
			return tokens.reduce((a, b) => a.concat(b), []);
		}
		return tokenizerObject.encodeCl100KNoSpecialTokens(prompt);
	} else if (isChatPrompt(prompt)) {
		// THIS IS HYPERSPECIFIC TO CL100K

		const parts = await Promise.all(prompt.messages.map(async (msg) => {
			if (msg.role === 'function') {
				// let's just throw
				throw new Error(`BUG!! promptToTokens got a chat prompt with a function message, which is not supported yet!`);
			} else if (msg.role === 'assistant' && msg.functionCall !== undefined) {
				throw new Error(`BUG!! promptToTokens got a chat prompt with a function message, which is not supported yet!`);
			} else {
				let headerTokens =
					msg.role === 'assistant' ? CL100K_ASSISTANT_TOKENS : msg.role === 'system' ? CL100K_SYSTEM_TOKENS : CL100K_USER_TOKENS;
				if ('name' in msg && msg.name !== undefined) {
					headerTokens = await injectName(headerTokens, msg.name);
				}
				return [
					...headerTokens,
					...(msg.content !== undefined ? (await promptToTokens(msg.content, tokenizer)) : []),
				];
			}
		}));
		const final: number[] = [];
		for (const part of parts) {
			if (final.length > 0) {
				final.push(...CL100K_END_TOKEN);
			}
			final.push(...part);
		}
		return final;
	}
	throw new Error(`BUG!! promptToTokens got an invalid prompt`);
}

export function promptToOpenAIChatMessages(prompt: RenderedPrompt): Array<ChatCompletionRequestMessage> {
	if (isPlainPrompt(prompt)) {
		return [
			{
				role: 'user',
				content: promptStringToString(prompt)
			}
		];
	} else if (isChatPrompt(prompt)) {
		return prompt.messages.map(msg => {
			if (msg.role === 'function') {
				return {
					role: msg.role,
					name: msg.name,
					content: promptStringToString(msg.content),
				}
			} else if (msg.role === 'assistant' && msg.functionCall !== undefined) {
				return {
					role: msg.role,
					content: msg.content !== undefined ? promptStringToString(msg.content) : "", // openai is lying when they say this should not be provided
					function_call: msg.functionCall,
				}
			} else {
				return {
					role: msg.role,
					content: msg.content !== undefined ? promptStringToString(msg.content) : "",
					name: 'name' in msg ? msg.name : undefined,
				}
			}
		});
	}
	throw new Error(`BUG!! promptToOpenAIChatMessagesgot an invalid prompt`);
}

async function countMessageTokens(message: ChatPromptMessage, tokenizer: UsableTokenizer): Promise<number> {
	if (message.role === 'function') {
		// add an extra 2 tokens for good measure
		return (await numTokens(message.name, { tokenizer })) + (await numTokensPromptString(message.content, tokenizer)) + 2;
	} else if (message.role === 'assistant' && message.functionCall !== undefined) {
		return (await countFunctionCallMessageTokens(message.functionCall, tokenizer)) + (message.content !== undefined ? (await numTokensPromptString(message.content, tokenizer)) : 0);
	} else {
		return await numTokensPromptString(message.content ?? "", tokenizer);
	}
}

async function countFunctionCallMessageTokens(functionCall: { name: string; arguments: string; }, tokenizer: UsableTokenizer): Promise<number> {
	// add some constant factor here because who knows what's actually going on with functions
	return (await numTokens(functionCall.name, { tokenizer })) + (await numTokens(functionCall.arguments, { tokenizer })) + 5;
}

async function countFunctionTokens(functionDefinition: ChatAndFunctionPromptFunction, tokenizer: UsableTokenizer): Promise<number> {
	// hmmmm how do we count these tokens? openai has been quite unclear
	// for now we JSON stringify and count tokens, and hope that that is reasonably close
	const stringifiedFunction = JSON.stringify({
		name: functionDefinition.name,
		description: functionDefinition.description,
		parameters: functionDefinition.parameters,
	}, null, 2);
	// we multiply by 1.5 and add 10 just to be safe until we've done more testing
	const raw = await numTokens(stringifiedFunction, { tokenizer });
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

function estimateLowerBoundTokensForPrompt(prompt: RenderedPrompt | undefined, tokenizer: UsableTokenizer): number {
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
				return a + estimateTokensUsingCharcount(b.content !== undefined ? promptStringToString(b.content) : "", tokenizer)[0];
			}
		}, 0);
	} else if (isPlainPrompt(prompt)) {
		contentTokens = estimateTokensUsingCharcount(promptStringToString(prompt), tokenizer)[0];
	} else {
		contentTokens = estimateTokensUsingCharcount(promptStringToString(prompt.text), tokenizer)[0];
	}

	const functionTokens = (promptHasFunctions(prompt) ? prompt.functions.reduce((a, b) => (a + estimateFunctionTokensUsingCharcount(b, tokenizer)[0]), 0) : 0);

	return contentTokens + functionTokens;
}