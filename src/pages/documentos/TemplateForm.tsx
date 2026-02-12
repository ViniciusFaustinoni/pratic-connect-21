import { useEffect, useState } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useDocumentoPermissoes } from '@/hooks/useDocumentoPermissoes';
import { 
  useDocumentoTemplate, 
  useDocumentoCategorias, 
  useCreateTemplate, 
  useUpdateTemplate 
} from '@/hooks/useDocumentoTemplates';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { TemplateEditor, getTemplateEditor } from '@/components/documentos/TemplateEditor';
import { VariaveisSelector } from '@/components/documentos/VariaveisSelector';
import { ArrowLeft, Save, FileText, PenTool, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

// Schema de validação
const templateSchema = z.object({
  nome: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
  codigo: z.string()
    .min(3, 'Código deve ter pelo menos 3 caracteres')
    .regex(/^[A-Z0-9_]+$/, 'Código deve conter apenas letras maiúsculas, números e underscores'),
  categoria_id: z.string().min(1, 'Selecione uma categoria'),
  descricao: z.string().optional(),
  conteudo: z.string().min(10, 'Conteúdo deve ter pelo menos 10 caracteres'),
  requer_assinatura: z.boolean().default(false),
  is_default_autentique: z.boolean().default(false),
});

type TemplateFormData = z.infer<typeof templateSchema>;

export default function TemplateForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = !!id;
  
  
  const { podeCriarTemplate, podeEditarTemplate } = useDocumentoPermissoes();
  const { data: template, isLoading: loadingTemplate } = useDocumentoTemplate(id);
  const { data: categorias, isLoading: loadingCategorias } = useDocumentoCategorias();
  const createTemplate = useCreateTemplate();
  const updateTemplate = useUpdateTemplate();

  const form = useForm<TemplateFormData>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      nome: '',
      codigo: '',
      categoria_id: '',
      descricao: '',
      conteudo: '',
      requer_assinatura: false,
      is_default_autentique: false,
    },
  });

  // Carregar dados do template para edição
  useEffect(() => {
    if (template && isEditing) {
      form.reset({
        nome: template.nome,
        codigo: template.codigo,
        categoria_id: template.categoria_id,
        descricao: template.descricao || '',
        conteudo: template.conteudo,
        requer_assinatura: template.requer_assinatura,
        is_default_autentique: template.is_default_autentique || false,
      });
    }
  }, [template, isEditing, form]);

  // Verificar permissões (após todos os hooks)
  if (!id && !podeCriarTemplate) {
    return <Navigate to="/documentos/templates" replace />;
  }
  if (id && !podeEditarTemplate) {
    return <Navigate to="/documentos/templates" replace />;
  }

  // Gerar código automaticamente baseado no nome
  const handleNomeChange = (nome: string) => {
    if (!isEditing && !form.getValues('codigo')) {
      const codigo = nome
        .toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Z0-9\s]/g, '')
        .replace(/\s+/g, '_')
        .slice(0, 20)
        + '_V1';
      form.setValue('codigo', codigo);
    }
  };

  // Inserir variável no editor TipTap na posição do cursor
  const handleInserirVariavel = (variavel: string) => {
    const ed = getTemplateEditor();
    if (ed) {
      ed.chain().focus().insertContent(variavel).run();
    } else {
      const conteudoAtual = form.getValues('conteudo');
      form.setValue('conteudo', conteudoAtual + variavel);
    }
  };

  const onSubmit = async (data: TemplateFormData) => {
    try {
      if (isEditing && id) {
        await updateTemplate.mutateAsync({
          id,
          ...data,
        });
      } else {
        await createTemplate.mutateAsync({
          codigo: data.codigo,
          nome: data.nome,
          categoria_id: data.categoria_id,
          conteudo: data.conteudo,
          descricao: data.descricao,
          requer_assinatura: data.requer_assinatura,
          is_default_autentique: data.is_default_autentique,
        });
      }
      navigate('/documentos/templates');
    } catch (error) {
      console.error('Erro ao salvar template:', error);
    }
  };

  const isLoading = loadingTemplate || loadingCategorias;
  const isSaving = createTemplate.isPending || updateTemplate.isPending;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-96 w-full" />
          </div>
          <Skeleton className="h-[500px] w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => navigate('/documentos/templates')}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {isEditing ? 'Editar Template' : 'Novo Template'}
          </h1>
          <p className="text-muted-foreground">
            {isEditing 
              ? `Editando: ${template?.nome}` 
              : 'Crie um novo modelo de documento'}
          </p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Coluna Principal */}
            <div className="lg:col-span-2 space-y-6">
              {/* Informações Básicas */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Informações Básicas
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="nome"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome do Template *</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Ex: Contrato de Filiação"
                              {...field}
                              onChange={(e) => {
                                field.onChange(e);
                                handleNomeChange(e.target.value);
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="codigo"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Código *</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="EX: CONTRATO_ADESAO_V1"
                              {...field}
                              onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                            />
                          </FormControl>
                          <FormDescription>
                            Identificador único (maiúsculas e underscores)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="categoria_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Categoria *</FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione a categoria" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {categorias?.map((cat) => (
                                <SelectItem key={cat.id} value={cat.id}>
                                  {cat.nome}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="requer_assinatura"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 pt-6">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel className="flex items-center gap-2">
                              <PenTool className="h-4 w-4" />
                              Requer assinatura digital
                            </FormLabel>
                            <FormDescription>
                              Documento precisará ser assinado
                            </FormDescription>
                          </div>
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="is_default_autentique"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-lg border border-primary/20 bg-primary/5 p-4">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="flex items-center gap-2 text-primary">
                            <FileText className="h-4 w-4" />
                            Usar como template padrão para Autentique
                          </FormLabel>
                          <FormDescription>
                            Este template será usado para gerar o Termo de Afiliação enviado para assinatura digital via Autentique.
                            Apenas um template pode ser marcado como padrão.
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="descricao"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Descrição</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Descreva brevemente o propósito deste template..."
                            className="resize-none"
                            rows={2}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              {/* Editor de Conteúdo */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Conteúdo do Documento</CardTitle>
                  <CardDescription>
                    Use {'{{variavel}}'} para inserir dados dinâmicos. Clique nas variáveis ao lado para inserir.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <FormField
                    control={form.control}
                    name="conteudo"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <TemplateEditor
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="Digite o conteúdo do documento aqui..."
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </div>

            {/* Coluna Lateral - Variáveis */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Variáveis Disponíveis</CardTitle>
                  <CardDescription>
                    Clique para inserir no documento
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <VariaveisSelector onSelect={handleInserirVariavel} />
                </CardContent>
              </Card>
            </div>
          </div>

          <Separator />

          {/* Botões de Ação */}
          <div className="flex items-center justify-end gap-4">
            <Button 
              type="button" 
              variant="outline"
              onClick={() => navigate('/documentos/templates')}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {isEditing ? 'Salvar Alterações' : 'Criar Template'}
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
