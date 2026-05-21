import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Download, Loader2, CheckCircle2, AlertTriangle, ExternalLink, Car } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';

type VeiculoImportado = {
  id: string;
  placa: string;
  codigo_veiculo: number;
  marca: string;
  modelo: string;
  ano_modelo: number | null;
};

type ResultadoOk = {
  success: true;
  associado_id: string;
  codigo_associado: number;
  veiculos: VeiculoImportado[];
};

type ResultadoNotFound = {
  success: false;
  not_found: true;
  error: string;
};

type Resultado = ResultadoOk | ResultadoNotFound;

function formatCpf(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function SincronizarAssociadoSGA() {
  const [cpf, setCpf] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  const cpfDigits = cpf.replace(/\D/g, '');
  const cpfValido = cpfDigits.length === 11;

  const handleSincronizar = async () => {
    if (!cpfValido) {
      toast.error('CPF inválido — digite os 11 dígitos');
      return;
    }
    setLoading(true);
    setResultado(null);
    try {
      const { data, error } = await supabase.functions.invoke('importar-associado-sga', {
        body: { cpf: cpfDigits },
      });

      if (error) {
        const msg = (error as any)?.message || 'Falha ao chamar importar-associado-sga';
        toast.error(msg);
        return;
      }

      const r = data as Resultado;
      setResultado(r);
      if (r?.success) {
        toast.success(
          `Associado sincronizado (cód. ${r.codigo_associado}) com ${r.veiculos.length} veículo(s)`
        );
      } else if ((r as ResultadoNotFound)?.not_found) {
        toast.warning((r as ResultadoNotFound).error || 'Associado não encontrado no SGA');
      } else {
        toast.error((r as any)?.error || 'Erro inesperado');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Erro inesperado');
    } finally {
      setLoading(false);
    }
  };

  const ok = resultado && (resultado as ResultadoOk).success;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Download className="h-5 w-5 text-primary" />
          Sincronizar associado do SGA por CPF
        </CardTitle>
        <CardDescription>
          Puxa um associado e todos os veículos dele do SGA Hinova para a base local. Após
          sincronizar, ele aparece em <strong>Associados</strong> e na <strong>Base Antiga</strong>.
          Operação idempotente: rodar de novo só atualiza os dados.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
          <div className="space-y-1.5">
            <Label htmlFor="cpf-sga">CPF do associado</Label>
            <Input
              id="cpf-sga"
              value={cpf}
              onChange={(e) => setCpf(formatCpf(e.target.value))}
              placeholder="000.000.000-00"
              inputMode="numeric"
              autoComplete="off"
              disabled={loading}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && cpfValido && !loading) handleSincronizar();
              }}
            />
          </div>
          <Button onClick={handleSincronizar} disabled={!cpfValido || loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Buscar e sincronizar
          </Button>
        </div>

        {ok && resultado && (resultado as ResultadoOk).success && (
          <Alert className="border-green-500/30 bg-green-500/5">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant="outline" className="border-green-500/40 text-green-700">
                  Sincronizado
                </Badge>
                <span>
                  Código SGA:{' '}
                  <strong className="font-mono">
                    {(resultado as ResultadoOk).codigo_associado}
                  </strong>
                </span>
                <span className="text-muted-foreground">·</span>
                <span>
                  {(resultado as ResultadoOk).veiculos.length} veículo(s) importado(s)
                </span>
              </div>

              {(resultado as ResultadoOk).veiculos.length > 0 && (
                <div className="space-y-1.5">
                  {(resultado as ResultadoOk).veiculos.map((v) => (
                    <div
                      key={v.id}
                      className="flex items-center gap-2 text-xs text-muted-foreground"
                    >
                      <Car className="h-3.5 w-3.5" />
                      <span className="font-mono font-semibold text-foreground">{v.placa}</span>
                      <span>—</span>
                      <span>
                        {v.marca} {v.modelo} {v.ano_modelo ? `(${v.ano_modelo})` : ''}
                      </span>
                      <span className="ml-auto font-mono">cód. {v.codigo_veiculo}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-1">
                <Button asChild variant="outline" size="sm">
                  <Link to={`/associados/${(resultado as ResultadoOk).associado_id}`}>
                    <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                    Abrir associado
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link to="/cadastro/base-antiga">
                    <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                    Ver na Base Antiga
                  </Link>
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {resultado && !(resultado as any).success && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{(resultado as any).error || 'Falha na sincronização'}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
