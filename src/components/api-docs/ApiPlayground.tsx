import { useState } from 'react';
import { Play, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import type { ApiEndpoint } from './apiEndpoints';

interface ApiPlaygroundProps {
  endpoint: ApiEndpoint;
  baseUrl: string;
}

export function ApiPlayground({ endpoint, baseUrl }: ApiPlaygroundProps) {
  const [apiKey, setApiKey] = useState('');
  const [body, setBody] = useState(() => {
    if (endpoint.method === 'GET') return '';
    const example = endpoint.fields
      ? Object.fromEntries(
          endpoint.fields
            .filter(f => f.required && f.name !== 'id')
            .map(f => [f.name, ''])
        )
      : {};
    return JSON.stringify(example, null, 2);
  });
  const [pathParam, setPathParam] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusCode, setStatusCode] = useState<number | null>(null);

  const hasPathParam = endpoint.path.includes(':id');

  const handleSend = async () => {
    if (!apiKey) {
      setResponse('⚠️ Informe sua API Key');
      return;
    }

    setLoading(true);
    setResponse('');
    setStatusCode(null);

    try {
      let url = `${baseUrl}${endpoint.path}`;
      if (hasPathParam) {
        url = url.replace(':id', pathParam);
      }

      const options: RequestInit = {
        method: endpoint.method,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
      };

      if (endpoint.method !== 'GET' && body) {
        options.body = body;
      }

      const res = await fetch(url, options);
      setStatusCode(res.status);
      const data = await res.json();
      setResponse(JSON.stringify(data, null, 2));
    } catch (err: any) {
      setResponse(`Erro: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border border-dashed border-border rounded-lg p-4 space-y-3 bg-muted/20">
      <h5 className="text-sm font-medium flex items-center gap-2">
        <Play className="h-3.5 w-3.5" /> Playground
      </h5>

      <div className="grid gap-3">
        <div>
          <Label className="text-xs">API Key</Label>
          <Input
            type="password"
            placeholder="sk_live_..."
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            className="font-mono text-xs h-8"
          />
        </div>

        {hasPathParam && (
          <div>
            <Label className="text-xs">ID (path param)</Label>
            <Input
              placeholder="UUID do recurso"
              value={pathParam}
              onChange={e => setPathParam(e.target.value)}
              className="font-mono text-xs h-8"
            />
          </div>
        )}

        {endpoint.method !== 'GET' && (
          <div>
            <Label className="text-xs">Body (JSON)</Label>
            <Textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              className="font-mono text-xs min-h-[120px]"
            />
          </div>
        )}

        <Button size="sm" onClick={handleSend} disabled={loading}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Play className="h-3.5 w-3.5 mr-1" />}
          Enviar
        </Button>

        {response && (
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Label className="text-xs">Resposta</Label>
              {statusCode && (
                <span className={`text-[10px] font-mono font-bold ${statusCode < 300 ? 'text-emerald-500' : 'text-red-500'}`}>
                  {statusCode}
                </span>
              )}
            </div>
            <pre className="bg-muted/30 p-3 rounded-md border border-border overflow-x-auto text-xs font-mono max-h-[300px]">
              {response}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
