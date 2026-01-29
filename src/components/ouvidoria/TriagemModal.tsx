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
import { categoriasManifestacao, prioridades, analistasOuvidoria } from "@/constants/ouvidoria";
import type { CategoriaManifestacao, PrioridadeManifestacao } from "@/types/ouvidoria";

interface TriagemModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  manifestacaoId: string;
  manifestacaoProtocolo?: string;
}

const departamentos = [
  { value: "atendimento", label: "Atendimento" },
  { value: "comercial", label: "Comercial" },
  { value: "financeiro", label: "Financeiro" },
  { value: "sinistros", label: "Sinistros" },
  { value: "monitoramento", label: "Monitoramento" },
  { value: "juridico", label: "Jurídico" },
  { value: "diretoria", label: "Diretoria" },
];

export function TriagemModal({
  open,
  onOpenChange,
  manifestacaoId,
  manifestacaoProtocolo,
}: TriagemModalProps) {
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    prioridade: "" as PrioridadeManifestacao | "",
    categoria: "" as CategoriaManifestacao | "",
    departamento: "",
    responsavel_id: "",
    observacao: "",
    notificarAnalista: true,
    enviarConfirmacao: true,
  });

  const handleSubmit = async () => {
    if (!form.prioridade) {
      toast.error("Selecione a prioridade");
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Definir responsável
      let responsavelId = form.responsavel_id;
      if (responsavelId === "eu") {
        responsavelId = user?.id || "";
      }

      // Atualizar manifestação
      const updates: Record<string, unknown> = {
        prioridade: form.prioridade,
        status: "em_analise",
      };

      if (form.categoria) updates.categoria = form.categoria;
      if (form.departamento) updates.departamento = form.departamento;
      if (responsavelId) updates.responsavel_id = responsavelId;

      const { error: updateError } = await supabase
        .from("ouvidoria_manifestacoes")
        .update(updates)
        .eq("id", manifestacaoId);

      if (updateError) throw updateError;

      // Registrar interação
      const { error: interacaoError } = await supabase
        .from("ouvidoria_interacoes")
        .insert({
          manifestacao_id: manifestacaoId,
          usuario_id: user?.id,
          tipo: "encaminhamento",
          mensagem: `Triagem realizada. Prioridade: ${form.prioridade}${form.departamento ? `. Departamento: ${form.departamento}` : ""}${form.observacao ? `. Obs: ${form.observacao}` : ""}`,
          visivel_associado: false,
        });

      if (interacaoError) throw interacaoError;

      queryClient.invalidateQueries({ queryKey: ["ouvidoria"] });
      toast.success("Triagem realizada com sucesso!");
      onOpenChange(false);
      
      // Reset form
      setForm({
        prioridade: "",
        categoria: "",
        departamento: "",
        responsavel_id: "",
        observacao: "",
        notificarAnalista: true,
        enviarConfirmacao: true,
      });
    } catch (error) {
      console.error("Erro na triagem:", error);
      toast.error("Erro ao realizar triagem");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Triagem da Manifestação</DialogTitle>
          <DialogDescription>
            {manifestacaoProtocolo && (
              <span className="font-mono">{manifestacaoProtocolo}</span>
            )}
            {" - "}Classifique e encaminhe para análise
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Prioridade */}
          <div className="space-y-2">
            <Label>Prioridade *</Label>
            <Select
              value={form.prioridade}
              onValueChange={(v) => setForm(prev => ({ ...prev, prioridade: v as PrioridadeManifestacao }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a prioridade" />
              </SelectTrigger>
              <SelectContent>
                {prioridades.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Categoria */}
          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select
              value={form.categoria}
              onValueChange={(v) => setForm(prev => ({ ...prev, categoria: v as CategoriaManifestacao }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a categoria" />
              </SelectTrigger>
              <SelectContent>
                {categoriasManifestacao.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Departamento */}
          <div className="space-y-2">
            <Label>Departamento Envolvido</Label>
            <Select
              value={form.departamento}
              onValueChange={(v) => setForm(prev => ({ ...prev, departamento: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o departamento" />
              </SelectTrigger>
              <SelectContent>
                {departamentos.map((d) => (
                  <SelectItem key={d.value} value={d.value}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Responsável */}
          <div className="space-y-2">
            <Label>Atribuir para</Label>
            <Select
              value={form.responsavel_id}
              onValueChange={(v) => setForm(prev => ({ ...prev, responsavel_id: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o analista" />
              </SelectTrigger>
              <SelectContent>
                {analistasOuvidoria.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Observação */}
          <div className="space-y-2">
            <Label>Observação Interna</Label>
            <Textarea
              value={form.observacao}
              onChange={(e) => setForm(prev => ({ ...prev, observacao: e.target.value }))}
              placeholder="Observações para o analista..."
              rows={3}
            />
          </div>

          {/* Checkboxes */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="notificar"
                checked={form.notificarAnalista}
                onCheckedChange={(checked) => 
                  setForm(prev => ({ ...prev, notificarAnalista: checked as boolean }))
                }
              />
              <label htmlFor="notificar" className="text-sm cursor-pointer">
                Notificar analista por e-mail
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="confirmar"
                checked={form.enviarConfirmacao}
                onCheckedChange={(checked) => 
                  setForm(prev => ({ ...prev, enviarConfirmacao: checked as boolean }))
                }
              />
              <label htmlFor="confirmar" className="text-sm cursor-pointer">
                Enviar confirmação ao manifestante
              </label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Salvando..." : "Confirmar Triagem"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
