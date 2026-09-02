import {
  Home, Route, Store, Boxes, FileSignature, Map, Users, Inbox, Contact, BookOpen, Settings, User, Sun, Moon, Menu, X,
  MoreHorizontal, LogOut, CloudSun, Camera, Check, ChevronRight, Plus, MapPin, Phone, Navigation, QrCode, AlertTriangle,
  Search, Trash2, Truck, ClipboardCheck, Calculator, Bell, ExternalLink, Copy, Send, Fuel, Flag, Download,
} from "lucide-react";
import type { LucideProps } from "lucide-react";

const ICONS = {
  home: Home, route: Route, store: Store, boxes: Boxes, "file-signature": FileSignature, map: Map, users: Users, inbox: Inbox,
  contact: Contact, book: BookOpen, settings: Settings, user: User, sun: Sun, moon: Moon, menu: Menu, x: X, more: MoreHorizontal,
  logout: LogOut, weather: CloudSun, camera: Camera, check: Check, chevron: ChevronRight, plus: Plus, pin: MapPin, phone: Phone,
  navigate: Navigation, qr: QrCode, alert: AlertTriangle, search: Search, trash: Trash2, truck: Truck, checklist: ClipboardCheck,
  calc: Calculator, bell: Bell, external: ExternalLink, copy: Copy, send: Send, fuel: Fuel, flag: Flag, download: Download,
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 18, ...rest }: { name: IconName } & LucideProps) {
  const C = ICONS[name];
  return <C size={size} strokeWidth={2} aria-hidden {...rest} />;
}
