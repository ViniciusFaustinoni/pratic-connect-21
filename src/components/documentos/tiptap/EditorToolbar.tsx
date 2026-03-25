import { useState } from 'react';
import type { Editor } from '@tiptap/react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Bold,
  Italic,
  Underline,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Table,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Minus,
  Undo,
  Redo,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { convertPlainTextToHTML } from './VariableChip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface EditorToolbarProps {
  editor: Editor | null;
}

export function EditorToolbar({ editor }: EditorToolbarProps) {
  const [iaLoading, setIaLoading] = useState(false);
  const [iaResult, setIaResult] = useState<{ html: string; variaveis_inseridas: number } | null>(null);

  if (!editor) return null;

  const ToolBtn = ({
    onClick,
    active,
    children,
    title,
    disabled,
  }: {
    onClick: () => void;
    active?: boolean;
    children: React.ReactNode;
    title: string;
    disabled?: boolean;
  }) => (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={`h-8 w-8 ${active ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
      onClick={onClick}
      title={title}
      disabled={disabled}
    >
      {children}
    </Button>
  );

  // Use any to bypass strict ChainedCommands typing – extensions register commands at runtime
  const chain = () => (editor.chain().focus() as any);

  const handleFormatarComIA = async () => {
    const conteudo = editor.getHTML();
    if (!conteudo || conteudo === '<p></p>') {
      toast.error('O editor está vazio. Adicione conteúdo antes de formatar.');
      return;
    }

    setIaLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('formatar-texto-ia', {
        body: { conteudo },
      });

      if (error) throw error;

      if (data?.html) {
        setIaResult({
          html: data.html,
          variaveis_inseridas: data.variaveis_inseridas || 0,
        });
      } else {
        toast.error('A IA não retornou conteúdo formatado.');
      }
    } catch (err: any) {
      console.error('[EditorToolbar] Erro ao formatar com IA:', err);
      toast.error(err.message || 'Erro ao formatar com IA');
    } finally {
      setIaLoading(false);
    }
  };

  const aplicarResultadoIA = () => {
    if (!iaResult) return;
    const htmlConvertido = convertPlainTextToHTML(iaResult.html);
    editor.commands.setContent(htmlConvertido);
    toast.success(`Formatação aplicada com ${iaResult.variaveis_inseridas} variável(is) identificada(s).`);
    setIaResult(null);
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-0.5 bg-muted/50 border-b px-2 py-1">
        <ToolBtn onClick={() => chain().undo().run()} title="Desfazer">
          <Undo className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn onClick={() => chain().redo().run()} title="Refazer">
          <Redo className="h-4 w-4" />
        </ToolBtn>

        <Separator orientation="vertical" className="mx-1 h-6" />

        <ToolBtn onClick={() => chain().toggleBold().run()} active={editor.isActive('bold')} title="Negrito">
          <Bold className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn onClick={() => chain().toggleItalic().run()} active={editor.isActive('italic')} title="Itálico">
          <Italic className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn onClick={() => chain().toggleUnderline().run()} active={editor.isActive('underline')} title="Sublinhado">
          <Underline className="h-4 w-4" />
        </ToolBtn>

        <Separator orientation="vertical" className="mx-1 h-6" />

        <ToolBtn onClick={() => chain().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="Título 1">
          <Heading1 className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn onClick={() => chain().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Título 2">
          <Heading2 className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn onClick={() => chain().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Título 3">
          <Heading3 className="h-4 w-4" />
        </ToolBtn>

        <Separator orientation="vertical" className="mx-1 h-6" />

        <ToolBtn onClick={() => chain().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Lista com bullet">
          <List className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn onClick={() => chain().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Lista numerada">
          <ListOrdered className="h-4 w-4" />
        </ToolBtn>

        <Separator orientation="vertical" className="mx-1 h-6" />

        <ToolBtn onClick={() => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} title="Inserir tabela 3×3">
          <Table className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn onClick={() => chain().setHorizontalRule().run()} title="Linha horizontal">
          <Minus className="h-4 w-4" />
        </ToolBtn>

        <Separator orientation="vertical" className="mx-1 h-6" />

        <ToolBtn onClick={() => chain().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title="Alinhar à esquerda">
          <AlignLeft className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn onClick={() => chain().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="Centralizar">
          <AlignCenter className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn onClick={() => chain().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} title="Alinhar à direita">
          <AlignRight className="h-4 w-4" />
        </ToolBtn>

        <Separator orientation="vertical" className="mx-1 h-6" />

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs font-medium border-primary/30 text-primary hover:bg-primary/10"
          onClick={handleFormatarComIA}
          disabled={iaLoading}
          title="Formatar texto e inserir variáveis automaticamente com IA"
        >
          {iaLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          Formatar com IA
        </Button>
      </div>

      <AlertDialog open={!!iaResult} onOpenChange={(open) => !open && setIaResult(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Formatação com IA concluída
            </AlertDialogTitle>
            <AlertDialogDescription>
              A IA formatou o texto e identificou <strong>{iaResult?.variaveis_inseridas || 0}</strong> variável(is) dinâmica(s).
              Deseja aplicar o resultado? O conteúdo atual será substituído.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={aplicarResultadoIA}>
              Aplicar formatação
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
