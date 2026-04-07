import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { AlertTriangle, CheckCircle2, XCircle, Clock, Loader2, Info } from 'lucide-react';
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

const TIPOS_OCORRENCIA = [
  { value: 'troca_rastreador', label: 'Troca de rastreador' },
  { value: 'reparacao_fiacao', label: 'Reparação de fiação' },
  { value: 'problema_chip_sinal', label: 'Problema de chip / sinal' },
  { value: 'violacao_terceiros', label: 'Violação por terceiros' },
  { value: 'diagnostico', label: 'Diagnóstico (a identificar no local)' },
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
    tiposVerificados: string[];
  }) => void;
  isPending: boolean;
}

export default function ResultadoVisitaForm({ tecnicoAgendadoId, onSubmit, isPending }: ResultadoVisitaFormProps) {
  const [dataHora, setDataHora] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [tecnicoId, setTecnicoId] = useState(tecnicoAgendadoId || 'nao_identificado');
  const [tiposVerificados, setTiposVerificados] = useState<string[]>([]);
  const [resultado, setResultado] = useState('');
  const [descricao, setDescricao] = useState('');
  const [rastreadorTrocado, setRastreadorTrocado] = useState(false);
  const [imeiNovo, setImeiNovo] = useState('');
  const [imeiRetirado, setImeiRetirado] = useState('');
  const [taxaObs, setTaxaObs] = useState('');
  const [voltouPontuar, setVoltouPontuar] = useState<string>('');

  const { data: instaladores } = useInstaladores();

  const isSemProblemaRastreador = resultado === 'sem_problema_rastreador';

  const toggleVerificado = (val: string) => {
    setTiposVerificados(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
  };

  const canSubmit =
    resultado &&
    descricao.trim().length > 0 &&
    voltouPontuar &&
    tiposVerificados.length > 0 &&
    (!rastreadorTrocado || (imeiNovo.trim() && imeiRetirado.trim())) &&
    (!isSemProblemaRastreador || taxaObs.trim().length > 0);

  const handleSubmit = () => {
    onSubmit({
      visitaDataHora: dataHora,
      visitaTecnicoId: tecnicoId === 'nao_identificado' ? null : tecnicoId,
      visitaResultado: resultado,
      visitaDescricao: descricao,
      rastreadorTrocado,
      imeiNovo,
      imeiRetirado,
      taxaVisitaAplicar: isSemProblemaRastreador,
      taxaVisitaObservacao: isSemProblemaRastreador ? taxaObs : '',
      voltouPontuar,
      tiposVerificados,
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

      {/* O que foi verificado? (checklist) */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold">O que foi verificado? <span className="text-destructive">*</span></Label>
        <div className="space-y-2">
          {TIPOS_OCORRENCIA.map(tipo => (
            <label key={tipo.value} className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={tiposVerificados.includes(tipo.value)}
                onCheckedChange={() => toggleVerificado(tipo.value)}
              />
              {tipo.label}
            </label>
          ))}
        </div>
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

      {/* Taxa automática — exibida apenas quando sem_problema_rastreador */}
      {isSemProblemaRastreador && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="p-3 space-y-2">
            <div className="flex gap-2 items-start">
              <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800">
                O problema identificado não está relacionado ao rastreador. A taxa de visita técnica será aplicada conforme regulamento.
              </p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Observação do técnico <span className="text-destructive">*</span></Label>
              <Textarea
                value={taxaObs}
                onChange={e => setTaxaObs(e.target.value)}
                placeholder="Descreva o motivo pelo qual o problema não é do rastreador..."
                rows={2}
              />
            </div>
          </CardContent>
        </Card>
      )}

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
