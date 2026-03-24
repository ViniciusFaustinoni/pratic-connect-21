import { useState } from 'react';
import { Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import type { ApiEndpoint } from './apiEndpoints';
import { ApiPlayground } from './ApiPlayground';

interface ApiEndpointCardProps {
  endpoint: ApiEndpoint;
  baseUrl: string;
}

const methodBadgeVariant: Record<string, string> = {
  GET: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',
  POST: 'bg-blue-500/15 text-blue-600 border-blue-500/30',
  PUT: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
  DELETE: 'bg-red-500/15 text-red-600 border-red-500/30',
};

function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group">
      <div className="flex items-center justify-between bg-muted/50 px-3 py-1.5 rounded-t-md border border-b-0 border-border">
        <span className="text-[10px] text-muted-foreground uppercase font-medium">{language}</span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCopy}>
          {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
        </Button>
      </div>
      <pre className="bg-muted/30 p-3 rounded-b-md border border-border overflow-x-auto text-xs font-mono leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function ApiEndpointCard({ endpoint, baseUrl }: ApiEndpointCardProps) {
  const [showPlayground, setShowPlayground] = useState(false);
  const [activeTab, setActiveTab] = useState<'curl' | 'js'>('curl');

  const fullUrl = `${baseUrl}${endpoint.path}`;
  const hasBody = endpoint.method === 'POST' || endpoint.method === 'PUT';

  const bodyExample = hasBody && endpoint.fields
    ? Object.fromEntries(
        endpoint.fields
          .filter(f => f.required && f.name !== 'id')
          .map(f => {
            if (f.type === 'number') return [f.name, 0];
            if (f.type === 'boolean') return [f.name, false];
            if (f.type.includes('[]')) return [f.name, []];
            return [f.name, ''];
          })
      )
    : null;

  const curlExample = hasBody
    ? `curl -X ${endpoint.method} "${fullUrl}" \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: sk_live_SUA_CHAVE_AQUI" \\
  -d '${JSON.stringify(bodyExample, null, 2)}'`
    : `curl -X GET "${fullUrl}" \\
  -H "x-api-key: sk_live_SUA_CHAVE_AQUI"`;

  const jsExample = hasBody
    ? `const response = await fetch("${fullUrl}", {
  method: "${endpoint.method}",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": "sk_live_SUA_CHAVE_AQUI"
  },
  body: JSON.stringify(${JSON.stringify(bodyExample, null, 4)})
});

const data = await response.json();`
    : `const response = await fetch("${fullUrl}", {
  headers: {
    "x-api-key": "sk_live_SUA_CHAVE_AQUI"
  }
});

const data = await response.json();`;

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Badge variant="outline" className={cn('font-mono text-xs px-2', methodBadgeVariant[endpoint.method])}>
              {endpoint.method}
            </Badge>
            <CardTitle className="text-lg">{endpoint.title}</CardTitle>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowPlayground(!showPlayground)}>
            {showPlayground ? 'Fechar' : 'Testar'} →
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mt-1">{endpoint.description}</p>
        <div className="mt-2">
          <code className="text-xs bg-muted/50 px-2 py-1 rounded font-mono text-muted-foreground">
            {fullUrl}
          </code>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Fields Table */}
        {endpoint.fields && endpoint.fields.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">Parâmetros</h4>
            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="text-xs">Campo</TableHead>
                    <TableHead className="text-xs">Tipo</TableHead>
                    <TableHead className="text-xs w-20">Obrigatório</TableHead>
                    <TableHead className="text-xs">Descrição</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {endpoint.fields.map(field => (
                    <TableRow key={field.name}>
                      <TableCell className="font-mono text-xs py-2">{field.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground py-2">{field.type}</TableCell>
                      <TableCell className="py-2">
                        {field.required ? (
                          <Badge variant="outline" className="text-[10px] bg-red-500/10 text-red-500 border-red-500/30">Sim</Badge>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">Não</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground py-2">{field.description}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* Code Examples */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h4 className="text-sm font-medium">Exemplo de Requisição</h4>
            <div className="flex gap-1 ml-auto">
              <Button
                variant={activeTab === 'curl' ? 'default' : 'ghost'}
                size="sm"
                className="h-6 text-xs px-2"
                onClick={() => setActiveTab('curl')}
              >
                cURL
              </Button>
              <Button
                variant={activeTab === 'js' ? 'default' : 'ghost'}
                size="sm"
                className="h-6 text-xs px-2"
                onClick={() => setActiveTab('js')}
              >
                JavaScript
              </Button>
            </div>
          </div>
          <CodeBlock code={activeTab === 'curl' ? curlExample : jsExample} language={activeTab} />
        </div>

        {/* Response Example */}
        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="text-xs gap-1 px-0 h-auto text-muted-foreground">
              <ChevronDown className="h-3 w-3" /> Exemplo de Resposta
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 space-y-3">
            <div>
              <p className="text-[10px] text-muted-foreground mb-1 uppercase font-medium">Sucesso (200)</p>
              <CodeBlock code={JSON.stringify(endpoint.responseExample, null, 2)} language="json" />
            </div>
            {endpoint.errorExample && (
              <div>
                <p className="text-[10px] text-muted-foreground mb-1 uppercase font-medium">Erro (4xx)</p>
                <CodeBlock code={JSON.stringify(endpoint.errorExample, null, 2)} language="json" />
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>

        {/* Playground */}
        {showPlayground && (
          <ApiPlayground endpoint={endpoint} baseUrl={baseUrl} />
        )}
      </CardContent>
    </Card>
  );
}
