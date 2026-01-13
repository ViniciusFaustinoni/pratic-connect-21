import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  Upload,
  FileText,
  Wand2,
  Loader2,
  Check,
  AlertCircle,
  Car,
  User,
  MapPin,
  CreditCard,
  X,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCotacao } from '@/hooks/useCotacoes';
import { usePlanos } from '@/hooks/usePlanos';
import { useExtrairDadosDocumentos, type ResultadoExtracao } from '@/hooks/useExtrairDadosDocumentos';
import { cn } from '@/lib/utils';

// ============================================
// TYPES
// ============================================
interface ContratoFormData {
  // Contratante
  contratante_nome: string;
  contratante_cpf: string;
  contratante_rg: string;
  contratante_data_nascimento: string;
  contratante_email: string;
  contratante_telefone: string;
  // Endereço
  contratante_cep: string;
  contratante_logradouro: string;
  contratante_numero: string;
  contratante_complemento: string;
  contratante_bairro: string;
  contratante_cidade: string;
  contratante_estado: string;
  // Veículo
  veiculo_marca: string;
  veiculo_modelo: string;
  veiculo_ano: string;
  veiculo_placa: string;
  veiculo_chassi: string;
  veiculo_renavam: string;
  veiculo_cor: string;
  veiculo_valor_fipe: string;
  // Plano e Valores
  plano_id: string;
  valor_adesao: string;
  valor_mensal: string;
  dia_vencimento: string;
  // Vínculos opcionais
  lead_id: string;
  cotacao_id: string;
}

interface UploadedFile {
  file: File;
  preview: string;
  uploading: boolean;
  url?: string;
  error?: string;
}

