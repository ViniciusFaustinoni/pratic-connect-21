import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useParams, useNavigate } from 'react-router-dom';
import { format, parseISO, differenceInYears } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  ArrowLeft, User, Briefcase, FileText, Users, Gift, History, 
  Edit, MoreVertical, Download, Trash2, Plus, Upload,
  TrendingUp, Award, ArrowRightLeft, DollarSign, UserMinus, UserPlus,
  Mail, Phone, MapPin, Calendar, Building, Clock, CreditCard, AlertTriangle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';

const statusConfig: Record<string, { label: string; className: string }> = {
  ativo: { label: 'Ativo', className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' },
  ferias: { label: 'Férias', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' },
  afastado: { label: 'Afastado', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' },
  licenca: { label: 'Licença', className: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300' },
  desligado: { label: 'Desligado', className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300' },
};

const historicoIcons: Record<string, any> = {
  admissao: UserPlus,
  promocao: TrendingUp,
  merito: Award,
  transferencia: ArrowRightLeft,
  reajuste: DollarSign,
  demissao: UserMinus,
};

const FuncionarioDetalhe = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: funcionario, isLoading } = useQuery({
    queryKey: ['funcionario', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('funcionarios')
        .select(`
          *,
          cargo:cargos(*),
          departamento:departamentos(*),
          gestor:funcionarios!funcionarios_gestor_id_fkey(id, nome_completo)
        `)
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id
  });

  const { data: dependentes } = useQuery({
    queryKey: ['funcionario-dependentes', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('funcionarios_dependentes')
        .select('*')
        .eq('funcionario_id', id);
      return data;
    },
    enabled: !!id
  });

  const { data: documentos } = useQuery({
    queryKey: ['funcionario-documentos', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('funcionarios_documentos')
        .select('*')
        .eq('funcionario_id', id)
        .order('created_at', { ascending: false });
      return data;
    },
    enabled: !!id
  });

  const { data: historico } = useQuery({
    queryKey: ['funcionario-historico', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('funcionarios_historico')
        .select(`
          *,
          cargo_anterior:cargos!funcionarios_historico_cargo_anterior_id_fkey(nome),
          cargo_novo:cargos!funcionarios_historico_cargo_novo_id_fkey(nome)
        `)
        .eq('funcionario_id', id)
        .order('data_vigencia', { ascending: false });
      return data;
    },
    enabled: !!id
  });

  const { data: beneficios } = useQuery({
    queryKey: ['funcionario-beneficios', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('funcionarios_beneficios')
        .select(`
          *,
          beneficio:beneficios(*)
        `)
        .eq('funcionario_id', id)
        .eq('ativo', true);
      return data;
    },
    enabled: !!id
  });

  const getInitials = (nome: string) => {
    return nome?.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() || '??';
  };

  const formatCPF = (cpf: string) => {
    return cpf?.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') || '-';
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
  };

  const formatPhone = (phone: string) => {
    if (!phone) return '-';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11) {
      return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    }
    return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  };

  const isDocumentoVencido = (validade: string) => {
    if (!validade) return false;
    return new Date(validade) < new Date();
  };

  const isDocumentoVencendo = (validade: string) => {
    if (!validade) return false;
    const diff = new Date(validade).getTime() - new Date().getTime();
    const days = diff / (1000 * 60 * 60 * 24);
    return days > 0 && days <= 30;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-20 w-20 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!funcionario) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-muted-foreground">Funcionário não encontrado</p>
        <Button variant="link" onClick={() => navigate('/rh/funcionarios')}>
          Voltar para lista
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/rh/funcionarios')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Avatar className="h-20 w-20">
            <AvatarImage src={funcionario.foto_url || ''} />
            <AvatarFallback className="text-2xl">{getInitials(funcionario.nome_completo)}</AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{funcionario.nome_completo}</h1>
              <Badge className={statusConfig[funcionario.status]?.className || ''}>
                {statusConfig[funcionario.status]?.label || funcionario.status}
              </Badge>
            </div>
            <p className="text-muted-foreground">{funcionario.matricula}</p>
            <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
              <Briefcase className="h-4 w-4" />
              <span>{funcionario.cargo?.nome || '-'}</span>
              <span>•</span>
              <Building className="h-4 w-4" />
              <span>{funcionario.departamento?.nome || '-'}</span>
            </div>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <MoreVertical className="h-4 w-4 mr-2" />
              Ações
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => navigate(`/rh/funcionarios/${id}/editar`)}>
              <Edit className="h-4 w-4 mr-2" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <Calendar className="h-4 w-4 mr-2" />
              Registrar Afastamento
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Gift className="h-4 w-4 mr-2" />
              Solicitar Férias
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive">
              <UserMinus className="h-4 w-4 mr-2" />
              Desligar Funcionário
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="pessoais" className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="pessoais" className="flex items-center gap-1">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Pessoais</span>
          </TabsTrigger>
          <TabsTrigger value="profissionais" className="flex items-center gap-1">
            <Briefcase className="h-4 w-4" />
            <span className="hidden sm:inline">Profissionais</span>
          </TabsTrigger>
          <TabsTrigger value="documentos" className="flex items-center gap-1">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Documentos</span>
          </TabsTrigger>
          <TabsTrigger value="dependentes" className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Dependentes</span>
          </TabsTrigger>
          <TabsTrigger value="beneficios" className="flex items-center gap-1">
            <Gift className="h-4 w-4" />
            <span className="hidden sm:inline">Benefícios</span>
          </TabsTrigger>
          <TabsTrigger value="historico" className="flex items-center gap-1">
            <History className="h-4 w-4" />
            <span className="hidden sm:inline">Histórico</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab Dados Pessoais */}
        <TabsContent value="pessoais">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Informações Básicas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Nome Completo</p>
                  <p className="font-medium">{funcionario.nome_completo}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">CPF</p>
                  <p className="font-medium">{formatCPF(funcionario.cpf)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">RG</p>
                  <p className="font-medium">{funcionario.rg || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Data de Nascimento</p>
                  <p className="font-medium">
                    {funcionario.data_nascimento 
                      ? `${format(parseISO(funcionario.data_nascimento), 'dd/MM/yyyy')} (${differenceInYears(new Date(), parseISO(funcionario.data_nascimento))} anos)`
                      : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Sexo</p>
                  <p className="font-medium">{funcionario.sexo === 'M' ? 'Masculino' : funcionario.sexo === 'F' ? 'Feminino' : '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Estado Civil</p>
                  <p className="font-medium">{funcionario.estado_civil || '-'}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Contato
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">E-mail</p>
                  <p className="font-medium">{funcionario.email_pessoal || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Telefone</p>
                  <p className="font-medium">{formatPhone(funcionario.telefone)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Celular</p>
                  <p className="font-medium">{formatPhone(funcionario.celular)}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Endereço
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">CEP</p>
                  <p className="font-medium">{funcionario.cep || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Logradouro</p>
                  <p className="font-medium">
                    {funcionario.logradouro 
                      ? `${funcionario.logradouro}, ${funcionario.numero || 'S/N'}${funcionario.complemento ? ` - ${funcionario.complemento}` : ''}`
                      : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Bairro</p>
                  <p className="font-medium">{funcionario.bairro || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Cidade/UF</p>
                  <p className="font-medium">
                    {funcionario.cidade ? `${funcionario.cidade}/${funcionario.estado}` : '-'}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab Dados Profissionais */}
        <TabsContent value="profissionais">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Building className="h-4 w-4" />
                  Cargo e Departamento
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Cargo</p>
                  <p className="font-medium">{funcionario.cargo?.nome || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Departamento</p>
                  <p className="font-medium">{funcionario.departamento?.nome || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Gestor</p>
                  <p className="font-medium">{funcionario.gestor?.[0]?.nome_completo || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Data de Admissão</p>
                  <p className="font-medium">
                    {funcionario.data_admissao 
                      ? format(parseISO(funcionario.data_admissao), 'dd/MM/yyyy') 
                      : '-'}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Contrato
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Tipo de Contrato</p>
                  <p className="font-medium">{funcionario.tipo_contrato || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Carga Horária Semanal</p>
                  <p className="font-medium">{funcionario.carga_horaria_semanal ? `${funcionario.carga_horaria_semanal}h` : '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Horário</p>
                  <p className="font-medium">
                    {funcionario.horario_entrada && funcionario.horario_saida 
                      ? `${funcionario.horario_entrada} às ${funcionario.horario_saida}`
                      : '-'}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Remuneração
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Salário Atual</p>
                  <p className="font-medium text-lg">{formatCurrency(funcionario.salario_atual)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Banco</p>
                  <p className="font-medium">{funcionario.banco || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Agência / Conta</p>
                  <p className="font-medium">
                    {funcionario.agencia && funcionario.conta 
                      ? `${funcionario.agencia} / ${funcionario.conta}`
                      : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Chave PIX</p>
                  <p className="font-medium">{funcionario.pix_chave || '-'}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Documentos Trabalhistas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">CTPS</p>
                  <p className="font-medium">
                    {funcionario.ctps_numero 
                      ? `${funcionario.ctps_numero} / ${funcionario.ctps_serie}`
                      : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">PIS/PASEP</p>
                  <p className="font-medium">{funcionario.pis || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Título de Eleitor</p>
                  <p className="font-medium">{funcionario.titulo_eleitor || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">CNH</p>
                  <p className="font-medium">
                    {funcionario.cnh 
                      ? `${funcionario.cnh} (Cat. ${funcionario.cnh_categoria})`
                      : '-'}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab Documentos */}
        <TabsContent value="documentos">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Documentos</CardTitle>
              <Button size="sm">
                <Upload className="h-4 w-4 mr-2" />
                Upload Documento
              </Button>
            </CardHeader>
            <CardContent>
              {documentos?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum documento cadastrado
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Validade</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {documentos?.map((doc) => (
                      <TableRow key={doc.id}>
                        <TableCell>{doc.tipo}</TableCell>
                        <TableCell>{doc.nome}</TableCell>
                        <TableCell>
                          {doc.data_validade 
                            ? format(parseISO(doc.data_validade), 'dd/MM/yyyy')
                            : '-'}
                        </TableCell>
                        <TableCell>
                          {isDocumentoVencido(doc.data_validade) ? (
                            <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                              <AlertTriangle className="h-3 w-3" />
                              Vencido
                            </Badge>
                          ) : isDocumentoVencendo(doc.data_validade) ? (
                            <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300">
                              Vencendo
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Válido</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon">
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon">
                              <Trash2 className="h-4 w-4" />
                            </Button>
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

        {/* Tab Dependentes */}
        <TabsContent value="dependentes">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Dependentes</CardTitle>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Dependente
              </Button>
            </CardHeader>
            <CardContent>
              {dependentes?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum dependente cadastrado
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Parentesco</TableHead>
                      <TableHead>Nascimento</TableHead>
                      <TableHead>CPF</TableHead>
                      <TableHead>IR</TableHead>
                      <TableHead>Plano Saúde</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dependentes?.map((dep) => (
                      <TableRow key={dep.id}>
                        <TableCell className="font-medium">{dep.nome}</TableCell>
                        <TableCell>{dep.parentesco}</TableCell>
                        <TableCell>
                          {dep.data_nascimento 
                            ? format(parseISO(dep.data_nascimento), 'dd/MM/yyyy')
                            : '-'}
                        </TableCell>
                        <TableCell>{formatCPF(dep.cpf)}</TableCell>
                        <TableCell>
                          <Badge variant={dep.inclui_ir ? 'default' : 'secondary'}>
                            {dep.inclui_ir ? 'Sim' : 'Não'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={dep.inclui_plano_saude ? 'default' : 'secondary'}>
                            {dep.inclui_plano_saude ? 'Sim' : 'Não'}
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

        {/* Tab Benefícios */}
        <TabsContent value="beneficios">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Benefícios Ativos</CardTitle>
            </CardHeader>
            <CardContent>
              {beneficios?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum benefício ativo
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Benefício</TableHead>
                      <TableHead>Fornecedor</TableHead>
                      <TableHead>Valor Empresa</TableHead>
                      <TableHead>Valor Funcionário</TableHead>
                      <TableHead>Data Início</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {beneficios?.map((ben) => (
                      <TableRow key={ben.id}>
                        <TableCell>
                          <Badge variant="outline">{ben.beneficio?.tipo}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">{ben.beneficio?.nome}</TableCell>
                        <TableCell>{ben.beneficio?.fornecedor || '-'}</TableCell>
                        <TableCell>{formatCurrency(ben.valor_empresa)}</TableCell>
                        <TableCell>{formatCurrency(ben.valor_funcionario)}</TableCell>
                        <TableCell>
                          {ben.data_inicio 
                            ? format(parseISO(ben.data_inicio), 'dd/MM/yyyy')
                            : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Histórico */}
        <TabsContent value="historico">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Histórico de Movimentações</CardTitle>
            </CardHeader>
            <CardContent>
              {historico?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum registro no histórico
                </div>
              ) : (
                <div className="relative pl-6 space-y-6">
                  <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-border" />
                  {historico?.map((item, index) => {
                    const Icon = historicoIcons[item.tipo] || History;
                    return (
                      <div key={item.id} className="relative flex gap-4">
                        <div className="absolute -left-4 p-1.5 bg-background border rounded-full">
                          <Icon className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 ml-4">
                          <div className="flex items-center gap-2">
                            <span className="font-medium capitalize">{item.tipo?.replace('_', ' ')}</span>
                            <span className="text-sm text-muted-foreground">
                              {item.data_vigencia && format(parseISO(item.data_vigencia), "dd/MM/yyyy", { locale: ptBR })}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{item.motivo || '-'}</p>
                          {(item.salario_anterior || item.salario_novo) && (
                            <p className="text-sm mt-1">
                              <span className="text-muted-foreground">Salário:</span>{' '}
                              {formatCurrency(item.salario_anterior)} → {formatCurrency(item.salario_novo)}
                            </p>
                          )}
                          {(item.cargo_anterior || item.cargo_novo) && (
                            <p className="text-sm mt-1">
                              <span className="text-muted-foreground">Cargo:</span>{' '}
                              {item.cargo_anterior?.nome || '-'} → {item.cargo_novo?.nome || '-'}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default FuncionarioDetalhe;
