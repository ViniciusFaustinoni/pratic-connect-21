import { useState, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, FileText } from 'lucide-react';
import { publicSupabase } from '@/integrations/supabase/publicClient';
import { toast } from 'sonner';
import { SignaturePad } from '@/components/instalador/SignaturePad';

interface Props {
  token: string;
  sinistro: { id: string; protocolo: string; tipo: string; data_ocorrencia: string; bo_numero?: string };
  associado: { nome: string; cpf: string };
  veiculo: { placa: string; marca: string; modelo: string };
  cota: { valor_cota: number; percentual: number; valor_fipe: number };
  onAssinado: () => void;
}

const TERMO_TEXTO = `TERMO DE ENTRADA DE EVENTO - PRATIC CAR

Pelo presente instrumento, eu, abaixo identificado(a), na qualidade de ASSOCIADO(A) da PRATIC CAR - ASSOCIAÇÃO DE PROTEÇÃO VEICULAR, declaro estar ciente e de acordo com os seguintes termos e condições:

1. DECLARAÇÃO DO EVENTO
Declaro que o evento comunicado à associação ocorreu de forma verídica, conforme relatado no comunicado de sinistro, e que todas as informações prestadas são verdadeiras, sob pena de responsabilidade civil e criminal.

2. COPARTICIPAÇÃO
Estou ciente de que, conforme previsto no regulamento da associação e no plano ao qual estou vinculado(a), é devida a cota de coparticipação no evento, cujo valor foi calculado de acordo com a tabela vigente e está descrito neste documento.

3. CONDIÇÕES DO REPARO
a) O reparo será realizado em oficina credenciada pela Pratic Car;
b) O prazo estimado para conclusão do reparo será informado após avaliação técnica;
c) O veículo será entregue mediante vistoria de saída, que deverá ser assinada pelo associado;
d) Peças de reposição seguirão o padrão definido pela associação;
e) Eventuais custos adicionais não cobertos pela proteção serão de responsabilidade do associado.

4. OBRIGAÇÕES DO ASSOCIADO
a) Manter a adimplência das mensalidades durante todo o processo;
b) Comparecer para retirada do veículo no prazo estipulado;
c) Fornecer documentação adicional quando solicitado;
d) Não realizar reparos por conta própria sem autorização prévia.

5. EXCLUSÕES
Não estão cobertos pelo presente evento:
a) Danos preexistentes ao evento;
b) Acessórios não declarados na adesão;
c) Depreciação natural do veículo;
d) Danos decorrentes de uso indevido ou negligência comprovada.

6. PRAZO DE VALIDADE
Este termo tem validade vinculada ao protocolo do evento e permanece em vigor até a conclusão do reparo e liberação do veículo.

7. CONSENTIMENTO
Ao assinar este termo, declaro que li e compreendi todas as cláusulas acima, e concordo integralmente com os termos estabelecidos.

8. DISPOSIÇÕES GERAIS
a) A Pratic Car se reserva o direito de auditar o evento a qualquer momento;
b) Qualquer divergência será resolvida conforme o regulamento interno da associação;
c) Este documento é válido como instrumento particular, com força vinculante entre as partes.`;

export default function EventoTermoAssinatura({ token, sinistro, associado, veiculo, cota, onAssinado }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [signatureBlob, setSignatureBlob] = useState<Blob | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrolledToEnd, setScrolledToEnd] = useState(false);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 20;
    if (atBottom) setScrolledToEnd(true);
  }, []);

  const handleSignature = (blob: Blob) => {
    setSignatureBlob(blob);
  };

  const handleSubmit = async () => {
    if (!signatureBlob) {
      toast.error('Assine o termo antes de prosseguir');
      return;
    }

    try {
      setSubmitting(true);

      // Convert blob to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(signatureBlob);
      });
      const base64 = await base64Promise;

      const response = await publicSupabase.functions.invoke('processar-termo-evento', {
        body: {
          acao: 'assinar',
          token,
          assinatura_base64: base64,
          ip_cliente: 'browser',
        },
      });

      if (response.error) throw response.error;
      if (!response.data?.success) throw new Error(response.data?.error || 'Erro ao assinar');

      toast.success('Termo assinado com sucesso!');
      onAssinado();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao processar assinatura');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Termo de Entrada de Evento
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Dados resumidos */}
          <div className="grid grid-cols-2 gap-2 text-xs bg-muted/50 rounded-lg p-3">
            <div>
              <span className="text-muted-foreground">Associado:</span>
              <p className="font-medium">{associado.nome}</p>
            </div>
            <div>
              <span className="text-muted-foreground">CPF:</span>
              <p className="font-medium">{associado.cpf}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Veículo:</span>
              <p className="font-medium">{veiculo.placa} — {veiculo.marca} {veiculo.modelo}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Tipo:</span>
              <p className="font-medium capitalize">{sinistro.tipo}</p>
            </div>
            {sinistro.bo_numero && (
              <div>
                <span className="text-muted-foreground">B.O.:</span>
                <p className="font-medium">{sinistro.bo_numero}</p>
              </div>
            )}
            <div>
              <span className="text-muted-foreground">Cota:</span>
              <p className="font-bold text-primary">R$ {cota.valor_cota.toFixed(2)}</p>
            </div>
          </div>

          {/* Texto do termo com scroll */}
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="max-h-60 overflow-y-auto border rounded-lg p-3 text-xs leading-relaxed whitespace-pre-line bg-white"
          >
            {TERMO_TEXTO}
          </div>

          {!scrolledToEnd && (
            <p className="text-xs text-amber-600 text-center">↓ Role até o final para poder assinar</p>
          )}
        </CardContent>
      </Card>

      {/* Assinatura */}
      {scrolledToEnd && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Assinatura Digital</CardTitle>
            <p className="text-xs text-muted-foreground">Assine com o dedo no campo abaixo</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <SignaturePad onSave={handleSignature} disabled={submitting} />

            {signatureBlob && (
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  'Assinar e Prosseguir'
                )}
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
