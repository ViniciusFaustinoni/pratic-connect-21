import { useState } from 'react';
import { Code2, Key, ExternalLink, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ApiSidebar } from '@/components/api-docs/ApiSidebar';
import { ApiEndpointCard } from '@/components/api-docs/ApiEndpointCard';
import { apiEndpoints } from '@/components/api-docs/apiEndpoints';

const BASE_URL = `https://iyxdgmukrrdkffraptsx.supabase.co/functions/v1`;

export default function ApiDocumentation() {
  const [selectedEndpoint, setSelectedEndpoint] = useState(apiEndpoints[0].id);

  const endpoint = apiEndpoints.find(e => e.id === selectedEndpoint) || apiEndpoints[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Code2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-foreground">API do Sistema</h1>
              <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/30">
                Diretor
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Documentação interativa para integrações externas via API
            </p>
          </div>
        </div>
        <Link to="/configuracoes/integracoes/api-keys">
          <Button variant="outline" size="sm" className="gap-2">
            <Key className="h-3.5 w-3.5" /> Gerenciar API Keys
          </Button>
        </Link>
      </div>

      {/* Auth Info */}
      <Alert>
        <ShieldCheck className="h-4 w-4" />
        <AlertDescription className="text-xs">
          Todas as requisições devem incluir o header <code className="bg-muted px-1 rounded text-[11px]">x-api-key</code> com uma chave válida gerada em{' '}
          <Link to="/configuracoes/integracoes/api-keys" className="text-primary underline underline-offset-2">
            Integrações → Chaves de API
          </Link>.
          A base URL é: <code className="bg-muted px-1 rounded text-[11px]">{BASE_URL}/api-externa</code>
        </AlertDescription>
      </Alert>

      {/* Error Codes */}
      <Card className="border-border/60">
        <CardContent className="py-3 px-4">
          <p className="text-xs font-medium mb-2">Códigos de Erro Padrão</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
            <div><code className="text-red-500">401</code> — API Key inválida ou ausente</div>
            <div><code className="text-red-500">400</code> — Campos obrigatórios faltando</div>
            <div><code className="text-red-500">404</code> — Recurso não encontrado</div>
            <div><code className="text-red-500">409</code> — Registro duplicado</div>
          </div>
        </CardContent>
      </Card>

      {/* Content: Sidebar + Main */}
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-3 hidden lg:block">
          <div className="sticky top-4">
            <ApiSidebar selectedEndpoint={selectedEndpoint} onSelect={setSelectedEndpoint} />
          </div>
        </div>

        {/* Mobile endpoint selector */}
        <div className="col-span-12 lg:hidden">
          <select
            className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
            value={selectedEndpoint}
            onChange={e => setSelectedEndpoint(e.target.value)}
          >
            {apiEndpoints.map(ep => (
              <option key={ep.id} value={ep.id}>
                {ep.method} — {ep.title}
              </option>
            ))}
          </select>
        </div>

        <div className="col-span-12 lg:col-span-9">
          <ApiEndpointCard endpoint={endpoint} baseUrl={BASE_URL} />
        </div>
      </div>
    </div>
  );
}
