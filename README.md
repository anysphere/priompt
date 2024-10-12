# Priompt

Priompt (_priority + prompt_) is a JSX-based prompting library. It uses priorities to decide what to include in the context window.

Priompt is an attempt at a _prompt design_ library, inspired by web design libraries like React. Read more about the motivation [here](https://arvid.xyz/prompt-design).

## Installation

Install from npm:

```bash
npm install @anysphere/priompt && npm install -D @anysphere/priompt-preview
```

or

```bash
yarn add @anysphere/priompt && yarn add --dev @anysphere/priompt-preview
```

or

```bash
pnpm add @anysphere/priompt && pnpm add -D @anysphere/priompt-preview
```

## Examples

Read [examples/README.md](examples/README.md) to run the examples.

## Principles

Prompts are rendered from a JSX component, which can look something like this:

```jsx
function ExamplePrompt(
  props: PromptProps<{
    name: string,
    message: string,
    history: { case: "user" | "assistant", message: string },
  }>
): PromptElement {
  const capitalizedName = props.name[0].toUpperCase() + props.name.slice(1);
  return (
    <>
      <SystemMessage>
        The user's name is {capitalizedName}. Please respond to them kindly.
      </SystemMessage>
      {props.history.map((m, i) => (
        <scope prel={-(props.history.length - i)}>
          {m.case === "user" ? (
            <UserMessage>{m.message}</UserMessage>
          ) : (
            <AssistantMessage>{m.message}</AssistantMessage>
          )}
        </scope>
      ))}
      <UserMessage>{props.message}</UserMessage>
      <empty tokens={1000} />
    </>
  );
}
```

A component is rendered only once. Each child has a priority, where a higher priority means that the child is more important to include in the prompt. If no priority is specified, the child is included if and only if its parent is included. Absolute priorities are specified with `p` and relative ones are specified with `prel`.

In the example above, we always include the system message and the latest user message, and are including as many messages from the history as possible, where later messages are prioritized over earlier messages.

The key promise of the priompt renderer is:

> Let $T$ be the token limit and $\text{Prompt}(p_\text{cutoff})$ be the function that creates a prompt by including all scopes with priority $p_\text{scope} \geq p_\text{cutoff}$, and no other. Then, the rendered prompt is $\text{\textbf{P}} = \text{Prompt}(p_\text{opt-cutoff})$ where $p_\text{opt-cutoff}$ is the minimum value such that $|\text{Prompt}(p_\text{opt-cutoff})| \leq T$.

The building blocks of a priompt prompt are:

1. `<scope>`: this allows you to set priorities `p` for absolute or `prel` for relative.
2. `<first>`: the first child with a sufficiently high priority will be included, and all children below it will not. This is useful for fallbacks for implementing something like "when the result is too long we want to say `(result omitted)`".
3. `<empty>`: for specifying empty space, useful for reserving tokens for generation.
4. `<capture>`: capture the output and parse it right within the prompt.
5. `<isolate>`: isolate a section of the prompt with its own token limit. This is useful for guaranteeing that the start of the prompt will be the same for caching purposes. it would be nice to extend this to allow token limits like `100% - 100`.
6. `<br/>`: force a token break at a particular location, which is useful for ensuring exact tokenization matches between two parts of a prompt (e.g. when implementing something like speculative edits).
7. `<config>`: specify a few common configuration properties, such as `stop` token and `maxResponseTokens`, which can make the priompt dump more self-contained and help with evals.

You can create components all you want, just like in React. The builtin components are:

1. `<UserMessage>`, `<AssistantMessage>` and `<SystemMessage>`: for building message-based prompts.
2. `<ImageComponent>`: for adding images into the prompt.
3. `<Tools>`, `<ZTools>`: for specifying tools that the AI can call, either using a JSON schema or a Zod type.

## Advanced features

1. `onEject` and `onInclude`: callbacks that can be passed into any scope, which are called when the scope is either excluded or included in the final prompt. This allows you to change your logic depending on if something is too large for the prompt.
2. Sourcemaps: when setting `shouldBuildSourceMap` to `true`, the renderer computes a map between the actual characters in the prompt and the part of the JSX tree that they came from. This can be useful to figure out where cache misses are coming from in the prompt.
3. Prepend `DO_NOT_DUMP` to your priompt props key to prevent it from being dumped, which is useful for really big objects.


## Future

A few things that would be cool to add:

1. A `<max>` block: specify a `limit` on the number of tokens within a scope, but unlike `<isolate>`, include the inner scopes in the global priority calculation.
2. Performance-optimized rendering of big trees: minimizing time spent tokenizing is part of it, but part of it is also working around JavaScript object allocation, and it is possible that writing the entire rendering engine in Rust, for example, would make it a lot faster.

## Caveats

1. We've discovered that adding priorities to everything is sort of an anti-pattern. It is possible that priorities are the wrong abstraction. We have found them useful though for including long files in the prompt in a line-by-line way.
2. The Priompt renderer has no builtin support for creating cacheable prompts. If you overuse priorities, it is easy to make hard-to-cache prompts, which may increase your cost or latency for LLM inference. We are interested in good solutions here, but for now it is up to the prompt designer to think about caching.
   1. *Update: Priompt sourcemaps help with caching debugging!*
3. The current version of priompt only supports around 10K scopes reasonably fast (this is enough for most use cases). If you want to include a file in the prompt that is really long (>10K lines), and you split it line-by-line, you probably want to implement something like "for lines farther than 1000 lines away from the cursor position we have coarser scopes of 10 lines at a time".
4. For latency-critical prompts you want to monitor the time usage in the priompt preview dashboard. If there are too many scopes you may want to optimize for performance.
5. The Priompt renderer is not always guaranteed to produce the perfect $p_\text{opt-cutoff}$. For example, if a higher-priority child of a `<first>` has more tokens than a lower-priority child, the currently implemented binary search renderer may return a (very slightly) incorrect result.

## Contributions

Contributions are very welcome! This entire repo is MIT-licensed.
