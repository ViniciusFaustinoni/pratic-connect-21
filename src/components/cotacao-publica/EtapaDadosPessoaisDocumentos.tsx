import { useState, useCallback, useEffect, useRef } from 'react';
import { validateCPF } from '@/lib/validations';
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
  Car,
  AlertTriangle,
  RefreshCw,
  Search,
  Pencil,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { sanitizePlaca, sanitizeChassi, sanitizeRenavam } from '@/lib/sanitizers/cotacao-fields';
import type { DadosPessoaisForm } from './FormularioDadosPessoais';
import { 
  UnifiedDocumentUploader, 
  type DocumentoUnificado,
  type UnifiedDocumentUploaderHandle,
} from '@/components/contratos/UnifiedDocumentUploader';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
const COMBUSTIVEIS = ['Gasolina','Etanol','Flex','Diesel','GNV','Híbrido','Elétrico'];

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
  sexo?: 'M' | 'F';
  // Endereço (de Comprovante)
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  // Veículo (de CRLV ou Nota Fiscal)
  veiculo_placa?: string;
  veiculo_chassi?: string;
  veiculo_renavam?: string;
  veiculo_cor?: string;
  veiculo_combustivel?: string;
  veiculo_motor?: string;
  veiculo_ano_fabricacao?: number;
  veiculo_ano_modelo?: number;
  // Nota Fiscal
  valor_nota_fiscal?: string;
  numero_motor?: string;
  // Flag de origem do documento
  origem_documento_veiculo?: 'crlv' | 'nota_fiscal_veiculo' | 'atpv_e';
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
  placaEsperada?: string;
  zeroKmFromCotacao?: boolean;
}

