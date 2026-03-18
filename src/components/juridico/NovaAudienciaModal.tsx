import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar as CalendarIcon, MapPin, Video, FileText, Loader2, Plus, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useAudiencias } from '@/hooks/useAudiencias';
import { useAdvogados } from '@/hooks/useAdvogados';
import { useProcessosBusca } from '@/hooks/useProcessosBusca';
import { TIPO_AUDIENCIA_LABELS, type TipoAudiencia, MODALIDADE_AUDIENCIA_LABELS, type ModalidadeAudiencia } from '@/types/juridico';

interface NovaAudienciaModalProps {
  open: boolean;
  onClose: () => void;
  processoId?: string;
}

export function NovaAudienciaModal({ open, onClose, processoId }: NovaAudienciaModalProps) {
  const { criarAudiencia, isCriando } = useAudiencias();
  const { advogados } = useAdvogados({ ativo: true });

  const [tipo, setTipo] = useState<string>('conciliacao');
  const [data, setData] = useState<Date | undefined>();
  const [hora, setHora] = useState('');
  const [modalidade, setModalidade] = useState<string>('presencial');
  const [forum, setForum] = useState('');
  const [vara, setVara] = useState('');
  const [sala, setSala] = useState('');
  const [enderecoCompleto, setEnderecoCompleto] = useState('');
  const [link, setLink] = useState('');
  const [advogadoId, setAdvogadoId] = useState('');
  const [juizOrgao, setJuizOrgao] = useState('');
  const [pauta, setPauta] = useState('');
  const [prazoAutomatico, setPrazoAutomatico] = useState(true);
  const [selectedProcessoId, setSelectedProcessoId] = useState(processoId || '');
  const [processoBusca, setProcessoBusca] = useState('');
  const [testemunhas, setTestemunhas] = useState<{ nome: string; funcao: string; confirmado: boolean }[]>([]);
  const [documentos, setDocumentos] = useState<{ descricao: string; preparado: boolean }[]>([]);

  // Busca de processos
  const { processos: processosEncontrados, isLoading: buscandoProcessos } = useProcessosBusca(processoBusca);

  const handleClose = () => {
    setTipo('conciliacao');
    setData(undefined);
    setHora('');
    setModalidade('presencial');
    setForum('');
    setVara('');
    setSala('');
    setEnderecoCompleto('');
    setLink('');
    setAdvogadoId('');
    setJuizOrgao('');
    setPauta('');
    setPrazoAutomatico(true);
    setSelectedProcessoId(processoId || '');
    setProcessoBusca('');
    setTestemunhas([]);
    setDocumentos([]);
    onClose();
  };

  const handleSubmit = async () => {
    if (!selectedProcessoId || !data || !hora || !advogadoId) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }

    const dataFormatada = format(data, 'yyyy-MM-dd');

    await criarAudiencia({
      processo_id: selectedProcessoId,
      tipo,
      data_hora: `${dataFormatada}T${hora}:00`,
      modalidade,
      local: forum ? `${forum}${vara ? ` — ${vara}` : ''}${sala ? ` — Sala ${sala}` : ''}` : undefined,
      link_videoconferencia: link || undefined,
      forum: forum || undefined,
      vara: vara || undefined,
      sala: sala || undefined,
      endereco_completo: enderecoCompleto || undefined,
      advogado_id: advogadoId,
      juiz_orgao: juizOrgao || undefined,
      testemunhas_lista: testemunhas.length > 0 ? testemunhas : undefined,
      documentos_necessarios: documentos.length > 0 ? documentos : undefined,
      pauta: pauta || undefined,
      prazo_automatico: prazoAutomatico,
    });

    handleClose();
  };

  const isValid = selectedProcessoId && data && hora && advogadoId;
  const showPresencial = modalidade === 'presencial' || modalidade === 'hibrida';
  const showVirtual = modalidade === 'virtual' || modalidade === 'hibrida';

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Agendar Audiência</DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] pr-4">
          <div className="space-y-4">
            {/* Processo vinculado */}
            {!processoId && (
              <div className="space-y-2">
                <Label>Processo vinculado *</Label>
                <Input
                  placeholder="Buscar por número do processo..."
                  value={processoBusca}
                  onChange={(e) => {
                    setProcessoBusca(e.target.value);
                    setSelectedProcessoId('');
                  }}
                />
                {processoBusca && processosEncontrados.length > 0 && !selectedProcessoId && (
                  <div className="border rounded-md max-h-32 overflow-y-auto">
                    {processosEncontrados.map((p) => (
                      <button
                        key={p.id}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
                        onClick={() => {
                          setSelectedProcessoId(p.id);
                          setProcessoBusca(p.numero || p.numero_processo || '');
                        }}
                      >
                        <span className="font-medium">{p.numero || p.numero_processo}</span>
                        <span className="text-muted-foreground ml-2">— {p.parte_contraria_nome}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tipo e Modalidade */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de Audiência *</Label>
                <Select value={tipo} onValueChange={setTipo}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.entries(TIPO_AUDIENCIA_LABELS) as [TipoAudiencia, string][]).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Modalidade</Label>
                <Select value={modalidade} onValueChange={setModalidade}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.entries(MODALIDADE_AUDIENCIA_LABELS) as [ModalidadeAudiencia, string][]).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Data e Hora */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !data && 'text-muted-foreground')}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {data ? format(data, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecione'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={data} onSelect={setData} locale={ptBR} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Hora *</Label>
                <Input type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
              </div>
            </div>

            {/* Advogado e Juiz */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Advogado representante *</Label>
                <Select value={advogadoId} onValueChange={setAdvogadoId}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {advogados.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.nome}{a.oab ? ` (OAB ${a.oab_estado}/${a.oab})` : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Juiz / Órgão</Label>
                <Input placeholder="Nome do juiz ou órgão" value={juizOrgao} onChange={(e) => setJuizOrgao(e.target.value)} />
              </div>
            </div>

            {/* Local presencial */}
            {showPresencial && (
              <div className="space-y-3 p-3 border rounded-lg">
                <Label className="flex items-center gap-2"><MapPin className="h-4 w-4" /> Local Presencial</Label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Input placeholder="Fórum" value={forum} onChange={(e) => setForum(e.target.value)} />
                  <Input placeholder="Vara" value={vara} onChange={(e) => setVara(e.target.value)} />
                  <Input placeholder="Sala" value={sala} onChange={(e) => setSala(e.target.value)} />
                </div>
                <Input placeholder="Endereço completo" value={enderecoCompleto} onChange={(e) => setEnderecoCompleto(e.target.value)} />
              </div>
            )}

            {/* Link virtual */}
            {showVirtual && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Video className="h-4 w-4" /> Link Videoconferência</Label>
                <Input placeholder="https://..." value={link} onChange={(e) => setLink(e.target.value)} />
              </div>
            )}

            {/* Testemunhas */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><Users className="h-4 w-4" /> Testemunhas da Pratic</Label>
              {testemunhas.map((t, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Input placeholder="Nome" value={t.nome} onChange={(e) => { const c = [...testemunhas]; c[i].nome = e.target.value; setTestemunhas(c); }} className="flex-1" />
                  <Input placeholder="Função" value={t.funcao} onChange={(e) => { const c = [...testemunhas]; c[i].funcao = e.target.value; setTestemunhas(c); }} className="flex-1" />
                  <div className="flex items-center gap-1">
                    <Switch checked={t.confirmado} onCheckedChange={(v) => { const c = [...testemunhas]; c[i].confirmado = v; setTestemunhas(c); }} />
                    <span className="text-xs text-muted-foreground">Conf.</span>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setTestemunhas(testemunhas.filter((_, j) => j !== i))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setTestemunhas([...testemunhas, { nome: '', funcao: '', confirmado: false }])}>
                <Plus className="h-4 w-4 mr-1" /> Adicionar testemunha
              </Button>
            </div>

            {/* Documentos necessários */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><FileText className="h-4 w-4" /> Documentos necessários</Label>
              {documentos.map((d, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Input placeholder="Descrição do documento" value={d.descricao} onChange={(e) => { const c = [...documentos]; c[i].descricao = e.target.value; setDocumentos(c); }} className="flex-1" />
                  <div className="flex items-center gap-1">
                    <Switch checked={d.preparado} onCheckedChange={(v) => { const c = [...documentos]; c[i].preparado = v; setDocumentos(c); }} />
                    <span className="text-xs text-muted-foreground">Pronto</span>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setDocumentos(documentos.filter((_, j) => j !== i))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setDocumentos([...documentos, { descricao: '', preparado: false }])}>
                <Plus className="h-4 w-4 mr-1" /> Adicionar documento
              </Button>
            </div>

            {/* Pauta */}
            <div className="space-y-2">
              <Label>Pauta / Observações</Label>
              <Textarea placeholder="Descreva a pauta..." value={pauta} onChange={(e) => setPauta(e.target.value)} rows={3} />
            </div>

            {/* Prazo automático */}
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="text-sm font-medium">Criar prazo automaticamente?</p>
                <p className="text-xs text-muted-foreground">Cria lembretes de 7, 3 e 1 dia antes</p>
              </div>
              <Switch checked={prazoAutomatico} onCheckedChange={setPrazoAutomatico} />
            </div>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!isValid || isCriando}>
            {isCriando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Agendar Audiência
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
