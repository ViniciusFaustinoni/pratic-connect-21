import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  AssociadoTeste, 
  ASSOCIADO_TESTE, 
  STORAGE_KEYS,
  VeiculoTeste,
  BoletoTeste,
  ChamadoTeste,
  SinistroTeste,
  ManifestacaoTeste,
  DocumentoTeste,
  NotificacaoTeste,
  RevistoriaTeste,
} from '@/data/associadoTeste';

// ============================================
// TIPOS
// ============================================
interface AssociadoContextType {
  associado: AssociadoTeste | null;
  isTestMode: boolean;
  isLoading: boolean;
  
  // Dados relacionados (atalhos)
  veiculos: VeiculoTeste[];
  boletos: BoletoTeste[];
  chamados: ChamadoTeste[];
  sinistros: SinistroTeste[];
  manifestacoes: ManifestacaoTeste[];
  documentos: DocumentoTeste[];
  notificacoes: NotificacaoTeste[];
  notificacoesNaoLidas: number;
  revistoria: RevistoriaTeste | null;
  
  // Ações
  loginTeste: () => void;
  logout: () => void;
  marcarNotificacaoLida: (id: string) => void;
}

const AssociadoContext = createContext<AssociadoContextType | undefined>(undefined);

// ============================================
// PROVIDER
// ============================================
interface AssociadoProviderProps {
  children: ReactNode;
}

export function AssociadoProvider({ children }: AssociadoProviderProps) {
  const [associado, setAssociado] = useState<AssociadoTeste | null>(null);
  const [isTestMode, setIsTestMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Inicialização: verificar se há sessão de teste
  useEffect(() => {
    const checkTestSession = () => {
      try {
        const isTeste = localStorage.getItem(STORAGE_KEYS.TEST_MODE) === 'true';
        if (isTeste) {
          const dataStr = localStorage.getItem(STORAGE_KEYS.TEST_DATA);
          if (dataStr) {
            const data = JSON.parse(dataStr) as AssociadoTeste;
            setAssociado(data);
            setIsTestMode(true);
          }
        }
      } catch (error) {
        console.error('Erro ao carregar sessão de teste:', error);
        // Limpa dados corrompidos
        localStorage.removeItem(STORAGE_KEYS.TEST_MODE);
        localStorage.removeItem(STORAGE_KEYS.TEST_DATA);
      } finally {
        setIsLoading(false);
      }
    };

    checkTestSession();
  }, []);

  // Login de teste
  const loginTeste = () => {
    localStorage.setItem(STORAGE_KEYS.TEST_MODE, 'true');
    localStorage.setItem(STORAGE_KEYS.TEST_DATA, JSON.stringify(ASSOCIADO_TESTE));
    setAssociado(ASSOCIADO_TESTE);
    setIsTestMode(true);
  };

  // Logout
  const logout = () => {
    localStorage.removeItem(STORAGE_KEYS.TEST_MODE);
    localStorage.removeItem(STORAGE_KEYS.TEST_DATA);
    setAssociado(null);
    setIsTestMode(false);
  };

  // Marcar notificação como lida
  const marcarNotificacaoLida = (id: string) => {
    if (!associado) return;
    
    const novasNotificacoes = associado.notificacoes.map(n =>
      n.id === id ? { ...n, lida: true } : n
    );
    
    const novoAssociado = { ...associado, notificacoes: novasNotificacoes };
    setAssociado(novoAssociado);
    
    if (isTestMode) {
      localStorage.setItem(STORAGE_KEYS.TEST_DATA, JSON.stringify(novoAssociado));
    }
  };

  // Dados derivados
  const veiculos = associado?.veiculos ?? [];
  const boletos = associado?.boletos ?? [];
  const chamados = associado?.chamados ?? [];
  const sinistros = associado?.sinistros ?? [];
  const manifestacoes = associado?.manifestacoes ?? [];
  const documentos = associado?.documentos ?? [];
  const notificacoes = associado?.notificacoes ?? [];
  const notificacoesNaoLidas = notificacoes.filter(n => !n.lida).length;
  const revistoria = associado?.revistoria ?? null;

  return (
    <AssociadoContext.Provider
      value={{
        associado,
        isTestMode,
        isLoading,
        veiculos,
        boletos,
        chamados,
        sinistros,
        manifestacoes,
        documentos,
        notificacoes,
        notificacoesNaoLidas,
        revistoria,
        loginTeste,
        logout,
        marcarNotificacaoLida,
      }}
    >
      {children}
    </AssociadoContext.Provider>
  );
}

// ============================================
// HOOK
// ============================================
export function useAssociado() {
  const context = useContext(AssociadoContext);
  if (context === undefined) {
    throw new Error('useAssociado must be used within an AssociadoProvider');
  }
  return context;
}
