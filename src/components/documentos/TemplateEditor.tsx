import { useState, useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Code, Eye, FileText } from 'lucide-react';

interface TemplateEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

// Renderizar preview com destaque nas variáveis
function renderizarPreview(conteudo: string): React.ReactNode {
  if (!conteudo.trim()) {
    return (
      <p className="text-muted-foreground italic">
        Nenhum conteúdo ainda. Comece a escrever na aba "Editor".
      </p>
    );
  }

  const partes = conteudo.split(/(\{\{[^}]+\}\})/g);
  
  return partes.map((parte, index) => {
    if (parte.match(/^\{\{[^}]+\}\}$/)) {
      return (
        <span
          key={index}
          className="inline-flex items-center bg-primary/10 text-primary px-1.5 py-0.5 rounded text-sm font-mono border border-primary/20"
        >
          {parte}
        </span>
      );
    }
    
    // Processar markdown básico
    return processarMarkdown(parte, index);
  });
}

// Processador simples de markdown para preview
function processarMarkdown(texto: string, baseIndex: number): React.ReactNode {
  const linhas = texto.split('\n');
  
  return linhas.map((linha, i, arr) => {
    let conteudo: React.ReactNode = linha;
    
    // Headers
    if (linha.startsWith('# ')) {
      conteudo = <h1 key={i} className="text-2xl font-bold mt-4 mb-2">{linha.slice(2)}</h1>;
    } else if (linha.startsWith('## ')) {
      conteudo = <h2 key={i} className="text-xl font-semibold mt-3 mb-2">{linha.slice(3)}</h2>;
    } else if (linha.startsWith('### ')) {
      conteudo = <h3 key={i} className="text-lg font-medium mt-2 mb-1">{linha.slice(4)}</h3>;
    } else if (linha.startsWith('---')) {
      conteudo = <hr key={i} className="my-4 border-border" />;
    } else if (linha.startsWith('- [ ] ')) {
      conteudo = (
        <div key={i} className="flex items-center gap-2 my-1">
          <span className="w-4 h-4 border rounded border-border" />
          <span>{linha.slice(6)}</span>
        </div>
      );
    } else if (linha.startsWith('- ')) {
      conteudo = (
        <div key={i} className="flex items-center gap-2 my-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-foreground" />
          <span>{linha.slice(2)}</span>
        </div>
      );
    } else if (linha.match(/^\*\*(.+)\*\*$/)) {
      conteudo = <strong key={i}>{linha.replace(/\*\*/g, '')}</strong>;
    } else if (linha.trim() === '') {
      conteudo = <br key={i} />;
    } else {
      conteudo = <span key={i}>{linha}</span>;
    }
    
    return (
      <span key={`${baseIndex}-${i}`}>
        {conteudo}
        {typeof conteudo === 'string' && i < arr.length - 1 && <br />}
      </span>
    );
  });
}

// Extrair variáveis para contador
function contarVariaveis(conteudo: string): number {
  const regex = /\{\{([^}]+)\}\}/g;
  const variaveis = new Set<string>();
  let match;
  
  while ((match = regex.exec(conteudo)) !== null) {
    variaveis.add(match[1].trim());
  }
  
  return variaveis.size;
}

export function TemplateEditor({ value, onChange, placeholder }: TemplateEditorProps) {
  const [tab, setTab] = useState<string>('editor');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const qtdVariaveis = contarVariaveis(value);
  const qtdLinhas = value.split('\n').length;
  const qtdCaracteres = value.length;

  // Inserir texto na posição atual do cursor
  const inserirNaPosicao = (texto: string) => {
    if (textareaRef.current) {
      const start = textareaRef.current.selectionStart;
      const end = textareaRef.current.selectionEnd;
      const novoValor = value.slice(0, start) + texto + value.slice(end);
      onChange(novoValor);
      
      // Reposicionar cursor após o texto inserido
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = start + texto.length;
          textareaRef.current.selectionEnd = start + texto.length;
          textareaRef.current.focus();
        }
      }, 0);
    }
  };

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
          
          {/* Estatísticas */}
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
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder || 'Digite o conteúdo do template aqui...\n\nUse {{variavel}} para inserir variáveis dinâmicas.\nExemplo: Olá, {{associado.nome}}!'}
            className="min-h-[400px] border-0 rounded-none resize-none font-mono text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </TabsContent>

        <TabsContent value="preview" className="m-0">
          <ScrollArea className="h-[400px]">
            <div className="p-4 prose prose-sm max-w-none dark:prose-invert leading-relaxed">
              {renderizarPreview(value)}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Expor função para inserção externa
export function useTemplateEditorInsert(editorRef: React.RefObject<HTMLTextAreaElement>, value: string, onChange: (v: string) => void) {
  return (texto: string) => {
    if (editorRef.current) {
      const start = editorRef.current.selectionStart;
      const end = editorRef.current.selectionEnd;
      const novoValor = value.slice(0, start) + texto + value.slice(end);
      onChange(novoValor);
    } else {
      onChange(value + texto);
    }
  };
}
