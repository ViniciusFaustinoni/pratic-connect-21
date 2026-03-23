import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Search, Plus, Download, Loader2, MapPin } from 'lucide-react';
import { toast } from 'sonner';

type TipoAtendimento = 'volante' | 'viagem' | 'prestador' | 'fora_cobertura';

interface Municipio {
  id: string;
  nome: string;
  uf: string;
  tipo_atendimento: TipoAtendimento;
}

const TIPO_LABELS: Record<TipoAtendimento, string> = {
  volante: 'Volante',
  viagem: 'Viagem',
  prestador: 'Prestador',
  fora_cobertura: 'Fora de Cobertura',
};

const TIPO_COLORS: Record<TipoAtendimento, string> = {
  volante: 'bg-muted text-muted-foreground',
  viagem: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  prestador: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  fora_cobertura: 'bg-destructive/10 text-destructive',
};

// Pre-carga RJ
const MUNICIPIOS_RJ: { nome: string; tipo: TipoAtendimento }[] = [
  // VOLANTE
  ...[
    'Duque de Caxias','Rio de Janeiro','São João de Meriti','Belford Roxo','Nilópolis',
    'Mesquita','Nova Iguaçu','Queimados','Japeri','Paracambi','Seropédica','Itaguaí',
    'Magé','Guapimirim','Petrópolis','Teresópolis','Niterói','São Gonçalo','Maricá',
    'Itaboraí','Tanguá','Rio Bonito','Cachoeiras de Macacu','Miguel Pereira',
    'Paty do Alferes','Mendes','Engenheiro Paulo de Frontin',
  ].map(nome => ({ nome, tipo: 'volante' as TipoAtendimento })),
  // VIAGEM
  ...[
    'Nova Friburgo','Sumidouro','São José do Vale do Rio Preto','Vassouras',
    'Barra do Piraí','Piraí','Rio Claro','Valença','Barra Mansa','Volta Redonda',
    'Quatis','Porto Real','Resende','Itatiaia','Angra dos Reis','Mangaratiba',
    'Paraty','Carmo','Saquarema','Silva Jardim',
  ].map(nome => ({ nome, tipo: 'viagem' as TipoAtendimento })),
  // PRESTADOR
  ...[
    'Araruama','Iguaba Grande','São Pedro da Aldeia','Cabo Frio','Arraial do Cabo',
    'Armação dos Búzios','Casimiro de Abreu','Rio das Ostras','Macaé','Carapebus',
    'Quissamã','Campos dos Goytacazes','São João da Barra',
  ].map(nome => ({ nome, tipo: 'prestador' as TipoAtendimento })),
  // FORA DE COBERTURA
  ...[
    'Itaperuna','Bom Jesus do Itabapoana','Natividade','Porciúncula','Varre-Sai',
    'Laje do Muriaé','Miracema','Santo Antônio de Pádua','Aperibé','Cambuci',
    'Itaocara','São Fidélis','Cardoso Moreira','São Francisco de Itabapoana',
    'Italva','Cantagalo','Cordeiro','Macuco','Trajano de Moraes',
    'Santa Maria Madalena','São Sebastião do Alto','Duas Barras','Bom Jardim',
    'Conceição de Macabu',
  ].map(nome => ({ nome, tipo: 'fora_cobertura' as TipoAtendimento })),
];

