import { useState } from "react";
import { AlertTriangle, Check, Clock3, Loader2, MapPin, ShieldCheck, UserRound } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

type Props = { navigate: (href: string) => void };
const reasonLabels: Record<string, string> = {
  no_show: "A pessoa não apareceu",
  item_mismatch: "Item diferente do combinado",
  safety: "Segurança",
  harassment: "Mau tratamento ou pressão",
  suspected_fraud: "Suspeita de golpe ou fraude",
  other: "Outro problema",
};

export default function AdminModerationPanel({ navigate }: Props) {
  const utils = trpc.useUtils();
  const [accountReasons, setAccountReasons] = useState<Record<number, string>>({});
  const [reportNotes, setReportNotes] = useState<Record<number, string>>({});
  const queue = trpc.admin.moderationQueue.useQuery(undefined, { refetchInterval: 30_000, refetchOnWindowFocus: true });
  const updateReport = trpc.admin.updateReport.useMutation({
    onSuccess: async () => { await utils.admin.moderationQueue.invalidate(); toast.success("Atualização salva no relato."); },
    onError: (error) => toast.error(error.message),
  });
  const setAccountStatus = trpc.admin.setAccountStatus.useMutation({
    onSuccess: async () => { await Promise.allSettled([utils.admin.moderationQueue.invalidate(), utils.admin.overview.invalidate()]); toast.success("Decisão administrativa registrada."); },
    onError: (error) => toast.error(error.message),
  });

  const changeStatus = (userId: number, status: "active" | "suspended" | "banned") => {
    const reason = accountReasons[userId]?.trim();
    if (!reason || reason.length < 8) { toast.error("Escreva o motivo da decisão antes de continuar."); return; }
    if (status === "banned" && !window.confirm("Bloquear esta conta depois da revisão? A decisão ficará registrada no painel.")) return;
    setAccountStatus.mutate({ userId, status, reason });
  };

  if (queue.isLoading) return <section className="flex justify-center rounded-[26px] border border-[#75142e]/10 bg-white py-12"><Loader2 className="animate-spin text-[#a12c50]" /></section>;
  if (queue.error) return <section className="rounded-[26px] border border-[#75142e]/10 bg-white p-6"><p className="font-extrabold text-[#64142b]">A fila de revisão não carregou.</p><button onClick={() => void queue.refetch()} className="btn-secondary mt-3 px-4 py-2 text-xs">Tentar de novo</button></section>;

  const reports = queue.data?.reports ?? [];
  const cases = queue.data?.cases ?? [];
  const statusLabel = (status: string) => status === "active" ? "Acesso liberado" : status === "suspended" ? "Suspensa" : "Bloqueada";

  return <div className="space-y-7">
    <section className="rounded-[26px] border border-[#75142e]/10 bg-white p-4 shadow-[0_8px_22px_rgba(102,23,48,.04)] sm:p-6">
      <div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#f9e1e8] text-[#861838]"><ShieldCheck size={19} /></span><div><p className="eyebrow">Revisão humana</p><h2 className="mt-1 text-xl font-extrabold text-[#64142b]">Relatos e contas para conferir</h2><p className="mt-2 max-w-3xl text-xs leading-relaxed text-[#805f69]">Duas denúncias em análise ou média abaixo de 2/5 depois de pelo menos 5 avaliações colocam a conta nesta fila. Um retorno dizendo que o encontro não aconteceu ou que o item era diferente também pode pedir atenção. Nada suspende ou bloqueia alguém sozinho: a equipe precisa conferir e registrar o motivo.</p></div></div>
      {cases.length ? <div className="mt-5 space-y-3">{cases.map((item) => <article key={item.userId} className="rounded-2xl border border-[#e7c3cd] bg-[#fff7f6] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3"><div className="flex items-start gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#f9e1e8] text-[#861838]"><UserRound size={17} /></span><div><p className="font-extrabold text-[#64142b]">{item.name}</p><p className="mt-1 text-xs text-[#805f69]">{item.reason}</p><p className="mt-1 text-[11px] font-semibold text-[#986e7b]">{item.averageRating ? `${item.averageRating.toFixed(1)}/5 em ${item.ratingCount} avaliações` : `${item.ratingCount} avaliações`} · ${item.openReportCount} relato(s) em aberto</p></div></div><span className="rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase text-[#7b1532]">{statusLabel(item.accountStatus)}</span></div>
        <label className="form-label mt-4">Motivo da decisão (obrigatório)<textarea value={accountReasons[item.userId] ?? ""} onChange={(event) => setAccountReasons((current) => ({ ...current, [item.userId]: event.target.value }))} rows={2} maxLength={500} placeholder="Registre o que a equipe conferiu e por que decidiu." /></label>
        <div className="mt-3 flex flex-wrap gap-2"><button disabled={setAccountStatus.isPending || item.accountStatus === "active"} onClick={() => changeStatus(item.userId, "active")} className="rounded-full border border-[#9c2a4d]/20 bg-white px-3 py-2 text-[11px] font-extrabold text-[#74142c] disabled:opacity-50">Liberar</button><button disabled={setAccountStatus.isPending || item.accountStatus === "suspended"} onClick={() => changeStatus(item.userId, "suspended")} className="rounded-full border border-[#9c2a4d]/20 bg-white px-3 py-2 text-[11px] font-extrabold text-[#74142c] disabled:opacity-50">Suspender</button><button disabled={setAccountStatus.isPending || item.accountStatus === "banned"} onClick={() => changeStatus(item.userId, "banned")} className="rounded-full bg-[#74102c] px-3 py-2 text-[11px] font-extrabold text-white disabled:opacity-50">Bloquear conta</button></div>
      </article>)}</div> : <div className="mt-5 rounded-2xl border border-dashed border-[#bc4a6b]/30 bg-[#fff7f5] p-6 text-center"><Check className="mx-auto text-[#b22c54]" size={25} /><p className="mt-2 font-extrabold text-[#64142b]">Nenhuma conta precisa de revisão agora.</p></div>}
    </section>

    <section className="rounded-[26px] border border-[#75142e]/10 bg-white p-4 shadow-[0_8px_22px_rgba(102,23,48,.04)] sm:p-6">
      <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#f9e1e8] text-[#861838]"><AlertTriangle size={19} /></span><div><p className="eyebrow">Acompanhar caso a caso</p><h2 className="mt-1 text-xl font-extrabold text-[#64142b]">Relatos recebidos ({reports.length})</h2></div></div>
      {reports.length ? <div className="mt-5 space-y-3">{reports.map((report) => <article key={report.id} className="rounded-2xl border border-[#75142e]/10 bg-[#fffaf8] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wide text-[#a04461]">{reasonLabels[report.reason] || report.reason}</p><p className="mt-1 text-sm font-extrabold text-[#64142b]">{report.reporterName} relatou sobre {report.reportedName}</p><p className="mt-1 text-xs text-[#805f69]">Item: {report.listingTitle} · {new Date(report.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</p></div><span className="rounded-full bg-[#f8dce5] px-3 py-1 text-[10px] font-black uppercase text-[#7b1532]">{report.status === "open" ? "Novo" : "Em análise"}</span></div>
        <p className="mt-3 whitespace-pre-wrap rounded-xl bg-white p-3 text-sm leading-relaxed text-[#674553]">{report.details}</p>
        {report.meeting && <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-[#805f69]"><span className="inline-flex items-center gap-1"><MapPin size={13} />{report.meeting.location}</span><span className="inline-flex items-center gap-1"><Clock3 size={13} />{new Date(report.meeting.scheduledAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span></div>}
        <div className="mt-3 flex flex-wrap gap-2"><button onClick={() => navigate(`/produto/${report.listingId}`)} className="rounded-full border border-[#9c2a4d]/20 bg-white px-3 py-2 text-[11px] font-extrabold text-[#74142c]">Ver conversa</button>{report.status === "open" && <button disabled={updateReport.isPending} onClick={() => updateReport.mutate({ reportId: report.id, status: "under_review", adminNote: reportNotes[report.id] ?? "" })} className="rounded-full border border-[#9c2a4d]/20 bg-white px-3 py-2 text-[11px] font-extrabold text-[#74142c] disabled:opacity-50">Marcar em análise</button>}</div>
        <label className="form-label mt-3">Anotação da equipe (opcional)<textarea value={reportNotes[report.id] ?? ""} onChange={(event) => setReportNotes((current) => ({ ...current, [report.id]: event.target.value }))} rows={2} maxLength={1000} placeholder="Registre uma observação interna." /></label>
        <div className="mt-3 flex flex-wrap gap-2"><button disabled={updateReport.isPending} onClick={() => updateReport.mutate({ reportId: report.id, status: "resolved", adminNote: reportNotes[report.id] ?? "" })} className="rounded-full bg-[#74102c] px-3 py-2 text-[11px] font-extrabold text-white disabled:opacity-50">Encerrar após revisar</button><button disabled={updateReport.isPending} onClick={() => updateReport.mutate({ reportId: report.id, status: "rejected", adminNote: reportNotes[report.id] ?? "" })} className="rounded-full border border-[#9c2a4d]/20 bg-white px-3 py-2 text-[11px] font-extrabold text-[#74142c] disabled:opacity-50">Encerrar sem ação</button></div>
      </article>)}</div> : <p className="mt-5 rounded-2xl bg-[#fff7f5] p-5 text-sm text-[#805f69]">Nenhum relato aberto. Se alguém enviar um, ele aparece aqui.</p>}
    </section>
    <p className="flex items-start gap-2 text-[11px] leading-relaxed text-[#947781]"><AlertTriangle size={14} className="mt-0.5 shrink-0" />A fila ajuda a equipe a decidir, mas não confirma automaticamente fraude ou culpa. A equipe deve analisar o contexto, registrar o motivo e seguir as regras aplicáveis.</p>
  </div>;
}
