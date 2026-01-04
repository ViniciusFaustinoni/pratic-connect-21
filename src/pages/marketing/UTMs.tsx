import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Link2, Copy, Plus, Search, ExternalLink, 
  MousePointer, Users 
} from 'lucide-react';
import { useUTMs, useGerarUTM, useCampanhas } from '@/hooks/useMarketing';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
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

export default function UTMs() {
  const [search, setSearch] = useState('');
  const [showGenerator, setShowGenerator] = useState(false);
  
  // Form state
  const [urlDestino, setUrlDestino] = useState('');
  const [utmSource, setUtmSource] = useState('');
  const [utmMedium, setUtmMedium] = useState('');
  const [utmCampaign, setUtmCampaign] = useState('');
  const [utmContent, setUtmContent] = useState('');
  const [utmTerm, setUtmTerm] = useState('');
  const [campanhaId, setCampanhaId] = useState('');

  const { data: utms, isLoading } = useUTMs();
  const { data: campanhas } = useCampanhas();
  const gerarUTM = useGerarUTM();

  const filteredUtms = utms?.filter(u =>
    u.url_destino.toLowerCase().includes(search.toLowerCase()) ||
    u.utm_source.toLowerCase().includes(search.toLowerCase()) ||
    u.utm_campaign?.toLowerCase().includes(search.toLowerCase())
  );

  // Preview da URL
  const previewUrl = () => {
    if (!urlDestino) return '';
    const params = new URLSearchParams();
    if (utmSource) params.append('utm_source', utmSource);
    if (utmMedium) params.append('utm_medium', utmMedium);
    if (utmCampaign) params.append('utm_campaign', utmCampaign);
    if (utmContent) params.append('utm_content', utmContent);
    if (utmTerm) params.append('utm_term', utmTerm);
    
    return `${urlDestino}${urlDestino.includes('?') ? '&' : '?'}${params.toString()}`;
  };

  const handleGerar = () => {
    if (!urlDestino || !utmSource) {
      toast.error('URL de destino e Source são obrigatórios');
      return;
    }

    gerarUTM.mutate({
      url_destino: urlDestino,
      utm_source: utmSource,
      utm_medium: utmMedium || undefined,
      utm_campaign: utmCampaign || undefined,
      utm_content: utmContent || undefined,
      utm_term: utmTerm || undefined,
      campanha_id: campanhaId || undefined,
    }, {
      onSuccess: () => {
        setShowGenerator(false);
        setUrlDestino('');
        setUtmSource('');
        setUtmMedium('');
        setUtmCampaign('');
        setUtmContent('');
        setUtmTerm('');
        setCampanhaId('');
      },
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('URL copiada!');
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gerador de UTMs</h1>
          <p className="text-muted-foreground">
            Crie e gerencie links rastreáveis
          </p>
        </div>
        <Button onClick={() => setShowGenerator(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Gerar Nova UTM
        </Button>
      </div>

      {/* Gerador */}
      {showGenerator && (
        <Card>
          <CardHeader>
            <CardTitle>Novo Link UTM</CardTitle>
            <CardDescription>
              Preencha os parâmetros para gerar um link rastreável
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="url">URL de Destino *</Label>
                <Input
                  id="url"
                  placeholder="https://exemplo.com/landing-page"
                  value={urlDestino}
                  onChange={(e) => setUrlDestino(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="source">Source * (origem)</Label>
                <Input
                  id="source"
                  placeholder="google, facebook, instagram..."
                  value={utmSource}
                  onChange={(e) => setUtmSource(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="medium">Medium (mídia)</Label>
                <Input
                  id="medium"
                  placeholder="cpc, email, social..."
                  value={utmMedium}
                  onChange={(e) => setUtmMedium(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="campaign">Campaign (campanha)</Label>
                <Input
                  id="campaign"
                  placeholder="black-friday, lancamento..."
                  value={utmCampaign}
                  onChange={(e) => setUtmCampaign(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="content">Content (conteúdo)</Label>
                <Input
                  id="content"
                  placeholder="banner-topo, cta-rodape..."
                  value={utmContent}
                  onChange={(e) => setUtmContent(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="term">Term (termo)</Label>
                <Input
                  id="term"
                  placeholder="protecao-veicular, rastreador..."
                  value={utmTerm}
                  onChange={(e) => setUtmTerm(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="campanha">Vincular a Campanha</Label>
                <Select value={campanhaId} onValueChange={setCampanhaId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma campanha" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nenhuma</SelectItem>
                    {campanhas?.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Preview */}
            {previewUrl() && (
              <div className="rounded-lg bg-muted p-4">
                <Label className="text-xs text-muted-foreground">Preview da URL</Label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="flex-1 text-sm break-all">{previewUrl()}</code>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => copyToClipboard(previewUrl())}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowGenerator(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleGerar}
                disabled={gerarUTM.isPending}
              >
                Gerar Link
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Busca */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar UTMs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Lista de UTMs */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4, 5].map(i => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredUtms?.length === 0 ? (
            <div className="py-12 text-center">
              <Link2 className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-lg font-medium">Nenhuma UTM encontrada</p>
              <Button className="mt-4" onClick={() => setShowGenerator(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Gerar Nova UTM
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>URL / Source</TableHead>
                  <TableHead>Campaign</TableHead>
                  <TableHead className="text-center">Cliques</TableHead>
                  <TableHead className="text-center">Leads</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUtms?.map(utm => (
                  <TableRow key={utm.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium truncate max-w-xs">
                          {utm.url_destino}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {utm.utm_source} / {utm.utm_medium || '-'}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{utm.utm_campaign || '-'}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <MousePointer className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{utm.cliques}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Users className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{utm.leads_gerados}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => copyToClipboard(utm.url_completa || '')}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => window.open(utm.url_completa, '_blank')}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
