
// First picks out the first child (in order) that is prioritized enough

import { JSONSchema7 } from 'json-schema';
import { PriomptTokenizer, UsableTokenizer } from './tokenizer';
import { ChatCompletionResponseMessage, StreamChatCompletionResponse } from './openai';

export type FunctionBody = {
	name: string;
	description: string;
	parameters: JSONSchema7;
}

// It is a REQUIREMENT that the children have decreasing token counts
export type First = {
	type: 'first';
	children: Scope[];
	onEject?: () => void;
	onInclude?: () => void;
};

export type Empty = {
	type: 'empty';
	tokenCount: number | undefined;
	tokenFunction: ((tokenizer: (s: string) => Promise<number>) => Promise<number>) | undefined;
};

export type BreakToken = {
	type: 'breaktoken';
};

export type Capture = {
	type: 'capture';
} & CaptureProps;

export type Config = {
	type: 'config';
} & ConfigProps;

export type ConfigProps = {
	maxResponseTokens: number | "tokensReserved" | "tokensRemaining" | undefined;
	// at most 4 of these
	stop: string | string[] | undefined;
}

export type Isolate = {
	type: 'isolate';
	children: Node[];
	cachedRenderOutput?: RenderOutput;
} & IsolateProps;

export type ChatImage = {
	type: 'image';
} & ImageProps;

// TODO: make the Capture work for other kinds of completions that aren't chat and aren't openai
export type CaptureProps = {
	onOutput?: OutputHandler<ChatCompletionResponseMessage>;
	onStream?: OutputHandler<AsyncIterable<ChatCompletionResponseMessage>>;
	onStreamResponseObject?: OutputHandler<AsyncIterable<StreamChatCompletionResponse>>;
}

export type IsolateProps = {
	tokenLimit: number;
}

export type ImageProps = {
	bytes: Uint8Array;
	detail: 'low' | 'high' | 'auto';
	dimensions: {
		width: number;
		height: number;
	};

}

// the scope will exist iff the final priority is lower than the priority here
// it shouldn't be the case that both the relative priority and the absolute priority is set
export type Scope = {
	type: 'scope';
	children: Node[];
	// absolute priority takes precedence over relative priority
	absolutePriority: number | undefined;
	// relativePriority is relative to the parent of this scope
	// it should always be negative (or else it will not be displayed)
	relativePriority: number | undefined;
	name?: string;
	onEject?: () => void;
	onInclude?: () => void;
};

export type ChatUserSystemMessage = {
	type: 'chat';
	role: 'user' | 'system';
	name?: string;
	to?: string;
	children: Node[];
}

export type ChatAssistantFunctionToolCall = {
	type: 'function';
	function: {
		name: string;
		arguments: string; // json string
	}
}

export type ChatAssistantMessage = {
	type: 'chat';
	role: 'assistant';
	to?: string;
	children: Node[]; // can be empty!

	// the functionCall is provided by the assistant
	functionCall?: {
		name: string;
		arguments: string; // json string
	};

	// the toolCalls are provided by the assistant
	toolCalls?: {
		index: number;
		id: string;
		tool: ChatAssistantFunctionToolCall;
	}[]
}

export type ChatFunctionResultMessage = {
	type: 'chat';
	role: 'function';
	name: string;
	to?: string;
	children: Node[];
}

export type ChatToolResultMessage = {
	type: 'chat';
	role: 'tool';
	name: string;
	to?: string;
	children: Node[];
}

export type ChatMessage = ChatUserSystemMessage | ChatFunctionResultMessage | ChatToolResultMessage | ChatAssistantMessage;

export type FunctionDefinition = {
	type: 'functionDefinition';
	name: string;
	description: string;
	parameters: JSONSchema7;
}

export type ToolDefinition = {
	type: 'toolDefinition';
	tool: FunctionToolDefinition;
}

export type FunctionToolDefinition = {
	type: 'function';
	function: {
		name: string;
		description: string;
		parameters: JSONSchema7;
		strict?: boolean;
	}
}

export type Node = FunctionDefinition | ToolDefinition | BreakToken | First | Isolate | Capture | Config | Scope | Empty | ChatMessage | ChatImage | string | null | undefined | number | false;

