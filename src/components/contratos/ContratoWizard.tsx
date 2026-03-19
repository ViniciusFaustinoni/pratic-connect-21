import { useState, useEffect, useMemo, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Check, User, Car, FileText, CheckCircle, Upload, AlertCircle, ChevronLeft, ChevronRight, DollarSign, Building2 } from 'lucide-react';
import { buscarCep } from '@/lib/cep';
import { MigracaoStepForm } from './MigracaoStepForm';
import { useFipe } from '@/hooks/useFipe';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { CpfInput, TelefoneInput, PlacaInput, CepInput } from '@/components/inputs/MaskedInputs';
import { useCotacao, useUpdateCotacao } from '@/hooks/useCotacoes';
import { useCreateContrato } from '@/hooks/useContratos';
import { useCreateAssociado, useUpdateAssociado, buscarAssociadoPorCpf } from '@/hooks/useAssociados';
import { useCreateVeiculo, useUpdateVeiculo, buscarVeiculoPorPlaca } from '@/hooks/useVeiculos';
import { useUpdateLead } from '@/hooks/useLeads';
import { UnifiedDocumentUploader, type DocumentoUnificado } from './UnifiedDocumentUploader';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

const wizardSchema = z.object({
  // Associado
  nome: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  cpf: z.string().min(11, "CPF inválido"),
  rg: z.string().optional(),
  rg_orgao: z.string().optional(),
  cnh: z.string().optional(),
  cnh_validade: z.string().optional(),
  cnh_categoria: z.string().optional(),
  data_nascimento: z.string().optional(),
  email: z.string().email("E-mail inválido"),
  telefone: z.string().min(10, "Telefone inválido"),
  cep: z.string().optional(),
  logradouro: z.string().optional(),
  numero: z.string().optional(),
  complemento: z.string().optional(),
  bairro: z.string().optional(),
  cidade: z.string().optional(),
  uf: z.string().optional(),
  // Veículo
  placa: z.string().min(7, "Placa inválida"),
  marca: z.string().min(2, "Marca obrigatória"),
  modelo: z.string().min(2, "Modelo obrigatório"),
  ano_fabricacao: z.coerce.number().min(1900, "Ano inválido"),
  ano_modelo: z.coerce.number().min(1900, "Ano inválido"),
  cor: z.string().optional(),
  combustivel: z.string().optional(),
  motor: z.string().optional(),
  chassi: z.string().optional(),
  renavam: z.string().optional(),
  valor_fipe: z.number().optional().nullable(),
});

type WizardFormData = z.infer<typeof wizardSchema>;

interface ContratoWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cotacaoId: string;
  onContratoCreated?: (contratoId: string) => void;
}

const BASE_STEPS = [
  { id: 1, title: 'Cotação', icon: FileText },
  { id: 2, title: 'Documentos', icon: Upload },
  { id: 3, title: 'Revisão', icon: CheckCircle },
];

const MIGRATION_STEP = { id: 2, title: 'Migração', icon: Building2 };



