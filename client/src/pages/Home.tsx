import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import AdminModerationPanel from "@/components/AdminModerationPanel";
import SwapWorkflow from "@/components/SwapWorkflow";
import PoliciesPage from "@/pages/PoliciesPage";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Bell,
  BookOpen,
  Camera,
  CalendarClock,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  Coins,
  Gamepad2,
  Footprints,
  Handshake,
  Heart,
  HeartHandshake,
  House,
  Laptop,
  Loader2,
  LogOut,
  MapPin,
  Menu,
  MessageCircle,
  MoreHorizontal,
  Eye,
  EyeOff,
  PackageOpen,
  PencilRuler,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Shirt,
  SlidersHorizontal,
  Sparkles,
  Star,
  Tag,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";

const heroArtwork = "/manus-storage/trocai-exchange-hero_4f008b7c.jpg";

const categories: { name: string; icon: LucideIcon; tone: string }[] = [
  { name: "Livros", icon: BookOpen, tone: "bg-[#fde1eb] text-[#9b1e48]" },
  { name: "Roupas", icon: Shirt, tone: "bg-[#ffe7ef] text-[#a22a53]" },
  { name: "Calçados", icon: Footprints, tone: "bg-[#f9dce5] text-[#811735]" },
  { name: "Acessórios", icon: Sparkles, tone: "bg-[#f5d7df] text-[#731330]" },
  { name: "Eletrônicos", icon: Laptop, tone: "bg-[#f9dfeb] text-[#8f2144]" },
  { name: "Jogos", icon: Gamepad2, tone: "bg-[#fde7d7] text-[#9b3a32]" },
  { name: "Material escolar", icon: PencilRuler, tone: "bg-[#fce1eb] text-[#9b1e48]" },
  { name: "Colecionáveis", icon: Star, tone: "bg-[#f9d6df] text-[#7a1230]" },
  { name: "Outros", icon: PackageOpen, tone: "bg-[#f5e4e8] text-[#7a1230]" },
];

type Listing = {
  id: number;
  title: string;
  category: string;
  condition: string;
  wants: string;
  location: string;
  author: string;
  avatar: string;
  image: string;
  description: string;
  posted: number;
  tone?: string;
  ownerId?: number;
  size?: string;
  status: "active" | "paused" | "reserved" | "traded" | "removed";
};

const listings: Listing[] = [];

type ListingCategory = "Livros" | "Roupas" | "Calçados" | "Acessórios" | "Eletrônicos" | "Jogos" | "Material escolar" | "Colecionáveis" | "Outros";
const conditionOptions = ["Novo", "Quase novo", "Usado, mas está bem", "Usado, com algumas marcas", "Precisa de alguns cuidados"] as const;
type ListingCondition = (typeof conditionOptions)[number];
const clothingSizes = ["PP", "P", "M", "G", "GG", "XGG", "34", "36", "38", "40", "42", "44", "46", "48", "50", "52", "54", "Tamanho único"];
const footwearSizes = Array.from({ length: 31 }, (_, index) => String(index + 20));
type ApiListing = { id: number; title: string; category: string; size?: string | null; condition: string; wants: string; location: string; author?: string | null; ownerName?: string | null; ownerId: number; imageUrl?: string | null; description: string; status: "active" | "paused" | "reserved" | "traded" | "removed"; createdAt: Date };

function toListing(record: ApiListing): Listing {
  const name = record.ownerName || record.author || "Pessoa do Trocaí";
  const avatar = name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const posted = Math.max(0, Math.floor((Date.now() - new Date(record.createdAt).getTime()) / 86_400_000));
  const oldConditionLabels: Record<string, string> = { "Muito bom": "Quase novo", "Bom": "Usado, mas está bem", "Usado, mas funcionando": "Usado, mas está bem" };
  return { id: record.id, title: record.title, category: record.category, size: record.size || undefined, condition: oldConditionLabels[record.condition] || record.condition, wants: record.wants, location: record.location, author: name, avatar, image: record.imageUrl || heroArtwork, description: record.description, posted, ownerId: record.ownerId, status: record.status };
}

async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    let chunk = "";
    for (let j = i; j < Math.min(i + chunkSize, bytes.length); j++) chunk += String.fromCharCode(bytes[j]);
    binary += chunk;
  }
  return btoa(binary);
}

const navItems = [
  { label: "Início", href: "/" },
  { label: "Explorar", href: "/explorar" },
  { label: "Como funciona", href: "/como-funciona" },
  { label: "Segurança", href: "/seguranca" },
];

function BrandMark({ compact = false, light = false }: { compact?: boolean; light?: boolean }) {
  return (
    <div className={`flex items-center gap-2.5 ${light ? "text-[#fff8ef]" : "text-[#720f2c]"}`} aria-label="Trocaí">
      <div className="relative grid h-9 w-10 place-items-center">
        <div className="absolute left-0 top-1 h-5 w-5 -rotate-6 rounded-[6px] bg-[#760d2b] shadow-sm" />
        <div className="absolute right-0 top-1 h-5 w-5 rotate-6 rounded-[6px] border-2 border-white bg-[#f35f8c] shadow-sm" />
        <div className="absolute bottom-0 text-[21px] font-black leading-none">↔</div>
      </div>
      {!compact && <span className="brand-font text-[30px] font-extrabold tracking-[-0.065em]">Trocaí</span>}
    </div>
  );
}

function Header({ location, navigate }: { location: string; navigate: (href: string) => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, loading, isAuthenticated, logout } = useAuth();
  const unreadQuery = trpc.notifications.unreadCount.useQuery(undefined, { enabled: isAuthenticated, refetchInterval: 30_000, refetchOnWindowFocus: true });
  const unreadCount = unreadQuery.data ?? 0;
  const go = (href: string) => { setMenuOpen(false); navigate(href); };
  const enter = () => { setMenuOpen(false); if (isAuthenticated) navigate("/perfil"); else startLogin(); };
  const displayName = user?.name?.split(" ")[0] || "Minha conta";
  return (
    <header className="sticky top-0 z-50 border-b border-[#7c1631]/[0.08] bg-[#fffaf2]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-[70px] max-w-[1220px] items-center justify-between px-4 sm:px-6 lg:px-8">
        <button onClick={() => go("/")} className="shrink-0" aria-label="Voltar ao início"><BrandMark /></button>
        <nav className="hidden items-center gap-1 lg:flex">{navItems.map((item) => { const active = item.href === "/" ? location === "/" : location.startsWith(item.href); return <button key={item.href} onClick={() => go(item.href)} className={`rounded-full px-4 py-2 text-sm font-semibold transition ${active ? "bg-[#f8dde5] text-[#7a1030]" : "text-[#6c5360] hover:bg-[#f8ecea] hover:text-[#7a1030]"}`}>{item.label}</button>; })}</nav>
        <div className="hidden items-center gap-2 lg:flex">
          {isAuthenticated && <button onClick={() => go("/notificacoes")} aria-label={`Avisos${unreadCount ? `: ${unreadCount} não lidos` : ""}`} className="relative grid h-9 w-9 place-items-center rounded-full text-[#79122f] transition hover:bg-[#fae5ea]"><Bell size={18} />{unreadCount > 0 && <span className="absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[#f15683] px-1 text-[10px] font-black text-white">{unreadCount > 9 ? "9+" : unreadCount}</span>}</button>}
          {user?.role === "admin" && <button onClick={() => go("/admin")} className="rounded-full px-3 py-2 text-xs font-extrabold text-[#79122f] transition hover:bg-[#fae5ea]">Admin</button>}
          <button onClick={enter} className="rounded-full px-4 py-2 text-sm font-bold text-[#79122f] transition hover:bg-[#fae5ea]">{loading ? "Carregando…" : isAuthenticated ? displayName : "Entrar / criar conta"}</button>
          {isAuthenticated && <button onClick={() => { void logout(); toast("Você saiu da sua conta."); }} aria-label="Sair da conta" className="grid h-9 w-9 place-items-center rounded-full text-[#79122f] hover:bg-[#fae5ea]"><LogOut size={16} /></button>}
          <button onClick={() => go("/anunciar")} className="btn-primary inline-flex items-center gap-2 px-4 py-2.5 text-sm"><Plus size={16} strokeWidth={2.8} /> Anunciar</button>
        </div>
        <button onClick={() => setMenuOpen((open) => !open)} className="grid h-10 w-10 place-items-center rounded-full border border-[#7c1631]/10 bg-white text-[#76122e] lg:hidden" aria-label="Abrir menu">{menuOpen ? <X size={20} /> : <Menu size={21} />}</button>
      </div>
      {menuOpen && <div className="border-t border-[#7c1631]/10 bg-[#fffaf2] px-4 pb-5 pt-3 shadow-xl lg:hidden"><div className="mx-auto grid max-w-[1220px] gap-1">{navItems.map((item) => <button key={item.href} onClick={() => go(item.href)} className="rounded-2xl px-4 py-3 text-left font-bold text-[#66112a] hover:bg-[#f8e6e8]">{item.label}</button>)}{isAuthenticated && <button onClick={() => go("/notificacoes")} className="rounded-2xl px-4 py-3 text-left font-bold text-[#66112a] hover:bg-[#f8e6e8]">Avisos{unreadCount > 0 ? ` (${unreadCount} novos)` : ""}</button>}{user?.role === "admin" && <button onClick={() => go("/admin")} className="rounded-2xl px-4 py-3 text-left font-bold text-[#66112a] hover:bg-[#f8e6e8]">Painel da administração</button>}<button onClick={enter} className="rounded-2xl px-4 py-3 text-left font-bold text-[#66112a] hover:bg-[#f8e6e8]">{loading ? "Carregando…" : isAuthenticated ? `Olá, ${displayName}` : "Entrar / criar conta"}</button>{isAuthenticated && <button onClick={() => { void logout(); setMenuOpen(false); toast("Você saiu da sua conta."); }} className="rounded-2xl px-4 py-3 text-left font-bold text-[#66112a] hover:bg-[#f8e6e8]">Sair da conta</button>}<button onClick={() => go("/anunciar")} className="btn-primary mt-2 inline-flex items-center justify-center gap-2 px-4 py-3"><Plus size={17} /> Anunciar algo</button></div></div>}
    </header>
  );
}

