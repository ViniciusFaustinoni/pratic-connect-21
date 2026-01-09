import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type FlowStep = 'upload' | 'processing' | 'confirmation' | 'success';

export interface VehicleData {
  placa: string;
  marca: string;
  modelo: string;
  ano: string;
  cor: string;
  combustivel: string;
  chassi: string;
  renavam: string;
  municipio: string;
  uf: string;
  tipo_veiculo: string;
}

export interface FipeData {
  codigo: string;
  valor: number;
  mesReferencia: string;
}

export interface PersonalData {
  nome: string;
  cpf: string;
  rg?: string;
  data_nascimento?: string;
  cnh?: string;
  cnh_categoria?: string;
  cnh_validade?: string;
}

export interface ProcessingStatus {
  plate: 'idle' | 'processing' | 'done' | 'error';
  document: 'idle' | 'processing' | 'done' | 'error';
}

export interface NewLeadFlowState {
  step: FlowStep;
  telefone: string;
  email: string;
  plateImage: File | null;
  documentImage: File | null;
  vehicleData: VehicleData | null;
  fipeData: FipeData | null;
  personalData: PersonalData | null;
  processingStatus: ProcessingStatus;
  selectedVendedor: string;
  isWorkVehicle: boolean;
  generateQuoteLink: boolean;
  createdLeadId: string | null;
  publicQuoteToken: string | null;
  origem: string;
}

const initialState: NewLeadFlowState = {
  step: 'upload',
  telefone: '',
  email: '',
  plateImage: null,
  documentImage: null,
  vehicleData: null,
  fipeData: null,
  personalData: null,
  processingStatus: { plate: 'idle', document: 'idle' },
  selectedVendedor: '',
  isWorkVehicle: false,
  generateQuoteLink: true,
  createdLeadId: null,
  publicQuoteToken: null,
  origem: 'whatsapp',
};

