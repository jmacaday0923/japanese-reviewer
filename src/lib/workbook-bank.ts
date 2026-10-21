import "server-only";
import raw from "@/data/workbook-exercises.json";
import type { WorkbookBank } from "@/types/workbook";
const sets = new Map((raw as WorkbookBank).chapters.flatMap(chapter => chapter.sets.map(set => [set.id, set] as const)));
export const workbookSet = (id: string) => sets.get(id);
