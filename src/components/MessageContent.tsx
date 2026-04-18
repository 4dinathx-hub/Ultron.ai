import React, { useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Check, Play, Code } from 'lucide-react';

interface CodeSnippetProps {
  code: string;
  language: string;
}

const CodeSnippet: React.FC<CodeSnippetProps> = ({ code, language }) => {
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isWebLanguage = ['html', 'css', 'javascript', 'js', 'jsx', 'tsx', 'react', 'svg'].includes(language.toLowerCase());

  return (
    <div className="my-4 rounded-xl overflow-hidden border border-slate-700 bg-slate-900 shadow-lg font-mono w-full">
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700 select-none">
        <div className="flex items-center gap-2">
          {isWebLanguage ? (
            <div className="flex bg-slate-900 rounded-md p-1 border border-slate-700">
              <button 
                onClick={() => setShowPreview(false)}
                className={`px-3 py-1 text-xs font-semibold rounded-sm flex items-center gap-1 transition-colors ${!showPreview ? 'bg-indigo-500 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
              >
                <Code className="w-3 h-3" /> Code
              </button>
              <button 
                onClick={() => setShowPreview(true)}
                className={`px-3 py-1 text-xs font-semibold rounded-sm flex items-center gap-1 transition-colors ${showPreview ? 'bg-indigo-500 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
              >
                <Play className="w-3 h-3" /> Preview
              </button>
            </div>
          ) : (
             <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{language || 'text'}</span>
          )}
        </div>
        <button 
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      <div className="w-full relative">
        {showPreview ? (
          <div className="bg-white w-full overflow-hidden p-4 min-h-[300px]">
            {language.toLowerCase() === 'svg' ? (
               <div dangerouslySetInnerHTML={{ __html: code }} className="w-full flex items-center justify-center" />
            ) : (
               <iframe 
                 srcDoc={code}
                 title="Preview"
                 sandbox="allow-scripts allow-modals allow-popups"
                 className="w-full min-h-[300px] border-none"
               />
            )}
          </div>
        ) : (
          <SyntaxHighlighter
            language={language}
            style={vscDarkPlus}
            customStyle={{ margin: 0, padding: '1rem', background: 'transparent', fontSize: '0.85rem', lineHeight: '1.5' }}
            wrapLines={true}
            wrapLongLines={false}
          >
            {code}
          </SyntaxHighlighter>
        )}
      </div>
    </div>
  );
};

export const MessageContent: React.FC<{ text: string }> = ({ text }) => {
  return (
    <div className="w-full prose prose-sm md:prose-base max-w-none text-current prose-p:leading-relaxed prose-pre:p-0 prose-pre:bg-transparent prose-pre:m-0 w-full overflow-hidden break-words">
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ node, inline, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || '');
            const lang = match ? match[1] : '';
            if (!inline && lang) {
              return <CodeSnippet code={String(children).replace(/\n$/, '')} language={lang} />;
            }
            return (
              <code className={`${className} bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded text-sm`} {...props}>
                {children}
              </code>
            );
          }
        }}
      >
        {text}
      </Markdown>
    </div>
  );
};
