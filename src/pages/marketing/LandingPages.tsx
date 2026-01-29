import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Plus, Search, Globe, Eye, BarChart3, Copy, ExternalLink,
  MousePointerClick, Users, TrendingUp
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { LandingPageFormModal } from '@/components/marketing/LandingPageFormModal';
import { toast } from 'sonner';

interface LandingPage {
  id: string;
  nome: string;
  slug: string;
  url: string;
  url_preview?: string;
  descricao?: string;
  titulo_seo?: string;
  descricao_seo?: string;
  visitas: number;
  conversoes: number;
  taxa_conversao?: number;
  status: string;
  campanha_id?: string;
  campanha?: { id: string; nome: string } | null;
  created_at: string;
  criado_por?: string;
}

export default function LandingPages() {
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingLP, setEditingLP] = useState<LandingPage | null>(null);

  const { data: landingPages, isLoading, refetch } = useQuery({
    queryKey: ['landing-pages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('landing_pages')
        .select('*, campanha:campanhas(id, nome)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as LandingPage[];
    },
  });

  const filteredPages = landingPages?.filter(lp =>
    lp.nome.toLowerCase().includes(search.toLowerCase()) ||
    lp.slug?.toLowerCase().includes(search.toLowerCase())
  );

  // KPIs
  const totalVisitas = landingPages?.reduce((sum, lp) => sum + (lp.visitas || 0), 0) || 0;
  const totalLeads = landingPages?.reduce((sum, lp) => sum + (lp.conversoes || 0), 0) || 0;
  const taxaMedia = totalVisitas > 0 ? ((totalLeads / totalVisitas) * 100) : 0;
  const paginasAtivas = landingPages?.filter(lp => lp.status === 'publicada').length || 0;

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success('URL copiada!');
  };

  const statusConfig: Record<string, { label: string; className: string }> = {
    rascunho: { label: 'Rascunho', className: 'bg-gray-100 text-gray-800' },
    publicada: { label: 'Publicada', className: 'bg-green-100 text-green-800' },
    pausada: { label: 'Pausada', className: 'bg-yellow-100 text-yellow-800' },
    arquivada: { label: 'Arquivada', className: 'bg-red-100 text-red-800' },
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Landing Pages</h1>
          <p className="text-muted-foreground">
            Gerencie suas páginas de captura de leads
          </p>
        </div>
        <Button onClick={() => { setEditingLP(null); setShowForm(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Landing Page
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Páginas Ativas</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{paginasAtivas}</div>
            <p className="text-xs text-muted-foreground">
              de {landingPages?.length || 0} total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Visitas Totais</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalVisitas.toLocaleString('pt-BR')}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Leads Gerados</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {totalLeads.toLocaleString('pt-BR')}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Taxa Média</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {taxaMedia.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">conversão</p>
          </CardContent>
        </Card>
      </div>

      {/* Busca */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar landing page..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Lista de Landing Pages */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : !filteredPages?.length ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Globe className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-lg font-medium">Nenhuma landing page encontrada</p>
            <p className="text-muted-foreground">
              Crie sua primeira página de captura
            </p>
            <Button className="mt-4" onClick={() => setShowForm(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Nova Landing Page
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredPages.map(lp => (
            <Card key={lp.id} className="transition-all hover:shadow-md">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-base line-clamp-1">{lp.nome}</CardTitle>
                    <CardDescription className="text-xs mt-1 line-clamp-1">
                      /{lp.slug}
                    </CardDescription>
                  </div>
                  <Badge className={statusConfig[lp.status]?.className || 'bg-gray-100'}>
                    {statusConfig[lp.status]?.label || lp.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {lp.descricao && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {lp.descricao}
                  </p>
                )}

                {/* Métricas */}
                <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t">
                  <div>
                    <p className="text-lg font-bold">{lp.visitas || 0}</p>
                    <p className="text-xs text-muted-foreground">Visitas</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-green-600">{lp.conversoes || 0}</p>
                    <p className="text-xs text-muted-foreground">Conv.</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold">{(lp.taxa_conversao || 0).toFixed(1)}%</p>
                    <p className="text-xs text-muted-foreground">Conv.</p>
                  </div>
                </div>

                {lp.campanha && (
                  <div className="text-xs bg-muted/50 rounded px-2 py-1">
                    Campanha: {lp.campanha.nome}
                  </div>
                )}

                {/* Ações */}
                <div className="flex gap-2 pt-2">
                  {lp.url && (
                    <>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex-1"
                        onClick={() => window.open(lp.url, '_blank')}
                      >
                        <ExternalLink className="mr-1 h-3 w-3" />
                        Preview
                      </Button>
                      <Button 
                        variant="outline" 
                        size="icon"
                        onClick={() => handleCopyUrl(lp.url)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => { setEditingLP(lp); setShowForm(true); }}
                  >
                    Editar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <LandingPageFormModal
        open={showForm}
        onClose={() => { setShowForm(false); setEditingLP(null); }}
        landingPage={editingLP}
        onSuccess={() => refetch()}
      />
    </div>
  );
}
