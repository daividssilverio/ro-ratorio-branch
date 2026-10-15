#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { runRocalc } from "./run-rocalc.ts";

process.exitCode = await runRocalc(process.argv.slice(2), {
    readTextFile: (filePath) => readFile(filePath, "utf8"),
    writeResult: (text) => process.stdout.write(text),
    writeFailure: (text) => process.stderr.write(text),
});
