**Run `pnpm priompt` in the server folder to preview and test your prompts.**

Priompt (_priority + prompt_) is a Solid-inspired JSX prompting library with a focus on priorities.

Everything is rendered only once. Each child has a priority (generally 0 to 1000, but can be any real number), where a higher priority means that the child is more important to include in the prompt.

The key promise of the priompt render compiler is:

> **Let $T$ be the token limit and $\text{Prompt}(p_\text{cutoff})$ be the function that creates a prompt by including all scopes with priority $p_\text{scope} \geq p_\text{cutoff}$, and no other. Then, the rendered prompt is $\text{\textbf{P}} = \text{Prompt}(p_\text{cutoff}^*)$ where $p_\text{cutoff}^*$ is the minimum value such that $|\text{Prompt}(p_\text{cutoff}^*)| \leq T$.**

The building blocks of a priompt prompt are:

1. `<scope>`: this allows you to set priorities `p` for absolute or `prel` for relative.
2. `<first>`: the first child with a sufficiently high priority will be included, and all children below it will not. This is useful for fallbacks for implementing something like "when the result is too long we want to say `(result omitted)`".

You can create components all you want, just like in React.

Some building blocks we're thinking of adding:

1. `<max>`: specify a `limit` on the number of tokens within a scope
2. `onExcluded={() => {...}}`: a callback for when a particular scope is excluded, which allows you to do things like "summarize this result when it doesn't fit in the prompt anymore".

## Caveats

1. The current version of priompt only supports around 10K scopes reasonably fast. If you have a really long file and you split it line-by-line, you probably want to implement something like "for lines farther than 1000 lines away from the cursor position we have scopes of 10 lines at a time".
2. For latency-critical prompts you want to monitor the time usage in the priompt preview dashboard. If there are too many scopes you may want to performance-optimize.

## Bugs

(probably a lot of them, but none here yet)
