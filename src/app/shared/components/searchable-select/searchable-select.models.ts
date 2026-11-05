export interface SearchableSelectOption {
  /** Stable value written to the reactive form, usually a database ID. */
  value: string;
  /** Visible option label. May contain both English and Tamil names. */
  label: string;
  /** Additional searchable text such as alternate-language names or a slug. */
  searchText?: string;
  disabled?: boolean;
}

export type SearchableSelectValue = string | null;
export type SearchableSelectRemoteSearch = (query: string) => Promise<readonly SearchableSelectOption[]>;
