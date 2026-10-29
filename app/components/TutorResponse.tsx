"use client";

import { memo } from "react";
import { fromMarkdown } from "mdast-util-from-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import "./TutorResponse.css";

type MarkdownNode = {
  type: string;
  position?: { start: { offset?: number }; end: { offset?: number } };
  children?: MarkdownNode[];
};

// O Gemini também usa \(...\) e \[...\]. O remark-math usa os delimitadores
// equivalentes $ e $$. O parser CommonMark identifica primeiro o código, incluindo
// blocos dentro de listas/citações, para nunca alterar exemplos literais.
function normalizeMathDelimiters(text: string): string {
  const code: { start: number; end: number }[] = [];
  function visit(node: MarkdownNode) {
    if (node.type === "code" || node.type === "inlineCode") {
      const start = node.position?.start.offset;
      const end = node.position?.end.offset;
      if (start !== undefined && end !== undefined) code.push({ start, end });
    } else {
      node.children?.forEach(visit);
    }
  }
  visit(fromMarkdown(text));

  function normalize(segment: string): string {
    return segment.replace(
      /\\\(([\s\S]*?)\\\)|\\\[([\s\S]*?)\\\]/g,
      (
        match: string,
        inline: string | undefined,
        block: string | undefined,
        offset: number,
      ) => {
        // Uma barra escapada (\\) continua a ser texto literal.
        if (offset > 0 && segment[offset - 1] === "\\") return match;
        return inline !== undefined
          ? `$${inline}$`
          : `\n\n$$\n${block?.trim() ?? ""}\n$$\n\n`;
      },
    );
  }

  let result = "";
  let offset = 0;
  for (const range of code) {
    result += normalize(text.slice(offset, range.start));
    result += text.slice(range.start, range.end);
    offset = range.end;
  }
  return result + normalize(text.slice(offset));
}

// A formatação só altera a apresentação. O texto original continua a ser usado
// pelo histórico, pela moderação e pela leitura em voz alta.
const TutorResponse = memo(function TutorResponse({ text }: { text: string }) {
  return (
    <div className="tutor-response">
      <ReactMarkdown
        skipHtml
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[
          [
            rehypeKatex,
            {
              trust: false,
              strict: "ignore",
              maxExpand: 1000,
              maxSize: 10,
              errorColor: "#374151",
              output: "htmlAndMathml",
            },
          ],
        ]}
        components={{
          // As respostas não abrem páginas nem carregam imagens remotas.
          a: ({ children }) => <span>{children}</span>,
          img: ({ alt }) => (alt ? <span>{alt}</span> : null),
          table: ({ children }) => (
            <div className="tutor-response-table-scroll">
              <table>{children}</table>
            </div>
          ),
        }}
      >
        {normalizeMathDelimiters(text)}
      </ReactMarkdown>
    </div>
  );
});

export default TutorResponse;
