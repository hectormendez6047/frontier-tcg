type P = { className?: string };
const base = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, "aria-hidden": true } as const;
export const SearchIcon = (p: P) => (<svg {...base} {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>);
export const UserIcon = (p: P) => (<svg {...base} {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></svg>);
export const CartIcon = (p: P) => (<svg {...base} {...p}><path d="M3 4h2.5l2.2 11h10.6L20.5 7H7" /><circle cx="9.5" cy="19.5" r="1.5" /><circle cx="17" cy="19.5" r="1.5" /></svg>);
export const AdminIcon = (p: P) => (<svg {...base} {...p}><path d="M4 6h16M4 12h16M4 18h10" /><circle cx="18" cy="18" r="2.2" /></svg>);
export const CloseIcon = (p: P) => (<svg {...base} {...p}><path d="M6 6l12 12M18 6 6 18" /></svg>);
