export type ChainListing = {
  id: number;
  ownerId: number;
  ownerName: string;
  title: string;
  wants: string;
  location: string;
};

export type ChainTransfer = {
  fromListingId: number;
  toListingId: number;
  fromName: string;
  toName: string;
  itemTitle: string;
  fromLocation: string;
  toLocation: string;
};

export type ExchangeChain = {
  participantCount: number;
  transfers: ChainTransfer[];
};

const stopWords = new Set([
  "a", "as", "o", "os", "um", "uma", "uns", "umas", "de", "do", "da", "dos", "das",
  "e", "ou", "com", "para", "por", "em", "no", "na", "nos", "nas", "meu", "minha",
  "meus", "minhas", "outro", "outra", "outros", "outras",
]);

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function wantedPhrases(wants: string): string[] {
  return wants
    .split(/[,;/]|\b(?:ou|e)\b/i)
    .map(normalize)
    .filter(Boolean);
}

/**
 * Match the words people used in their announcement. This is intentionally
 * transparent and conservative: results are suggestions, not a promise that
 * two objects are interchangeable.
 */
export function wantsItem(wants: string, offeredTitle: string): boolean {
  const offered = normalize(offeredTitle);
  if (!offered) return false;
  const offeredWords = new Set(offered.split(" ").filter((word) => word.length >= 3 && !stopWords.has(word)));

  return wantedPhrases(wants).some((phrase) => {
    if (` ${offered} `.includes(` ${phrase} `) || ` ${phrase} `.includes(` ${offered} `)) return true;
    const wantedWords = phrase.split(" ").filter((word) => word.length >= 3 && !stopWords.has(word));
    if (!wantedWords.length) return false;
    const sharedWords = wantedWords.filter((word) => offeredWords.has(word)).length;
    return sharedWords >= Math.ceil(wantedWords.length / 2);
  });
}

function makeChain(path: ChainListing[]): ExchangeChain {
  // Reverse the demand path after the starting announcement so that the visual
  // sequence follows the objects: starter's item -> next person -> ... -> starter.
  const exchangeOrder = [path[0], ...path.slice(1).reverse()];
  const transfers = exchangeOrder.map((from, index) => {
    const to = exchangeOrder[(index + 1) % exchangeOrder.length];
    return {
      fromListingId: from.id,
      toListingId: to.id,
      fromName: from.ownerName,
      toName: to.ownerName,
      itemTitle: from.title,
      fromLocation: from.location,
      toLocation: to.location,
    };
  });
  return { participantCount: exchangeOrder.length, transfers };
}

/**
 * Find up to a few closed swap paths around one listing. Each participant's
 * wanted items must match the next participant's offered item. A cycle is
 * returned only when it includes at least three different people, so ordinary
 * two-person exchanges remain direct swaps.
 */
export function findExchangeChains(
  listings: ChainListing[],
  startListingId: number,
  options: { maxParticipants?: number; maxResults?: number } = {},
): ExchangeChain[] {
  const start = listings.find((listing) => listing.id === startListingId);
  if (!start) return [];

  const maxParticipants = Math.max(3, Math.min(options.maxParticipants ?? 5, 6));
  const maxResults = Math.max(1, Math.min(options.maxResults ?? 3, 5));
  const maxChoicesPerStep = 12;
  const neighbors = new Map<number, ChainListing[]>();

  for (const listing of listings) {
    neighbors.set(
      listing.id,
      listings
        .filter((candidate) => candidate.id !== listing.id && candidate.ownerId !== listing.ownerId && wantsItem(listing.wants, candidate.title))
        .slice(0, maxChoicesPerStep),
    );
  }

  const results: ExchangeChain[] = [];
  const seenPaths = new Set<string>();

  const walk = (current: ChainListing, path: ChainListing[], usedOwners: Set<number>) => {
    if (path.length >= 3 && wantsItem(current.wants, start.title)) {
      const pathKey = path.map((listing) => listing.id).join("-");
      if (!seenPaths.has(pathKey)) {
        seenPaths.add(pathKey);
        results.push(makeChain(path));
      }
      return;
    }
    if (path.length >= maxParticipants || results.length >= maxResults) return;

    for (const candidate of neighbors.get(current.id) ?? []) {
      if (candidate.id === start.id || usedOwners.has(candidate.ownerId)) continue;
      walk(candidate, [...path, candidate], new Set(Array.from(usedOwners).concat(candidate.ownerId)));
      if (results.length >= maxResults) return;
    }
  };

  walk(start, [start], new Set([start.ownerId]));
  return results;
}
