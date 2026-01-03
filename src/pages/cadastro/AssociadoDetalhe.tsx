import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Phone, Mail, MessageCircle, MapPin, Calendar, User, Car, FileCheck, FileText, Clock, Edit, Ban, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  STATUS_ASSOCIADO_LABELS, 
  STATUS_VEICULO_LABELS,
  STATUS_DOCUMENTO_LABELS,
  TIPO_DOCUMENTO_LABELS,
  STATUS_CONTRATO_LABELS,
  type StatusAssociado,
  type StatusVeiculo,
  type StatusDocumento,
  type TipoDocumento,
} from '@/types/database';
import { useAssociado } from '@/hooks/useAssociados';
import { useVeiculos } from '@/hooks/useVeiculos';
import { useDocumentosByAssociado } from '@/hooks/useDocumentos';
import { DocumentoAnaliseDialog } from '@/components/cadastro/DocumentoAnaliseDialog';

const statusColors: Record<StatusAssociado, string> = {
  em_analise: 'bg-blue-500 text-white',
  aprovado: 'bg-green-100 text-green-800',
  documentacao_pendente: 'bg-yellow-500 text-white',
  aguardando_instalacao: 'bg-purple-500 text-white',
  ativo: 'bg-green-500 text-white',
  inadimplente: 'bg-orange-500 text-white',
  suspenso: 'bg-gray-500 text-white',
  cancelado: 'bg-destructive text-destructive-foreground',
  bloqueado: 'bg-red-700 text-white',
};

const veiculoStatusColors: Record<StatusVeiculo, string> = {
  em_analise: 'bg-blue-100 text-blue-800',
  aprovado: 'bg-green-100 text-green-800',
  instalacao_pendente: 'bg-yellow-100 text-yellow-800',
  ativo: 'bg-green-500 text-white',
  suspenso: 'bg-orange-100 text-orange-800',
  cancelado: 'bg-red-100 text-red-800',
  sinistrado: 'bg-purple-100 text-purple-800',
};

const docStatusColors: Record<StatusDocumento, string> = {
  pendente: 'bg-yellow-500 text-white',
  em_analise: 'bg-blue-500 text-white',
  aprovado: 'bg-green-500 text-white',
  reprovado: 'bg-destructive text-destructive-foreground',
  expirado: 'bg-gray-500 text-white',
};

