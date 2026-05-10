import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  PartyPopper,
  Shield,
  Eye,
  EyeOff,
  Check,
  X,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { publicSupabase } from "@/integrations/supabase/publicClient";

interface Props {
  token: string;
  numeroCotacao: string;
  cpf?: string | null;
  email?: string | null;
}

function mascararCpfEmail(cpf?: string | null) {
  const digits = String(cpf || "").replace(/\D/g, "");
  if (!digits) return "—";
  if (digits.length < 6) return `${digits}@n.com.br`;
  const masked = `${digits.slice(0, 3)}***${digits.slice(-2)}`;
  return `${masked}@n.com.br`;
}

function loginPreview(email?: string | null, cpf?: string | null) {
  const e = (email || "").trim().toLowerCase();
  if (e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && !e.endsWith("@n.com.br")) {
    return e;
  }
  return mascararCpfEmail(cpf);
}

function Req({ ok, texto }: { ok: boolean; texto: string }) {
  return (
    <div
      className={`flex items-center gap-1.5 text-xs ${
        ok ? "text-success" : "text-muted-foreground"
      }`}
    >
      {ok ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
      <span>{texto}</span>
    </div>
  );
}

export function EtapaCriacaoSenhaCotacao({ token, numeroCotacao, cpf, email }: Props) {
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [showSenha, setShowSenha] = useState(false);
  const [showConf, setShowConf] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [sucesso, setSucesso] = useState<{ email: string; alreadyExisted: boolean; emailOrigem?: string } | null>(
    null,
  );

  const temMin = senha.length >= 8;
  const temMaiu = /[A-Z]/.test(senha);
  const temMinu = /[a-z]/.test(senha);
  const temNum = /[0-9]/.test(senha);
  const iguais = senha.length > 0 && senha === confirmar;
  const valido = temMin && temMaiu && temMinu && temNum && iguais;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valido || salvando) return;
    setSalvando(true);
    try {
      const { data, error } = await publicSupabase.functions.invoke(
        "cotacao-criar-senha",
        { body: { token, senha } },
      );
      if (error) throw error;
      if (!data?.success) {
        throw new Error(data?.error || "Erro ao criar senha");
      }
      toast.success(
        data.already_existed ? "Senha atualizada!" : "Senha criada com sucesso!",
      );
      setSucesso({
        email: data.email,
        alreadyExisted: !!data.already_existed,
        emailOrigem: data.email_origem,
      });
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Erro ao criar senha");
    } finally {
      setSalvando(false);
    }
  };

  if (sucesso) {
    const loginUrl = `https://app.praticcar.org/app/login?email=${encodeURIComponent(
      sucesso.email,
    )}`;
    return (
      <div className="dark min-h-screen public-premium-bg flex items-center justify-center p-4">
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/3 w-96 h-96 rounded-full bg-success/10 blur-[120px]" />
        </div>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 w-full max-w-md"
        >
          <Card className="border-success/30 bg-card/80 backdrop-blur-xl">
            <CardContent className="pt-8 pb-8 text-center space-y-5">
              <div className="w-20 h-20 mx-auto rounded-full bg-success/10 flex items-center justify-center">
                <Check className="h-10 w-10 text-success" />
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-bold">Tudo pronto!</h1>
                <p className="text-muted-foreground text-sm">
                  Use o e-mail abaixo e a senha que você acabou de criar para
                  entrar no app.
                </p>
              </div>
              <div className="rounded-md border border-border/50 bg-muted/30 p-3 text-sm font-mono break-all">
                {sucesso.email}
              </div>
              {sucesso.emailOrigem === "fallback_cpf" && (
                <p className="text-xs text-muted-foreground">
                  Não foi possível usar seu e-mail como login. Usamos seu CPF.
                </p>
              )}
              <a
                href={loginUrl}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Shield className="h-4 w-4" />
                Acessar meu app de associado
              </a>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="dark min-h-screen public-premium-bg flex items-center justify-center p-4">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/3 w-96 h-96 rounded-full bg-success/10 blur-[120px]" />
        <div className="absolute bottom-1/3 right-1/4 w-72 h-72 rounded-full bg-primary/10 blur-[100px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="relative z-10 w-full max-w-md"
      >
        <Card className="border-success/30 bg-card/80 backdrop-blur-xl">
          <CardContent className="pt-8 pb-8 space-y-5">
            <div className="text-center space-y-3">
              <div className="w-16 h-16 mx-auto rounded-full bg-success/10 flex items-center justify-center">
                <PartyPopper className="h-8 w-8 text-success" />
              </div>
              <h1 className="text-2xl font-bold">Proteção ativada!</h1>
              <p className="text-sm text-muted-foreground">
                Para finalizar, crie a senha de acesso ao seu app de associado.
              </p>
              <Badge
                variant="outline"
                className="text-sm px-4 py-1 border-success/30 text-success"
              >
                {numeroCotacao}
              </Badge>
            </div>

            <div className="rounded-md border border-border/50 bg-muted/20 p-3 text-xs">
              <p className="text-muted-foreground">Seu login será:</p>
              <p className="font-mono mt-1 break-all">{loginPreview(email, cpf)}</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Crie sua senha</label>
                <div className="relative">
                  <Input
                    type={showSenha ? "text" : "password"}
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    disabled={salvando}
                    className="pr-10"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowSenha((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {showSenha ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <Req ok={temMin} texto="Mínimo 8 caracteres" />
                <Req ok={temMaiu} texto="Uma maiúscula" />
                <Req ok={temMinu} texto="Uma minúscula" />
                <Req ok={temNum} texto="Um número" />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Confirmar senha</label>
                <div className="relative">
                  <Input
                    type={showConf ? "text" : "password"}
                    value={confirmar}
                    onChange={(e) => setConfirmar(e.target.value)}
                    placeholder="Repita a senha"
                    disabled={salvando}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConf((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {showConf ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {confirmar.length > 0 && !iguais && (
                  <p className="text-xs text-destructive">
                    As senhas não coincidem
                  </p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={!valido || salvando}
              >
                {salvando ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Criando...
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4 mr-2" />
                    Criar senha e ativar acesso
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