export type PromptElement = Node[] | Node;

export type BaseProps = {
	// absolute priority takes precedence over relative priority
	// maximum supported priority level is 1e6
	p?: number;
	prel?: number;
	name?: string, // a label for debugging purposes
	// TODO: add a max (token count) here. the max functions as follows:
	// first we optimize over the outest token count scope. if any max exceeds its token count, it is capped to the token count. once we have a global solution we seek the local solution
	// this works, but leads to something that may be a little bit weird: something of priority 1000 in a maxed out scope is not included while something with a priority of 0 outside the maxed out scope is included. but that's fine. i guess the whole point of the max is to break the global opptimization
	children?: PromptElement[] | PromptElement;
	onEject?: () => void;
	onInclude?: () => void;
};

export type ReturnProps<T> = {
	onReturn: OutputHandler<T>;
}

type BasePromptProps<T = Record<never, never>> = (keyof T extends never ? BaseProps : BaseProps & T);
export type PromptProps<T = Record<never, never>, ReturnT = never> = ([ReturnT] extends [never] ? BasePromptProps<T> : BasePromptProps<T> & ReturnProps<ReturnT>);

export namespace JSX {
	interface IntrinsicElements {
		scope: BaseProps;
		br: Omit<BaseProps, 'children'>;
		hr: Omit<BaseProps, 'children'>;
		breaktoken: Omit<BaseProps, 'children'>;
		// automatically use a certain number of tokens (useful for leaving space for the model to give its answer)
		empty: BaseProps & { tokens: number | ((tokenizer: (s: string) => Promise<number>) => Promise<number>); };
		first: Omit<Omit<BaseProps, 'p'>, 'prel'>;
		capture: Omit<BaseProps, 'children'> & CaptureProps;
		isolate: BaseProps & IsolateProps;
		config: Omit<BaseProps, 'children'> & Partial<ConfigProps>;
	}
	type Element = PromptElement;
	interface ElementAttributesProperty {
		props: BaseProps; // specify the property name to use
	}
}

// if prompt string is a list of strings, then those strings should be tokenized independently
// this prevents tokens from crossing the boundary between strings, which is useful for things when you
// need exact copying
export type PromptString = string | string[];

export type PromptContentWrapper = {
	type: 'prompt_content',
	content: PromptString;
	images?: ImagePromptContent[];
}

export type TextPromptContent = {
	type: 'text',
	text: string
}
export type ImagePromptContent = {
	type: 'image_url',
	image_url: {
		url: string;
		detail: 'low' | 'high' | 'auto';
		dimensions: {
			width: number;
			height: number;
		}
	}
}
export type PromptContent = TextPromptContent | ImagePromptContent;

export type ChatPromptSystemMessage = {
	role: 'system';
	name?: string;
	to?: string | undefined;
	content: PromptString;
}

export type ChatPromptUserMessage = {
	role: 'user';
	name?: string;
	to?: string | undefined;
	content: PromptString;
	images?: ImagePromptContent[];
}

export type ChatPromptAssistantMessage = {
	role: 'assistant';
	to?: string | undefined;
	content?: PromptString;
	functionCall?: {
		name: string;
		arguments: string; // json string
	}
	toolCalls?: {
		index: number;
		id: string;
		tool: ChatAssistantFunctionToolCall;
	}[]
}

export type ChatPromptFunctionResultMessage = {
	role: 'function';
	name: string;
	to?: string | undefined;
	content: PromptString;
};

export type ChatPromptToolResultMessage = {
	role: 'tool';
	name?: string;
	to: string | undefined;
	content: PromptString;
};

export type ChatPromptMessage = ChatPromptSystemMessage | ChatPromptUserMessage | ChatPromptAssistantMessage | ChatPromptFunctionResultMessage | ChatPromptToolResultMessage;

export type ChatPrompt = {
	type: 'chat';
	messages: ChatPromptMessage[];
}

export type TextPrompt = {
	type: 'text';
	text: PromptString;
}

export type ChatAndFunctionPromptFunction = {
	name: string;
	description: string;
	parameters: JSONSchema7;
}

