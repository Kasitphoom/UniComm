# Text with Variables Plugin

A custom pdfme plugin that allows you to create text fields with dynamic variables from customer list fields.

## Features

- **Variable Insertion**: Type `{{` to trigger a dropdown showing available fields from the selected contact list
- **Dynamic Content**: Variables are automatically replaced with actual customer data when generating PDFs
- **Customizable Styling**: Configure font size, color, and text alignment
- **Contact List Integration**: Select a contact list to populate variable options

## Usage

### 1. Import the Plugin

```typescript
import { TextWithVariables } from "@/lib/template/plugins/textWithVariables"
```

### 2. Add to Your PDFMe Configuration

```typescript
const plugins = {
  TextWithVariables,
  // ... other plugins
}
```

### 3. Using in the Designer

1. Add a "Text with Variables" element to your template
2. In the property panel, select a contact list from the dropdown
3. In the text editor, type `{{` to see available fields
4. Select a field from the dropdown to insert it as `{{fieldName}}`
5. Customize font size, color, and alignment as needed

### 4. Example Text Content

```
Hello {{firstName}} {{lastName}},

Your email is: {{email}}
Your phone number is: {{phoneNumber}}
```

## API Integration

The plugin fetches contact list data from:
- **Contact List Selection**: `GET /api/customer-list?page={page}&query={query}`
- **Field Data**: `GET /api/customer-list/[id]` - Returns `contactList.fields[i].field`

## Schema Properties

| Property | Type | Description | Default |
|----------|------|-------------|---------|
| `content` | string | The text content with variables | "" |
| `contactListId` | string | ID of the selected contact list | "" |
| `fontSize` | number | Font size in points | 12 |
| `fontColor` | string | Text color in hex format | "#000000" |
| `alignment` | "left" \| "center" \| "right" | Text alignment | "left" |

## Variable Format

Variables should be wrapped in double curly braces: `{{variableName}}`

### Example

If your contact list has fields: `firstName`, `lastName`, `email`

You can write:
```
Dear {{firstName}} {{lastName}},
Contact: {{email}}
```

When generating a PDF with customer data:
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@example.com"
}
```

The output will be:
```
Dear John Doe,
Contact: john.doe@example.com
```

## Utility Functions

### `extractVariables(text: string): string[]`

Extracts all variable names from a text string.

```typescript
import { extractVariables } from "@/lib/template/plugins/textWithVariables"

const text = "Hello {{firstName}} {{lastName}}"
const variables = extractVariables(text)
// Returns: ["firstName", "lastName"]
```

## Notes

- If a variable is not found in the customer data, it will remain as `{{fieldName}}` in the output
- The dropdown filters fields as you type after `{{`
- The plugin supports multi-line text with variable substitution
