# priompt examples

a few examples showing how to use `priompt` and `priompt-preview`.

somewhat useful for testing random prompts

this example uses `fastify` for the server, but any server library or framework should work

## running

Make sure you've run `./init.sh` in the root directory and configured your OpenAI key in `.env`.

First: `pnpm i`

In one terminal: `pnpm priompt`

In another: `pnpm watch`

In a third: `curl 'localhost:8000/message?message=what%20is%20the%20advantage%20of%20rust%20over%20c&name=a%20curious%20explorer'`

You should get a response within a few seconds.

Go to `localhost:6283` to see the prompt in the priompt preview.
