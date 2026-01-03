import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface FipeMarca {
  codigo: string;
  nome: string;
}

export interface FipeModelo {
  codigo: number;
  nome: string;
}

export interface FipeAno {
  codigo: string;
  nome: string;
}

export interface FipeResult {
  codigoFipe: string;
  valor: string;
  valorNumerico: number;
  marca: string;
  modelo: string;
  anoModelo: number;
  combustivel: string;
  mesReferencia: string;
  marcaCodigo?: string;
  modeloCodigo?: string;
  anoCodigo?: string;
}

// New interfaces for plate-lookup
export interface VehicleData {
  placa: string;
  chassi: string;
  marca: string;
  modelo: string;
  marca_modelo: string;
  ano: string;
  cor: string;
  combustivel: string;
  municipio: string;
  uf: string;
  motor?: string;
  potencia?: string;
  cilindradas?: string;
  tipo_de_veiculo?: string;
  renavam?: string;
  categoria?: string;
  especie?: string;
  procedencia?: string;
}

export interface FipeData {
  codigo: string;
  valor: number;
  mesReferencia: string;
}

export interface PlateResult {
  success: boolean;
  extractedPlate?: string;
  vehicleData?: VehicleData;
  fipeData?: FipeData;
  error?: string;
}

// Legacy interface for backward compatibility
export interface PlacaResultLegacy {
  placa: string;
  marca: string;
  modelo: string;
  submodelo?: string;
  anoFabricacao: number | null;
  anoModelo: number | null;
  cor: string;
  combustivel: string;
  chassi?: string;
  municipio?: string;
  uf?: string;
  situacao?: string;
  origem?: string;
  codigoFipe?: string;
  valorFipe?: number;
  valorFipeFormatado?: string;
  mesReferencia?: string;
  marcaFipe?: string;
  modeloFipe?: string;
  fipeEncontrado?: boolean;
}

export type TipoVeiculo = 'carros' | 'motos' | 'caminhoes';

export function useFipe() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getMarcas = useCallback(async (tipo: TipoVeiculo = 'carros'): Promise<FipeMarca[]> => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('fipe-lookup', {
        body: { action: 'marcas', tipo }
      });
      
      if (fnError) throw fnError;
      if (!data.success) throw new Error(data.error);
      
      return data.data || [];
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao buscar marcas';
      setError(message);
      console.error('Erro getMarcas:', err);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const getModelos = useCallback(async (
    marcaCodigo: string,
    tipo: TipoVeiculo = 'carros'
  ): Promise<FipeModelo[]> => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('fipe-lookup', {
        body: { action: 'modelos', tipo, marcaCodigo }
      });
      
      if (fnError) throw fnError;
      if (!data.success) throw new Error(data.error);
      
      return data.data?.modelos || [];
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao buscar modelos';
      setError(message);
      console.error('Erro getModelos:', err);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const getAnos = useCallback(async (
    marcaCodigo: string,
    modeloCodigo: string,
    tipo: TipoVeiculo = 'carros'
  ): Promise<FipeAno[]> => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('fipe-lookup', {
        body: { action: 'anos', tipo, marcaCodigo, modeloCodigo }
      });
      
      if (fnError) throw fnError;
      if (!data.success) throw new Error(data.error);
      
      return data.data || [];
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao buscar anos';
      setError(message);
      console.error('Erro getAnos:', err);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const getPreco = useCallback(async (
    marcaCodigo: string,
    modeloCodigo: string,
    anoCodigo: string,
    tipo: TipoVeiculo = 'carros'
  ): Promise<FipeResult | null> => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('fipe-lookup', {
        body: { action: 'preco', tipo, marcaCodigo, modeloCodigo, anoCodigo }
      });
      
      if (fnError) throw fnError;
      if (!data.success) throw new Error(data.error);
      
      return data.data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao buscar preço';
      setError(message);
      console.error('Erro getPreco:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const buscarPorNome = useCallback(async (
    marca: string,
    modelo: string,
    ano?: string,
    tipo: TipoVeiculo = 'carros'
  ): Promise<FipeResult | null> => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('fipe-lookup', {
        body: { action: 'buscar-por-nome', tipo, marca, modelo, ano }
      });
      
      if (fnError) throw fnError;
      if (!data.success || !data.found) {
        throw new Error(data.error || 'Veículo não encontrado');
      }
      
      return data.data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao buscar veículo';
      setError(message);
      console.error('Erro buscarPorNome:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // New plate lookup function with updated API
  const getByPlaca = useCallback(async (placa: string): Promise<PlateResult> => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('plate-lookup', {
        body: { plate: placa }
      });
      
      if (fnError) {
        console.error('plate-lookup function error:', fnError);
        throw fnError;
      }
      
      if (!data.success) {
        throw new Error(data.error || 'Veículo não encontrado');
      }
      
      return data as PlateResult;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao buscar por placa';
      setError(message);
      console.error('Erro getByPlaca:', err);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  }, []);

  // New plate lookup with image (OCR)
  const getByPlateImage = useCallback(async (
    imageBase64: string, 
    mimeType: string = 'image/jpeg'
  ): Promise<PlateResult> => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('plate-lookup', {
        body: { imageBase64, mimeType }
      });
      
      if (fnError) {
        console.error('plate-lookup OCR function error:', fnError);
        throw fnError;
      }
      
      if (!data.success) {
        throw new Error(data.error || 'Não foi possível identificar a placa');
      }
      
      return data as PlateResult;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao processar imagem da placa';
      setError(message);
      console.error('Erro getByPlateImage:', err);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  }, []);

  // Legacy function for backward compatibility
  const getByPlacaLegacy = useCallback(async (placa: string): Promise<PlacaResultLegacy | null> => {
    const result = await getByPlaca(placa);
    
    if (!result.success || !result.vehicleData) {
      return null;
    }

    const { vehicleData, fipeData } = result;
    
    // Convert to legacy format
    return {
      placa: vehicleData.placa,
      marca: vehicleData.marca,
      modelo: vehicleData.modelo,
      anoFabricacao: vehicleData.ano ? parseInt(vehicleData.ano) : null,
      anoModelo: vehicleData.ano ? parseInt(vehicleData.ano) : null,
      cor: vehicleData.cor,
      combustivel: vehicleData.combustivel,
      chassi: vehicleData.chassi,
      municipio: vehicleData.municipio,
      uf: vehicleData.uf,
      codigoFipe: fipeData?.codigo,
      valorFipe: fipeData?.valor,
      valorFipeFormatado: fipeData?.valor 
        ? fipeData.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
        : undefined,
      mesReferencia: fipeData?.mesReferencia,
      marcaFipe: vehicleData.marca,
      modeloFipe: vehicleData.modelo,
      fipeEncontrado: !!fipeData,
    };
  }, [getByPlaca]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    loading,
    error,
    getMarcas,
    getModelos,
    getAnos,
    getPreco,
    buscarPorNome,
    getByPlaca,
    getByPlateImage,
    getByPlacaLegacy,
    clearError
  };
}
