/**
 * Editor visual de corpo de e-mail (Tiptap).
 *
 * Espelha o editor de Documentos: toolbar (negrito/itálico/sublinhado, cor via
 * alinhamento/listas/tabela), abas Visual / HTML / Preview, suporte a inserção
 * de variáveis `{{var}}` na posição do cursor.
 *
 * Salva sempre HTML; aceita também input em texto puro (templates legados
 * `formato='texto'`) — nesse caso converte quebras de linha em <p>.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import UnderlineExt from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { Table as TableExt } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import Placeholder from '@tiptap/extension-placeholder';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Bold, Italic, Underline as UnderlineIcon,
  List, ListOrdered, AlignLeft, AlignCenter, AlignRight,
  Heading2, Heading3, Minus, Undo, Redo, Code, Eye, PenTool,
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';

interface EmailBodyEditorProps {
  /** HTML do miolo (sem wrapper Praticcar). */
  value: string;
  onChange: (html: string) => void;
  /** Insere a variável na posição do cursor. */
  insertVariableRef?: React.MutableRefObject<((code: string) => void) | null>;
  /** Render do preview (já com variáveis substituídas e wrapper aplicado). */
  previewHtml?: string;
}

function textToHtml(txt: string): string {
  if (!txt) return '';
  if (/<[a-z][\s\S]*>/i.test(txt)) return txt;
  return txt
    .split(/\n{2,}/)
    .map((par) => `<p>${par.replace(/\n/g, '<br>')}</p>`)
    .join('');
}

function MiniToolbar({ editor }: { editor: Editor | null }) {
  if (!editor) return null;
  const btn = (active: boolean) =>
    `h-8 w-8 p-0 ${active ? 'bg-accent text-accent-foreground' : ''}`;
  return (
    <div className="flex flex-wrap items-center gap-1 rounded-md border bg-muted/30 p-1">
      <Button type="button" variant="ghost" size="sm" className={btn(editor.isActive('bold'))}
        onClick={() => editor.chain().focus().toggleBold().run()}><Bold className="h-4 w-4" /></Button>
      <Button type="button" variant="ghost" size="sm" className={btn(editor.isActive('italic'))}
        onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className="h-4 w-4" /></Button>
      <Button type="button" variant="ghost" size="sm" className={btn(editor.isActive('underline'))}
        onClick={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon className="h-4 w-4" /></Button>
      <Separator orientation="vertical" className="mx-1 h-6" />
      <Button type="button" variant="ghost" size="sm" className={btn(editor.isActive('heading', { level: 2 }))}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 className="h-4 w-4" /></Button>
      <Button type="button" variant="ghost" size="sm" className={btn(editor.isActive('heading', { level: 3 }))}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 className="h-4 w-4" /></Button>
      <Separator orientation="vertical" className="mx-1 h-6" />
      <Button type="button" variant="ghost" size="sm" className={btn(editor.isActive('bulletList'))}
        onClick={() => editor.chain().focus().toggleBulletList().run()}><List className="h-4 w-4" /></Button>
      <Button type="button" variant="ghost" size="sm" className={btn(editor.isActive('orderedList'))}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className="h-4 w-4" /></Button>
      <Separator orientation="vertical" className="mx-1 h-6" />
      <Button type="button" variant="ghost" size="sm" className={btn(editor.isActive({ textAlign: 'left' }))}
        onClick={() => editor.chain().focus().setTextAlign('left').run()}><AlignLeft className="h-4 w-4" /></Button>
      <Button type="button" variant="ghost" size="sm" className={btn(editor.isActive({ textAlign: 'center' }))}
        onClick={() => editor.chain().focus().setTextAlign('center').run()}><AlignCenter className="h-4 w-4" /></Button>
      <Button type="button" variant="ghost" size="sm" className={btn(editor.isActive({ textAlign: 'right' }))}
        onClick={() => editor.chain().focus().setTextAlign('right').run()}><AlignRight className="h-4 w-4" /></Button>
      <Separator orientation="vertical" className="mx-1 h-6" />
      <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}><Minus className="h-4 w-4" /></Button>
      <Separator orientation="vertical" className="mx-1 h-6" />
      <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0"
        onClick={() => editor.chain().focus().undo().run()}><Undo className="h-4 w-4" /></Button>
      <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0"
        onClick={() => editor.chain().focus().redo().run()}><Redo className="h-4 w-4" /></Button>
    </div>
  );
}

export function EmailBodyEditor({ value, onChange, insertVariableRef, previewHtml }: EmailBodyEditorProps) {
  const initialHtml = useMemo(() => textToHtml(value || ''), []); // eslint-disable-line react-hooks/exhaustive-deps
  const lastEmittedRef = useRef<string>(initialHtml);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      UnderlineExt,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TableExt.configure({ resizable: false }),
      TableRow, TableCell, TableHeader,
      Placeholder.configure({ placeholder: 'Escreva o corpo do e-mail…' }),
    ],
    content: initialHtml,
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none min-h-[300px] focus:outline-none px-4 py-3',
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      lastEmittedRef.current = html;
      onChange(html);
    },
  });

  // Sincroniza quando o pai troca o template (id diferente)
  useEffect(() => {
    if (!editor) return;
    const incoming = textToHtml(value || '');
    if (incoming !== lastEmittedRef.current) {
      editor.commands.setContent(incoming, { emitUpdate: false });
      lastEmittedRef.current = incoming;
    }
  }, [value, editor]);

  // Expose insertVariable
  useEffect(() => {
    if (!insertVariableRef) return;
    insertVariableRef.current = (code: string) => {
      if (!editor) return;
      editor.chain().focus().insertContent(code).run();
    };
    return () => {
      if (insertVariableRef.current) insertVariableRef.current = null;
    };
  }, [editor, insertVariableRef]);

  return (
    <Tabs defaultValue="visual" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="visual"><PenTool className="mr-2 h-4 w-4" />Visual</TabsTrigger>
        <TabsTrigger value="html"><Code className="mr-2 h-4 w-4" />HTML</TabsTrigger>
        <TabsTrigger value="preview"><Eye className="mr-2 h-4 w-4" />Preview</TabsTrigger>
      </TabsList>

      <TabsContent value="visual" className="mt-3 space-y-2">
        <MiniToolbar editor={editor} />
        <div className="rounded-md border bg-background">
          <EditorContent editor={editor} />
        </div>
      </TabsContent>

      <TabsContent value="html" className="mt-3">
        <Textarea
          value={value}
          onChange={(e) => {
            lastEmittedRef.current = e.target.value;
            onChange(e.target.value);
            // Atualiza o editor visual também
            if (editor) editor.commands.setContent(e.target.value || '', { emitUpdate: false });
          }}
          rows={18}
          className="font-mono text-xs"
          placeholder="<p>HTML do corpo do e-mail…</p>"
        />
      </TabsContent>

      <TabsContent value="preview" className="mt-3">
        <div className="rounded-md border bg-muted/30 p-2">
          <iframe
            title="Pré-visualização do e-mail"
            srcDoc={previewHtml || '<p style="font-family:Arial;color:#888;padding:24px">(vazio)</p>'}
            className="w-full"
            style={{ height: 520, border: 0, background: '#fff', borderRadius: 6 }}
            sandbox=""
          />
        </div>
      </TabsContent>
    </Tabs>
  );
}
