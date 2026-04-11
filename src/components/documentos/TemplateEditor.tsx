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
import { Code, Eye, FileText, Info, PenTool } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { EditorToolbar } from './tiptap/EditorToolbar';
import { VariableChipExtension, convertPlainTextToHTML, convertHTMLToStorage } from './tiptap/VariableChip';
import { substituirVariaveisPreview } from './templatePreviewData';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import type { Editor } from '@tiptap/react';

interface TemplateEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  cabecalhoHtml?: string;
  rodapeHtml?: string;
}

// Clean Word / GDocs paste junk
function cleanWordPaste(html: string): string {
  let clean = html;
  clean = clean.replace(/<o:p[^>]*>[\s\S]*?<\/o:p>/gi, '');
  clean = clean.replace(/<\/?o:[^>]*>/gi, '');
  clean = clean.replace(/<\/?v:[^>]*>/gi, '');
  clean = clean.replace(/<\/?w:[^>]*>/gi, '');
  clean = clean.replace(/class="Mso[^"]*"/gi, '');
  clean = clean.replace(/style="[^"]*mso-[^"]*"/gi, '');
  clean = clean.replace(/<span[^>]*>\s*<\/span>/gi, '');
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

// Fetch empresa config for preview branding
function useEmpresaConfig() {
  return useQuery({
    queryKey: ['cotacao-pdf-config-preview'],
    queryFn: async () => {
      const { data } = await supabase
        .from('cotacao_pdf_config')
        .select('logo_url, nome_empresa, cor_primaria')
        .limit(1)
        .maybeSingle();
      return data as { logo_url?: string; nome_empresa?: string; cor_primaria?: string } | null;
    },
    staleTime: 5 * 60 * 1000,
  });
}

// Ref holder for external access to the editor instance
let _globalEditorRef: Editor | null = null;

export function getTemplateEditor(): Editor | null {
  return _globalEditorRef;
}

export function TemplateEditor({ value, onChange, placeholder, cabecalhoHtml, rodapeHtml }: TemplateEditorProps) {
  const [tab, setTab] = useState<string>('editor');
  const isExternalUpdate = useRef(false);
  const [showSignatureOverlay, setShowSignatureOverlay] = useState(false);
  const { data: empresaConfig } = useEmpresaConfig();

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

  // Sync external value changes into editor
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

  // Build preview HTML with replaced variables
  const previewConteudo = editor
    ? substituirVariaveisPreview(editor.getHTML())
    : '';

  const corPrimaria = empresaConfig?.cor_primaria || '#1e40af';
  const nomeEmpresa = empresaConfig?.nome_empresa || 'Empresa';
  const logoUrl = empresaConfig?.logo_url;

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
          <ScrollArea className="h-[500px] bg-muted/30">
            {/* Badge de aviso */}
            <div className="flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground bg-muted/50 border-b">
              <Info className="h-3.5 w-3.5" />
              Preview com dados fictícios — simula o documento final
            </div>

            {/* A4-style document container */}
            <div className="flex justify-center py-6 px-4">
              <div
                className="bg-white text-black shadow-xl border rounded-sm w-full"
                style={{ maxWidth: '210mm', minHeight: '297mm' }}
              >
                {/* === Cabeçalho === */}
                <div
                  className="px-12 pt-10 pb-4 border-b-2"
                  style={{ borderBottomColor: corPrimaria }}
                >
                  {cabecalhoHtml ? (
                    <div
                      className="prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: substituirVariaveisPreview(cabecalhoHtml) }}
                    />
                  ) : (
                    <div className="flex items-center gap-4">
                      {logoUrl ? (
                        <img
                          src={logoUrl}
                          alt={nomeEmpresa}
                          className="h-14 w-auto object-contain"
                          crossOrigin="anonymous"
                        />
                      ) : (
                        <div
                          className="h-14 w-14 rounded-lg flex items-center justify-center text-white font-bold text-xl"
                          style={{ backgroundColor: corPrimaria }}
                        >
                          {nomeEmpresa.charAt(0)}
                        </div>
                      )}
                      <div>
                        <h2
                          className="text-lg font-bold"
                          style={{ color: corPrimaria }}
                        >
                          {nomeEmpresa}
                        </h2>
                        <p className="text-xs text-gray-500">Documento gerado automaticamente</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* === Conteúdo === */}
                <div
                  className="px-12 py-8 prose prose-sm max-w-none leading-relaxed"
                  style={{ fontSize: '12pt', lineHeight: '1.8' }}
                  dangerouslySetInnerHTML={{ __html: previewConteudo }}
                />

                {/* === Rodapé === */}
                <div
                  className="px-12 pb-8 pt-4 mt-auto border-t text-xs text-gray-500"
                  style={{ borderTopColor: corPrimaria + '40' }}
                >
                  {rodapeHtml ? (
                    <div
                      className="prose prose-xs max-w-none"
                      dangerouslySetInnerHTML={{ __html: substituirVariaveisPreview(rodapeHtml) }}
                    />
                  ) : (
                    <div className="flex items-center justify-between">
                      <span>{nomeEmpresa}</span>
                      <span>Página 1 de 1</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Export for external variable insertion (used by TemplateForm)
export function useTemplateEditorInsert(_editorRef: any, _value: string, _onChange: (v: string) => void) {
  return (texto: string) => {
    const ed = getTemplateEditor();
    if (ed) {
      ed.chain().focus().insertContent(texto).run();
    }
  };
}