export function useNewLeadFlow() {
  const [state, setState] = useState<NewLeadFlowState>(initialState);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateState = useCallback((updates: Partial<NewLeadFlowState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  // Converter File para base64
  const fileToBase64 = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix (data:image/jpeg;base64,)
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = error => reject(error);
    });
  };

  // Processar placa via Edge Function
  const processPlate = async (plateImage: File): Promise<{ vehicleData: VehicleData | null; fipeData: FipeData | null }> => {
    updateState({ processingStatus: { ...state.processingStatus, plate: 'processing' } });

    try {
      const base64 = await fileToBase64(plateImage);
      
      // Primeiro tenta OCR da imagem
      const { data: ocrResult, error: ocrError } = await supabase.functions.invoke('plate-ocr', {
        body: { imageBase64: base64, mimeType: plateImage.type }
      });

      let plateText = '';
      
      if (!ocrError && ocrResult?.success && ocrResult?.plate) {
        plateText = ocrResult.plate;
      } else {
        // Se OCR falhar, pode retornar null e pedir input manual
        console.log('OCR da placa não disponível, usando input manual');
        updateState({ processingStatus: { ...state.processingStatus, plate: 'error' } });
        return { vehicleData: null, fipeData: null };
      }

      // Consultar dados do veículo pela placa
      const { data: plateResult, error: plateError } = await supabase.functions.invoke('plate-lookup', {
        body: { placa: plateText }
      });

      if (plateError || !plateResult?.success) {
        console.error('Erro na consulta de placa:', plateError || plateResult?.error);
        updateState({ processingStatus: { ...state.processingStatus, plate: 'error' } });
        return { vehicleData: null, fipeData: null };
      }

      const vehicleData: VehicleData = {
        placa: plateResult.vehicleData?.placa || plateText,
        marca: plateResult.vehicleData?.marca || '',
        modelo: plateResult.vehicleData?.modelo || '',
        ano: plateResult.vehicleData?.ano || '',
        cor: plateResult.vehicleData?.cor || '',
        combustivel: plateResult.vehicleData?.combustivel || '',
        chassi: plateResult.vehicleData?.chassi || '',
        renavam: plateResult.vehicleData?.renavam || '',
        municipio: plateResult.vehicleData?.municipio || '',
        uf: plateResult.vehicleData?.uf || '',
        tipo_veiculo: plateResult.vehicleData?.tipo_veiculo || '',
      };

      const fipeData: FipeData | null = plateResult.fipeData ? {
        codigo: plateResult.fipeData.codigo,
        valor: typeof plateResult.fipeData.valor === 'string' 
          ? parseFloat(plateResult.fipeData.valor.replace(/[^\d,]/g, '').replace(',', '.'))
          : plateResult.fipeData.valor,
        mesReferencia: plateResult.fipeData.mesReferencia || '',
      } : null;

      updateState({ processingStatus: { ...state.processingStatus, plate: 'done' } });
      return { vehicleData, fipeData };

    } catch (error) {
      console.error('Erro ao processar placa:', error);
      updateState({ processingStatus: { ...state.processingStatus, plate: 'error' } });
      return { vehicleData: null, fipeData: null };
    }
  };

  // Processar documento (CNH) via Edge Function
  const processDocument = async (documentImage: File): Promise<PersonalData | null> => {
    updateState({ processingStatus: { ...state.processingStatus, document: 'processing' } });

    try {
      const base64 = await fileToBase64(documentImage);
      
      const { data, error } = await supabase.functions.invoke('document-ocr', {
        body: { 
          url: `data:${documentImage.type};base64,${base64}`,
          tipoEsperado: 'cnh'
        }
      });

      if (error || !data) {
        console.error('Erro no OCR do documento:', error);
        updateState({ processingStatus: { ...state.processingStatus, document: 'error' } });
        return null;
      }

      const personalData: PersonalData = {
        nome: data.nome || '',
        cpf: data.cpf || '',
        rg: data.rg || '',
        data_nascimento: data.data_nascimento || '',
        cnh: data.cnh || '',
        cnh_categoria: data.categoria || '',
        cnh_validade: data.validade || '',
      };

      updateState({ processingStatus: { ...state.processingStatus, document: 'done' } });
      return personalData;

    } catch (error) {
      console.error('Erro ao processar documento:', error);
      updateState({ processingStatus: { ...state.processingStatus, document: 'error' } });
      return null;
    }
  };

  // Processar tudo e avançar para confirmação
  const processAll = async () => {
    updateState({ step: 'processing' });

    let vehicleData: VehicleData | null = null;
    let fipeData: FipeData | null = null;
    let personalData: PersonalData | null = null;

    // Processar placa (usando lookup direto por enquanto, sem OCR de imagem)
    if (state.plateImage) {
      // Por enquanto, vamos usar um approach alternativo - pedir a placa digitada
      // já que plate-ocr pode não existir ainda
    }

    // Processar documento se fornecido
    if (state.documentImage) {
      personalData = await processDocument(state.documentImage);
    }

    updateState({ 
      vehicleData: vehicleData || state.vehicleData,
      fipeData: fipeData || state.fipeData,
      personalData: personalData || state.personalData,
      step: 'confirmation' 
    });
  };

  // Lookup de placa diretamente (sem OCR de imagem)
  const lookupPlate = async (placa: string) => {
    updateState({ processingStatus: { ...state.processingStatus, plate: 'processing' } });

    try {
      const { data: plateResult, error: plateError } = await supabase.functions.invoke('plate-lookup', {
        body: { placa }
      });

      if (plateError || !plateResult?.success) {
        console.error('Erro na consulta de placa:', plateError || plateResult?.error);
        toast.error(plateResult?.error || 'Erro ao consultar placa');
        updateState({ processingStatus: { ...state.processingStatus, plate: 'error' } });
        return false;
      }

      const vehicleData: VehicleData = {
        placa: plateResult.vehicleData?.placa || placa,
        marca: plateResult.vehicleData?.marca || '',
        modelo: plateResult.vehicleData?.modelo || '',
        ano: plateResult.vehicleData?.ano || '',
        cor: plateResult.vehicleData?.cor || '',
        combustivel: plateResult.vehicleData?.combustivel || '',
        chassi: plateResult.vehicleData?.chassi || '',
        renavam: plateResult.vehicleData?.renavam || '',
        municipio: plateResult.vehicleData?.municipio || '',
        uf: plateResult.vehicleData?.uf || '',
        tipo_veiculo: plateResult.vehicleData?.tipo_veiculo || '',
      };

      const fipeData: FipeData | null = plateResult.fipeData ? {
        codigo: plateResult.fipeData.codigo,
        valor: typeof plateResult.fipeData.valor === 'string' 
          ? parseFloat(plateResult.fipeData.valor.replace(/[^\d,]/g, '').replace(',', '.'))
          : plateResult.fipeData.valor,
        mesReferencia: plateResult.fipeData.mesReferencia || '',
      } : null;

      updateState({ 
        vehicleData,
        fipeData,
        processingStatus: { ...state.processingStatus, plate: 'done' } 
      });
      
      toast.success('Dados do veículo carregados!');
      return true;

    } catch (error) {
      console.error('Erro ao consultar placa:', error);
      toast.error('Erro ao consultar placa');
      updateState({ processingStatus: { ...state.processingStatus, plate: 'error' } });
      return false;
    }
  };

  // Criar lead e cotação pública
  const createLead = async (): Promise<{ leadId: string; token?: string } | null> => {
    setIsSubmitting(true);

    try {
      // 1. Criar o lead
      const leadData = {
        nome: state.personalData?.nome || 'Lead sem nome',
        telefone: state.telefone.replace(/\D/g, ''),
        email: state.email || null,
        cpf: state.personalData?.cpf || null,
        veiculo_marca: state.vehicleData?.marca || null,
        veiculo_modelo: state.vehicleData?.modelo || null,
        veiculo_ano: state.vehicleData?.ano ? parseInt(state.vehicleData.ano.split('/')[0]) : null,
        veiculo_placa: state.vehicleData?.placa || null,
        veiculo_fipe: state.fipeData?.valor || null,
        origem: state.origem as 'whatsapp',
        vendedor_id: state.selectedVendedor || null,
        etapa: 'novo' as const,
        observacoes: state.isWorkVehicle ? 'Veículo de trabalho (APP)' : null,
      };

      const { data: lead, error: leadError } = await supabase
        .from('leads')
        .insert(leadData)
        .select()
        .single();

      if (leadError) throw leadError;

      let token: string | undefined;

      // 2. Criar cotação pública se solicitado
      if (state.generateQuoteLink) {
        const { data: cotacao, error: cotacaoError } = await (supabase as any)
          .from('cotacoes_publicas')
          .insert({
            lead_id: lead.id,
            vendedor_id: state.selectedVendedor || null,
            veiculo_marca: state.vehicleData?.marca || null,
            veiculo_modelo: state.vehicleData?.modelo || null,
            veiculo_ano: state.vehicleData?.ano ? parseInt(state.vehicleData.ano.split('/')[0]) : null,
            veiculo_placa: state.vehicleData?.placa || null,
            valor_fipe: state.fipeData?.valor || null,
            veiculo_cor: state.vehicleData?.cor || null,
            veiculo_combustivel: state.vehicleData?.combustivel || null,
            status: 'aguardando',
          })
          .select()
          .single();

        if (cotacaoError) {
          console.error('Erro ao criar cotação:', cotacaoError);
          toast.warning('Lead criado, mas houve erro ao gerar link de cotação');
        } else {
          token = cotacao.token;
        }
      }

      updateState({ 
        createdLeadId: lead.id,
        publicQuoteToken: token || null,
        step: 'success'
      });

      toast.success('Lead criado com sucesso!');
      return { leadId: lead.id, token };

    } catch (error) {
      console.error('Erro ao criar lead:', error);
      toast.error('Erro ao criar lead');
      return null;
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    state,
    updateState,
    reset,
    processAll,
    lookupPlate,
    processDocument,
    createLead,
    isSubmitting,
  };
}
