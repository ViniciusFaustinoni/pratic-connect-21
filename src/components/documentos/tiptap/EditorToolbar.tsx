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
} from 'lucide-react';

interface EditorToolbarProps {
  editor: Editor | null;
}

export function EditorToolbar({ editor }: EditorToolbarProps) {
  if (!editor) return null;

  const ToolBtn = ({
    onClick,
    active,
    children,
    title,
  }: {
    onClick: () => void;
    active?: boolean;
    children: React.ReactNode;
    title: string;
  }) => (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={`h-8 w-8 ${active ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
      onClick={onClick}
      title={title}
    >
      {children}
    </Button>
  );

  // Use any to bypass strict ChainedCommands typing – extensions register commands at runtime
  const chain = () => (editor.chain().focus() as any);

  return (
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
    </div>
  );
}
