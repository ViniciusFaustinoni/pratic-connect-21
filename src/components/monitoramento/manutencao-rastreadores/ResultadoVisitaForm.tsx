import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { AlertTriangle, CheckCircle2, XCircle, Clock, Loader2 } from 'lucide-react';
import { useInstaladores } from '@/hooks/useRotas';
import { format } from 'date-fns';

const RESULTADOS = [
  { value: 'rastreador_trocado', label: 'Rastreador trocado' },
  { value: 'fiacao_reparada', label: 'Fiação reparada' },
  { value: 'chip_substituido', label: 'Chip substituído' },
  { value: 'violacao_corrigida', label: 'Violação corrigida (causada por terceiros)' },
  { value: 'sem_problema_rastreador', label: 'Sem problema no rastreador — falha não relacionada à instalação' },
  { value: 'resolvido_remotamente', label: 'Problema resolvido remotamente (sem intervenção física)' },
];

interface ResultadoVisitaFormProps {
  tecnicoAgendadoId?: string | null;
  onSubmit: (data: {
    visitaDataHora: string;
    visitaTecnicoId: string | null;
    visitaResultado: string;
    visitaDescricao: string;
    rastreadorTrocado: boolean;
    imeiNovo: string;
    imeiRetirado: string;
    taxaVisitaAplicar: boolean;
    taxaVisitaObservacao: string;
    voltouPontuar: string;
  }) => void;
  isPending: boolean;
}