export function ContratoWizard({ open, onOpenChange, cotacaoId, onContratoCreated }: ContratoWizardProps) {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tipoOperacao, setTipoOperacao] = useState<string>('adesao');
  const [buscandoFipe, setBuscandoFipe] = useState(false);
  const [migracaoAprovada, setMigracaoAprovada] = useState(false);
  
  // Dynamic steps based on tipoOperacao
  const isMigracao = tipoOperacao === 'migracao';
  const steps = useMemo(() => {
    if (isMigracao) {
      return [
        { id: 1, title: 'Cotação', icon: FileText },
        { id: 2, title: 'Migração', icon: Building2 },
        { id: 3, title: 'Documentos', icon: Upload },
        { id: 4, title: 'Revisão', icon: CheckCircle },
      ];
    }
    return BASE_STEPS;
  }, [isMigracao]);
  
  const totalSteps = steps.length;
  // Map logical step names to current step numbers
  const STEP_COTACAO = 1;
  const STEP_MIGRACAO = isMigracao ? 2 : -1;
  const STEP_DOCUMENTOS = isMigracao ? 3 : 2;
  const STEP_REVISAO = isMigracao ? 4 : 3;
  
  // Documentos uploadados
  const [documentos, setDocumentos] = useState<DocumentoUnificado[]>([]);
  
  // Dados extraídos pela IA
  const [dadosExtraidos, setDadosExtraidos] = useState<Record<string, { value: string; fonte: string }>>({}); 
  
  // Hook FIPE
  const { buscarPorNome } = useFipe();
  
  const { data: cotacao } = useCotacao(cotacaoId);
  const createContrato = useCreateContrato();
  const createAssociado = useCreateAssociado();
  const updateAssociado = useUpdateAssociado();
  const createVeiculo = useCreateVeiculo();
  const updateVeiculo = useUpdateVeiculo();
  const updateCotacao = useUpdateCotacao();
  const updateLead = useUpdateLead();

  const form = useForm<WizardFormData>({
    resolver: zodResolver(wizardSchema),
    defaultValues: {
      nome: '', cpf: '', rg: '', rg_orgao: '', cnh: '', cnh_validade: '', cnh_categoria: '', 
      data_nascimento: '', email: '', telefone: '',
      cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '',
      placa: '', marca: '', modelo: '', ano_fabricacao: new Date().getFullYear(),
      ano_modelo: new Date().getFullYear(), cor: '', combustivel: '', motor: '', chassi: '', renavam: '',
    },
  });

  // Pré-preencher dados da cotação/lead
  useEffect(() => {
    if (cotacao) {
      // Primeiro: pegar valor FIPE da cotação (fonte principal)
      if (cotacao.valor_fipe) {
        form.setValue('valor_fipe', cotacao.valor_fipe);
        setDadosExtraidos(prev => ({ ...prev, valor_fipe: { value: String(cotacao.valor_fipe), fonte: 'Cotação' } }));
      }
      
      if (cotacao.leads) {
        const lead = cotacao.leads;
        form.setValue('nome', lead.nome);
        setDadosExtraidos(prev => ({ ...prev, nome: { value: lead.nome, fonte: 'Lead' } }));
        
        form.setValue('telefone', lead.telefone);
        setDadosExtraidos(prev => ({ ...prev, telefone: { value: lead.telefone, fonte: 'Lead' } }));
        
        if (lead.email) {
          form.setValue('email', lead.email);
          setDadosExtraidos(prev => ({ ...prev, email: { value: lead.email, fonte: 'Lead' } }));
        }
        if (lead.cpf) {
          form.setValue('cpf', lead.cpf);
          setDadosExtraidos(prev => ({ ...prev, cpf: { value: lead.cpf, fonte: 'Lead' } }));
        }
        if (lead.veiculo_marca) {
          form.setValue('marca', lead.veiculo_marca);
          setDadosExtraidos(prev => ({ ...prev, marca: { value: lead.veiculo_marca, fonte: 'Lead' } }));
        }
        if (lead.veiculo_modelo) {
          form.setValue('modelo', lead.veiculo_modelo);
          setDadosExtraidos(prev => ({ ...prev, modelo: { value: lead.veiculo_modelo, fonte: 'Lead' } }));
        }
        if (lead.veiculo_ano) {
          form.setValue('ano_fabricacao', lead.veiculo_ano);
          form.setValue('ano_modelo', lead.veiculo_ano);
          setDadosExtraidos(prev => ({ 
            ...prev, 
            ano_fabricacao: { value: String(lead.veiculo_ano), fonte: 'Lead' },
            ano_modelo: { value: String(lead.veiculo_ano), fonte: 'Lead' }
          }));
        }
        if (lead.veiculo_placa) {
          form.setValue('placa', lead.veiculo_placa);
          setDadosExtraidos(prev => ({ ...prev, placa: { value: lead.veiculo_placa, fonte: 'Lead' } }));
        }
        
        // Fallback: se a cotação não tiver valor FIPE, usa do lead
        if (!cotacao.valor_fipe && lead.veiculo_fipe) {
          form.setValue('valor_fipe', lead.veiculo_fipe);
          setDadosExtraidos(prev => ({ ...prev, valor_fipe: { value: String(lead.veiculo_fipe), fonte: 'Lead' } }));
        }
        
        // Fallback: se o lead não tiver email/telefone, usa da cotação
        if (!lead.email && cotacao.email_solicitante) {
          form.setValue('email', cotacao.email_solicitante);
          setDadosExtraidos(prev => ({ ...prev, email: { value: cotacao.email_solicitante!, fonte: 'Cotação' } }));
        }
        if (!lead.telefone && cotacao.telefone1_solicitante) {
          form.setValue('telefone', cotacao.telefone1_solicitante);
          setDadosExtraidos(prev => ({ ...prev, telefone: { value: cotacao.telefone1_solicitante!, fonte: 'Cotação' } }));
        }
      } else {
        // Sem lead vinculado: usar dados do solicitante da cotação
        if (cotacao.nome_solicitante) {
          form.setValue('nome', cotacao.nome_solicitante);
          setDadosExtraidos(prev => ({ ...prev, nome: { value: cotacao.nome_solicitante!, fonte: 'Cotação' } }));
        }
        if (cotacao.email_solicitante) {
          form.setValue('email', cotacao.email_solicitante);
          setDadosExtraidos(prev => ({ ...prev, email: { value: cotacao.email_solicitante!, fonte: 'Cotação' } }));
        }
        if (cotacao.telefone1_solicitante) {
          form.setValue('telefone', cotacao.telefone1_solicitante);
          setDadosExtraidos(prev => ({ ...prev, telefone: { value: cotacao.telefone1_solicitante!, fonte: 'Cotação' } }));
        }
      }
      
      // Preencher dados do veículo da cotação (caso não tenha lead ou lead não tenha veículo)
      const currentMarca = form.getValues('marca');
      if (!currentMarca) {
        if (cotacao.veiculo_marca) {
          form.setValue('marca', cotacao.veiculo_marca);
          setDadosExtraidos(prev => ({ ...prev, marca: { value: cotacao.veiculo_marca!, fonte: 'Cotação' } }));
        }
        if (cotacao.veiculo_modelo) {
          form.setValue('modelo', cotacao.veiculo_modelo);
          setDadosExtraidos(prev => ({ ...prev, modelo: { value: cotacao.veiculo_modelo!, fonte: 'Cotação' } }));
        }
        if (cotacao.veiculo_ano) {
          form.setValue('ano_fabricacao', cotacao.veiculo_ano);
          form.setValue('ano_modelo', cotacao.veiculo_ano);
          setDadosExtraidos(prev => ({ 
            ...prev, 
            ano_fabricacao: { value: String(cotacao.veiculo_ano), fonte: 'Cotação' },
            ano_modelo: { value: String(cotacao.veiculo_ano), fonte: 'Cotação' }
          }));
        }
        if (cotacao.veiculo_placa) {
          form.setValue('placa', cotacao.veiculo_placa);
          setDadosExtraidos(prev => ({ ...prev, placa: { value: cotacao.veiculo_placa!, fonte: 'Cotação' } }));
        }
      }
    }
  }, [cotacao, form]);

  // Reset ao fechar
  useEffect(() => {
    if (!open) {
      setStep(1);
      setDocumentos([]);
      setDadosExtraidos({});
      form.reset();
    }
  }, [open, form]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const fetchCep = async (cep: string) => {
    try {
      const cleanCep = cep.replace(/\D/g, '');
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await response.json();
      if (!data.erro) {
        form.setValue('logradouro', data.logradouro);
        form.setValue('bairro', data.bairro);
        form.setValue('cidade', data.localidade);
        form.setValue('uf', data.uf);
      }
    } catch (error) {
      console.error('Erro ao buscar CEP:', error);
    }
  };

  // Handler para documentos com OCR unificado
  const handleDocumentsChange = (docs: DocumentoUnificado[]) => {
    setDocumentos(docs);
  };

  // Função para normalizar CPF (extrair apenas dígitos e formatar)
  const normalizeCpf = (cpfRaw: string): string | null => {
    if (!cpfRaw || cpfRaw === 'null') return null;
    const digits = cpfRaw.replace(/\D/g, '');
    if (digits.length !== 11) return null;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  };

  const handleOcrDataExtracted = (dados: Record<string, string>, tipoDocumento?: string) => {
    console.log('[OCR] Dados recebidos para mapeamento:', dados, 'Tipo:', tipoDocumento);
    
    // ========================================
    // DADOS PESSOAIS - Apenas de CNH ou RG
    // ========================================
    if (tipoDocumento === 'cnh' || tipoDocumento === 'rg') {
      // Nome - SOMENTE de documento pessoal (NÃO do CRLV)
      const nome = dados.nome;
      if (nome && !form.getValues('nome')) {
        form.setValue('nome', nome);
        const fonteName = tipoDocumento === 'cnh' ? 'CNH' : 'RG';
        setDadosExtraidos(prev => ({ ...prev, nome: { value: nome, fonte: fonteName } }));
      }
      
      // CPF - de documento pessoal
      const cpfRaw = dados.cpf || dados.cpf_cnpj || dados.cpf_mf;
      const cpfNormalizado = normalizeCpf(cpfRaw);
      
      if (cpfNormalizado) {
        const cpfAtual = form.getValues('cpf');
        const cpfAtualNormalizado = cpfAtual ? normalizeCpf(cpfAtual) : null;
        
        const fonteCpf = tipoDocumento === 'cnh' ? 'CNH' : 'RG';
        setDadosExtraidos(prev => ({ ...prev, cpf: { value: cpfNormalizado, fonte: fonteCpf } }));
        
        if (!cpfAtual) {
          form.setValue('cpf', cpfNormalizado);
        } else if (cpfAtualNormalizado && cpfAtualNormalizado !== cpfNormalizado) {
          toast.warning(`CPF no documento (${cpfNormalizado}) difere do cadastro (${cpfAtualNormalizado}). Verifique!`);
        }
      }
      
      // RG - de documento pessoal
      if (dados.rg && !form.getValues('rg')) {
        form.setValue('rg', dados.rg);
        const fonteRg = tipoDocumento === 'cnh' ? 'CNH' : 'RG';
        setDadosExtraidos(prev => ({ ...prev, rg: { value: dados.rg, fonte: fonteRg } }));
      }
      
      // Órgão emissor do RG
      const orgaoEmissor = dados.orgao_emissor || dados.orgao;
      if (orgaoEmissor && !form.getValues('rg_orgao')) {
        form.setValue('rg_orgao', orgaoEmissor);
        setDadosExtraidos(prev => ({ ...prev, rg_orgao: { value: orgaoEmissor, fonte: tipoDocumento === 'cnh' ? 'CNH' : 'RG' } }));
      }
      
      // Data de nascimento
      if (dados.data_nascimento && !form.getValues('data_nascimento')) {
        form.setValue('data_nascimento', dados.data_nascimento);
        setDadosExtraidos(prev => ({ ...prev, data_nascimento: { value: dados.data_nascimento, fonte: tipoDocumento === 'cnh' ? 'CNH' : 'RG' } }));
      }
      
      // CAMPOS ESPECÍFICOS DA CNH
      if (tipoDocumento === 'cnh') {
        // Número de registro da CNH
        const numeroCnh = dados.numero_registro || dados.registro;
        if (numeroCnh && !form.getValues('cnh')) {
          form.setValue('cnh', numeroCnh);
          setDadosExtraidos(prev => ({ ...prev, cnh: { value: numeroCnh, fonte: 'CNH' } }));
        }
        
        // Validade da CNH
        if (dados.validade && !form.getValues('cnh_validade')) {
          form.setValue('cnh_validade', dados.validade);
          setDadosExtraidos(prev => ({ ...prev, cnh_validade: { value: dados.validade, fonte: 'CNH' } }));
        }
        
        // Categoria da CNH (A, B, AB, etc.)
        if (dados.categoria && !form.getValues('cnh_categoria')) {
          form.setValue('cnh_categoria', dados.categoria);
          setDadosExtraidos(prev => ({ ...prev, cnh_categoria: { value: dados.categoria, fonte: 'CNH' } }));
        }
      }
    }
    
    // ========================================
    // DADOS DE ENDEREÇO - Apenas de Comprovante de Residência
    // ========================================
    if (tipoDocumento === 'comprovante_residencia') {
      const logradouro = dados.logradouro || dados.endereco || dados.rua;
      if (logradouro && !form.getValues('logradouro')) {
        form.setValue('logradouro', logradouro);
        setDadosExtraidos(prev => ({ ...prev, logradouro: { value: logradouro, fonte: 'Comprovante' } }));
      }
      
      if (dados.numero && !form.getValues('numero')) {
        form.setValue('numero', dados.numero);
        setDadosExtraidos(prev => ({ ...prev, numero: { value: dados.numero, fonte: 'Comprovante' } }));
      }
      
      if (dados.bairro && !form.getValues('bairro')) {
        form.setValue('bairro', dados.bairro);
        setDadosExtraidos(prev => ({ ...prev, bairro: { value: dados.bairro, fonte: 'Comprovante' } }));
      }
      
      const cidade = dados.cidade || dados.municipio || dados.localidade;
      if (cidade && !form.getValues('cidade')) {
        form.setValue('cidade', cidade);
        setDadosExtraidos(prev => ({ ...prev, cidade: { value: cidade, fonte: 'Comprovante' } }));
      }
      
      const uf = dados.uf || dados.estado;
      if (uf && !form.getValues('uf')) {
        form.setValue('uf', uf);
        setDadosExtraidos(prev => ({ ...prev, uf: { value: uf, fonte: 'Comprovante' } }));
      }
      
      if (dados.cep && !form.getValues('cep')) {
        form.setValue('cep', dados.cep);
        setDadosExtraidos(prev => ({ ...prev, cep: { value: dados.cep, fonte: 'Comprovante' } }));
      }
      
      // Se não tem bairro mas tem CEP, buscar via ViaCEP
      const cepValue = dados.cep || form.getValues('cep');
      if (!form.getValues('bairro') && cepValue) {
        const cepLimpo = cepValue.replace(/\D/g, '');
        if (cepLimpo.length === 8) {
          buscarCep(cepLimpo).then(enderecoCep => {
            if (enderecoCep) {
              if (enderecoCep.bairro && !form.getValues('bairro')) {
                form.setValue('bairro', enderecoCep.bairro);
                setDadosExtraidos(prev => ({ ...prev, bairro: { value: enderecoCep.bairro, fonte: 'CEP' } }));
              }
              if (enderecoCep.logradouro && !form.getValues('logradouro')) {
                form.setValue('logradouro', enderecoCep.logradouro);
                setDadosExtraidos(prev => ({ ...prev, logradouro: { value: enderecoCep.logradouro, fonte: 'CEP' } }));
              }
              if (enderecoCep.cidade && !form.getValues('cidade')) {
                form.setValue('cidade', enderecoCep.cidade);
                setDadosExtraidos(prev => ({ ...prev, cidade: { value: enderecoCep.cidade, fonte: 'CEP' } }));
              }
              if (enderecoCep.uf && !form.getValues('uf')) {
                form.setValue('uf', enderecoCep.uf);
                setDadosExtraidos(prev => ({ ...prev, uf: { value: enderecoCep.uf, fonte: 'CEP' } }));
              }
            }
          }).catch(error => {
            console.error('Erro ao buscar CEP:', error);
          });
        }
      }
    }
    
    // ========================================
    // DADOS DO VEÍCULO - Apenas de CRLV
    // ========================================
    if (tipoDocumento === 'crlv') {
      // NOTA: nome_proprietario do CRLV NÃO deve ir para o campo nome do associado
      // O proprietário do veículo pode ser diferente do associado!
      
      if (dados.placa && !form.getValues('placa')) {
        form.setValue('placa', dados.placa);
        setDadosExtraidos(prev => ({ ...prev, placa: { value: dados.placa, fonte: 'CRLV' } }));
      }
      
      if (dados.marca && !form.getValues('marca')) {
        form.setValue('marca', dados.marca);
        setDadosExtraidos(prev => ({ ...prev, marca: { value: dados.marca, fonte: 'CRLV' } }));
      }
      
      if (dados.modelo && !form.getValues('modelo')) {
        form.setValue('modelo', dados.modelo);
        setDadosExtraidos(prev => ({ ...prev, modelo: { value: dados.modelo, fonte: 'CRLV' } }));
      }
      
      // ANO - Tratar múltiplas variações possíveis
      let anoFab: string | null = null;
      let anoMod: string | null = null;
      
      if (dados.ano && dados.ano.includes('/')) {
        const [fab, mod] = dados.ano.split('/');
        anoFab = fab?.trim() || null;
        anoMod = mod?.trim() || null;
      } else {
        anoFab = dados.ano_fabricacao || dados.ano_fab || dados.anofab || dados.ano || null;
        anoMod = dados.ano_modelo || dados.ano_mod || dados.anomod || dados.ano || null;
      }
      
      if (anoFab) {
        const anoFabNum = parseInt(anoFab);
        if (!isNaN(anoFabNum) && anoFabNum >= 1900 && anoFabNum <= new Date().getFullYear() + 2) {
          form.setValue('ano_fabricacao', anoFabNum);
          setDadosExtraidos(prev => ({ ...prev, ano_fabricacao: { value: anoFab!, fonte: 'CRLV' } }));
        }
      }
      
      if (anoMod) {
        const anoModNum = parseInt(anoMod);
        if (!isNaN(anoModNum) && anoModNum >= 1900 && anoModNum <= new Date().getFullYear() + 2) {
          form.setValue('ano_modelo', anoModNum);
          setDadosExtraidos(prev => ({ ...prev, ano_modelo: { value: anoMod!, fonte: 'CRLV' } }));
        }
      }
      
      if (dados.cor && !form.getValues('cor')) {
        form.setValue('cor', dados.cor);
        setDadosExtraidos(prev => ({ ...prev, cor: { value: dados.cor, fonte: 'CRLV' } }));
      }
      
      if (dados.renavam && !form.getValues('renavam')) {
        form.setValue('renavam', dados.renavam);
        setDadosExtraidos(prev => ({ ...prev, renavam: { value: dados.renavam, fonte: 'CRLV' } }));
      }
      
      if (dados.chassi && !form.getValues('chassi')) {
        form.setValue('chassi', dados.chassi);
        setDadosExtraidos(prev => ({ ...prev, chassi: { value: dados.chassi, fonte: 'CRLV' } }));
      }
      
      const combustivel = dados.combustivel || dados.combustivel_tipo;
      if (combustivel && !form.getValues('combustivel')) {
        form.setValue('combustivel', combustivel);
        setDadosExtraidos(prev => ({ ...prev, combustivel: { value: combustivel, fonte: 'CRLV' } }));
      }
      
      // Número do motor
      const motor = dados.motor || dados.numero_motor || dados.n_motor;
      if (motor && !form.getValues('motor')) {
        form.setValue('motor', motor);
        setDadosExtraidos(prev => ({ ...prev, motor: { value: motor, fonte: 'CRLV' } }));
      }
      
      // Buscar valor FIPE automaticamente se tiver marca, modelo e ano
      const marcaValue = dados.marca || form.getValues('marca');
      const modeloValue = dados.modelo || form.getValues('modelo');
      const anoValue = anoMod || anoFab || form.getValues('ano_modelo')?.toString() || form.getValues('ano_fabricacao')?.toString();
      
      if (marcaValue && modeloValue && anoValue && !form.getValues('valor_fipe')) {
        setBuscandoFipe(true);
        buscarPorNome(marcaValue, modeloValue, anoValue).then(resultado => {
          if (resultado && resultado.valorNumerico) {
            form.setValue('valor_fipe', resultado.valorNumerico);
            setDadosExtraidos(prev => ({ 
              ...prev, 
              valor_fipe: { 
                value: formatCurrency(resultado.valorNumerico), 
                fonte: 'FIPE' 
              } 
            }));
          }
        }).catch(error => {
          console.error('Erro ao buscar FIPE:', error);
        }).finally(() => {
          setBuscandoFipe(false);
        });
      }
    }
  };

  // Verificar documentos
  const tiposIdentificados = documentos
    .filter(d => d.status === 'success' && d.tipo_detectado)
    .map(d => d.tipo_detectado!);

  const temDocPessoal = tiposIdentificados.includes('cnh') || tiposIdentificados.includes('rg');
  const temCrlv = tiposIdentificados.includes('crlv');
  const temComprovante = tiposIdentificados.includes('comprovante_residencia');
  const hasMinimumDocs = temDocPessoal && temCrlv;

  const handleNext = async () => {
    if (step === STEP_REVISAO) {
      const result = await form.trigger();
      if (!result) return;
    }
    if (step < totalSteps) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  // Handle migration step blocking
  const handleMigracaoStatusChange = useCallback((canAdvance: boolean) => {
    setMigracaoAprovada(canAdvance);
  }, []);

  const onSubmit = async (data: WizardFormData) => {
    if (!cotacao) return;
    
    setIsSubmitting(true);
    try {
      // 1. Verificar se associado já existe pelo CPF
      let associado = await buscarAssociadoPorCpf(data.cpf);
      
      if (associado) {
        console.log('[Contrato] Associado existente encontrado:', associado.id);
        
        // Atualizar dados do associado existente
        associado = await updateAssociado.mutateAsync({
          id: associado.id,
          nome: data.nome,
          email: data.email,
          telefone: data.telefone,
          rg: data.rg || associado.rg,
          cep: data.cep || associado.cep,
          logradouro: data.logradouro || associado.logradouro,
          numero: data.numero || associado.numero,
          bairro: data.bairro || associado.bairro,
          cidade: data.cidade || associado.cidade,
          uf: data.uf || associado.uf,
          plano_id: cotacao.plano_id,
        });
        
        toast.info('Associado existente atualizado');
      } else {
        // Criar novo associado
        console.log('[Contrato] Criando novo associado');
        associado = await createAssociado.mutateAsync({
          nome: data.nome,
          cpf: data.cpf,
          rg: data.rg || null,
          email: data.email,
          telefone: data.telefone,
          cep: data.cep || null,
          logradouro: data.logradouro || null,
          numero: data.numero || null,
          bairro: data.bairro || null,
          cidade: data.cidade || null,
          uf: data.uf || null,
          status: 'em_analise',
          plano_id: cotacao.plano_id,
        });
      }

      // 2. Verificar se veículo já existe pela placa
      let veiculo = await buscarVeiculoPorPlaca(data.placa);
      
      if (veiculo) {
        console.log('[Contrato] Veículo existente encontrado:', veiculo.id);
        
        // Verificar se pertence ao mesmo associado
        if (veiculo.associado_id && veiculo.associado_id !== associado.id) {
          toast.warning('Este veículo já está vinculado a outro associado. Será atualizado.');
        }
        
        // Atualizar veículo
        veiculo = await updateVeiculo.mutateAsync({
          id: veiculo.id,
          associado_id: associado.id,
          marca: data.marca,
          modelo: data.modelo,
          ano_fabricacao: data.ano_fabricacao,
          ano_modelo: data.ano_modelo,
          cor: data.cor || veiculo.cor,
          combustivel: data.combustivel || veiculo.combustivel,
          chassi: data.chassi || veiculo.chassi,
          renavam: data.renavam || veiculo.renavam,
          valor_fipe: data.valor_fipe || veiculo.valor_fipe,
        });
        
        toast.info('Veículo existente atualizado');
      } else {
        // Criar novo veículo
        console.log('[Contrato] Criando novo veículo');
        await createVeiculo.mutateAsync({
          associado_id: associado.id,
          placa: data.placa,
          marca: data.marca,
          modelo: data.modelo,
          ano_fabricacao: data.ano_fabricacao,
          ano_modelo: data.ano_modelo,
          cor: data.cor || null,
          combustivel: data.combustivel || null,
          chassi: data.chassi || null,
          renavam: data.renavam || null,
          valor_fipe: data.valor_fipe || null,
        });
      }

      // 3. Resolver vendedor_id (cotação ou usuário logado)
      let vendedorId = cotacao.vendedor_id || null;
      if (!vendedorId) {
        try {
          const { data: userData } = await supabase.auth.getUser();
          if (userData?.user) {
            const { data: perfil } = await supabase
              .from('profiles')
              .select('id')
              .eq('user_id', userData.user.id)
              .single();
            vendedorId = perfil?.id || null;
          }
        } catch (err) {
          console.warn('[Contrato] Não foi possível obter vendedor atual:', err);
        }
      }

      // 4. Criar lead retroativo se cotação não tem lead vinculado
      let leadId = cotacao.lead_id;
      
      if (!leadId && data.nome) {
        console.log('[Contrato] Criando lead retroativo a partir da cotação');
        
        // Criar lead usando array syntax para satisfazer o TypeScript
        const { data: novoLead, error: leadError } = await supabase
          .from('leads')
          .insert([{
            nome: data.nome,
            telefone: data.telefone,
            email: data.email || null,
            cpf: data.cpf || null,
            veiculo_marca: data.marca,
            veiculo_modelo: data.modelo,
            veiculo_ano: data.ano_fabricacao,
            veiculo_placa: data.placa,
            veiculo_fipe: data.valor_fipe || null,
            origem: 'cotador' as const, // Lead criado a partir do cotador de preços
            etapa: 'ganho' as const,
            vendedor_id: vendedorId,
            associado_id: associado.id,
            plano_escolhido_id: cotacao.plano_id,
          }])
          .select('id')
          .single();
        
        if (leadError) {
          console.error('[Contrato] Erro ao criar lead retroativo:', leadError);
        } else if (novoLead) {
          leadId = novoLead.id;
          console.log('[Contrato] Lead retroativo criado:', leadId);
          
          // Atualizar a cotação com o lead_id
          await supabase
            .from('cotacoes')
            .update({ lead_id: leadId })
            .eq('id', cotacao.id);
        }
      }

      // 4. Criar contrato com dados do veículo e cliente
      const novoContrato = await createContrato.mutateAsync({
        cotacao_id: cotacao.id,
        plano_id: cotacao.plano_id,
        associado_id: associado.id,
        lead_id: leadId, // Vincular lead (original ou criado retroativamente)
        valor_adesao: cotacao.valor_adesao,
        valor_mensal: cotacao.valor_total_mensal,
        data_inicio: new Date().toISOString().split('T')[0],
        status: 'pendente',
        // Dados do veículo
        veiculo_placa: data.placa || null,
        veiculo_marca: data.marca || null,
        veiculo_modelo: data.modelo || null,
        veiculo_ano: data.ano_fabricacao || null,
        veiculo_cor: data.cor || null,
        veiculo_chassi: data.chassi || null,
        veiculo_renavam: data.renavam || null,
        veiculo_valor_fipe: data.valor_fipe || null,
        // Campos para Termo de Afiliação
        codigo_fipe: cotacao.codigo_fipe || null,
        veiculo_combustivel: data.combustivel || cotacao.veiculo_combustivel || null,
        veiculo_categoria: cotacao.categoria || cotacao.veiculo_categoria || 'Automóvel',
        veiculo_procedencia: cotacao.veiculo_procedencia || null,
        uso_aplicativo: cotacao.uso_aplicativo || false,
        vendedor_id: cotacao.vendedor_id || vendedorId || null,
        tipo_entrada: tipoOperacao,
        // Dados do cliente
        cliente_nome: data.nome || null,
        cliente_cpf: data.cpf || null,
        cliente_email: data.email || null,
        cliente_telefone: data.telefone || null,
        cliente_cep: data.cep || null,
        cliente_cidade: data.cidade || null,
        cliente_uf: data.uf || null,
        // CNH, RG e endereço extraídos via OCR
        cliente_cnh: data.cnh || null,
        cliente_cnh_validade: data.cnh_validade || null,
        cliente_cnh_categoria: data.cnh_categoria || null,
        cliente_rg: data.rg || null,
        cliente_rg_orgao: data.rg_orgao || null,
        cliente_data_nascimento: data.data_nascimento || null,
        cliente_logradouro: data.logradouro || null,
        cliente_numero: data.numero || null,
        cliente_complemento: data.complemento || null,
        cliente_bairro: data.bairro || null,
      });

      // 5. Atualizar status da cotação
      await updateCotacao.mutateAsync({ id: cotacao.id, status: 'aceita' });

      // 6. Atualizar lead se existir (etapa já definida como 'ganho' na criação)
      if (leadId && cotacao.lead_id) {
        // Lead já existia, só atualizar etapa
        await updateLead.mutateAsync({ id: leadId, etapa: 'ganho' });
      }

      toast.success('Contrato criado com sucesso!');
      onOpenChange(false);
      
      // Notificar que contrato foi criado para navegação
      if (onContratoCreated && novoContrato?.id) {
        onContratoCreated(novoContrato.id);
      }
    } catch (error) {
      toast.error('Erro ao criar contrato');
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Componente para exibir dado extraído (somente leitura - usado no Step 2)
  const DadoExtraido = ({ label, campo }: { label: string; campo: string }) => {
    const dado = dadosExtraidos[campo];
    if (!dado) return null;
    return (
      <div className="flex items-center gap-2 text-sm py-1">
        <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
        <span className="text-muted-foreground">{label}:</span>
        <span className="font-medium">{dado.value}</span>
        <Badge variant="outline" className="text-xs">via {dado.fonte}</Badge>
      </div>
    );
  };

  // Componente para dado extraído EDITÁVEL (usado no Step 3 - Revisão)
  const DadoExtraidoEditavel = ({ 
    label, 
    campo, 
    name,
    inputType = 'text',
    placeholder,
    colSpan
  }: { 
    label: string; 
    campo: string; 
    name: keyof WizardFormData;
    inputType?: 'text' | 'cpf' | 'telefone' | 'cep' | 'placa';
    placeholder?: string;
    colSpan?: number;
  }) => {
    const dado = dadosExtraidos[campo];
    
    const renderInput = (field: any) => {
      const baseProps = {
        value: field.value?.toString() || '',
        onChange: field.onChange
      };
      
      switch (inputType) {
        case 'cpf':
          return <CpfInput {...baseProps} />;
        case 'telefone':
          return <TelefoneInput {...baseProps} />;
        case 'cep':
          return <CepInput {...baseProps} onCepComplete={fetchCep} />;
        case 'placa':
          return <PlacaInput {...baseProps} />;
        default:
          return <Input {...field} value={field.value?.toString() || ''} placeholder={placeholder} />;
      }
    };

    return (
      <FormField
        control={form.control}
        name={name}
        render={({ field }) => (
          <FormItem className={colSpan ? `col-span-${colSpan}` : undefined}>
            <FormLabel className="flex items-center gap-2 flex-wrap">
              {dado ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <AlertCircle className="h-4 w-4 text-amber-500" />
              )}
              {label}
              {dado && (
                <Badge variant="outline" className="text-xs">
                  via {dado.fonte}
                </Badge>
              )}
              {!dado && (
                <span className="text-xs text-muted-foreground">(não detectado)</span>
              )}
            </FormLabel>
            <FormControl>
              {renderInput(field)}
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    );
  };

  // Componente para campo faltante
  const CampoFaltante = ({ name, label, placeholder, children }: { name: keyof WizardFormData; label: string; placeholder?: string; children?: React.ReactNode }) => {
    return (
      <FormField
        control={form.control}
        name={name}
        render={({ field }) => (
          <FormItem>
            <FormLabel className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              {label}
              <span className="text-xs text-muted-foreground">(não detectado)</span>
            </FormLabel>
            <FormControl>
              {children || <Input placeholder={placeholder} {...field} value={field.value?.toString() || ''} />}
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Proposta</DialogTitle>
          <DialogDescription>
            Finalize a proposta a partir da cotação aceita
          </DialogDescription>
        </DialogHeader>

        {/* Steps indicator */}
        <div className="flex items-center justify-between mb-6">
          {steps.map((s, index) => (
            <div key={s.id} className="flex items-center">
              <div className={cn(
                "flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors",
                step >= s.id 
                  ? "border-primary bg-primary text-primary-foreground" 
                  : "border-muted-foreground/30 text-muted-foreground"
              )}>
                {step > s.id ? <Check className="h-5 w-5" /> : <s.icon className="h-5 w-5" />}
              </div>
              <span className={cn(
                "ml-2 text-sm font-medium hidden sm:block",
                step >= s.id ? "text-foreground" : "text-muted-foreground"
              )}>
                {s.title}
              </span>
              {index < steps.length - 1 && (
                <div className={cn(
                  "w-8 sm:w-16 h-0.5 mx-2",
                  step > s.id ? "bg-primary" : "bg-muted-foreground/30"
                )} />
              )}
            </div>
          ))}
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Step 1: Cotação + Tipo de Operação */}
            {step === STEP_COTACAO && cotacao && (
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Resumo da Cotação</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Número:</span>
                        <p className="font-mono">{cotacao.numero}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Cliente:</span>
                        <p>{cotacao.leads?.nome || 'Não informado'}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Plano:</span>
                        <p>{cotacao.planos?.nome}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Valor FIPE:</span>
                        <p>{formatCurrency(cotacao.valor_fipe)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Mensal:</span>
                        <p className="font-medium text-primary">{formatCurrency(cotacao.valor_total_mensal)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Filiação:</span>
                        <p>{formatCurrency(cotacao.valor_adesao)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Tipo de Operação - agora no Step 1 */}
                <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Tipo de Operação
                  </h4>
                  <div className="max-w-xs">
                    <Label className="text-xs text-muted-foreground mb-1 block">Selecione o tipo de operação deste contrato</Label>
                    <Select value={tipoOperacao} onValueChange={(val) => {
                      setTipoOperacao(val);
                      // Reset migration state when changing type
                      if (val !== 'migracao') setMigracaoAprovada(false);
                    }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="adesao">Adesão</SelectItem>
                        <SelectItem value="migracao">Migração</SelectItem>
                        <SelectItem value="inclusao">Inclusão</SelectItem>
                        <SelectItem value="troca_titularidade">Troca de Titularidade</SelectItem>
                        <SelectItem value="reativacao">Reativação</SelectItem>
                        <SelectItem value="substituicao_placa">Substituição de Placa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {/* Step Migração (condicional) */}
            {step === STEP_MIGRACAO && isMigracao && (
              <MigracaoStepForm
                cotacaoId={cotacaoId}
                cpf={form.getValues('cpf') || cotacao?.leads?.cpf || ''}
                nome={form.getValues('nome') || cotacao?.leads?.nome}
                placa={form.getValues('placa') || cotacao?.leads?.veiculo_placa || cotacao?.veiculo_placa}
                onStatusChange={handleMigracaoStatusChange}
              />
            )}

            {/* Step Documentos */}
            {step === STEP_DOCUMENTOS && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Upload className="h-5 w-5" />
                    Documentos
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Envie todos os documentos de uma vez. A IA irá identificar e extrair os dados automaticamente.
                  </p>
                </div>

                {/* Resumo dos documentos identificados */}
                {documentos.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {temDocPessoal && (
                      <Badge variant="default" className="bg-green-600">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        {tiposIdentificados.includes('cnh') ? 'CNH' : 'RG'}
                      </Badge>
                    )}
                    {temCrlv && (
                      <Badge variant="default" className="bg-green-600">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        CRLV
                      </Badge>
                    )}
                    {temComprovante && (
                      <Badge variant="default" className="bg-green-600">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Comprovante de Residência
                      </Badge>
                    )}
                    {!temDocPessoal && (
                      <Badge variant="outline" className="text-amber-600 border-amber-600">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Falta: CNH ou RG
                      </Badge>
                    )}
                    {!temCrlv && (
                      <Badge variant="outline" className="text-amber-600 border-amber-600">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Falta: CRLV
                      </Badge>
                    )}
                  </div>
                )}

                <UnifiedDocumentUploader
                  cotacaoId={cotacaoId}
                  onDocumentsChange={handleDocumentsChange}
                  onOcrDataExtracted={handleOcrDataExtracted}
                  cpfEsperado={form.getValues('cpf') || cotacao?.leads?.cpf || undefined}
                  nomeEsperado={form.getValues('nome') || cotacao?.leads?.nome || undefined}
                />

                {/* Dados extraídos pela IA */}
                {Object.keys(dadosExtraidos).length > 0 && (
                  <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                    <h4 className="font-medium text-green-700 dark:text-green-400 mb-2 flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" />
                      Dados Extraídos pela IA (editáveis na próxima etapa)
                    </h4>
                    <div className="grid grid-cols-2 gap-x-4">
                      <div className="space-y-1">
                        <DadoExtraido label="Nome" campo="nome" />
                        <DadoExtraido label="CPF" campo="cpf" />
                        <DadoExtraido label="RG" campo="rg" />
                        <DadoExtraido label="CEP" campo="cep" />
                        <DadoExtraido label="Endereço" campo="logradouro" />
                        <DadoExtraido label="Bairro" campo="bairro" />
                        <DadoExtraido label="Cidade" campo="cidade" />
                        <DadoExtraido label="UF" campo="uf" />
                      </div>
                      <div className="space-y-1">
                        <DadoExtraido label="Placa" campo="placa" />
                        <DadoExtraido label="Marca" campo="marca" />
                        <DadoExtraido label="Modelo" campo="modelo" />
                        <DadoExtraido label="Ano" campo="ano_fabricacao" />
                        <DadoExtraido label="Cor" campo="cor" />
                        <DadoExtraido label="Renavam" campo="renavam" />
                        <DadoExtraido label="Chassi" campo="chassi" />
                        {dadosExtraidos.valor_fipe && (
                          <DadoExtraido label="Valor FIPE" campo="valor_fipe" />
                        )}
                        {buscandoFipe && (
                          <div className="flex items-center gap-2 text-sm py-1">
                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                            <span className="text-muted-foreground">Buscando valor FIPE...</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {!hasMinimumDocs && documentos.length > 0 && (
                  <div className="p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                    <p className="text-sm text-amber-700 dark:text-amber-400 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      É necessário enviar pelo menos: documento pessoal (CNH ou RG) e CRLV do veículo.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Step Revisão */}
            {step === STEP_REVISAO && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Revisão dos Dados</h3>
                  <p className="text-xs text-muted-foreground">
                    Todos os campos são editáveis. Corrija se necessário.
                  </p>
                </div>

                {/* Tipo de operação (somente leitura) */}
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    <span className="font-medium">Tipo de Operação:</span>
                    <Badge variant="outline">
                      {tipoOperacao === 'adesao' ? 'Adesão' :
                       tipoOperacao === 'migracao' ? 'Migração' :
                       tipoOperacao === 'inclusao' ? 'Inclusão' :
                       tipoOperacao === 'troca_titularidade' ? 'Troca de Titularidade' :
                       tipoOperacao === 'reativacao' ? 'Reativação' :
                       tipoOperacao === 'substituicao_placa' ? 'Substituição de Placa' : tipoOperacao}
                    </Badge>
                  </div>
                </div>

                {/* Dados Pessoais */}
                <div className="p-4 bg-muted/50 rounded-lg space-y-4">
                  <h4 className="font-medium flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Dados do Associado
                  </h4>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <DadoExtraidoEditavel 
                      label="Nome" 
                      campo="nome" 
                      name="nome" 
                      placeholder="Digite o nome completo"
                    />
                    
                    <DadoExtraidoEditavel 
                      label="CPF" 
                      campo="cpf" 
                      name="cpf" 
                      inputType="cpf"
                    />
                    
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>E-mail</FormLabel>
                          <FormControl>
                            <Input placeholder="email@exemplo.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="telefone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Telefone</FormLabel>
                          <FormControl>
                            <TelefoneInput value={field.value} onChange={field.onChange} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Endereço */}
                  <div className="pt-2 border-t">
                    <p className="text-sm font-medium mb-3">Endereço</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <DadoExtraidoEditavel 
                        label="CEP" 
                        campo="cep" 
                        name="cep" 
                        inputType="cep"
                      />
                      
                      <div className="col-span-2">
                        <DadoExtraidoEditavel 
                          label="Logradouro" 
                          campo="logradouro" 
                          name="logradouro" 
                          placeholder="Rua, Avenida..."
                        />
                      </div>
                      
                      <DadoExtraidoEditavel 
                        label="Número" 
                        campo="numero" 
                        name="numero" 
                        placeholder="123"
                      />
                      
                      <DadoExtraidoEditavel 
                        label="Bairro" 
                        campo="bairro" 
                        name="bairro" 
                        placeholder="Bairro"
                      />
                      
                      <DadoExtraidoEditavel 
                        label="Cidade" 
                        campo="cidade" 
                        name="cidade" 
                        placeholder="Cidade"
                      />
                      
                      <DadoExtraidoEditavel 
                        label="UF" 
                        campo="uf" 
                        name="uf" 
                        placeholder="SP"
                      />
                    </div>
                  </div>
                </div>

                {/* Dados do Veículo */}
                <div className="p-4 bg-muted/50 rounded-lg space-y-4">
                  <h4 className="font-medium flex items-center gap-2">
                    <Car className="h-4 w-4" />
                    Dados do Veículo
                  </h4>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <DadoExtraidoEditavel 
                      label="Placa" 
                      campo="placa" 
                      name="placa" 
                      inputType="placa"
                    />
                    
                    <DadoExtraidoEditavel 
                      label="Marca" 
                      campo="marca" 
                      name="marca" 
                      placeholder="Toyota"
                    />
                    
                    <DadoExtraidoEditavel 
                      label="Modelo" 
                      campo="modelo" 
                      name="modelo" 
                      placeholder="Corolla XEi"
                    />
                    
                    <DadoExtraidoEditavel 
                      label="Ano Fabricação" 
                      campo="ano_fabricacao" 
                      name="ano_fabricacao" 
                      placeholder="2023"
                    />
                    
                    <DadoExtraidoEditavel 
                      label="Ano Modelo" 
                      campo="ano_modelo" 
                      name="ano_modelo" 
                      placeholder="2024"
                    />
                    
                    <DadoExtraidoEditavel 
                      label="Cor" 
                      campo="cor" 
                      name="cor" 
                      placeholder="Prata"
                    />
                    
                    <DadoExtraidoEditavel 
                      label="Renavam" 
                      campo="renavam" 
                      name="renavam" 
                      placeholder="00000000000"
                    />
                    
                    <DadoExtraidoEditavel 
                      label="Chassi" 
                      campo="chassi" 
                      name="chassi" 
                      placeholder="9BRXXXXXXXXXXXXXXXX"
                    />
                    
                    {/* Valor FIPE */}
                    {dadosExtraidos.valor_fipe ? (
                      <div className="col-span-2 p-2 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-green-600" />
                          <DadoExtraido label="Valor FIPE" campo="valor_fipe" />
                        </div>
                      </div>
                    ) : buscandoFipe ? (
                      <div className="col-span-2 p-2 bg-muted/50 rounded-lg flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        <span className="text-sm text-muted-foreground">Buscando valor FIPE...</span>
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* Documentos anexados */}
                <div className="p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Documentos Anexados
                  </h4>
                  <div className="space-y-2">
                    {documentos.filter(d => d.status === 'success').map((doc, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span>{doc.tipo_detectado === 'cnh' ? 'CNH' : doc.tipo_detectado === 'rg' ? 'RG' : doc.tipo_detectado === 'comprovante_residencia' ? 'Comprovante' : doc.tipo_detectado === 'crlv' ? 'CRLV' : 'Documento'}</span>
                        <span className="text-muted-foreground">- {doc.arquivo_nome}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Resumo financeiro */}
                <div className="p-4 bg-primary/10 rounded-lg">
                  <h4 className="font-medium mb-3">Resumo Financeiro</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-muted-foreground">Plano:</span> <span className="font-medium">{cotacao?.planos?.nome}</span></div>
                    <div><span className="text-muted-foreground">Adesão:</span> <span className="font-medium">{formatCurrency(cotacao?.valor_adesao || 0)}</span></div>
                    <div><span className="text-muted-foreground">Mensalidade:</span> <span className="font-medium">{formatCurrency(cotacao?.valor_total_mensal || 0)}</span></div>
                  </div>
                </div>
              </div>
            )}

            {/* Botões de navegação */}
            <div className="flex justify-between pt-4 border-t">
              <Button type="button" variant="outline" onClick={handleBack} disabled={step === 1}>
                <ChevronLeft className="w-4 h-4 mr-2" />
                Voltar
              </Button>

              {step < totalSteps ? (
                <Button 
                  type="button" 
                  onClick={handleNext}
                  disabled={
                    (step === STEP_DOCUMENTOS && !hasMinimumDocs) ||
                    (step === STEP_MIGRACAO && isMigracao && !migracaoAprovada)
                  }
                >
                  Próximo
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Criando...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Criar Contrato
                    </>
                  )}
                </Button>
              )}
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
