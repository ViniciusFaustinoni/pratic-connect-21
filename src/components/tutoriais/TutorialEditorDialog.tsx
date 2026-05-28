import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Trash2, ArrowUp, ArrowDown, Upload, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  useSaveTutorial,
  useUploadTutorialImage,
  type TutorialRow,
} from '@/hooks/useTutoriais';
import { resolverImagemTutorial } from '@/lib/tutoriais/imagemLocal';

interface Props {
  tutorial?: TutorialRow;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

interface StepDraft {
  id?: string;
  numero: number;
  titulo: string;
  descricao: string;
  imagem_url: string | null;
  dicas: string[];
  links: { label: string; url: string }[];
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

export function TutorialEditorDialog({ tutorial, open, onOpenChange }: Props) {
  const save = useSaveTutorial();
  const upload = useUploadTutorialImage();

  const [titulo, setTitulo] = useState('');
  const [slug, setSlug] = useState('');
  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState('');
  const [tempo, setTempo] = useState(5);
  const [novo, setNovo] = useState(false);
  const [ordem, setOrdem] = useState(0);
  const [steps, setSteps] = useState<StepDraft[]>([]);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);

  useEffect(() => {
    if (open) {
      setTitulo(tutorial?.titulo ?? '');
      setSlug(tutorial?.slug ?? '');
      setDescricao(tutorial?.descricao ?? '');
      setCategoria(tutorial?.categoria ?? '');
      setTempo(tutorial?.tempo_estimado_min ?? 5);
      setNovo(tutorial?.novo ?? false);
      setOrdem(tutorial?.ordem ?? 0);
      setSteps(
        (tutorial?.steps ?? []).map((s) => ({
          id: s.id,
          numero: s.numero,
          titulo: s.titulo,
          descricao: s.descricao,
          imagem_url: s.imagem_url,
          dicas: s.dicas,
          links: s.links,
        })),
      );
    }
  }, [open, tutorial]);

  function addStep() {
    setSteps((prev) => [
      ...prev,
      {
        numero: prev.length + 1,
        titulo: '',
        descricao: '',
        imagem_url: null,
        dicas: [],
        links: [],
      },
    ]);
  }

  function updateStep(idx: number, patch: Partial<StepDraft>) {
    setSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }

  function removeStep(idx: number) {
    setSteps((prev) => prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, numero: i + 1 })));
  }

  function moveStep(idx: number, dir: -1 | 1) {
    setSteps((prev) => {
      const target = idx + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next.map((s, i) => ({ ...s, numero: i + 1 }));
    });
  }

  async function handleUpload(idx: number, file: File) {
    setUploadingIdx(idx);
    try {
      const url = await upload.mutateAsync(file);
      updateStep(idx, { imagem_url: url });
    } catch (e: any) {
      toast.error(e.message ?? 'Falha ao enviar imagem');
    } finally {
      setUploadingIdx(null);
    }
  }

  async function handleSave() {
    if (!titulo.trim() || !categoria.trim()) {
      toast.error('Título e Categoria são obrigatórios');
      return;
    }
    const finalSlug = (slug || slugify(titulo)).trim();
    if (!finalSlug) {
      toast.error('Slug inválido');
      return;
    }
    try {
      await save.mutateAsync({
        id: tutorial?.id,
        slug: finalSlug,
        titulo: titulo.trim(),
        descricao: descricao.trim(),
        categoria: categoria.trim(),
        tempo_estimado_min: tempo,
        novo,
        ordem,
        steps: steps.map((s, i) => ({
          id: s.id,
          numero: i + 1,
          titulo: s.titulo.trim(),
          descricao: s.descricao.trim(),
          imagem_url: s.imagem_url,
          dicas: s.dicas.filter((d) => d.trim()),
          links: s.links.filter((l) => l.label.trim() && l.url.trim()),
        })),
      });
      toast.success('Tutorial salvo');
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? 'Falha ao salvar');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{tutorial ? 'Editar tutorial' : 'Novo tutorial'}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Título *</Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Slug (URL)</Label>
            <Input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder={titulo ? slugify(titulo) : 'meu-tutorial'}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Categoria *</Label>
            <Input
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              placeholder="Ex.: Operação Comercial"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Descrição</Label>
            <Textarea
              rows={2}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Tempo estimado (min)</Label>
            <Input
              type="number"
              min={1}
              value={tempo}
              onChange={(e) => setTempo(parseInt(e.target.value || '0', 10) || 1)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Ordem</Label>
            <Input
              type="number"
              value={ordem}
              onChange={(e) => setOrdem(parseInt(e.target.value || '0', 10) || 0)}
            />
          </div>
          <div className="flex items-center gap-2 sm:col-span-2">
            <Switch checked={novo} onCheckedChange={setNovo} id="novo-flag" />
            <Label htmlFor="novo-flag" className="cursor-pointer">
              Exibir badge &quot;Novo&quot;
            </Label>
          </div>
        </div>

        <div className="space-y-3 pt-4 border-t">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Passos ({steps.length})</h3>
            <Button size="sm" variant="outline" onClick={addStep} className="gap-1.5">
              <Plus className="h-4 w-4" /> Adicionar passo
            </Button>
          </div>

          {steps.map((s, idx) => {
            const preview = resolverImagemTutorial(s.imagem_url);
            return (
              <Card key={idx}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-muted-foreground">
                      Passo {idx + 1}
                    </span>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => moveStep(idx, -1)}
                        disabled={idx === 0}
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => moveStep(idx, 1)}
                        disabled={idx === steps.length - 1}
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive"
                        onClick={() => removeStep(idx)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  <Input
                    placeholder="Título do passo"
                    value={s.titulo}
                    onChange={(e) => updateStep(idx, { titulo: e.target.value })}
                  />
                  <Textarea
                    rows={3}
                    placeholder="Descrição"
                    value={s.descricao}
                    onChange={(e) => updateStep(idx, { descricao: e.target.value })}
                  />

                  <div className="space-y-1.5">
                    <Label className="text-xs">Imagem</Label>
                    {preview && (
                      <img
                        src={preview}
                        alt=""
                        className="max-h-40 rounded border object-contain bg-muted"
                      />
                    )}
                    <div className="flex items-center gap-2">
                      <label className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-sm cursor-pointer hover:bg-muted">
                        {uploadingIdx === idx ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Upload className="h-3.5 w-3.5" />
                        )}
                        Enviar imagem
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleUpload(idx, f);
                            e.target.value = '';
                          }}
                        />
                      </label>
                      {s.imagem_url && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => updateStep(idx, { imagem_url: null })}
                        >
                          Remover imagem
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Dicas (uma por linha)</Label>
                    <Textarea
                      rows={3}
                      value={s.dicas.join('\n')}
                      onChange={(e) =>
                        updateStep(idx, {
                          dicas: e.target.value.split('\n'),
                        })
                      }
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Links (Rótulo|URL — um por linha)</Label>
                    <Textarea
                      rows={2}
                      placeholder="Cadastro › Processos|/cadastro/processos"
                      value={s.links.map((l) => `${l.label}|${l.url}`).join('\n')}
                      onChange={(e) =>
                        updateStep(idx, {
                          links: e.target.value
                            .split('\n')
                            .map((line) => {
                              const [label, url] = line.split('|');
                              return { label: (label ?? '').trim(), url: (url ?? '').trim() };
                            }),
                        })
                      }
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {steps.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhum passo ainda. Clique em &quot;Adicionar passo&quot;.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={save.isPending}>
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
