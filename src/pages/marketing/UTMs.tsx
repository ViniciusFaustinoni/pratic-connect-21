import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Link2, Copy, Save, Search, ExternalLink, 
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

const sourceOptions = ['google', 'facebook', 'instagram', 'whatsapp', 'email', 'indicacao', 'linkedin', 'tiktok'];
const mediumOptions = ['cpc', 'organic', 'social', 'email', 'referral', 'banner', 'display', 'video'];

export default function UTMs() {
  const [search, setSearch] = useState('');
  
  // Form state
  const [urlDestino, setUrlDestino] = useState('https://pratic.com.br/cotacao');
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

  // Preview da URL em tempo real
  const urlGerada = useMemo(() => {
    if (!urlDestino) return '';
    const params = new URLSearchParams();
    if (utmSource) params.append('utm_source', utmSource);
    if (utmMedium) params.append('utm_medium', utmMedium);
    if (utmCampaign) params.append('utm_campaign', utmCampaign);
    if (utmContent) params.append('utm_content', utmContent);
    if (utmTerm) params.append('utm_term', utmTerm);
    
    const queryString = params.toString();
    if (!queryString) return urlDestino;
    
    return `${urlDestino}${urlDestino.includes('?') ? '&' : '?'}${queryString}`;
  }, [urlDestino, utmSource, utmMedium, utmCampaign, utmContent, utmTerm]);

  const handleSalvar = () => {
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
        // Limpar campos após salvar
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
      <div>
        <h1 className="text-2xl font-bold">Gerador de UTM</h1>
        <p className="text-muted-foreground">
          Crie e gerencie links rastreáveis para suas campanhas
        </p>
      </div>

      {/* Layout 2 colunas */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* COLUNA 1 - GERADOR */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Gerar Nova UTM</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* URL de Destino */}
              <div className="space-y-2">
                <Label htmlFor="url">URL de Destino *</Label>
                <Input
                  id="url"
                  placeholder="https://exemplo.com/landing-page"
                  value={urlDestino}
                  onChange={(e) => setUrlDestino(e.target.value)}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {/* utm_source */}
                <div className="space-y-2">
                  <Label>Source * (origem)</Label>
                  <Select value={utmSource} onValueChange={setUtmSource}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {sourceOptions.map(opt => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* utm_medium */}
                <div className="space-y-2">
                  <Label>Medium (mídia)</Label>
                  <Select value={utmMedium} onValueChange={setUtmMedium}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {mediumOptions.map(opt => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* utm_campaign */}
              <div className="space-y-2">
                <Label htmlFor="campaign">Campaign (campanha)</Label>
                <Input
                  id="campaign"
                  placeholder="black-friday, lancamento-2024..."
                  value={utmCampaign}
                  onChange={(e) => setUtmCampaign(e.target.value)}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {/* utm_content */}
                <div className="space-y-2">
                  <Label htmlFor="content">Content (conteúdo)</Label>
                  <Input
                    id="content"
                    placeholder="banner-topo, cta-rodape..."
                    value={utmContent}
                    onChange={(e) => setUtmContent(e.target.value)}
                  />
                </div>

                {/* utm_term */}
                <div className="space-y-2">
                  <Label htmlFor="term">Term (termo)</Label>
                  <Input
                    id="term"
                    placeholder="protecao-veicular..."
                    value={utmTerm}
                    onChange={(e) => setUtmTerm(e.target.value)}
                  />
                </div>
              </div>

              {/* Vincular a Campanha */}
              <div className="space-y-2">
                <Label>Vincular a Campanha (opcional)</Label>
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
            </CardContent>
          </Card>

          {/* PREVIEW */}
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Link2 className="h-4 w-4" />
                Preview da URL
              </CardTitle>
            </CardHeader>
            <CardContent>
              <code className="block text-sm break-all bg-background rounded p-3 border">
                {urlGerada || 'Preencha os campos acima...'}
              </code>
              <div className="flex gap-2 mt-4">
                <Button 
                  variant="outline" 
                  onClick={() => copyToClipboard(urlGerada)}
                  disabled={!urlGerada}
                  className="flex-1"
                >
                  <Copy className="mr-2 h-4 w-4" /> 
                  Copiar
                </Button>
                <Button 
                  onClick={handleSalvar}
                  disabled={gerarUTM.isPending || !urlDestino || !utmSource}
                  className="flex-1"
                >
                  <Save className="mr-2 h-4 w-4" /> 
                  Salvar UTM
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* COLUNA 2 - UTMs SALVOS */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle>UTMs Salvos</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar UTMs..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardHeader>
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
                <p className="text-muted-foreground text-sm mt-1">
                  Crie sua primeira UTM usando o formulário ao lado
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Source / Medium</TableHead>
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
                          <p className="font-medium">
                            {utm.utm_source}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {utm.utm_medium || '-'}
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
    </div>
  );
}
