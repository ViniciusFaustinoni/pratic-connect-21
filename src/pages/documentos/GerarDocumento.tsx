import { useState, useEffect, useCallback } from 'react';
import { useDocumentoTemplates, useDocumentoCategorias, DocumentoTemplateView } from '@/hooks/useDocumentoTemplates';
import { useGerarDocumento } from '@/hooks/useGerarDocumento';
import { DocumentoTemplate } from '@/types/documentos';
import { DocumentoStepper } from '@/components/documentos/DocumentoStepper';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Search, 
  ChevronRight, 
  ChevronLeft, 
  Download, 
  ExternalLink, 
  User, 
  Car, 
  FileText, 
  Phone,
  MapPin,
  FileSignature,
  ScrollText,
  FileCheck,
  ClipboardList,
  Mail,
  Loader2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

// Tipo extendido com categoria
type TemplateComCategoria = DocumentoTemplateView & { 
  categoria?: { id: string; nome: string; cor?: string; icone?: string } | null 
};

// Mapeamento de ícones
const iconesCategorias: Record<string, React.ComponentType<{ className?: string }>> = {
  FileSignature: FileSignature,
  ScrollText: ScrollText,
  FileCheck: FileCheck,
  ClipboardList: ClipboardList,
  Mail: Mail,
  FileText: FileText,
};

// Cores das categorias
const coresCategorias: Record<string, string> = {
  blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  green: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  purple: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  orange: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  red: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  yellow: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
};

interface Associado {
  id: string;
  nome: string;
  cpf: string;
  telefone: string | null;
  email: string | null;
  cidade: string | null;
  uf: string | null;
  veiculos: { placa: string; modelo: string | null }[];
}

