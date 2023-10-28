
// First picks out the first child (in order) that is prioritized enough

import { JSONSchema7 } from 'json-schema';
import { ChatCompletionResponseMessage } from 'openai';
import { UsableLanguageModel, UsableTokenizer } from './openai';

export type FunctionBody = {
	name: string;
	description: string;
	parameters: JSONSchema7;
}

// TODO: add a max (token count). the max functions as follows:
// first we optimize over the outest token count scope. if any max exceeds its token count, it is capped to the token count. once we have a global solution we seek the local solution
// this works, but leads to something that may be a little bit weird: something of priority 1000 in a maxed out scope is not included while something with a priority of 0 outside the maxed out scope is included. but that's fine. i guess the whole point of the max is to break the global opptimization

/**
 * Definitions of the props for prompt components
 */
type PriorityProps = {
	// absolute priority takes precedence over relative priority
	// maximum supported priority level is 1e6
	p?: number;
	prel?: number;
};

type CallbackProps = {
	onEject?: () => void;
	onInclude?: () => void;
};

export type FirstProps = {
	children: Scope[];
} & CallbackProps;

export type EmptyProps = {
	tokens: number;
} & PriorityProps;

export type BreakTokenProps = {} & PriorityProps;

export type CaptureProps = {
	onOutput?: OutputHandler<ChatCompletionResponseMessage>;
	onStream?: OutputHandler<AsyncIterable<ChatCompletionResponseMessage>>;
} & PriorityProps;

export type IsolateProps = {
	children: Node[];
	tokenLimit: number;
} & PriorityProps;

export type ScopeProps = {
	children: Node[];
} & PriorityProps & CallbackProps;

export type LineBreakProps = {} & PriorityProps;

export type HorizontalRuleProps = {} & PriorityProps;

type BaseProps = {
	children?: PromptElement[] | PromptElement;
} & PriorityProps;

export type ReturnProps<T> = {
	onReturn: OutputHandler<T>;
}

type BasePromptProps<T = Record<never, never>> = (keyof T extends never ? BaseProps : BaseProps & T);
export type PromptProps<T = Record<never, never>, ReturnT = never> = ([ReturnT] extends [never] ? BasePromptProps<T> : BasePromptProps<T> & ReturnProps<ReturnT>);

/**
 * Definitions of internal types for prompt components
 */
// It is a REQUIREMENT that the children have decreasing token counts
export type First = {
	type: 'first';
} & FirstProps;

export type Empty = {
	type: 'empty';
} & EmptyProps;

export type BreakToken = {
	type: 'breaktoken';
} & BreakTokenProps;

// TODO: make the Capture work for other kinds of completions that aren't chat and aren't openai
export type Capture = {
	type: 'capture';
} & CaptureProps;

export type Isolate = {
	type: 'isolate';
	cachedRenderOutput?: RenderOutput;
} & IsolateProps;

// the scope will exist iff the final priority is lower than the priority here
// it shouldn't be the case that both the relative priority and the absolute priority is set
export type Scope = {
	type: 'scope';
	// absolute priority takes precedence over relative priority
	absolutePriority: number | undefined;
	// relativePriority is relative to the parent of this scope
	// it should always be negative (or else it will not be displayed)
	relativePriority: number | undefined;
} & ScopeProps;

export type ChatUserSystemMessage = {
	type: 'chat';
	role: 'user' | 'system';
	children: Node[];
};

export type ChatAssistantMessage = {
	type: 'chat';
	role: 'assistant';
	children: Node[]; // can be empty!

	// the functionCall is provided by the assistant
	functionCall?: {
		name: string;
		arguments: string; // json string
	};
};

export type ChatFunctionResultMessage = {
	type: 'chat';
	role: 'function';
	name: string;
	children: Node[];
};

export type ChatMessage = ChatUserSystemMessage | ChatFunctionResultMessage | ChatAssistantMessage;

export type FunctionDefinition = {
	type: 'functionDefinition';
	name: string;
	description: string;
	parameters: JSONSchema7;
};

export type Node = FunctionDefinition | BreakToken | First | Isolate | Capture | Scope | Empty | ChatMessage | string | null | undefined | number | false;

export type PromptElement = Node[] | Node;


export namespace JSX {
	interface IntrinsicElements {
		scope: ScopeProps;
		br: LineBreakProps;
		hr: HorizontalRuleProps;
		breaktoken: BreakTokenProps;
		// automatically use a certain number of tokens (useful for leaving space for the model to give its answer)
		empty: EmptyProps;
		first: FirstProps;
		capture: CaptureProps;
		isolate: IsolateProps;
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

export type ChatPromptUserSystemMessage = {
	role: 'user' | 'system';
	content: PromptString;
}

export type ChatPromptAssistantMessage = {
	role: 'assistant';
	content?: PromptString;
	functionCall?: {
		name: string;
		arguments: string; // json string
	}
}

export type ChatPromptFunctionResultMessage = {
	role: 'function';
	name: string;
	content: PromptString;
};

export type ChatPromptMessage = ChatPromptUserSystemMessage | ChatPromptAssistantMessage | ChatPromptFunctionResultMessage;

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

// the p is used to specify the priority of the handler
// higher priority handler will be called first in case there are multiple
export type OutputHandler<T> = (output: T, options?: { p?: number }) => Promise<void>;

export type RenderedPrompt = PromptString | ChatPrompt | (ChatPrompt & FunctionPrompt) | (TextPrompt & FunctionPrompt);

export type Prompt<PropsT, ReturnT = never> = (props: PromptProps<PropsT, ReturnT>) => PromptElement;

// TODO: should the components have access to the token limit?
// argument against: no, it should all be responsive to the token limit and we shouldn't need this
// argument for: CSS has media queries because it is very hard to have something that's fully responsive without changing any of the layout
// decision: wait for now, see if it is needed
export type RenderOptions = {
	model?: UsableLanguageModel;
	tokenLimit?: number;
	tokenizer?: UsableTokenizer;

	// if it is, then we need to count tokens differently
	lastMessageIsIncomplete?: boolean;
};
export type RenderOutput = {
	prompt: RenderedPrompt;
	tokenCount: number;
	tokenLimit: number;
	tokenizer: UsableTokenizer;
	tokensReserved: number;
	priorityCutoff: number;
	outputHandlers: OutputHandler<ChatCompletionResponseMessage>[];
	streamHandlers: OutputHandler<AsyncIterable<ChatCompletionResponseMessage>>[];
	durationMs?: number;
};