function Footer({ navigate }: { navigate: (href: string) => void }) {
  const links = ["Início", "Explorar", "Como funciona", "Anunciar", "Segurança", "Políticas", "Sobre", "Contato"];
  const hrefs = ["/", "/explorar", "/como-funciona", "/anunciar", "/seguranca", "/politicas", "/sobre", "/contato"];
  return (
    <footer className="overflow-hidden bg-[#6f0e2b] pt-12 text-[#fff8ef] sm:pt-16">
      <div className="mx-auto max-w-[1220px] px-4 sm:px-6 lg:px-8">
        <div className="grid gap-10 pb-10 sm:grid-cols-[1.3fr_1fr] sm:gap-16">
          <div>
            <div className="mb-3"><BrandMark light /></div>
            <p className="brand-font max-w-xs text-xl font-semibold leading-tight text-[#ffbecf]">Troque o que você quer pelo que você tem.</p>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-[#f5d6df]">Aqui você troca objetos com outras pessoas: sem comprar e sem vender.</p>
          </div>
          <div>
            <p className="mb-4 text-xs font-black uppercase tracking-[0.18em] text-[#ffadc2]">Navegue</p>
            <div className="grid grid-cols-2 gap-y-3">
              {links.map((link, index) => <button key={link} onClick={() => navigate(hrefs[index])} className="text-left text-sm font-semibold text-[#fff8ef] transition hover:text-[#ff9fbe]">{link}</button>)}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2 border-t border-white/15 py-5 text-xs text-[#f0c8d5] sm:flex-row sm:items-center sm:justify-between">
          <span>© 2026 Trocaí. Trocas que fazem sentido.</span>
          <span>Feito com cuidado para pessoas e coisas.</span>
        </div>
      </div>
    </footer>
  );
}

function Layout({ children, location, navigate }: { children: React.ReactNode; location: string; navigate: (href: string) => void }) {
  return <div className="min-h-screen overflow-x-hidden bg-[#fffaf2] text-[#35121f]"><Header location={location} navigate={navigate} /><main>{children}</main><Footer navigate={navigate} /></div>;
}

function SearchField({ onSearch, defaultValue = "", compact = false }: { onSearch: (value: string) => void; defaultValue?: string; compact?: boolean }) {
  const [value, setValue] = useState(defaultValue);
  const submit = (event: FormEvent) => { event.preventDefault(); onSearch(value); };
  return (
    <form onSubmit={submit} className={`flex items-center gap-2 rounded-[22px] border border-[#7b1532]/10 bg-white p-2 shadow-[0_12px_30px_rgba(100,20,46,0.08)] ${compact ? "" : "sm:p-2.5"}`}>
      <Search className="ml-2 shrink-0 text-[#9a6174]" size={20} />
      <input value={value} onChange={(event) => setValue(event.target.value)} className="min-w-0 flex-1 bg-transparent py-2 text-sm font-medium outline-none placeholder:text-[#aa8b95]" placeholder="O que você está procurando?" aria-label="Buscar anúncios" />
      <button className="btn-primary shrink-0 px-4 py-2.5 text-sm sm:px-6">Buscar</button>
    </form>
  );
}

function ListingCard({ item, navigate, compact = false }: { item: Listing; navigate: (href: string) => void; compact?: boolean }) {
  return (
    <article className="group overflow-hidden rounded-[24px] border border-[#75142e]/[0.08] bg-white shadow-[0_10px_25px_rgba(102,23,48,0.055)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_17px_35px_rgba(102,23,48,0.12)]">
      <button onClick={() => navigate(`/produto/${item.id}`)} className="relative block aspect-[1.12] w-full overflow-hidden bg-[#f8e5e6] text-left">
        <img src={item.image} alt={item.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" />
        <span className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-[11px] font-extrabold text-[#7e1531] backdrop-blur">{item.category}</span>
        {item.status === "reserved" && <span className="absolute bottom-3 left-3 rounded-full bg-[#71132e]/95 px-3 py-1 text-[10px] font-extrabold text-white shadow-sm">Encontro marcado</span>}
        
      </button>
      <div className={compact ? "p-4" : "p-4 sm:p-5"}>
        <button onClick={() => navigate(`/produto/${item.id}`)} className="line-clamp-1 text-left text-base font-extrabold tracking-[-0.02em] text-[#3e1523] transition hover:text-[#961d48]">{item.title}</button>
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-[#8f6471]"><span className="inline-flex min-w-0 items-center gap-1"><MapPin size={13} className="shrink-0" /> <span className="truncate">{item.location}</span></span><span className="rounded-full bg-[#fff1f4] px-2 py-0.5 text-[10px] font-extrabold text-[#9a3151]">{item.condition}</span>{item.size && <span className="rounded-full bg-[#f9e8ed] px-2 py-0.5 text-[10px] font-extrabold text-[#7e2942]">{item.size === "Tamanho único" ? item.size : `Tam. ${item.size}`}</span>}</div>
        <div className="my-3 h-px bg-[#7a1430]/[0.08]" />
        <div className="flex items-start gap-2">
          <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#f9dce5] text-[9px] font-black text-[#851536]">{item.avatar}</div>
          <div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[0.13em] text-[#a37683]">Procura por</p><p className="line-clamp-1 text-xs font-bold text-[#71132e]">{item.wants}</p></div>
        </div>
      </div>
    </article>
  );
}

function HomePage({ navigate, items, loading }: { navigate: (href: string) => void; items: Listing[]; loading: boolean }) {
  return (
    <>
      <section className="relative overflow-hidden bg-[#fff4ea] pb-14 pt-9 sm:pb-20 sm:pt-14 lg:pb-24 lg:pt-20">
        <div className="paper-dots pointer-events-none absolute inset-0 opacity-50" />
        <div className="relative mx-auto grid max-w-[1220px] items-center gap-10 px-4 sm:px-6 lg:grid-cols-[1.04fr_.96fr] lg:gap-12 lg:px-8">
          <div className="max-w-[650px]">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#a01f47]/15 bg-white/75 px-3.5 py-2 text-xs font-extrabold text-[#8a193b] shadow-sm"><Sparkles size={14} fill="currentColor" /> Trocar é dar um novo começo</div>
            <h1 className="brand-font max-w-[640px] text-[50px] font-extrabold leading-[0.92] tracking-[-0.065em] text-[#6e0d2a] sm:text-[70px] lg:text-[78px]">Troque o que você <span className="relative inline-block text-[#f15383]"><span className="relative z-10">quer</span><span className="absolute -bottom-1 left-0 h-3 w-full -rotate-2 rounded-full bg-[#ffc0d4]" /></span> pelo que você tem.</h1>
            <p className="mt-6 max-w-[560px] text-[15px] font-medium leading-relaxed text-[#725361] sm:text-[17px]">Anuncie o que você não usa mais e encontre alguém que queira trocar. Seu item pode ser exatamente o que outra pessoa procura.</p>
            <div className="mt-7 max-w-[590px]"><SearchField onSearch={(value) => navigate(`/explorar?q=${encodeURIComponent(value)}`)} /></div>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <button onClick={() => navigate("/explorar")} className="btn-primary inline-flex items-center justify-center gap-2 px-5 py-3.5 text-sm"><Search size={17} /> Quero trocar <ArrowRight size={17} /></button>
              <button onClick={() => navigate("/anunciar")} className="btn-secondary inline-flex items-center justify-center gap-2 px-5 py-3.5 text-sm"><Plus size={18} /> Anunciar algo</button>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-bold text-[#8b6673]"><span className="inline-flex items-center gap-1.5"><BadgeCheck size={16} className="text-[#c5335d]" /> Comunidade de verdade</span><span className="inline-flex items-center gap-1.5"><HeartHandshake size={16} className="text-[#c5335d]" /> Sem dinheiro envolvido</span></div>
          </div>
          <div className="relative mx-auto w-full max-w-[500px] lg:max-w-none">
            <div className="absolute -right-6 top-9 h-28 w-28 rounded-full bg-[#f85d8c]/20 blur-2xl" />
            <div className="absolute -left-4 bottom-7 h-36 w-36 rounded-full bg-[#831533]/10 blur-2xl" />
            <div className="relative overflow-hidden rounded-[38px] border-[7px] border-white bg-[#f8dbe4] p-2 shadow-[0_28px_56px_rgba(105,16,44,0.18)]">
              <img src={heroArtwork} alt="Objetos trocados no Trocaí" className="aspect-[.91] w-full rounded-[28px] object-cover" />
              <div className="absolute bottom-5 left-0 rounded-r-2xl bg-white/95 px-4 py-3.5 shadow-lg backdrop-blur"><p className="text-[10px] font-black uppercase tracking-[0.13em] text-[#9a6174]">Troca perto de você</p><p className="mt-0.5 flex items-center gap-1.5 text-sm font-extrabold text-[#6f0e2b]"><MapPin size={15} /> Trocas na sua comunidade</p></div>
              <div className="absolute right-4 top-5 flex items-center gap-2 rounded-2xl bg-[#6f0e2b] px-3 py-2.5 text-xs font-bold text-white shadow-lg"><Heart size={14} fill="#ff8fb2" className="text-[#ff8fb2]" /> Menos desperdício</div>
            </div>
            <div className="absolute -bottom-4 -right-2 hidden rotate-3 rounded-2xl border border-[#76142f]/10 bg-[#fffaf6] px-4 py-3 shadow-lg sm:block"><p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#ad7182]">Hoje no Trocaí</p><p className="brand-font text-lg font-extrabold text-[#851535]">Sem dinheiro, só trocas</p></div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1220px] px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
        <div className="flex items-end justify-between gap-6"><div><p className="eyebrow">Comece por aqui</p><h2 className="section-title mt-2">O que você quer encontrar?</h2></div><button onClick={() => navigate("/explorar")} className="hidden items-center gap-1 text-sm font-extrabold text-[#8d1738] hover:underline sm:inline-flex">Ver tudo <ArrowUpRight size={16} /></button></div>
        <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-9">
          {categories.map((category) => { const Icon = category.icon; return <button key={category.name} onClick={() => navigate(`/explorar?categoria=${encodeURIComponent(category.name)}`)} className="group rounded-[22px] border border-[#76142f]/[0.08] bg-white p-3 text-left shadow-[0_6px_16px_rgba(102,23,48,0.04)] transition hover:-translate-y-1 hover:shadow-md sm:p-4"><div className={`grid h-10 w-10 place-items-center rounded-2xl ${category.tone} transition group-hover:rotate-[-6deg]`}><Icon size={20} /></div><p className="mt-4 text-xs font-extrabold text-[#561225]">{category.name}</p></button>; })}
        </div>
        <button onClick={() => navigate("/explorar")} className="btn-secondary mt-5 inline-flex w-full items-center justify-center gap-2 px-4 py-3 text-sm sm:hidden">Ver todos os anúncios <ArrowRight size={16} /></button>
      </section>

      <section className="mx-auto max-w-[1220px] px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <div className="grid gap-7 rounded-[30px] bg-[#6f0e2b] p-6 text-white sm:p-9 lg:grid-cols-[.9fr_1.1fr] lg:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[.16em] text-[#ffb0c5]">Troca em troca</p>
            <h2 className="brand-font mt-2 text-3xl font-extrabold leading-[.97] tracking-[-.045em] sm:text-4xl">Não encontrou alguém que queira o que você tem?</h2>
            <p className="mt-4 max-w-lg text-sm leading-relaxed text-[#f7dce4]">Tudo bem. Uma pessoa pode trocar com outra, e o objeto continua circulando até chegar ao que você procura.</p>
            <button onClick={() => navigate("/como-funciona")} className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-extrabold text-[#71122d] transition hover:-translate-y-0.5">Veja um exemplo simples <ArrowRight size={16} /></button>
          </div>
          <div className="rounded-[24px] bg-white/10 p-4 sm:p-5">
            <p className="mb-3 text-xs font-black uppercase tracking-[.13em] text-[#ffb0c5]">Um caminho possível</p>
            <div className="space-y-2.5 text-sm">
              <div className="rounded-2xl bg-white/10 px-4 py-3"><b>Sua mãe</b> troca a pulseira por um fone.</div>
              <div className="rounded-2xl bg-white/10 px-4 py-3"><b>Depois</b>, troca o fone com você pelo celular.</div>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-[#ffe5ec]">Você recebe o fone, sua mãe recebe o celular e a outra pessoa fica com a pulseira. <b>Sem dinheiro: só objetos e acordos.</b></p>
          </div>
        </div>
      </section>

      <section className="border-y border-[#7c1430]/[0.07] bg-[#fff7f5] py-14 sm:py-20">
        <div className="mx-auto max-w-[1220px] px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between gap-6"><div><p className="eyebrow">Recém-chegados</p><h2 className="section-title mt-2">Anúncios novos para explorar.</h2></div><button onClick={() => navigate("/explorar")} className="hidden items-center gap-1 text-sm font-extrabold text-[#8d1738] hover:underline sm:inline-flex">Explorar anúncios <ArrowUpRight size={16} /></button></div>
          <div className="mt-8">{loading ? <div className="flex justify-center py-12"><Loader2 className="animate-spin text-[#a12c50]" /></div> : items.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 sm:gap-5">{items.slice(0, 4).map((item) => <ListingCard key={item.id} item={item} navigate={navigate} />)}</div> : <div className="rounded-[26px] border border-dashed border-[#bc4a6b]/30 bg-white px-6 py-9 text-center"><PackageOpen className="mx-auto text-[#c45272]" size={30} /><p className="mt-3 font-extrabold text-[#64142b]">Os primeiros anúncios começam com você.</p><p className="mt-1 text-sm text-[#85636e]">Publique algo que quer trocar e encontre sua próxima história.</p><button onClick={() => navigate("/anunciar")} className="btn-primary mt-4 px-4 py-2.5 text-sm">Anunciar algo</button></div>}</div>
        </div>
      </section>

      <section className="mx-auto max-w-[1220px] px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
        <div className="grid items-center gap-10 lg:grid-cols-[.85fr_1.15fr] lg:gap-16">
          <div className="relative rounded-[34px] bg-[#72102d] p-7 text-white shadow-[0_20px_48px_rgba(100,20,46,0.22)] sm:p-10">
            <div className="absolute right-6 top-5 text-[#ff86aa]"><span className="brand-font text-[78px] font-extrabold leading-none">↔</span></div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#ffafc7]">Trocar é simples</p>
            <h2 className="brand-font mt-3 max-w-[300px] text-4xl font-extrabold leading-[.98] tracking-[-0.04em] sm:text-5xl">Como funciona?</h2>
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-[#f7dce5]">Um caminho leve para fazer circular aquilo que você já tem — e descobrir o que está procurando.</p>
            <button onClick={() => navigate("/como-funciona")} className="mt-7 inline-flex items-center gap-2 text-sm font-extrabold text-white hover:text-[#ffa6bf]">Ver detalhes <ArrowRight size={17} /></button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[{ n: "01", title: "Encontre", text: "Procure algo que gostaria de receber.", icon: Search }, { n: "02", title: "Veja a oferta", text: "Descubra o que a pessoa oferece e procura.", icon: CircleHelp }, { n: "03", title: "Combine", text: "Converse e acerte os detalhes da troca.", icon: MessageCircle }, { n: "04", title: "Troque", text: "Escolha um jeito seguro de realizar a troca.", icon: Handshake }].map((step) => { const Icon = step.icon; return <div key={step.n} className="rounded-[22px] border border-[#7c1430]/[0.08] bg-white p-5 transition hover:border-[#d15778]/30 hover:shadow-md"><div className="flex items-center justify-between"><span className="brand-font text-2xl font-extrabold text-[#ef7b9e]">{step.n}</span><Icon size={21} className="text-[#75122e]" /></div><h3 className="mt-5 text-base font-extrabold text-[#561225]">{step.title}</h3><p className="mt-1.5 text-sm leading-relaxed text-[#80616d]">{step.text}</p></div>; })}
          </div>
        </div>
      </section>

      <section className="pb-16 sm:pb-24"><div className="mx-auto max-w-[1220px] px-4 sm:px-6 lg:px-8"><div className="relative overflow-hidden rounded-[32px] bg-[#f9cad8] px-6 py-9 sm:px-10 sm:py-11"><div className="absolute -right-12 -top-16 h-56 w-56 rounded-full bg-[#f15c89]/25" /><div className="absolute -bottom-16 left-[42%] h-40 w-40 rounded-full bg-white/35" /><div className="relative grid items-center gap-6 md:grid-cols-[1fr_auto]"><div><p className="eyebrow text-[#9c2144]">Cada troca conta</p><h2 className="brand-font mt-2 max-w-xl text-4xl font-extrabold leading-[.95] tracking-[-0.045em] text-[#6e0e2a] sm:text-5xl">Uma nova vida para as coisas. <span className="text-[#f04f81]">E novas histórias para você.</span></h2></div><button onClick={() => navigate("/anunciar")} className="btn-primary inline-flex shrink-0 items-center justify-center gap-2 px-5 py-3.5 text-sm">Publicar meu anúncio <ArrowRight size={17} /></button></div></div></div></section>
    </>
  );
}

function ExplorePage({ navigate }: { navigate: (href: string) => void }) {
  const [location] = useLocation();
  const params = new URLSearchParams(window.location.search || location.split("?")[1] || "");
  const initialQuery = params.get("q") || "";
  const initialCategory = params.get("categoria") || "Todos";
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState(initialCategory);
  const [condition, setCondition] = useState("Todos");
  const [cityInput, setCityInput] = useState("");
  const [city, setCity] = useState("");
  const [sort, setSort] = useState("Mais recentes");
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    setQuery(initialQuery);
    setCategory(initialCategory);
    setPage(1);
  }, [initialQuery, initialCategory]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setCity(cityInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [cityInput]);

  const filters = useMemo(() => ({
    q: query.trim() || undefined,
    category: category === "Todos" ? undefined : category as ListingCategory,
    condition: condition === "Todos" ? undefined : condition as ListingCondition,
    location: city || undefined,
    sort: sort === "A-Z" ? "az" as const : "recent" as const,
    page,
    pageSize: 24,
  }), [query, category, condition, city, sort, page]);
  const results = trpc.marketplace.listings.list.useQuery(filters, {
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
  const items = (results.data?.items || []).map((item) => toListing(item));
  const hasMore = results.data?.hasMore ?? false;

  const runSearch = (value: string) => {
    const nextQuery = value.trim();
    setPage(1);
    setQuery(nextQuery);
    navigate(`/explorar?q=${encodeURIComponent(nextQuery)}`);
  };
  const clear = () => {
    setQuery("");
    setCategory("Todos");
    setCondition("Todos");
    setCityInput("");
    setCity("");
    setSort("Mais recentes");
    setPage(1);
    navigate("/explorar");
  };
  const changeCategory = (value: string) => {
    setCategory(value);
    setPage(1);
  };
  const changeCondition = (value: string) => {
    setCondition(value);
    setPage(1);
  };
  const changeSort = (value: string) => {
    setSort(value);
    setPage(1);
  };

  const renderFilterControls = (mobile = false) => (
    <div className={mobile ? "grid gap-3" : "hidden lg:block"}>
      <div className="rounded-[22px] border border-[#76142f]/10 bg-white p-5">
        <div className="mb-5 flex items-center justify-between">
          <p className="font-extrabold text-[#5a1327]">Filtros</p>
          <button onClick={clear} className="text-xs font-bold text-[#ae3157] hover:underline">Limpar</button>
        </div>
        <div className="space-y-5">
          <label className="filter-label">Cidade ou bairro
            <input
              type="search"
              value={cityInput}
              onChange={(event) => setCityInput(event.target.value)}
              placeholder="Ex.: Recife, Centro"
              className="w-full rounded-xl border border-[#76142f]/10 bg-[#fffaf8] px-3 py-2.5 text-[13px] font-bold normal-case tracking-normal text-[#67132b] outline-none focus:border-[#d65278] focus:ring-2 focus:ring-[#d65278]/15"
            />
          </label>
          <label className="filter-label">Como está o item?
            <select value={condition} onChange={(event) => changeCondition(event.target.value)}>
              <option>Todos</option>
              {conditionOptions.map((option) => <option key={option}>{option}</option>)}
            </select>
          </label>
          <div>
            <p className="filter-label mb-2">Categorias</p>
            <div className="space-y-1.5">
              {["Todos", ...categories.map((item) => item.name)].map((item) => (
                <button key={item} onClick={() => changeCategory(item)} className={`flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left text-sm font-bold transition ${category === item ? "bg-[#fae1e9] text-[#861838]" : "text-[#795865] hover:bg-[#fff3f4]"}`}>
                  <span>{item}</span>{category === item && <Check size={15} />}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <section className="mx-auto max-w-[1220px] px-4 py-9 sm:px-6 sm:py-12 lg:px-8">
      <div className="max-w-2xl">
        <p className="eyebrow">Explorar anúncios</p>
        <h1 className="section-title mt-2">Encontre o que você quer trocar.</h1>
        <p className="mt-3 text-sm leading-relaxed text-[#80616d]">Veja o que as pessoas têm, o que querem receber e como está cada item. Aqui não tem compra nem venda: só troca.</p>
      </div>
      <div className="mt-7"><SearchField key={query} defaultValue={query} onSearch={runSearch} /></div>
      <div className="mt-5 flex gap-2 overflow-x-auto pb-2 lg:hidden">
        <button onClick={() => setFiltersOpen((open) => !open)} className="btn-secondary inline-flex shrink-0 items-center gap-2 px-4 py-2.5 text-sm"><SlidersHorizontal size={16} /> Filtros</button>
        <select value={sort} onChange={(event) => changeSort(event.target.value)} className="rounded-full border border-[#76142f]/10 bg-white px-4 text-sm font-bold text-[#6d1b32] outline-none"><option>Mais recentes</option><option>A-Z</option></select>
      </div>
      {filtersOpen && <div className="mt-3 lg:hidden">{renderFilterControls(true)}</div>}
      <div className="mt-7 grid gap-8 lg:grid-cols-[240px_1fr]">
        <aside>{renderFilterControls()}</aside>
        <div id="explore-results">
          <div className="mb-5 flex items-center justify-between gap-3">
            <p className="text-sm font-bold text-[#7c5b67]"><span className="font-extrabold text-[#68132b]">{results.isLoading ? "…" : items.length}</span> anúncios nesta página{page > 1 ? ` · página ${page}` : ""}</p>
            <label className="hidden items-center gap-2 text-sm font-bold text-[#7c5b67] sm:flex">Ordenar
              <select value={sort} onChange={(event) => changeSort(event.target.value)} className="rounded-full border border-[#76142f]/10 bg-white px-3 py-2 text-sm font-bold text-[#6d1b32] outline-none"><option>Mais recentes</option><option>A-Z</option></select>
            </label>
          </div>
          {results.isLoading ? <div className="flex justify-center rounded-[28px] bg-white py-14"><Loader2 className="animate-spin text-[#a12c50]" /></div>
            : results.error ? <div className="rounded-[28px] bg-[#fff7f5] px-6 py-14 text-center"><p className="font-extrabold text-[#64142b]">Não foi possível carregar os anúncios.</p><p className="mt-2 text-sm text-[#85636e]">Tente novamente em instantes.</p><button onClick={() => void results.refetch()} className="btn-secondary mt-5 px-4 py-2.5 text-sm">Tentar de novo</button></div>
            : items.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5">{items.map((item) => <ListingCard key={item.id} item={item} navigate={navigate} />)}</div>
            : <div className="rounded-[28px] border border-dashed border-[#b94b6b]/30 bg-[#fff7f5] px-6 py-14 text-center"><Search className="mx-auto text-[#c45272]" size={32} /><h2 className="mt-4 text-lg font-extrabold text-[#64142b]">Nenhum anúncio por aqui ainda.</h2><p className="mx-auto mt-2 max-w-sm text-sm text-[#85636e]">Tente outra busca ou região, ou seja a primeira pessoa a publicar nessa categoria.</p><button onClick={clear} className="btn-secondary mt-5 px-4 py-2.5 text-sm">Limpar filtros</button><button onClick={() => navigate("/anunciar")} className="btn-primary ml-2 mt-5 px-4 py-2.5 text-sm">Anunciar algo</button></div>}
          {!results.error && items.length > 0 && (page > 1 || hasMore) && <nav aria-label="Páginas de anúncios" className="mt-7 flex items-center justify-center gap-3">
            <button onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1 || results.isFetching} className="btn-secondary px-4 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50">Anterior</button>
            <span className="text-xs font-bold text-[#805f69]">Página {page}</span>
            <button onClick={() => setPage((current) => current + 1)} disabled={!hasMore || results.isFetching} className="btn-primary px-4 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50">Próxima</button>
          </nav>}
        </div>
      </div>
    </section>
  );
}

function ChainFinder({ listingId, navigate }: { listingId: number; navigate: (href: string) => void }) {
  const [opened, setOpened] = useState(false);
  const result = trpc.marketplace.chains.find.useQuery({ listingId }, { enabled: opened, staleTime: 20_000 });
  const search = () => {
    if (!opened) setOpened(true);
    else void result.refetch();
  };
  return (
    <section className="mt-8 rounded-[28px] border border-[#ce6b89]/25 bg-[#fff4f3] p-5 sm:p-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-2xl">
          <p className="eyebrow">Troca em troca</p>
          <h2 className="brand-font mt-1 text-3xl font-extrabold leading-[.98] tracking-[-.04em] text-[#681029]">Se uma troca direta não encaixar, pode haver outro caminho.</h2>
          <p className="mt-2 text-sm leading-relaxed text-[#795864]">O Trocaí procura anúncios que combinam com o que esta pessoa quer e mostra possíveis sequências. Cada pessoa ainda precisa concordar.</p>
        </div>
        <button onClick={search} disabled={result.isFetching} className="btn-primary inline-flex shrink-0 items-center justify-center gap-2 px-4 py-3 text-sm disabled:opacity-60">{result.isFetching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}{opened ? "Procurar de novo" : "Procurar um caminho"}</button>
      </div>
      {opened && <div className="mt-5" aria-live="polite">
        {result.isFetching && !result.data ? <div className="flex items-center gap-2 rounded-2xl bg-white p-4 text-sm font-semibold text-[#775561]"><Loader2 size={17} className="animate-spin text-[#b22c54]" /> Procurando anúncios que possam combinar…</div>
          : result.error ? <div className="rounded-2xl bg-white p-4 text-sm leading-relaxed text-[#775561]">Não foi possível procurar agora. Tente novamente em instantes.</div>
          : result.data?.length ? <div className="space-y-4">{result.data.map((chain, chainIndex) => <article key={chainIndex} className="rounded-[22px] border border-[#75142e]/10 bg-white p-4 sm:p-5"><p className="font-extrabold text-[#64142b]">Encontramos um caminho com {chain.participantCount} pessoas</p><div className="mt-3 space-y-2">{chain.transfers.map((transfer, index) => { const from = transfer.fromListingId === listingId ? "Você" : transfer.fromName; const to = transfer.toListingId === listingId ? "você" : transfer.toName; return <div key={`${transfer.fromListingId}-${transfer.toListingId}`} className="flex items-center gap-3 rounded-2xl bg-[#fff5f6] p-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#f7dce5] text-xs font-black text-[#811536]">{index + 1}</span><div className="min-w-0 flex-1"><p className="text-sm font-bold leading-relaxed text-[#65132b]"><b>{from}</b> entrega <b>{transfer.itemTitle}</b> para <b>{to}</b>.</p><p className="text-xs text-[#8b6772]">{transfer.fromLocation}</p></div><button onClick={() => navigate(`/produto/${transfer.fromListingId}`)} className="shrink-0 rounded-full border border-[#7c1430]/15 px-3 py-2 text-xs font-extrabold text-[#801536] hover:bg-[#f9e5eb]">Ver anúncio</button></div>; })}</div><p className="mt-3 text-xs leading-relaxed text-[#84616c]">É uma sugestão, não uma promessa. Conversem com todas as pessoas e só sigam se todas estiverem de acordo. Sem dinheiro.</p></article>)}</div>
          : <div className="rounded-2xl bg-white p-4 text-sm leading-relaxed text-[#775561]">Ainda não encontramos anúncios que formem um caminho para este item. Quando surgirem novos anúncios, tente outra vez.</div>}
      </div>}
    </section>
  );
}

function ProductPage({ id, navigate }: { id: number; navigate: (href: string) => void }) {
  const auth = useAuth();
  const utils = trpc.useUtils();
  const detail = trpc.marketplace.listings.byId.useQuery({ id });
  const [proposalOpen, setProposalOpen] = useState(false);
  const [offeredItem, setOfferedItem] = useState("");
  const [offeredListingId, setOfferedListingId] = useState("");
  const [message, setMessage] = useState("");
  const [proposalId, setProposalId] = useState<number | null>(null);
  const [completionDialogOpen, setCompletionDialogOpen] = useState(false);
  const myProposals = trpc.marketplace.proposals.mine.useQuery(undefined, { enabled: auth.isAuthenticated, refetchInterval: 5000, refetchOnWindowFocus: true });
  const myListings = trpc.marketplace.listings.mine.useQuery(undefined, { enabled: auth.isAuthenticated });
  const proposalsForListing = myProposals.data?.filter((proposal) => proposal.listingId === id) || [];
  const preferredProposal = proposalsForListing.find((proposal) => proposal.status === "accepted") || proposalsForListing.find((proposal) => proposal.status === "pending") || proposalsForListing[0];
  const currentProposal = myProposals.data?.find((proposal) => proposal.id === proposalId);
  const meetingPlan = trpc.marketplace.exchange.meetings.get.useQuery(
    { proposalId: proposalId || 0 },
    { enabled: Boolean(proposalId && auth.isAuthenticated && currentProposal?.status === "accepted"), refetchInterval: 5000 },
  );
  const myCompletionAt = currentProposal ? (currentProposal.isOwner ? currentProposal.ownerCompletedAt : currentProposal.proposerCompletedAt) : null;
  const otherCompletionAt = currentProposal ? (currentProposal.isOwner ? currentProposal.proposerCompletedAt : currentProposal.ownerCompletedAt) : null;
  const alreadyConfirmed = Boolean(myCompletionAt);
  const otherConfirmed = Boolean(otherCompletionAt);
  const updateProposal = trpc.marketplace.proposals.updateStatus.useMutation({ onSuccess: () => { void utils.marketplace.proposals.mine.invalidate(); void utils.notifications.mine.invalidate(); void utils.notifications.unreadCount.invalidate(); toast.success("Resposta enviada."); }, onError: (error) => toast.error(error.message) });
  const confirmCompletion = trpc.marketplace.proposals.confirmCompletion.useMutation({ onSuccess: (result) => { setCompletionDialogOpen(false); void utils.marketplace.proposals.mine.invalidate(); void utils.notifications.mine.invalidate(); void utils.notifications.unreadCount.invalidate(); void utils.marketplace.listings.list.invalidate(); if (result.completed) toast.success("Troca concluída: vocês dois confirmaram."); else if (result.alreadyConfirmed) toast("Você já confirmou. Agora falta a outra pessoa."); else toast.success("Sua confirmação foi enviada. Agora falta a outra pessoa."); }, onError: (error) => toast.error(error.message) });
  useEffect(() => {
    const scheduled = meetingPlan.data?.current;
    const timeHasPassed = scheduled ? new Date(scheduled.scheduledAt).getTime() <= Date.now() : false;
    if (currentProposal?.status === "accepted" && scheduled?.status === "confirmed" && timeHasPassed && otherConfirmed && !alreadyConfirmed) setCompletionDialogOpen(true);
  }, [currentProposal?.id, currentProposal?.status, otherConfirmed, alreadyConfirmed, meetingPlan.data?.current?.id, meetingPlan.data?.current?.status, meetingPlan.data?.current?.scheduledAt]);
  useEffect(() => { if (proposalId == null && preferredProposal) setProposalId(preferredProposal.id); }, [id, proposalId, preferredProposal?.id]);
  const thread = trpc.marketplace.proposals.messages.useQuery({ proposalId: proposalId || 0 }, { enabled: Boolean(proposalId && auth.isAuthenticated), refetchInterval: 10_000 });
  const createProposal = trpc.marketplace.proposals.create.useMutation({ onSuccess: (result) => { setProposalId(result.id); void utils.marketplace.proposals.mine.invalidate(); void utils.notifications.mine.invalidate(); void utils.notifications.unreadCount.invalidate(); toast.success("Seu interesse foi enviado! A conversa já está aberta."); }, onError: (error) => toast.error(error.message) });
  const sendMutation = trpc.marketplace.proposals.sendMessage.useMutation({ onSuccess: () => { setMessage(""); void thread.refetch(); }, onError: (error) => toast.error(error.message) });
  if (detail.isLoading) return <div className="mx-auto flex min-h-[60vh] max-w-[1220px] items-center justify-center"><Loader2 className="animate-spin text-[#a12c50]" /></div>;
  if (!detail.data) return <section className="mx-auto max-w-[800px] px-4 py-20 text-center"><PackageOpen className="mx-auto text-[#c45272]" size={38} /><h1 className="section-title mt-4">Esse anúncio não está disponível.</h1><button onClick={() => navigate("/explorar")} className="btn-primary mt-6 px-5 py-3">Voltar a explorar</button></section>;
  const item = toListing(detail.data);
  const ownListing = auth.user?.id === item.ownerId;
  const beginProposal = () => { if (!auth.isAuthenticated) { toast("Entre ou crie sua conta para conversar sobre uma troca."); startLogin(); return; } if (ownListing) { toast.error("Este anúncio é seu."); return; } if (item.status === "reserved") { toast.error("Esse item já tem um encontro marcado."); return; } setProposalOpen(true); };
  const submitProposal = async (event: FormEvent) => { event.preventDefault(); if (!offeredItem.trim() || !message.trim()) { toast.error("Conte qual item você oferece e mande uma mensagem."); return; } try { await createProposal.mutateAsync({ listingId: item.id, offeredItem: offeredItem.trim(), offeredListingId: offeredListingId ? Number(offeredListingId) : undefined, message: message.trim() }); setMessage(""); } catch {} };
  const sendMessage = async (event: FormEvent) => { event.preventDefault(); if (!message.trim() || !proposalId) return; try { await sendMutation.mutateAsync({ proposalId, content: message.trim() }); } catch {} };
  return <section className="mx-auto max-w-[1220px] px-4 py-7 sm:px-6 sm:py-10 lg:px-8"><button onClick={() => navigate("/explorar")} className="mb-6 inline-flex items-center gap-2 text-sm font-extrabold text-[#7f1735] hover:underline"><ArrowLeft size={17} /> Voltar para explorar</button><div className="grid gap-8 lg:grid-cols-[1.05fr_.95fr] lg:gap-12"><div><div className="overflow-hidden rounded-[30px] bg-[#f5dde3] shadow-[0_18px_35px_rgba(100,20,46,0.09)]"><img src={item.image} alt={item.title} className="aspect-square w-full object-cover" /></div><div className="mt-3 flex gap-3"><div className="h-16 w-16 overflow-hidden rounded-2xl border-2 border-[#7c1430] bg-[#f3dbe2]"><img src={item.image} alt="Foto do anúncio" className="h-full w-full object-cover" /></div></div></div><div><span className="rounded-full bg-[#f8dce5] px-3 py-1.5 text-xs font-extrabold text-[#851536]">{item.category}</span>{item.status === "reserved" && <span className="ml-2 rounded-full bg-[#71132e] px-3 py-1.5 text-xs font-extrabold text-white">Encontro marcado</span>}<h1 className="brand-font mt-4 text-4xl font-extrabold leading-[.95] tracking-[-0.045em] text-[#5f1026] sm:text-5xl">{item.title}</h1><div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-[#805c68]"><span className="inline-flex items-center gap-1.5"><MapPin size={16} className="text-[#b52a55]" />{item.location}</span><span className="inline-flex items-center gap-1.5"><Clock3 size={16} className="text-[#b52a55]" />Há {item.posted} dia{item.posted === 1 ? "" : "s"}</span></div><p className="mt-6 whitespace-pre-wrap text-[15px] leading-relaxed text-[#73535e]">{item.description || "Sem descrição adicional."}</p>{item.status === "reserved" && <p className="mt-4 rounded-2xl bg-[#fff1f4] p-4 text-sm font-bold text-[#74102c]">Esse item já tem um encontro marcado e não está aceitando novas propostas agora.</p>}<div className={`mt-6 grid gap-3 ${item.size ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2"}`}><div className="rounded-2xl border border-[#76142f]/10 bg-[#fff7f6] p-4"><p className="text-[10px] font-black uppercase tracking-[0.13em] text-[#a27682]">Como está o item?</p><p className="mt-1 text-sm font-extrabold text-[#65142b]">{item.condition}</p></div>{item.size && <div className="rounded-2xl border border-[#76142f]/10 bg-[#fff7f6] p-4"><p className="text-[10px] font-black uppercase tracking-[0.13em] text-[#a27682]">Tamanho</p><p className="mt-1 text-sm font-extrabold text-[#65142b]">{item.size}</p></div>}<div className="rounded-2xl border border-[#76142f]/10 bg-[#fff7f6] p-4"><p className="text-[10px] font-black uppercase tracking-[0.13em] text-[#a27682]">Quem anunciou</p><p className="mt-1 inline-flex items-center gap-1 text-sm font-extrabold text-[#65142b]">{item.author} <BadgeCheck size={15} className="text-[#c53760]" /></p></div></div><div className="mt-5 rounded-[23px] bg-[#6f0d2a] p-4 text-white sm:p-5"><p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#ffa8c0]">O que {item.author.split(" ")[0]} procura</p><p className="mt-1 text-base font-extrabold">{item.wants}</p></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><button disabled={item.status === "reserved"} onClick={beginProposal} className="btn-secondary inline-flex items-center justify-center gap-2 px-4 py-3.5 text-sm disabled:opacity-50"><HeartHandshake size={18} /> Tenho interesse</button><button disabled={item.status === "reserved"} onClick={beginProposal} className="btn-primary inline-flex items-center justify-center gap-2 px-4 py-3.5 text-sm disabled:opacity-50"><MessageCircle size={18} /> Propor troca</button></div></div></div><section className="mt-12 grid gap-7 lg:grid-cols-[.95fr_1.05fr]"><div className="rounded-[28px] border border-[#75142e]/10 bg-white p-5 sm:p-7"><p className="eyebrow">Uma troca possível</p><h2 className="section-title mt-2 text-3xl">A combinação acontece entre vocês.</h2><div className="mt-6 grid items-center gap-3 sm:grid-cols-[1fr_auto_1fr]"><div className="rounded-2xl bg-[#fce7ed] p-4"><p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#a26d7d]">Você oferece</p><p className="mt-3 text-sm font-extrabold text-[#69152d]">{offeredItem || "Seu item"}</p></div><div className="grid place-items-center text-[#d73d6a]"><span className="brand-font text-4xl font-extrabold">↔</span></div><div className="rounded-2xl bg-[#f8d9e4] p-4"><p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#a26d7d]">Você recebe</p><p className="mt-3 text-sm font-extrabold text-[#69152d]">{item.title}</p></div></div><p className="mt-5 text-sm leading-relaxed text-[#835f6b]">Não há pagamento: conversem, confiram os itens e combinem uma troca justa para os dois lados.</p></div><div className="overflow-hidden rounded-[28px] border border-[#75142e]/10 bg-white shadow-[0_12px_30px_rgba(96,16,39,.06)]"><div className="flex items-center justify-between border-b border-[#75142e]/10 px-5 py-4"><div><p className="text-sm font-extrabold text-[#62152b]">Conversa sobre a troca</p><p className="text-xs font-semibold text-[#a1727f]">{proposalId ? `Com ${item.author}` : "Sua proposta fica salva na sua conta"}</p></div><MessageCircle size={20} className="text-[#8b5f6c]" /></div>{ownListing && proposalsForListing.length > 1 && <div className="flex gap-2 overflow-x-auto border-b border-[#75142e]/10 bg-[#fff8f7] p-3">{proposalsForListing.map((proposal) => <button key={proposal.id} onClick={() => setProposalId(proposal.id)} className={`shrink-0 rounded-2xl px-3 py-2 text-left text-xs transition ${proposal.id === proposalId ? "bg-[#74102c] text-white" : "bg-white text-[#6f3347]"}`}><span className="block font-extrabold">{proposal.otherName}</span><span className={`mt-1 block ${proposal.id === proposalId ? "text-white/75" : "text-[#96717d]"}`}>{proposal.status === "accepted" ? "Troca combinada" : proposal.status === "pending" ? "Aguardando resposta" : proposal.status === "completed" ? "Concluída" : "Encerrada"}</span></button>)}</div>}{!proposalOpen && !proposalId ? <div className="flex min-h-[220px] flex-col items-center justify-center bg-[#fffaf8] p-6 text-center"><p className="max-w-sm text-sm leading-relaxed text-[#87636e]">Apresente o que você tem para oferecer e converse com a pessoa anunciante.</p><button onClick={beginProposal} className="btn-primary mt-5 px-4 py-2.5 text-sm">Começar proposta</button></div> : proposalId ? <><div className="max-h-[330px] min-h-[220px] space-y-3 overflow-y-auto bg-[#fffaf8] p-5">{thread.data?.map((chat) => <div key={chat.id} className={`flex ${chat.senderId === auth.user?.id ? "justify-end" : "justify-start"}`}><div className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${chat.senderId === auth.user?.id ? "rounded-br-md bg-[#74102c] text-white" : "rounded-bl-md bg-[#f6dfe6] text-[#66152c]"}`}><p>{chat.content}</p><p className={`mt-1 text-[10px] ${chat.senderId === auth.user?.id ? "text-white/70" : "text-[#a1727f]"}`}>{chat.senderName || "Pessoa do Trocaí"} · {new Date(chat.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</p></div></div>)}{thread.isFetching && !thread.data?.length && <Loader2 className="mx-auto animate-spin text-[#a12c50]" />}</div>{currentProposal?.status === "pending" && currentProposal.isOwner && <button disabled={updateProposal.isPending} onClick={() => updateProposal.mutate({ proposalId: currentProposal.id, status: "accepted" })} className="mx-4 mt-3 rounded-full bg-[#f8dce5] px-4 py-2 text-xs font-extrabold text-[#7b1532] disabled:opacity-50">Aceitar proposta</button>}{currentProposal?.status === "accepted" && <div className="mx-4 mt-3 rounded-2xl bg-[#fff1f4] p-3"><p className="text-xs leading-relaxed text-[#805f69]">{alreadyConfirmed ? (otherConfirmed ? "Vocês dois confirmaram a troca." : "Você confirmou. Falta a outra pessoa confirmar.") : otherConfirmed ? "A outra pessoa já confirmou. Confira o item com calma antes de confirmar também." : "Depois de conferir os itens juntos, cada pessoa precisa confirmar para encerrar a troca."}</p>{!alreadyConfirmed && meetingPlan.data?.current?.status === "confirmed" && new Date(meetingPlan.data.current.scheduledAt).getTime() <= Date.now() && <button disabled={confirmCompletion.isPending} onClick={() => setCompletionDialogOpen(true)} className="mt-2 rounded-full bg-[#f8dce5] px-4 py-2 text-xs font-extrabold text-[#7b1532] disabled:opacity-50">{otherConfirmed ? "Confirmar conclusão" : "Marcar troca como concluída"}</button>}</div>}{currentProposal?.status === "completed" && <p className="mx-4 mt-3 rounded-2xl bg-[#f8dce5] p-3 text-xs font-bold text-[#6d1833]">Troca concluída: as duas pessoas confirmaram.</p>}{(currentProposal?.status === "accepted" || currentProposal?.status === "completed" || currentProposal?.status === "cancelled") && currentProposal && <SwapWorkflow key={currentProposal.id} proposalId={currentProposal.id} listingId={item.id} listingTitle={item.title} isOwner={currentProposal.isOwner} proposalStatus={currentProposal.status} onChanged={() => { void detail.refetch(); void meetingPlan.refetch(); }} />}<form onSubmit={sendMessage} className="flex items-center gap-2 border-t border-[#75142e]/10 p-3"><input value={message} onChange={(event) => setMessage(event.target.value)} disabled={Boolean(currentProposal && ["completed", "cancelled", "declined"].includes(currentProposal.status))} placeholder={currentProposal && ["completed", "cancelled", "declined"].includes(currentProposal.status) ? "Esta conversa foi encerrada." : "Escreva uma mensagem…"} className="min-w-0 flex-1 rounded-xl bg-[#fff8f7] px-3 py-2.5 text-sm outline-none placeholder:text-[#aa8490] disabled:cursor-not-allowed disabled:opacity-60" /><button disabled={sendMutation.isPending || Boolean(currentProposal && ["completed", "cancelled", "declined"].includes(currentProposal.status))} className="grid h-10 w-10 place-items-center rounded-xl bg-[#f15683] text-white disabled:opacity-60"><Send size={17} /></button></form></> : <form onSubmit={submitProposal} className="space-y-4 bg-[#fffaf8] p-5"><label className="form-label">Quer oferecer um dos seus anúncios?<select value={offeredListingId} onChange={(event) => { const value = event.target.value; setOfferedListingId(value); const selected = myListings.data?.find((listing) => listing.id === Number(value)); if (selected) setOfferedItem(selected.title); }}><option value="">Outro item (escreva abaixo)</option>{(myListings.data || []).filter((listing) => listing.status === "active").map((listing) => <option key={listing.id} value={String(listing.id)}>{listing.title}</option>)}</select></label><p className="-mt-2 text-[11px] leading-relaxed text-[#85636e]">Se você escolher um anúncio seu, ele também ficará reservado quando as duas pessoas confirmarem o encontro. Se escrever outro item, só o anúncio desta página pode ser reservado.</p><label className="form-label">O que você oferece?<input value={offeredItem} onChange={(event) => setOfferedItem(event.target.value)} required maxLength={200} placeholder="Ex.: um livro de ficção" /></label><label className="form-label">Mensagem para {item.author}<textarea value={message} onChange={(event) => setMessage(event.target.value)} required maxLength={2000} rows={3} placeholder="Conte por que gostaria de trocar…" /></label><button disabled={createProposal.isPending} className="btn-primary inline-flex w-full items-center justify-center gap-2 px-4 py-3 text-sm disabled:opacity-60">{createProposal.isPending && <Loader2 size={16} className="animate-spin" />} Enviar proposta de troca</button>{!auth.isAuthenticated && <p className="text-center text-xs text-[#8b6471]">Você entrará ou criará sua conta ao continuar.</p>}</form>}</div></section><div className="mt-7 flex items-start gap-3 rounded-[20px] bg-[#fff0f2] p-4 text-sm leading-relaxed text-[#6c3343]"><ShieldCheck className="mt-0.5 shrink-0 text-[#af2550]" size={19} /><span><b>Troque com cuidado.</b> Prefira locais públicos, confira o item e evite compartilhar dados pessoais desnecessários.</span></div>{ownListing ? <ChainFinder listingId={item.id} navigate={navigate} /> : <section className="mt-8 rounded-[28px] border border-[#ce6b89]/25 bg-[#fff4f3] p-5 sm:p-7"><p className="eyebrow">Troca em troca</p><h2 className="brand-font mt-1 text-3xl font-extrabold leading-[.98] tracking-[-.04em] text-[#681029]">Não achou uma troca direta?</h2><p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#795864]">Anuncie o que você tem e o que quer receber. Se os anúncios combinarem, o Trocaí pode sugerir um caminho com outras pessoas — sem compra e sem venda.</p><button onClick={() => navigate("/anunciar")} className="btn-primary mt-4 inline-flex items-center gap-2 px-4 py-3 text-sm">Anunciar o que eu tenho <ArrowRight size={16} /></button></section>}{completionDialogOpen && currentProposal?.status === "accepted" && !alreadyConfirmed && <div className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-[#32101d]/55 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setCompletionDialogOpen(false); }}><div role="dialog" aria-modal="true" aria-labelledby="completion-warning-title" aria-describedby="completion-warning-copy" className="my-6 w-full max-w-lg rounded-[28px] border border-[#76142f]/10 bg-[#fffaf6] p-5 shadow-[0_25px_80px_rgba(41,8,20,.35)] sm:p-7"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#f9dce5] text-[#79142f]"><ShieldCheck size={24} /></div><p className="eyebrow mt-5">Antes de encerrar</p><h2 id="completion-warning-title" className="brand-font mt-2 text-3xl font-extrabold leading-tight text-[#64142b]">Confira os itens com calma.</h2><p id="completion-warning-copy" className="mt-4 text-sm leading-relaxed text-[#745560]">O Trocaí aproxima pessoas, mas não participa da entrega nem inspeciona os objetos. Por isso, não podemos garantir que o item corresponda às fotos ou à descrição, nem assegurar que não ocorram fraudes ou golpes. Antes de confirmar, confira o item pessoalmente e veja se está de acordo com o combinado.</p><p className="mt-3 rounded-2xl bg-[#fff0f3] p-3 text-xs leading-relaxed text-[#73364a]">Se algo estiver diferente, parecer suspeito ou você não se sentir segura, escolha “Voltar atrás” e não conclua a troca. A troca só será marcada como concluída depois que as duas pessoas confirmarem. Esta confirmação não elimina direitos previstos em lei.</p><div className="mt-6 grid gap-2 sm:grid-cols-2"><button type="button" onClick={() => setCompletionDialogOpen(false)} className="rounded-full border border-[#8d304c]/20 bg-white px-4 py-3 text-sm font-extrabold text-[#71152f] transition hover:bg-[#fff1f4]">Voltar atrás</button><button type="button" disabled={confirmCompletion.isPending} onClick={() => confirmCompletion.mutate({ proposalId: currentProposal.id })} className="rounded-full bg-[#74102c] px-4 py-3 text-sm font-extrabold text-white transition hover:bg-[#8c183b] disabled:cursor-wait disabled:opacity-60">{confirmCompletion.isPending ? "Salvando confirmação…" : "Concluir a troca"}</button></div></div></div>}</section>;
}

function AnnouncePage({ navigate }: { navigate: (href: string) => void }) {
  const auth = useAuth();
  const utils = trpc.useUtils();
  const [publishedId, setPublishedId] = useState<number | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preparingPhoto, setPreparingPhoto] = useState(false);
  const [photoUrl, setPhotoUrl] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ title: "", category: "Livros" as ListingCategory, condition: "Quase novo" as ListingCondition, size: "", wants: "", location: "", description: "" });
  const create = trpc.marketplace.listings.create.useMutation({ onSuccess: async (result) => { if (!Number.isSafeInteger(result.id) || result.id < 1) { toast.error("Não recebemos a confirmação de que o anúncio foi salvo. Seus dados continuam no formulário."); return; } setPublishedId(result.id); await Promise.allSettled([utils.marketplace.listings.list.invalidate(), utils.marketplace.listings.mine.invalidate(), utils.marketplace.listings.byId.invalidate({ id: result.id }), utils.admin.overview.invalidate()]); window.scrollTo({ top: 0, behavior: "smooth" }); } });
  useEffect(() => { if (!photo) { setPhotoUrl(""); return; } const url = URL.createObjectURL(photo); setPhotoUrl(url); return () => URL.revokeObjectURL(url); }, [photo]);
  const update = (key: keyof typeof form, value: string) => setForm((data) => ({ ...data, [key]: value }));
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!auth.isAuthenticated) { toast("Entre ou crie sua conta para publicar."); startLogin(); return; }
    if (!form.title.trim() || !form.wants.trim() || !form.location.trim()) { toast.error("Preencha o nome do item, o que você quer receber e sua região."); return; }
    if ((form.category === "Roupas" || form.category === "Calçados") && !form.size) { toast.error("Escolha o tamanho do item."); return; }
    if (photo && photo.size > 3 * 1024 * 1024) { toast.error("A foto deve ter até 3 MB."); return; }
    if (photo && !["image/jpeg", "image/png", "image/webp"].includes(photo.type)) { toast.error("Escolha uma foto JPEG, PNG ou WebP."); return; }
    try {
      setPreparingPhoto(Boolean(photo));
      const imageBase64 = photo ? await fileToBase64(photo) : undefined;
      setPreparingPhoto(false);
      const result = await create.mutateAsync({ ...form, size: form.size || undefined, imageBase64, imageContentType: photo?.type as "image/jpeg" | "image/png" | "image/webp" | undefined });
      if (!Number.isSafeInteger(result.id) || result.id < 1) throw new Error("O anúncio não recebeu um ID salvo. Seus dados continuam no formulário; tente novamente.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível publicar. Seus dados continuam no formulário; tente novamente.");
    } finally {
      setPreparingPhoto(false);
    }
  };
  if (auth.loading) return <div className="flex min-h-[55vh] items-center justify-center"><Loader2 className="animate-spin text-[#a12c50]" /></div>;
  if (!auth.isAuthenticated) return <section className="mx-auto max-w-[760px] px-4 py-16 text-center sm:px-6 sm:py-24"><div className="mx-auto grid h-20 w-20 place-items-center rounded-[28px] bg-[#f9c5d6] text-[#71112c]"><UserRound size={36} /></div><p className="eyebrow mt-7">Sua comunidade Trocaí</p><h1 className="brand-font mt-2 text-5xl font-extrabold tracking-[-.05em] text-[#661029]">Entre para anunciar.</h1><p className="mx-auto mt-4 max-w-lg text-[15px] leading-relaxed text-[#795866]">Entre ou crie sua conta para publicar um item. Depois, você pode receber propostas e conversar com outras pessoas.</p><button onClick={() => startLogin()} className="btn-primary mt-7 px-6 py-3.5 text-sm">Entrar ou criar conta</button></section>;
  if (publishedId) return <section className="mx-auto max-w-[760px] px-4 py-16 text-center sm:px-6 sm:py-24"><div className="mx-auto grid h-20 w-20 place-items-center rounded-[28px] bg-[#f9c5d6] text-[#71112c]"><Check size={38} strokeWidth={2.8} /></div><p className="eyebrow mt-7">Tudo pronto</p><h1 className="brand-font mt-2 text-5xl font-extrabold tracking-[-.05em] text-[#661029]">Seu anúncio foi publicado!</h1><p className="mx-auto mt-4 max-w-lg text-[15px] leading-relaxed text-[#795866]">O anúncio <b>{form.title}</b> já está no Trocaí. Agora as pessoas podem propor uma troca — sem dinheiro.</p><div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row"><button onClick={() => navigate(`/produto/${publishedId}`)} className="btn-primary px-5 py-3.5 text-sm">Ver anúncio</button><button onClick={() => navigate("/explorar")} className="btn-secondary px-5 py-3.5 text-sm">Explorar anúncios</button><button onClick={() => { setPublishedId(null); setPhoto(null); setForm({ title: "", category: "Livros", condition: "Quase novo", size: "", wants: "", location: "", description: "" }); }} className="btn-secondary px-5 py-3.5 text-sm">Anunciar outra coisa</button></div></section>;
  return <section className="mx-auto max-w-[1000px] px-4 py-9 sm:px-6 sm:py-12"><div className="max-w-2xl"><p className="eyebrow">Novo anúncio</p><h1 className="section-title mt-2">Anuncie algo que você tem.</h1><p className="mt-3 text-sm leading-relaxed text-[#80616d]">Escolha a categoria, conte como o item está e diga o que você quer receber. É rapidinho.</p></div><form onSubmit={submit} className="mt-8 grid gap-6 lg:grid-cols-[.8fr_1.2fr]"><aside className="rounded-[28px] border border-dashed border-[#bd5472]/35 bg-[#fff6f6] p-6"><input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
          toast.error("Escolha uma foto JPEG, PNG ou WebP.");
          event.target.value = "";
          return;
        }
        if (file.size > 3 * 1024 * 1024) {
          toast.error("A foto deve ter até 3 MB.");
          event.target.value = "";
          return;
        }
        setPhoto(file);
      }} /><button type="button" onClick={() => fileRef.current?.click()} className="grid aspect-square w-full place-items-center overflow-hidden rounded-[22px] bg-[#f9dce5] text-center">{photoUrl ? <img src={photoUrl} alt="Prévia da foto do item" className="h-full w-full object-cover" /> : <div><div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-white text-[#a52851] shadow-sm"><Camera size={25} /></div><p className="mt-4 text-sm font-extrabold text-[#78172f]">Adicione uma foto</p><p className="mt-1 px-5 text-xs leading-relaxed text-[#966b77]">JPEG, PNG ou WebP · até 3 MB.</p><span className="mt-4 inline-flex rounded-full bg-white px-4 py-2 text-xs font-extrabold text-[#881a3c] shadow-sm">Escolher foto</span></div>}</button>{photo && <button type="button" onClick={() => { setPhoto(null); if (fileRef.current) fileRef.current.value = ""; }} className="mt-3 text-xs font-bold text-[#9c2144] underline">Remover foto</button>}<p className="mt-4 text-xs leading-relaxed text-[#936674]">Dica: tire a foto em um lugar claro e mostre os detalhes do item.</p></aside><div className="rounded-[28px] border border-[#76142f]/10 bg-white p-5 shadow-[0_12px_30px_rgba(96,16,39,.05)] sm:p-7"><div className="form-grid"><label>O que você vai trocar?<input value={form.title} onChange={(event) => update("title", event.target.value)} required maxLength={160} placeholder="Ex.: tênis, blusa ou livro" /></label><label>Categoria<select value={form.category} onChange={(event) => setForm((data) => ({ ...data, category: event.target.value as ListingCategory, size: "" }))}>{categories.map((category) => <option key={category.name}>{category.name}</option>)}</select></label>{(form.category === "Roupas" || form.category === "Calçados") && <label>Qual é o tamanho?<select value={form.size} onChange={(event) => update("size", event.target.value)} required><option value="" disabled>Escolha o tamanho</option>{(form.category === "Calçados" ? footwearSizes : clothingSizes).map((size) => <option key={size} value={size}>{size}</option>)}</select></label>}<label className="form-wide">Conta um pouco sobre o item<textarea value={form.description} onChange={(event) => update("description", event.target.value)} rows={4} maxLength={4000} placeholder="Tem algum detalhe importante? Escreva aqui." /></label><label>Como está o item?<select value={form.condition} onChange={(event) => update("condition", event.target.value as ListingCondition)}>{conditionOptions.map((option) => <option key={option}>{option}</option>)}</select></label><label>Onde você está?<input value={form.location} onChange={(event) => update("location", event.target.value)} required maxLength={160} placeholder="Bairro ou cidade" /></label><label className="form-wide">O que você quer receber?<input value={form.wants} onChange={(event) => update("wants", event.target.value)} required maxLength={255} placeholder="Ex.: um livro, um fone ou uma mochila" /></label><p className="form-wide -mt-2 text-xs leading-relaxed text-[#8e6973]">Pode colocar mais de uma coisa. Isso ajuda a encontrar uma troca que combine.</p></div><div className="mt-6 flex items-start gap-3 rounded-2xl bg-[#fff0f3] p-3.5 text-xs leading-relaxed text-[#753a4b]"><ShieldCheck size={17} className="mt-0.5 shrink-0 text-[#ae2a50]" />Lembre-se: não inclua dados pessoais ou endereço no anúncio. Esses detalhes ficam para a conversa, quando vocês se sentirem confortáveis.</div><button disabled={create.isPending || preparingPhoto} className="btn-primary mt-6 inline-flex w-full items-center justify-center gap-2 px-5 py-3.5 text-sm disabled:opacity-60">{preparingPhoto || create.isPending ? <Loader2 size={17} className="animate-spin" /> : <Sparkles size={17} />} {preparingPhoto ? "Preparando a foto…" : create.isPending ? "Publicando…" : "Publicar anúncio"}</button></div></form></section>;
}

function HowItWorksPage({ navigate }: { navigate: (href: string) => void }) {
  const steps = [
    { title: "Encontre", text: "Procure algo que gostaria de receber.", icon: Search, n: "1" },
    { title: "Veja a oferta", text: "Descubra o que a pessoa tem e o que gostaria de receber.", icon: CircleHelp, n: "2" },
    { title: "Combine", text: "Conversem e vejam se a troca é boa para todo mundo.", icon: MessageCircle, n: "3" },
    { title: "Troque", text: "Combinem um lugar seguro e confiram os objetos.", icon: Handshake, n: "4" },
  ];
  const people = [
    { who: "Você", has: "Celular", wants: "Fone de ouvido" },
    { who: "Sua mãe", has: "Pulseira", wants: "Celular" },
    { who: "Outra pessoa", has: "Fone de ouvido", wants: "Pulseira" },
  ];
  const transfers = [
    { from: "Você", item: "celular", to: "sua mãe" },
    { from: "Sua mãe", item: "pulseira", to: "a pessoa que tem o fone" },
    { from: "A outra pessoa", item: "fone de ouvido", to: "você" },
  ];
  return (
    <>
      <section className="bg-[#fff0ed] px-4 py-14 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-[850px] text-center">
          <p className="eyebrow">Sem complicação e sem dinheiro</p>
          <h1 className="brand-font mt-2 text-5xl font-extrabold leading-[.94] tracking-[-.055em] text-[#681029] sm:text-6xl">Trocas diretas ou em cadeia. <span className="text-[#f05282]">Os objetos continuam circulando.</span></h1>
          <p className="mx-auto mt-5 max-w-2xl text-[15px] leading-relaxed text-[#795864]">No Trocaí, você oferece o que tem e conta o que gostaria de receber. Não é compra e venda: aqui não há preços nem pagamentos, só pessoas combinando trocas.</p>
        </div>
      </section>

      <section className="mx-auto max-w-[1000px] px-4 py-12 sm:px-6 sm:py-16">
        <p className="eyebrow">Quatro passos</p>
        <h2 className="section-title mt-2">Comece do seu jeito.</h2>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {steps.map((step) => { const Icon = step.icon; return <article key={step.title} className="rounded-[24px] border border-[#75142e]/10 bg-white p-5 sm:p-6"><div className="flex items-center justify-between"><span className="brand-font text-3xl font-extrabold text-[#ef7b9e]">0{step.n}</span><Icon size={22} className="text-[#8c1b3c]" /></div><h3 className="mt-3 text-lg font-extrabold text-[#62142a]">{step.title}</h3><p className="mt-1.5 text-sm leading-relaxed text-[#82606b]">{step.text}</p></article>; })}
        </div>
      </section>

      <section className="border-y border-[#7c1430]/[0.07] bg-white px-4 py-12 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-[1000px]">
          <p className="eyebrow">Quando uma pessoa encontra a outra</p>
          <h2 className="section-title mt-2">Como funciona uma troca?</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#80616d]">A troca é direta quando cada pessoa tem algo que a outra quer.</p>
          <div className="mt-6 grid items-stretch gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
            <div className="rounded-[23px] bg-[#fff1f4] p-5"><p className="text-xs font-black uppercase tracking-[.12em] text-[#a37683]">Você tem</p><p className="mt-1 text-xl font-extrabold text-[#68132b]">um celular</p><p className="mt-2 text-sm text-[#805f69]">e quer um fone de ouvido.</p></div>
            <div className="grid place-items-center text-[#d73d6a]"><ArrowRight className="hidden sm:block" size={24} /><span className="brand-font text-3xl font-extrabold sm:hidden">↕</span></div>
            <div className="rounded-[23px] bg-[#fae0e8] p-5"><p className="text-xs font-black uppercase tracking-[.12em] text-[#a37683]">Outra pessoa tem</p><p className="mt-1 text-xl font-extrabold text-[#68132b]">um fone</p><p className="mt-2 text-sm text-[#805f69]">e quer um celular.</p></div>
          </div>
          <div className="mt-4 flex items-start gap-3 rounded-[20px] bg-[#fff7f5] p-4 text-sm leading-relaxed text-[#6c3343]"><Coins className="mt-0.5 shrink-0 text-[#b22c54]" size={19} /><p>Se os dois concordarem, trocam os objetos. <b>Ninguém paga ou compra nada.</b></p></div>
        </div>
      </section>

      <section className="bg-[#fff4ea] px-4 py-12 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-[1000px]">
          <p className="eyebrow">Uma troca em troca</p>
          <h2 className="brand-font mt-2 text-4xl font-extrabold leading-[.98] tracking-[-.05em] text-[#681029] sm:text-5xl">E se ninguém tiver exatamente o que eu quero?</h2>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-[#795864]">Você não precisa encontrar uma pessoa que tenha o que você quer <i>e</i> queira exatamente o que você tem. Às vezes, outras pessoas ajudam o objeto a chegar até você.</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {people.map((person) => <article key={person.who} className="rounded-[23px] border border-[#75142e]/10 bg-white p-5 shadow-[0_8px_22px_rgba(102,23,48,.05)]"><p className="text-xs font-black uppercase tracking-[.12em] text-[#a1274e]">{person.who}</p><p className="mt-3 text-sm text-[#805f69]">Tem: <b className="text-[#64142b]">{person.has}</b></p><p className="mt-1 text-sm text-[#805f69]">Quer: <b className="text-[#64142b]">{person.wants}</b></p></article>)}
          </div>
          <div className="mt-6 rounded-[26px] bg-[#6f0e2b] p-5 text-white sm:p-7">
            <p className="text-xs font-black uppercase tracking-[.14em] text-[#ffb0c5]">Olha como pode acontecer</p>
            <ol className="mt-4 space-y-3">
              {transfers.map((transfer, index) => <li key={index} className="flex items-start gap-3 rounded-2xl bg-white/10 p-3.5 text-sm leading-relaxed sm:p-4"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#f6a9c0] text-xs font-black text-[#6f0e2b]">{index + 1}</span><span><b>{transfer.from}</b> entrega o <b>{transfer.item}</b> para {transfer.to}.</span></li>)}
            </ol>
            <p className="mt-4 rounded-2xl bg-white/10 p-4 text-sm leading-relaxed"><b>No fim:</b> você fica com o fone, sua mãe fica com o celular e a outra pessoa fica com a pulseira.</p>
          </div>
          <div className="mt-4 flex items-start gap-3 rounded-[20px] border border-[#c64d70]/20 bg-white p-4 text-sm leading-relaxed text-[#6c3343]"><HeartHandshake className="mt-0.5 shrink-0 text-[#b22c54]" size={19} /><p>O Trocaí pode sugerir caminhos quando os anúncios combinam. <b>Cada pessoa precisa topar e combinar cada troca.</b> São objetos circulando entre pessoas — não há compra nem venda.</p></div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row"><button onClick={() => navigate("/anunciar")} className="btn-primary inline-flex items-center justify-center gap-2 px-5 py-3.5 text-sm">Anunciar o que eu tenho <ArrowRight size={17} /></button><button onClick={() => navigate("/explorar")} className="btn-secondary inline-flex items-center justify-center gap-2 px-5 py-3.5 text-sm">Ver anúncios <Search size={17} /></button></div>
        </div>
      </section>

      <section className="mx-auto max-w-[1000px] px-4 py-12 sm:px-6 sm:py-16">
        <div className="rounded-[28px] bg-[#6f0e2b] p-7 text-white sm:flex sm:items-center sm:justify-between sm:p-9"><div><p className="text-xs font-black uppercase tracking-[.15em] text-[#ffabc0]">Pronto para começar?</p><h2 className="brand-font mt-2 text-3xl font-extrabold tracking-[-.04em]">Sua próxima troca pode começar agora.</h2></div><button onClick={() => navigate("/explorar")} className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-extrabold text-[#71122d] transition hover:-translate-y-0.5 sm:mt-0">Quero explorar <ArrowRight size={17} /></button></div>
      </section>
    </>
  );
}

function ProfilePage({ navigate }: { navigate: (href: string) => void }) {
  const auth = useAuth();
  const utils = trpc.useUtils();
  const [tab, setTab] = useState<"listings" | "swaps">("listings");
  const updateListingStatus = trpc.marketplace.listings.updateStatus.useMutation({
    onSuccess: async (_result, input) => {
      await Promise.allSettled([
        utils.marketplace.listings.mine.invalidate(),
        utils.marketplace.listings.list.invalidate(),
        utils.marketplace.listings.byId.invalidate({ id: input.id }),
        utils.admin.overview.invalidate(),
      ]);
      toast.success(input.status === "paused" ? "Anúncio tirado do ar. Você pode reativá-lo quando quiser." : "Anúncio reativado e disponível para troca.");
    },
    onError: (error) => toast.error(error.message),
  });
  const mine = trpc.marketplace.listings.mine.useQuery(undefined, { enabled: auth.isAuthenticated });
  const swaps = trpc.marketplace.proposals.mine.useQuery(undefined, { enabled: auth.isAuthenticated });
  const reviewSummary = trpc.marketplace.exchange.reviews.mySummary.useQuery(undefined, { enabled: auth.isAuthenticated });
  if (auth.loading) return <div className="flex min-h-[55vh] items-center justify-center"><Loader2 className="animate-spin text-[#a12c50]" /></div>;
  if (!auth.user) return <section className="mx-auto max-w-[760px] px-4 py-16 text-center sm:px-6 sm:py-24"><div className="mx-auto grid h-20 w-20 place-items-center rounded-[28px] bg-[#f9c5d6] text-[#71112c]"><UserRound size={36} /></div><p className="eyebrow mt-7">Seu perfil</p><h1 className="brand-font mt-2 text-5xl font-extrabold tracking-[-.05em] text-[#661029]">Entre para ver sua conta.</h1><p className="mx-auto mt-4 max-w-lg text-[15px] leading-relaxed text-[#795866]">Seus anúncios, propostas e conversas ficam reunidos em um só lugar.</p><button onClick={() => startLogin()} className="btn-primary mt-7 px-6 py-3.5 text-sm">Entrar ou criar conta</button></section>;
  const name = auth.user.name || "Pessoa do Trocaí";
  const initials = name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const ads = (mine.data || []).map((item) => toListing(item));
  const conversations = swaps.data || [];
  const completed = conversations.filter((item) => item.status === "completed").length;
  const reserved = ads.filter((item) => item.status === "reserved").length;
  return <section className="mx-auto max-w-[1120px] px-4 py-8 sm:px-6 sm:py-12"><div className="overflow-hidden rounded-[30px] border border-[#75142e]/10 bg-white"><div className="h-28 bg-[#6f0e2b] sm:h-36"><div className="paper-dots h-full opacity-40" /></div><div className="relative px-5 pb-6 sm:px-8"><div className="relative z-10 -mt-12 flex flex-col gap-4 sm:-mt-8 sm:flex-row sm:items-end sm:justify-between"><div className="flex flex-col items-start gap-2 sm:flex-row sm:items-end sm:gap-4"><div className="grid h-24 w-24 place-items-center rounded-[30px] border-[5px] border-white bg-[#f3aec5] text-2xl font-black text-[#76132e] shadow-lg">{initials}</div><div className="pb-1"><h1 className="text-2xl font-extrabold tracking-[-.03em] text-[#5f1227]">{name} <BadgeCheck className="inline text-[#c1325b]" size={18} /></h1><p className="mt-1 flex items-center gap-1 text-sm font-semibold text-[#84616d]"><MapPin size={14} /> A região aparece nos seus anúncios</p></div></div><button onClick={() => { void auth.logout(); toast("Você saiu da sua conta."); }} className="btn-secondary inline-flex items-center gap-2 px-4 py-2.5 text-sm"><LogOut size={15} /> Sair</button></div><p className="mt-5 max-w-2xl text-sm leading-relaxed text-[#795862]">Aqui ficam seus anúncios e suas conversas. Trocas são feitas entre pessoas, sem compra nem venda.</p><div className="mt-6 grid grid-cols-3 gap-3 sm:max-w-lg"><div className="rounded-2xl bg-[#fff2f4] p-3 text-center"><p className="brand-font text-2xl font-extrabold text-[#70102b]">{mine.isLoading ? "…" : ads.length}</p><p className="text-[10px] font-black uppercase tracking-[.11em] text-[#9e6c7b]">Anúncios</p></div><div className="rounded-2xl bg-[#fff2f4] p-3 text-center"><p className="brand-font text-2xl font-extrabold text-[#70102b]">{swaps.isLoading ? "…" : conversations.length}</p><p className="text-[10px] font-black uppercase tracking-[.11em] text-[#9e6c7b]">Conversas</p></div><div className="rounded-2xl bg-[#fff2f4] p-3 text-center"><p className="brand-font text-2xl font-extrabold text-[#70102b]">{swaps.isLoading ? "…" : completed}</p><p className="text-[10px] font-black uppercase tracking-[.11em] text-[#9e6c7b]">Trocas concluídas</p></div></div></div>{reviewSummary.data?.reviews.length ? <section className="mt-5 rounded-2xl bg-[#fff7f6] p-4"><p className="text-xs font-black uppercase tracking-wide text-[#a04461]">O que disseram sobre suas trocas</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{reviewSummary.data.reviews.slice(0, 4).map((review, index) => <article key={`${review.proposalId}-${index}`} className="rounded-xl bg-white p-3"><p className="flex items-center gap-1 text-sm font-extrabold text-[#7b1532]"><Star size={15} fill="currentColor" />{review.rating}/5</p><p className="mt-1 text-[11px] text-[#805f69]">{review.met ? "Encontro realizado" : "Encontro não aconteceu"} · {review.itemMatched ? "Item como combinado" : "Item diferente do combinado"}</p>{review.comment && <p className="mt-2 text-xs leading-relaxed text-[#694954]">“{review.comment}”</p>}</article>)}</div></section> : null}</div><div className="mt-8 grid gap-7 lg:grid-cols-[230px_1fr]"><aside className="rounded-[24px] border border-[#75142e]/10 bg-white p-3"><button onClick={() => setTab("listings")} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-extrabold ${tab === "listings" ? "bg-[#f8dce5] text-[#7b1532]" : "text-[#7f5c68] hover:bg-[#fff4f5]"}`}><PackageOpen size={17} /> Meus anúncios</button><button onClick={() => setTab("swaps")} className={`mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold ${tab === "swaps" ? "bg-[#f8dce5] text-[#7b1532]" : "text-[#7f5c68] hover:bg-[#fff4f5]"}`}><Handshake size={17} /> Minhas trocas</button><div className="mt-3 rounded-xl bg-[#fff4f5] p-3 text-xs leading-relaxed text-[#805f69]"><p className="font-extrabold text-[#64142b]">Trocadores do Trocaí</p><p className="mt-1">{reviewSummary.isLoading ? "Carregando avaliações…" : reviewSummary.data?.count ? `Sua reputação: ${reviewSummary.data.average?.toFixed(1)} de 5 · ${reviewSummary.data.count} avaliações públicas` : "Sua reputação aparece depois que as duas pessoas avaliarem a troca."}</p></div></aside><div><div className="mb-5 flex items-center justify-between"><div><p className="eyebrow">{tab === "listings" ? "Meus anúncios" : "Minhas trocas"}</p><h2 className="section-title mt-1 text-3xl">{tab === "listings" ? "Em movimento" : "Conversas e propostas"}</h2></div>{tab === "listings" && <button onClick={() => navigate("/anunciar")} className="btn-primary inline-flex items-center gap-2 px-4 py-2.5 text-sm"><Plus size={16} /> Novo</button>}</div>{tab === "listings" ? mine.isLoading ? <Loader2 className="mx-auto my-12 animate-spin text-[#a12c50]" /> : ads.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5">{ads.map((item) => <div key={item.id} className="min-w-0"><ListingCard item={item} navigate={navigate} compact /><div className="mt-2 rounded-2xl bg-white p-3 shadow-[0_5px_16px_rgba(102,23,48,.05)]"><p className="text-[11px] font-extrabold text-[#64142b]">{item.status === "paused" ? "Anúncio fora do ar" : "Anúncio disponível"}</p><p className="mt-1 min-h-8 text-[10px] leading-relaxed text-[#85636e]">{item.status === "paused" ? "Só você vê. Reative quando quiser." : "Outras pessoas podem encontrar este item."}</p><button type="button" disabled={updateListingStatus.isPending} aria-label={item.status === "paused" ? `Reativar ${item.title}` : `Tirar ${item.title} do ar`} onClick={() => updateListingStatus.mutate({ id: item.id, status: item.status === "paused" ? "active" : "paused" })} className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-[#a12c50]/20 bg-[#fff7f6] px-2 py-2 text-[10px] font-extrabold text-[#851536] transition hover:bg-[#f9e1e8] active:scale-[0.97] disabled:cursor-wait disabled:opacity-60">{item.status === "paused" ? <Eye size={14} /> : <EyeOff size={14} />}{item.status === "paused" ? "Reativar anúncio" : "Tirar do ar"}</button></div></div>)}</div> : <div className="rounded-[26px] border border-dashed border-[#bc4a6b]/30 bg-[#fff7f5] px-6 py-12 text-center"><PackageOpen className="mx-auto text-[#c45272]" size={30} /><p className="mt-3 font-extrabold text-[#64142b]">Você ainda não tem anúncios.</p><button onClick={() => navigate("/anunciar")} className="btn-primary mt-4 px-4 py-2.5 text-sm">Publicar meu primeiro anúncio</button></div> : swaps.isLoading ? <Loader2 className="mx-auto my-12 animate-spin text-[#a12c50]" /> : conversations.length ? <div className="space-y-3">{conversations.map((proposal) => <button key={proposal.id} onClick={() => navigate(`/produto/${proposal.listingId}`)} className="flex w-full items-center justify-between gap-4 rounded-2xl border border-[#75142e]/10 bg-white p-4 text-left hover:border-[#cf6b88]/40"><div><p className="font-extrabold text-[#64142b]">{proposal.listingTitle}</p><p className="mt-1 text-sm text-[#85636e]">Com {proposal.otherName} · oferecendo {proposal.offeredItem}</p></div><span className="rounded-full bg-[#f8dce5] px-3 py-1 text-xs font-extrabold text-[#851536]">{proposal.status === "pending" ? "Pendente" : proposal.status === "accepted" ? "Aceita" : proposal.status === "completed" ? "Concluída" : "Encerrada"}</span></button>)}</div> : <div className="rounded-[26px] border border-dashed border-[#bc4a6b]/30 bg-[#fff7f5] px-6 py-12 text-center"><MessageCircle className="mx-auto text-[#c45272]" size={30} /><p className="mt-3 font-extrabold text-[#64142b]">Suas propostas aparecerão aqui.</p><button onClick={() => navigate("/explorar")} className="btn-secondary mt-4 px-4 py-2.5 text-sm">Explorar anúncios</button></div>}</div></div></section>;
}

function NotificationsPage({ navigate }: { navigate: (href: string) => void }) {
  const auth = useAuth();
  const utils = trpc.useUtils();
  const alerts = trpc.notifications.mine.useQuery(undefined, { enabled: auth.isAuthenticated, refetchInterval: 30_000 });
  const markRead = trpc.notifications.markRead.useMutation({ onSuccess: () => { void utils.notifications.mine.invalidate(); void utils.notifications.unreadCount.invalidate(); } });
  const markAllRead = trpc.notifications.markAllRead.useMutation({ onSuccess: () => { void utils.notifications.mine.invalidate(); void utils.notifications.unreadCount.invalidate(); toast.success("Pronto, todos os avisos foram marcados como lidos."); } });
  if (auth.loading) return <section className="mx-auto flex min-h-[55vh] max-w-[850px] items-center justify-center"><Loader2 className="animate-spin text-[#a12c50]" /></section>;
  if (!auth.user) return <section className="mx-auto max-w-[760px] px-4 py-16 text-center sm:px-6 sm:py-24"><div className="mx-auto grid h-20 w-20 place-items-center rounded-[28px] bg-[#f9c5d6] text-[#71112c]"><Bell size={34} /></div><p className="eyebrow mt-7">Seus avisos</p><h1 className="brand-font mt-2 text-5xl font-extrabold tracking-[-.05em] text-[#661029]">Entre para acompanhar.</h1><p className="mx-auto mt-4 max-w-lg text-[15px] leading-relaxed text-[#795866]">Quando alguém tiver interesse em uma troca ou responder sua proposta, você vai ver por aqui.</p><button onClick={() => startLogin()} className="btn-primary mt-7 px-6 py-3.5 text-sm">Entrar ou criar conta</button></section>;
  const unread = alerts.data?.filter((item) => !item.readAt).length || 0;
  const openAlert = async (item: NonNullable<typeof alerts.data>[number]) => {
    if (!item.readAt) {
      try { await markRead.mutateAsync({ id: item.id }); }
      catch { toast.error("Não deu para marcar esse aviso como lido. Tente novamente."); }
    }
    navigate(item.href || "/perfil");
  };
  return <section className="mx-auto max-w-[900px] px-4 py-9 sm:px-6 sm:py-12"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">Fique por dentro</p><h1 className="section-title mt-2">Seus avisos</h1><p className="mt-2 text-sm leading-relaxed text-[#80616d]">Interesses, mensagens e respostas sobre suas trocas aparecem aqui.</p></div>{unread > 0 && <button onClick={() => markAllRead.mutate()} disabled={markAllRead.isPending} className="btn-secondary inline-flex items-center gap-2 px-4 py-2.5 text-sm disabled:opacity-50"><Check size={16} /> Marcar tudo como lido</button>}</div><div className="mt-7 space-y-3">{alerts.isLoading ? <div className="flex justify-center rounded-[24px] bg-white py-14"><Loader2 className="animate-spin text-[#a12c50]" /></div> : alerts.error ? <div className="rounded-[24px] bg-white p-7 text-center"><p className="font-extrabold text-[#64142b]">Não conseguimos carregar seus avisos.</p><button onClick={() => void alerts.refetch()} className="btn-secondary mt-4 px-4 py-2.5 text-sm">Tentar de novo</button></div> : alerts.data?.length ? alerts.data.map((item) => <button key={item.id} onClick={() => void openAlert(item)} className={`flex w-full items-start gap-3 rounded-[22px] border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md sm:gap-4 sm:p-5 ${item.readAt ? "border-[#75142e]/10 bg-white" : "border-[#d76585]/25 bg-[#fff1f4]"}`}><span className={`mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${item.readAt ? "bg-[#f8e8eb] text-[#9a5267]" : "bg-[#f5b4c7] text-[#74142e]"}`}><Bell size={18} /></span><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><span className="font-extrabold text-[#64142b]">{item.title}</span>{!item.readAt && <span className="rounded-full bg-[#f15683] px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-white">Novo</span>}</span><span className="mt-1 block text-sm leading-relaxed text-[#805f69]">{item.body}</span><span className="mt-2 block text-xs font-semibold text-[#a07783]">{new Date(item.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span></span><ArrowRight size={17} className="mt-2 shrink-0 text-[#a04461]" /></button>) : <div className="rounded-[26px] border border-dashed border-[#bc4a6b]/30 bg-white px-6 py-14 text-center"><Bell className="mx-auto text-[#c45272]" size={31} /><h2 className="mt-4 text-lg font-extrabold text-[#64142b]">Ainda não chegou nenhum aviso.</h2><p className="mx-auto mt-2 max-w-sm text-sm text-[#85636e]">Quando alguém se interessar por uma troca, mandar mensagem ou responder uma proposta, você vai saber por aqui.</p><button onClick={() => navigate("/explorar")} className="btn-primary mt-5 px-4 py-2.5 text-sm">Explorar itens</button></div>}</div></section>;
}

function AdminPage({ navigate }: { navigate: (href: string) => void }) {
  const auth = useAuth();
  const overview = trpc.admin.overview.useQuery(undefined, { enabled: auth.user?.role === "admin", refetchInterval: 30_000, refetchOnWindowFocus: true });
  if (auth.loading) return <section className="flex min-h-[55vh] items-center justify-center"><Loader2 className="animate-spin text-[#a12c50]" /></section>;
  if (!auth.user) return <Layout location="/admin" navigate={navigate}><section className="mx-auto max-w-[760px] px-4 py-16 text-center"><p className="eyebrow">Área da equipe</p><h1 className="section-title mt-2">Entre para continuar.</h1><button onClick={() => startLogin()} className="btn-primary mt-6 px-6 py-3">Entrar</button></section></Layout>;
  if (auth.user.role !== "admin") return <Layout location="/admin" navigate={navigate}><section className="mx-auto max-w-[760px] px-4 py-16 text-center"><ShieldCheck className="mx-auto text-[#c45272]" size={36} /><h1 className="section-title mt-4">Essa área é só da equipe Trocaí.</h1><p className="mt-3 text-sm text-[#80616d]">Sua conta continua podendo anunciar, propor trocas e conversar normalmente.</p><button onClick={() => navigate("/")} className="btn-primary mt-6 px-5 py-3">Voltar ao Trocaí</button></section></Layout>;

  const totals = overview.data?.totals;
  const cards = [
    { label: "Pessoas cadastradas", value: totals?.people ?? 0, icon: Users },
    { label: "Anúncios disponíveis", value: totals?.activeListings ?? 0, icon: PackageOpen },
    { label: "Com encontro marcado", value: totals?.reservedListings ?? 0, icon: CalendarClock },
    { label: "Propostas de troca", value: totals?.proposals ?? 0, icon: Handshake },
  ];
  const eventLabels: Record<string, string> = {
    user_registered: "Nova conta",
    listing_published: "Anúncio publicado",
    interest_received: "Novo interesse",
    swap_started: "Troca iniciada",
    swap_confirmed: "Troca concluída",
    swap_cancelled: "Troca encerrada",
    meeting_confirmed: "Encontro confirmado",
    report_submitted: "Relato recebido",
    review_submitted: "Avaliação recebida",
    account_moderated: "Revisão de conta",
  };
  return <DashboardLayout><section className="mx-auto max-w-[1180px] space-y-7 py-2"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow">Equipe Trocaí</p><h1 className="section-title mt-2">O que está rolando.</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#80616d]">Acompanhe novas contas, anúncios e trocas. Os avisos importantes também chegam para a pessoa responsável pelo site.</p></div><button onClick={() => navigate("/")} className="btn-secondary inline-flex items-center gap-2 px-4 py-2.5 text-sm"><ArrowLeft size={16} /> Voltar ao site</button></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards.map((card) => { const Icon = card.icon; return <article key={card.label} className="rounded-[22px] border border-[#75142e]/10 bg-white p-5 shadow-[0_8px_22px_rgba(102,23,48,.04)]"><div className="flex items-center justify-between"><p className="text-xs font-extrabold uppercase tracking-[.1em] text-[#9a7080]">{card.label}</p><span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#f9e1e8] text-[#861838]"><Icon size={19} /></span></div><p className="brand-font mt-3 text-4xl font-extrabold text-[#681029]">{overview.isLoading ? "…" : card.value}</p></article>; })}</div><section className="rounded-[26px] border border-[#75142e]/10 bg-white p-4 shadow-[0_8px_22px_rgba(102,23,48,.04)] sm:p-6"><div className="flex items-center justify-between gap-3"><div><p className="eyebrow">Atualizado automaticamente</p><h2 className="mt-1 text-xl font-extrabold text-[#64142b]">Atividade recente</h2></div><Bell size={20} className="text-[#a12c50]" /></div>{overview.error ? <div className="mt-5 rounded-2xl bg-[#fff3f4] p-5 text-sm text-[#795864]"><p className="font-extrabold text-[#64142b]">O painel não carregou.</p><p className="mt-1">Tente de novo em instantes.</p><button onClick={() => void overview.refetch()} className="btn-secondary mt-4 px-4 py-2 text-xs">Tentar de novo</button></div> : overview.isLoading ? <div className="flex justify-center py-12"><Loader2 className="animate-spin text-[#a12c50]" /></div> : overview.data?.events.length ? <div className="mt-5 divide-y divide-[#75142e]/[0.08]">{overview.data.events.map((event) => <article key={event.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-start gap-3"><span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#f9e1e8] text-[#861838]"><Bell size={17} /></span><div className="min-w-0"><p className="text-xs font-black uppercase tracking-[.1em] text-[#a04461]">{eventLabels[event.activityType] || "Atividade"}</p><p className="mt-1 break-words text-sm font-bold text-[#64142b]">{event.summary}</p><p className="mt-1 text-xs text-[#90717a]">{event.actorName ? `Por ${event.actorName}` : "Pessoa do Trocaí"} · {new Date(event.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</p></div></div>{event.listingId && <button onClick={() => navigate(`/produto/${event.listingId}`)} className="self-start rounded-full px-3 py-1.5 text-xs font-extrabold text-[#8e1b3d] hover:bg-[#fff1f4]">Ver item</button>}</article>)}</div> : <div className="mt-5 rounded-[22px] border border-dashed border-[#bc4a6b]/30 bg-[#fff7f5] px-5 py-10 text-center"><PackageOpen className="mx-auto text-[#c45272]" size={28} /><p className="mt-3 font-extrabold text-[#64142b]">Ainda não há atividades para mostrar.</p><p className="mt-1 text-sm text-[#85636e]">Quando alguém entrar, publicar ou combinar uma troca, aparece aqui.</p></div>}</section><AdminModerationPanel navigate={navigate} /><p className="text-xs leading-relaxed text-[#947781]">Só contas com acesso de administração conseguem ver esses dados. As conversas privadas não aparecem neste painel.</p></section></DashboardLayout>;
}

function SafetyPage({ navigate }: { navigate: (href: string) => void }) {
  const tips = [{ title: "Prefira locais públicos", text: "Combine em cafés, praças, estações ou outros pontos movimentados. Se possível, leve alguém junto.", icon: MapPin }, { title: "Cuide dos seus dados", text: "Não publique endereço, documentos ou informações pessoais desnecessárias no anúncio ou no chat.", icon: ShieldCheck }, { title: "Confira o item", text: "Olhe com calma antes de finalizar a troca. É importante que os dois lados estejam de acordo.", icon: Search }, { title: "Confie no seu instinto", text: "Se algo parecer estranho ou houver pressão, não prossiga. Uma boa troca sempre respeita você.", icon: Heart }];
  return <><section className="bg-[#6e0d2a] px-4 py-14 text-[#fff9ef] sm:px-6 sm:py-20"><div className="mx-auto grid max-w-[1050px] items-center gap-8 md:grid-cols-[1.2fr_.8fr]"><div><p className="text-xs font-black uppercase tracking-[.18em] text-[#ffb0c4]">Troque com cuidado</p><h1 className="brand-font mt-3 text-5xl font-extrabold leading-[.93] tracking-[-.055em] sm:text-6xl">A melhor troca é uma troca <span className="text-[#ff9fbd]">segura.</span></h1><p className="mt-5 max-w-xl text-[15px] leading-relaxed text-[#f7dce4]">O Trocaí existe para aproximar pessoas e ideias. Um pouco de atenção deixa cada encontro mais tranquilo para todo mundo.</p></div><div className="mx-auto grid h-44 w-44 place-items-center rounded-full border-[12px] border-[#f38aac]/35 bg-[#f7b1c6] text-[#6e0d2a] shadow-[0_20px_50px_rgba(0,0,0,.18)]"><ShieldCheck size={72} strokeWidth={1.6} /></div></div></section><section className="mx-auto max-w-[1050px] px-4 py-14 sm:px-6 sm:py-20"><div className="grid gap-4 sm:grid-cols-2">{tips.map((tip, index) => { const Icon = tip.icon; return <article key={tip.title} className="rounded-[26px] border border-[#75142e]/10 bg-white p-6 transition hover:-translate-y-1 hover:shadow-lg"><div className="flex items-center justify-between"><span className="brand-font text-3xl font-extrabold text-[#f083a3]">0{index + 1}</span><div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#fae0e8] text-[#851636]"><Icon size={21} /></div></div><h2 className="mt-5 text-lg font-extrabold text-[#65132a]">{tip.title}</h2><p className="mt-2 text-sm leading-relaxed text-[#805f69]">{tip.text}</p></article>; })}</div><div className="mt-9 rounded-[28px] border border-[#d55a7b]/20 bg-[#fff2f4] p-6 sm:flex sm:items-center sm:justify-between sm:p-8"><div><p className="text-sm font-extrabold text-[#6c1530]">Encontrou algo que não parece certo?</p><p className="mt-1 text-sm text-[#885f6d]">Abra a conversa da troca e toque em “Relatar um problema”. O relato vai direto para a equipe revisar.</p></div><button onClick={() => navigate("/perfil")} className="btn-secondary mt-4 inline-flex items-center gap-2 px-4 py-2.5 text-sm sm:mt-0"><Bell size={16} /> Minhas trocas</button></div><div className="mt-10 text-center"><button onClick={() => navigate("/explorar")} className="btn-primary inline-flex items-center gap-2 px-5 py-3.5 text-sm">Explorar com tranquilidade <ArrowRight size={17} /></button></div></section></>;
}

function InfoPage({ type, navigate }: { type: "sobre" | "contato"; navigate: (href: string) => void }) {
  const isContact = type === "contato";
  return <section className="mx-auto max-w-[850px] px-4 py-14 text-center sm:px-6 sm:py-20"><div className="mx-auto grid h-16 w-16 place-items-center rounded-[22px] bg-[#f6c5d4] text-[#72112d]">{isContact ? <MessageCircle size={29} /> : <HeartHandshake size={30} />}</div><p className="eyebrow mt-7">Trocaí</p><h1 className="brand-font mt-2 text-5xl font-extrabold leading-[.94] tracking-[-.055em] text-[#681029] sm:text-6xl">{isContact ? "Vamos conversar?" : "Mais trocas, menos desperdício."}</h1><p className="mx-auto mt-5 max-w-2xl text-[15px] leading-relaxed text-[#765560]">{isContact ? "Este é um protótipo de contato. Em uma plataforma real, você poderia falar com a equipe do Trocaí por aqui." : "O Trocaí é uma comunidade para fazer circular o que já existe. Acreditamos que trocar aproxima pessoas, cria possibilidades e dá novos caminhos às coisas."}</p>{isContact ? <div className="mx-auto mt-8 max-w-md rounded-[26px] border border-[#75142e]/10 bg-white p-5 text-left shadow-[0_12px_30px_rgba(96,16,39,.05)]"><label className="form-label">Seu e-mail<input placeholder="voce@email.com" /></label><label className="form-label mt-4">Como podemos ajudar?<textarea rows={4} placeholder="Escreva sua mensagem" /></label><button onClick={() => toast.info("O formulário de contato ainda não está conectado.")} className="btn-primary mt-5 w-full py-3 text-sm">Enviar mensagem</button></div> : <div className="mt-9 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl bg-[#fff0f3] p-5"><Coins className="mx-auto text-[#b22c54]" size={25} /><p className="mt-3 text-sm font-extrabold text-[#67132b]">Sem dinheiro</p><p className="mt-1 text-xs text-[#8d6270]">Aqui, a moeda é o que você já tem.</p></div><div className="rounded-2xl bg-[#fff0f3] p-5"><PackageOpen className="mx-auto text-[#b22c54]" size={25} /><p className="mt-3 text-sm font-extrabold text-[#67132b]">Mais ciclos</p><p className="mt-1 text-xs text-[#8d6270]">Um novo uso é um novo começo.</p></div><div className="rounded-2xl bg-[#fff0f3] p-5"><UserRound className="mx-auto text-[#b22c54]" size={25} /><p className="mt-3 text-sm font-extrabold text-[#67132b]">Mais conexão</p><p className="mt-1 text-xs text-[#8d6270]">Pessoas trocando mais que objetos.</p></div></div>}<button onClick={() => navigate("/")} className="mt-9 inline-flex items-center gap-2 text-sm font-extrabold text-[#871a3a] hover:underline"><ArrowLeft size={16} /> Voltar ao início</button></section>;
}

export default function Home() {
  const [location, setLocation] = useLocation();
  const auth = useAuth();
  const utils = trpc.useUtils();
  const policyStatus = trpc.legal.status.useQuery(undefined, {
    enabled: auth.isAuthenticated,
    retry: false,
    refetchOnWindowFocus: true,
  });
  const [policyChecked, setPolicyChecked] = useState(false);
  const acceptPolicy = trpc.legal.accept.useMutation({
    onSuccess: (result) => {
      setPolicyChecked(false);
      utils.legal.status.setData(undefined, {
        accepted: true,
        acceptedAt: result.acceptedAt,
        currentVersion: result.version,
      });
      void utils.legal.status.invalidate();
      toast.success("Aceite registrado. Bem-vinda ao Trocaí!");
    },
    onError: (error) => toast.error(error.message),
  });
  const pathname = location.split("?")[0];
  const policyRequired = auth.isAuthenticated && (
    policyStatus.isLoading || policyStatus.isError || !policyStatus.data?.accepted
  );
  const liveListings = trpc.marketplace.listings.list.useQuery(
    { sort: "recent", page: 1, pageSize: 4 },
    { enabled: pathname === "/" && !policyRequired, staleTime: 60_000, refetchInterval: 60_000, refetchOnWindowFocus: true },
  );
  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior }); }, [location]);
  const navigate = (href: string) => setLocation(href);
  const productId = pathname.startsWith("/produto/") ? Number(pathname.split("/")[2]) : 0;
  const items = (liveListings.data?.items || []).map((item) => toListing(item));
  const restrictedAccount = auth.user?.accountStatus && auth.user.accountStatus !== "active";
  let content: React.ReactNode;
  if (restrictedAccount && pathname !== "/politicas") {
    content = <section className="mx-auto max-w-[760px] px-4 py-16 text-center sm:px-6 sm:py-24"><div className="mx-auto grid h-20 w-20 place-items-center rounded-[28px] bg-[#f9c5d6] text-[#71112c]"><ShieldCheck size={36} /></div><p className="eyebrow mt-7">Revisão da equipe</p><h1 className="brand-font mt-2 text-5xl font-extrabold tracking-[-.05em] text-[#661029]">{auth.user?.accountStatus === "suspended" ? "Seu acesso está pausado." : "Sua conta está bloqueada."}</h1><p className="mx-auto mt-4 max-w-lg text-[15px] leading-relaxed text-[#795866]">A equipe Trocaí revisou sua conta e registrou esta decisão: {auth.user?.accountStatusNote || "fale com a equipe para entender os próximos passos."} Se você acha que houve um engano, fale com a equipe do site.</p><button onClick={() => { void auth.logout(); toast("Você saiu da sua conta."); }} className="btn-secondary mt-7 inline-flex items-center gap-2 px-5 py-3.5 text-sm"><LogOut size={16} /> Sair da conta</button></section>;
  } else if (pathname === "/politicas" || policyRequired) {
    content = <PoliciesPage
      requireAcceptance={policyRequired}
      authenticated={auth.isAuthenticated}
      checked={policyChecked}
      pending={acceptPolicy.isPending}
      statusLoading={policyStatus.isLoading}
      statusError={policyStatus.isError}
      acceptedAt={policyStatus.data?.acceptedAt}
      onCheckedChange={setPolicyChecked}
      onAccept={() => acceptPolicy.mutate({ agreed: true })}
      onLogin={() => startLogin()}
      onLogout={() => { void auth.logout(); toast("Você saiu da sua conta."); }}
      onRetry={() => { void policyStatus.refetch(); }}
      onBack={() => navigate("/")}
    />;
  } else if (pathname === "/admin") content = <AdminPage navigate={navigate} />;
  else if (pathname === "/explorar") content = <ExplorePage navigate={navigate} />;
  else if (pathname === "/anunciar") content = <AnnouncePage navigate={navigate} />;
  else if (pathname === "/como-funciona") content = <HowItWorksPage navigate={navigate} />;
  else if (pathname === "/seguranca") content = <SafetyPage navigate={navigate} />;
  else if (pathname === "/notificacoes") content = <NotificationsPage navigate={navigate} />;
  else if (pathname === "/perfil") content = <ProfilePage navigate={navigate} />;
  else if (pathname.startsWith("/produto/")) content = productId > 0 ? <ProductPage id={productId} navigate={navigate} /> : <ExplorePage navigate={navigate} />;
  else if (pathname === "/sobre" || pathname === "/contato") content = <InfoPage type={pathname.slice(1) as "sobre" | "contato"} navigate={navigate} />;
  else content = <HomePage navigate={navigate} items={items} loading={liveListings.isLoading} />;
  return <Layout location={policyRequired ? "/politicas" : pathname} navigate={navigate}>{content}</Layout>;
}
