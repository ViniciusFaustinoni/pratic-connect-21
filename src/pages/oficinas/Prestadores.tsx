import { useState } from 'react';
import { Plus, Search, Puzzle, MapPin, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePrestadoresEvento, type PrestadorEvento } from '@/hooks/usePrestadoresEvento';
import { PrestadorFormDialog } from '@/components/oficinas/PrestadorFormDialog';
import { PrestadorDetailDrawer } from '@/components/oficinas/PrestadorDetailDrawer';
import { ESPECIALIDADES } from '@/lib/fornecedores-constants';

export default function Prestadores() {
  const [search, setSearch] = useState('');
  const [espFilter, setEspFilter] = useState<string>('todos');
  const [formOpen, setFormOpen] = useState(false);
  const [selected, setSelected] = useState<PrestadorEvento | null>(null);

  const { data: prestadores, isLoading } = usePrestadoresEvento({
    search: search || undefined,
    especialidade: espFilter === 'todos' ? undefined : espFilter,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Prestadores</h1>
          <p className="text-muted-foreground">Gerencie prestadores de serviços especializados</p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Prestador
        </Button>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar por nome ou CNPJ..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={espFilter} onValueChange={setEspFilter}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Especialidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas especialidades</SelectItem>
            {ESPECIALIDADES.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => <Card key={i} className="animate-pulse"><CardContent className="h-40 p-6" /></Card>)}
        </div>
      ) : prestadores?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Puzzle className="h-12 w-12 text-muted-foreground/50" />
            <p className="mt-4 text-lg font-medium">Nenhum prestador encontrado</p>
            <p className="text-muted-foreground">Cadastre um prestador para começar</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {prestadores?.map(p => (
            <Card key={p.id} className="cursor-pointer transition-shadow hover:shadow-md" onClick={() => setSelected(p)}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <h3 className="font-semibold">{p.nome_fantasia || p.razao_social}</h3>
                    {p.cnpj && <p className="text-sm text-muted-foreground">{p.cnpj}</p>}
                  </div>
                  <Badge variant={p.status === 'ativo' ? 'default' : 'secondary'}>
                    {p.status === 'ativo' ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>
                <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                  {p.cidade && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      <span>{p.cidade}{p.estado ? ` - ${p.estado}` : ''}</span>
                    </div>
                  )}
                  {(p.whatsapp || p.telefone) && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      <span>{p.whatsapp || p.telefone}</span>
                    </div>
                  )}
                </div>
                {p.marcas_atendidas?.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {p.marcas_atendidas.includes('GLOBAL') ? (
                      <Badge variant="secondary" className="text-xs">GLOBAL</Badge>
                    ) : (
                      p.marcas_atendidas.slice(0, 3).map(m => <Badge key={m} variant="secondary" className="text-xs">{m}</Badge>)
                    )}
                    {!p.marcas_atendidas.includes('GLOBAL') && p.marcas_atendidas.length > 3 && (
                      <Badge variant="secondary" className="text-xs">+{p.marcas_atendidas.length - 3}</Badge>
                    )}
                  </div>
                )}
                {p.especialidades?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {p.especialidades.slice(0, 3).map(e => <Badge key={e} variant="outline" className="text-xs">{e}</Badge>)}
                    {p.especialidades.length > 3 && <Badge variant="outline" className="text-xs">+{p.especialidades.length - 3}</Badge>}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <PrestadorFormDialog open={formOpen} onOpenChange={setFormOpen} />
      <PrestadorDetailDrawer prestador={selected} open={!!selected} onOpenChange={o => !o && setSelected(null)} />
    </div>
  );
}
