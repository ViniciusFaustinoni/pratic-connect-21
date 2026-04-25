import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Bug, Upload, X, Image as ImageIcon, FileText, Lightbulb, AlertCircle } from 'lucide-react';
import { useCreateErrorReport } from '@/hooks/useErrorReports';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const MAX_FILES = 10;
const MAX_SIZE = 10 * 1024 * 1024;

export function RelatarErroModal({ open, onOpenChange }: Props) {
  const [area, setArea] = useState('');
  const [descricao, setDescricao] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const create = useCreateErrorReport();

  const reset = () => {
    setArea('');
    setDescricao('');
    setFiles([]);
  };

  const handleFiles = (list: FileList | null) => {
    if (!list) return;
    const incoming = Array.from(list);
    const valid: File[] = [];
    for (const f of incoming) {
      if (f.size > MAX_SIZE) {
        toast.error(`${f.name} excede 10MB`);
        continue;
      }
      valid.push(f);
    }
    setFiles((prev) => [...prev, ...valid].slice(0, MAX_FILES));
  };

  const removeFile = (i: number) => setFiles((prev) => prev.filter((_, idx) => idx !== i));

  const submit = async () => {
    if (area.trim().length < 2) return toast.error('Informe a área');
    if (descricao.trim().length < 20) return toast.error('Descreva com pelo menos 20 caracteres');
    if (files.length === 0) return toast.error('Anexe pelo menos 1 arquivo (print ou PDF)');
    await create.mutateAsync({ area, descricao, files });
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bug className="h-5 w-5 text-destructive" />
            Relatar Erro
          </DialogTitle>
          <DialogDescription>
            Descreva o problema encontrado. Sua mensagem vai direto para a equipe responsável.
          </DialogDescription>

          <Accordion type="single" collapsible className="mt-4 border rounded-lg bg-muted/30">
            <AccordionItem value="boas-praticas" className="border-0">
              <AccordionTrigger className="px-4 py-3 hover:no-underline text-sm font-medium">
                <span className="flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-amber-500" />
                  Boas práticas para relatar erros
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <span><strong>Um erro = um relato.</strong> Se encontrou 3 problemas diferentes, abra 3 relatos separados.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <span><strong>Print sempre da tela inteira,</strong> mostrando a mensagem de erro e o que estava aberto.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <span><strong>Não escreva só "não está funcionando"</strong> — sem contexto, ninguém consegue ajudar.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <span><strong>Inclua dados de exemplo</strong> quando possível: número da cotação, CPF do associado, placa do veículo.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                    <span><strong>Erros urgentes</strong> (sistema fora do ar, pagamento travando): além do relato, avise no canal direto da equipe.</span>
                  </li>
                </ul>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="erro-area">Área <span className="text-destructive">*</span></Label>
            <Input
              id="erro-area"
              value={area}
              maxLength={120}
              onChange={(e) => setArea(e.target.value)}
              placeholder="Ex.: Cobranças, Cadastro, Cotador..."
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="erro-desc">
              Descrição e passo a passo <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="erro-desc"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              maxLength={4000}
              rows={6}
              placeholder="Conte o que você fez até o erro aparecer e o que era esperado..."
            />
            <p className="text-xs text-muted-foreground">{descricao.length}/4000</p>
          </div>

          <div className="space-y-1.5">
            <Label>Anexos do erro (prints ou PDF) <span className="text-destructive">*</span></Label>
            <label
              htmlFor="erro-files"
              className="flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border p-4 text-muted-foreground hover:border-primary hover:text-primary cursor-pointer transition-colors"
            >
              <Upload className="h-5 w-5" />
              <span className="text-sm">Clique para anexar imagens ou PDF (até {MAX_FILES} arquivos, 10MB cada)</span>
              <input
                id="erro-files"
                type="file"
                multiple
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
            </label>
            {files.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Anexe pelo menos 1 arquivo — print da tela é o ideal, mas PDF também é aceito.
              </p>
            )}

            {files.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mt-2">
                {files.map((f, i) => {
                  const isImg = f.type.startsWith('image/');
                  const url = isImg ? URL.createObjectURL(f) : null;
                  return (
                    <div key={i} className="relative group rounded-md border border-border overflow-hidden bg-muted aspect-square">
                      {url ? (
                        <img src={url} alt={f.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full p-2 text-center">
                          <FileText className="h-6 w-6 text-muted-foreground" />
                          <span className="text-[10px] mt-1 truncate w-full">{f.name}</span>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => removeFile(i)}
                        className="absolute top-1 right-1 rounded-full bg-background/90 p-0.5 opacity-0 group-hover:opacity-100 transition"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={create.isPending || !hasImage}>
            {create.isPending ? 'Enviando...' : 'Enviar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
