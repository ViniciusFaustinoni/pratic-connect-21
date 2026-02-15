import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Users, Car, AlertTriangle, FileText, Shield, BookOpen } from 'lucide-react';

import ConsultaAssociado from '@/components/juridico/consultas/ConsultaAssociado';
import ConsultaVeiculo from '@/components/juridico/consultas/ConsultaVeiculo';
import ConsultaEvento from '@/components/juridico/consultas/ConsultaEvento';
import ConsultaProcessos from '@/components/juridico/consultas/ConsultaProcessos';
import ConsultaAntecedentes from '@/components/juridico/consultas/ConsultaAntecedentes';
import ConsultaRegulamento from '@/components/juridico/consultas/ConsultaRegulamento';

type TipoBusca = 'cpf' | 'placa' | 'protocolo' | 'processo' | 'texto' | null;

function detectarTipoBusca(termo: string): TipoBusca {
  const limpo = termo.trim();
  if (!limpo) return null;
  // CPF
  if (/^\d{11}$/.test(limpo.replace(/\D/g, '')) && (limpo.length === 11 || /^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(limpo))) return 'cpf';
  // Placa
  if (/^[A-Z]{3}\d[A-Z0-9]\d{2}$/i.test(limpo.replace('-', '')) || /^[A-Z]{3}-\d{4}$/i.test(limpo)) return 'placa';
  // Protocolo
  if (/^EVT-\d{4}-\d+$/i.test(limpo)) return 'protocolo';
  // Processo
  if (/^\d+\/\d{4}$/.test(limpo)) return 'processo';
  // Texto livre
  return 'texto';
}

