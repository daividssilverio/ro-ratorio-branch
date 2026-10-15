/** The exact text of a schema file as it is committed and published. */
export function serializePublishedSchema(jsonSchema: object): string {
    return `${JSON.stringify(jsonSchema, null, 4)}\n`;
}
