import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";
import { z } from "zod";

export default defineTool({
  name: "list_style_analyses",
  title: "List my style analyses",
  description:
    "Lists the signed-in user's style analyses (id, occasion, gender, image URLs, created_at), newest first.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).default(20).describe("Max rows to return."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const { data, error } = await supabaseForUser(ctx)
      .from("style_analyses")
      .select("id, occasion, gender, image_url, generated_image_url, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error)
      return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { items: data ?? [] },
    };
  },
});
