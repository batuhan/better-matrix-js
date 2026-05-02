# @better-matrix-js/ai-sdk

Pipe an [AI SDK](https://sdk.vercel.ai) UI message stream straight into a Matrix message via [`@better-matrix-js/chat-adapter`](https://github.com/batuhan/better-matrix-js/tree/main/packages/chat-adapter).

```sh
npm install @better-matrix-js/ai-sdk @better-matrix-js/chat-adapter
```

## Usage

```ts
import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";
import { fromAIStreamResult } from "@better-matrix-js/ai-sdk";

bot.onNewMention(async (thread, message) => {
  await thread.subscribe();

  const result = streamText({
    model: openai("gpt-4o"),
    prompt: message.text,
  });

  await matrix.stream(
    matrix.encodeThreadId({ roomId: message.raw.roomId }),
    fromAIStreamResult(result),
  );
});
```

## API

```ts
fromAIStreamResult(result)          // anything with .toUIMessageStream()
fromAIUIMessageStream(stream)       // already have a UI message stream?
isAIUIMessageStreamResult(value)    // type guard
```

All three return a `MatrixStream` you can hand to `matrix.stream()`. The chat adapter takes care of debounced edits — or native streaming events on Beeper.

This package is split out so the chat adapter doesn't pull the AI SDK in unless you need it.

## License

MIT
