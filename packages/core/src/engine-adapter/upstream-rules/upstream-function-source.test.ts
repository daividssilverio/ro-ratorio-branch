import { describe, expect, it } from "vitest";
import { fingerprintOf, sourceOfFunction } from "./upstream-function-source.ts";

const fileText = `
import { thing } from "./thing.js";
export function First(a, b) {
	if (a) { return "}"; } // } not a closing brace
	/* { nor this */
	return \`\${b}}\`;
}
function Second() {
	First(1, 2);
	return { nested: { deep: 1 } };
}
export class Panel {
	rebuildAll () {
		for (const x of []) { x; }
	}
	static async other() { return 2; }
}
`;

describe("sourceOfFunction", () => {
    it("takes an exported function up to its own closing brace, past braces in strings and comments", () => {
        const source = sourceOfFunction(fileText, "First");

        expect(source?.startsWith("First(a, b) {")).toBe(true);
        expect(source?.endsWith("return `${b}}`;\n}")).toBe(true);
    });

    it("takes a plain function with nested braces, and a class method", () => {
        expect(sourceOfFunction(fileText, "Second")).toBe("Second() {\n\tFirst(1, 2);\n\treturn { nested: { deep: 1 } };\n}");
        expect(sourceOfFunction(fileText, "rebuildAll")).toBe("rebuildAll () {\n\t\tfor (const x of []) { x; }\n\t}");
        expect(sourceOfFunction(fileText, "other")).toBe("other() { return 2; }");
    });

    it("gives nothing for a function the file does not declare", () => {
        expect(sourceOfFunction(fileText, "Third")).toBeUndefined();
        expect(sourceOfFunction(fileText, "thing")).toBeUndefined();
    });
});

describe("fingerprintOf", () => {
    it("is the same for the same code laid out differently, and different for different code", () => {
        expect(fingerprintOf("function a() {\n\treturn 1;\n}")).toBe(fingerprintOf("function a() { return 1; }"));
        expect(fingerprintOf("function a() { return 1; }")).not.toBe(fingerprintOf("function a() { return 2; }"));
        expect(fingerprintOf("x")).toMatch(/^[0-9a-f]{16}$/);
    });
});
