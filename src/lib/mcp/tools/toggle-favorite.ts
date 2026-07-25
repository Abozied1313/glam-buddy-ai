import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function clientFor(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "toggle_favorite",
  title: "Add or remove a favorite",
  description:
    "Adds the given style analysis to the signed-in user's favorites (action=add) or removes it (action=remove).",
  inputSchema: {
    analysis_id: z.string().uuid().describe("The style_analyses.id to favorite/unfavorite."),
    action: z.enum(["add", "remove"]).describe("Whether to add or remove the favorite."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  handler: async ({ analysis_id, action }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const supabase = clientFor(ctx);
    if (action === "add") {
      const { data, error } = await supabase
        .from("favorites")
        .upsert(
          { user_id: ctx.getUserId(), analysis_id },
          { onConflict: "user_id,analysis_id", ignoreDuplicates: false },
        )
        .select();
      if (error)
        return { content: [{ type: "text", text: error.message }], isError: true };
      return {
        content: [{ type: "text", text: `Added favorite for analysis ${analysis_id}` }],
        structuredContent: { favorite: data?.[0] ?? null },
      };
    }
    const { error } = await supabase
      .from("favorites")
      .delete()
      .eq("user_id", ctx.getUserId())
      .eq("analysis_id", analysis_id);
    if (error)
      return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Removed favorite for analysis ${analysis_id}` }],
    };
  },
});
