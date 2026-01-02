import { useState } from 'react';
import { Webhook, Copy, Check, Code, PlayCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

const WEBHOOK_URL = 'https://iyxdgmukrrdkffraptsx.supabase.co/functions/v1/leads-webhook';

const examplePayload = `{
  "fonte_codigo": "landing_page_1",
  "nome": "João Silva",
  "telefone": "11999998888",
  "email": "joao@email.com",
  "cpf": "12345678900",
  "veiculo": {
    "marca": "Fiat",
    "modelo": "Uno",
    "ano": 2020,
    "placa": "ABC1234",
    "valor_fipe": 45000
  },
  "observacoes": "Lead vindo da campanha Facebook"
}`;

const curlExample = `curl -X POST "${WEBHOOK_URL}" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: sk_live_sua_chave_aqui" \\
  -d '${examplePayload.replace(/\n/g, '').replace(/\s+/g, ' ')}'`;

export function WebhookSection() {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [copiedPayload, setCopiedPayload] = useState(false);

  const handleCopy = (text: string, setter: (value: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setter(true);
    toast.success('Copiado para a área de transferência');
    setTimeout(() => setter(false), 2000);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Webhook className="h-5 w-5" />
          Webhook de Recebimento
        </CardTitle>
        <CardDescription>
          Endpoint para receber leads de sistemas externos
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* URL do Webhook */}
        <div>
          <label className="text-sm font-medium">URL do Webhook</label>
          <div className="flex gap-2 mt-1">
            <code className="flex-1 px-3 py-2 bg-muted rounded-md text-sm font-mono overflow-x-auto">
              {WEBHOOK_URL}
            </code>
            <Button
              variant="outline"
              size="icon"
              onClick={() => handleCopy(WEBHOOK_URL, setCopiedUrl)}
            >
              {copiedUrl ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Documentação */}
        <Tabs defaultValue="payload" className="w-full">
          <TabsList>
            <TabsTrigger value="payload">Payload</TabsTrigger>
            <TabsTrigger value="curl">cURL</TabsTrigger>
            <TabsTrigger value="response">Resposta</TabsTrigger>
          </TabsList>

          <TabsContent value="payload" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Estrutura do Payload</h4>
                <p className="text-sm text-muted-foreground">
                  Envie um POST com o seguinte JSON
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopy(examplePayload, setCopiedPayload)}
              >
                {copiedPayload ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                Copiar
              </Button>
            </div>
            <pre className="p-4 bg-muted rounded-lg text-sm overflow-x-auto">
              <code>{examplePayload}</code>
            </pre>

            <div className="space-y-2">
              <h4 className="font-medium">Campos Obrigatórios</h4>
              <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                <li><code className="text-foreground">nome</code> - Nome do lead</li>
                <li><code className="text-foreground">telefone</code> - Telefone de contato</li>
              </ul>

              <h4 className="font-medium mt-4">Campos Opcionais</h4>
              <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                <li><code className="text-foreground">fonte_codigo</code> - Código da fonte cadastrada</li>
                <li><code className="text-foreground">email</code> - Email do lead</li>
                <li><code className="text-foreground">cpf</code> - CPF do lead</li>
                <li><code className="text-foreground">veiculo</code> - Objeto com dados do veículo</li>
                <li><code className="text-foreground">observacoes</code> - Notas adicionais</li>
              </ul>
            </div>
          </TabsContent>

          <TabsContent value="curl" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Exemplo com cURL</h4>
                <p className="text-sm text-muted-foreground">
                  Teste o webhook diretamente no terminal
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopy(curlExample, setCopiedCurl)}
              >
                {copiedCurl ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                Copiar
              </Button>
            </div>
            <pre className="p-4 bg-muted rounded-lg text-sm overflow-x-auto whitespace-pre-wrap">
              <code>{curlExample}</code>
            </pre>
          </TabsContent>

          <TabsContent value="response" className="space-y-4">
            <div>
              <h4 className="font-medium">Resposta de Sucesso (201)</h4>
              <pre className="p-4 bg-muted rounded-lg text-sm mt-2">
                <code>{`{
  "success": true,
  "lead_id": "uuid-do-lead",
  "message": "Lead created successfully"
}`}</code>
              </pre>
            </div>

            <div>
              <h4 className="font-medium">Códigos de Erro</h4>
              <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1 mt-2">
                <li><code className="text-foreground">401</code> - Chave de API inválida ou ausente</li>
                <li><code className="text-foreground">400</code> - Campos obrigatórios ausentes ou fonte inválida</li>
                <li><code className="text-foreground">500</code> - Erro interno do servidor</li>
              </ul>
            </div>
          </TabsContent>
        </Tabs>

        {/* Headers */}
        <div>
          <h4 className="font-medium mb-2">Headers Obrigatórios</h4>
          <div className="bg-muted rounded-lg p-4 space-y-2 text-sm font-mono">
            <div>
              <span className="text-muted-foreground">Content-Type:</span> application/json
            </div>
            <div>
              <span className="text-muted-foreground">X-API-Key:</span> sk_live_sua_chave_aqui
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}