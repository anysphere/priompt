**Run `pnpm priompt` in the server folder to preview and test your prompts.**

Priompt (_priority + prompt_) is a Solid-inspired JSX prompting library with a focus on priorities.

Everything is rendered only once. Each child has a priority (generally 0 to 1000, but can be any real number), where a higher priority means that the child is more important to include in the prompt.

Caveats: Do not create scopes that are too small! for decent speed. Usually at least 10 characters per scope.
