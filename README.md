# Priompt

Priompt (_priority + prompt_) is a JSX-based prompting library. It uses priorities to decide what to include in the context window.

Priompt is an attempt at a _prompt design_ library, inspired by web design libraries like React. Read more about the motivation [here](https://arvid.xyz/prompt-design).

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

A component is rendered only once. Each child has a priority, where a higher priority means that the child is more important to include in the prompt. If no priority is specified, the child is never removed from its parent. Absolute priorities are specified with `p` and relative ones are specified with `prel`.

In the example above, we always include the system message and the latest user message, and are including as many messages from the history as possible, where later messages are prioritized over earlier messages.

The key promise of the priompt renderer is:

> **Let $T$ be the token limit and $\text{Prompt}(p_\text{cutoff})$ be the function that creates a prompt by including all scopes with priority $p_\text{scope} \geq p_\text{cutoff}$, and no other. Then, the rendered prompt is $\text{\textbf{P}} = \text{Prompt}(p_\text{cutoff}^*)$ where $p_\text{cutoff}^*$ is the minimum value such that $|\text{Prompt}(p_\text{cutoff}^*)| \leq T$.**

The building blocks of a priompt prompt are:

1. `<scope>`: this allows you to set priorities `p` for absolute or `prel` for relative.
2. `<first>`: the first child with a sufficiently high priority will be included, and all children below it will not. This is useful for fallbacks for implementing something like "when the result is too long we want to say `(result omitted)`".

You can create components all you want, just like in React.

## Future

Some building blocks we're thinking of adding:

1. `<max>`: specify a `limit` on the number of tokens within a scope
2. `onExcluded={() => {...}}`: a callback for when a particular scope is excluded, which allows you to do things like "summarize this result when it doesn't fit in the prompt anymore".

We're also thinking about making a framework around Priompt for agents. It would look something like interactive web design but for agents, where `onClicks` are simulated by having the agent call a function. We would love ideas here!

## Caveats

1. We've discovered that adding priorities to everything is sort of an anti-pattern. It is possible that priorities are the wrong abstraction. We have found them useful for including long files in the prompt in a line-by-line way.
2. The prompt renderer has no builtin support for creating cacheable prompts. If you overuse priorities, it is easy to make hard-to-cache prompts, which may increase your cost or latency for LLM inference. We are interested in good solutions here, but for now it is up to the prompt designer to think about caching when writing the prompt.
3. The current version of priompt only supports around 10K scopes reasonably fast (this is enough for most use cases!). If you want to include a file in the prompt that is really long (>10K lines), and you split it line-by-line, you probably want to implement something like "for lines farther than 1000 lines away from the cursor position we have coarser scopes of 10 lines at a time".
4. For latency-critical prompts you want to monitor the time usage in the priompt preview dashboard. If there are too many scopes you may want to performance-optimize.
5. The priompt renderer is not always guaranteed to produce the perfect $p_\text{cutoff}^*$. For example, if a higher-priority child of a `<first>` has more tokens than a lower-priority child, the currently implemented binary search renderer may return a (very slightly) incorrect result.

## Contributions

Contributions are very welcome! This entire repo is MIT-licensed.
