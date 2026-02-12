import { useState, useEffect, useCallback, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import UnderlineExt from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { Table as TableExt } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import Placeholder from '@tiptap/extension-placeholder';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Code, Eye, FileText } from 'lucide-react';
import { EditorToolbar } from './tiptap/EditorToolbar';
import { VariableChipExtension, convertPlainTextToHTML, convertHTMLToStorage } from './tiptap/VariableChip';
import type { Editor } from '@tiptap/react';

interface TemplateEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

// Clean Word / GDocs paste junk
function cleanWordPaste(html: string): string {
  let clean = html;
  // Remove Word-specific tags
  clean = clean.replace(/<o:p[^>]*>[\s\S]*?<\/o:p>/gi, '');
  clean = clean.replace(/<\/?o:[^>]*>/gi, '');
  clean = clean.replace(/<\/?v:[^>]*>/gi, '');
  clean = clean.replace(/<\/?w:[^>]*>/gi, '');
  // Remove MsoNormal and mso-* styles
  clean = clean.replace(/class="Mso[^"]*"/gi, '');
  clean = clean.replace(/style="[^"]*mso-[^"]*"/gi, '');
  // Remove empty spans
  clean = clean.replace(/<span[^>]*>\s*<\/span>/gi, '');
  // Remove xml namespace declarations
  clean = clean.replace(/<\?xml[^>]*>/gi, '');
  clean = clean.replace(/xmlns[:a-zA-Z]*="[^"]*"/gi, '');
  return clean;
}

// Count unique variables in content
function contarVariaveis(conteudo: string): number {
  const regex = /\{\{([^}]+)\}\}/g;
  const variaveis = new Set<string>();
  let match;
  while ((match = regex.exec(conteudo)) !== null) {
    variaveis.add(match[1].trim());
  }
  return variaveis.size;
}

// Strip HTML for character/line counting
function stripHtml(html: string): string {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}

// Render preview HTML with variable chips highlighted (static, non-editable)
function renderPreviewHTML(html: string): string {
  // Replace variable chip spans with styled versions
  return html.replace(
    /<span[^>]*data-variable="([^"]*)"[^>]*>[^<]*<\/span>/g,
    '<span class="inline-flex items-center bg-primary/10 text-primary px-1.5 py-0.5 rounded text-sm font-mono border border-primary/20 mx-0.5">$1</span>'
  );
}

// Ref holder for external access to the editor instance
let _globalEditorRef: Editor | null = null;

export function getTemplateEditor(): Editor | null {
  return _globalEditorRef;
}

export function TemplateEditor({ value, onChange, placeholder }: TemplateEditorProps) {
  const [tab, setTab] = useState<string>('editor');
  const isExternalUpdate = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      UnderlineExt,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      TableExt.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      Placeholder.configure({
        placeholder: placeholder || 'Digite o conteúdo do documento aqui...\n\nUse {{variavel}} para inserir variáveis dinâmicas.',
      }),
      VariableChipExtension,
    ],
    content: convertPlainTextToHTML(value),
    editorProps: {
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-none min-h-[400px] p-4 focus:outline-none',
      },
      handlePaste: (_view, event) => {
        const clipboardData = event.clipboardData;
        if (!clipboardData) return false;
        const html = clipboardData.getData('text/html');
        if (html) {
          const cleaned = cleanWordPaste(html);
          if (cleaned !== html) {
            event.preventDefault();
            editor?.commands.insertContent(cleaned, {
              parseOptions: { preserveWhitespace: false },
            });
            return true;
          }
        }
        return false;
      },
      handleDrop: (view, event) => {
        const text = event.dataTransfer?.getData('text/plain');
        if (text && /^\{\{[^}]+\}\}$/.test(text)) {
          event.preventDefault();
          const pos = view.posAtCoords({ left: event.clientX, top: event.clientY });
          if (pos && editor) {
            editor.chain().focus().insertContentAt(pos.pos, text).run();
          }
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: ed }) => {
      isExternalUpdate.current = true;
      const html = ed.getHTML();
      // Convert chip nodes back to {{var}} for storage
      const storageHtml = convertHTMLToStorage(html);
      onChange(storageHtml);
    },
  });

  // Store global ref
  useEffect(() => {
    _globalEditorRef = editor;
    return () => {
      if (_globalEditorRef === editor) _globalEditorRef = null;
    };
  }, [editor]);

  // Allow drag-over on editor element
  useEffect(() => {
    const el = editor?.view?.dom;
    if (!el) return;
    const handler = (e: Event) => e.preventDefault();
    el.addEventListener('dragover', handler);
    return () => el.removeEventListener('dragover', handler);
  }, [editor]);

  // Sync external value changes into editor (e.g. form reset)
  useEffect(() => {
    if (!editor) return;
    if (isExternalUpdate.current) {
      isExternalUpdate.current = false;
      return;
    }
    const currentStorage = convertHTMLToStorage(editor.getHTML());
    if (currentStorage !== value) {
      editor.commands.setContent(convertPlainTextToHTML(value), { emitUpdate: false });
    }
  }, [value, editor]);

  // Stats
  const plainText = stripHtml(value);
  const qtdLinhas = plainText.split('\n').filter(l => l.trim()).length || 1;
  const qtdCaracteres = plainText.length;
  const qtdVariaveis = contarVariaveis(value);

  // Preview HTML
  const previewHtml = editor
    ? renderPreviewHTML(editor.getHTML())
    : '';

  return (
    <div className="border rounded-lg overflow-hidden">
      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <div className="flex items-center justify-between bg-muted/50 border-b px-2">
          <TabsList className="h-10 bg-transparent">
            <TabsTrigger value="editor" className="gap-2 data-[state=active]:bg-background">
              <Code className="h-4 w-4" />
              Editor
            </TabsTrigger>
            <TabsTrigger value="preview" className="gap-2 data-[state=active]:bg-background">
              <Eye className="h-4 w-4" />
              Preview
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="font-normal">
              {qtdLinhas} linhas
            </Badge>
            <Badge variant="outline" className="font-normal">
              {qtdCaracteres} caracteres
            </Badge>
            {qtdVariaveis > 0 && (
              <Badge variant="secondary" className="font-normal">
                <FileText className="h-3 w-3 mr-1" />
                {qtdVariaveis} variáveis
              </Badge>
            )}
          </div>
        </div>

        <TabsContent value="editor" className="m-0">
          <EditorToolbar editor={editor} />
          <div className="tiptap-editor-wrapper">
            <EditorContent editor={editor} />
          </div>
        </TabsContent>

        <TabsContent value="preview" className="m-0">
          <ScrollArea className="h-[400px]">
            <div
              className="p-4 prose prose-sm max-w-none dark:prose-invert leading-relaxed"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Export for external variable insertion (used by TemplateForm)
export function useTemplateEditorInsert(_editorRef: any, _value: string, _onChange: (v: string) => void) {
  // Legacy compatibility - now uses the global editor ref
  return (texto: string) => {
    const ed = getTemplateEditor();
    if (ed) {
      ed.chain().focus().insertContent(texto).run();
    }
  };
}
