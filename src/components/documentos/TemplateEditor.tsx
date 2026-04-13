import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { Code, Eye, FileText, Info, PenTool, Layers, Zap, Paperclip, BookOpen } from 'lucide-react';
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

// Fetch templates that are auto-annexed to proposals
function useTemplatesAnexos() {
  return useQuery({
    queryKey: ['templates-anexos-preview'],
    queryFn: async () => {
      const { data } = await supabase
        .from('documento_templates')
        .select('id, nome, codigo, conteudo')
        .eq('anexar_proposta', true)
        .eq('ativo', true)
        .order('ordem_anexo', { ascending: true });
      return (data || []) as { id: string; nome: string; codigo: string; conteudo: string }[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

// Fetch active aditivos
function useAditivosAtivos() {
  return useQuery({
    queryKey: ['aditivos-ativos-preview'],
    queryFn: async () => {
      const { data } = await supabase
        .from('termos_aditivos')
        .select('nome, descricao, conteudo_html')
        .eq('ativo', true)
        .order('ordem', { ascending: true });
      return (data || []) as { nome: string; descricao: string | null; conteudo_html: string | null }[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

// Ref holder for external access to the editor instance
let _globalEditorRef: Editor | null = null;

export function getTemplateEditor(): Editor | null {
  return _globalEditorRef;
}

// Auto-injected section wrapper component
function SecaoInjetada({ icone, titulo, subtitulo, children }: {
  icone: React.ReactNode;
  titulo: string;
  subtitulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-12 my-6 border-2 border-dashed border-amber-400/60 rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border-b border-amber-200">
        {icone}
        <span className="font-semibold text-amber-800 text-sm">{titulo}</span>
        <Badge variant="outline" className="ml-auto text-[10px] bg-amber-100 text-amber-700 border-amber-300">
          {subtitulo}
        </Badge>
      </div>
      <div className="p-4 bg-amber-50/30">
        {children}
      </div>
    </div>
  );
}

export function TemplateEditor({ value, onChange, placeholder, cabecalhoHtml, rodapeHtml }: TemplateEditorProps) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<string>('editor');
  const isExternalUpdate = useRef(false);
  const [showSignatureOverlay, setShowSignatureOverlay] = useState(false);
  const { data: empresaConfig } = useEmpresaConfig();
  const { data: templatesAnexos } = useTemplatesAnexos();
  const { data: aditivosAtivos } = useAditivosAtivos();

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

  // Estimate total pages for full preview
  const estimarPaginas = () => {
    let totalChars = plainText.length;
    if (aditivosAtivos?.length) totalChars += aditivosAtivos.length * 3000;
    if (templatesAnexos?.length) {
      templatesAnexos.forEach(t => { totalChars += (t.conteudo?.length || 5000); });
    }
    totalChars += 4000; // coberturas + cabeçalho/rodapé
    return Math.max(1, Math.ceil(totalChars / 2000));
  };

  const renderCabecalho = () => (
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
            <img src={logoUrl} alt={nomeEmpresa} className="h-14 w-auto object-contain" crossOrigin="anonymous" />
          ) : (
            <div className="h-14 w-14 rounded-lg flex items-center justify-center text-white font-bold text-xl" style={{ backgroundColor: corPrimaria }}>
              {nomeEmpresa.charAt(0)}
            </div>
          )}
          <div>
            <h2 className="text-lg font-bold" style={{ color: corPrimaria }}>{nomeEmpresa}</h2>
            <p className="text-xs text-gray-500">Documento gerado automaticamente</p>
          </div>
        </div>
      )}
    </div>
  );

  const renderRodape = () => (
    <div className="px-12 pb-8 pt-4 mt-auto border-t text-xs text-gray-500" style={{ borderTopColor: corPrimaria + '40' }}>
      {rodapeHtml ? (
        <div className="prose prose-xs max-w-none" dangerouslySetInnerHTML={{ __html: substituirVariaveisPreview(rodapeHtml) }} />
      ) : (
        <div className="flex items-center justify-between">
          <span>{nomeEmpresa}</span>
          <span>Página 1 de {estimarPaginas()}</span>
        </div>
      )}
    </div>
  );

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
            <TabsTrigger value="completo" className="gap-2 data-[state=active]:bg-background">
              <Layers className="h-4 w-4" />
              Documento Completo
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
            {/* Badge de aviso + toggle assinatura */}
            <div className="flex items-center justify-between gap-2 py-2 px-4 text-xs text-muted-foreground bg-muted/50 border-b">
              <div className="flex items-center gap-2">
                <Info className="h-3.5 w-3.5" />
                Preview com dados fictícios — simula o documento final
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="signature-overlay"
                  checked={showSignatureOverlay}
                  onCheckedChange={setShowSignatureOverlay}
                  className="h-4 w-8 data-[state=checked]:bg-primary [&>span]:h-3 [&>span]:w-3"
                />
                <Label htmlFor="signature-overlay" className="text-xs cursor-pointer flex items-center gap-1">
                  <PenTool className="h-3 w-3" />
                  Assinatura Autentique
                </Label>
              </div>
            </div>

            {/* A4-style document container */}
            <div className="flex justify-center py-6 px-4">
              <div
                className="bg-white text-black shadow-xl border rounded-sm w-full relative"
                style={{ maxWidth: '210mm', minHeight: '297mm' }}
              >
                {/* Overlay de posição da assinatura Autentique */}
                {showSignatureOverlay && (
                  <div
                    className="absolute pointer-events-none z-10"
                    style={{
                      left: '65%',
                      top: '85%',
                      transform: 'translate(-50%, -50%)',
                      width: '30%',
                      padding: '8px 12px',
                      border: '2px dashed hsl(var(--primary))',
                      borderRadius: '6px',
                      backgroundColor: 'hsl(var(--primary) / 0.08)',
                      textAlign: 'center',
                    }}
                  >
                    <div className="flex items-center justify-center gap-1.5 text-primary" style={{ fontSize: '10px', fontWeight: 600 }}>
                      <PenTool className="h-3.5 w-3.5" />
                      Assinatura Autentique
                    </div>
                    <div className="text-primary/60" style={{ fontSize: '8px', marginTop: '2px' }}>
                      Posição: x=65% y=85% (em cada página)
                    </div>
                  </div>
                )}
                {renderCabecalho()}
                <div
                  className="px-12 py-8 prose prose-sm max-w-none leading-relaxed"
                  style={{ fontSize: '12pt', lineHeight: '1.8' }}
                  dangerouslySetInnerHTML={{ __html: previewConteudo }}
                />
                {renderRodape()}
              </div>
            </div>
          </ScrollArea>
        </TabsContent>

        {/* === DOCUMENTO COMPLETO === */}
        <TabsContent value="completo" className="m-0">
          <ScrollArea className="h-[600px] bg-muted/30">
            <div className="flex items-center justify-between gap-2 py-2 px-4 text-xs text-muted-foreground bg-muted/50 border-b">
              <div className="flex items-center gap-2">
                <Layers className="h-3.5 w-3.5" />
                Estrutura completa do documento enviado ao Autentique
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-[10px]">
                  ~{estimarPaginas()} páginas estimadas
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  {1 + (aditivosAtivos?.length || 0) + (templatesAnexos?.length || 0) + 1} seções
                </Badge>
              </div>
            </div>

            <div className="flex justify-center py-6 px-4">
              <div
                className="bg-white text-black shadow-xl border rounded-sm w-full"
                style={{ maxWidth: '210mm', minHeight: '297mm' }}
              >
                {/* Cabeçalho */}
                {renderCabecalho()}

                {/* Conteúdo do template editável */}
                <div className="mx-12 my-4">
                  <Badge variant="outline" className="text-[10px] mb-2 bg-blue-50 text-blue-700 border-blue-200">
                    <Code className="h-3 w-3 mr-1" />
                    Conteúdo editável do template
                  </Badge>
                </div>
                <div
                  className="px-12 py-4 prose prose-sm max-w-none leading-relaxed"
                  style={{ fontSize: '12pt', lineHeight: '1.8' }}
                  dangerouslySetInnerHTML={{ __html: previewConteudo }}
                />

                {/* Seção injetada: Coberturas e Benefícios */}
                <SecaoInjetada
                  icone={<Zap className="h-4 w-4 text-amber-600" />}
                  titulo="COBERTURAS E BENEFÍCIOS DO PLANO"
                  subtitulo="Injetado automaticamente"
                >
                  <div className="text-xs text-gray-600 space-y-2">
                    <p className="font-medium text-gray-800">Esta seção é gerada automaticamente com base no plano escolhido pelo associado.</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="font-semibold text-gray-700 mb-1">Coberturas exemplo:</p>
                        <ul className="list-disc list-inside space-y-0.5 text-gray-500">
                          <li>Colisão — 100% FIPE</li>
                          <li>Roubo/Furto — 100% FIPE</li>
                          <li>Incêndio — 100% FIPE</li>
                          <li>Fenômenos Naturais — 100% FIPE</li>
                        </ul>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-700 mb-1">Benefícios exemplo:</p>
                        <ul className="list-disc list-inside space-y-0.5 text-gray-500">
                          <li>Assistência 24h</li>
                          <li>Guincho até 200km</li>
                          <li>Carro Reserva (7 dias)</li>
                          <li>Vidros — R$ 2.000</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </SecaoInjetada>

                {/* Seção injetada: Aditivos Dinâmicos */}
                <SecaoInjetada
                  icone={<Zap className="h-4 w-4 text-amber-600" />}
                  titulo="ADITIVOS DINÂMICOS"
                  subtitulo="Baseado no veículo/plano"
                >
                  <div className="text-xs text-gray-600 space-y-2">
                    <p className="font-medium text-gray-800">
                      Aditivos são incluídos automaticamente conforme regras do veículo (0km, blindado, FIPE, rastreador, etc.)
                    </p>
                    {aditivosAtivos && aditivosAtivos.length > 0 ? (
                      <div className="space-y-1.5">
                        <p className="font-semibold text-gray-700">Aditivos ativos no sistema ({aditivosAtivos.length}):</p>
                        {aditivosAtivos.map((a, i) => (
                          <div key={i} className="flex items-start gap-2 pl-2 border-l-2 border-amber-300">
                            <span className="font-medium text-gray-700">{a.nome}</span>
                            {a.descricao && <span className="text-gray-400">— {a.descricao}</span>}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-400 italic">Nenhum aditivo ativo cadastrado</p>
                    )}
                  </div>
                </SecaoInjetada>

                {/* Seção injetada: Templates Anexos */}
                <SecaoInjetada
                  icone={<Paperclip className="h-4 w-4 text-amber-600" />}
                  titulo="TEMPLATES ANEXOS"
                  subtitulo="Anexados automaticamente"
                >
                  <div className="text-xs text-gray-600 space-y-2">
                    <p className="font-medium text-gray-800">
                      Estes documentos são anexados ao final da proposta de filiação automaticamente.
                    </p>
                    {templatesAnexos && templatesAnexos.length > 0 ? (
                      <div className="space-y-2">
                        {templatesAnexos.map((t, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-2 p-2 rounded bg-white border border-amber-200 cursor-pointer hover:bg-amber-50 hover:border-amber-300 transition-colors"
                            onClick={() => t.id && navigate(`/documentos/templates/${t.id}`)}
                            title={`Abrir edição de ${t.nome}`}
                          >
                            <BookOpen className="h-4 w-4 text-amber-500 shrink-0" />
                            <div>
                              <span className="font-medium text-gray-700">{t.nome}</span>
                              <span className="text-gray-400 ml-2">({t.codigo})</span>
                              <span className="text-gray-400 ml-2">
                                ~{Math.ceil((t.conteudo?.length || 5000) / 2000)} pág.
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-400 italic">Nenhum template anexo configurado</p>
                    )}
                  </div>
                </SecaoInjetada>

                {/* Rodapé */}
                {renderRodape()}
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
