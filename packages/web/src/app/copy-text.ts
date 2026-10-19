/**
 * Puts a text on the clipboard: through the Clipboard API where the browser
 * allows it, else through a selected text box and the older copy command,
 * which works in more places. Says whether either worked.
 */
export async function copyText(text: string): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        return copyThroughSelection(text);
    }
}

function copyThroughSelection(text: string): boolean {
    const box = document.createElement("textarea");
    box.value = text;
    box.setAttribute("readonly", "");
    box.style.position = "fixed";
    box.style.opacity = "0";
    document.body.append(box);
    box.select();
    try {
        return document.execCommand("copy");
    } catch {
        return false;
    } finally {
        box.remove();
    }
}
