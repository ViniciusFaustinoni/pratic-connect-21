import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useDocumentoTemplate } from '@/hooks/useDocumentoTemplates';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, PenTool, Edit, Code, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ModalVisualizarTemplateProps {
  templateId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (id: string) => void;
}

// Extrair variáveis do conteúdo do template
function extrairVariaveis(conteudo: string): string[] {
  const regex = /\{\{([^}]+)\}\}/g;
  const variaveis: string[] = [];
  let match;
  
  while ((match = regex.exec(conteudo)) !== null) {
    const variavel = match[1].trim();
    if (!variaveis.includes(variavel)) {
      variaveis.push(variavel);
    }
  }
  
  return variaveis.sort();
}

// Agrupar variáveis por prefixo
function agruparVariaveis(variaveis: string[]): Record<string, string[]> {
  return variaveis.reduce((acc, variavel) => {
    const [grupo] = variavel.split('.');
    if (!acc[grupo]) acc[grupo] = [];
    acc[grupo].push(variavel);
    return acc;
  }, {} as Record<string, string[]>);
}

// Renderizar conteúdo com destaque nas variáveis
function renderizarConteudo(conteudo: string): React.ReactNode {
  const partes = conteudo.split(/(\{\{[^}]+\}\})/g);
  
  return partes.map((parte, index) => {
    if (parte.match(/^\{\{[^}]+\}\}$/)) {
      return (
        <code 
          key={index} 
          className="bg-primary/10 text-primary px-1 py-0.5 rounded text-sm font-mono"
        >
          {parte}
        </code>
      );
    }
    // Converter quebras de linha
    return parte.split('\n').map((linha, i, arr) => (
      <span key={`${index}-${i}`}>
        {linha}
        {i < arr.length - 1 && <br />}
      </span>
    ));
  });
}

export function ModalVisualizarTemplate({ 
  templateId, 
  open, 
  onOpenChange, 
  onEdit 
}: ModalVisualizarTemplateProps) {
  const { data: template, isLoading } = useDocumentoTemplate(templateId || undefined);

  const variaveisExtraidas = template ? extrairVariaveis(template.conteudo) : [];
  const variaveisAgrupadas = agruparVariaveis(variaveisExtraidas);

  const handleEdit = () => {
    if (templateId && onEdit) {
      onEdit(templateId);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        {isLoading ? (
          <div className="space-y-4 p-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : template ? (
          <>
            <DialogHeader>
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <DialogTitle className="text-xl">{template.nome}</DialogTitle>
                  <DialogDescription className="mt-1">
                    {template.descricao || 'Sem descrição'}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            {/* Metadados */}
            <div className="flex flex-wrap items-center gap-2 py-3">
              <Badge variant="outline" className="gap-1">
                <Code className="h-3 w-3" />
                {template.codigo}
              </Badge>
              
              {template.categoria && (
                <Badge variant="secondary">
                  {template.categoria.nome}
                </Badge>
              )}
              
              <Badge variant="outline">
                v{template.versao}
              </Badge>
              
              {template.requer_assinatura && (
                <Badge variant="default" className="gap-1 bg-amber-500 hover:bg-amber-600">
                  <PenTool className="h-3 w-3" />
                  Requer Assinatura
                </Badge>
              )}
              
              <Badge variant="outline" className="gap-1 text-muted-foreground">
                <Calendar className="h-3 w-3" />
                {format(new Date(template.updated_at), "dd/MM/yyyy", { locale: ptBR })}
              </Badge>
            </div>

            <Separator />

            {/* Conteúdo */}
            <ScrollArea className="flex-1 min-h-0 max-h-[400px]">
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium mb-2">Preview do Conteúdo</h4>
                  <div className="bg-muted/50 p-4 rounded-lg border text-sm leading-relaxed whitespace-pre-wrap font-mono">
                    {renderizarConteudo(template.conteudo)}
                  </div>
                </div>

                {/* Variáveis utilizadas */}
                {variaveisExtraidas.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">
                      Variáveis Utilizadas ({variaveisExtraidas.length})
                    </h4>
                    <div className="space-y-3">
                      {Object.entries(variaveisAgrupadas).map(([grupo, vars]) => (
                        <div key={grupo}>
                          <p className="text-xs text-muted-foreground uppercase mb-1">
                            {grupo}
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {vars.map(v => (
                              <Badge key={v} variant="outline" className="font-mono text-xs">
                                {`{{${v}}}`}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            <Separator />

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
              {onEdit && (
                <Button onClick={handleEdit}>
                  <Edit className="h-4 w-4 mr-2" />
                  Editar Template
                </Button>
              )}
            </DialogFooter>
          </>
        ) : (
          <div className="p-8 text-center text-muted-foreground">
            Template não encontrado
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
