import type { ConsignmentLotListItem } from "@/lib/preloved-consignment";

export function serializeConsignmentLot(lot: ConsignmentLotListItem) {
  return {
    ...lot,
    createdAt: lot.createdAt.toISOString(),
    payoutMarkedAt: lot.payoutMarkedAt?.toISOString() ?? null,
    acceptedUnits: lot.acceptedUnits.map((unit) => ({
      ...unit,
      createdAt: unit.createdAt.toISOString(),
    })),
    soldLines: lot.soldLines.map((line) => ({
      ...line,
      createdAt: line.createdAt.toISOString(),
    })),
  };
}
