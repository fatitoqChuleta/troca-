import { AlertTriangle, ArrowLeft, Check, FileText, LockKeyhole, ShieldCheck } from "lucide-react";
import { CURRENT_TERMS_VERSION } from "@shared/const";

export type PoliciesPageProps = {
  requireAcceptance: boolean;
  authenticated: boolean;
  checked: boolean;
  pending: boolean;
  statusLoading: boolean;
  statusError: boolean;
  acceptedAt?: Date | null;
  onCheckedChange: (checked: boolean) => void;
  onAccept: () => void;
  onLogin: () => void;
  onLogout: () => void;
  onRetry: () => void;
  onBack: () => void;
};

const policySections = [
  {
    title: "1. O que é o Trocaí",
    body: "O Trocaí aproxima pessoas que querem trocar objetos. A troca pode ser direta ou passar por outras pessoas, em uma cadeia. Não é loja: o Trocaí não compra, não vende, não recebe dinheiro e não entrega os objetos por você.",
  },
  {
    title: "2. O que cada pessoa combina",
    body: "Quem anuncia deve descrever o item com honestidade, usar fotos que mostrem o objeto real e informar seu estado e o que procura. Só anuncie algo que seja seu ou que você tenha autorização para trocar. Cada pessoa precisa conferir o que está oferecendo e combinar no chat o que será entregue, onde e quando.",
  },
  {
    title: "3. Segurança na troca",
    body: "Marquem em um local público e movimentado. Confiram os dois itens juntos e abram qualquer caixa ou embalagem antes de entregar o item de vocês. Se a descrição ou as fotos não combinarem com o objeto, se alguém impedir a conferência ou se algo parecer suspeito, não concluam. Se você tiver menos de 18 anos, não vá sozinha: peça que uma pessoa adulta de confiança acompanhe e não compartilhe endereço ou escola. A conversa pode continuar no site enquanto a proposta estiver aberta.",
  },
  {
    title: "4. O papel do Trocaí e os limites deste aviso",
    body: "O Trocaí oferece ferramentas para publicar anúncios, encontrar combinações e conversar. A equipe não participa da entrega e não inspeciona os objetos. Por isso, a plataforma não garante que um item corresponda às fotos ou à descrição, nem que uma troca esteja livre de fraude ou golpe. Isso não significa que direitos ou responsabilidades previstos em lei sejam eliminados: o alcance desta cláusula precisa de revisão jurídica antes da publicação definitiva.",
  },
  {
    title: "5. Sua conta e seus dados",
    body: "Para a conta funcionar, o serviço recebe dados básicos do provedor de login, como nome, e-mail e um identificador de conta. O Trocaí também guarda as informações dos anúncios, fotos, região informada, propostas, mensagens e avisos. Os dados dos anúncios aparecem para outras pessoas; as conversas ficam disponíveis às duas pessoas daquela proposta e podem ser acessadas por quem administra o serviço quando necessário para operação e segurança. A hospedagem e o login também podem envolver prestadores técnicos.",
  },
  {
    title: "6. Pedidos sobre seus dados e contato",
    body: "A pessoa usuária pode pedir informações, correção ou exclusão de dados nos casos previstos em lei. O responsável pelo serviço, o canal de atendimento, os prazos de resposta e as regras de retenção ainda precisam ser preenchidos e revisados antes da versão definitiva. Contato/privacidade: [PREENCHER E-MAIL PÚBLICO]. Responsável legal: [PREENCHER NOME OU RAZÃO SOCIAL E DADOS EXIGIDOS].",
  },
  {
    title: "7. Conteúdo e comportamento",
    body: "Não publique itens ilegais, roubados, falsificados ou que ofereçam risco; não engane outras pessoas, não use fotos de um objeto diferente e não pressione ninguém a concluir uma troca. O Trocaí pode precisar ocultar conteúdo ou limitar contas que desrespeitem as regras, sempre observando a legislação aplicável. O procedimento de denúncia e atendimento ainda deve ser definido.",
  },
  {
    title: "8. Confirmação de uma troca",
    body: "A troca só aparece como concluída depois que as duas pessoas confirmam. A confirmação deve ser feita depois de conferir os objetos e a entrega. Se algo estiver errado, não confirme: volte atrás e mantenha os registros da conversa e do anúncio.",
  },
  {
    title: "9. Mudanças nesta minuta",
    body: "Esta é a versão provisória 2026-09-28-v1. Ela precisa de revisão profissional no Brasil, especialmente sobre identificação do operador, privacidade, atendimento, denúncias, retenção de dados, regras para menores e limites de responsabilidade. Quando houver uma versão nova, o Trocaí poderá pedir um novo aceite.",
  },
];