export default function AssociadoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [analyzeDocId, setAnalyzeDocId] = useState<string | null>(null);

  const { data: associado, isLoading } = useAssociado(id);
  const { data: veiculos } = useVeiculos(id);
  const { data: documentos } = useDocumentosByAssociado(id);

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('pt-BR');
  };

  const formatCurrency = (value: number | null | undefined) => {
    if (!value) return 'N/A';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const handleWhatsApp = () => {
    if (associado?.telefone) {
      const phone = associado.telefone.replace(/\D/g, '');
      window.open(`https://wa.me/55${phone}`, '_blank');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!associado) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <User className="h-12 w-12 text-muted-foreground/50" />
        <h3 className="mt-4 font-semibold">Associado não encontrado</h3>
        <Button variant="link" onClick={() => navigate('/cadastro/associados')}>
          Voltar para a lista
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/cadastro/associados')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{associado.nome}</h1>
              <Badge className={statusColors[associado.status as StatusAssociado]}>
                {STATUS_ASSOCIADO_LABELS[associado.status as StatusAssociado]}
              </Badge>
              {associado.bloqueado && (
                <Badge className="bg-red-700 text-white">
                  <Ban className="mr-1 h-3 w-3" />
                  Bloqueado
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground">CPF: {associado.cpf}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleWhatsApp}>
            <MessageCircle className="mr-2 h-4 w-4" />
            WhatsApp
          </Button>
          <Button variant="outline" size="sm">
            <Edit className="mr-2 h-4 w-4" />
            Editar
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="dados" className="space-y-4">
        <TabsList>
          <TabsTrigger value="dados">
            <User className="mr-2 h-4 w-4" />
            Dados
          </TabsTrigger>
          <TabsTrigger value="veiculos">
            <Car className="mr-2 h-4 w-4" />
            Veículos ({veiculos?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="documentos">
            <FileCheck className="mr-2 h-4 w-4" />
            Documentos ({documentos?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="contrato">
            <FileText className="mr-2 h-4 w-4" />
            Contrato
          </TabsTrigger>
          <TabsTrigger value="historico">
            <Clock className="mr-2 h-4 w-4" />
            Histórico
          </TabsTrigger>
        </TabsList>

        {/* Tab: Dados */}
        <TabsContent value="dados" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Dados Pessoais */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Dados Pessoais</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Nome</p>
                    <p className="font-medium">{associado.nome}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">CPF</p>
                    <p className="font-medium">{associado.cpf}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">RG</p>
                    <p className="font-medium">{associado.rg || '-'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Data de Nascimento</p>
                    <p className="font-medium">{formatDate(associado.data_nascimento)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Sexo</p>
                    <p className="font-medium">{associado.sexo || '-'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Estado Civil</p>
                    <p className="font-medium">{associado.estado_civil || '-'}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Profissão</p>
                    <p className="font-medium">{associado.profissao || '-'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Contato */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Contato</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Telefone</p>
                    <p className="font-medium">{associado.telefone}</p>
                  </div>
                </div>
                {associado.whatsapp && (
                  <div className="flex items-center gap-3">
                    <MessageCircle className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">WhatsApp</p>
                      <p className="font-medium">{associado.whatsapp}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">E-mail</p>
                    <p className="font-medium">{associado.email}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Endereço */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Endereço</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-start gap-3">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-1" />
                  <div className="text-sm">
                    {associado.logradouro ? (
                      <>
                        <p className="font-medium">
                          {associado.logradouro}, {associado.numero}
                          {associado.complemento && ` - ${associado.complemento}`}
                        </p>
                        <p className="text-muted-foreground">
                          {associado.bairro} - {associado.cidade}/{associado.uf}
                        </p>
                        <p className="text-muted-foreground">CEP: {associado.cep}</p>
                      </>
                    ) : (
                      <p className="text-muted-foreground">Endereço não cadastrado</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Associação */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Associação</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Plano</p>
                    <p className="font-medium">{associado.planos?.nome || '-'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Status</p>
                    <Badge className={statusColors[associado.status as StatusAssociado]}>
                      {STATUS_ASSOCIADO_LABELS[associado.status as StatusAssociado]}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Data de Adesão</p>
                    <p className="font-medium">{formatDate(associado.data_adesao)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Dia de Vencimento</p>
                    <p className="font-medium">
                      {associado.dia_vencimento ? `Dia ${associado.dia_vencimento}` : '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Cadastrado em</p>
                    <p className="font-medium">{formatDate(associado.created_at)}</p>
                  </div>
                </div>

                {associado.bloqueado && associado.motivo_bloqueio && (
                  <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="font-medium">Motivo do bloqueio:</span>
                    </div>
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                      {associado.motivo_bloqueio}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab: Veículos */}
        <TabsContent value="veiculos">
          <Card>
            <CardContent className="p-0">
              {!veiculos?.length ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Car className="h-12 w-12 text-muted-foreground/50" />
                  <h3 className="mt-4 font-semibold">Nenhum veículo cadastrado</h3>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Veículo</TableHead>
                      <TableHead>Placa</TableHead>
                      <TableHead>Ano</TableHead>
                      <TableHead>Valor FIPE</TableHead>
                      <TableHead>Uso App</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {veiculos.map((veiculo) => (
                      <TableRow key={veiculo.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{veiculo.marca}</p>
                            <p className="text-sm text-muted-foreground">{veiculo.modelo}</p>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono">{veiculo.placa}</TableCell>
                        <TableCell>{veiculo.ano_fabricacao}/{veiculo.ano_modelo}</TableCell>
                        <TableCell>{formatCurrency(veiculo.valor_fipe)}</TableCell>
                        <TableCell>
                          {veiculo.uso_aplicativo ? (
                            <Badge variant="outline">{veiculo.plataforma_app || 'Sim'}</Badge>
                          ) : (
                            <span className="text-muted-foreground">Não</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={veiculoStatusColors[(veiculo.status as StatusVeiculo) || 'em_analise']}>
                            {STATUS_VEICULO_LABELS[(veiculo.status as StatusVeiculo) || 'em_analise']}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Documentos */}
        <TabsContent value="documentos">
          <Card>
            <CardContent className="p-0">
              {!documentos?.length ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <FileCheck className="h-12 w-12 text-muted-foreground/50" />
                  <h3 className="mt-4 font-semibold">Nenhum documento enviado</h3>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Arquivo</TableHead>
                      <TableHead>Enviado em</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-24">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {documentos.map((doc) => (
                      <TableRow key={doc.id}>
                        <TableCell>
                          <Badge variant="outline">
                            {TIPO_DOCUMENTO_LABELS[doc.tipo as TipoDocumento]}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {doc.nome_arquivo}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(doc.created_at)}
                        </TableCell>
                        <TableCell>
                          <Badge className={docStatusColors[doc.status as StatusDocumento]}>
                            {STATUS_DOCUMENTO_LABELS[doc.status as StatusDocumento]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => window.open(doc.arquivo_url, '_blank')}
                            >
                              Ver
                            </Button>
                            {(doc.status === 'pendente' || doc.status === 'em_analise') && (
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => setAnalyzeDocId(doc.id)}
                              >
                                Analisar
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Contrato */}
        <TabsContent value="contrato">
          <Card>
            <CardContent className="p-6">
              {!associado.contratos ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <FileText className="h-12 w-12 text-muted-foreground/50" />
                  <h3 className="mt-4 font-semibold">Nenhum contrato vinculado</h3>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Número</p>
                      <p className="font-medium">{associado.contratos.numero}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Status</p>
                      <Badge>
                        {STATUS_CONTRATO_LABELS[associado.contratos.status]}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Data de Início</p>
                      <p className="font-medium">{formatDate(associado.contratos.data_inicio)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Valor Mensal</p>
                      <p className="font-medium">{formatCurrency(associado.contratos.valor_mensal)}</p>
                    </div>
                  </div>
                  {associado.contratos.autentique_url && (
                    <Separator />
                  )}
                  {associado.contratos.autentique_url && (
                    <Button 
                      variant="outline"
                      onClick={() => window.open(associado.contratos?.autentique_url || '', '_blank')}
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      Ver Contrato no Autentique
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Histórico */}
        <TabsContent value="historico">
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col items-center justify-center py-8">
                <Clock className="h-12 w-12 text-muted-foreground/50" />
                <h3 className="mt-4 font-semibold">Em desenvolvimento</h3>
                <p className="text-sm text-muted-foreground">
                  O histórico de atividades será exibido aqui
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog de Análise */}
      {analyzeDocId && (
        <DocumentoAnaliseDialog
          documentoId={analyzeDocId}
          open={!!analyzeDocId}
          onClose={() => setAnalyzeDocId(null)}
        />
      )}
    </div>
  );
}
