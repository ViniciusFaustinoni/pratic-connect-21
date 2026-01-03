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
    clearError
  };
}