// ============================================
// COMPONENT
// ============================================
export default function ContratoNovo() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const cotacaoId = searchParams.get('cotacao');
  const { profile } = useAuth();

  const [formData, setFormData] = useState<ContratoFormData>({
    contratante_nome: '',
    contratante_cpf: '',
    contratante_rg: '',
    contratante_data_nascimento: '',
    contratante_email: '',
    contratante_telefone: '',
    contratante_cep: '',
    contratante_logradouro: '',
    contratante_numero: '',
    contratante_complemento: '',
    contratante_bairro: '',
    contratante_cidade: '',
    contratante_estado: '',
    veiculo_marca: '',
    veiculo_modelo: '',
    veiculo_ano: '',
    veiculo_placa: '',
    veiculo_chassi: '',
    veiculo_renavam: '',
    veiculo_cor: '',
    veiculo_valor_fipe: '',
    plano_id: '',
    valor_adesao: '',
    valor_mensal: '',
    dia_vencimento: '10',
    lead_id: '',
    cotacao_id: cotacaoId || '',
  });

  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionResult, setExtractionResult] = useState<ResultadoExtracao | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [leadSearch, setLeadSearch] = useState('');
  const [leadResults, setLeadResults] = useState<any[]>([]);
  const [isSearchingLead, setIsSearchingLead] = useState(false);

  const { data: cotacao, isLoading: loadingCotacao } = useCotacao(cotacaoId || undefined);
  const { data: planos } = usePlanos();
  const extrairDados = useExtrairDadosDocumentos();

  // Preencher dados da cotação quando carregada
  useEffect(() => {
    if (cotacao) {
      setFormData(prev => ({
        ...prev,
        contratante_nome: cotacao.leads?.nome || '',
        contratante_email: cotacao.leads?.email || '',
        contratante_telefone: cotacao.leads?.telefone || '',
        contratante_cpf: cotacao.leads?.cpf || '',
        veiculo_marca: cotacao.veiculo_marca || '',
        veiculo_modelo: cotacao.veiculo_modelo || '',
        veiculo_ano: String(cotacao.veiculo_ano || ''),
        veiculo_placa: cotacao.veiculo_placa || '',
        veiculo_valor_fipe: String(cotacao.valor_fipe || ''),
        plano_id: cotacao.plano_id || '',
        valor_adesao: String(cotacao.valor_adesao || ''),
        valor_mensal: String(cotacao.valor_total_mensal || ''),
        lead_id: cotacao.lead_id || '',
        cotacao_id: cotacao.id,
      }));
    }
  }, [cotacao]);

  // File Upload Handler
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const newFiles: UploadedFile[] = acceptedFiles.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      uploading: true,
    }));

    setUploadedFiles(prev => [...prev, ...newFiles]);

    // Upload each file to Supabase Storage
    for (let i = 0; i < acceptedFiles.length; i++) {
      const file = acceptedFiles[i];
      const fileExt = file.name.split('.').pop();
      const fileName = `contratos-temp/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from('documentos')
        .upload(fileName, file);

      setUploadedFiles(prev => prev.map((f, idx) => {
        if (f.file === file) {
          if (error) {
            return { ...f, uploading: false, error: error.message };
          }
          const { data: { publicUrl } } = supabase.storage
            .from('documentos')
            .getPublicUrl(fileName);
          return { ...f, uploading: false, url: publicUrl };
        }
        return f;
      }));
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.webp'],
      'application/pdf': ['.pdf'],
    },
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  // Remove file
  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Extract data with AI
  const handleExtractData = async () => {
    const urls = uploadedFiles.filter(f => f.url).map(f => f.url!);
    if (urls.length === 0) {
      toast.error('Faça upload de pelo menos um documento');
      return;
    }

    setIsExtracting(true);
    try {
      const result = await extrairDados.mutateAsync({ urls });
      setExtractionResult(result);

      // Fill form with extracted data
      const { cliente, endereco, veiculo } = result.dados_consolidados;

      setFormData(prev => ({
        ...prev,
        contratante_nome: cliente.nome || prev.contratante_nome,
        contratante_cpf: cliente.cpf || prev.contratante_cpf,
        contratante_rg: cliente.rg || prev.contratante_rg,
        contratante_data_nascimento: cliente.data_nascimento || prev.contratante_data_nascimento,
        contratante_cep: endereco.cep || prev.contratante_cep,
        contratante_logradouro: endereco.logradouro || prev.contratante_logradouro,
        contratante_numero: endereco.numero || prev.contratante_numero,
        contratante_complemento: endereco.complemento || prev.contratante_complemento,
        contratante_bairro: endereco.bairro || prev.contratante_bairro,
        contratante_cidade: endereco.cidade || prev.contratante_cidade,
        contratante_estado: endereco.estado || prev.contratante_estado,
        veiculo_placa: veiculo.placa || prev.veiculo_placa,
        veiculo_chassi: veiculo.chassi || prev.veiculo_chassi,
        veiculo_renavam: veiculo.renavam || prev.veiculo_renavam,
        veiculo_marca: veiculo.marca || prev.veiculo_marca,
        veiculo_modelo: veiculo.modelo || prev.veiculo_modelo,
        veiculo_ano: String(veiculo.ano_modelo || veiculo.ano_fabricacao || '') || prev.veiculo_ano,
        veiculo_cor: veiculo.cor || prev.veiculo_cor,
      }));

      toast.success('Dados extraídos com sucesso!');
      
      if (result.campos_faltantes.length > 0) {
        toast.warning(`Campos não encontrados: ${result.campos_faltantes.join(', ')}`);
      }
    } catch (error: any) {
      toast.error(error.message || 'Erro ao extrair dados');
    } finally {
      setIsExtracting(false);
    }
  };

  // Search leads
  const handleSearchLead = async () => {
    if (!leadSearch.trim()) return;
    
    setIsSearchingLead(true);
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('id, nome, telefone, email, cpf')
        .or(`nome.ilike.%${leadSearch}%,telefone.ilike.%${leadSearch}%,cpf.ilike.%${leadSearch}%`)
        .limit(10);

      if (error) throw error;
      setLeadResults(data || []);
    } catch (error) {
      console.error('Error searching leads:', error);
    } finally {
      setIsSearchingLead(false);
    }
  };

  // Select lead
  const handleSelectLead = (lead: any) => {
    setFormData(prev => ({
      ...prev,
      lead_id: lead.id,
      contratante_nome: lead.nome || prev.contratante_nome,
      contratante_email: lead.email || prev.contratante_email,
      contratante_telefone: lead.telefone || prev.contratante_telefone,
      contratante_cpf: lead.cpf || prev.contratante_cpf,
    }));
    setLeadResults([]);
    setLeadSearch('');
    toast.success(`Lead "${lead.nome}" vinculado`);
  };

  // Handle form change
  const handleChange = (field: keyof ContratoFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Generate contract number
  const generateNumero = () => {
    const year = new Date().getFullYear();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `CTR-${year}-${random}`;
  };

  // Save contract
  const handleSave = async () => {
    // Validations
    if (!formData.contratante_nome) {
      toast.error('Nome do contratante é obrigatório');
      return;
    }
    if (!formData.plano_id) {
      toast.error('Selecione um plano');
      return;
    }
    if (!formData.valor_adesao || !formData.valor_mensal) {
      toast.error('Informe os valores de adesão e mensalidade');
      return;
    }

    setIsSaving(true);
    try {
      const numero = generateNumero();
      
      const { data, error } = await supabase
        .from('contratos')
        .insert({
          numero,
          lead_id: formData.lead_id || null,
          cotacao_id: formData.cotacao_id || null,
          plano_id: formData.plano_id,
          valor_adesao: parseFloat(formData.valor_adesao),
          valor_mensal: parseFloat(formData.valor_mensal),
          dia_vencimento: parseInt(formData.dia_vencimento) || 10,
          data_inicio: new Date().toISOString().split('T')[0],
          status: 'pendente',
          vendedor_id: profile?.id || null,
          created_by: profile?.id || null,
        })
        .select()
        .single();

      if (error) throw error;

      // Update cotação status if linked
      if (formData.cotacao_id) {
        await supabase
          .from('cotacoes')
          .update({ status: 'aceita' })
          .eq('id', formData.cotacao_id);
      }

      // Update lead stage if linked
      if (formData.lead_id) {
        await supabase
          .from('leads')
          .update({ etapa: 'contrato_enviado', updated_at: new Date().toISOString() })
          .eq('id', formData.lead_id);
      }

      toast.success('Contrato criado com sucesso!');
      navigate(`/vendas/contratos/${data.id}`);
    } catch (error: any) {
      console.error('Error creating contract:', error);
      toast.error(error.message || 'Erro ao criar contrato');
    } finally {
      setIsSaving(false);
    }
  };

  // Format currency for display
  const formatCurrency = (value: string) => {
    const num = parseFloat(value);
    if (isNaN(num)) return '';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(num);
  };

  if (loadingCotacao && cotacaoId) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Breadcrumb */}
      <nav className="text-sm text-muted-foreground">
        <ol className="flex items-center gap-1">
          <li><Link to="/dashboard" className="hover:text-foreground">Home</Link></li>
          <li>/</li>
          <li><Link to="/vendas/contratos" className="hover:text-foreground">Contratos</Link></li>
          <li>/</li>
          <li className="text-foreground font-medium">Novo Contrato</li>
        </ol>
      </nav>

      {/* Back Button */}
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Novo Contrato</h1>
          <p className="text-muted-foreground">
            {cotacaoId 
              ? `Criando contrato a partir da cotação ${cotacao?.numero || ''}`
              : 'Preencha os dados ou faça upload de documentos para extração automática'}
          </p>
        </div>
        {cotacao && (
          <Badge variant="secondary">
            Cotação: {cotacao.numero}
          </Badge>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Form - 2 columns */}
        <div className="space-y-6 lg:col-span-2">
          {/* Upload de Documentos */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Upload de Documentos
              </CardTitle>
              <CardDescription>
                Faça upload de CNH, CRLV ou comprovante de residência para extrair dados automaticamente
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                {...getRootProps()}
                className={cn(
                  "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
                  isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
                )}
              >
                <input {...getInputProps()} />
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  {isDragActive
                    ? 'Solte os arquivos aqui...'
                    : 'Arraste arquivos ou clique para selecionar'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  PNG, JPG, WEBP ou PDF (máx. 10MB)
                </p>
              </div>

              {/* Uploaded Files */}
              {uploadedFiles.length > 0 && (
                <div className="space-y-2">
                  {uploadedFiles.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 p-2 border rounded-lg"
                    >
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <span className="flex-1 text-sm truncate">{file.file.name}</span>
                      {file.uploading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : file.error ? (
                        <Badge variant="destructive" className="text-xs">Erro</Badge>
                      ) : (
                        <Check className="h-4 w-4 text-green-500" />
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => removeFile(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  
                  <Button
                    onClick={handleExtractData}
                    disabled={isExtracting || uploadedFiles.some(f => f.uploading)}
                    className="w-full"
                  >
                    {isExtracting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Extraindo dados...
                      </>
                    ) : (
                      <>
                        <Wand2 className="mr-2 h-4 w-4" />
                        Extrair dados com IA
                      </>
                    )}
                  </Button>
                </div>
              )}

              {/* Extraction Result Warnings */}
              {extractionResult?.avisos && extractionResult.avisos.length > 0 && (
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
                    <div className="text-sm text-yellow-800 dark:text-yellow-200">
                      {extractionResult.avisos.map((aviso, i) => (
                        <p key={i}>{aviso}</p>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Dados do Contratante */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Dados do Contratante
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label>Nome Completo *</Label>
                  <Input
                    value={formData.contratante_nome}
                    onChange={(e) => handleChange('contratante_nome', e.target.value)}
                    placeholder="Nome completo"
                  />
                </div>
                <div>
                  <Label>CPF</Label>
                  <Input
                    value={formData.contratante_cpf}
                    onChange={(e) => handleChange('contratante_cpf', e.target.value)}
                    placeholder="000.000.000-00"
                  />
                </div>
                <div>
                  <Label>RG</Label>
                  <Input
                    value={formData.contratante_rg}
                    onChange={(e) => handleChange('contratante_rg', e.target.value)}
                    placeholder="RG"
                  />
                </div>
                <div>
                  <Label>Data de Nascimento</Label>
                  <Input
                    type="date"
                    value={formData.contratante_data_nascimento}
                    onChange={(e) => handleChange('contratante_data_nascimento', e.target.value)}
                  />
                </div>
                <div>
                  <Label>Telefone</Label>
                  <Input
                    value={formData.contratante_telefone}
                    onChange={(e) => handleChange('contratante_telefone', e.target.value)}
                    placeholder="(00) 00000-0000"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={formData.contratante_email}
                    onChange={(e) => handleChange('contratante_email', e.target.value)}
                    placeholder="email@exemplo.com"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Endereço */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Endereço
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <Label>CEP</Label>
                  <Input
                    value={formData.contratante_cep}
                    onChange={(e) => handleChange('contratante_cep', e.target.value)}
                    placeholder="00000-000"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label>Logradouro</Label>
                  <Input
                    value={formData.contratante_logradouro}
                    onChange={(e) => handleChange('contratante_logradouro', e.target.value)}
                    placeholder="Rua, Avenida..."
                  />
                </div>
                <div>
                  <Label>Número</Label>
                  <Input
                    value={formData.contratante_numero}
                    onChange={(e) => handleChange('contratante_numero', e.target.value)}
                    placeholder="Nº"
                  />
                </div>
                <div>
                  <Label>Complemento</Label>
                  <Input
                    value={formData.contratante_complemento}
                    onChange={(e) => handleChange('contratante_complemento', e.target.value)}
                    placeholder="Apto, Bloco..."
                  />
                </div>
                <div>
                  <Label>Bairro</Label>
                  <Input
                    value={formData.contratante_bairro}
                    onChange={(e) => handleChange('contratante_bairro', e.target.value)}
                    placeholder="Bairro"
                  />
                </div>
                <div>
                  <Label>Cidade</Label>
                  <Input
                    value={formData.contratante_cidade}
                    onChange={(e) => handleChange('contratante_cidade', e.target.value)}
                    placeholder="Cidade"
                  />
                </div>
                <div>
                  <Label>Estado</Label>
                  <Input
                    value={formData.contratante_estado}
                    onChange={(e) => handleChange('contratante_estado', e.target.value)}
                    placeholder="UF"
                    maxLength={2}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Dados do Veículo */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Car className="h-5 w-5" />
                Dados do Veículo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <Label>Marca</Label>
                  <Input
                    value={formData.veiculo_marca}
                    onChange={(e) => handleChange('veiculo_marca', e.target.value)}
                    placeholder="Ex: Fiat"
                  />
                </div>
                <div>
                  <Label>Modelo</Label>
                  <Input
                    value={formData.veiculo_modelo}
                    onChange={(e) => handleChange('veiculo_modelo', e.target.value)}
                    placeholder="Ex: Argo"
                  />
                </div>
                <div>
                  <Label>Ano</Label>
                  <Input
                    value={formData.veiculo_ano}
                    onChange={(e) => handleChange('veiculo_ano', e.target.value)}
                    placeholder="2024"
                  />
                </div>
                <div>
                  <Label>Placa</Label>
                  <Input
                    value={formData.veiculo_placa}
                    onChange={(e) => handleChange('veiculo_placa', e.target.value.toUpperCase())}
                    placeholder="ABC1D23"
                  />
                </div>
                <div>
                  <Label>Chassi</Label>
                  <Input
                    value={formData.veiculo_chassi}
                    onChange={(e) => handleChange('veiculo_chassi', e.target.value.toUpperCase())}
                    placeholder="Chassi"
                  />
                </div>
                <div>
                  <Label>Renavam</Label>
                  <Input
                    value={formData.veiculo_renavam}
                    onChange={(e) => handleChange('veiculo_renavam', e.target.value)}
                    placeholder="Renavam"
                  />
                </div>
                <div>
                  <Label>Cor</Label>
                  <Input
                    value={formData.veiculo_cor}
                    onChange={(e) => handleChange('veiculo_cor', e.target.value)}
                    placeholder="Cor"
                  />
                </div>
                <div>
                  <Label>Valor FIPE</Label>
                  <Input
                    type="number"
                    value={formData.veiculo_valor_fipe}
                    onChange={(e) => handleChange('veiculo_valor_fipe', e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - 1 column */}
        <div className="space-y-6">
          {/* Vincular Lead */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Vincular a Lead (opcional)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {formData.lead_id ? (
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <span className="text-sm font-medium">
                    Lead vinculado
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleChange('lead_id', '')}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Buscar por nome, telefone..."
                      value={leadSearch}
                      onChange={(e) => setLeadSearch(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearchLead()}
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleSearchLead}
                      disabled={isSearchingLead}
                    >
                      {isSearchingLead ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Search className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  {leadResults.length > 0 && (
                    <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                      {leadResults.map((lead) => (
                        <button
                          key={lead.id}
                          onClick={() => handleSelectLead(lead)}
                          className="w-full p-2 text-left hover:bg-muted transition-colors"
                        >
                          <p className="font-medium text-sm">{lead.nome}</p>
                          <p className="text-xs text-muted-foreground">{lead.telefone}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Plano e Valores */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CreditCard className="h-5 w-5" />
                Plano e Valores
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Plano *</Label>
                <Select
                  value={formData.plano_id}
                  onValueChange={(v) => handleChange('plano_id', v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o plano" />
                  </SelectTrigger>
                  <SelectContent>
                    {planos?.map((plano) => (
                      <SelectItem key={plano.id} value={plano.id}>
                        {plano.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Valor Adesão *</Label>
                <Input
                  type="number"
                  value={formData.valor_adesao}
                  onChange={(e) => handleChange('valor_adesao', e.target.value)}
                  placeholder="0.00"
                />
                {formData.valor_adesao && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatCurrency(formData.valor_adesao)}
                  </p>
                )}
              </div>

              <div>
                <Label>Valor Mensal *</Label>
                <Input
                  type="number"
                  value={formData.valor_mensal}
                  onChange={(e) => handleChange('valor_mensal', e.target.value)}
                  placeholder="0.00"
                />
                {formData.valor_mensal && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatCurrency(formData.valor_mensal)}
                  </p>
                )}
              </div>

              <div>
                <Label>Dia de Vencimento</Label>
                <Select
                  value={formData.dia_vencimento}
                  onValueChange={(v) => handleChange('dia_vencimento', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[5, 10, 15, 20, 25].map((dia) => (
                      <SelectItem key={dia} value={String(dia)}>
                        Dia {dia}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              {/* Summary */}
              {(formData.valor_adesao || formData.valor_mensal) && (
                <div className="space-y-2 pt-2">
                  <div className="flex justify-between text-sm">
                    <span>Adesão:</span>
                    <span className="font-medium">{formatCurrency(formData.valor_adesao)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Mensal:</span>
                    <span className="font-medium">{formatCurrency(formData.valor_mensal)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-medium">
                    <span>1º Pagamento:</span>
                    <span className="text-primary">
                      {formatCurrency(
                        String(
                          (parseFloat(formData.valor_adesao) || 0) +
                          (parseFloat(formData.valor_mensal) || 0)
                        )
                      )}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Save Button */}
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full"
            size="lg"
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Criando...
              </>
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" />
                Criar Contrato
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
