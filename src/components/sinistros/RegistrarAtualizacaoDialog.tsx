import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Camera, Upload, X, CheckCircle2, Circle, CircleDot, ArrowRight, AlertTriangle } from 'lucide-react';
import { useDropzone } from 'react-dropzone';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ordemServico: {
    id: string;
    numero: string;
    etapas_reparo: any[];
    sinistro_id?: string;
  };
}

export function RegistrarAtualizacaoDialog({ open, onOpenChange, ordemServico }: Props) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [descricao, setDescricao] = useState('');
  const [fotos, setFotos] = useState<File[]>([]);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [concluirEtapa, setConcluirEtapa] = useState(false);
  const [temProblema, setTemProblema] = useState(false);
  const [tipoProblema, setTipoProblema] = useState('');
  const [descricaoProblema, setDescricaoProblema] = useState('');
  const [salvando, setSalvando] = useState(false);

  const etapas = ordemServico.etapas_reparo || [];
  const etapaAtual = etapas.find((e: any) => e.status === 'em_andamento');
  const idxAtual = etapas.findIndex((e: any) => e.status === 'em_andamento');
  const proximaEtapa = idxAtual >= 0 && idxAtual + 1 < etapas.length ? etapas[idxAtual + 1] : null;
  const isUltimaEtapa = idxAtual >= 0 && idxAtual + 1 >= etapas.length;

  const onDropFotos = useCallback((files: File[]) => {
    setFotos((prev) => [...prev, ...files].slice(0, 10));
  }, []);

  const { getRootProps, getInputProps } = useDropzone({
    onDrop: onDropFotos,
    accept: { 'image/*': [] },
    maxFiles: 10,
  });

  const removerFoto = (idx: number) => setFotos((prev) => prev.filter((_, i) => i !== idx));

  const canSave = fotos.length >= 2 && descricao.trim().length > 0 && !salvando;

  const handleSalvar = async () => {
    if (!canSave || !profile?.id) return;
    setSalvando(true);

    try {
      const timestamp = Date.now();
      const fotosUrls: string[] = [];

      // Upload fotos
      for (const foto of fotos) {
        const path = `${ordemServico.id}/atualizacoes/${timestamp}/${foto.name}`;
        const { error: uploadErr } = await supabase.storage
          .from('sinistro-eventos')
          .upload(path, foto, { upsert: true });
        if (!uploadErr) {
          const { data } = supabase.storage.from('sinistro-eventos').getPublicUrl(path);
          if (data?.publicUrl) fotosUrls.push(data.publicUrl);
        }
      }

      // Upload vídeo
      let videoUrl = null;
      if (videoFile) {
        const vPath = `${ordemServico.id}/atualizacoes/${timestamp}/video_${videoFile.name}`;
        const { error: vErr } = await supabase.storage
          .from('sinistro-eventos')
          .upload(vPath, videoFile, { upsert: true });
        if (!vErr) {
          const { data } = supabase.storage.from('sinistro-eventos').getPublicUrl(vPath);
          videoUrl = data?.publicUrl;
        }
      }

      // Inserir atualização
      const { error: insertErr } = await supabase.from('os_atualizacoes_diarias').insert({
        ordem_servico_id: ordemServico.id,
        regulador_id: profile.id,
        descricao,
        fotos_urls: fotosUrls,
        video_url: videoUrl,
        etapa_concluida: concluirEtapa ? etapaAtual?.nome : null,
        etapa_iniciada: concluirEtapa && proximaEtapa ? proximaEtapa.nome : null,
        tem_problema: temProblema,
        tipo_problema: temProblema ? tipoProblema : null,
        descricao_problema: temProblema ? descricaoProblema : null,
      } as any);

      if (insertErr) throw insertErr;

      // Atualizar etapas se concluiu
      if (concluirEtapa && etapaAtual) {
        const novasEtapas = etapas.map((e: any, i: number) => {
          if (i === idxAtual) return { ...e, status: 'concluida', concluida_em: new Date().toISOString() };
          if (i === idxAtual + 1) return { ...e, status: 'em_andamento', iniciada_em: new Date().toISOString() };
          return e;
        });

        const updates: any = {
          etapas_reparo: novasEtapas,
          updated_at: new Date().toISOString(),
        };

        // Se última etapa → concluído
        if (isUltimaEtapa) {
          updates.status = 'concluido';
          updates.data_conclusao_real = new Date().toISOString();
        }

        await supabase.from('ordens_servico').update(updates).eq('id', ordemServico.id);

        // Notificar via WhatsApp
        await supabase.functions.invoke('notificar-etapa-os', {
          body: {
            ordem_servico_id: ordemServico.id,
            etapa_concluida: etapaAtual.nome,
            proxima_etapa: proximaEtapa?.nome,
            tipo: isUltimaEtapa ? 'conclusao' : 'etapa_concluida',
          },
        });

        // Se concluído, gerar link de retirada
        if (isUltimaEtapa) {
          await supabase.functions.invoke('gerar-link-retirada', {
            body: { ordem_servico_id: ordemServico.id },
          });
        }
      }

      // Se tem problema, notificar
      if (temProblema) {
        await supabase.functions.invoke('notificar-etapa-os', {
          body: {
            ordem_servico_id: ordemServico.id,
            tipo: 'problema',
            tipo_problema: tipoProblema,
            descricao_problema: descricaoProblema,
          },
        });
      }

      toast.success('Atualização registrada com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['veiculos-oficina'] });
      onOpenChange(false);
      // Reset
      setDescricao('');
      setFotos([]);
      setVideoFile(null);
      setConcluirEtapa(false);
      setTemProblema(false);
      setTipoProblema('');
      setDescricaoProblema('');
    } catch (error: any) {
      toast.error('Erro: ' + error.message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar Atualização — OS {ordemServico.numero}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Fotos */}
          <div>
            <Label className="text-sm font-medium flex items-center gap-1">
              <Camera className="h-4 w-4" /> Comprovação Visual (mín. 2 fotos) *
            </Label>
            <div
              {...getRootProps()}
              className="mt-1 border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary transition-colors"
            >
              <input {...getInputProps()} />
              <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-1" />
              <p className="text-xs text-muted-foreground">Toque para adicionar fotos ({fotos.length}/10)</p>
            </div>
            {fotos.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {fotos.map((f, i) => (
                  <div key={i} className="relative w-16 h-16">
                    <img src={URL.createObjectURL(f)} className="w-full h-full object-cover rounded" alt="" />
                    <button onClick={() => removerFoto(i)} className="absolute -top-1 -right-1 bg-destructive text-white rounded-full p-0.5">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {fotos.length < 2 && fotos.length > 0 && (
              <p className="text-xs text-destructive mt-1">Adicione pelo menos 2 fotos</p>
            )}
          </div>

          {/* Vídeo opcional */}
          <div>
            <Label className="text-sm">Vídeo (opcional)</Label>
            <input
              type="file"
              accept="video/*"
              className="mt-1 text-xs"
              onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
            />
          </div>

          {/* Descrição */}
          <div>
            <Label className="text-sm font-medium">Descrição *</Label>
            <Textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex: Lanternagem concluída. Veículo na cabine de pintura, primer aplicado."
              className="mt-1"
              rows={3}
            />
          </div>

          {/* Mudança de Etapa */}
          {etapaAtual && (
            <div className="border rounded-lg p-3 space-y-2">
              <Label className="text-sm font-medium">Mudança de Etapa</Label>
              <div className="flex items-center gap-2 text-sm">
                <Badge variant="outline" className="bg-blue-50">
                  <CircleDot className="h-3 w-3 mr-1 text-blue-500" />
                  {etapaAtual.nome}
                </Badge>
                {proximaEtapa && (
                  <>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    <Badge variant="outline">
                      <Circle className="h-3 w-3 mr-1" />
                      {proximaEtapa.nome}
                    </Badge>
                  </>
                )}
                {isUltimaEtapa && (
                  <>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    <Badge className="bg-emerald-100 text-emerald-800">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Concluído
                    </Badge>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={concluirEtapa} onCheckedChange={setConcluirEtapa} />
                <span className="text-sm">A etapa "{etapaAtual.nome}" foi concluída?</span>
              </div>
            </div>
          )}

          {/* Problemas */}
          <div className="border rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Switch checked={temProblema} onCheckedChange={setTemProblema} />
              <Label className="text-sm flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />
                Há problema ou atraso?
              </Label>
            </div>
            {temProblema && (
              <div className="space-y-2 pl-2">
                <Select value={tipoProblema} onValueChange={setTipoProblema}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Tipo do problema" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Aguardando peça">Aguardando peça</SelectItem>
                    <SelectItem value="Problema de qualidade">Problema de qualidade</SelectItem>
                    <SelectItem value="Atraso da oficina">Atraso da oficina</SelectItem>
                    <SelectItem value="Outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
                <Textarea
                  value={descricaoProblema}
                  onChange={(e) => setDescricaoProblema(e.target.value)}
                  placeholder="Descreva o problema..."
                  rows={2}
                  className="text-xs"
                />
              </div>
            )}
          </div>

          <Button onClick={handleSalvar} disabled={!canSave} className="w-full">
            {salvando ? 'Salvando...' : 'Salvar Atualização'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
