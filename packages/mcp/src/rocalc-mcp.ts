#!/usr/bin/env node
// The Model Context Protocol server over standard input and output: one JSON message per line.
import { createInterface } from "node:readline";
import { answerLine } from "./mcp-server.ts";
import { createToolContext } from "./tools.ts";

const context = createToolContext();
let lastAnswer: Promise<void> = Promise.resolve();

// One message at a time, in the order they came: the engine does one calculation at a time.
createInterface({ input: process.stdin }).on("line", (line) => {
    lastAnswer = lastAnswer.then(async () => {
        const answer = await answerLine(line, context);
        if (answer !== undefined) {
            process.stdout.write(`${answer}\n`);
        }
    });
});
