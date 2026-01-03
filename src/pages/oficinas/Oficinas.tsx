import { useState } from 'react';
import { Plus, Search, Building2, MapPin, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useOficinas } from '@/hooks/useOficinas';
import { OficinaFormDialog } from '@/components/oficinas/OficinaFormDialog';
import { OficinaDetailDrawer } from '@/components/oficinas/OficinaDetailDrawer';
import { STATUS_OFICINA_LABELS, STATUS_OFICINA_COLORS, type Oficina, type StatusOficina } from '@/types/database';

export default function Oficinas() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusOficina | 'todos'>('todos');
  const [formOpen, setFormOpen] = useState(false);
  const [selectedOficina, setSelectedOficina] = useState<Oficina | null>(null);

  const { data: oficinas, isLoading } = useOficinas({
    search: search || undefined,
    status: statusFilter === 'todos' ? undefined : statusFilter,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Oficinas Credenciadas</h1>
          <p className="text-muted-foreground">Gerencie as oficinas parceiras</p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Oficina
        </Button>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou CNPJ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusOficina | 'todos')}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {Object.entries(STATUS_OFICINA_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="h-40 p-6" />
            </Card>
          ))}
        </div>
      ) : oficinas?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground/50" />
            <p className="mt-4 text-lg font-medium">Nenhuma oficina encontrada</p>
            <p className="text-muted-foreground">Cadastre uma oficina para começar</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {oficinas?.map((oficina) => (
            <Card
              key={oficina.id}
              className="cursor-pointer transition-shadow hover:shadow-md"
              onClick={() => setSelectedOficina(oficina)}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <h3 className="font-semibold">{oficina.nome_fantasia || oficina.razao_social}</h3>
                    <p className="text-sm text-muted-foreground">{oficina.cnpj}</p>
                  </div>
                  <Badge className={STATUS_OFICINA_COLORS[oficina.status]}>
                    {STATUS_OFICINA_LABELS[oficina.status]}
                  </Badge>
                </div>
                <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    <span>{oficina.cidade} - {oficina.estado}</span>
                  </div>
                  {oficina.telefone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      <span>{oficina.telefone}</span>
                    </div>
                  )}
                </div>
                {oficina.especialidades?.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-1">
                    {oficina.especialidades.slice(0, 3).map((esp) => (
                      <Badge key={esp} variant="outline" className="text-xs">
                        {esp}
                      </Badge>
                    ))}
                    {oficina.especialidades.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{oficina.especialidades.length - 3}
                      </Badge>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <OficinaFormDialog open={formOpen} onOpenChange={setFormOpen} />
      <OficinaDetailDrawer
        oficina={selectedOficina}
        open={!!selectedOficina}
        onOpenChange={(open) => !open && setSelectedOficina(null)}
      />
    </div>
  );
}
