import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type {
  SoftruckOperation,
  SoftruckApiResponse,
  SoftruckEnterprise,
  SoftruckVehicle,
  SoftruckDevice,
  SoftruckChip,
  SoftruckUser,
  SoftruckTrackingData,
  CriarVeiculoParams,
  CriarDeviceParams,
  CriarChipParams,
  CriarUsuarioParams,
  EnterpriseDiscoveryResult,
} from '@/types/softruck';

// ========== FUNÇÃO BASE ==========

async function callSoftruckApi<T = unknown>(
  operation: SoftruckOperation,
  data: object = {}
): Promise<SoftruckApiResponse<T>> {
  console.log(`[useSoftruckApi] Chamando ${operation}`, data);
  
  const response = await supabase.functions.invoke('softruck-api', {
    body: { operation, data },
  });

  if (response.error) {
    console.error(`[useSoftruckApi] Erro em ${operation}:`, response.error);
    throw new Error(response.error.message);
  }

  if (!response.data?.success) {
    throw new Error(response.data?.error || 'Erro desconhecido');
  }

  return response.data as SoftruckApiResponse<T>;
}

// ========== HOOKS DE QUERY ==========

/**
 * Hook para verificar o status da API Softruck
 */
export function useSoftruckHealth() {
  return useQuery({
    queryKey: ['softruck', 'health'],
    queryFn: async () => {
      const result = await callSoftruckApi<{ status: string; statusCode: number }>('health', {});
      return result.data;
    },
    staleTime: 60000, // 1 minuto
  });
}

/**
 * Hook para listar enterprises Softruck
 */
export function useSoftruckEnterprises(params?: { limit?: number; page?: number; search?: string }) {
  return useQuery({
    queryKey: ['softruck', 'enterprises', params],
    queryFn: async () => {
      const result = await callSoftruckApi<{ data: SoftruckEnterprise[] }>('listar-enterprises', params || {});
      return result.data?.data || [];
    },
    enabled: false, // Executar apenas sob demanda
  });
}

/**
 * Hook para listar veículos Softruck
 */
export function useSoftruckVeiculos(params?: { limit?: number; page?: number; search?: string }) {
  return useQuery({
    queryKey: ['softruck', 'veiculos', params],
    queryFn: async () => {
      const result = await callSoftruckApi<{ data: SoftruckVehicle[] }>('listar-veiculos', params || {});
      return result.data?.data || [];
    },
    enabled: false,
  });
}

/**
 * Hook para listar devices Softruck
 */
export function useSoftruckDevices(params?: { limit?: number; page?: number; search?: string }) {
  return useQuery({
    queryKey: ['softruck', 'devices', params],
    queryFn: async () => {
      const result = await callSoftruckApi<{ data: SoftruckDevice[] }>('listar-devices', params || {});
      return result.data?.data || [];
    },
    enabled: false,
  });
}

/**
 * Hook para listar chips Softruck
 */
export function useSoftruckChips(params?: { limit?: number; page?: number; search?: string }) {
  return useQuery({
    queryKey: ['softruck', 'chips', params],
    queryFn: async () => {
      const result = await callSoftruckApi<{ data: SoftruckChip[] }>('listar-chips', params || {});
      return result.data?.data || [];
    },
    enabled: false,
  });
}

/**
 * Hook para listar usuários Softruck
 */
export function useSoftruckUsuarios(params?: { limit?: number; page?: number; search?: string }) {
  return useQuery({
    queryKey: ['softruck', 'usuarios', params],
    queryFn: async () => {
      const result = await callSoftruckApi<{ data: SoftruckUser[] }>('listar-usuarios', params || {});
      return result.data?.data || [];
    },
    enabled: false,
  });
}

// ========== HOOKS DE MUTATION ==========

/**
 * Hook para descobrir o Enterprise ID automaticamente
 */
export function useDescobrirEnterpriseId() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (cnpj?: string) => {
      const result = await callSoftruckApi<EnterpriseDiscoveryResult>('descobrir-enterprise-id', { cnpj });
      return result.data!;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['softruck'] });
      toast.success(`Enterprise descoberta: ${data.nome} (ID: ${data.enterprise_id})`);
    },
    onError: (error: Error) => {
      toast.error(`Erro ao descobrir Enterprise: ${error.message}`);
    },
  });
}

/**
 * Hook para buscar veículo por placa
 */
export function useBuscarVeiculoPorPlaca() {
  return useMutation({
    mutationFn: async (placa: string) => {
      const result = await callSoftruckApi<{ data: SoftruckVehicle[] }>('buscar-veiculo-placa', { placa });
      return result.data?.data || [];
    },
  });
}

/**
 * Hook para criar veículo no Softruck
 */
export function useCriarVeiculoSoftruck() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CriarVeiculoParams) => {
      const result = await callSoftruckApi<{ data: SoftruckVehicle[] }>('criar-veiculo', params);
      return result.data?.data?.[0];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['softruck', 'veiculos'] });
      toast.success('Veículo criado no Softruck');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar veículo: ${error.message}`);
    },
  });
}

/**
 * Hook para buscar device por IMEI
 */
export function useBuscarDevicePorImei() {
  return useMutation({
    mutationFn: async (imei: string) => {
      const result = await callSoftruckApi<{ data: SoftruckDevice[] }>('buscar-device-imei', { imei });
      return result.data?.data || [];
    },
  });
}

/**
 * Hook para criar device no Softruck
 */
export function useCriarDeviceSoftruck() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CriarDeviceParams) => {
      const result = await callSoftruckApi<{ data: SoftruckDevice[] }>('criar-device', params);
      return result.data?.data?.[0];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['softruck', 'devices'] });
      toast.success('Device criado no Softruck');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar device: ${error.message}`);
    },
  });
}

