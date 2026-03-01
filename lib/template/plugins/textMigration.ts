import { Schema } from "@pdfme/common"

/**
 * Migrate text plugin schemas to TextWithVariables plugin.
 * This is used when removing the text plugin and converting existing templates.
 * 
 * A text schema is converted as follows:
 * - type: "text" -> type: "TextWithVariables"
 * - content becomes the value
 * - schema.text is set to the original content
 * - schema.content is set to "{}" (empty variable data)
 * - schema.variables is set to [] (empty array)
 */
export function migrateTextSchemaToTextWithVariables(schema: Schema): Schema {
    if (schema.type !== "text") {
        return schema
    }

    // Convert text schema to TextWithVariables
    const migrated: any = {
        ...schema,
        type: "TextWithVariables",
        text: schema.content || "",
        content: "{}", // Empty variables object
        variables: [], // No variables extracted yet
    }

    delete migrated.content // Remove the old content property

    return migrated as Schema
}

/**
 * Recursively migrate all text schemas in a schema array or nested structures.
 */
export function migrateTextSchemasInArray(schemas: Schema[]): Schema[] {
    if (!Array.isArray(schemas)) return schemas

    return schemas.map((schema) => {
        if (!schema || typeof schema !== "object") return schema

        // Migrate this schema
        let migrated = migrateTextSchemaToTextWithVariables(schema)

        // If this is a ComponentBlocks schema, recursively migrate its children
        if (migrated.type === "ComponentBlocks" && (migrated as any).componentSchemas) {
            migrated = {
                ...migrated,
                componentSchemas: migrateTextSchemasInArray((migrated as any).componentSchemas),
            }
        }

        return migrated
    })
}

/**
 * Migrate all text schemas in a complete template.
 */
export function migrateTemplateSchemas(schemas: Schema[][]): Schema[][] {
    if (!Array.isArray(schemas)) return schemas
    return schemas.map((pageSchemas) => migrateTextSchemasInArray(pageSchemas))
}