export default function PoliciesPage({
  requireAcceptance,
  authenticated,
  checked,
  pending,
  statusLoading,
  statusError,
  acceptedAt,
  onCheckedChange,
  onAccept,
  onLogin,
  onLogout,
  onRetry,
  onBack,
}: PoliciesPageProps) {
  return (
    <section className="mx-auto max-w-[980px] px-4 py-8 sm:px-6 sm:py-12">
      {!requireAcceptance && <button onClick={onBack} className="mb-5 inline-flex items-center gap-2 text-sm font-extrabold text-[#7f1735] hover:underline">
        <ArrowLeft size={17} /> Voltar ao Trocaí
      </button>}
      <header className="rounded-[30px] bg-[#6f0e2b] p-6 text-[#fff8ef] sm:p-9">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#f6bdd0] text-[#71122c]"><FileText size={24} /></div>
        <p className="mt-5 text-xs font-black uppercase tracking-[.18em] text-[#ffb2c6]">Trocaí · versão {CURRENT_TERMS_VERSION}</p>
        <h1 className="brand-font mt-2 text-4xl font-extrabold tracking-[-.04em] sm:text-5xl">Políticas de uso e privacidade</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#f5d6df]">Regras claras para anunciar, conversar e trocar com cuidado — sem compra e sem venda.</p>
      </header>

      <div className="mt-5 flex items-start gap-3 rounded-[22px] border border-[#d85f7f]/25 bg-[#fff0f2] p-4 text-sm leading-relaxed text-[#74354a] sm:p-5">
        <AlertTriangle className="mt-0.5 shrink-0 text-[#a52a4e]" size={20} />
        <p><b>Minuta provisória, pendente de revisão jurídica no Brasil.</b> Este texto não garante proteção contra todos os problemas nem substitui orientação profissional. Há informações do responsável, contato, atendimento, denúncias e retenção de dados que ainda precisam ser preenchidas e revisadas.</p>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-[22px] border border-[#75142e]/10 bg-white p-4 sm:p-5"><p className="text-[10px] font-black uppercase tracking-[.13em] text-[#a27682]">Responsável pelo serviço</p><p className="mt-2 text-sm font-bold text-[#65142b]">[PREENCHER nome ou razão social e dados necessários]</p></div>
        <div className="rounded-[22px] border border-[#75142e]/10 bg-white p-4 sm:p-5"><p className="text-[10px] font-black uppercase tracking-[.13em] text-[#a27682]">Contato para privacidade e suporte</p><p className="mt-2 text-sm font-bold text-[#65142b]">[PREENCHER e-mail público de contato]</p></div>
      </div>

      <div className="mt-5 space-y-3">
        {policySections.map((section) => (
          <article key={section.title} className="rounded-[22px] border border-[#75142e]/10 bg-white p-5 shadow-[0_8px_22px_rgba(102,23,48,.035)] sm:p-6">
            <h2 className="text-base font-extrabold text-[#64142b] sm:text-lg">{section.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-[#795f69]">{section.body}</p>
          </article>
        ))}
      </div>

      <div className="mt-5 rounded-[22px] bg-[#fff7f4] p-4 text-xs leading-relaxed text-[#805f69] sm:p-5">
        <p className="font-extrabold text-[#64142b]">Leis consultadas para preparar esta minuta</p>
        <p className="mt-2">Leia os textos oficiais: <a className="font-bold text-[#8e1b3d] underline" href="https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm" target="_blank" rel="noreferrer">Lei Geral de Proteção de Dados (Lei nº 13.709/2018)</a> e <a className="font-bold text-[#8e1b3d] underline" href="https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2014/lei/l12965.htm" target="_blank" rel="noreferrer">Marco Civil da Internet (Lei nº 12.965/2014)</a>. A aplicação ao Trocaí deve ser confirmada por profissional jurídico.</p>
      </div>

      {requireAcceptance ? (
        <div className="sticky bottom-3 z-20 mt-5 rounded-[24px] border border-[#d15b7c]/25 bg-[#fffaf6]/95 p-4 shadow-[0_16px_45px_rgba(89,17,39,.18)] backdrop-blur sm:p-5">
          <div className="mb-4 flex items-start gap-3 rounded-2xl bg-[#fff0f3] p-3 text-[#73364a]"><ShieldCheck className="mt-0.5 shrink-0 text-[#8a1738]" size={19} /><div><p className="text-sm font-extrabold">Seu cadastro está quase pronto.</p><p className="mt-1 text-xs leading-relaxed">Leia esta minuta, marque a caixa e aceite para começar a anunciar e conversar no Trocaí.</p></div></div>
          <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-[#653144]">
            <input type="checkbox" checked={checked} onChange={(event) => onCheckedChange(event.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-[#7a1030]" />
            <span>Li e aceito a <b>minuta provisória</b> das Políticas de uso e privacidade, versão {CURRENT_TERMS_VERSION}. Sei que ela está pendente de revisão jurídica e que aceitar não elimina direitos previstos em lei.</span>
          </label>
          {statusError && <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#fff0f2] p-3 text-xs text-[#7b3448]"><span>Não conseguimos conferir seu aceite agora. Tente novamente.</span><button onClick={onRetry} className="font-extrabold underline">Tentar de novo</button></div>}
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <button onClick={onLogout} className="order-2 px-3 py-2 text-sm font-bold text-[#8d5264] underline sm:order-1">Sair da conta</button>
            <button onClick={onAccept} disabled={!checked || pending || statusLoading || statusError} className="order-1 inline-flex items-center justify-center gap-2 rounded-full bg-[#74102c] px-5 py-3 text-sm font-extrabold text-white transition hover:bg-[#8c183b] disabled:cursor-not-allowed disabled:opacity-45 sm:order-2">
              <Check size={17} />{pending ? "Salvando seu aceite…" : "Aceitar e continuar"}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-5 flex flex-col gap-3 rounded-[24px] border border-[#75142e]/10 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#f7e2e8] text-[#7b1634]">{acceptedAt ? <Check size={18} /> : <LockKeyhole size={18} />}</span><div><p className="font-extrabold text-[#64142b]">{acceptedAt ? "Aceite registrado" : "Antes de usar sua conta, você precisará aceitar esta minuta."}</p>{acceptedAt && <p className="mt-1 text-xs text-[#866571]">Registrado em {new Date(acceptedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}.</p>}</div></div>
          {!authenticated && <button onClick={onLogin} className="btn-primary inline-flex items-center justify-center gap-2 px-5 py-3 text-sm"><ShieldCheck size={17} /> Entrar ou criar conta</button>}
        </div>
      )}
    </section>
  );
}
