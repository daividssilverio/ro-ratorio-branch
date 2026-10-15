// Runs inside the hidden frame. The frame has a document of its own, which the
// engine needs while it loads, and it keeps the engine's globals out of the app.
import { loadRatorioEngineWhereDomExists } from "@ro-ratorio-branch/core/browser";
import { handleHostRequest } from "./handle-host-request.ts";
import { type HostResponse, isHostRequest } from "./host-protocol.ts";

const engine = await loadRatorioEngineWhereDomExists();
const answer = (response: HostResponse) => window.parent.postMessage(response, window.location.origin);

window.addEventListener("message", (event) => {
    if (event.source !== window.parent || event.origin !== window.location.origin || !isHostRequest(event.data)) {
        return;
    }
    void handleHostRequest(engine, event.data).then(answer);
});

answer({ kind: "ready" });
