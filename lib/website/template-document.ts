export type TemplateDocument = {
  schema_version: 1;
  settings: Record<string, unknown>;
  sections: Array<{ section_type: string; title: string; content: Record<string, unknown>; settings: Record<string, unknown>; is_visible: boolean }>;
};
export function isTemplateDocument(value: unknown): value is TemplateDocument {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const doc = value as Record<string, unknown>;
  return doc.schema_version === 1 && !!doc.settings && typeof doc.settings === "object" && !Array.isArray(doc.settings) &&
    Array.isArray(doc.sections) && doc.sections.length > 0 && doc.sections.length <= 20 && doc.sections.every((item: unknown) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return false;
      const row = item as Record<string, unknown>;
      if (typeof row.title !== "string" || typeof row.section_type !== "string" || !row.content || typeof row.content !== "object") return false;
      const content = row.content as Record<string, unknown>;
      return content.page_type !== "link-page" && Array.isArray(content.layouts) && content.layouts.length > 0;
    });
}
// Bind whole tokens only. Business text is never evaluated as code or substituted
// into HTML; the caller supplies escaped contact_html separately.
export function bindTemplateDocument(document: TemplateDocument, bindings: Record<string, unknown>): TemplateDocument {
  function walk(value: unknown): unknown {
    if (typeof value === "string") {
      const match = /^\{\{([a-z_]+)\}\}$/.exec(value);
      if (!match) return value;
      if (!Object.prototype.hasOwnProperty.call(bindings, match[1])) throw new Error(`Unknown template binding: ${match[1]}`);
      return structuredClone(bindings[match[1]]);
    }
    if (Array.isArray(value)) return value.map(walk);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, walk(item)]));
    return value;
  }
  return walk(document) as TemplateDocument;
}
