import { useState, useCallback, useRef, useEffect } from 'react';
import { compressImage, createOptimizedPreview, revokePreview } from '@/lib/imageCompressor';
import { toast } from 'sonner';

// ============================================
// HOOK: UPLOAD COM RECUPERAÇÃO E OTIMIZAÇÃO
// Para dispositivos com baixa memória
// ============================================

interface UploadItem {
  id: string;
  file: File;
  previewUrl: string;
  status: 'pendente' | 'enviando' | 'sucesso' | 'erro';
  tentativas: number;
  erro?: string;
  resultado?: { url: string; kmExtraido?: number };
}

interface UseUploadComRecuperacaoOptions {
  maxTentativas?: number;
  compressaoAtiva?: boolean;
  maxSizeKB?: number;
  onUpload: (fotoId: string, file: File) => Promise<{ url: string; kmExtraido?: number }>;
  onAllComplete?: () => void;
}

const STORAGE_KEY_PREFIX = 'autovistoria_pendente_';

export function useUploadComRecuperacao(
  sessionId: string,
  options: UseUploadComRecuperacaoOptions
) {
  const {
    maxTentativas = 3,
    compressaoAtiva = true,
    maxSizeKB = 800,
    onUpload,
    onAllComplete,
  } = options;

  const [itens, setItens] = useState<Record<string, UploadItem>>({});
  const [processando, setProcessando] = useState<string | null>(null);
  const filaRef = useRef<string[]>([]);
  const processandoRef = useRef(false);

  // Limpar previews ao desmontar
  useEffect(() => {
    return () => {
      Object.values(itens).forEach((item) => {
        revokePreview(item.previewUrl);
      });
    };
  }, []);

  // Salvar estado pendente no localStorage para recuperação
  const salvarEstadoPendente = useCallback((novosItens: Record<string, UploadItem>) => {
    const pendentes: string[] = [];
    Object.entries(novosItens).forEach(([id, item]) => {
      if (item.status === 'sucesso' && item.resultado?.url) {
        pendentes.push(`${id}:${item.resultado.url}`);
      }
    });
    
    if (pendentes.length > 0) {
      try {
        localStorage.setItem(`${STORAGE_KEY_PREFIX}${sessionId}`, JSON.stringify(pendentes));
      } catch (e) {
        // Ignorar erro de storage cheio
        console.warn('[useUploadComRecuperacao] Erro ao salvar estado:', e);
      }
    }
  }, [sessionId]);

  // Recuperar estado salvo
  const recuperarEstado = useCallback((): Record<string, string> => {
    try {
      const salvo = localStorage.getItem(`${STORAGE_KEY_PREFIX}${sessionId}`);
      if (salvo) {
        const pendentes = JSON.parse(salvo) as string[];
        const mapa: Record<string, string> = {};
        pendentes.forEach((p) => {
          const [id, url] = p.split(':');
          if (id && url) mapa[id] = url;
        });
        return mapa;
      }
    } catch (e) {
      console.warn('[useUploadComRecuperacao] Erro ao recuperar estado:', e);
    }
    return {};
  }, [sessionId]);

  // Limpar estado salvo
  const limparEstadoSalvo = useCallback(() => {
    try {
      localStorage.removeItem(`${STORAGE_KEY_PREFIX}${sessionId}`);
    } catch (e) {
      console.warn('[useUploadComRecuperacao] Erro ao limpar estado:', e);
    }
  }, [sessionId]);

  // Processar fila sequencialmente (um por vez para economizar memória)
  const processarFila = useCallback(async () => {
    if (processandoRef.current || filaRef.current.length === 0) return;
    
    processandoRef.current = true;
    
    while (filaRef.current.length > 0) {
      const fotoId = filaRef.current[0];
      
      setItens((prev) => {
        const item = prev[fotoId];
        if (!item) return prev;
        return { ...prev, [fotoId]: { ...item, status: 'enviando' } };
      });
      setProcessando(fotoId);
      
      let sucesso = false;
      let resultado: { url: string; kmExtraido?: number } | undefined;
      let ultimoErro = '';
      
      // Obter item atual
      const itemAtual = await new Promise<UploadItem | undefined>((resolve) => {
        setItens((prev) => {
          resolve(prev[fotoId]);
          return prev;
        });
      });
      
      if (!itemAtual) {
        filaRef.current.shift();
        continue;
      }
      
      // Tentar upload com retry
      for (let tentativa = 1; tentativa <= maxTentativas && !sucesso; tentativa++) {
        try {
          // Comprimir arquivo se ativo
          let arquivoFinal = itemAtual.file;
          if (compressaoAtiva) {
            arquivoFinal = await compressImage(itemAtual.file, { maxSizeKB });
          }
          
          resultado = await onUpload(fotoId, arquivoFinal);
          sucesso = true;
        } catch (error: any) {
          ultimoErro = error?.message || 'Erro desconhecido';
          console.warn(`[useUploadComRecuperacao] Tentativa ${tentativa}/${maxTentativas} falhou:`, ultimoErro);
          
          // Aguardar antes de tentar novamente
          if (tentativa < maxTentativas) {
            await new Promise((r) => setTimeout(r, 1000 * tentativa));
          }
        }
      }
      
      // Atualizar estado do item
      setItens((prev) => {
        const newItens = {
          ...prev,
          [fotoId]: {
            ...prev[fotoId],
            status: sucesso ? 'sucesso' : 'erro',
            tentativas: prev[fotoId].tentativas + 1,
            resultado: sucesso ? resultado : undefined,
            erro: sucesso ? undefined : ultimoErro,
          } as UploadItem,
        };
        
        // Salvar estado para recuperação
        salvarEstadoPendente(newItens);
        
        return newItens;
      });
      
      // Remover da fila
      filaRef.current.shift();
      
      // Liberar memória do preview se sucesso
      if (sucesso && itemAtual.previewUrl) {
        // Delay para dar tempo da UI atualizar
        setTimeout(() => revokePreview(itemAtual.previewUrl), 2000);
      }
    }
    
    setProcessando(null);
    processandoRef.current = false;
    
    // Verificar se todos foram enviados com sucesso
    setItens((prev) => {
      const todosEnviados = Object.values(prev).every((i) => i.status === 'sucesso');
      if (todosEnviados && Object.keys(prev).length > 0) {
        onAllComplete?.();
      }
      return prev;
    });
  }, [maxTentativas, compressaoAtiva, maxSizeKB, onUpload, onAllComplete, salvarEstadoPendente]);

  // Adicionar foto à fila
  const adicionarFoto = useCallback(async (fotoId: string, file: File) => {
    // Criar preview otimizado (Object URL ao invés de base64)
    const previewUrl = createOptimizedPreview(file);
    
    // Revogar preview anterior se existir
    setItens((prev) => {
      if (prev[fotoId]?.previewUrl) {
        revokePreview(prev[fotoId].previewUrl);
      }
      return prev;
    });
    
    // Adicionar à lista de itens
    setItens((prev) => ({
      ...prev,
      [fotoId]: {
        id: fotoId,
        file,
        previewUrl,
        status: 'pendente',
        tentativas: 0,
      },
    }));
    
    // Adicionar à fila se não estiver lá
    if (!filaRef.current.includes(fotoId)) {
      filaRef.current.push(fotoId);
    }
    
    // Iniciar processamento
    processarFila();
  }, [processarFila]);

  // Retentar foto com erro
  const retentarFoto = useCallback((fotoId: string) => {
    setItens((prev) => {
      const item = prev[fotoId];
      if (!item || item.status !== 'erro') return prev;
      return {
        ...prev,
        [fotoId]: { ...item, status: 'pendente', tentativas: 0 },
      };
    });
    
    if (!filaRef.current.includes(fotoId)) {
      filaRef.current.push(fotoId);
    }
    
    processarFila();
  }, [processarFila]);

  // Obter estatísticas
  const getEstatisticas = useCallback(() => {
    const lista = Object.values(itens);
    return {
      total: lista.length,
      pendentes: lista.filter((i) => i.status === 'pendente').length,
      enviando: lista.filter((i) => i.status === 'enviando').length,
      sucesso: lista.filter((i) => i.status === 'sucesso').length,
      erros: lista.filter((i) => i.status === 'erro').length,
    };
  }, [itens]);

  // Obter preview de uma foto
  const getPreview = useCallback((fotoId: string): string | null => {
    return itens[fotoId]?.previewUrl || null;
  }, [itens]);

  // Verificar se foto foi enviada
  const fotoEnviada = useCallback((fotoId: string): boolean => {
    return itens[fotoId]?.status === 'sucesso';
  }, [itens]);

  // Obter URL da foto enviada
  const getUrlEnviada = useCallback((fotoId: string): string | null => {
    return itens[fotoId]?.resultado?.url || null;
  }, [itens]);

  // Verificar se está processando alguma foto
  const estaProcessando = useCallback((): boolean => {
    return processandoRef.current;
  }, []);

  return {
    itens,
    processando,
    adicionarFoto,
    retentarFoto,
    getEstatisticas,
    getPreview,
    fotoEnviada,
    getUrlEnviada,
    estaProcessando,
    recuperarEstado,
    limparEstadoSalvo,
  };
}
