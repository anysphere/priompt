# priompt examples

a few examples showing how to use `priompt` and `priompt-preview`.

somewhat useful for testing random prompts

this example uses `fastify` for the server, but any server library or framework should work

## running

First run:

```bash
cd .. && ./init.sh
```

Then configure your OpenAI key in `.env`.

In one terminal:

```bash
pnpm priompt
```

In another:

```bash
pnpm watch
```

In a third:

```bash
curl 'localhost:8008/message?message=what%20is%20the%20advantage%20of%20rust%20over%20c&name=a%20curious%20explorer'
```

You should get a response within a few seconds.

Go to [localhost:6284](http://localhost:6284) to see the prompt in the priompt preview.
