import {
  Activity,
  ArrowDown,
  ArrowDownLeft,
  ArrowDownUp,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bell,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  CircleCheck,
  Clock3,
  Command,
  Download,
  Ellipsis,
  ExternalLink,
  FileText,
  Globe,
  HelpCircle,
  LayoutDashboard,
  ListFilter,
  Loader,
  MapPin,
  Monitor,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  Upload,
  X,
  Zap,
} from "lucide-react";
export {
  Activity,
  ArrowDown,
  ArrowDownLeft,
  ArrowDownUp,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bell,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  CircleCheck,
  Clock3,
  Command,
  Download,
  Ellipsis,
  ExternalLink,
  FileText,
  Globe,
  HelpCircle,
  LayoutDashboard,
  ListFilter,
  Loader,
  MapPin,
  Monitor,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  Upload,
  X,
  Zap,
};
export function HoundMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" aria-hidden="true">
      <rect width="36" height="36" rx="11" fill="currentColor" />
      <path d="M10 23V11.5L15 14.5L20 10L25.5 14.5V20L20.5 25H15.5L15 20.5L10 23Z" fill="#fff9f0" />
      <path d="M10 11.5L9 18L14 17L15 14.5" fill="#fff9f0" />
      <circle cx="22.3" cy="16.2" r="1" fill="#ce6538" />
      <path d="M25 18H28L25 21" fill="#fff9f0" />
    </svg>
  );
}
export function CompanyLogo({
  name,
  color,
  size = 36,
}: {
  name: string;
  color: string;
  size?: number;
}) {
  const first = name.toLowerCase();
  return (
    <span
      className={`company-logo logo-${first.replace(/\s/g, "")}`}
      style={
        {
          "--logo-color": color,
          width: size,
          height: size,
          fontSize: size * 0.46,
        } as React.CSSProperties
      }
    >
      {first === "linear" ? (
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M3 12a9 9 0 0 0 9 9L3 12Zm.5-3.1L15.1 20.5a9 9 0 0 0 2.5-1.3L4.8 6.4a9 9 0 0 0-1.3 2.5Zm2.8-4.1L19.2 17.7A9 9 0 0 0 6.3 4.8Z" />
        </svg>
      ) : first === "vercel" ? (
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="m12 4 10 17H2L12 4Z" />
        </svg>
      ) : first === "figma" ? (
        <svg viewBox="0 0 18 26">
          <path fill="#f24e1e" d="M5 0a4.5 4.5 0 0 0 0 9h4V0H5Z" />
          <path fill="#ff7262" d="M9 0h4a4.5 4.5 0 0 1 0 9H9V0Z" />
          <path fill="#a259ff" d="M5 9a4.5 4.5 0 0 0 0 9h4V9H5Z" />
          <circle cx="13.5" cy="13.5" r="4.5" fill="#1abcfe" />
          <path fill="#0acf83" d="M5 18a4.5 4.5 0 1 0 4 4.5V18H5Z" />
        </svg>
      ) : first === "spotify" ? (
        <svg viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" fill="currentColor" />
          <path
            d="M6 9c4-1.5 8-1 12 1M7 12c3-1 6-1 10 1M8 15c3-.5 5-.5 8 1"
            stroke="white"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      ) : first === "airbnb" ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M12 3c-1.4 0-2.2 2-3.3 4.4L3.4 18c-2 4.5 3 5.3 8.6-1 5.6 6.3 10.6 5.5 8.6 1L15.3 7.4C14.2 5 13.4 3 12 3Z" />
          <path d="M12 17c-5-5.5 5-5.5 0 0Z" />
        </svg>
      ) : first === "ramp" ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <path d="M3 17h7c5 0 8-4 10-11M14 6h6v6" />
        </svg>
      ) : first === "framer" ? (
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M5 3h14v7h-7l7 7h-7v7l-7-7v-7h7L5 3Z" />
        </svg>
      ) : first === "stripe" ? (
        <span className="stripe-s">s</span>
      ) : first === "notion" ? (
        <span className="notion-n">N</span>
      ) : (
        name.slice(0, 1)
      )}
    </span>
  );
}
