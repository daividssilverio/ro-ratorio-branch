const integerFormat = new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 0 });
const zenyPerMillion = 1_000_000;
const minusSign = "−";

export function formatInteger(value: number): string {
    return integerFormat.format(Math.round(value)).replace("-", minusSign);
}

/** A signed whole number: `+91,700`, `−1,200`, `±0`. */
export function formatSignedInteger(value: number): string {
    const rounded = Math.round(value);
    if (rounded === 0) {
        return "±0";
    }
    return `${rounded > 0 ? "+" : minusSign}${integerFormat.format(Math.abs(rounded))}`;
}

/** A signed share of a base value, to one decimal: `+23.7%`. Empty when the base is 0. */
export function formatSignedPercent(difference: number, base: number): string {
    if (base === 0) {
        return "";
    }
    const percent = (difference / base) * 100;
    const rounded = Math.round(percent * 10) / 10;
    if (rounded === 0) {
        return "±0%";
    }
    return `${rounded > 0 ? "+" : minusSign}${Math.abs(rounded).toFixed(1)}%`;
}

export function formatSeconds(seconds: number): string {
    return seconds.toFixed(2);
}

/** A signed difference in seconds: `−3.97s`. */
export function formatSignedSeconds(difference: number): string {
    const rounded = Math.round(difference * 100) / 100;
    if (rounded === 0) {
        return "±0s";
    }
    return `${rounded > 0 ? "+" : minusSign}${Math.abs(rounded).toFixed(2)}s`;
}

/** Zeny in the unit players quote: `335M`, `2.5M`, `450k`, `0`. */
export function formatZeny(zeny: number): string {
    if (zeny >= zenyPerMillion) {
        const millions = zeny / zenyPerMillion;
        return `${Number.isInteger(millions) ? millions : millions.toFixed(1)}M`;
    }
    if (zeny >= 1000) {
        return `${Math.round(zeny / 1000)}k`;
    }
    return String(zeny);
}
