import { parseProductionScript } from "@/lib/scriptParser";
import { emptyProductionScript } from "@/lib/types";
import { sortableId } from "@/lib/types";

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const { text, showSlug, title } = data as {
      text: string;
      showSlug: string;
      title: string;
    };

    if (!text || !showSlug || !title) {
      return Response.json(
        { error: "Missing required fields: text, showSlug, title" },
        { status: 400 },
      );
    }

    const parsed = parseProductionScript(text, showSlug, title);

    const script = {
      ...parsed,
      id: sortableId("script"),
      importedAt: new Date().toISOString(),
    };

    return Response.json(script);
  } catch (error) {
    console.error("Script upload error:", error);
    return Response.json(
      {
        error: "Failed to parse script",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
