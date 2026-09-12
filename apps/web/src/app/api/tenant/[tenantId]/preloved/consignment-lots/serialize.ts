import {
  maskConsignmentLotBank,
  type ConsignmentLotListItem,
} from "@/lib/preloved-consignment";

/** Operator list/PATCH JSON. BSB/account are masked; treasurer CSV keeps full digits. */
export function serializeConsignmentLot(lot: ConsignmentLotListItem) {
  const masked = maskConsignmentLotBank(lot);
  return {
    ...masked,
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
