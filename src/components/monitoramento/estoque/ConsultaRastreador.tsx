import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Search,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Wrench,
  Car,
  Package,
  Loader2,
  Clock,
  MapPin,
  Smartphone,
  User,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { usePlataformasLabels } from '@/hooks/usePlataformasCRUD';

interface RastreadorDetalhado {
  id: string;
  codigo: string;
  imei: string;
  numero_serie: string | null;
  plataforma: string;
  status: 'estoque' | 'instalado' | 'manutencao' | 'baixado';
  chip_iccid: string | null;
  chip_operadora?: string | null;
  id_plataforma: string | null;
  ultima_comunicacao: string | null;
  created_at: string;
  veiculos: {
    id: string;
    placa: string;
    modelo: string | null;
    associados: {
      id: string;
      nome: string;
    } | null;
  } | null;
}

interface MovimentacaoHistorico {
  id: string;
  tipo: string;
  created_at: string;
  status_anterior: string | null;
  status_novo: string | null;
  nota_fiscal: string | null;
  fornecedor: string | null;
  observacoes: string | null;
  profiles: {
    nome: string | null;
  } | null;
}

const statusConfig = {
  estoque: {
    label: 'Disponível no Estoque',
    icon: Package,
    bgColor: 'bg-green-500/10',
    textColor: 'text-green-600',
    borderColor: 'border-green-500/30',
  },
  instalado: {
    label: 'Instalado em Veículo',
    icon: Car,
    bgColor: 'bg-blue-500/10',
    textColor: 'text-blue-600',
    borderColor: 'border-blue-500/30',
  },
  manutencao: {
    label: 'Em Manutenção',
    icon: Wrench,
    bgColor: 'bg-amber-500/10',
    textColor: 'text-amber-600',
    borderColor: 'border-amber-500/30',
  },
  baixado: {
    label: 'Baixado/Descartado',
    icon: XCircle,
    bgColor: 'bg-red-500/10',
    textColor: 'text-red-600',
    borderColor: 'border-red-500/30',
  },
};

