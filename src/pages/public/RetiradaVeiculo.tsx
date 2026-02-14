import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { SignaturePad } from '@/components/instalador/SignaturePad';
import { toast } from 'sonner';
import {
  Car, MapPin, CheckCircle2, Circle, CircleDot, Clock, Shield, Loader2, AlertTriangle
} from 'lucide-react';
import logoFullDark from '@/assets/logos/logo-full-dark.png';

interface OSData {
  id: string;
  numero: string;
  status: string;
  data_entrada: string | null;
  data_conclusao_real: string | null;
  etapas_reparo: any[];
  token_retirada_expira: string | null;
  veiculo: any;
  associado: any;
  oficina: any;
}

export default function RetiradaVeiculo() {
  const { token } = useParams<{ token: string }>();
  const [os, setOs] = useState<OSData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dataRetirada, setDataRetirada] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [observacoes, setObservacoes] = useState('');
  const [aceitaCondicoes, setAceitaCondicoes] = useState(false);
  const [aceitaGarantia, setAceitaGarantia] = useState(false);
  const [assinaturaBlob, setAssinaturaBlob] = useState<Blob | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [confirmado, setConfirmado] = useState(false);

  useEffect(() => {
    if (!token) return;
    loadOS();
  }, [token]);

  const loadOS = async () => {
    try {
      const { data, error: err } = await supabase
        .from('ordens_servico')
        .select(`
          id, numero, status, data_entrada, data_conclusao_real, etapas_reparo, token_retirada_expira,
          veiculo:veiculos(placa, marca, modelo, ano, cor),
          associado:associados(nome, telefone),
          oficina:oficinas(nome_fantasia, razao_social, logradouro, numero, bairro, cidade, estado, cep)
        `)
        .eq('token_retirada', token)
        .single();

      if (err || !data) {
        setError('Link inválido ou expirado.');
        return;
      }

      if (data.token_retirada_expira && new Date(data.token_retirada_expira) < new Date()) {
        setError('Este link expirou. Solicite um novo link de retirada.');
        return;
      }

      if (data.status === 'entregue') {
        setConfirmado(true);
      }

      setOs(data as any);
    } catch {
      setError('Erro ao carregar dados.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmar = async () => {
    if (!os || !assinaturaBlob || !aceitaCondicoes || !aceitaGarantia) return;
    setConfirmando(true);

    try {
      // Converter blob para base64
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(assinaturaBlob);
      });

      const { data, error: err } = await supabase.functions.invoke('confirmar-retirada', {
        body: {
          token,
          data_retirada: new Date(dataRetirada).toISOString(),
          observacoes,
          assinatura_base64: base64,
        },
      });

      if (err || !data?.success) throw new Error(data?.error || 'Erro ao confirmar');

      setConfirmado(true);
      toast.success('Retirada confirmada com sucesso!');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setConfirmando(false);
    }
  };

  const veiculo = os?.veiculo as any;
  const oficina = os?.oficina as any;
  const etapas = os?.etapas_reparo || [];
  const tempoOficina = os?.data_entrada && os?.data_conclusao_real
    ? differenceInDays(new Date(os.data_conclusao_real), new Date(os.data_entrada))
    : null;

  const endereco = oficina
    ? `${oficina.logradouro || ''}, ${oficina.numero || ''} - ${oficina.bairro || ''}, ${oficina.cidade || ''}/${oficina.estado || ''}`
    : '';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
        <Card className="max-w-md w-full bg-slate-800 border-slate-700">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="h-12 w-12 text-yellow-400 mx-auto mb-3" />
            <p className="text-white">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (confirmado) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
        <Card className="max-w-md w-full bg-slate-800 border-slate-700">
          <CardContent className="pt-6 text-center space-y-4">
            <CheckCircle2 className="h-16 w-16 text-emerald-400 mx-auto" />
            <h2 className="text-xl font-bold text-white">Retirada Confirmada!</h2>
            <p className="text-slate-300">
              Seu veículo foi entregue. A garantia de 90 dias está ativa.
            </p>
            <div className="flex items-center justify-center gap-2 text-emerald-400">
              <Shield className="h-5 w-5" />
              <span className="text-sm font-medium">Garantia ativa até {
                format(new Date(new Date(dataRetirada).getTime() + 90 * 86400000), 'dd/MM/yyyy')
              }</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 p-4">
      <div className="max-w-md mx-auto space-y-4">
        {/* Header */}
        <div className="text-center py-4">
          <img src={logoFullDark} alt="Pratic Car" className="h-10 mx-auto mb-3" />
          <h1 className="text-xl font-bold text-white">Seu veículo está pronto! 🎉</h1>
        </div>

        {/* Dados do Veículo */}
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="pt-4 space-y-2">
            <div className="flex items-center gap-2">
              <Car className="h-5 w-5 text-emerald-400" />
              <span className="text-lg font-bold text-white tracking-wider">{veiculo?.placa}</span>
            </div>
            <p className="text-sm text-slate-300">
              {[veiculo?.marca, veiculo?.modelo, veiculo?.ano, veiculo?.cor].filter(Boolean).join(' • ')}
            </p>
          </CardContent>
        </Card>

        {/* Oficina */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-400">Oficina</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-white font-medium">{oficina?.nome_fantasia || oficina?.razao_social}</p>
            <p className="text-xs text-slate-300">{endereco}</p>
            {endereco && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(endereco)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-emerald-400 text-xs hover:underline"
              >
                <MapPin className="h-3 w-3" /> Ver no Mapa
              </a>
            )}
          </CardContent>
        </Card>

        {/* Etapas */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-400">Etapas do Reparo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {etapas.map((e: any, i: number) => {
                const Icon = e.status === 'concluida' ? CheckCircle2 : e.status === 'em_andamento' ? CircleDot : Circle;
                const color = e.status === 'concluida' ? 'text-emerald-400' : e.status === 'em_andamento' ? 'text-blue-400' : 'text-slate-500';
                return (
                  <div key={i} className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${color}`} />
                    <span className={`text-sm ${e.status === 'concluida' ? 'text-white' : 'text-slate-400'}`}>{e.nome}</span>
                    {e.concluida_em && (
                      <span className="text-[10px] text-slate-500 ml-auto">
                        {format(new Date(e.concluida_em), 'dd/MM')}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            {tempoOficina !== null && (
              <div className="flex items-center gap-1 mt-3 text-xs text-slate-400">
                <Clock className="h-3 w-3" />
                Tempo total: {tempoOficina} dias em oficina
              </div>
            )}
          </CardContent>
        </Card>

        {/* Formulário */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-400">Confirmar Retirada</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-slate-300 text-sm">Data da Retirada</Label>
              <Input
                type="date"
                value={dataRetirada}
                onChange={(e) => setDataRetirada(e.target.value)}
                className="mt-1 bg-slate-700 border-slate-600 text-white"
              />
            </div>

            <div>
              <Label className="text-slate-300 text-sm">Observações (opcional)</Label>
              <Textarea
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                className="mt-1 bg-slate-700 border-slate-600 text-white"
                rows={2}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <Checkbox
                  id="condicoes"
                  checked={aceitaCondicoes}
                  onCheckedChange={(v) => setAceitaCondicoes(!!v)}
                />
                <label htmlFor="condicoes" className="text-sm text-slate-300">
                  Recebi meu veículo em perfeitas condições
                </label>
              </div>
              <div className="flex items-start gap-2">
                <Checkbox
                  id="garantia"
                  checked={aceitaGarantia}
                  onCheckedChange={(v) => setAceitaGarantia(!!v)}
                />
                <label htmlFor="garantia" className="text-sm text-slate-300">
                  Ciente da garantia de 90 dias a partir desta data
                </label>
              </div>
            </div>

            <div>
              <Label className="text-slate-300 text-sm">Assinatura Digital</Label>
              <div className="mt-2">
                <SignaturePad onSave={(blob) => setAssinaturaBlob(blob)} />
              </div>
            </div>

            <Button
              onClick={handleConfirmar}
              disabled={!aceitaCondicoes || !aceitaGarantia || !assinaturaBlob || confirmando}
              className="w-full bg-emerald-600 hover:bg-emerald-700"
            >
              {confirmando ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Confirmando...</> : 'Confirmar Retirada'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
