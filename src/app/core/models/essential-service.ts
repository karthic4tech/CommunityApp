export interface EssentialShortcutRow {
  id: string;
  category_id: string;
  subcategory_id: string | null;
  title: string;
  title_ta: string | null;
  icon: string | null;
  display_order: number;
  is_active: boolean;
  is_emergency: boolean;
}

export interface EssentialShortcut extends EssentialShortcutRow {
  categorySlug: string;
  categoryName: string;
  categoryNameTamil: string;
  subcategorySlug: string | null;
  subcategoryName: string | null;
  subcategoryNameTamil: string | null;
  destination: string;
}

export interface EssentialShortcutMutation {
  id?: string;
  category_id: string;
  subcategory_id: string | null;
  title: string;
  title_ta: string | null;
  icon: string | null;
  display_order: number;
  is_active: boolean;
  is_emergency: boolean;
}