export function ConsultaRastreador() {
  const [busca, setBusca] = useState('');
  const [buscaDebounced, setBuscaDebounced] = useState('');
  const { data: plataformasLabels } = usePlataformasLabels();

  // Debounce search
  useEffect(() => {
    const timeout = setTimeout(() => {
      setBuscaDebounced(busca.trim());
    }, 300);
    return () => clearTimeout(timeout);
  }, [busca]);

  const { data: rastreador, isLoading, isFetching } = useQuery({
    queryKey: ['consulta-rastreador', buscaDebounced],
    queryFn: async () => {
      if (!buscaDebounced || buscaDebounced.length < 3) return null;

      const { data, error } = await supabase
        .from('rastreadores')
        .select(`
          *,
          veiculos (
            id,
            placa,
            modelo,
            associados (id, nome)
          )
        `)
        .or(`imei.ilike.%${buscaDebounced}%,codigo.ilike.%${buscaDebounced}%,numero_serie.ilike.%${buscaDebounced}%`)
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as RastreadorDetalhado | null;
    },
    enabled: buscaDebounced.length >= 3,
  });

  const { data: historico } = useQuery({
    queryKey: ['consulta-rastreador-historico', rastreador?.id],
    queryFn: async () => {
      if (!rastreador?.id) return [];

      const { data, error } = await supabase
        .from('estoque_movimentacoes')
        .select(`
          id,
          tipo,
          created_at,
          status_anterior,
          status_novo,
          nota_fiscal,
          fornecedor,
          observacoes,
          profiles (nome)
        `)
        .eq('rastreador_id', rastreador.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data as MovimentacaoHistorico[];
    },
    enabled: !!rastreador?.id,
  });

  const config = rastreador ? statusConfig[rastreador.status] : null;
  const StatusIcon = config?.icon || Package;

  return (
    <div className="space-y-6">
      {/* Search Field */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Consulta de Disponibilidade
          </CardTitle>
          <CardDescription>
            Busque por IMEI, código ou número de série para verificar status e disponibilidade
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Digite o IMEI, código ou número de série..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-10 text-lg h-12"
            />
            {isFetching && (
              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Loading State */}
      {isLoading && buscaDebounced.length >= 3 && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Not Found State */}
      {!isLoading && buscaDebounced.length >= 3 && !rastreador && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 text-red-600">
              <XCircle className="h-8 w-8" />
              <div>
                <p className="font-semibold">Rastreador não encontrado</p>
                <p className="text-sm text-muted-foreground">
                  Nenhum rastreador foi encontrado com o termo "{buscaDebounced}"
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Result */}
      {rastreador && config && (
        <>
          {/* Status Card */}
          <Card className={`${config.borderColor} ${config.bgColor} border-2`}>
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className={`rounded-full p-3 ${config.bgColor}`}>
                  <StatusIcon className={`h-8 w-8 ${config.textColor}`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-xl font-bold">{rastreador.codigo}</h3>
                    <Badge className={`${config.bgColor} ${config.textColor} ${config.borderColor}`}>
                      {config.label}
                    </Badge>
                  </div>
                  
                  {rastreador.status === 'instalado' && rastreador.veiculos && (
                    <div className="flex items-center gap-4 mt-2 text-sm">
                      <span className="flex items-center gap-1">
                        <Car className="h-4 w-4" />
                        {rastreador.veiculos.placa}
                        {rastreador.veiculos.modelo && ` - ${rastreador.veiculos.modelo}`}
                      </span>
                      {rastreador.veiculos.associados && (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <User className="h-4 w-4" />
                          {rastreador.veiculos.associados.nome}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Details Card */}
          <Card>
            <CardHeader>
              <CardTitle>Informações do Rastreador</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">IMEI</p>
                  <p className="font-mono font-medium">{rastreador.imei}</p>
                </div>
                
                {rastreador.numero_serie && (
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Número de Série</p>
                    <p className="font-mono font-medium">{rastreador.numero_serie}</p>
                  </div>
                )}

                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Plataforma</p>
                  <p className="font-medium">
                    {plataformasLabels?.[rastreador.plataforma] || rastreador.plataforma}
                  </p>
                </div>

                {rastreador.id_plataforma && (
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">ID na Plataforma</p>
                    <p className="font-mono font-medium">{rastreador.id_plataforma}</p>
                  </div>
                )}

                {rastreador.chip_iccid && (
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Smartphone className="h-3 w-3" />
                      ICCID do Chip
                    </p>
                    <p className="font-mono text-sm">{rastreador.chip_iccid}</p>
                  </div>
                )}

                {rastreador.chip_operadora && (
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Operadora</p>
                    <p className="font-medium">{rastreador.chip_operadora}</p>
                  </div>
                )}

                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Data de Entrada
                  </p>
                  <p className="font-medium">
                    {format(new Date(rastreador.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>

                {rastreador.ultima_comunicacao && (
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      Última Comunicação
                    </p>
                    <p className="font-medium">
                      {format(new Date(rastreador.ultima_comunicacao), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* History Card */}
          {historico && historico.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Histórico de Movimentações
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {historico.map((mov) => (
                    <div key={mov.id} className="flex gap-4 pb-4 border-b last:border-0 last:pb-0">
                      <div className="flex-shrink-0">
                        <div className="h-2 w-2 rounded-full bg-primary mt-2" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium capitalize">{mov.tipo}</span>
                          {mov.status_anterior && mov.status_novo && (
                            <span className="text-xs text-muted-foreground">
                              {mov.status_anterior} → {mov.status_novo}
                            </span>
                          )}
                          {mov.nota_fiscal && (
                            <Badge variant="outline" className="text-xs">
                              NF: {mov.nota_fiscal}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(mov.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          {mov.profiles?.nome && ` • ${mov.profiles.nome}`}
                        </p>
                        {mov.observacoes && (
                          <p className="text-sm text-muted-foreground mt-1">{mov.observacoes}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Initial State */}
      {buscaDebounced.length < 3 && !rastreador && (
        <Card className="border-dashed">
          <CardContent className="pt-6">
            <div className="text-center text-muted-foreground py-8">
              <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Digite pelo menos 3 caracteres para buscar</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
