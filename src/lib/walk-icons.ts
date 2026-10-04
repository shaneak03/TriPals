import {
  Binoculars,
  BookOpen,
  Brush,
  Building2,
  Camera,
  Castle,
  Church,
  Coffee,
  Droplets,
  Eye,
  Flower2,
  Landmark,
  MapPin,
  Mountain,
  Music,
  Palette,
  ShoppingBag,
  Sparkles,
  Star,
  Theater,
  Trees,
  UtensilsCrossed,
  Waves,
  Wine,
  type LucideIcon,
} from "lucide-react";

/**
 * Lucide icons that poi_categories.icon may name. Importing all of Lucide would add
 * hundreds of KB, so the dashboard can pick any icon from this list; anything else
 * shows the MapPin fallback. Add an entry here to allow a new icon.
 */
const ICONS: Record<string, LucideIcon> = {
  Binoculars,
  BookOpen,
  Brush,
  Building2,
  Camera,
  Castle,
  Church,
  Coffee,
  Droplets,
  Eye,
  Flower2,
  Landmark,
  MapPin,
  Mountain,
  Music,
  Palette,
  ShoppingBag,
  Sparkles,
  Star,
  Theater,
  Trees,
  UtensilsCrossed,
  Waves,
  Wine,
};

export function iconFor(name: string | null | undefined): LucideIcon {
  return (name && ICONS[name]) || MapPin;
}