export default function ResultadoVisitaForm({ tecnicoAgendadoId, onSubmit, isPending }: ResultadoVisitaFormProps) {
  const [dataHora, setDataHora] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [tecnicoId, setTecnicoId] = useState(tecnicoAgendadoId || 'nao_identificado');
  const [resultado, setResultado] = useState('');
  const [descricao, setDescricao] = useState('');
  const [rastreadorTrocado, setRastreadorTrocado] = useState(false);
  const [imeiNovo, setImeiNovo] = useState('');
  const [imeiRetirado, setImeiRetirado] = useState('');
  const [taxaAplicar, setTaxaAplicar] = useState(false);
  const [taxaObs, setTaxaObs] = useState('');
  const [voltouPontuar, setVoltouPontuar] = useState<string>('');

  const { data: instaladores } = useInstaladores();

  const canSubmit =
    resultado &&
    descricao.trim().length > 0 &&
    voltouPontuar &&
    (!rastreadorTrocado || (imeiNovo.trim() && imeiRetirado.trim())) &&
    (!taxaAplicar || taxaObs.trim().length > 0);

  const handleSubmit = () => {
    onSubmit({
      visitaDataHora: dataHora,
      visitaTecnicoId: tecnicoId === 'nao_identificado' ? null : tecnicoId,
      visitaResultado: resultado,
      visitaDescricao: descricao,
      rastreadorTrocado,
      imeiNovo,
      imeiRetirado,
      taxaVisitaAplicar: taxaAplicar,
      taxaVisitaObservacao: taxaObs,
      voltouPontuar,
    });
  };

  return (
    <div className="space-y-4" id="resultado-visita-section">
      <h3 className="font-semibold text-sm">Resultado da Visita Técnica</h3>

      {/* Data/hora */}
      <div className="space-y-1">
        <Label className="text-xs">Data e hora da visita realizada</Label>
        <Input type="datetime-local" value={dataHora} onChange={e => setDataHora(e.target.value)} />
      </div>

      {/* Técnico */}
      <div className="space-y-1">
        <Label className="text-xs">Técnico que realizou a visita</Label>
        <Select value={tecnicoId} onValueChange={setTecnicoId}>
          <SelectTrigger><SelectValue placeholder="Selecione o técnico" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="nao_identificado">Não identificado</SelectItem>
            {(instaladores || []).map((inst: any) => (
              <SelectItem key={inst.id} value={inst.id}>{inst.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Resultado */}
      <div className="space-y-1">
        <Label className="text-xs">Resultado da visita <span className="text-destructive">*</span></Label>
        <Select value={resultado} onValueChange={setResultado}>
          <SelectTrigger><SelectValue placeholder="Selecione o resultado" /></SelectTrigger>
          <SelectContent>
            {RESULTADOS.map(r => (
              <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Descrição */}
      <div className="space-y-1">
        <Label className="text-xs">Descrição técnica <span className="text-destructive">*</span></Label>
        <Textarea
          value={descricao}
          onChange={e => setDescricao(e.target.value)}
          placeholder="Descreva o que foi encontrado e o que foi feito..."
          rows={3}
        />
      </div>

      {/* Troca de rastreador */}
      <div className="space-y-2 p-3 rounded-lg border bg-muted/30">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium">O rastreador foi substituído?</Label>
          <Switch checked={rastreadorTrocado} onCheckedChange={setRastreadorTrocado} />
        </div>
        {rastreadorTrocado && (
          <div className="space-y-2 mt-2">
            <div className="space-y-1">
              <Label className="text-xs">IMEI do novo equipamento <span className="text-destructive">*</span></Label>
              <Input value={imeiNovo} onChange={e => setImeiNovo(e.target.value)} placeholder="IMEI novo" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">IMEI do equipamento retirado <span className="text-destructive">*</span></Label>
              <Input value={imeiRetirado} onChange={e => setImeiRetirado(e.target.value)} placeholder="IMEI retirado" />
            </div>
          </div>
        )}
      </div>

      {/* Taxa de visita */}
      <Card className="border-yellow-300 bg-yellow-50">
        <CardContent className="p-3 space-y-2">
          <div className="flex gap-2 items-start">
            <AlertTriangle className="h-4 w-4 text-yellow-600 shrink-0 mt-0.5" />
            <p className="text-xs text-yellow-800">
              A taxa de visita técnica de R$ 50,00 pode ser aplicada quando o problema não for relacionado ao rastreador. Defina abaixo se deve ser cobrada.
            </p>
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium">Cobrar taxa de visita de R$ 50,00?</Label>
            <Switch checked={taxaAplicar} onCheckedChange={setTaxaAplicar} />
          </div>
          {taxaAplicar && (
            <div className="space-y-1">
              <Label className="text-xs">Motivo da cobrança <span className="text-destructive">*</span></Label>
              <Textarea
                value={taxaObs}
                onChange={e => setTaxaObs(e.target.value)}
                placeholder="Descreva o motivo da cobrança..."
                rows={2}
              />
              <p className="text-[10px] text-muted-foreground">
                Uma notificação será registrada para o setor financeiro emitir a cobrança.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Voltou a pontuar */}
      <div className="space-y-2">
        <Label className="text-xs font-medium">Rastreador voltou a pontuar? <span className="text-destructive">*</span></Label>
        <div className="grid grid-cols-3 gap-2">
          <Button
            type="button"
            size="sm"
            variant={voltouPontuar === 'sim' ? 'default' : 'outline'}
            className={voltouPontuar === 'sim' ? 'bg-green-600 hover:bg-green-700 text-white' : ''}
            onClick={() => setVoltouPontuar('sim')}
          >
            <CheckCircle2 className="h-3 w-3 mr-1" /> Sim
          </Button>
          <Button
            type="button"
            size="sm"
            variant={voltouPontuar === 'nao' ? 'default' : 'outline'}
            className={voltouPontuar === 'nao' ? 'bg-destructive hover:bg-destructive/90 text-white' : ''}
            onClick={() => setVoltouPontuar('nao')}
          >
            <XCircle className="h-3 w-3 mr-1" /> Não
          </Button>
          <Button
            type="button"
            size="sm"
            variant={voltouPontuar === 'aguardando' ? 'default' : 'outline'}
            className={voltouPontuar === 'aguardando' ? 'bg-yellow-500 hover:bg-yellow-600 text-white' : ''}
            onClick={() => setVoltouPontuar('aguardando')}
          >
            <Clock className="h-3 w-3 mr-1" /> Aguardando
          </Button>
        </div>
      </div>

      {/* Submit */}
      <Button
        className="w-full"
        disabled={!canSubmit || isPending}
        onClick={handleSubmit}
      >
        {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
        Encerrar manutenção
      </Button>
    </div>
  );
}
