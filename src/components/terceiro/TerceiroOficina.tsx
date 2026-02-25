import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Wrench, Building2, CheckCircle, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  token: string;
  terceiro: {
    oficina_tipo?: string;
    oficina_nome?: string;
    oficina_endereco?: string;
    oficina_telefone?: string;
  };
  onRefresh: () => void;
}

export function TerceiroOficina({ token, terceiro, onRefresh }: Props) {
  const [tipo, setTipo] = useState<'credenciada' | 'propria' | null>(null);
  const [nome, setNome] = useState('');
  const [endereco, setEndereco] = useState('');
  const [telefone, setTelefone] = useState('');
  const [salvando, setSalvando] = useState(false);

  if (terceiro.oficina_tipo) {
    return (
      <Card className="border-green-300">
        <CardContent className="pt-6 space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <span className="font-semibold">Oficina definida</span>
          </div>
          <p className="text-sm text-muted-foreground">
            {terceiro.oficina_tipo === 'credenciada' ? 'Oficina credenciada da Pratic' : terceiro.oficina_nome || 'Oficina própria'}
          </p>
          {terceiro.oficina_endereco && (
            <p className="text-xs text-muted-foreground">{terceiro.oficina_endereco}</p>
          )}
        </CardContent>
      </Card>
    );
  }

  const handleConfirmar = async () => {
    if (!tipo) return;
    setSalvando(true);
    try {
      const { data, error } = await supabase.functions.invoke('salvar-etapa-terceiro', {
        body: {
          token,
          acao: 'escolher_oficina',
          dados: {
            tipo,
            nome: tipo === 'propria' ? nome : undefined,
            endereco: tipo === 'propria' ? endereco : undefined,
            telefone: tipo === 'propria' ? telefone : undefined,
          },
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error);
      toast.success('Oficina definida!');
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Wrench className="h-5 w-5" />
          Escolha de Oficina
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Onde você gostaria que o reparo fosse feito?
        </p>

        <div className="space-y-3">
          <div
            className={`border-2 rounded-lg p-4 cursor-pointer transition-colors ${
              tipo === 'credenciada' ? 'border-primary bg-primary/5' : 'border-muted hover:border-muted-foreground/30'
            }`}
            onClick={() => setTipo('credenciada')}
          >
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="h-5 w-5" />
              <span className="font-medium">Oficina credenciada da Pratic</span>
              <Badge variant="outline" className="text-xs">Recomendado</Badge>
            </div>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>✅ Qualidade garantida</li>
              <li>✅ Sem custo adicional</li>
              <li>✅ Acompanhamento direto</li>
            </ul>
          </div>

          <div
            className={`border-2 rounded-lg p-4 cursor-pointer transition-colors ${
              tipo === 'propria' ? 'border-primary bg-primary/5' : 'border-muted hover:border-muted-foreground/30'
            }`}
            onClick={() => setTipo('propria')}
          >
            <div className="flex items-center gap-2 mb-2">
              <Wrench className="h-5 w-5" />
              <span className="font-medium">Oficina da minha escolha</span>
            </div>
            <div className="flex items-start gap-1 text-xs text-amber-700 bg-amber-50 p-2 rounded">
              <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
              <span>O valor não pode ultrapassar o menor dos 3 orçamentos. Diferença por sua conta.</span>
            </div>
          </div>
        </div>

        {tipo === 'propria' && (
          <div className="space-y-3 pl-2 border-l-2 border-primary/30">
            <Input placeholder="Nome da oficina" value={nome} onChange={(e) => setNome(e.target.value)} />
            <Input placeholder="Endereço" value={endereco} onChange={(e) => setEndereco(e.target.value)} />
            <Input placeholder="Telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
          </div>
        )}

        <Button
          className="w-full"
          disabled={!tipo || salvando || (tipo === 'propria' && !nome.trim())}
          onClick={handleConfirmar}
        >
          {salvando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
          Confirmar escolha
        </Button>
      </CardContent>
    </Card>
  );
}
