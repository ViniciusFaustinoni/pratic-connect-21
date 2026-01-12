import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Copy, Check, Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { ApiLeadsConfig } from '@/hooks/useApiLeadsConfig';

const SUPABASE_URL = 'https://iyxdgmukrrdkffraptsx.supabase.co';

interface ApiTutorialModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: ApiLeadsConfig | null;
  apiKey: string | null;
}

const CODE_EXAMPLES = {
  curl: (apiKey: string) => `curl -X POST \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: ${apiKey}" \\
  -d '{
    "nome": "João Silva",
    "telefone": "21999990000",
    "email": "joao@email.com",
    "origem": "GOOGLE"
  }' \\
  ${SUPABASE_URL}/functions/v1/leads-webhook`,

  javascript: (apiKey: string) => `const response = await fetch(
  '${SUPABASE_URL}/functions/v1/leads-webhook',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': '${apiKey}'
    },
    body: JSON.stringify({
      nome: 'João Silva',
      telefone: '21999990000',
      email: 'joao@email.com',
      origem: 'SITE'
    })
  }
);
const data = await response.json();
console.log(data);`,

  python: (apiKey: string) => `import requests

response = requests.post(
    '${SUPABASE_URL}/functions/v1/leads-webhook',
    headers={
        'Content-Type': 'application/json',
        'x-api-key': '${apiKey}'
    },
    json={
        'nome': 'João Silva',
        'telefone': '21999990000',
        'email': 'joao@email.com',
        'origem': 'GOOGLE'
    }
)
print(response.json())`,

  php: (apiKey: string) => `<?php
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, '${SUPABASE_URL}/functions/v1/leads-webhook');
curl_setopt($ch, CURLOPT_POST, 1);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
    'nome' => 'João Silva',
    'telefone' => '21999990000',
    'email' => 'joao@email.com',
    'origem' => 'SITE'
]));
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
    'x-api-key: ${apiKey}'
]);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$response = curl_exec($ch);
curl_close($ch);
print_r(json_decode($response));`,
};

