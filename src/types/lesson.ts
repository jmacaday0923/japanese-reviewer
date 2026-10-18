// One study page: a chapter, the kana page, a kanji page or a practice exam,
// as build_chapters_v2.py writes it to the data files
export type Chapter = {
  ch: string;      // "1"
  title: string;   // "Copula Sentences"
  intro: string;   // the short paragraph under the title
  sections: { id: string; title: string; html: string }[];
  toc: { a: string; t: string; l: number }[];
};
