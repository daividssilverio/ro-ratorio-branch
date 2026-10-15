import { Window } from "happy-dom";

const windowSelfReferenceNames = ["window", "self", "top", "parent", "frames"];

let browserGlobalsInstalled = false;

/**
 * Gives Node the browser globals the ratorio engine reads at import time.
 *
 * Names Node already defines keep Node's value: happy-dom ships its own
 * `Object`, `Array`, `Promise` and friends, and replacing Node's with them
 * aborts the process.
 */
export function installBrowserGlobals(): void {
    if (browserGlobalsInstalled) {
        return;
    }
    const browserWindow = new Window({ url: "http://localhost/" });

    for (const name of windowSelfReferenceNames) {
        defineGlobal(name, globalThis);
    }
    for (const name of collectPropertyNames(browserWindow)) {
        if (name in globalThis) {
            continue;
        }
        const value: unknown = Reflect.get(browserWindow, name);
        const isInheritedMethod = typeof value === "function" && !Object.hasOwn(browserWindow, name);
        defineGlobal(name, isInheritedMethod ? value.bind(browserWindow) : value);
    }
    browserGlobalsInstalled = true;
}

function collectPropertyNames(browserWindow: Window): Set<string> {
    const propertyNames = new Set<string>();
    for (
        let owner: object | null = browserWindow;
        owner !== null && owner !== Object.prototype;
        owner = Object.getPrototypeOf(owner)
    ) {
        for (const name of Object.getOwnPropertyNames(owner)) {
            propertyNames.add(name);
        }
    }
    propertyNames.delete("constructor");
    return propertyNames;
}

function defineGlobal(name: string, value: unknown): void {
    Object.defineProperty(globalThis, name, {
        configurable: true,
        writable: true,
        enumerable: false,
        value,
    });
}