/**
 * Hook para ativar device
 */
export function useAtivarDeviceSoftruck() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (deviceId: string) => {
      const result = await callSoftruckApi('ativar-device', { deviceId });
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['softruck', 'devices'] });
      toast.success('Device ativado no Softruck');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao ativar device: ${error.message}`);
    },
  });
}

/**
 * Hook para desativar device
 */
export function useDesativarDeviceSoftruck() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (deviceId: string) => {
      const result = await callSoftruckApi('desativar-device', { deviceId });
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['softruck', 'devices'] });
      toast.success('Device desativado no Softruck');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao desativar device: ${error.message}`);
    },
  });
}

/**
 * Hook para vincular device a veículo
 */
export function useVincularDeviceVeiculoSoftruck() {
  return useMutation({
    mutationFn: async ({ deviceId, veiculoId }: { deviceId: string; veiculoId: string }) => {
      const result = await callSoftruckApi('vincular-device-veiculo', { deviceId, veiculoId });
      return result.data;
    },
    onSuccess: () => {
      toast.success('Device vinculado ao veículo');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao vincular device: ${error.message}`);
    },
  });
}

/**
 * Hook para criar chip no Softruck
 */
export function useCriarChipSoftruck() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CriarChipParams) => {
      const result = await callSoftruckApi<{ data: SoftruckChip[] }>('criar-chip', params);
      return result.data?.data?.[0];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['softruck', 'chips'] });
      toast.success('Chip criado no Softruck');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar chip: ${error.message}`);
    },
  });
}

/**
 * Hook para criar usuário no Softruck
 */
export function useCriarUsuarioSoftruck() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CriarUsuarioParams) => {
      const result = await callSoftruckApi<{ data: SoftruckUser }>('criar-usuario', params);
      return result.data?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['softruck', 'usuarios'] });
      toast.success('Usuário criado no Softruck');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar usuário: ${error.message}`);
    },
  });
}

/**
 * Hook para associar device a veículo (via endpoint de associações)
 */
export function useAssociarDeviceVeiculo() {
  return useMutation({
    mutationFn: async ({ deviceId, vehicleId, isPrincipal = true }: { 
      deviceId: string; 
      vehicleId: string; 
      isPrincipal?: boolean;
    }) => {
      const result = await callSoftruckApi('associar-device-veiculo', { deviceId, vehicleId, isPrincipal });
      return result.data;
    },
    onSuccess: () => {
      toast.success('Device associado ao veículo');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao associar device: ${error.message}`);
    },
  });
}

/**
 * Hook para associar usuário a veículo
 */
export function useAssociarUsuarioVeiculo() {
  return useMutation({
    mutationFn: async ({ userId, vehicleId }: { userId: string; vehicleId: string }) => {
      const result = await callSoftruckApi('associar-usuario-veiculo', { userId, vehicleId });
      return result.data;
    },
    onSuccess: () => {
      toast.success('Usuário associado ao veículo');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao associar usuário: ${error.message}`);
    },
  });
}

/**
 * Hook para obter posição atual (tracking)
 */
export function useObterPosicaoSoftruck() {
  return useMutation({
    mutationFn: async ({ veiculoId, deviceId }: { veiculoId: string; deviceId: string }) => {
      const result = await callSoftruckApi<SoftruckTrackingData>('tracking', { veiculoId, deviceId });
      return result.data;
    },
  });
}

/**
 * Hook para obter trajetórias
 */
export function useObterTrajetoriasSoftruck() {
  return useMutation({
    mutationFn: async ({ veiculoId, dataInicio, dataFim }: { 
      veiculoId: string; 
      dataInicio?: string; 
      dataFim?: string;
    }) => {
      const result = await callSoftruckApi('trajectories', { veiculoId, dataInicio, dataFim });
      return result.data;
    },
  });
}

// ========== HOOK UNIFICADO ==========

/**
 * Hook unificado que expõe todas as operações da API Softruck
 */
export function useSoftruckApi() {
  const descobrirEnterprise = useDescobrirEnterpriseId();
  const buscarVeiculoPorPlaca = useBuscarVeiculoPorPlaca();
  const criarVeiculo = useCriarVeiculoSoftruck();
  const buscarDevicePorImei = useBuscarDevicePorImei();
  const criarDevice = useCriarDeviceSoftruck();
  const ativarDevice = useAtivarDeviceSoftruck();
  const desativarDevice = useDesativarDeviceSoftruck();
  const vincularDeviceVeiculo = useVincularDeviceVeiculoSoftruck();
  const criarChip = useCriarChipSoftruck();
  const criarUsuario = useCriarUsuarioSoftruck();
  const associarDeviceVeiculo = useAssociarDeviceVeiculo();
  const associarUsuarioVeiculo = useAssociarUsuarioVeiculo();
  const obterPosicao = useObterPosicaoSoftruck();
  const obterTrajetorias = useObterTrajetoriasSoftruck();

  return {
    // Operações de Enterprise
    descobrirEnterprise,
    
    // Operações de Veículos
    buscarVeiculoPorPlaca,
    criarVeiculo,
    
    // Operações de Devices
    buscarDevicePorImei,
    criarDevice,
    ativarDevice,
    desativarDevice,
    vincularDeviceVeiculo,
    
    // Operações de Chips
    criarChip,
    
    // Operações de Usuários
    criarUsuario,
    
    // Operações de Associações
    associarDeviceVeiculo,
    associarUsuarioVeiculo,
    
    // Operações de Tracking
    obterPosicao,
    obterTrajetorias,
    
    // Função genérica para operações não cobertas pelos hooks
    callApi: callSoftruckApi,
  };
}

export default useSoftruckApi;
