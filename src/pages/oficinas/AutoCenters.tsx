import { useState } from 'react';
import { Plus, Search, Store, MapPin, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAutoCenters, type AutoCenter } from '@/hooks/useAutoCenters';
import { AutoCenterFormDialog } from '@/components/oficinas/AutoCenterFormDialog';
import { AutoCenterDetailDrawer } from '@/components/oficinas/AutoCenterDetailDrawer';
import { MARCAS_VEICULOS, TIPOS_PECAS } from '@/lib/fornecedores-constants';

const TIPO_LABELS: Record<string, string> = {
  auto_center: 'Auto Center',
  ferro_velho: 'Ferro Velho',
  montadora: 'Montadora',
};

const TIPO_COLORS: Record<string, string> = {
  auto_center: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  ferro_velho: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  montadora: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
};

export default function AutoCenters() {
  const [search, setSearch] = useState('');
  const [tipoFilter, setTipoFilter] = useState<string>('todos');
  const [marcaFilter, setMarcaFilter] = useState<string>('todos');
  const [espFilter, setEspFilter] = useState<string>('todos');
  const [formOpen, setFormOpen] = useState(false);
  const [selected, setSelected] = useState<AutoCenter | null>(null);

  const { data: autoCenters, isLoading } = useAutoCenters({
    search: search || undefined,
    tipo: tipoFilter === 'todos' ? undefined : tipoFilter,
    marca: marcaFilter === 'todos' ? undefined : marcaFilter,
    especialidade: espFilter === 'todos' ? undefined : espFilter,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Auto Centers</h1>
          <p className="text-muted-foreground">Gerencie auto centers e ferros velhos</p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Auto Center
        </Button>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={tipoFilter} onValueChange={setTipoFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            <SelectItem value="auto_center">Auto Center</SelectItem>
            <SelectItem value="ferro_velho">Ferro Velho</SelectItem>
            <SelectItem value="montadora">Montadora</SelectItem>
          </SelectContent>
        </Select>
        <Select value={marcaFilter} onValueChange={setMarcaFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Marca" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas as marcas</SelectItem>
            {MARCAS_VEICULOS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={espFilter} onValueChange={setEspFilter}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Tipo de Peça" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos de peça</SelectItem>
            {TIPOS_PECAS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
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
      ) : autoCenters?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Store className="h-12 w-12 text-muted-foreground/50" />
            <p className="mt-4 text-lg font-medium">Nenhum auto center encontrado</p>
            <p className="text-muted-foreground">Cadastre um auto center para começar</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {autoCenters?.map((ac) => (
            <Card
              key={ac.id}
              className="cursor-pointer transition-shadow hover:shadow-md"
              onClick={() => setSelected(ac)}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <h3 className="font-semibold">{ac.nome}</h3>
                    {ac.contato_nome && (
                      <p className="text-sm text-muted-foreground">{ac.contato_nome}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge className={TIPO_COLORS[ac.tipo] || ''}>
                      {TIPO_LABELS[ac.tipo] || ac.tipo}
                    </Badge>
                    <Badge variant={(ac as any).status === 'ativo' ? 'default' : 'secondary'}>
                      {(ac as any).status === 'ativo' ? 'Ativo' : (ac as any).status === 'inativo' ? 'Inativo' : (ac as any).status === 'suspenso' ? 'Suspenso' : 'Ativo'}
                    </Badge>
                  </div>
                </div>
                <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                  {ac.cidade && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      <span>{ac.cidade}{ac.estado ? ` - ${ac.estado}` : ''}</span>
                    </div>
                  )}
                  {ac.contato_telefone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      <span>{ac.contato_telefone}</span>
                    </div>
                  )}
                </div>
                {(ac as any).marcas_atendidas?.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {(ac as any).marcas_atendidas.includes('GLOBAL') ? (
                      <Badge variant="secondary" className="text-xs">GLOBAL</Badge>
                    ) : (
                      <>
                        {(ac as any).marcas_atendidas.slice(0, 3).map((m: string) => (
                          <Badge key={m} variant="secondary" className="text-xs">{m}</Badge>
                        ))}
                        {(ac as any).marcas_atendidas.length > 3 && (
                          <Badge variant="secondary" className="text-xs">+{(ac as any).marcas_atendidas.length - 3}</Badge>
                        )}
                      </>
                    )}
                  </div>
                )}
                {(ac as any).especialidades?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {(ac as any).especialidades.slice(0, 3).map((e: string) => (
                      <Badge key={e} variant="outline" className="text-xs">{e}</Badge>
                    ))}
                    {(ac as any).especialidades.length > 3 && (
                      <Badge variant="outline" className="text-xs">+{(ac as any).especialidades.length - 3}</Badge>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AutoCenterFormDialog open={formOpen} onOpenChange={setFormOpen} />
      <AutoCenterDetailDrawer
        autoCenter={selected}
        open={!!selected}
        onOpenChange={(open) => !open && setSelected(null)}
      />
    </div>
  );
}
