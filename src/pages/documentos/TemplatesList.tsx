import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDocumentoTemplates, useDocumentoCategorias, useDeleteTemplate, useDuplicateTemplate } from '@/hooks/useDocumentoTemplates';
import { useDocumentoPermissoes } from '@/hooks/useDocumentoPermissoes';
import type { DocumentoTemplateView } from '@/hooks/useDocumentoTemplates';
import type { DocumentoCategoria } from '@/types/documentos';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { ModalVisualizarTemplate } from '@/components/documentos/ModalVisualizarTemplate';
import { 
  Plus, 
  Search, 
  MoreHorizontal, 
  Edit, 
  Copy, 
  Eye, 
  Trash2, 
  FileText, 
  FileSignature, 
  ScrollText, 
  FileCheck, 
  ClipboardList, 
  Mail,
  PenTool,
  Lock
} from 'lucide-react';

// Mapeamento de ícones por nome
const iconesCategorias: Record<string, React.ComponentType<{ className?: string }>> = {
  FileSignature: FileSignature,
  ScrollText: ScrollText,
  FileCheck: FileCheck,
  ClipboardList: ClipboardList,
  Mail: Mail,
  FileText: FileText,
};

// Cores das categorias
const coresCategorias: Record<string, { bg: string; text: string; iconBg: string }> = {
  blue: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-800 dark:text-blue-300', iconBg: 'bg-blue-500' },
  green: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-800 dark:text-green-300', iconBg: 'bg-green-500' },
  purple: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-800 dark:text-purple-300', iconBg: 'bg-purple-500' },
  orange: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-800 dark:text-orange-300', iconBg: 'bg-orange-500' },
  red: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-800 dark:text-red-300', iconBg: 'bg-red-500' },
  gray: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-800 dark:text-gray-300', iconBg: 'bg-gray-500' },
};

interface TemplateCardProps {
  template: DocumentoTemplateView & { categoria: DocumentoCategoria };
  onEdit: (id: string) => void;
  onDuplicate: (id: string) => void;
  onView: (id: string) => void;
  onDelete: (id: string) => void;
  podeEditar: boolean;
  podeDuplicar: boolean;
  podeExcluir: boolean;
}

