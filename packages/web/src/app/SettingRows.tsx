import { CommittedNumberField } from "./CommittedFields.tsx";
import { controlOf, type SettingRow, valueAtPlace, valueChoicesOf, withValueAtPlace } from "./settings-editor-model.ts";

interface SettingRowsProps<Holder extends object> {
    readonly rows: readonly SettingRow[];
    /** The character or scenario the rows read from and write to. */
    readonly holder: Holder;
    onChange(holder: Holder): void;
    /** The rows to mark, by key, and the word to mark them with: the learned skills that worn gear does something more for. */
    readonly marked?: { readonly keys: ReadonlySet<string>; readonly label: string };
}

/** One line per setting, with a switch, a dropdown or a number box, and a heading where a new group starts. */
export function SettingRows<Holder extends object>({ rows, holder, onChange, marked }: SettingRowsProps<Holder>) {
    return (
        <>
            {rows.map((row, rowIndex) => {
                const value = valueAtPlace(holder, row.place, row.key);
                const startsGroup = row.group !== null && row.group !== rows[rowIndex - 1]?.group;
                const control = controlOf(row);
                const setValue = (nextValue: number) => onChange(withValueAtPlace(holder, row.place, row.key, nextValue));
                return (
                    <div key={`${row.place}-${row.key}`}>
                        {startsGroup && <div className="eyebrow settings-group">{row.group}</div>}
                        <label className={`setting-row${value !== 0 ? " set" : ""}${marked?.keys.has(row.key) === true ? " marked" : ""}`} data-setting={row.key} data-part={row.place}>
                            <span className="setting-name">
                                {row.label}
                                {marked?.keys.has(row.key) === true && <span className="setting-mark">{marked.label}</span>}
                            </span>
                            {control === "toggle" && <input type="checkbox" checked={value !== 0} onChange={(event) => setValue(event.target.checked ? 1 : 0)} />}
                            {control === "number" && (
                                <span className="setting-value">
                                    <CommittedNumberField value={value} lowest={row.lowest} highest={row.highest} ariaLabel={row.label} onCommit={(nextValue) => setValue(nextValue ?? 0)} />
                                </span>
                            )}
                            {control === "choice" && (
                                <select className={`text-field setting-value num${row.choices === undefined ? "" : " labelled"}`} value={value} onChange={(event) => setValue(Number(event.target.value))}>
                                    {valueChoicesOf(row).map((choice) => (
                                        <option key={choice.value} value={choice.value}>
                                            {choice.label}
                                        </option>
                                    ))}
                                </select>
                            )}
                        </label>
                    </div>
                );
            })}
        </>
    );
}
