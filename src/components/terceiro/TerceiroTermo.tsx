import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileSignature, CheckCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  token: string;
  terceiro: {
    nome: string;
    cpf: string;
    termo_assinado_em?: string;
  };
  onRefresh: () => void;
}

export function TerceiroTermo({ token, terceiro, onRefresh }: Props) {
  const [concordo, setConcordo] = useState(false);
  const [nomeAssinatura, setNomeAssinatura] = useState('');
  const [salvando, setSalvando] = useState(false);

  if (terceiro.termo_assinado_em) {
    return (
      <Card className="border-green-300">
        <CardContent className="pt-6 text-center space-y-3">
          <CheckCircle className="h-10 w-10 mx-auto text-green-600" />
          <h3 className="font-semibold">Termo Assinado</h3>
          <p className="text-sm text-muted-foreground">
            Assinado em {new Date(terceiro.termo_assinado_em).toLocaleDateString('pt-BR')}
          </p>
        </CardContent>
      </Card>
    );
  }

  const handleAssinar = async () => {
    if (!concordo || !nomeAssinatura.trim()) {
      toast.error('Preencha todos os campos');
      return;
    }
    setSalvando(true);
    try {
      const { data, error } = await supabase.functions.invoke('salvar-etapa-terceiro', {
        body: { token, acao: 'assinar_termo', dados: { nome_assinatura: nomeAssinatura.trim() } },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error);
      toast.success('Termo assinado com sucesso!');
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao assinar');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <FileSignature className="h-5 w-5" />
          Termo de Anuência
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-muted/50 p-3 rounded-lg text-sm space-y-2">
          <p className="font-medium">Ao assinar este termo, você concorda que:</p>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li>O reparo será feito em oficina credenciada ou da sua escolha</li>
            <li>Peças podem ser originais, seminovas ou paralelas</li>
            <li>O prazo de reparo é de até 90 dias úteis</li>
            <li>Na entrega, você fará um test drive e aprovará o serviço</li>
          </ul>
        </div>

        <ScrollArea className="h-48 border rounded-lg p-3">
          <div className="text-xs text-muted-foreground space-y-2">
            <p className="font-semibold">TERMO DE ANUÊNCIA PARA REPARO DE VEÍCULO — COBERTURA DE TERCEIROS</p>
            <p>Eu, abaixo identificado(a), na qualidade de proprietário(a) ou condutor(a) do veículo envolvido em colisão com associado da PRATIC CAR — ASSOCIAÇÃO DE PROTEÇÃO VEICULAR, declaro que:</p>
            <p>1. Autorizo a realização do reparo do meu veículo conforme as condições estabelecidas pelo regulamento da Pratic Car;</p>
            <p>2. Estou ciente de que o reparo poderá utilizar peças originais, seminovas ou paralelas de qualidade equivalente, conforme regulamento;</p>
            <p>3. Estou ciente de que o prazo para conclusão do reparo é de até 90 (noventa) dias úteis, contados a partir da aprovação do orçamento;</p>
            <p>4. Comprometo-me a realizar test drive no veículo quando do término do reparo e assinar o termo de aprovação do serviço;</p>
            <p>5. Caso opte por oficina de minha escolha, estou ciente de que: (a) o valor não poderá ultrapassar o menor dos orçamentos obtidos pela Pratic; (b) eventuais diferenças serão de minha responsabilidade; (c) a Pratic não se responsabiliza pela qualidade do serviço;</p>
            <p>6. Declaro que as informações prestadas são verdadeiras e que tenho legitimidade para firmar este termo.</p>
          </div>
        </ScrollArea>

        <div className="flex items-start gap-2">
          <Checkbox
            id="concordo"
            checked={concordo}
            onCheckedChange={(v) => setConcordo(v === true)}
          />
          <label htmlFor="concordo" className="text-sm cursor-pointer">
            Li e concordo com os termos acima
          </label>
        </div>

        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Seus dados:</p>
          <Input value={terceiro.nome} disabled className="bg-muted" />
          <Input value={terceiro.cpf} disabled className="bg-muted" />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Assinatura digital — digite seu nome completo:</label>
          <Input
            value={nomeAssinatura}
            onChange={(e) => setNomeAssinatura(e.target.value)}
            placeholder="Seu nome completo"
          />
        </div>

        <Button
          className="w-full"
          disabled={!concordo || !nomeAssinatura.trim() || salvando}
          onClick={handleAssinar}
        >
          {salvando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileSignature className="h-4 w-4 mr-2" />}
          Assinar Termo de Anuência
        </Button>
      </CardContent>
    </Card>
  );
}
