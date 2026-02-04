import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, 
  MapPin, 
  Check, 
  Loader2,
  Sparkles,
  Mail,
  Phone,
  ArrowRight,
  Car
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DadosPessoaisForm } from './FormularioDadosPessoais';
import { 
  UnifiedDocumentUploader, 
  type DocumentoUnificado 
} from '@/components/contratos/UnifiedDocumentUploader';

interface DadosExtraidos {
  // Dados pessoais (de CNH/RG)
  nome?: string;
  cpf?: string;
  rg?: string;
  rg_orgao?: string;
  data_nascimento?: string;
  // Dados da CNH (extraídos automaticamente)
  cnh?: string;
  cnh_validade?: string;
  cnh_categoria?: string;
  // Endereço (de Comprovante)
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  // Veículo (de CRLV)
  veiculo_placa?: string;
  veiculo_chassi?: string;
  veiculo_renavam?: string;
  veiculo_cor?: string;
  veiculo_combustivel?: string;
  veiculo_ano_fabricacao?: number;
  veiculo_ano_modelo?: number;
}

// Opções para selects
const ESTADOS_CIVIS = [
  { value: 'Solteiro(a)', label: 'Solteiro(a)' },
  { value: 'Casado(a)', label: 'Casado(a)' },
  { value: 'Divorciado(a)', label: 'Divorciado(a)' },
  { value: 'Viúvo(a)', label: 'Viúvo(a)' },
  { value: 'União Estável', label: 'União Estável' },
];

const TIPOS_USO_VEICULO = [
  { value: 'Particular', label: 'Particular' },
  { value: 'APP', label: 'APP (Uber, 99, etc.)' },
  { value: 'Comercial', label: 'Comercial' },
  { value: 'Táxi', label: 'Táxi' },
];

const PROCEDENCIAS_VEICULO = [
  { value: 'Novo (zero km)', label: 'Novo (zero km)' },
  { value: 'Usado de particular', label: 'Usado de particular' },
  { value: 'Usado de revenda', label: 'Usado de revenda/loja' },
  { value: 'Leilão', label: 'Leilão' },
];

interface EtapaDadosPessoaisDocumentosProps {
  cotacaoId: string;
  onSubmit: (dados: DadosPessoaisForm) => void;
  isLoading?: boolean;
  defaultValues?: Partial<DadosPessoaisForm>;
  readOnly?: boolean;
}

