import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import AudioRecorder from './AudioRecorder';
import { publicSupabase } from '@/integrations/supabase/publicClient';
import { toast } from 'sonner';

interface Props {
  token: string;
  onComplete: () => void;
  localPadrao?: string;
}

export default function EventoEtapa3Relato({ token, onComplete, localPadrao }: Props) {
  const [relato, setRelato] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [dataEvento, setDataEvento] = useState('');
  const [rua, setRua] = useState(localPadrao || '');
  const [numero, setNumero] = useState('');
  const [houveTerceiro, setHouveTerceiro] = useState(false);
  const [terceiroNome, setTerceiroNome] = useState('');
  const [terceiroPlaca, setTerceiroPlaca] = useState('');
  const [terceiroTelefone, setTerceiroTelefone] = useState('');
  const [terceiroCulpa, setTerceiroCulpa] = useState('');
  const [saving, setSaving] = useState(false);

  const canSubmit = relato.trim().length > 0 || audioFile !== null;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      const dados: Record<string, unknown> = {
        relato_texto: relato.trim(),
        data_evento: dataEvento,
        local_rua: rua.trim(),
        local_numero: numero.trim(),
        houve_terceiro: houveTerceiro,
      };

      if (houveTerceiro) {
        dados.terceiro = {
          nome: terceiroNome.trim(),
          placa: terceiroPlaca.trim(),
          telefone: terceiroTelefone.trim(),
          culpa: terceiroCulpa,
        };
      }

      const formData = new FormData();
      formData.append('token', token);
      formData.append('etapa', '3');
      formData.append('dados', JSON.stringify(dados));
      if (audioFile) {
        formData.append('arquivo0', audioFile);
      }

      const { data, error } = await publicSupabase.functions.invoke('salvar-etapa-evento', {
        body: formData,
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success('Relato enviado com sucesso!');
      onComplete();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar relato');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Conte-nos o que aconteceu</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Descreva com o máximo de detalhes possível como o evento ocorreu. Você pode escrever ou gravar um áudio.
        </p>
      </div>

      <div>
        <Label htmlFor="relato">Relato escrito</Label>
        <Textarea
          id="relato"
          placeholder="Descreva o que aconteceu..."
          value={relato}
          onChange={(e) => setRelato(e.target.value)}
          rows={6}
        />
      </div>

      <div>
        <Label>Ou grave um áudio</Label>
        <AudioRecorder onAudioReady={setAudioFile} />
      </div>

      <div>
        <Label htmlFor="data_evento">Data e hora aproximada do evento</Label>
        <Input
          id="data_evento"
          type="datetime-local"
          value={dataEvento}
          onChange={(e) => setDataEvento(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="rua">Rua / Avenida</Label>
          <Input id="rua" placeholder="Nome da rua" value={rua} onChange={(e) => setRua(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="numero_local">Nº / Referência</Label>
          <Input id="numero_local" placeholder="Nº ou ponto de ref." value={numero} onChange={(e) => setNumero(e.target.value)} />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="terceiro"
          checked={houveTerceiro}
          onCheckedChange={(c) => setHouveTerceiro(!!c)}
        />
        <Label htmlFor="terceiro" className="cursor-pointer">Houve terceiro envolvido?</Label>
      </div>

      {houveTerceiro && (
        <div className="space-y-3 p-3 rounded-lg border bg-muted/30">
          <div>
            <Label htmlFor="terceiro_nome">Nome do terceiro</Label>
            <Input id="terceiro_nome" value={terceiroNome} onChange={(e) => setTerceiroNome(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="terceiro_placa">Placa do veículo</Label>
              <Input id="terceiro_placa" value={terceiroPlaca} onChange={(e) => setTerceiroPlaca(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="terceiro_tel">Telefone</Label>
              <Input id="terceiro_tel" value={terceiroTelefone} onChange={(e) => setTerceiroTelefone(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>O terceiro teve culpa?</Label>
            <Select value={terceiroCulpa} onValueChange={setTerceiroCulpa}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sim">Sim</SelectItem>
                <SelectItem value="nao">Não</SelectItem>
                <SelectItem value="nao_sei">Não sei</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <Button
        onClick={handleSubmit}
        disabled={!canSubmit || saving}
        className="w-full"
        size="lg"
      >
        {saving ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Finalizando envio...
          </>
        ) : (
          'Finalizar Envio'
        )}
      </Button>
    </div>
  );
}
