import { useMemo, useState, type FormEvent } from "react";
import { AlertTriangle, CalendarClock, Check, Clock3, Loader2, MapPin, MessageSquareWarning, ShieldCheck, Star } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

type Props = {
  proposalId: number;
  listingId: number;
  listingTitle: string;
  isOwner: boolean;
  proposalStatus: string;
  onChanged?: () => void;
};

const reasonLabels: Record<string, string> = {
  no_show: "A pessoa não apareceu",
  item_mismatch: "O item era diferente do combinado",
  safety: "Não me senti segura",
  harassment: "A pessoa me tratou mal ou me pressionou",
  suspected_fraud: "Suspeita de golpe ou fraude",
  other: "Outro problema",
};

function localDateTimeMinimum() {
  const date = new Date(Date.now() + 60 * 60_000);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function formatDate(date: Date | string) {
  return new Date(date).toLocaleString("pt-BR", { dateStyle: "full", timeStyle: "short" });
}

export default function SwapWorkflow({ proposalId, listingId, listingTitle, isOwner, proposalStatus, onChanged }: Props) {
  const utils = trpc.useUtils();
  const [showMeetingForm, setShowMeetingForm] = useState(false);
  const [location, setLocation] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [rating, setRating] = useState(5);
  const [met, setMet] = useState(true);
  const [itemMatched, setItemMatched] = useState(true);
  const [comment, setComment] = useState("");
  const [reason, setReason] = useState("other");
  const [details, setDetails] = useState("");
  const [showReportForm, setShowReportForm] = useState(false);
  const dateMin = useMemo(localDateTimeMinimum, []);

  const meeting = trpc.marketplace.exchange.meetings.get.useQuery({ proposalId }, { refetchInterval: 5000 });
  const review = trpc.marketplace.exchange.reviews.forProposal.useQuery({ proposalId }, { enabled: proposalStatus === "completed" });
  const report = trpc.marketplace.exchange.reports.status.useQuery({ proposalId }, { refetchInterval: 30_000 });

  const refresh = async () => {
    await Promise.allSettled([
      meeting.refetch(),
      review.refetch(),
      report.refetch(),
      utils.marketplace.listings.list.invalidate(),
      utils.marketplace.listings.byId.invalidate({ id: listingId }),
      utils.marketplace.proposals.mine.invalidate(),
      utils.notifications.mine.invalidate(),
    ]);
    onChanged?.();
  };

  const proposeMeeting = trpc.marketplace.exchange.meetings.propose.useMutation({
    onSuccess: async () => {
      setLocation("");
      setScheduledAt("");
      setShowMeetingForm(false);
      toast.success("Sugestão enviada! Agora a outra pessoa precisa confirmar.");
      await refresh();
    },
    onError: (error) => toast.error(error.message),
  });
  const respondMeeting = trpc.marketplace.exchange.meetings.respond.useMutation({
    onSuccess: async (result) => {
      toast.success(result.confirmed ? "Encontro confirmado! Os anúncios ficaram reservados." : "Confirmação salva.");
      await refresh();
    },
    onError: (error) => toast.error(error.message),
  });
  const submitReview = trpc.marketplace.exchange.reviews.submit.useMutation({
    onSuccess: async () => {
      toast.success("Seu retorno foi salvo. As duas avaliações aparecem quando ambos avaliarem.");
      await refresh();
    },
    onError: (error) => toast.error(error.message),
  });
  const submitReport = trpc.marketplace.exchange.reports.create.useMutation({
    onSuccess: async () => {
      setDetails("");
      setShowReportForm(false);
      toast.success("Seu relato foi enviado só para a equipe Trocaí revisar.");
      await refresh();
    },
    onError: (error) => toast.error(error.message),
  });
  const cancelSwap = trpc.marketplace.exchange.meetings.cancel.useMutation({
    onSuccess: async () => { toast.success("Troca encerrada. Os anúncios foram liberados de volta."); await refresh(); },
    onError: (error) => toast.error(error.message),
  });

  const submitMeeting = (event: FormEvent) => {
    event.preventDefault();
    if (!location.trim() || !scheduledAt) {
      toast.error("Preencha o local e o horário do encontro.");
      return;
    }
    proposeMeeting.mutate({ proposalId, location: location.trim(), scheduledAt: new Date(scheduledAt) });
  };

  const current = meeting.data?.current;
  const myAcceptedAt = current ? (isOwner ? current.ownerAcceptedAt : current.proposerAcceptedAt) : null;
  const otherAcceptedAt = current ? (isOwner ? current.proposerAcceptedAt : current.ownerAcceptedAt) : null;
  const canRespond = current?.status === "proposed" && !myAcceptedAt;
  const completed = proposalStatus === "completed";

  return (
    <section className="space-y-4 border-t border-[#75142e]/10 bg-[#fffaf8] p-4 sm:p-5">
      {proposalStatus === "accepted" && (
        <div className="rounded-[22px] border border-[#d96f8b]/20 bg-white p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#f9e1e8] text-[#861838]"><CalendarClock size={20} /></span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black uppercase tracking-[.12em] text-[#a04461]">Próximo passo</p>
              <h3 className="mt-1 text-lg font-extrabold text-[#64142b]">Marquem onde e quando trocar.</h3>
              <p className="mt-1 text-sm leading-relaxed text-[#805f69]">Uma pessoa sugere o lugar e o horário; a outra confirma ou sugere outro. Só fica combinado quando as duas aceitarem.</p>
            </div>
          </div>

          {meeting.isLoading ? <div className="flex justify-center py-5"><Loader2 className="animate-spin text-[#a12c50]" /></div> : current ? (
            <div className="mt-4 rounded-2xl bg-[#fff2f4] p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wide ${current.status === "confirmed" ? "bg-[#74102c] text-white" : "bg-[#f9dce5] text-[#7b1532]"}`}>
                  {current.status === "confirmed" ? "Encontro confirmado" : "Aguardando confirmação"}
                </span>
                {current.status === "confirmed" && <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-[#7b1532]"><Check size={13} /> Itens reservados</span>}
              </div>
              <p className="mt-3 flex items-start gap-2 text-sm font-extrabold text-[#64142b]"><MapPin size={16} className="mt-0.5 shrink-0 text-[#b52a55]" />{current.location}</p>
              <p className="mt-2 flex items-start gap-2 text-sm font-semibold text-[#805f69]"><Clock3 size={15} className="mt-0.5 shrink-0 text-[#b52a55]" />{formatDate(current.scheduledAt)}</p>
              {current.status === "proposed" && <p className="mt-3 text-xs leading-relaxed text-[#805f69]">{myAcceptedAt ? "Você já confirmou esse horário." : "Você ainda precisa confirmar esse horário."} {otherAcceptedAt ? "A outra pessoa já confirmou." : "A outra pessoa ainda não confirmou."}</p>}
              {canRespond && <button type="button" disabled={respondMeeting.isPending} onClick={() => respondMeeting.mutate({ proposalId })} className="btn-primary mt-3 inline-flex items-center gap-2 px-4 py-2.5 text-xs disabled:opacity-60"><Check size={15} /> Confirmar encontro</button>}
              <button type="button" onClick={() => setShowMeetingForm((visible) => !visible)} className="ml-2 mt-3 inline-flex items-center gap-2 rounded-full border border-[#a12c50]/20 bg-white px-4 py-2.5 text-xs font-extrabold text-[#851536] hover:bg-[#fff7f6]">{current.status === "confirmed" ? "Sugerir outro horário" : "Sugerir outro horário"}</button>
              {current.status === "confirmed" && <p className="mt-3 text-[11px] leading-relaxed text-[#85636e]">Se alguém sugerir outro horário, o encontro volta a aguardar a confirmação das duas pessoas. Os itens continuam reservados.</p>}
              <button type="button" disabled={cancelSwap.isPending} onClick={() => { if (window.confirm("Encerrar a troca? Os anúncios voltam ao estado anterior e a conversa fica registrada.")) cancelSwap.mutate({ proposalId }); }} className="mt-4 rounded-full border border-[#a12c50]/20 bg-white px-4 py-2 text-xs font-extrabold text-[#851536] disabled:opacity-50">Encerrar esta troca</button>
            </div>
          ) : (
            <button type="button" onClick={() => setShowMeetingForm((visible) => !visible)} className="btn-primary mt-4 inline-flex items-center gap-2 px-4 py-2.5 text-sm"><CalendarClock size={16} /> Criar encontro</button>
          )}
          {!current && <button type="button" disabled={cancelSwap.isPending} onClick={() => { if (window.confirm("Encerrar a troca? A conversa fica registrada e os anúncios voltam ao estado anterior.")) cancelSwap.mutate({ proposalId }); }} className="mt-4 block rounded-full border border-[#a12c50]/20 bg-white px-4 py-2 text-xs font-extrabold text-[#851536] disabled:opacity-50">Encerrar esta troca</button>}

          {showMeetingForm && <form onSubmit={submitMeeting} className="mt-4 space-y-3 rounded-2xl border border-[#75142e]/10 bg-[#fffaf8] p-4">
            <label className="form-label">Lugar público para se encontrar<input value={location} onChange={(event) => setLocation(event.target.value)} required maxLength={255} placeholder="Ex.: café no centro ou entrada do shopping" /></label>
            <label className="form-label">Dia e horário<input type="datetime-local" min={dateMin} value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} required /></label>
            <p className="flex items-start gap-2 rounded-xl bg-[#fff0f3] p-3 text-[11px] leading-relaxed text-[#73364a]"><ShieldCheck size={15} className="mt-0.5 shrink-0" />Prefiram um local público e não coloquem endereço de casa. O local e o horário ficam salvos no histórico desta troca, visíveis aos participantes e à equipe em caso de relato. Esse registro não é um boletim de ocorrência nem garante resultado jurídico. Se você for menor de idade, combine com um responsável de confiança.</p>
            <div className="flex flex-wrap gap-2"><button disabled={proposeMeeting.isPending} className="btn-primary inline-flex items-center gap-2 px-4 py-2.5 text-xs disabled:opacity-60">{proposeMeeting.isPending && <Loader2 size={14} className="animate-spin" />}Enviar sugestão</button><button type="button" onClick={() => setShowMeetingForm(false)} className="rounded-full border border-[#8d304c]/20 bg-white px-4 py-2.5 text-xs font-extrabold text-[#71152f]">Voltar</button></div>
          </form>}
          {current?.status === "confirmed" && <p className="mt-3 rounded-xl bg-[#f8dce5] p-3 text-xs leading-relaxed text-[#6d1833]">O anúncio de “{listingTitle}” está reservado e continua visível como “Encontro marcado”.{current && ""} Se você vinculou um anúncio próprio ao enviar a proposta, ele também está reservado.</p>}
        </div>
      )}

      {completed && (
        <div className="rounded-[22px] border border-[#d96f8b]/20 bg-white p-4 sm:p-5">
          <div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#f9e1e8] text-[#861838]"><Star size={20} /></span><div><p className="text-xs font-black uppercase tracking-[.12em] text-[#a04461]">Como foi a troca?</p><h3 className="mt-1 text-lg font-extrabold text-[#64142b]">Seu retorno ajuda todo mundo.</h3><p className="mt-1 text-sm text-[#805f69]">A avaliação só aparece para os outros depois que as duas pessoas responderem.</p></div></div>
          {review.isLoading ? <div className="flex justify-center py-5"><Loader2 className="animate-spin text-[#a12c50]" /></div> : review.data?.myReview ? (
            <div className="mt-4 rounded-2xl bg-[#fff2f4] p-4">
              <p className="text-sm font-extrabold text-[#64142b]">Seu retorno foi salvo.</p>
              {review.data.otherReview ? <div className="mt-3 border-t border-[#75142e]/10 pt-3"><p className="text-xs font-black uppercase tracking-wide text-[#a04461]">Avaliação da outra pessoa</p><p className="mt-2 inline-flex items-center gap-1 text-sm font-extrabold text-[#64142b]">{Array.from({ length: 5 }, (_, index) => <Star key={index} size={15} fill={index < review.data!.otherReview!.rating ? "currentColor" : "none"} />)}<span className="ml-1">{review.data.otherReview.rating}/5</span></p><p className="mt-2 text-xs text-[#805f69]">{review.data.otherReview.met ? "Vocês se encontraram" : "O encontro não aconteceu"} · {review.data.otherReview.itemMatched ? "Item como combinado" : "Item diferente do combinado"}</p>{review.data.otherReview.comment && <p className="mt-2 text-sm text-[#805f69]">“{review.data.otherReview.comment}”</p>}</div> : <p className="mt-2 text-xs text-[#805f69]">Estamos esperando a outra pessoa avaliar. Depois disso, as duas avaliações ficam visíveis.</p>}
            </div>
          ) : (
            <form onSubmit={(event) => { event.preventDefault(); submitReview.mutate({ proposalId, rating, met, itemMatched, comment: comment.trim() }); }} className="mt-4 space-y-4 rounded-2xl bg-[#fff7f6] p-4">
              <div><p className="text-xs font-extrabold text-[#64142b]">Que nota você dá para a experiência?</p><div className="mt-2 flex gap-1">{[1, 2, 3, 4, 5].map((value) => <button type="button" key={value} onClick={() => setRating(value)} aria-label={`${value} de 5 estrelas`} className="rounded-lg p-1 text-[#c44b6b] hover:bg-[#f9e1e8]"><Star size={24} fill={value <= rating ? "currentColor" : "none"} /></button>)}</div></div>
              <div className="grid gap-3 sm:grid-cols-2"><label className="form-label">Vocês se encontraram?<select value={met ? "yes" : "no"} onChange={(event) => setMet(event.target.value === "yes")}><option value="yes">Sim</option><option value="no">Não</option></select></label><label className="form-label">O item estava como combinado?<select value={itemMatched ? "yes" : "no"} onChange={(event) => setItemMatched(event.target.value === "yes")}><option value="yes">Sim</option><option value="no">Não</option></select></label></div>
              <label className="form-label">Quer deixar um comentário? (opcional)<textarea value={comment} onChange={(event) => setComment(event.target.value)} maxLength={1000} rows={3} placeholder="Conte como foi, com respeito." /></label>
              {(!met || !itemMatched) && <p className="flex items-start gap-2 rounded-xl bg-[#fff0f3] p-3 text-[11px] leading-relaxed text-[#73364a]"><AlertTriangle size={15} className="mt-0.5 shrink-0" />Sua resposta será sinalizada para a equipe revisar. Ela não suspende nem bloqueia ninguém automaticamente.</p>}
              <button disabled={submitReview.isPending} className="btn-primary inline-flex items-center gap-2 px-4 py-2.5 text-xs disabled:opacity-60">{submitReview.isPending && <Loader2 size={14} className="animate-spin" />}Enviar avaliação</button>
            </form>
          )}
        </div>
      )}

      {proposalStatus === "cancelled" && <div className="rounded-[22px] bg-[#fff2f4] p-4"><p className="font-extrabold text-[#64142b]">Esta troca foi encerrada.</p><p className="mt-1 text-xs leading-relaxed text-[#805f69]">Os anúncios voltaram ao estado anterior. Se aconteceu algo que você queira contar, ainda dá para enviar um relato privado para a equipe.</p></div>}

      {(proposalStatus === "accepted" || completed || proposalStatus === "cancelled") && (
        <div className="rounded-[22px] border border-[#e4b9c5]/50 bg-white p-4">
          <div className="flex items-start gap-3"><MessageSquareWarning size={19} className="mt-0.5 shrink-0 text-[#a12c50]" /><div className="flex-1"><p className="text-sm font-extrabold text-[#64142b]">Algo deu errado?</p><p className="mt-1 text-xs leading-relaxed text-[#805f69]">Você pode contar à equipe Trocaí. O relato fica privado e será revisado por uma pessoa; uma denúncia ou nota, sozinha, não bloqueia ninguém.</p></div></div>
          {report.data ? <p className="mt-3 rounded-xl bg-[#fff2f4] p-3 text-xs font-semibold text-[#6d1833]">Seu relato foi recebido · {report.data.status === "open" ? "aguardando revisão" : report.data.status === "under_review" ? "em análise pela equipe" : report.data.status === "resolved" ? "revisado" : "revisado e encerrado"}.</p> : !showReportForm ? <button type="button" onClick={() => setShowReportForm(true)} className="mt-3 rounded-full border border-[#a12c50]/20 bg-[#fff7f6] px-4 py-2.5 text-xs font-extrabold text-[#851536]">Relatar um problema</button> : (
            <form onSubmit={(event) => { event.preventDefault(); submitReport.mutate({ proposalId, reason: reason as "no_show" | "item_mismatch" | "safety" | "harassment" | "suspected_fraud" | "other", details: details.trim() }); }} className="mt-3 space-y-3">
              <label className="form-label">O que aconteceu?<select value={reason} onChange={(event) => setReason(event.target.value)}>{Object.entries(reasonLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label className="form-label">Conte só o necessário<textarea value={details} onChange={(event) => setDetails(event.target.value)} required minLength={10} maxLength={2000} rows={4} placeholder="Se puder, explique o que aconteceu e quando." /></label>
              <p className="text-[11px] leading-relaxed text-[#805f69]">O relato e o combinado de encontro podem ajudar a equipe a entender o caso. Se estiver em perigo imediato, procure os serviços de emergência; o Trocaí não é um serviço de emergência.</p>
              <div className="flex flex-wrap gap-2"><button disabled={submitReport.isPending} className="btn-primary inline-flex items-center gap-2 px-4 py-2.5 text-xs disabled:opacity-60">{submitReport.isPending && <Loader2 size={14} className="animate-spin" />}Enviar só para a equipe</button><button type="button" onClick={() => setShowReportForm(false)} className="rounded-full border border-[#8d304c]/20 bg-white px-4 py-2.5 text-xs font-extrabold text-[#71152f]">Voltar</button></div>
            </form>
          )}
        </div>
      )}
    </section>
  );
}