export default function ConsultasUnificadas() {
  const [termo, setTermo] = useState('');
  const [buscaAtiva, setBuscaAtiva] = useState('');
  const [tab, setTab] = useState('associados');

  const tipoBusca = useMemo(() => detectarTipoBusca(buscaAtiva), [buscaAtiva]);

  const handleBuscar = () => {
    setBuscaAtiva(termo.trim());
    // Auto-selecionar tab baseado no tipo
    const tipo = detectarTipoBusca(termo.trim());
    if (tipo === 'cpf') setTab('associados');
    else if (tipo === 'placa') setTab('veiculos');
    else if (tipo === 'protocolo') setTab('eventos');
    else if (tipo === 'processo') setTab('processos');
  };

  // Buscar associado por CPF ou nome
  const { data: associados = [], isLoading: loadingAssociados } = useQuery({
    queryKey: ['busca-associados', buscaAtiva],
    queryFn: async () => {
      if (!buscaAtiva) return [];
      const tipo = detectarTipoBusca(buscaAtiva);
      let query = supabase.from('associados').select('id, nome, cpf, status, telefone').limit(20);
      if (tipo === 'cpf') {
        query = query.eq('cpf', buscaAtiva.replace(/\D/g, ''));
      } else {
        query = query.ilike('nome', `%${buscaAtiva}%`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!buscaAtiva && (tipoBusca === 'cpf' || tipoBusca === 'texto'),
  });

  // Buscar veículo por placa
  const { data: veiculos = [], isLoading: loadingVeiculos } = useQuery({
    queryKey: ['busca-veiculos', buscaAtiva],
    queryFn: async () => {
      if (!buscaAtiva) return [];
      const placaLimpa = buscaAtiva.replace('-', '').toUpperCase();
      const { data, error } = await supabase
        .from('veiculos')
        .select('id, placa, marca, modelo, ano_modelo, associado:associados(nome)')
        .ilike('placa', `%${placaLimpa}%`)
        .limit(20);
      if (error) throw error;
      return data;
    },
    enabled: !!buscaAtiva && (tipoBusca === 'placa' || tipoBusca === 'texto'),
  });

  // Buscar evento por protocolo
  const { data: eventos = [], isLoading: loadingEventos } = useQuery({
    queryKey: ['busca-eventos', buscaAtiva],
    queryFn: async () => {
      if (!buscaAtiva) return [];
      const { data, error } = await supabase
        .from('sinistros')
        .select('id, protocolo, tipo, status, data_evento, associado:associados(nome)')
        .ilike('protocolo', `%${buscaAtiva}%`)
        .limit(20);
      if (error) throw error;
      return data;
    },
    enabled: !!buscaAtiva && (tipoBusca === 'protocolo' || tipoBusca === 'texto'),
  });

  // Estado de seleção para drill-down
  const [selectedAssociado, setSelectedAssociado] = useState<string | null>(null);
  const [selectedVeiculo, setSelectedVeiculo] = useState<string | null>(null);
  const [selectedEvento, setSelectedEvento] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {/* Barra de Busca */}
      <div className="max-w-3xl mx-auto">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="Buscar por CPF, placa, protocolo, nome..."
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleBuscar()}
            className="pl-12 h-14 text-lg rounded-xl shadow-sm border-2 focus-visible:ring-primary"
          />
        </div>
        {tipoBusca && buscaAtiva && (
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Tipo detectado: <Badge variant="outline" className="text-xs">{tipoBusca === 'cpf' ? 'CPF' : tipoBusca === 'placa' ? 'Placa' : tipoBusca === 'protocolo' ? 'Protocolo' : tipoBusca === 'processo' ? 'Processo' : 'Texto livre'}</Badge>
          </p>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="associados" className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> Associados</TabsTrigger>
          <TabsTrigger value="veiculos" className="flex items-center gap-1"><Car className="h-3.5 w-3.5" /> Veículos</TabsTrigger>
          <TabsTrigger value="eventos" className="flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" /> Eventos</TabsTrigger>
          <TabsTrigger value="processos" className="flex items-center gap-1"><FileText className="h-3.5 w-3.5" /> Processos</TabsTrigger>
          <TabsTrigger value="antecedentes" className="flex items-center gap-1"><Shield className="h-3.5 w-3.5" /> Antecedentes</TabsTrigger>
          <TabsTrigger value="regulamento" className="flex items-center gap-1"><BookOpen className="h-3.5 w-3.5" /> Regulamento</TabsTrigger>
        </TabsList>

        {/* Associados */}
        <TabsContent value="associados" className="mt-4">
          {selectedAssociado ? (
            <div>
              <button onClick={() => setSelectedAssociado(null)} className="text-sm text-primary hover:underline mb-3">← Voltar aos resultados</button>
              <ConsultaAssociado associadoId={selectedAssociado} />
            </div>
          ) : (
            <>
              {loadingAssociados && <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>}
              {!buscaAtiva && <p className="text-muted-foreground text-center py-8">Digite um CPF ou nome e pressione Enter para buscar.</p>}
              {buscaAtiva && !loadingAssociados && associados.length === 0 && <p className="text-muted-foreground text-center py-8">Nenhum associado encontrado.</p>}
              {associados.map((a: any) => (
                <Card key={a.id} className="cursor-pointer hover:bg-accent/50 transition-colors mb-2" onClick={() => setSelectedAssociado(a.id)}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium">{a.nome}</p>
                      <p className="text-sm text-muted-foreground">CPF: {a.cpf} — Tel: {a.telefone || '-'}</p>
                    </div>
                    <Badge variant="outline">{a.status}</Badge>
                  </CardContent>
                </Card>
              ))}
            </>
          )}
        </TabsContent>

        {/* Veículos */}
        <TabsContent value="veiculos" className="mt-4">
          {selectedVeiculo ? (
            <div>
              <button onClick={() => setSelectedVeiculo(null)} className="text-sm text-primary hover:underline mb-3">← Voltar aos resultados</button>
              <ConsultaVeiculo veiculoId={selectedVeiculo} />
            </div>
          ) : (
            <>
              {loadingVeiculos && <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>}
              {!buscaAtiva && <p className="text-muted-foreground text-center py-8">Digite uma placa e pressione Enter para buscar.</p>}
              {buscaAtiva && !loadingVeiculos && veiculos.length === 0 && <p className="text-muted-foreground text-center py-8">Nenhum veículo encontrado.</p>}
              {veiculos.map((v: any) => (
                <Card key={v.id} className="cursor-pointer hover:bg-accent/50 transition-colors mb-2" onClick={() => setSelectedVeiculo(v.id)}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium">{v.placa}</p>
                      <p className="text-sm text-muted-foreground">{v.marca} {v.modelo} {v.ano_modelo} — {(v.associado as any)?.nome || 'Sem associado'}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </>
          )}
        </TabsContent>

        {/* Eventos */}
        <TabsContent value="eventos" className="mt-4">
          {selectedEvento ? (
            <div>
              <button onClick={() => setSelectedEvento(null)} className="text-sm text-primary hover:underline mb-3">← Voltar aos resultados</button>
              <ConsultaEvento eventoId={selectedEvento} />
            </div>
          ) : (
            <>
              {loadingEventos && <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>}
              {!buscaAtiva && <p className="text-muted-foreground text-center py-8">Digite um protocolo e pressione Enter para buscar.</p>}
              {buscaAtiva && !loadingEventos && eventos.length === 0 && <p className="text-muted-foreground text-center py-8">Nenhum evento encontrado.</p>}
              {eventos.map((e: any) => (
                <Card key={e.id} className="cursor-pointer hover:bg-accent/50 transition-colors mb-2" onClick={() => setSelectedEvento(e.id)}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium">{e.protocolo}</p>
                      <p className="text-sm text-muted-foreground">{e.tipo} — {(e.associado as any)?.nome || '-'}</p>
                    </div>
                    <Badge variant="outline">{e.status}</Badge>
                  </CardContent>
                </Card>
              ))}
            </>
          )}
        </TabsContent>

        {/* Processos */}
        <TabsContent value="processos" className="mt-4">
          <ConsultaProcessos termo={buscaAtiva} />
        </TabsContent>

        {/* Antecedentes */}
        <TabsContent value="antecedentes" className="mt-4">
          <ConsultaAntecedentes />
        </TabsContent>

        {/* Regulamento */}
        <TabsContent value="regulamento" className="mt-4">
          <ConsultaRegulamento />
        </TabsContent>
      </Tabs>
    </div>
  );
}