export function ApiTutorialModal({
  open,
  onOpenChange,
  config,
  apiKey,
}: ApiTutorialModalProps) {
  const [activeTab, setActiveTab] = useState('steps');
  const [codeLanguage, setCodeLanguage] = useState<keyof typeof CODE_EXAMPLES>('curl');
  const [copiedCode, setCopiedCode] = useState(false);
  
  // Test form state
  const [testForm, setTestForm] = useState({
    nome: 'Lead de Teste',
    telefone: '21999990000',
    email: 'teste@teste.com',
    origem: 'GOOGLE',
  });
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    leadId?: string;
    responseTime?: number;
  } | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    toast.success('Código copiado!');
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const runTest = async () => {
    if (!apiKey) {
      toast.error('Nenhuma API Key configurada');
      return;
    }

    setIsTesting(true);
    setTestResult(null);
    const startTime = Date.now();

    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/leads-webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify(testForm),
      });

      const responseTime = Date.now() - startTime;
      const data = await response.json();

      if (response.ok && data.success) {
        setTestResult({
          success: true,
          message: 'Lead criado com sucesso!',
          leadId: data.lead_id,
          responseTime,
        });
      } else {
        setTestResult({
          success: false,
          message: data.error || 'Erro desconhecido',
          responseTime,
        });
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : 'Erro de conexão',
        responseTime: Date.now() - startTime,
      });
    } finally {
      setIsTesting(false);
    }
  };

  const displayApiKey = apiKey || 'pk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            📖 Tutorial: Como Integrar Leads via API
            {config && (
              <Badge variant="outline">{config.nome}</Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="steps">📌 Passo a Passo</TabsTrigger>
            <TabsTrigger value="examples">💻 Exemplos</TabsTrigger>
            <TabsTrigger value="test">🧪 Testar</TabsTrigger>
            <TabsTrigger value="faq">❓ FAQ</TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[60vh] mt-4">
            <TabsContent value="steps" className="space-y-6 pr-4">
              {/* Step 1 */}
              <div className="space-y-2">
                <h3 className="font-semibold flex items-center gap-2">
                  1️⃣ ENDPOINT DA API
                </h3>
                <p className="text-sm text-muted-foreground">
                  Envie uma requisição POST para:
                </p>
                <div className="flex items-center gap-2 bg-muted p-3 rounded-lg font-mono text-sm">
                  <code className="flex-1 truncate">
                    POST {SUPABASE_URL}/functions/v1/leads-webhook
                  </code>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => copyCode(`${SUPABASE_URL}/functions/v1/leads-webhook`)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Step 2 */}
              <div className="space-y-2">
                <h3 className="font-semibold flex items-center gap-2">
                  2️⃣ HEADERS OBRIGATÓRIOS
                </h3>
                <div className="bg-muted p-3 rounded-lg font-mono text-sm space-y-1">
                  <p>Content-Type: application/json</p>
                  <p>x-api-key: {displayApiKey}</p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="space-y-2">
                <h3 className="font-semibold flex items-center gap-2">
                  3️⃣ CORPO DA REQUISIÇÃO (JSON)
                </h3>
                <p className="text-sm text-muted-foreground">
                  <strong>Campos obrigatórios:</strong> nome, telefone<br />
                  <strong>Campos opcionais:</strong> email, origem, campanha, observacoes
                </p>
                <div className="bg-muted p-3 rounded-lg font-mono text-sm">
                  <pre>{`{
  "nome": "João Silva",
  "telefone": "(21) 99999-0000",
  "email": "joao@email.com",
  "origem": "GOOGLE",
  "campanha": "black-friday-2025",
  "observacoes": "Interessado no plano Premium"
}`}</pre>
                </div>
              </div>

              {/* Step 4 */}
              <div className="space-y-2">
                <h3 className="font-semibold flex items-center gap-2">
                  4️⃣ VALORES ACEITOS PARA "origem"
                </h3>
                <ul className="text-sm space-y-1 bg-muted p-3 rounded-lg">
                  <li>• <strong>GOOGLE</strong> - Google Ads / Google Forms</li>
                  <li>• <strong>FACEBOOK</strong> - Facebook Ads / Facebook Lead Ads</li>
                  <li>• <strong>INSTAGRAM</strong> - Instagram Ads</li>
                  <li>• <strong>SITE</strong> - Site / Landing Page</li>
                  <li>• <strong>WHATSAPP</strong> - WhatsApp</li>
                  <li>• <strong>INDICACAO</strong> - Indicação de cliente</li>
                  <li>• <strong>OUTRO</strong> - Outras origens</li>
                </ul>
              </div>

              {/* Step 5 */}
              <div className="space-y-2">
                <h3 className="font-semibold flex items-center gap-2">
                  5️⃣ RESPOSTA DE SUCESSO
                </h3>
                <div className="bg-green-50 dark:bg-green-950/30 p-3 rounded-lg font-mono text-sm">
                  <p className="text-green-700 dark:text-green-400 mb-2">HTTP 200 OK</p>
                  <pre>{`{
  "success": true,
  "lead_id": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Lead recebido com sucesso"
}`}</pre>
                </div>
              </div>

              {/* Step 6 */}
              <div className="space-y-2">
                <h3 className="font-semibold flex items-center gap-2">
                  6️⃣ POSSÍVEIS ERROS
                </h3>
                <div className="bg-red-50 dark:bg-red-950/30 p-3 rounded-lg font-mono text-sm space-y-1">
                  <p>401 - API Key inválida ou não informada</p>
                  <p>400 - Campos obrigatórios faltando (nome ou telefone)</p>
                  <p>500 - Erro interno do servidor</p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="examples" className="space-y-4 pr-4">
              <div className="flex items-center gap-2">
                <Label>Selecione a linguagem:</Label>
                <Select value={codeLanguage} onValueChange={(v) => setCodeLanguage(v as keyof typeof CODE_EXAMPLES)}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="curl">cURL</SelectItem>
                    <SelectItem value="javascript">JavaScript</SelectItem>
                    <SelectItem value="python">Python</SelectItem>
                    <SelectItem value="php">PHP</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="relative">
                <div className="bg-muted p-4 rounded-lg font-mono text-sm overflow-x-auto">
                  <pre className="whitespace-pre-wrap">{CODE_EXAMPLES[codeLanguage](displayApiKey)}</pre>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  className="absolute top-2 right-2"
                  onClick={() => copyCode(CODE_EXAMPLES[codeLanguage](displayApiKey))}
                >
                  {copiedCode ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  <span className="ml-1">{copiedCode ? 'Copiado!' : 'Copiar'}</span>
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="test" className="space-y-6 pr-4">
              <p className="text-sm text-muted-foreground">
                Envie um lead de teste para verificar se a integração está funcionando.
              </p>

              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="test-nome">Nome *</Label>
                  <Input
                    id="test-nome"
                    value={testForm.nome}
                    onChange={(e) => setTestForm(prev => ({ ...prev, nome: e.target.value }))}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="test-telefone">Telefone *</Label>
                  <Input
                    id="test-telefone"
                    value={testForm.telefone}
                    onChange={(e) => setTestForm(prev => ({ ...prev, telefone: e.target.value }))}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="test-email">Email</Label>
                  <Input
                    id="test-email"
                    type="email"
                    value={testForm.email}
                    onChange={(e) => setTestForm(prev => ({ ...prev, email: e.target.value }))}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="test-origem">Origem</Label>
                  <Select 
                    value={testForm.origem} 
                    onValueChange={(v) => setTestForm(prev => ({ ...prev, origem: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GOOGLE">Google</SelectItem>
                      <SelectItem value="FACEBOOK">Facebook</SelectItem>
                      <SelectItem value="INSTAGRAM">Instagram</SelectItem>
                      <SelectItem value="SITE">Site</SelectItem>
                      <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                      <SelectItem value="INDICACAO">Indicação</SelectItem>
                      <SelectItem value="OUTRO">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button onClick={runTest} disabled={isTesting || !apiKey}>
                  {isTesting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Enviar Lead de Teste
                    </>
                  )}
                </Button>
              </div>

              {testResult && (
                <div className={`p-4 rounded-lg ${
                  testResult.success 
                    ? 'bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900' 
                    : 'bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900'
                }`}>
                  <p className={`font-medium ${testResult.success ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                    {testResult.success ? '✅ Sucesso!' : '❌ Erro!'}
                  </p>
                  <p className="text-sm mt-1">{testResult.message}</p>
                  {testResult.leadId && (
                    <p className="text-sm mt-1 font-mono">Lead ID: {testResult.leadId}</p>
                  )}
                  {testResult.responseTime && (
                    <p className="text-sm mt-1 text-muted-foreground">
                      Tempo de resposta: {testResult.responseTime}ms
                    </p>
                  )}
                </div>
              )}

              {!apiKey && (
                <div className="p-4 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg border border-yellow-200 dark:border-yellow-900">
                  <p className="text-sm text-yellow-700 dark:text-yellow-400">
                    ⚠️ Nenhuma API Key configurada. Crie uma API Key na aba "APIs" primeiro.
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="faq" className="space-y-4 pr-4">
              <div className="space-y-4">
                <div className="border rounded-lg p-4">
                  <h4 className="font-medium">Como gerar uma nova API Key?</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Na página de APIs de Entrada, clique em "Gerar Nova API Key". A chave será exibida apenas uma vez, então copie e guarde em local seguro.
                  </p>
                </div>

                <div className="border rounded-lg p-4">
                  <h4 className="font-medium">O que acontece com leads duplicados?</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    O sistema verifica pelo telefone. Se já existir um lead com o mesmo telefone, o lead existente será atualizado ao invés de criar um novo.
                  </p>
                </div>

                <div className="border rounded-lg p-4">
                  <h4 className="font-medium">Como configurar o webhook no Facebook Ads?</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    No Gerenciador de Anúncios do Facebook, vá em Configurações do Lead Ads e adicione nosso webhook URL. Use x-api-key como header personalizado.
                  </p>
                </div>

                <div className="border rounded-lg p-4">
                  <h4 className="font-medium">Posso enviar campos personalizados?</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Sim! Você pode enviar qualquer campo adicional no JSON. Eles serão salvos no campo "observacoes" ou "metadata" do lead.
                  </p>
                </div>

                <div className="border rounded-lg p-4">
                  <h4 className="font-medium">Qual o limite de requisições?</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Não há limite definido, mas recomendamos não ultrapassar 100 requisições por minuto para garantir estabilidade.
                  </p>
                </div>
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
