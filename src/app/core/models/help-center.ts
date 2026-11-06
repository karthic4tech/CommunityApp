export interface HelpCategory {
  id: string;
  slug: string;
  title_en: string;
  title_ta: string;
  description_en: string;
  description_ta: string;
  icon: string;
  sort_order: number;
  is_active: boolean;
}

export interface HelpArticle {
  id: string;
  category_id: string;
  slug: string;
  question_en: string;
  question_ta: string;
  answer_en: string;
  answer_ta: string;
  article_type: 'faq' | 'guide';
  related_route: string | null;
  sort_order: number;
  is_featured: boolean;
  is_published: boolean;
  category?: HelpCategory;
}

export interface HelpArticleInput {
  category_id: string;
  slug: string;
  question_en: string;
  question_ta: string;
  answer_en: string;
  answer_ta: string;
  article_type: 'faq' | 'guide';
  related_route: string | null;
  sort_order: number;
  is_featured: boolean;
  is_published: boolean;
}