export function MapaAtendimento() {
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [novoNome, setNovoNome] = useState('');
  const [novoUf, setNovoUf] = useState('RJ');
  const [novoTipo, setNovoTipo] = useState<TipoAtendimento>('volante');

  const { data: municipios = [], isLoading } = useQuery({
    queryKey: ['municipios-atendimento'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('municipios_atendimento')
        .select('*')
        .order('nome');
      if (error) throw error;
      return data as Municipio[];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, tipo }: { id: string; tipo: TipoAtendimento }) => {
      const { error } = await supabase
        .from('municipios_atendimento')
        .update({ tipo_atendimento: tipo, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['municipios-atendimento'] });
      toast.success('Classificação atualizada!');
    },
    onError: () => toast.error('Erro ao atualizar'),
  });

  const addMutation = useMutation({
    mutationFn: async (m: { nome: string; uf: string; tipo_atendimento: TipoAtendimento }) => {
      const { error } = await supabase.from('municipios_atendimento').insert(m);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['municipios-atendimento'] });
      toast.success('Município adicionado!');
      setShowAddDialog(false);
      setNovoNome('');
    },
    onError: (e: any) => {
      if (e?.message?.includes('duplicate')) {
        toast.error('Município já cadastrado para esta UF');
      } else {
        toast.error('Erro ao adicionar município');
      }
    },
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      const rows = MUNICIPIOS_RJ.map(m => ({
        nome: m.nome,
        uf: 'RJ',
        tipo_atendimento: m.tipo,
      }));
      const { error } = await supabase.from('municipios_atendimento').insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['municipios-atendimento'] });
      toast.success(`${MUNICIPIOS_RJ.length} municípios importados com sucesso!`);
    },
    onError: () => toast.error('Erro ao importar municípios'),
  });

  // ===== Regras de Viagem =====
  const [viagemDiaria, setViagemDiaria] = useState('');
  const [viagemSla, setViagemSla] = useState('');
  const [prestadorHorasAlerta, setPrestadorHorasAlerta] = useState('');
  const [viagemLoaded, setViagemLoaded] = useState(false);

  const { data: configViagem } = useQuery({
    queryKey: ['config-viagem'],
    queryFn: async () => {
      const { data } = await supabase
        .from('configuracoes')
        .select('chave, valor')
        .in('chave', ['viagem_valor_diaria', 'viagem_sla_horas', 'prestador_horas_alerta_sem_resposta']);
      const map = Object.fromEntries((data || []).map(d => [d.chave, d.valor]));
      return {
        diaria: map.viagem_valor_diaria || '0',
        sla: map.viagem_sla_horas || '72',
        prestadorHoras: map.prestador_horas_alerta_sem_resposta || '2',
      };
    },
    staleTime: 1000 * 60 * 5,
  });

  if (configViagem && !viagemLoaded) {
    setViagemDiaria(configViagem.diaria);
    setViagemSla(configViagem.sla);
    setViagemLoaded(true);
  }

  const salvarViagemMutation = useMutation({
    mutationFn: async () => {
      const updates = [
        { chave: 'viagem_valor_diaria', valor: viagemDiaria },
        { chave: 'viagem_sla_horas', valor: viagemSla },
      ];
      for (const u of updates) {
        const { error } = await supabase
          .from('configuracoes')
          .update({ valor: u.valor, updated_at: new Date().toISOString() })
          .eq('chave', u.chave);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config-viagem'] });
      queryClient.invalidateQueries({ queryKey: ['config-sla-prazos'] });
      toast.success('Regras de viagem salvas!');
    },
    onError: () => toast.error('Erro ao salvar regras de viagem'),
  });

  const filtered = municipios.filter(m => {
    const matchBusca = !busca || m.nome.toLowerCase().includes(busca.toLowerCase());
    const matchTipo = filtroTipo === 'todos' || m.tipo_atendimento === filtroTipo;
    return matchBusca && matchTipo;
  });

  const counts = {
    volante: municipios.filter(m => m.tipo_atendimento === 'volante').length,
    viagem: municipios.filter(m => m.tipo_atendimento === 'viagem').length,
    prestador: municipios.filter(m => m.tipo_atendimento === 'prestador').length,
    fora_cobertura: municipios.filter(m => m.tipo_atendimento === 'fora_cobertura').length,
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (municipios.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center space-y-4">
          <MapPin className="h-12 w-12 mx-auto text-muted-foreground/50" />
          <div>
            <h3 className="text-lg font-semibold">Nenhum município cadastrado</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Importe a classificação padrão do Rio de Janeiro para começar.
            </p>
          </div>
          <Button onClick={() => importMutation.mutate()} disabled={importMutation.isPending}>
            {importMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
            Importar classificação padrão RJ ({MUNICIPIOS_RJ.length} municípios)
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(Object.entries(counts) as [TipoAtendimento, number][]).map(([tipo, count]) => (
          <Card key={tipo} className="border-border/60">
            <CardContent className="py-3 px-4 flex items-center justify-between">
              <span className="text-sm font-medium">{TIPO_LABELS[tipo]}</span>
              <Badge className={TIPO_COLORS[tipo]}>{count}</Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar município..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filtroTipo} onValueChange={setFiltroTipo}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            <SelectItem value="volante">Volante</SelectItem>
            <SelectItem value="viagem">Viagem</SelectItem>
            <SelectItem value="prestador">Prestador</SelectItem>
            <SelectItem value="fora_cobertura">Fora de Cobertura</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => setShowAddDialog(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Adicionar
        </Button>
      </div>

      {/* Tabela */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Município</TableHead>
              <TableHead className="w-[60px]">UF</TableHead>
              <TableHead className="w-[200px]">Tipo de Atendimento</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(m => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">{m.nome}</TableCell>
                <TableCell>{m.uf}</TableCell>
                <TableCell>
                  <Select
                    value={m.tipo_atendimento}
                    onValueChange={(v) => updateMutation.mutate({ id: m.id, tipo: v as TipoAtendimento })}
                  >
                    <SelectTrigger className="h-8 w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="volante">Volante</SelectItem>
                      <SelectItem value="viagem">Viagem</SelectItem>
                      <SelectItem value="prestador">Prestador</SelectItem>
                      <SelectItem value="fora_cobertura">Fora de Cobertura</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                  Nenhum município encontrado
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Regras de Viagem */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="h-4 w-4" /> Regras de Viagem
          </CardTitle>
          <CardDescription className="text-xs">
            Configurações aplicadas automaticamente a instalações em municípios classificados como "Viagem".
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Valor da diária de viagem (R$)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={viagemDiaria}
                onChange={e => setViagemDiaria(e.target.value)}
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground mt-1">Zero = sem compensação</p>
            </div>
            <div>
              <Label>SLA de instalação em viagem (horas úteis)</Label>
              <Input
                type="number"
                min="1"
                value={viagemSla}
                onChange={e => setViagemSla(e.target.value)}
                placeholder="72"
              />
              <p className="text-xs text-muted-foreground mt-1">Padrão volante: 48h</p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => salvarViagemMutation.mutate()}
            disabled={salvarViagemMutation.isPending}
          >
            {salvarViagemMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Salvar regras de viagem
          </Button>
        </CardContent>
      </Card>

      {/* Dialog Adicionar */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Município</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome do Município</Label>
              <Input value={novoNome} onChange={e => setNovoNome(e.target.value)} placeholder="Ex: Niterói" />
            </div>
            <div>
              <Label>UF</Label>
              <Input value={novoUf} onChange={e => setNovoUf(e.target.value.toUpperCase())} maxLength={2} className="w-20" />
            </div>
            <div>
              <Label>Tipo de Atendimento</Label>
              <Select value={novoTipo} onValueChange={v => setNovoTipo(v as TipoAtendimento)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="volante">Volante</SelectItem>
                  <SelectItem value="viagem">Viagem</SelectItem>
                  <SelectItem value="prestador">Prestador</SelectItem>
                  <SelectItem value="fora_cobertura">Fora de Cobertura</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancelar</Button>
            <Button
              onClick={() => addMutation.mutate({ nome: novoNome.trim(), uf: novoUf.trim(), tipo_atendimento: novoTipo })}
              disabled={!novoNome.trim() || addMutation.isPending}
            >
              {addMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
