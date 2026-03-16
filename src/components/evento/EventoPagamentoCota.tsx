import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, CreditCard, QrCode, Copy, CheckCircle2 } from 'lucide-react';
import { publicSupabase } from '@/integrations/supabase/publicClient';
import { toast } from 'sonner';

interface Props {
  token: string;
  sinistro: { id: string; protocolo: string };
  associado: { nome: string; cpf: string };
  cota: { valor_fipe: number; percentual: number; cota_minima: number; valor_cota: number; plano_nome: string };
  onPago: () => void;
}

export default function EventoPagamentoCota({ token, sinistro, associado, cota, onPago }: Props) {
  const [metodo, setMetodo] = useState<'pix' | 'cartao'>('pix');
  const [loading, setLoading] = useState(false);

  // PIX state
  const [pixData, setPixData] = useState<{ qr_code: string; copia_cola: string; cobranca_id: string } | null>(null);
  const [pixLoading, setPixLoading] = useState(false);
  const [countdown, setCountdown] = useState(1800); // 30 min
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Card state
  const [cardNumero, setCardNumero] = useState('');
  const [cardNome, setCardNome] = useState('');
  const [cardValidade, setCardValidade] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [parcelas, setParcelas] = useState(1);
  const [cardError, setCardError] = useState('');

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  const gerarPix = async () => {
    try {
      setPixLoading(true);
      const res = await publicSupabase.functions.invoke('processar-termo-evento', {
        body: { acao: 'gerar_cobranca_pix', token },
      });
      if (res.error) throw res.error;
      if (!res.data?.success) throw new Error(res.data?.error);

      setPixData({
        qr_code: res.data.qr_code,
        copia_cola: res.data.copia_cola,
        cobranca_id: res.data.cobranca_id,
      });

      // Start polling
      pollingRef.current = setInterval(async () => {
        try {
          const pollRes = await publicSupabase.functions.invoke('processar-termo-evento', {
            body: { acao: 'verificar_pagamento', token, cobranca_id: res.data.cobranca_id },
          });
          if (pollRes.data?.confirmado) {
            if (pollingRef.current) clearInterval(pollingRef.current);
            if (countdownRef.current) clearInterval(countdownRef.current);
            toast.success('Pagamento confirmado!');
            onPago();
          }
        } catch (e) { /* silent */ }
      }, 5000);

      // Start countdown
      setCountdown(1800);
      countdownRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            if (countdownRef.current) clearInterval(countdownRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao gerar PIX');
    } finally {
      setPixLoading(false);
    }
  };

  const copiarPix = () => {
    if (pixData?.copia_cola) {
      navigator.clipboard.writeText(pixData.copia_cola);
      toast.success('Código PIX copiado!');
    }
  };

  const pagarCartao = async () => {
    setCardError('');
    if (!cardNumero || !cardNome || !cardValidade || !cardCvv) {
      setCardError('Preencha todos os campos do cartão');
      return;
    }

    try {
      setLoading(true);
      const res = await publicSupabase.functions.invoke('processar-termo-evento', {
        body: {
          acao: 'gerar_cobranca_cartao',
          token,
          cartao: {
            numero: cardNumero,
            nome: cardNome,
            validade: cardValidade,
            cvv: cardCvv,
          },
          parcelas,
        },
      });
      if (res.error) throw res.error;
      if (!res.data?.success) {
        setCardError(res.data?.error || 'Pagamento recusado');
        return;
      }

      toast.success('Pagamento aprovado!');
      onPago();
    } catch (err: any) {
      setCardError(err.message || 'Erro ao processar pagamento');
    } finally {
      setLoading(false);
    }
  };

  const formatCountdown = () => {
    const min = Math.floor(countdown / 60);
    const sec = countdown % 60;
    return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const formatCardNumber = (v: string) => {
    const digits = v.replace(/\D/g, '').slice(0, 16);
    return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
  };

  const formatValidade = (v: string) => {
    const digits = v.replace(/\D/g, '').slice(0, 4);
    if (digits.length >= 3) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return digits;
  };

  return (
    <div className="space-y-4">
      {/* Resumo do cálculo */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Cota de Coparticipação</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Valor FIPE do veículo</span>
              <span>R$ {cota.valor_fipe.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Percentual do plano ({cota.plano_nome})</span>
              <span>{cota.percentual}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cota mínima</span>
              <span>{cota.cota_minima === 0 ? 'Sem mínimo' : `R$ ${cota.cota_minima.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}</span>
            </div>
            <div className="border-t pt-2 flex justify-between font-bold text-base">
              <span>Valor da cota</span>
              <span className="text-primary">R$ {cota.valor_cota.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Método de pagamento */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Forma de Pagamento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup value={metodo} onValueChange={(v) => setMetodo(v as 'pix' | 'cartao')} className="grid grid-cols-2 gap-3">
            <div className={`flex items-center gap-2 border rounded-lg p-3 cursor-pointer ${metodo === 'pix' ? 'border-primary bg-primary/5' : ''}`}>
              <RadioGroupItem value="pix" id="pix" />
              <Label htmlFor="pix" className="flex items-center gap-1.5 cursor-pointer text-sm">
                <QrCode className="h-4 w-4" /> PIX
              </Label>
            </div>
            <div className={`flex items-center gap-2 border rounded-lg p-3 cursor-pointer ${metodo === 'cartao' ? 'border-primary bg-primary/5' : ''}`}>
              <RadioGroupItem value="cartao" id="cartao" />
              <Label htmlFor="cartao" className="flex items-center gap-1.5 cursor-pointer text-sm">
                <CreditCard className="h-4 w-4" /> Cartão
              </Label>
            </div>
          </RadioGroup>

          {/* PIX */}
          {metodo === 'pix' && (
            <div className="space-y-4">
              {!pixData ? (
                <Button onClick={gerarPix} disabled={pixLoading} className="w-full">
                  {pixLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <QrCode className="mr-2 h-4 w-4" />}
                  Gerar QR Code PIX
                </Button>
              ) : (
                <div className="space-y-4 text-center">
                  {pixData.qr_code && (
                    <div className="flex justify-center">
                      <img
                        src={`data:image/png;base64,${pixData.qr_code}`}
                        alt="QR Code PIX"
                        className="w-48 h-48 border rounded-lg"
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Código PIX Copia e Cola:</p>
                    <div className="flex gap-2">
                      <Input
                        readOnly
                        value={pixData.copia_cola}
                        className="text-xs"
                      />
                      <Button variant="outline" size="icon" onClick={copiarPix}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="text-sm">
                    <p className="text-muted-foreground">Tempo restante:</p>
                    <p className={`text-lg font-bold ${countdown < 300 ? 'text-red-600' : 'text-primary'}`}>
                      {formatCountdown()}
                    </p>
                  </div>

                  <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Aguardando confirmação do pagamento...
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Cartão */}
          {metodo === 'cartao' && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Número do Cartão</Label>
                <Input
                  placeholder="0000 0000 0000 0000"
                  value={cardNumero}
                  onChange={(e) => setCardNumero(formatCardNumber(e.target.value))}
                  maxLength={19}
                />
              </div>
              <div>
                <Label className="text-xs">Nome no Cartão</Label>
                <Input
                  placeholder="Como está impresso no cartão"
                  value={cardNome}
                  onChange={(e) => setCardNome(e.target.value.toUpperCase())}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Validade</Label>
                  <Input
                    placeholder="MM/AA"
                    value={cardValidade}
                    onChange={(e) => setCardValidade(formatValidade(e.target.value))}
                    maxLength={5}
                  />
                </div>
                <div>
                  <Label className="text-xs">CVV</Label>
                  <Input
                    placeholder="123"
                    value={cardCvv}
                    onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    maxLength={4}
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs">Parcelas</Label>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={parcelas}
                  onChange={(e) => setParcelas(Number(e.target.value))}
                >
                  <option value={1}>1x de R$ {cota.valor_cota.toFixed(2)} (sem juros)</option>
                  {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => {
                    const valorParcela = (cota.valor_cota / n * 1.0299).toFixed(2);
                    const total = (Number(valorParcela) * n).toFixed(2);
                    return (
                      <option key={n} value={n}>
                        {n}x de R$ {valorParcela} (total R$ {total})*
                      </option>
                    );
                  })}
                </select>
              </div>

              <p className="text-[10px] text-muted-foreground">* Valores aproximados. O valor final pode variar conforme a operadora do cartão.</p>

              {cardError && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
                  {cardError}
                </div>
              )}

              <Button onClick={pagarCartao} disabled={loading} className="w-full bg-green-600 hover:bg-green-700">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <CreditCard className="mr-2 h-4 w-4" />
                    Pagar R$ {cota.valor_cota.toFixed(2)}
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
