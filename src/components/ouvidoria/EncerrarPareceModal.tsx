import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { procedenciaOptions } from "@/constants/ouvidoria";

interface EncerrarPareceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  manifestacaoId: string;
  manifestacaoProtocolo?: string;
}

const acoesCorretivas = [
  { id: "treinamento", label: "Treinamento da equipe" },
  { id: "processo", label: "Revisão de processo" },
  { id: "sistema", label: "Ajuste em sistema" },
  { id: "comunicacao", label: "Melhoria na comunicação" },
  { id: "politica", label: "Revisão de política" },
  { id: "feedback", label: "Feedback ao colaborador" },
];

export function EncerrarPareceModal({
  open,
  onOpenChange,
  manifestacaoId,
  manifestacaoProtocolo,
}: EncerrarPareceModalProps) {
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    procedencia: "",
    parecer: "",
    respostaManifestante: "",
    acoesCorretivas: [] as string[],
    enviarPesquisa: true,
  });

  const toggleAcao = (acaoId: string) => {
    setForm(prev => ({
      ...prev,
      acoesCorretivas: prev.acoesCorretivas.includes(acaoId)
        ? prev.acoesCorretivas.filter(a => a !== acaoId)
        : [...prev.acoesCorretivas, acaoId]
    }));
  };

  const handleSubmit = async () => {
    if (!form.procedencia) {
      toast.error("Informe se a manifestação é procedente");
      return;
    }

    if (!form.parecer) {
      toast.error("Preencha o parecer final");
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Atualizar manifestação
      const { error: updateError } = await supabase
        .from("ouvidoria_manifestacoes")
        .update({
          status: "encerrado",
          data_encerramento: new Date().toISOString(),
        })
        .eq("id", manifestacaoId);

      if (updateError) throw updateError;

      // Registrar parecer como interação interna
      const parecerCompleto = `
**PARECER FINAL**

Procedência: ${procedenciaOptions.find(p => p.value === form.procedencia)?.label}

Parecer Interno:
${form.parecer}

${form.acoesCorretivas.length > 0 ? `Ações Corretivas:
${form.acoesCorretivas.map(a => `- ${acoesCorretivas.find(ac => ac.id === a)?.label}`).join('\n')}` : ''}
      `.trim();

      const { error: parecerError } = await supabase
        .from("ouvidoria_interacoes")
        .insert({
          manifestacao_id: manifestacaoId,
          usuario_id: user?.id,
          tipo: "nota_interna",
          mensagem: parecerCompleto,
          visivel_associado: false,
        });

      if (parecerError) throw parecerError;

      // Registrar resposta ao manifestante se houver
      if (form.respostaManifestante) {
        const { error: respostaError } = await supabase
          .from("ouvidoria_interacoes")
          .insert({
            manifestacao_id: manifestacaoId,
            usuario_id: user?.id,
            tipo: "resposta_interna",
            mensagem: `**Encerramento da Manifestação**\n\n${form.respostaManifestante}`,
            visivel_associado: true,
          });

        if (respostaError) throw respostaError;
      }

      // Registrar mudança de status
      const { error: statusError } = await supabase
        .from("ouvidoria_interacoes")
        .insert({
          manifestacao_id: manifestacaoId,
          usuario_id: user?.id,
          tipo: "status_change",
          mensagem: "Manifestação encerrada com parecer final.",
          visivel_associado: true,
        });

      if (statusError) throw statusError;

      queryClient.invalidateQueries({ queryKey: ["ouvidoria"] });
      toast.success("Manifestação encerrada com sucesso!");
      
      if (form.enviarPesquisa) {
        toast.info("Link da pesquisa de satisfação será enviado ao manifestante.");
      }

      onOpenChange(false);
      
      // Reset form
      setForm({
        procedencia: "",
        parecer: "",
        respostaManifestante: "",
        acoesCorretivas: [],
        enviarPesquisa: true,
      });
    } catch (error) {
      console.error("Erro ao encerrar:", error);
      toast.error("Erro ao encerrar manifestação");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Encerrar com Parecer</DialogTitle>
          <DialogDescription>
            {manifestacaoProtocolo && (
              <span className="font-mono">{manifestacaoProtocolo}</span>
            )}
            {" - "}Registre o parecer final e encerre a manifestação
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Procedência */}
          <div className="space-y-2">
            <Label>A manifestação é procedente? *</Label>
            <Select
              value={form.procedencia}
              onValueChange={(v) => setForm(prev => ({ ...prev, procedencia: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {procedenciaOptions.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Parecer Interno */}
          <div className="space-y-2">
            <Label>Parecer Final (uso interno) *</Label>
            <Textarea
              value={form.parecer}
              onChange={(e) => setForm(prev => ({ ...prev, parecer: e.target.value }))}
              placeholder="Descreva a análise e conclusões internas sobre a manifestação..."
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              Este parecer não será visível ao manifestante
            </p>
          </div>

          {/* Resposta ao Manifestante */}
          <div className="space-y-2">
            <Label>Resposta ao Manifestante</Label>
            <Textarea
              value={form.respostaManifestante}
              onChange={(e) => setForm(prev => ({ ...prev, respostaManifestante: e.target.value }))}
              placeholder="Mensagem de retorno que será enviada ao manifestante..."
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              Esta mensagem será visível ao manifestante
            </p>
          </div>

          {/* Ações Corretivas */}
          <div className="space-y-3">
            <Label>Ações Corretivas Aplicadas</Label>
            <div className="grid grid-cols-2 gap-2">
              {acoesCorretivas.map((acao) => (
                <div key={acao.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={acao.id}
                    checked={form.acoesCorretivas.includes(acao.id)}
                    onCheckedChange={() => toggleAcao(acao.id)}
                  />
                  <label htmlFor={acao.id} className="text-sm cursor-pointer">
                    {acao.label}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Enviar Pesquisa */}
          <div className="flex items-center space-x-2 p-4 bg-blue-50 rounded-lg">
            <Checkbox
              id="pesquisa"
              checked={form.enviarPesquisa}
              onCheckedChange={(checked) => 
                setForm(prev => ({ ...prev, enviarPesquisa: checked as boolean }))
              }
            />
            <label htmlFor="pesquisa" className="text-sm cursor-pointer">
              Enviar pesquisa de satisfação ao manifestante (24h após encerramento)
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting}
            className="bg-green-600 hover:bg-green-700"
          >
            {isSubmitting ? "Encerrando..." : "Encerrar Manifestação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