export function EtapaDadosPessoaisDocumentos({
  cotacaoId,
  onSubmit,
  isLoading = false,
  defaultValues,
  readOnly = false,
}: EtapaDadosPessoaisDocumentosProps) {
  const [documentos, setDocumentos] = useState<DocumentoUnificado[]>([]);
  const [dadosExtraidos, setDadosExtraidos] = useState<DadosExtraidos>({});
  
  // Campos manuais (não podem ser extraídos de documentos)
  const [email, setEmail] = useState(defaultValues?.email || '');
  const [telefone, setTelefone] = useState(defaultValues?.telefone || '');
  
  // Novos campos obrigatórios para o Termo de Afiliação
  const [estadoCivil, setEstadoCivil] = useState('');
  const [profissao, setProfissao] = useState('');
  const [tipoUsoVeiculo, setTipoUsoVeiculo] = useState('Particular');
  const [procedenciaVeiculo, setProcedenciaVeiculo] = useState('');
  const [veiculoAlienado, setVeiculoAlienado] = useState(false);
  const [veiculoFinanceira, setVeiculoFinanceira] = useState('');

  // Sincronizar email e telefone quando defaultValues mudar (dados carregados do banco)
  useEffect(() => {
    if (defaultValues?.email && !email) {
      setEmail(defaultValues.email);
    }
    if (defaultValues?.telefone && !telefone) {
      setTelefone(defaultValues.telefone);
    }
  }, [defaultValues?.email, defaultValues?.telefone]);

  // Verificar documentos enviados com sucesso
  const tiposIdentificados = documentos
    .filter(d => d.status === 'success' && d.tipo_detectado)
    .map(d => d.tipo_detectado!);

  const temDocumentoPessoal = tiposIdentificados.includes('cnh') || tiposIdentificados.includes('rg');
  const temComprovante = tiposIdentificados.includes('comprovante_residencia');
  const temCrlv = tiposIdentificados.includes('crlv');
  
  // Verificar dados extraídos
  const temDadosPessoais = !!(dadosExtraidos.nome && dadosExtraidos.cpf);
  const temEndereco = !!(dadosExtraidos.logradouro && dadosExtraidos.cidade && dadosExtraidos.uf);
  const temDadosVeiculo = !!(dadosExtraidos.veiculo_placa);
  const temContato = !!(email && telefone);
  
  const podeAvancar = temDadosPessoais && temEndereco && temDadosVeiculo && temContato;

  const formatTelefone = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length <= 10) {
      return cleaned.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
    }
    return cleaned.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
  };

  // Callback quando documentos mudam
  const handleDocumentsChange = useCallback((docs: DocumentoUnificado[]) => {
    setDocumentos(docs);
  }, []);

  // Callback quando dados são extraídos pela IA
  const handleOcrDataExtracted = useCallback((dados: Record<string, string>, tipoDocumento?: string) => {
    console.log('[EtapaDadosPessoais] Dados recebidos:', dados, 'Tipo:', tipoDocumento);
    
    setDadosExtraidos(prev => {
      const novosDados = { ...prev };
      
      // De CNH ou RG: dados pessoais + dados de documentos
      if (tipoDocumento === 'cnh' || tipoDocumento === 'rg') {
        if (dados.nome) novosDados.nome = dados.nome;
        if (dados.cpf) novosDados.cpf = dados.cpf;
        if (dados.rg) novosDados.rg = dados.rg;
        if (dados.data_nascimento) novosDados.data_nascimento = dados.data_nascimento;
        
        // NOVOS CAMPOS - Dados da CNH
        if (tipoDocumento === 'cnh') {
          // Número de registro da CNH (pode vir como numero_registro ou registro)
          if (dados.numero_registro) novosDados.cnh = dados.numero_registro;
          else if (dados.registro) novosDados.cnh = dados.registro;
          
          // Validade da CNH
          if (dados.validade) novosDados.cnh_validade = dados.validade;
          
          // Categoria da CNH (A, B, AB, etc.)
          if (dados.categoria) novosDados.cnh_categoria = dados.categoria;
        }
        
        // Órgão emissor do RG (pode vir de CNH ou RG)
        if (dados.orgao_emissor) novosDados.rg_orgao = dados.orgao_emissor;
        else if (dados.orgao) novosDados.rg_orgao = dados.orgao;
      }
      
      // De Comprovante de Residência: endereço
      if (tipoDocumento === 'comprovante_residencia') {
        if (dados.cep) novosDados.cep = dados.cep;
        if (dados.logradouro) novosDados.logradouro = dados.logradouro;
        if (dados.numero) novosDados.numero = dados.numero;
        if (dados.complemento) novosDados.complemento = dados.complemento;
        if (dados.bairro) novosDados.bairro = dados.bairro;
        if (dados.cidade) novosDados.cidade = dados.cidade;
        if (dados.uf) novosDados.uf = dados.uf;
      }
      
      // De CRLV: dados do veículo (expandido)
      if (tipoDocumento === 'crlv') {
        if (dados.placa) novosDados.veiculo_placa = dados.placa;
        if (dados.chassi) novosDados.veiculo_chassi = dados.chassi;
        if (dados.renavam) novosDados.veiculo_renavam = dados.renavam;
        
        // NOVOS CAMPOS - Dados do veículo extraídos do CRLV
        if (dados.cor) novosDados.veiculo_cor = dados.cor;
        if (dados.combustivel) novosDados.veiculo_combustivel = dados.combustivel;
        
        // Ano de fabricação e modelo
        if (dados.ano_fabricacao) {
          const anoFab = parseInt(dados.ano_fabricacao);
          if (!isNaN(anoFab)) novosDados.veiculo_ano_fabricacao = anoFab;
        } else if (dados.ano && dados.ano.includes('/')) {
          const [fab] = dados.ano.split('/');
          const anoFab = parseInt(fab);
          if (!isNaN(anoFab)) novosDados.veiculo_ano_fabricacao = anoFab;
        }
        
        if (dados.ano_modelo) {
          const anoMod = parseInt(dados.ano_modelo);
          if (!isNaN(anoMod)) novosDados.veiculo_ano_modelo = anoMod;
        } else if (dados.ano && dados.ano.includes('/')) {
          const [, mod] = dados.ano.split('/');
          const anoMod = parseInt(mod);
          if (!isNaN(anoMod)) novosDados.veiculo_ano_modelo = anoMod;
        }
      }
      
      return novosDados;
    });
  }, []);

  const handleSubmit = () => {
    if (!podeAvancar) {
      toast.error('Envie todos os documentos necessários e preencha email e telefone.');
      return;
    }
    
    const dados: DadosPessoaisForm = {
      nome: dadosExtraidos.nome || '',
      cpf: dadosExtraidos.cpf || '',
      email,
      telefone,
      data_nascimento: dadosExtraidos.data_nascimento || '',
      cep: dadosExtraidos.cep || '',
      logradouro: dadosExtraidos.logradouro || '',
      numero: dadosExtraidos.numero || '',
      complemento: dadosExtraidos.complemento || '',
      bairro: dadosExtraidos.bairro || '',
      cidade: dadosExtraidos.cidade || '',
      uf: dadosExtraidos.uf || '',
      // Dados de documentos pessoais (CNH/RG) - NOVOS
      rg: dadosExtraidos.rg || undefined,
      rg_orgao: dadosExtraidos.rg_orgao || undefined,
      cnh: dadosExtraidos.cnh || undefined,
      cnh_validade: dadosExtraidos.cnh_validade || undefined,
      cnh_categoria: dadosExtraidos.cnh_categoria || undefined,
      // Dados do veículo extraídos do CRLV (expandido)
      veiculo_chassi: dadosExtraidos.veiculo_chassi || undefined,
      veiculo_renavam: dadosExtraidos.veiculo_renavam || undefined,
      veiculo_cor: dadosExtraidos.veiculo_cor || undefined,
      veiculo_combustivel: dadosExtraidos.veiculo_combustivel || undefined,
      veiculo_ano_fabricacao: dadosExtraidos.veiculo_ano_fabricacao || undefined,
    };
    onSubmit(dados);
  };

  // Modo read-only: mostrar resumo dos dados salvos
  if (readOnly) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div className="text-center">
          <Badge className="bg-success/10 text-success border-success/30 mb-4">
            <Check className="h-3 w-3 mr-1" />
            Dados Confirmados
          </Badge>
          <h2 className="text-2xl font-bold text-foreground mb-2">Documentos e Dados</h2>
          <p className="text-muted-foreground">
            Seus dados foram verificados e salvos com sucesso
          </p>
        </div>

        {/* Dados do Cliente */}
        <Card className="bg-success/5 border-success/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <User className="h-5 w-5 text-success" />
              <h4 className="font-medium">Dados Pessoais</h4>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {defaultValues?.nome && (
                <div>
                  <span className="text-muted-foreground">Nome:</span>
                  <p className="font-medium text-foreground">{defaultValues.nome}</p>
                </div>
              )}
              {defaultValues?.cpf && (
                <div>
                  <span className="text-muted-foreground">CPF:</span>
                  <p className="font-medium text-foreground">{defaultValues.cpf}</p>
                </div>
              )}
              {defaultValues?.email && (
                <div>
                  <span className="text-muted-foreground">E-mail:</span>
                  <p className="font-medium text-foreground">{defaultValues.email}</p>
                </div>
              )}
              {defaultValues?.telefone && (
                <div>
                  <span className="text-muted-foreground">Telefone:</span>
                  <p className="font-medium text-foreground">{defaultValues.telefone}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Endereço */}
        {defaultValues?.logradouro && (
          <Card className="bg-success/5 border-success/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="h-5 w-5 text-success" />
                <h4 className="font-medium">Endereço</h4>
              </div>
              <p className="text-sm text-foreground">
                {defaultValues.logradouro}
                {defaultValues.numero && `, ${defaultValues.numero}`}
                {defaultValues.complemento && ` - ${defaultValues.complemento}`}
                <br />
                {defaultValues.bairro && `${defaultValues.bairro} - `}
                {defaultValues.cidade}/{defaultValues.uf}
                {defaultValues.cep && ` • CEP: ${defaultValues.cep}`}
              </p>
            </CardContent>
          </Card>
        )}
      </motion.div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-4">
          <Sparkles className="h-4 w-4" />
          <span className="text-sm font-medium">IA Extrai seus dados automaticamente</span>
        </div>
        <h2 className="text-2xl font-bold text-foreground">Documentos e Dados</h2>
        <p className="text-muted-foreground mt-2">
          Envie seus documentos e a inteligência artificial preencherá seus dados
        </p>
      </div>

      {/* Upload Unificado de Documentos */}
      <UnifiedDocumentUploader
        cotacaoId={cotacaoId}
        onDocumentsChange={handleDocumentsChange}
        onOcrDataExtracted={handleOcrDataExtracted}
        cpfEsperado={defaultValues?.cpf}
        nomeEsperado={defaultValues?.nome}
      />

      {/* Checklist de Documentos */}
      <Card className="bg-card/80 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Documentos Necessários</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* CNH/RG */}
          <div className={cn(
            'flex items-center gap-3 p-3 rounded-lg transition-colors',
            temDocumentoPessoal ? 'bg-success/5' : 'bg-muted/30'
          )}>
            <div className={cn(
              'w-6 h-6 rounded-full flex items-center justify-center',
              temDocumentoPessoal ? 'bg-success/10' : 'bg-muted'
            )}>
              {temDocumentoPessoal ? (
                <Check className="h-4 w-4 text-success" />
              ) : (
                <User className="h-3 w-3 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">CNH ou RG</p>
              {temDadosPessoais && (
                <p className="text-xs text-muted-foreground">
                  {dadosExtraidos.nome} • CPF: {dadosExtraidos.cpf}
                </p>
              )}
            </div>
          </div>

          {/* CRLV */}
          <div className={cn(
            'flex items-center gap-3 p-3 rounded-lg transition-colors',
            temCrlv ? 'bg-success/5' : 'bg-muted/30'
          )}>
            <div className={cn(
              'w-6 h-6 rounded-full flex items-center justify-center',
              temCrlv ? 'bg-success/10' : 'bg-muted'
            )}>
              {temCrlv ? (
                <Check className="h-4 w-4 text-success" />
              ) : (
                <Car className="h-3 w-3 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">CRLV do Veículo</p>
              {temDadosVeiculo && (
                <p className="text-xs text-muted-foreground">
                  Placa: {dadosExtraidos.veiculo_placa}
                  {dadosExtraidos.veiculo_renavam && ` • Renavam: ${dadosExtraidos.veiculo_renavam}`}
                </p>
              )}
            </div>
          </div>

          {/* Comprovante de Residência */}
          <div className={cn(
            'flex items-center gap-3 p-3 rounded-lg transition-colors',
            temComprovante ? 'bg-success/5' : 'bg-muted/30'
          )}>
            <div className={cn(
              'w-6 h-6 rounded-full flex items-center justify-center',
              temComprovante ? 'bg-success/10' : 'bg-muted'
            )}>
              {temComprovante ? (
                <Check className="h-4 w-4 text-success" />
              ) : (
                <MapPin className="h-3 w-3 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Comprovante de Residência</p>
              {temEndereco && (
                <p className="text-xs text-muted-foreground">
                  {dadosExtraidos.logradouro}, {dadosExtraidos.numero} - {dadosExtraidos.cidade}/{dadosExtraidos.uf}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dados Extraídos */}
      <AnimatePresence>
        {(temDadosPessoais || temEndereco || temDadosVeiculo) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-4"
          >
            {/* Dados Pessoais */}
            {temDadosPessoais && (
              <Card className="bg-success/5 border-success/20">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <User className="h-4 w-4 text-success" />
                    <h4 className="font-medium text-sm">Dados Pessoais</h4>
                    <Badge variant="outline" className="text-xs border-success/30 text-success">
                      Extraído da CNH/RG
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Nome:</span>
                      <p className="font-medium">{dadosExtraidos.nome}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">CPF:</span>
                      <p className="font-medium">{dadosExtraidos.cpf}</p>
                    </div>
                    {dadosExtraidos.data_nascimento && (
                      <div>
                        <span className="text-muted-foreground">Nascimento:</span>
                        <p className="font-medium">
                          {dadosExtraidos.data_nascimento.includes('-') 
                            ? dadosExtraidos.data_nascimento.split('-').reverse().join('/')
                            : dadosExtraidos.data_nascimento}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Dados do Veículo */}
            {temDadosVeiculo && (
              <Card className="bg-success/5 border-success/20">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Car className="h-4 w-4 text-success" />
                    <h4 className="font-medium text-sm">Dados do Veículo</h4>
                    <Badge variant="outline" className="text-xs border-success/30 text-success">
                      Extraído do CRLV
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Placa:</span>
                      <p className="font-medium">{dadosExtraidos.veiculo_placa}</p>
                    </div>
                    {dadosExtraidos.veiculo_renavam && (
                      <div>
                        <span className="text-muted-foreground">Renavam:</span>
                        <p className="font-medium">{dadosExtraidos.veiculo_renavam}</p>
                      </div>
                    )}
                    {dadosExtraidos.veiculo_chassi && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Chassi:</span>
                        <p className="font-medium font-mono text-xs">{dadosExtraidos.veiculo_chassi}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Endereço */}
            {temEndereco && (
              <Card className="bg-success/5 border-success/20">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <MapPin className="h-4 w-4 text-success" />
                    <h4 className="font-medium text-sm">Endereço</h4>
                    <Badge variant="outline" className="text-xs border-success/30 text-success">
                      Extraído do Comprovante
                    </Badge>
                  </div>
                  <p className="text-sm">
                    {dadosExtraidos.logradouro}
                    {dadosExtraidos.numero && `, ${dadosExtraidos.numero}`}
                    {dadosExtraidos.complemento && ` - ${dadosExtraidos.complemento}`}
                    <br />
                    {dadosExtraidos.bairro && `${dadosExtraidos.bairro} - `}
                    {dadosExtraidos.cidade}/{dadosExtraidos.uf}
                    {dadosExtraidos.cep && ` • CEP: ${dadosExtraidos.cep}`}
                  </p>
                </CardContent>
              </Card>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Campos Manuais (Email e Telefone) */}
      <Card className="bg-card/80 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Contato
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Preencha seu e-mail e telefone para receber atualizações
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="h-3 w-3" />
                E-mail *
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-background/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telefone" className="flex items-center gap-2">
                <Phone className="h-3 w-3" />
                Telefone/WhatsApp *
              </Label>
              <Input
                id="telefone"
                type="tel"
                placeholder="(00) 00000-0000"
                value={telefone}
                onChange={(e) => setTelefone(formatTelefone(e.target.value))}
                className="bg-background/50"
                maxLength={15}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Botão Continuar - Ocultar em modo readOnly */}
      {!readOnly && (
        <>
          <Button
            onClick={handleSubmit}
            disabled={!podeAvancar || isLoading}
            className="w-full h-14 text-lg gap-2 bg-accent hover:bg-accent-hover text-accent-foreground"
            size="lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                Continuar
                <ArrowRight className="h-5 w-5" />
              </>
            )}
          </Button>

          {/* Indicador de status */}
          {!podeAvancar && (
            <p className="text-center text-sm text-muted-foreground">
              {!temDocumentoPessoal && 'Envie CNH ou RG • '}
              {!temCrlv && 'Envie CRLV • '}
              {!temComprovante && 'Envie Comprovante • '}
              {!temContato && 'Preencha e-mail e telefone'}
            </p>
          )}
        </>
      )}
    </div>
  );
}