function TemplateCard({ template, onEdit, onDuplicate, onView, onDelete, podeEditar, podeDuplicar, podeExcluir }: TemplateCardProps) {
  const categoria = template.categoria;
  const cor = coresCategorias[categoria?.cor || 'gray'];
  const IconeCategoria = iconesCategorias[categoria?.icone || 'FileText'] || FileText;

  // Verificar se o template está restrito
  const temAcoesDisponiveis = podeEditar || podeDuplicar || podeExcluir;

  return (
    <Card className="group hover:shadow-md transition-all duration-200 border-border/50">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Ícone da categoria */}
          <div className={`p-2 rounded-lg ${cor.iconBg} text-white flex-shrink-0`}>
            <IconeCategoria className="h-5 w-5" />
          </div>

          {/* Conteúdo */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-semibold text-foreground truncate">{template.nome}</h3>
                <p className="text-xs text-muted-foreground">{template.codigo}</p>
              </div>

              {/* Menu de ações */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onView(template.id)}>
                    <Eye className="h-4 w-4 mr-2" />
                    Visualizar
                  </DropdownMenuItem>
                  
                  {podeEditar && (
                    <DropdownMenuItem onClick={() => onEdit(template.id)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Editar
                    </DropdownMenuItem>
                  )}
                  
                  {podeDuplicar && (
                    <DropdownMenuItem onClick={() => onDuplicate(template.id)}>
                      <Copy className="h-4 w-4 mr-2" />
                      Duplicar
                    </DropdownMenuItem>
                  )}
                  
                  {podeExcluir && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={() => onDelete(template.id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Excluir
                      </DropdownMenuItem>
                    </>
                  )}
                  
                  {!temAcoesDisponiveis && (
                    <DropdownMenuItem disabled className="text-muted-foreground">
                      <Lock className="h-4 w-4 mr-2" />
                      Sem permissão para editar
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Descrição */}
            {template.descricao && (
              <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                {template.descricao}
              </p>
            )}

            {/* Badges */}
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <Badge variant="secondary" className={`${cor.bg} ${cor.text} border-0`}>
                {categoria?.nome || 'Sem categoria'}
              </Badge>
              
              {template.requer_assinatura && (
                <Badge variant="outline" className="gap-1">
                  <PenTool className="h-3 w-3" />
                  Assinatura
                </Badge>
              )}
              
              <Badge variant="outline" className="text-muted-foreground">
                v{template.versao}
              </Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TemplateCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-3 w-1/4" />
            <Skeleton className="h-4 w-full mt-2" />
            <div className="flex gap-2 mt-3">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-5 w-16" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function TemplatesList() {
  const navigate = useNavigate();
  const [busca, setBusca] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('all');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);

  const { data: templates, isLoading: loadingTemplates } = useDocumentoTemplates();
  const { data: categorias } = useDocumentoCategorias();
  const deleteTemplate = useDeleteTemplate();
  const duplicateTemplate = useDuplicateTemplate();
  
  // Permissões do módulo de documentos
  const { 
    podeCriarTemplate, 
    podeEditarTemplate, 
    podeExcluirTemplate,
    podeEditarTemplateEspecifico 
  } = useDocumentoPermissoes();

  // Filtrar templates
  const templatesFiltrados = templates?.filter(template => {
    const matchBusca = !busca || 
      template.nome.toLowerCase().includes(busca.toLowerCase()) ||
      template.codigo.toLowerCase().includes(busca.toLowerCase());
    
    const matchCategoria = categoriaFiltro === 'all' || template.categoria_id === categoriaFiltro;

    return matchBusca && matchCategoria;
  });

  const handleEdit = (id: string) => {
    navigate(`/documentos/templates/${id}`);
  };

  const handleView = (id: string) => {
    setViewId(id);
  };

  const handleDuplicate = (id: string) => {
    duplicateTemplate.mutate(id);
  };

  const handleDelete = (id: string) => {
    setDeleteId(id);
  };

  const confirmDelete = () => {
    if (deleteId) {
      deleteTemplate.mutate(deleteId);
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Templates de Documentos</h1>
          <p className="text-muted-foreground">
            Gerencie os modelos de documentos do sistema
          </p>
        </div>
        {podeCriarTemplate && (
          <Button asChild>
            <Link to="/documentos/templates/novo">
              <Plus className="h-4 w-4 mr-2" />
              Novo Template
            </Link>
          </Button>
        )}
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou código..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={categoriaFiltro} onValueChange={setCategoriaFiltro}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {categorias?.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Grid de Cards */}
      {loadingTemplates ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <TemplateCardSkeleton key={i} />
          ))}
        </div>
      ) : templatesFiltrados && templatesFiltrados.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templatesFiltrados.map((template) => {
            // Verificar permissão específica para este template
            const podeEditarEste = podeEditarTemplateEspecifico((template as any).perfis_permitidos);
            
            return (
              <TemplateCard
                key={template.id}
                template={template}
                onEdit={handleEdit}
                onDuplicate={handleDuplicate}
                onView={handleView}
                onDelete={handleDelete}
                podeEditar={podeEditarEste}
                podeDuplicar={podeCriarTemplate}
                podeExcluir={podeExcluirTemplate}
              />
            );
          })}
        </div>
      ) : (
        <Card className="p-12">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="p-4 rounded-full bg-muted mb-4">
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-lg">Nenhum template encontrado</h3>
            <p className="text-muted-foreground mt-1 max-w-sm">
              {busca || categoriaFiltro !== 'all' 
                ? 'Tente ajustar os filtros de busca.'
                : 'Comece criando seu primeiro template de documento.'}
            </p>
            {!busca && categoriaFiltro === 'all' && (
              <Button asChild className="mt-4">
                <Link to="/documentos/templates/novo">
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Template
                </Link>
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir template?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O template será removido permanentemente do sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de visualização de template */}
      <ModalVisualizarTemplate
        templateId={viewId}
        open={!!viewId}
        onOpenChange={(open) => !open && setViewId(null)}
        onEdit={podeEditarTemplate ? handleEdit : undefined}
      />
    </div>
  );
}
