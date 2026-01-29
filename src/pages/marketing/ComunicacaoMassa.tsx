import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Plus, Search, Mail, MessageCircle, Smartphone,
  Send, Users, CheckCircle, XCircle, Eye, Clock
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CampanhaComunicacaoModal } from '@/components/marketing/CampanhaComunicacaoModal';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface CampanhaComunicacao {
  id: string;
  codigo: string;
  nome: string;
  tipo: 'email' | 'whatsapp' | 'sms';
  assunto?: string;
  segmento?: string;
  total_destinatarios: number;
  enviados: number;
  entregues: number;
  abertos: number;
  clicados: number;
  falhas: number;
  data_agendamento?: string;
  status: string;
  created_at: string;
}

const tipoIcons = {
  email: Mail,
  whatsapp: MessageCircle,
  sms: Smartphone,
};

const tipoLabels = {
  email: 'E-mail',
  whatsapp: 'WhatsApp',
  sms: 'SMS',
};

const statusConfig: Record<string, { label: string; className: string }> = {
  rascunho: { label: 'Rascunho', className: 'bg-gray-100 text-gray-800' },
  agendada: { label: 'Agendada', className: 'bg-blue-100 text-blue-800' },
  enviando: { label: 'Enviando', className: 'bg-yellow-100 text-yellow-800' },
  pausada: { label: 'Pausada', className: 'bg-orange-100 text-orange-800' },
  concluida: { label: 'Concluída', className: 'bg-green-100 text-green-800' },
  cancelada: { label: 'Cancelada', className: 'bg-red-100 text-red-800' },
};

export default function ComunicacaoMassa() {
  const [search, setSearch] = useState('');
  const [tipoFilter, setTipoFilter] = useState('todos');
  const [showForm, setShowForm] = useState(false);

  const { data: campanhas, isLoading, refetch } = useQuery({
    queryKey: ['campanhas-comunicacao', tipoFilter],
    queryFn: async () => {
      let query = supabase
        .from('campanhas_comunicacao')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (tipoFilter !== 'todos') {
        query = query.eq('tipo', tipoFilter);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as CampanhaComunicacao[];
    },
  });

  const filteredCampanhas = campanhas?.filter(c =>
    c.nome.toLowerCase().includes(search.toLowerCase()) ||
    c.codigo?.toLowerCase().includes(search.toLowerCase())
  );

  // KPIs
  const totalEnviados = campanhas?.reduce((sum, c) => sum + (c.enviados || 0), 0) || 0;
  const totalEntregues = campanhas?.reduce((sum, c) => sum + (c.entregues || 0), 0) || 0;
  const totalAbertos = campanhas?.reduce((sum, c) => sum + (c.abertos || 0), 0) || 0;
  const totalClicados = campanhas?.reduce((sum, c) => sum + (c.clicados || 0), 0) || 0;

  const taxaEntrega = totalEnviados > 0 ? ((totalEntregues / totalEnviados) * 100) : 0;
  const taxaAbertura = totalEntregues > 0 ? ((totalAbertos / totalEntregues) * 100) : 0;
  const taxaClique = totalAbertos > 0 ? ((totalClicados / totalAbertos) * 100) : 0;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Comunicação em Massa</h1>
          <p className="text-muted-foreground">
            Gerencie campanhas de email, WhatsApp e SMS
          </p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Campanha
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Enviados</CardTitle>
            <Send className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalEnviados.toLocaleString('pt-BR')}</div>
            <p className="text-xs text-muted-foreground">
              {taxaEntrega.toFixed(1)}% entregues
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Entregues</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {totalEntregues.toLocaleString('pt-BR')}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Abertos</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalAbertos.toLocaleString('pt-BR')}</div>
            <p className="text-xs text-muted-foreground">
              {taxaAbertura.toFixed(1)}% taxa abertura
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Cliques</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalClicados.toLocaleString('pt-BR')}</div>
            <p className="text-xs text-muted-foreground">
              {taxaClique.toFixed(1)}% CTR
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar campanha..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Tabs por tipo */}
      <Tabs value={tipoFilter} onValueChange={setTipoFilter}>
        <TabsList>
          <TabsTrigger value="todos">Todos</TabsTrigger>
          <TabsTrigger value="email" className="flex items-center gap-1">
            <Mail className="h-4 w-4" /> E-mail
          </TabsTrigger>
          <TabsTrigger value="whatsapp" className="flex items-center gap-1">
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </TabsTrigger>
          <TabsTrigger value="sms" className="flex items-center gap-1">
            <Smartphone className="h-4 w-4" /> SMS
          </TabsTrigger>
        </TabsList>

        <TabsContent value={tipoFilter} className="mt-4">
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-6 space-y-3">
                  {[1, 2, 3, 4, 5].map(i => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : filteredCampanhas?.length === 0 ? (
                <div className="py-12 text-center">
                  <Mail className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
                  <p className="text-lg font-medium">Nenhuma campanha encontrada</p>
                  <p className="text-muted-foreground">
                    Crie sua primeira campanha de comunicação
                  </p>
                  <Button className="mt-4" onClick={() => setShowForm(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Nova Campanha
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campanha</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-center">Destinatários</TableHead>
                      <TableHead className="text-center">Enviados</TableHead>
                      <TableHead className="text-center">Entregues</TableHead>
                      <TableHead className="text-center">Abertos</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCampanhas?.map(campanha => {
                      const Icon = tipoIcons[campanha.tipo] || Mail;
                      return (
                        <TableRow key={campanha.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{campanha.nome}</p>
                              <p className="text-xs text-muted-foreground">{campanha.codigo}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4" />
                              {tipoLabels[campanha.tipo]}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            {campanha.total_destinatarios}
                          </TableCell>
                          <TableCell className="text-center">
                            {campanha.enviados}
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="text-green-600">{campanha.entregues}</span>
                            {campanha.falhas > 0 && (
                              <span className="text-red-600 ml-1">({campanha.falhas} falhas)</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {campanha.abertos}
                            {campanha.entregues > 0 && (
                              <span className="text-xs text-muted-foreground ml-1">
                                ({((campanha.abertos / campanha.entregues) * 100).toFixed(0)}%)
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge className={statusConfig[campanha.status]?.className}>
                              {statusConfig[campanha.status]?.label || campanha.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {format(new Date(campanha.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <CampanhaComunicacaoModal
        open={showForm}
        onClose={() => setShowForm(false)}
        onSuccess={() => refetch()}
      />
    </div>
  );
}