export function EtapaDadosPessoaisDocumentos({
  cotacaoId,
  onSubmit,
  isLoading = false,
  defaultValues,
  readOnly = false,
  placaEsperada,
  zeroKmFromCotacao = false,
}: EtapaDadosPessoaisDocumentosProps) {
  const [documentos, setDocumentos] = useState<DocumentoUnificado[]>([]);
  const [dadosExtraidos, setDadosExtraidos] = useState<DadosExtraidos>({});
  const [cpfManual, setCpfManual] = useState(''); // Para correção manual quando OCR extrai CPF inválido
  
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

  // Ref + estados para reprocessar OCR e buscar CEP manualmente
  const uploaderRef = useRef<UnifiedDocumentUploaderHandle>(null);
  const [reprocessandoCrlv, setReprocessandoCrlv] = useState(false);
  const [reprocessandoComprovante, setReprocessandoComprovante] = useState(false);
  const [cepManual, setCepManual] = useState('');
  const [buscandoCep, setBuscandoCep] = useState(false);

  // Fallback de preenchimento manual (oculto por padrão)
  const [mostrarManualPessoal, setMostrarManualPessoal] = useState(false);
  const [mostrarManualVeiculo, setMostrarManualVeiculo] = useState(false);
  const [mostrarManualEndereco, setMostrarManualEndereco] = useState(false);
  const [camposManuais, setCamposManuais] = useState<Set<string>>(new Set());

  // Marcação 0KM do veículo — herda da cotação (interno) ou fallback manual no link público
  const [isZeroKm, setIsZeroKm] = useState(zeroKmFromCotacao);

  // Sincroniza quando a cotação chegar/atualizar marcando 0KM
  useEffect(() => {
    if (zeroKmFromCotacao) setIsZeroKm(true);
  }, [zeroKmFromCotacao]);

  const setCampoManual = useCallback((campo: keyof DadosExtraidos, valor: any) => {
    setDadosExtraidos(prev => ({ ...prev, [campo]: valor }));
    setCamposManuais(prev => {
      const next = new Set(prev);
      if (valor === '' || valor == null) next.delete(campo as string);
      else next.add(campo as string);
      return next;
    });
  }, []);

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
  const temCrlv = tiposIdentificados.includes('crlv') || tiposIdentificados.includes('nota_fiscal_veiculo') || tiposIdentificados.includes('atpv_e');
  
  // Verificar dados extraídos
  const cpfIlegivel = dadosExtraidos.cpf === 'ilegivel';
  const cpfEfetivo = cpfManual || (cpfIlegivel ? '' : dadosExtraidos.cpf) || '';
  const cpfLimpoEfetivo = cpfEfetivo.replace(/\D/g, '');
  const cpfValido = cpfLimpoEfetivo.length === 11 && validateCPF(cpfLimpoEfetivo);
  const cpfExtraidoInvalido = !!(dadosExtraidos.cpf && !cpfIlegivel && !validateCPF(dadosExtraidos.cpf.replace(/\D/g, '')));
  
  const temDadosPessoais = !!(dadosExtraidos.nome && cpfEfetivo);
  const temEndereco = !!(dadosExtraidos.logradouro && dadosExtraidos.cidade && dadosExtraidos.uf);
  // Em 0KM: basta chassi (placa pode não existir ainda)
  // Caso contrário: placa OU chassi
  const temDadosVeiculo = isZeroKm
    ? !!dadosExtraidos.veiculo_chassi
    : !!(dadosExtraidos.veiculo_placa || dadosExtraidos.veiculo_chassi);
  const temContato = !!(email && telefone);

  // Sub-flags para avisos no checklist:
  const motorExtraido = !!(dadosExtraidos.numero_motor || dadosExtraidos.veiculo_motor);
  const chassiExtraido = !!dadosExtraidos.veiculo_chassi;
  // CRLV/NF/ATPV-e enviado mas faltando motor ou chassi (não bloqueia avançar — só avisa)
  const crlvIncompleto = temCrlv && (!motorExtraido || !chassiExtraido);
  // CRLV enviado mas IA NÃO conseguiu extrair NADA (nem placa, nem chassi)
  const crlvSemDados = temCrlv && !dadosExtraidos.veiculo_placa && !dadosExtraidos.veiculo_chassi;
  // Comprovante enviado mas endereço incompleto (logradouro/cidade/uf/cep)
  const enderecoIncompleto = temComprovante && (!dadosExtraidos.logradouro || !dadosExtraidos.cidade || !dadosExtraidos.uf || !dadosExtraidos.cep);

  const podeAvancar = temDadosPessoais && temEndereco && temDadosVeiculo && temContato && cpfValido;

  // Auto-abrir painel manual quando IA falhou em ler o documento do veículo
  useEffect(() => {
    if (crlvSemDados && !mostrarManualVeiculo) {
      setMostrarManualVeiculo(true);
    }
  }, [crlvSemDados, mostrarManualVeiculo]);

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
        if (dados.cpf) {
          novosDados.cpf = dados.cpf;
          // Se OCR retornou "ilegivel" ou CPF inválido, notificar o usuário
          if (dados.cpf === 'ilegivel') {
            toast.warning('CPF não pôde ser lido do documento. Digite manualmente.');
          } else if (!validateCPF(dados.cpf.replace(/\D/g, ''))) {
            toast.warning('CPF extraído é inválido. Corrija manualmente.');
          }
        }
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

          // Sexo (M/F) — normaliza variantes vindas do OCR
          if (dados.sexo) {
            const s = String(dados.sexo).trim().toUpperCase();
            if (s.startsWith('M')) novosDados.sexo = 'M';
            else if (s.startsWith('F')) novosDados.sexo = 'F';
          }
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

        // Auto-complete via ViaCEP se tem CEP mas falta bairro
        const cepLimpo = (dados.cep || novosDados.cep || '').replace(/\D/g, '');
        if (cepLimpo.length === 8 && !novosDados.bairro) {
          fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`)
            .then(r => r.json())
            .then(viaCepData => {
              if (!viaCepData.erro) {
                setDadosExtraidos(prev => ({
                  ...prev,
                  bairro: prev.bairro || viaCepData.bairro || '',
                  logradouro: prev.logradouro || viaCepData.logradouro || '',
                  cidade: prev.cidade || viaCepData.localidade || '',
                  uf: prev.uf || viaCepData.uf || '',
                }));
              }
            })
            .catch(() => {});
        }
      }
      
      // De CRLV: dados do veículo (expandido)
      if (tipoDocumento === 'crlv') {
        novosDados.origem_documento_veiculo = 'crlv';
        if (dados.placa) { const v = sanitizePlaca(dados.placa); if (v) novosDados.veiculo_placa = v; }
        if (dados.chassi) { const v = sanitizeChassi(dados.chassi); if (v) novosDados.veiculo_chassi = v; }
        if (dados.renavam) { const v = sanitizeRenavam(dados.renavam); if (v) novosDados.veiculo_renavam = v; }
        if (dados.cor) novosDados.veiculo_cor = dados.cor;
        if (dados.combustivel) novosDados.veiculo_combustivel = dados.combustivel;
        if (dados.motor) novosDados.veiculo_motor = dados.motor;
        // numero_motor: vem do CRLV (alias de motor) — alimenta o campo dedicado do cadastro
        const motorCrlv = dados.numero_motor || dados.motor;
        if (motorCrlv) novosDados.numero_motor = motorCrlv;
        
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

      // De Nota Fiscal de Veículo: substituto do CRLV
      if (tipoDocumento === 'nota_fiscal_veiculo') {
        novosDados.origem_documento_veiculo = 'nota_fiscal_veiculo';
        if (dados.chassi) { const v = sanitizeChassi(dados.chassi); if (v) novosDados.veiculo_chassi = v; }
        if (dados.numero_motor) novosDados.numero_motor = dados.numero_motor;
        if (dados.valor_nota_fiscal) novosDados.valor_nota_fiscal = dados.valor_nota_fiscal;
        if (dados.placa) { const v = sanitizePlaca(dados.placa); if (v) novosDados.veiculo_placa = v; }
        if (dados.cor) novosDados.veiculo_cor = dados.cor;
        if (dados.motor) novosDados.veiculo_motor = dados.motor;
        
        if (dados.ano_fabricacao) {
          const anoFab = parseInt(dados.ano_fabricacao);
          if (!isNaN(anoFab)) novosDados.veiculo_ano_fabricacao = anoFab;
        }
        if (dados.ano_modelo) {
          const anoMod = parseInt(dados.ano_modelo);
          if (!isNaN(anoMod)) novosDados.veiculo_ano_modelo = anoMod;
        }
      }

      // De ATPV-e / CRV Digital: substituto do CRLV (veículos recém-adquiridos)
      if (tipoDocumento === 'atpv_e') {
        novosDados.origem_documento_veiculo = 'atpv_e';
        if (dados.placa) { const v = sanitizePlaca(dados.placa); if (v) novosDados.veiculo_placa = v; }
        if (dados.chassi) { const v = sanitizeChassi(dados.chassi); if (v) novosDados.veiculo_chassi = v; }
        if (dados.renavam) { const v = sanitizeRenavam(dados.renavam); if (v) novosDados.veiculo_renavam = v; }
        if (dados.cor) novosDados.veiculo_cor = dados.cor;
        if (dados.combustivel) novosDados.veiculo_combustivel = dados.combustivel;
        if (dados.numero_motor) novosDados.numero_motor = dados.numero_motor;
        if (dados.motor) novosDados.veiculo_motor = dados.motor;

        if (dados.ano_fabricacao) {
          const anoFab = parseInt(dados.ano_fabricacao);
          if (!isNaN(anoFab)) novosDados.veiculo_ano_fabricacao = anoFab;
        }
        if (dados.ano_modelo) {
          const anoMod = parseInt(dados.ano_modelo);
          if (!isNaN(anoMod)) novosDados.veiculo_ano_modelo = anoMod;
        }
      }

      return novosDados;
    });
  }, []);

  const handleReprocessarCrlv = useCallback(async () => {
    setReprocessandoCrlv(true);
    try {
      await uploaderRef.current?.reprocessByType(['crlv', 'nota_fiscal_veiculo', 'atpv_e']);
    } finally {
      setReprocessandoCrlv(false);
    }
  }, []);

  const handleReprocessarComprovante = useCallback(async () => {
    setReprocessandoComprovante(true);
    try {
      await uploaderRef.current?.reprocessByType('comprovante_residencia');
    } finally {
      setReprocessandoComprovante(false);
    }
  }, []);

  const handleBuscarCepManual = useCallback(async () => {
    const cepLimpo = (cepManual || dadosExtraidos.cep || '').replace(/\D/g, '');
    if (cepLimpo.length !== 8) {
      toast.error('Digite um CEP válido (8 dígitos).');
      return;
    }
    setBuscandoCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
      const viaCepData = await res.json();
      if (viaCepData.erro) {
        toast.error('CEP não encontrado.');
        return;
      }
      setDadosExtraidos(prev => ({
        ...prev,
        cep: prev.cep || cepLimpo,
        logradouro: prev.logradouro || viaCepData.logradouro || '',
        bairro: prev.bairro || viaCepData.bairro || '',
        cidade: prev.cidade || viaCepData.localidade || '',
        uf: prev.uf || viaCepData.uf || '',
      }));
      toast.success('Endereço preenchido pelo CEP.');
    } catch (err) {
      console.error('[ViaCEP] erro:', err);
      toast.error('Falha ao consultar o CEP. Tente novamente.');
    } finally {
      setBuscandoCep(false);
    }
  }, [cepManual, dadosExtraidos.cep]);

  const [confirmacaoAberta, setConfirmacaoAberta] = useState(false);

  const buildDadosPayload = (): DadosPessoaisForm => ({
    nome: dadosExtraidos.nome || '',
    cpf: cpfEfetivo,
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
    rg: dadosExtraidos.rg || undefined,
    rg_orgao: dadosExtraidos.rg_orgao || undefined,
    cnh: dadosExtraidos.cnh || undefined,
    cnh_validade: dadosExtraidos.cnh_validade || undefined,
    cnh_categoria: dadosExtraidos.cnh_categoria || undefined,
    sexo: dadosExtraidos.sexo || undefined,
    veiculo_placa: dadosExtraidos.veiculo_placa || undefined,
    veiculo_chassi: dadosExtraidos.veiculo_chassi || undefined,
    veiculo_renavam: dadosExtraidos.veiculo_renavam || undefined,
    veiculo_cor: dadosExtraidos.veiculo_cor || undefined,
    veiculo_combustivel: dadosExtraidos.veiculo_combustivel || undefined,
    veiculo_ano_fabricacao: dadosExtraidos.veiculo_ano_fabricacao || undefined,
    veiculo_ano_modelo: dadosExtraidos.veiculo_ano_modelo || undefined,
    veiculo_numero_motor: dadosExtraidos.numero_motor || dadosExtraidos.veiculo_motor || undefined,
    veiculo_zero_km: isZeroKm || undefined,
    veiculo_procedencia: procedenciaVeiculo || (isZeroKm ? 'Novo (zero km)' : undefined),
  });

  const handleSubmit = () => {
    if (!podeAvancar) {
      toast.error('Envie todos os documentos necessários e preencha email e telefone.');
      return;
    }

    if (!cpfLimpoEfetivo || !validateCPF(cpfLimpoEfetivo)) {
      toast.error(
        cpfManual
          ? 'O CPF digitado é inválido. Verifique os dígitos antes de continuar.'
          : 'O CPF extraído do documento é inválido. Corrija manualmente no campo "CPF" antes de continuar.'
      );
      return;
    }

    setConfirmacaoAberta(true);
  };

  const handleConfirmarEnvio = () => {
    setConfirmacaoAberta(false);
    onSubmit(buildDadosPayload());
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
        ref={uploaderRef}
        cotacaoId={cotacaoId}
        onDocumentsChange={handleDocumentsChange}
        onOcrDataExtracted={handleOcrDataExtracted}
        cpfEsperado={defaultValues?.cpf}
        nomeEsperado={defaultValues?.nome}
        placaEsperada={placaEsperada}
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
              <p className="text-sm font-medium">CNH, RG ou CIN</p>
              {temDadosPessoais && (
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-muted-foreground mt-1">
                  {dadosExtraidos.nome && <div><span className="font-medium">Nome:</span> {dadosExtraidos.nome}</div>}
                  {dadosExtraidos.cpf && (
                    <div>
                      <span className="font-medium">CPF:</span> {cpfManual || dadosExtraidos.cpf}
                      {cpfExtraidoInvalido && !cpfValido && (
                        <span className="text-destructive ml-1">(inválido)</span>
                      )}
                      {cpfManual && cpfValido && (
                        <span className="text-success ml-1">(corrigido ✓)</span>
                      )}
                    </div>
                  )}
                  {dadosExtraidos.rg && <div><span className="font-medium">RG:</span> {dadosExtraidos.rg}{dadosExtraidos.rg_orgao ? ` (${dadosExtraidos.rg_orgao})` : ''}</div>}
                  {dadosExtraidos.data_nascimento && <div><span className="font-medium">Nascimento:</span> {dadosExtraidos.data_nascimento.includes('-') ? dadosExtraidos.data_nascimento.split('-').reverse().join('/') : dadosExtraidos.data_nascimento}</div>}
                  {dadosExtraidos.cnh && <div><span className="font-medium">Nº Registro:</span> {dadosExtraidos.cnh}</div>}
                  {dadosExtraidos.cnh_validade && <div><span className="font-medium">Validade:</span> {dadosExtraidos.cnh_validade}</div>}
                  {dadosExtraidos.cnh_categoria && <div><span className="font-medium">Categoria:</span> {dadosExtraidos.cnh_categoria}</div>}
                </div>
              )}
            </div>
          </div>

          {/* Fallback manual — Dados Pessoais (oculto por padrão) */}
          {temDocumentoPessoal && (
            <div className="px-3">
              {!mostrarManualPessoal ? (
                <button
                  type="button"
                  onClick={() => setMostrarManualPessoal(true)}
                  className="text-xs text-muted-foreground hover:text-primary underline-offset-2 hover:underline inline-flex items-center gap-1"
                >
                  <Pencil className="h-3 w-3" />
                  A IA não leu tudo? Preencher dados pessoais manualmente
                </button>
              ) : (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                      Preenchimento manual — Dados pessoais
                    </p>
                    <button type="button" onClick={() => setMostrarManualPessoal(false)} className="text-xs text-muted-foreground hover:text-foreground">
                      Recolher
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="sm:col-span-2">
                      <Label className="text-xs">Nome completo</Label>
                      <Input className="h-9 text-sm" value={dadosExtraidos.nome || ''} onChange={(e) => setCampoManual('nome', e.target.value)} placeholder="Nome conforme documento" />
                    </div>
                    <div>
                      <Label className="text-xs">RG</Label>
                      <Input className="h-9 text-sm" value={dadosExtraidos.rg || ''} onChange={(e) => setCampoManual('rg', e.target.value)} placeholder="00.000.000-0" />
                    </div>
                    <div>
                      <Label className="text-xs">Órgão emissor</Label>
                      <Input className="h-9 text-sm" value={dadosExtraidos.rg_orgao || ''} onChange={(e) => setCampoManual('rg_orgao', e.target.value.toUpperCase())} placeholder="SSP/UF" />
                    </div>
                    <div>
                      <Label className="text-xs">Data de nascimento</Label>
                      <Input className="h-9 text-sm" type="date" value={dadosExtraidos.data_nascimento || ''} onChange={(e) => setCampoManual('data_nascimento', e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">Nº de Registro CNH</Label>
                      <Input className="h-9 text-sm" value={dadosExtraidos.cnh || ''} onChange={(e) => setCampoManual('cnh', e.target.value.replace(/\D/g, ''))} placeholder="11 dígitos" />
                    </div>
                    <div>
                      <Label className="text-xs">Validade CNH</Label>
                      <Input className="h-9 text-sm" type="date" value={dadosExtraidos.cnh_validade || ''} onChange={(e) => setCampoManual('cnh_validade', e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">Categoria CNH</Label>
                      <Input className="h-9 text-sm" value={dadosExtraidos.cnh_categoria || ''} onChange={(e) => setCampoManual('cnh_categoria', e.target.value.toUpperCase())} placeholder="A, B, AB..." />
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Use apenas se a leitura automática falhou. Confirme cada dado com seu documento original.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Correção de CPF inválido ou ilegível */}
          {(cpfExtraidoInvalido || cpfIlegivel) && (
            <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20 space-y-2">
              <p className="text-sm text-destructive font-medium">
                {cpfIlegivel 
                  ? '⚠️ CPF não pôde ser lido do documento' 
                  : '⚠️ O CPF extraído do documento é inválido'}
              </p>
              <p className="text-xs text-muted-foreground">
                {cpfIlegivel
                  ? 'A leitura automática não conseguiu identificar o CPF com precisão. Digite manualmente:'
                  : 'A leitura automática capturou um CPF com dígitos incorretos. Digite o CPF correto abaixo:'}
              </p>
              <Input
                type="text"
                placeholder="000.000.000-00"
                value={cpfManual}
                onChange={(e) => {
                  // Aplicar máscara de CPF
                  const v = e.target.value.replace(/\D/g, '');
                  const masked = v
                    .replace(/(\d{3})(\d)/, '$1.$2')
                    .replace(/(\d{3})(\d)/, '$1.$2')
                    .replace(/(\d{3})(\d{1,2})/, '$1-$2')
                    .slice(0, 14);
                  setCpfManual(masked);
                }}
                className={cn(
                  "text-sm",
                  cpfManual && cpfValido && "border-success",
                  cpfManual && !cpfValido && cpfManual.length >= 14 && "border-destructive"
                )}
              />
              {cpfManual && cpfManual.length >= 14 && !cpfValido && (
                <p className="text-xs text-destructive">CPF ainda inválido. Verifique os dígitos.</p>
              )}
              {cpfManual && cpfValido && (
                <p className="text-xs text-success">✓ CPF válido!</p>
              )}
            </div>
          )}

          {/* CRLV ou Nota Fiscal */}
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
              <p className="text-sm font-medium">CRLV, Nota Fiscal ou ATPV-e do Veículo</p>
              {dadosExtraidos.origem_documento_veiculo === 'nota_fiscal_veiculo' && (
                <Badge variant="outline" className="text-xs border-amber-500/30 text-amber-600 mt-1">
                  Nota Fiscal (substitui CRLV)
                </Badge>
              )}
              {dadosExtraidos.origem_documento_veiculo === 'atpv_e' && (
                <Badge variant="outline" className="text-xs border-amber-500/30 text-amber-600 mt-1">
                  ATPV-e / CRV Digital (substitui CRLV)
                </Badge>
              )}
              {temDadosVeiculo && (
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-muted-foreground mt-1">
                  {dadosExtraidos.veiculo_placa && <div><span className="font-medium">Placa:</span> {dadosExtraidos.veiculo_placa}</div>}
                  {dadosExtraidos.veiculo_renavam && <div><span className="font-medium">Renavam:</span> {dadosExtraidos.veiculo_renavam}</div>}
                  {dadosExtraidos.veiculo_chassi && <div><span className="font-medium">Chassi:</span> {dadosExtraidos.veiculo_chassi}</div>}
                  {dadosExtraidos.veiculo_cor && <div><span className="font-medium">Cor:</span> {dadosExtraidos.veiculo_cor}</div>}
                  {dadosExtraidos.veiculo_combustivel && <div><span className="font-medium">Combustível:</span> {dadosExtraidos.veiculo_combustivel}</div>}
                  {dadosExtraidos.veiculo_motor && <div><span className="font-medium">Motor:</span> {dadosExtraidos.veiculo_motor}</div>}
                  {dadosExtraidos.numero_motor && <div><span className="font-medium">Nº Motor:</span> {dadosExtraidos.numero_motor}</div>}
                  {dadosExtraidos.valor_nota_fiscal && <div><span className="font-medium">Valor NF:</span> R$ {Number(dadosExtraidos.valor_nota_fiscal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>}
                  {dadosExtraidos.veiculo_ano_fabricacao && <div><span className="font-medium">Ano:</span> {dadosExtraidos.veiculo_ano_fabricacao}</div>}
                </div>
              )}
            </div>
          </div>

          {/* Fallback manual — Veículo */}
          {/* Disponível sempre (mesmo sem documento), abre auto quando OCR falha */}
          <div className="px-3">
            {crlvSemDados && !mostrarManualVeiculo && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 mb-2 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-amber-700 dark:text-amber-400">
                  <strong>Não conseguimos ler o documento do veículo.</strong> Preencha os dados manualmente abaixo.
                </div>
              </div>
            )}
            {!mostrarManualVeiculo ? (
              <button
                type="button"
                onClick={() => setMostrarManualVeiculo(true)}
                className="text-xs text-muted-foreground hover:text-primary underline-offset-2 hover:underline inline-flex items-center gap-1"
              >
                <Pencil className="h-3 w-3" />
                {crlvSemDados
                  ? 'Preencher dados do veículo manualmente'
                  : 'A IA não leu tudo? Preencher dados do veículo manualmente'}
              </button>
            ) : (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                    Preenchimento manual — Dados do veículo
                  </p>
                  {!crlvSemDados && (
                    <button type="button" onClick={() => setMostrarManualVeiculo(false)} className="text-xs text-muted-foreground hover:text-foreground">
                      Recolher
                    </button>
                  )}
                </div>

                {/* Toggle 0KM */}
                <div className="rounded-md border border-border bg-background/50 p-2.5">
                  <Label className="text-xs font-medium">Veículo 0KM (zero quilômetro)?</Label>
                  <div className="flex gap-2 mt-1.5">
                    <button
                      type="button"
                      onClick={() => setIsZeroKm(false)}
                      className={cn(
                        'flex-1 h-9 rounded-md border text-sm font-medium transition-colors',
                        !isZeroKm
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-background hover:bg-muted'
                      )}
                    >
                      Não (usado)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsZeroKm(true);
                        setProcedenciaVeiculo('Novo (zero km)');
                        // Limpa placa pois 0KM ainda não tem
                        if (dadosExtraidos.veiculo_placa) setCampoManual('veiculo_placa', '');
                      }}
                      className={cn(
                        'flex-1 h-9 rounded-md border text-sm font-medium transition-colors',
                        isZeroKm
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-background hover:bg-muted'
                      )}
                    >
                      Sim (0KM)
                    </button>
                  </div>
                  {isZeroKm && (
                    <p className="text-[11px] text-muted-foreground mt-1.5">
                      Para veículos 0KM, a placa pode ser preenchida depois. Chassi é obrigatório.
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {!isZeroKm && (
                    <div>
                      <Label className="text-xs">Placa *</Label>
                      <Input className="h-9 text-sm uppercase" maxLength={8} value={dadosExtraidos.veiculo_placa || ''} onChange={(e) => setCampoManual('veiculo_placa', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7))} placeholder="ABC1D23" />
                    </div>
                  )}
                  <div>
                    <Label className="text-xs">Renavam</Label>
                    <Input className="h-9 text-sm" value={dadosExtraidos.veiculo_renavam || ''} onChange={(e) => setCampoManual('veiculo_renavam', e.target.value.replace(/\D/g, '').slice(0, 11))} placeholder="11 dígitos" />
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="text-xs">Chassi *</Label>
                    <Input className="h-9 text-sm uppercase font-mono" maxLength={17} value={dadosExtraidos.veiculo_chassi || ''} onChange={(e) => setCampoManual('veiculo_chassi', e.target.value.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, '').slice(0, 17))} placeholder="17 caracteres" />
                  </div>
                  <div>
                    <Label className="text-xs">Cor</Label>
                    <Input className="h-9 text-sm" value={dadosExtraidos.veiculo_cor || ''} onChange={(e) => setCampoManual('veiculo_cor', e.target.value)} placeholder="Branco, Prata..." />
                  </div>
                  <div>
                    <Label className="text-xs">Combustível</Label>
                    <Select value={dadosExtraidos.veiculo_combustivel || ''} onValueChange={(v) => setCampoManual('veiculo_combustivel', v)}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                      <SelectContent>
                        {COMBUSTIVEIS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="text-xs">Nº do motor</Label>
                    <Input className="h-9 text-sm font-mono" value={dadosExtraidos.numero_motor || ''} onChange={(e) => setCampoManual('numero_motor', e.target.value.toUpperCase())} placeholder="Conforme CRLV / NF" />
                  </div>
                  <div>
                    <Label className="text-xs">Ano de fabricação</Label>
                    <Input className="h-9 text-sm" type="number" min={1950} max={new Date().getFullYear() + 1} value={dadosExtraidos.veiculo_ano_fabricacao || ''} onChange={(e) => setCampoManual('veiculo_ano_fabricacao', e.target.value ? parseInt(e.target.value) : undefined)} />
                  </div>
                  <div>
                    <Label className="text-xs">Ano do modelo {isZeroKm && '*'}</Label>
                    <Input className="h-9 text-sm" type="number" min={1950} max={new Date().getFullYear() + 1} value={dadosExtraidos.veiculo_ano_modelo || ''} onChange={(e) => setCampoManual('veiculo_ano_modelo', e.target.value ? parseInt(e.target.value) : undefined)} />
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Confira o chassi com atenção — ele é a identificação única do veículo.
                </p>
              </div>
            )}
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

          {/* Fallback manual — Endereço (oculto por padrão) */}
          {temComprovante && (
            <div className="px-3">
              {!mostrarManualEndereco ? (
                <button
                  type="button"
                  onClick={() => setMostrarManualEndereco(true)}
                  className="text-xs text-muted-foreground hover:text-primary underline-offset-2 hover:underline inline-flex items-center gap-1"
                >
                  <Pencil className="h-3 w-3" />
                  A IA não leu tudo? Preencher endereço manualmente
                </button>
              ) : (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                      Preenchimento manual — Endereço
                    </p>
                    <button type="button" onClick={() => setMostrarManualEndereco(false)} className="text-xs text-muted-foreground hover:text-foreground">
                      Recolher
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <Label className="text-xs">CEP</Label>
                      <Input
                        className="h-9 text-sm"
                        value={dadosExtraidos.cep || ''}
                        onChange={(e) => {
                          const v = e.target.value.replace(/\D/g, '').slice(0, 8);
                          const masked = v.length > 5 ? `${v.slice(0, 5)}-${v.slice(5)}` : v;
                          setCampoManual('cep', masked);
                          if (v.length === 8) {
                            fetch(`https://viacep.com.br/ws/${v}/json/`)
                              .then(r => r.json())
                              .then(d => {
                                if (!d.erro) {
                                  setDadosExtraidos(prev => ({
                                    ...prev,
                                    logradouro: prev.logradouro || d.logradouro || '',
                                    bairro: prev.bairro || d.bairro || '',
                                    cidade: prev.cidade || d.localidade || '',
                                    uf: prev.uf || d.uf || '',
                                  }));
                                }
                              }).catch(() => {});
                          }
                        }}
                        placeholder="00000-000"
                        maxLength={9}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Label className="text-xs">Logradouro</Label>
                      <Input className="h-9 text-sm" value={dadosExtraidos.logradouro || ''} onChange={(e) => setCampoManual('logradouro', e.target.value)} placeholder="Rua, Avenida..." />
                    </div>
                    <div>
                      <Label className="text-xs">Número</Label>
                      <Input className="h-9 text-sm" value={dadosExtraidos.numero || ''} onChange={(e) => setCampoManual('numero', e.target.value)} placeholder="123" />
                    </div>
                    <div>
                      <Label className="text-xs">Complemento</Label>
                      <Input className="h-9 text-sm" value={dadosExtraidos.complemento || ''} onChange={(e) => setCampoManual('complemento', e.target.value)} placeholder="Apto, bloco..." />
                    </div>
                    <div>
                      <Label className="text-xs">Bairro</Label>
                      <Input className="h-9 text-sm" value={dadosExtraidos.bairro || ''} onChange={(e) => setCampoManual('bairro', e.target.value)} />
                    </div>
                    <div className="sm:col-span-2">
                      <Label className="text-xs">Cidade</Label>
                      <Input className="h-9 text-sm" value={dadosExtraidos.cidade || ''} onChange={(e) => setCampoManual('cidade', e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">UF</Label>
                      <Select value={dadosExtraidos.uf || ''} onValueChange={(v) => setCampoManual('uf', v)}>
                        <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="UF" /></SelectTrigger>
                        <SelectContent>
                          {UFS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Use apenas se a leitura automática falhou. O CEP preenche os demais campos automaticamente.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Aviso: CRLV/NF/ATPV-e enviado mas faltam motor ou chassi */}
          {crlvIncompleto && (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                    Dados do veículo incompletos
                  </p>
                  <p className="text-xs text-muted-foreground">
                    A IA não conseguiu extrair{' '}
                    {!chassiExtraido && !motorExtraido
                      ? 'o chassi e o número do motor'
                      : !chassiExtraido
                        ? 'o chassi'
                        : 'o número do motor'}{' '}
                    do documento. Tente reprocessar a imagem — uma foto mais nítida costuma resolver.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="w-full"
                onClick={handleReprocessarCrlv}
                disabled={reprocessandoCrlv}
              >
                {reprocessandoCrlv ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                    Reprocessando OCR...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-3 w-3 mr-2" />
                    Reprocessar OCR do documento do veículo
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Aviso: Comprovante enviado mas endereço incompleto */}
          {enderecoIncompleto && (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                    Endereço incompleto
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Não conseguimos ler{' '}
                    {[
                      !dadosExtraidos.logradouro && 'logradouro',
                      !dadosExtraidos.bairro && 'bairro',
                      !dadosExtraidos.cidade && 'cidade',
                      !dadosExtraidos.uf && 'UF',
                      !dadosExtraidos.cep && 'CEP',
                    ].filter(Boolean).join(', ')}{' '}
                    do comprovante. Você pode reprocessar o OCR ou buscar o endereço pelo CEP.
                  </p>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleReprocessarComprovante}
                  disabled={reprocessandoComprovante}
                >
                  {reprocessandoComprovante ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                      Reprocessando...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-3 w-3 mr-2" />
                      Reprocessar OCR
                    </>
                  )}
                </Button>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder={dadosExtraidos.cep || 'CEP'}
                    value={cepManual}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, '').slice(0, 8);
                      setCepManual(v.length > 5 ? `${v.slice(0, 5)}-${v.slice(5)}` : v);
                    }}
                    className="h-9 text-sm"
                    maxLength={9}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="default"
                    onClick={handleBuscarCepManual}
                    disabled={buscandoCep}
                  >
                    {buscandoCep ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Search className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
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
                      {dadosExtraidos.origem_documento_veiculo === 'nota_fiscal_veiculo'
                        ? 'Extraído da Nota Fiscal'
                        : dadosExtraidos.origem_documento_veiculo === 'atpv_e'
                          ? 'Extraído da ATPV-e / CRV Digital'
                          : 'Extraído do CRLV'}
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
              {!temDocumentoPessoal && 'Envie CNH, RG ou CIN • '}
              {!temCrlv && 'Envie CRLV, Nota Fiscal ou ATPV-e • '}
              {!temComprovante && 'Envie Comprovante • '}
              {!temContato && 'Preencha e-mail e telefone'}
            </p>
          )}
        </>
      )}

      {/* Modal de confirmação dos dados antes de prosseguir */}
      <Dialog open={confirmacaoAberta} onOpenChange={setConfirmacaoAberta}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Confirme seus dados</DialogTitle>
            <DialogDescription>
              Revise as informações abaixo antes de prosseguir. Após a confirmação, elas serão usadas no seu contrato.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-sm">
            <section className="rounded-lg border border-border/50 p-4 space-y-2">
              <h4 className="font-semibold flex items-center gap-2 text-foreground">
                <User className="h-4 w-4 text-primary" /> Dados Pessoais
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">Nome:</span> <span className="font-medium">{dadosExtraidos.nome || '—'}</span></div>
                <div><span className="text-muted-foreground">CPF:</span> <span className="font-medium">{cpfEfetivo || '—'}</span></div>
                <div><span className="text-muted-foreground">Nascimento:</span> <span className="font-medium">{dadosExtraidos.data_nascimento || '—'}</span></div>
                <div><span className="text-muted-foreground">RG:</span> <span className="font-medium">{dadosExtraidos.rg || '—'}{dadosExtraidos.rg_orgao ? ` / ${dadosExtraidos.rg_orgao}` : ''}</span></div>
                {dadosExtraidos.cnh && (
                  <div className="sm:col-span-2"><span className="text-muted-foreground">CNH:</span> <span className="font-medium">{dadosExtraidos.cnh}{dadosExtraidos.cnh_categoria ? ` (${dadosExtraidos.cnh_categoria})` : ''}{dadosExtraidos.cnh_validade ? ` • Val.: ${dadosExtraidos.cnh_validade}` : ''}</span></div>
                )}
              </div>
            </section>

            <section className="rounded-lg border border-border/50 p-4 space-y-2">
              <h4 className="font-semibold flex items-center gap-2 text-foreground">
                <Mail className="h-4 w-4 text-primary" /> Contato
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">E-mail:</span> <span className="font-medium break-all">{email || '—'}</span></div>
                <div><span className="text-muted-foreground">Telefone:</span> <span className="font-medium">{telefone || '—'}</span></div>
              </div>
            </section>

            <section className="rounded-lg border border-border/50 p-4 space-y-2">
              <h4 className="font-semibold flex items-center gap-2 text-foreground">
                <MapPin className="h-4 w-4 text-primary" /> Endereço
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="sm:col-span-2"><span className="text-muted-foreground">Logradouro:</span> <span className="font-medium">{dadosExtraidos.logradouro || '—'}{dadosExtraidos.numero ? `, ${dadosExtraidos.numero}` : ''}{dadosExtraidos.complemento ? ` — ${dadosExtraidos.complemento}` : ''}</span></div>
                <div><span className="text-muted-foreground">Bairro:</span> <span className="font-medium">{dadosExtraidos.bairro || '—'}</span></div>
                <div><span className="text-muted-foreground">CEP:</span> <span className="font-medium">{dadosExtraidos.cep || '—'}</span></div>
                <div><span className="text-muted-foreground">Cidade/UF:</span> <span className="font-medium">{[dadosExtraidos.cidade, dadosExtraidos.uf].filter(Boolean).join(' / ') || '—'}</span></div>
              </div>
            </section>

            <section className="rounded-lg border border-border/50 p-4 space-y-2">
              <h4 className="font-semibold flex items-center gap-2 text-foreground">
                <Car className="h-4 w-4 text-primary" /> Veículo
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">Placa:</span> <span className="font-medium">{dadosExtraidos.veiculo_placa || (isZeroKm ? '0KM (sem placa)' : '—')}</span></div>
                <div><span className="text-muted-foreground">Chassi:</span> <span className="font-medium">{dadosExtraidos.veiculo_chassi || '—'}</span></div>
                <div><span className="text-muted-foreground">Renavam:</span> <span className="font-medium">{dadosExtraidos.veiculo_renavam || '—'}</span></div>
                <div><span className="text-muted-foreground">Cor:</span> <span className="font-medium">{dadosExtraidos.veiculo_cor || '—'}</span></div>
                <div><span className="text-muted-foreground">Combustível:</span> <span className="font-medium">{dadosExtraidos.veiculo_combustivel || '—'}</span></div>
                <div><span className="text-muted-foreground">Ano (Fab/Mod):</span> <span className="font-medium">{[dadosExtraidos.veiculo_ano_fabricacao, dadosExtraidos.veiculo_ano_modelo].filter(Boolean).join('/') || '—'}</span></div>
                <div className="sm:col-span-2"><span className="text-muted-foreground">Nº Motor:</span> <span className="font-medium">{dadosExtraidos.numero_motor || dadosExtraidos.veiculo_motor || '—'}</span></div>
                {procedenciaVeiculo && (
                  <div className="sm:col-span-2"><span className="text-muted-foreground">Procedência:</span> <span className="font-medium">{procedenciaVeiculo}</span></div>
                )}
              </div>
            </section>

            <p className="text-xs text-muted-foreground text-center">
              Conferiu tudo? Se algo estiver incorreto, clique em "Revisar" e ajuste antes de continuar.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => setConfirmacaoAberta(false)}
              disabled={isLoading}
            >
              Revisar
            </Button>
            <Button
              onClick={handleConfirmarEnvio}
              disabled={isLoading}
              className="bg-accent hover:bg-accent-hover text-accent-foreground"
            >
              {isLoading ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enviando...</>
              ) : (
                <>Confirmar e prosseguir <ArrowRight className="h-4 w-4 ml-2" /></>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