export type FunctionPrompt = {
	functions: ChatAndFunctionPromptFunction[];
}

// https://platform.openai.com/docs/api-reference/chat/create
export type ChatAndToolPromptToolFunction = {
	type: 'function';
	function: {
		name: string;
		description?: string;
		parameters?: JSONSchema7;
	}
}

export type ToolPrompt = {
	tools: ChatAndToolPromptToolFunction[];
}

// the p is used to specify the priority of the handler
// higher priority handler will be called first in case there are multiple
export type OutputHandler<T> = (output: T, options?: { p?: number }) => Promise<void>;

export type RenderedPrompt = PromptString | ChatPrompt | (ChatPrompt & FunctionPrompt) | (ChatPrompt & ToolPrompt) | (TextPrompt & FunctionPrompt) | (TextPrompt & ToolPrompt) | PromptContentWrapper;

export type Prompt<PropsT, ReturnT = never> = ((props: PromptProps<PropsT, ReturnT>) => (PromptElement | Promise<PromptElement>)) & {
	config?: PreviewConfig<PropsT, ReturnT>;
};
export type SynchronousPrompt<PropsT, ReturnT = never> = ((props: PromptProps<PropsT, ReturnT>) => (PromptElement)) & {
	config?: SynchronousPreviewConfig<PropsT, ReturnT>;
};

export type PreviewConfig<PropsT, ReturnT = never> = {
	id: string;
	prompt: Prompt<PropsT, ReturnT>;
	// defaults to yaml but can be overridden
	dump?: (props: Omit<PropsT, "onReturn">) => string;
	hydrate?: (dump: string) => PropsT;
}

export type SynchronousPreviewConfig<PropsT, ReturnT = never> = {
	id: string;
	prompt: SynchronousPrompt<PropsT, ReturnT>;
	// defaults to yaml but can be overridden
	dump?: (props: Omit<PropsT, "onReturn">) => string;
	hydrate?: (dump: string) => PropsT;
	dumpExtension?: string;
}

// TODO: should the components have access to the token limit?
// argument against: no, it should all be responsive to the token limit and we shouldn't need this
// argument for: CSS has media queries because it is very hard to have something that's fully responsive without changing any of the layout
// decision: wait for now, see if it is needed
export type RenderOptions = {
	tokenLimit: number;
	tokenizer: PriomptTokenizer;
	countTokensFast_UNSAFE?: boolean;
	shouldBuildSourceMap?: boolean;

	// if it is, then we need to count tokens differently
	lastMessageIsIncomplete?: boolean;
};

export type RenderunCountTokensFast_UNSAFE = "try_retry" | "yes" | "no";

export type RenderunOptions = Omit<RenderOptions, 'countTokensFast_UNSAFE'> & {
	countTokensFast_UNSAFE?: RenderunCountTokensFast_UNSAFE;
};

// A sourcemap is an optional piece of data priompt can produce to map
// from prompt elements, e.g. the jsx tree, to the actual characters
// in the final prompt. This can be used to "blame" where cache misses
// which are character / token-wise correspond to in the prompt tree.
// Each sourcemap represents a node in the prompt tree and has a range
// as to the characters it represents (start and end) which are *relative*
// to the range of its parent. A leaf has undefined children, and leaves which
// are strings have `string` filled in for validation.
export type SourceMap = {
	name: string;
	children?: SourceMap[];
	string?: string,
	start: number;
	end: number;
}

export type AbsoluteSourceMap = Omit<SourceMap, 'children'> & {
	children?: AbsoluteSourceMap[];
	__brand: 'absolute';
}

export type RenderOutput = {
	prompt: RenderedPrompt;
	tokenCount: number;
	tokenLimit: number;
	tokenizer: PriomptTokenizer;
	tokensReserved: number;
	priorityCutoff: number;
	outputHandlers: OutputHandler<ChatCompletionResponseMessage>[];
	streamHandlers: OutputHandler<AsyncIterable<ChatCompletionResponseMessage>>[];
	streamResponseObjectHandlers: OutputHandler<AsyncIterable<StreamChatCompletionResponse>>[];
	config: ConfigProps;
	durationMs?: number;
	sourceMap?: SourceMap
};
