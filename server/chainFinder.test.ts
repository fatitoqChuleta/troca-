import { describe, expect, it } from "vitest";
import { findExchangeChains, wantsItem, type ChainListing } from "./chainFinder";

const example: ChainListing[] = [
  { id: 1, ownerId: 1, ownerName: "Você", title: "Celular", wants: "Fone de ouvido", location: "Centro" },
  { id: 2, ownerId: 2, ownerName: "Sua mãe", title: "Pulseira", wants: "Celular", location: "Centro" },
  { id: 3, ownerId: 3, ownerName: "Outra pessoa", title: "Fone bluetooth", wants: "Pulseira", location: "Zona sul" },
];

describe("exchange-chain finder", () => {
  it("matches item names without depending on uppercase or accents", () => {
    expect(wantsItem("fone de ouvido", "Fone bluetooth")).toBe(true);
    expect(wantsItem("tênis", "Tenis infantil")).toBe(true);
    expect(wantsItem("fone", "telefone antigo")).toBe(false);
  });

  it("finds a three-person path and lists who gives each object to whom", () => {
    const [chain] = findExchangeChains(example, 1);
    expect(chain?.participantCount).toBe(3);
    expect(chain?.transfers).toEqual([
      expect.objectContaining({ fromName: "Você", itemTitle: "Celular", toName: "Sua mãe" }),
      expect.objectContaining({ fromName: "Sua mãe", itemTitle: "Pulseira", toName: "Outra pessoa" }),
      expect.objectContaining({ fromName: "Outra pessoa", itemTitle: "Fone bluetooth", toName: "Você" }),
    ]);
  });

  it("does not label a two-person direct swap as a chain", () => {
    const directOnly = example.slice(0, 2);
    directOnly[1] = { ...directOnly[1], wants: "Celular" };
    expect(findExchangeChains(directOnly, 1)).toEqual([]);
  });

  it("does not return a path that fails to loop back to the starting item", () => {
    const openPath = example.map((listing) => ({ ...listing }));
    openPath[2] = { ...openPath[2], wants: "Skate" };
    expect(findExchangeChains(openPath, 1)).toEqual([]);
  });

  it("does not use two listings from the same person as separate chain participants", () => {
    const repeatedOwner = [
      ...example,
      { id: 4, ownerId: 2, ownerName: "Sua mãe", title: "Notebook", wants: "Fone", location: "Centro" },
    ];
    const [chain] = findExchangeChains(repeatedOwner, 1);
    expect(chain?.participantCount).toBe(3);
    expect(chain?.transfers.map((transfer) => transfer.fromName)).toEqual(["Você", "Sua mãe", "Outra pessoa"]);
  });
});
