// Stroke-based line icons matching the design's PIcon set. All inherit from
// currentColor so they pick up text color from their wrapper.

interface IconProps {
  size?: number;
  className?: string;
}

export function ShopIcon({ size = 22, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 8 L4 4 H20 L21 8" />
      <path d="M4 8 V20 H20 V8" />
      <path d="M9 12 a3 3 0 0 0 6 0" />
    </svg>
  );
}

export function OrdersIcon({ size = 22, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className={className}>
      <rect x="5" y="3" width="14" height="18" rx="1.5" />
      <path d="M9 8 H15 M9 12 H15 M9 16 H13" />
    </svg>
  );
}

export function KidsIcon({ size = 22, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className={className}>
      <circle cx="8.5" cy="8" r="3" />
      <circle cx="16" cy="9" r="2.5" />
      <path d="M3 20 c0-3 2.5-5 5.5-5 s5.5 2 5.5 5" />
      <path d="M14 20 c0-2.5 2-4.5 4.5-4.5 s2.5 2 2.5 4.5" />
    </svg>
  );
}

export function ProfileIcon({ size = 22, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className={className}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21 c0-4 4-7 8-7 s8 3 8 7" />
    </svg>
  );
}

export function CartIcon({ size = 22, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 4 H6 L8 16 H19 L21 8 H8" />
      <circle cx="9" cy="20" r="1.5" />
      <circle cx="17" cy="20" r="1.5" />
    </svg>
  );
}

export function BackIcon({ size = 22, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M15 4 L7 12 L15 20" />
    </svg>
  );
}

export function CheckIcon({ size = 22, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M5 13 L10 18 L20 6" />
    </svg>
  );
}

export function PlusIcon({ size = 22, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className={className}>
      <path d="M12 5 V19 M5 12 H19" />
    </svg>
  );
}

export function PickupIcon({ size = 22, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
      <path d="M4 11 L12 4 L20 11 V20 H4 Z" strokeLinejoin="round" />
      <path d="M9 20 V14 H15 V20" />
    </svg>
  );
}

export function ShipIcon({ size = 22, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="2" y="8" width="13" height="9" />
      <path d="M15 11 H20 L22 14 V17 H15" />
      <circle cx="7" cy="18" r="1.6" />
      <circle cx="17" cy="18" r="1.6" />
    </svg>
  );
}

export function ChevronRightIcon({ size = 14, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className={className}>
      <path d="M5 3 L9 7 L5 11" />
    </svg>
  );
}

export function LockIcon({ size = 14, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={className}>
      <rect x="4" y="6" width="16" height="14" rx="2" />
      <path d="M8 6 V4 a4 4 0 0 1 8 0 V6" />
    </svg>
  );
}

export function SearchIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20 L16 16" strokeLinecap="round" />
    </svg>
  );
}
