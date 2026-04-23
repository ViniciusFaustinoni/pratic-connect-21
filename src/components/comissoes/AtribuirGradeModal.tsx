import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  useAtribuirGrade,
  useGradesAtivas,
  useUpsertHierarquia,
  useUsuariosVendas,
} from '@/hooks/useAtribuicaoComissoes';
import type { AtribuicaoLinha } from '@/types/atribuicaoComissao';

interface AtribuirGradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  linha: AtribuicaoLinha | null;
}

export function AtribuirGradeModal({ open, onOpenChange, linha }: AtribuirGradeModalProps) {
  const { data: grades = [] } = useGradesAtivas();
  const { data: usuarios = [] } = useUsuariosVendas();
  const atribuirGrade = useAtribuirGrade();
  const upsertHierarquia = useUpsertHierarquia();

  const [gradeId, setGradeId] = useState<string>('');
  const [supervisorId, setSupervisorId] = useState<string>('none');
  const [gerenteId, setGerenteId] = useState<string>('none');
  const [agenciaId, setAgenciaId] = useState<string>('none');
  const [observacoes, setObservacoes] = useState<string>('');

  // Reset ao abrir
  const handleOpenChange = (o: boolean) => {
    if (o && linha) {
      setGradeId(linha.gradeAtual?.grade_id || '');
      setSupervisorId(linha.hierarquia?.supervisor_id || 'none');
      setGerenteId(linha.hierarquia?.gerente_id || 'none');
      setAgenciaId(linha.hierarquia?.agencia_id || 'none');
      setObservacoes(linha.hierarquia?.observacoes || '');
    }
    onOpenChange(o);
  };

  if (!linha) return null;

  const supervisores = usuarios.filter((u) => u.roles.includes('supervisor_vendas'));
  const gerentes = usuarios.filter((u) => u.roles.includes('gerente_comercial'));
  const agencias = usuarios.filter((u) => u.roles.includes('agencia'));

  const handleSave = async () => {
    try {
      // 1) Atualizar grade se mudou
      const gradeAtualId = linha.gradeAtual?.grade_id || '';
      if (gradeId && gradeId !== gradeAtualId) {
        await atribuirGrade.mutateAsync({
          user_id: linha.usuario.id,
          grade_id: gradeId,
        });
      }

      // 2) Atualizar hierarquia (a função fecha + reabre só se mudou)
      await upsertHierarquia.mutateAsync({
        vendedor_id: linha.usuario.id,
        supervisor_id: supervisorId === 'none' ? null : supervisorId,
        gerente_id: gerenteId === 'none' ? null : gerenteId,
        agencia_id: agenciaId === 'none' ? null : agenciaId,
        observacoes: observacoes.trim() || null,
      });

      toast.success('Atribuição salva');
      onOpenChange(false);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Erro ao salvar');
    }
  };

  const saving = atribuirGrade.isPending || upsertHierarquia.isPending;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Atribuir grade e hierarquia</DialogTitle>
          <DialogDescription>
            {linha.usuario.nome} — {linha.usuario.roles.join(', ')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label>Grade de Comissão</Label>
            <Select value={gradeId} onValueChange={setGradeId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma grade" />
              </SelectTrigger>
              <SelectContent>
                {grades.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.nome} (v{g.versao})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Supervisor</Label>
              <Select value={supervisorId} onValueChange={setSupervisorId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Nenhum —</SelectItem>
                  {supervisores.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Gerente</Label>
              <Select value={gerenteId} onValueChange={setGerenteId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Nenhum —</SelectItem>
                  {gerentes.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="sm:col-span-2">
              <Label>Agência</Label>
              <Select value={agenciaId} onValueChange={setAgenciaId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Nenhuma —</SelectItem>
                  {agencias.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Observações</Label>
            <Textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Notas sobre essa atribuição (opcional)"
              rows={3}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Mudanças na hierarquia criam um novo registro de vigência. O histórico anterior é
            preservado e usado para gerar comissões corretamente em vendas antigas.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || !gradeId}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
