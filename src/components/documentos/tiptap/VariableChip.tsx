import { Node, mergeAttributes } from '@tiptap/react';
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
import type { ReactNodeViewProps } from '@tiptap/react';
import { InputRule } from '@tiptap/core';

// React component for the chip display
function VariableChipView(props: ReactNodeViewProps) {
  const label = props.node.attrs.label as string;
  return (
    <NodeViewWrapper as="span" className="inline">
      <span
        className="inline-flex items-center bg-primary/10 text-primary px-1.5 py-0.5 rounded text-sm font-mono border border-primary/20 mx-0.5 select-all"
        contentEditable={false}
        data-variable={label}
      >
        {label}
      </span>
    </NodeViewWrapper>
  );
}

// TipTap Node extension
export const VariableChipExtension = Node.create({
  name: 'variableChip',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      label: {
        default: '',
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-variable]',
        getAttrs: (dom) => {
          const el = dom as HTMLElement;
          return { label: el.getAttribute('data-variable') || el.textContent };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-variable': HTMLAttributes.label,
        class: 'variable-chip',
      }),
      HTMLAttributes.label,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(VariableChipView);
  },

  addInputRules() {
    return [
      new InputRule({
        find: /\{\{([^}]+)\}\}$/,
        handler: ({ state, range, match }) => {
          const label = `{{${match[1].trim()}}}`;
          const { tr } = state;
          tr.replaceWith(range.from, range.to, this.type.create({ label }));
        },
      }),
    ];
  },
});

/**
 * Convert raw text with {{var}} to TipTap-compatible HTML.
 * Also handles already-HTML content.
 */
export function convertPlainTextToHTML(content: string): string {
  if (!content || !content.trim()) return '<p></p>';
  
  // Detect if already HTML
  const trimmed = content.trim();
  if (trimmed.startsWith('<') && (trimmed.startsWith('<p') || trimmed.startsWith('<h') || trimmed.startsWith('<div') || trimmed.startsWith('<table') || trimmed.startsWith('<ul') || trimmed.startsWith('<ol'))) {
    return wrapVariablesInHTML(trimmed);
  }

  // Plain text -> HTML conversion
  const lines = content.split('\n');
  const htmlLines = lines.map(line => {
    if (line.trim() === '') return '<p></p>';
    const escaped = line
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return `<p>${escaped}</p>`;
  });

  return wrapVariablesInHTML(htmlLines.join(''));
}

/**
 * Convert HTML with variable chips back to raw HTML with {{var}} text
 */
export function convertHTMLToStorage(html: string): string {
  return html.replace(
    /<span[^>]*data-variable="([^"]*)"[^>]*>[^<]*<\/span>/g,
    '$1'
  );
}

function wrapVariablesInHTML(html: string): string {
  return html.replace(
    /\{\{([^}]+)\}\}/g,
    (match) => `<span data-variable="${match}" class="variable-chip">${match}</span>`
  );
}
