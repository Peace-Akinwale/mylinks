export type PageType =
  | "homepage"
  | "blog_post"
  | "category"
  | "product"
  | "service"
  | "landing"
  | "about"
  | "contact"
  | "other";

export type Confidence = "low" | "medium" | "high";
export type SuggestionStatus = "pending" | "approved" | "rejected";
export type CrawlStatus = "running" | "completed" | "failed";
export type ArticleSource = "paste" | "google_doc";

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type Database = {
  public: {
    Tables: {
      projects: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          domain: string;
          sitemap_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          domain: string;
          sitemap_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          name?: string;
          domain?: string;
          sitemap_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      pages: {
        Row: {
          id: string;
          project_id: string;
          url: string;
          title: string | null;
          meta_description: string | null;
          h1: string | null;
          h2s: string[] | null;
          page_type: PageType;
          priority: number;
          word_count: number | null;
          status_code: number | null;
          last_crawled_at: string | null;
        };
        Insert: {
          id?: string;
          project_id: string;
          url: string;
          title?: string | null;
          meta_description?: string | null;
          h1?: string | null;
          h2s?: string[] | null;
          page_type?: PageType;
          priority?: number;
          word_count?: number | null;
          status_code?: number | null;
          last_crawled_at?: string | null;
        };
        Update: {
          id?: string;
          project_id?: string;
          url?: string;
          title?: string | null;
          meta_description?: string | null;
          h1?: string | null;
          h2s?: string[] | null;
          page_type?: PageType;
          priority?: number;
          word_count?: number | null;
          status_code?: number | null;
          last_crawled_at?: string | null;
        };
        Relationships: [];
      };
      articles: {
        Row: {
          id: string;
          project_id: string;
          title: string;
          source: ArticleSource;
          google_doc_id: string | null;
          content_text: string;
          word_count: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          title: string;
          source?: ArticleSource;
          google_doc_id?: string | null;
          content_text: string;
          word_count?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          title?: string;
          source?: ArticleSource;
          google_doc_id?: string | null;
          content_text?: string;
          word_count?: number | null;
          created_at?: string;
        };
        Relationships: [];
      };
      suggestions: {
        Row: {
          id: string;
          article_id: string;
          target_page_id: string | null;
          target_url: string;
          anchor_text: string;
          anchor_refinement: string | null;
          page_type: PageType | null;
          relevance_score: number;
          confidence: Confidence;
          paragraph_index: number | null;
          sentence_index: number | null;
          char_start: number;
          char_end: number;
          justification: string;
          duplicate_flag: boolean;
          over_optimization_flag: boolean;
          status: SuggestionStatus;
          gdoc_start_index: number | null;
          gdoc_end_index: number | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          article_id: string;
          target_page_id?: string | null;
          target_url: string;
          anchor_text: string;
          anchor_refinement?: string | null;
          page_type?: PageType | null;
          relevance_score: number;
          confidence?: Confidence;
          paragraph_index?: number | null;
          sentence_index?: number | null;
          char_start: number;
          char_end: number;
          justification: string;
          duplicate_flag?: boolean;
          over_optimization_flag?: boolean;
          status?: SuggestionStatus;
          gdoc_start_index?: number | null;
          gdoc_end_index?: number | null;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          article_id?: string;
          target_page_id?: string | null;
          target_url?: string;
          anchor_text?: string;
          anchor_refinement?: string | null;
          page_type?: PageType | null;
          relevance_score?: number;
          confidence?: Confidence;
          paragraph_index?: number | null;
          sentence_index?: number | null;
          char_start?: number;
          char_end?: number;
          justification?: string;
          duplicate_flag?: boolean;
          over_optimization_flag?: boolean;
          status?: SuggestionStatus;
          gdoc_start_index?: number | null;
          gdoc_end_index?: number | null;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      google_tokens: {
        Row: {
          id: string;
          user_id: string;
          access_token: string;
          refresh_token: string;
          expires_at: string;
          scope: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          access_token: string;
          refresh_token: string;
          expires_at: string;
          scope: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          access_token?: string;
          refresh_token?: string;
          expires_at?: string;
          scope?: string;
        };
        Relationships: [];
      };
      crawl_logs: {
        Row: {
          id: string;
          project_id: string;
          status: CrawlStatus;
          total_urls: number | null;
          crawled_urls: number;
          failed_urls: number;
          error_message: string | null;
          started_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          project_id: string;
          status?: CrawlStatus;
          total_urls?: number | null;
          crawled_urls?: number;
          failed_urls?: number;
          error_message?: string | null;
          started_at?: string;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          project_id?: string;
          status?: CrawlStatus;
          total_urls?: number | null;
          crawled_urls?: number;
          failed_urls?: number;
          error_message?: string | null;
          started_at?: string;
          completed_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: {
      page_type: PageType;
      confidence_level: Confidence;
      suggestion_status: SuggestionStatus;
      crawl_status: CrawlStatus;
      article_source: ArticleSource;
    };
    CompositeTypes: Record<never, never>;
  };
};
