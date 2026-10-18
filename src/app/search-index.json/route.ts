import { getSearchIndex } from "@/lib/search-data";

// The search index as one static file. It reads nothing from the request,
// so it is prerendered at build time and served like any other asset. The
// home page loads it when the search is first used, which keeps the index
// out of the page's own HTML.
export async function GET() {
  return Response.json(getSearchIndex());
}
