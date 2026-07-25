import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listAnalysesTool from "./tools/list-analyses";
import getAnalysisTool from "./tools/get-analysis";
import listFavoritesTool from "./tools/list-favorites";
import toggleFavoriteTool from "./tools/toggle-favorite";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "the-special-style-mcp",
  title: "The Special Style",
  version: "0.1.0",
  instructions:
    "Tools for The Special Style. Use list_style_analyses / get_style_analysis to read the signed-in user's outfit analyses, and list_favorites / toggle_favorite to manage their favorites.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listAnalysesTool, getAnalysisTool, listFavoritesTool, toggleFavoriteTool],
});