export default function GerarDocumento() {
  // States para o wizard
  const [step, setStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  // Step 1 - Associado
  const [termoBusca, setTermoBusca] = useState('');
  const [associados, setAssociados] = useState<Associado[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [associadoSelecionado, setAssociadoSelecionado] = useState<Associado | null>(null);

  // Step 2 - Template
  const [categoriaFiltro, setCategoriaFiltro] = useState('all');
  const [templateSelecionado, setTemplateSelecionado] = useState<TemplateComCategoria | null>(null);

  // Step 3 - Geração
  const [salvarHistorico, setSalvarHistorico] = useState(true);
  const [previewConteudo, setPreviewConteudo] = useState('');
  const [carregandoPreview, setCarregandoPreview] = useState(false);

  // Hooks
  const { data: templates, isLoading: loadingTemplates } = useDocumentoTemplates();
  const { data: categorias } = useDocumentoCategorias();
  const { gerarDocumento, previewDocumento, gerando, progresso } = useGerarDocumento();

  // Buscar associados com debounce
  const buscarAssociados = useCallback(async (termo: string) => {
    if (termo.length < 2) {
      setAssociados([]);
      return;
    }

    setBuscando(true);
    try {
      const { data, error } = await supabase
        .from('associados')
        .select('id, nome, cpf, telefone, email, cidade, uf, veiculos(placa, modelo)')
        .or(`nome.ilike.%${termo}%,cpf.ilike.%${termo}%`)
        .limit(10);

      if (!error && data) {
        setAssociados(data as unknown as Associado[]);
      }
    } catch (error) {
      console.error('Erro ao buscar associados:', error);
    } finally {
      setBuscando(false);
    }
  }, []);

  // Debounce da busca
  useEffect(() => {
    const timer = setTimeout(() => {
      buscarAssociados(termoBusca);
    }, 300);

    return () => clearTimeout(timer);
  }, [termoBusca, buscarAssociados]);

  // Converter template para tipo esperado pelo hook
  const convertToDocumentoTemplate = (template: TemplateComCategoria): DocumentoTemplate => ({
    id: template.id,
    categoria_id: template.categoria_id,
    nome: template.nome,
    codigo: template.codigo,
    descricao: template.descricao,
    versao: template.versao,
    conteudo: template.conteudo,
    variaveis: template.variaveis,
    config_layout: template.config_layout,
    ativo: template.ativo,
    requer_assinatura: template.requer_assinatura,
    created_at: template.created_at,
    updated_at: template.updated_at,
  });

  // Carregar preview quando chegar no step 3
  useEffect(() => {
    const carregarPreview = async () => {
      if (step === 3 && associadoSelecionado && templateSelecionado) {
        setCarregandoPreview(true);
        try {
          const conteudo = await previewDocumento(
            convertToDocumentoTemplate(templateSelecionado),
            associadoSelecionado.id
          );
          setPreviewConteudo(conteudo);
        } catch (error) {
          console.error('Erro ao carregar preview:', error);
        } finally {
          setCarregandoPreview(false);
        }
      }
    };

    carregarPreview();
  }, [step, associadoSelecionado, templateSelecionado, previewDocumento]);

  // Filtrar templates por categoria
  const templatesFiltrados = (templates as TemplateComCategoria[] | undefined)?.filter(
    (t) => categoriaFiltro === 'all' || t.categoria_id === categoriaFiltro
  );

  // Formatar CPF
  const formatarCPF = (cpf: string) => {
    const numeros = cpf.replace(/\D/g, '');
    return numeros.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  // Navegar para próximo step
  const proximoStep = () => {
    setCompletedSteps((prev) => [...prev, step]);
    setStep((prev) => prev + 1);
  };

  // Navegar para step anterior
  const stepAnterior = () => {
    setStep((prev) => prev - 1);
  };

  // Gerar documento
  const handleGerarDocumento = async (modo: 'baixar' | 'abrir') => {
    if (!associadoSelecionado || !templateSelecionado) return;

    await gerarDocumento(
      convertToDocumentoTemplate(templateSelecionado),
      associadoSelecionado.id,
      { modo, salvarHistorico }
    );
  };

  // Renderizar ícone da categoria
  const renderIconeCategoria = (icone: string | undefined) => {
    const Icon = icone && iconesCategorias[icone] ? iconesCategorias[icone] : FileText;
    return <Icon className="h-5 w-5" />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Gerar Documento</h1>
        <p className="text-muted-foreground">
          Selecione o associado e o tipo de documento
        </p>
      </div>

      {/* Stepper */}
      <Card>
        <CardContent className="pt-6">
          <DocumentoStepper currentStep={step} completedSteps={completedSteps} />
        </CardContent>
      </Card>

      {/* Step 1 - Selecionar Associado */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Selecionar Associado
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Campo de busca */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, CPF ou placa..."
                value={termoBusca}
                onChange={(e) => setTermoBusca(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Loading */}
            {buscando && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {/* Resultados da busca */}
            {!buscando && associados.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  {associados.length} resultado(s) encontrado(s)
                </p>
                <div className="grid gap-2">
                  {associados.map((associado) => (
                    <Card
                      key={associado.id}
                      className={`cursor-pointer transition-all hover:shadow-md ${
                        associadoSelecionado?.id === associado.id
                          ? 'ring-2 ring-primary bg-primary/5'
                          : ''
                      }`}
                      onClick={() => setAssociadoSelecionado(associado)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <p className="font-semibold text-foreground">
                              {associado.nome}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              CPF: {formatarCPF(associado.cpf)}
                            </p>
                            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                              {associado.telefone && (
                                <span className="flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  {associado.telefone}
                                </span>
                              )}
                              {associado.cidade && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {associado.cidade}/{associado.uf}
                                </span>
                              )}
                            </div>
                          </div>
                          {associado.veiculos && associado.veiculos.length > 0 && (
                            <div className="text-right">
                              <Badge variant="outline" className="flex items-center gap-1">
                                <Car className="h-3 w-3" />
                                {associado.veiculos[0].placa}
                              </Badge>
                              {associado.veiculos[0].modelo && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {associado.veiculos[0].modelo}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Estado vazio */}
            {!buscando && termoBusca.length >= 2 && associados.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <User className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Nenhum associado encontrado</p>
              </div>
            )}

            {/* Instrução inicial */}
            {!buscando && termoBusca.length < 2 && (
              <div className="text-center py-8 text-muted-foreground">
                <Search className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Digite pelo menos 2 caracteres para buscar</p>
              </div>
            )}

            {/* Botão próximo */}
            <div className="flex justify-end pt-4 border-t">
              <Button
                onClick={proximoStep}
                disabled={!associadoSelecionado}
              >
                Próximo
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2 - Selecionar Template */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Selecionar Documento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Filtro por categoria */}
            <Select value={categoriaFiltro} onValueChange={setCategoriaFiltro}>
              <SelectTrigger className="w-full md:w-64">
                <SelectValue placeholder="Filtrar por categoria" />
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

            {/* Loading */}
            {loadingTemplates && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-32" />
                ))}
              </div>
            )}

            {/* Grid de templates */}
            {!loadingTemplates && templatesFiltrados && templatesFiltrados.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {templatesFiltrados.map((template) => {
                  const corCategoria = template.categoria?.cor || 'blue';
                  return (
                    <Card
                      key={template.id}
                      className={`cursor-pointer transition-all hover:shadow-md ${
                        templateSelecionado?.id === template.id
                          ? 'ring-2 ring-primary bg-primary/5'
                          : ''
                      }`}
                      onClick={() => setTemplateSelecionado(template)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div
                            className={`p-2 rounded-lg ${
                              coresCategorias[corCategoria] || coresCategorias.blue
                            }`}
                          >
                            {renderIconeCategoria(template.categoria?.icone)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-foreground truncate">
                              {template.nome}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {template.codigo}
                            </p>
                            {template.descricao && (
                              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                {template.descricao}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-2">
                              {template.categoria && (
                                <Badge variant="secondary" className="text-xs">
                                  {template.categoria.nome}
                                </Badge>
                              )}
                              {template.requer_assinatura && (
                                <Badge variant="outline" className="text-xs">
                                  Assinatura
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Estado vazio */}
            {!loadingTemplates && (!templatesFiltrados || templatesFiltrados.length === 0) && (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Nenhum template encontrado</p>
              </div>
            )}

            {/* Botões de navegação */}
            <div className="flex justify-between pt-4 border-t">
              <Button variant="outline" onClick={stepAnterior}>
                <ChevronLeft className="mr-2 h-4 w-4" />
                Voltar
              </Button>
              <Button onClick={proximoStep} disabled={!templateSelecionado}>
                Próximo
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3 - Preview e Confirmação */}
      {step === 3 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Resumo */}
          <div className="space-y-4">
            {/* Associado selecionado */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Associado Selecionado
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="font-semibold">{associadoSelecionado?.nome}</p>
                <p className="text-muted-foreground">
                  CPF: {formatarCPF(associadoSelecionado?.cpf || '')}
                </p>
                {associadoSelecionado?.telefone && (
                  <p className="text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {associadoSelecionado.telefone}
                  </p>
                )}
                {associadoSelecionado?.cidade && (
                  <p className="text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {associadoSelecionado.cidade}/{associadoSelecionado.uf}
                  </p>
                )}
                {associadoSelecionado?.veiculos && associadoSelecionado.veiculos.length > 0 && (
                  <p className="text-muted-foreground flex items-center gap-1">
                    <Car className="h-3 w-3" />
                    {associadoSelecionado.veiculos[0].modelo} - {associadoSelecionado.veiculos[0].placa}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Template selecionado */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Template Selecionado
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="font-semibold">{templateSelecionado?.nome}</p>
                <p className="text-muted-foreground">{templateSelecionado?.codigo}</p>
                {templateSelecionado?.categoria && (
                  <Badge variant="secondary" className="text-xs">
                    {templateSelecionado.categoria.nome}
                  </Badge>
                )}
                {templateSelecionado?.versao && (
                  <p className="text-muted-foreground">Versão: v{templateSelecionado.versao}</p>
                )}
              </CardContent>
            </Card>

            {/* Opções */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Opções</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="salvar-historico"
                    checked={salvarHistorico}
                    onCheckedChange={(checked) => setSalvarHistorico(checked === true)}
                  />
                  <label
                    htmlFor="salvar-historico"
                    className="text-sm text-muted-foreground cursor-pointer"
                  >
                    Salvar no histórico
                  </label>
                </div>
              </CardContent>
            </Card>

            {/* Botões de ação */}
            <div className="space-y-2">
              <Button
                className="w-full"
                onClick={() => handleGerarDocumento('baixar')}
                disabled={gerando}
              >
                {gerando ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                Baixar PDF
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => handleGerarDocumento('abrir')}
                disabled={gerando}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Abrir em nova aba
              </Button>
              <Button variant="ghost" className="w-full" onClick={stepAnterior}>
                <ChevronLeft className="mr-2 h-4 w-4" />
                Voltar
              </Button>
            </div>

            {/* Progresso */}
            {gerando && (
              <div className="space-y-2">
                <Progress value={progresso} />
                <p className="text-xs text-muted-foreground text-center">
                  Gerando documento... {progresso}%
                </p>
              </div>
            )}
          </div>

          {/* Preview */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Preview do Documento</CardTitle>
            </CardHeader>
            <CardContent>
              {carregandoPreview ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <ScrollArea className="h-[500px] border rounded-lg p-4 bg-muted/30">
                  <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                    {previewConteudo || 'Carregando preview...'}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
