import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";
import { z } from "zod";

export default defineTool({
  name: "get_style_analysis",
  title: "Get a style analysis",
  description:
    "Fetches a single style analysis owned by the signed-in user, including the full analysis_result JSON.",
  inputSchema: {
    id: z.string().uuid().describe("The style_analyses.id UUID."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ id }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const { data, error } = await supabaseForUser(ctx)
      .from("style_analyses")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error)
      return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data)
      return { content: [{ type: "text", text: "Analysis not found" }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { analysis: data },
    };
  },
});
