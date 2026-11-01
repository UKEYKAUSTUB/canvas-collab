import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

// Models sometimes emit \( \) and \[ \] instead of $ and $$
function normalizeMath(text) {
  return text
    .replace(/\\\[([\s\S]*?)\\\]/g, (_, m) => `$$${m}$$`)
    .replace(/\\\(([\s\S]*?)\\\)/g, (_, m) => `$${m}$`);
}

const components = {
  p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
  ul: ({ children }) => <ul className="list-disc pl-5 mb-2 space-y-0.5">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 space-y-0.5">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  h1: ({ children }) => <h3 className="font-semibold text-sm mb-1">{children}</h3>,
  h2: ({ children }) => <h3 className="font-semibold text-sm mb-1">{children}</h3>,
  h3: ({ children }) => <h3 className="font-semibold text-xs mb-1">{children}</h3>,
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noreferrer" className="text-blue-600 underline">
      {children}
    </a>
  ),
  pre: ({ children }) => (
    <pre className="bg-gray-900 text-gray-100 rounded-lg p-2.5 my-2 overflow-x-auto text-[11px] leading-snug">
      {children}
    </pre>
  ),
  code: ({ className, children }) => {
    const isBlock = /language-/.test(className || '');
    return isBlock ? (
      <code className={className}>{children}</code>
    ) : (
      <code className="bg-gray-200 text-gray-800 rounded px-1 py-0.5 text-[11px]">{children}</code>
    );
  },
  table: ({ children }) => (
    <div className="overflow-x-auto my-2">
      <table className="text-[11px] border-collapse">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border border-gray-300 px-2 py-1 bg-gray-200">{children}</th>,
  td: ({ children }) => <td className="border border-gray-300 px-2 py-1">{children}</td>,
};

export default function MarkdownMessage({ text }) {
  return (
    <div className="[&_.katex-display]:overflow-x-auto [&_.katex-display]:overflow-y-hidden [&_.katex-display]:py-1">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={components}
      >
        {normalizeMath(text)}
      </ReactMarkdown>
    </div>
  );
}