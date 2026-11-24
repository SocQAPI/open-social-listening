export type TaskStatus = "queued" | "running" | "succeeded" | "failed";

export interface SocqActor {
  id?: string | null;
  username?: string | null;
  name?: string | null;
  url?: string | null;
  avatar_url?: string | null;
  is_verified?: boolean | null;
}

export interface SocqMetrics {
  likes_count?: number | null;
  comments_count?: number | null;
  shares_count?: number | null;
  views_count?: number | null;
  plays_count?: number | null;
}

export interface SocqMedia {
  type?: string | null;
  url?: string | null;
  thumbnail_url?: string | null;
}

export interface SocqSentimentScores {
  positive?: number | null;
  negative?: number | null;
  neutral?: number | null;
}

/**
 * A normalized SocQ result record. Covers the `post`, `reel-video`,
 * `news-article` and `brand-mention` schemas used by the listening sources.
 */
export interface SocqItem {
  id?: string | null;
  platform?: string | null;
  resource?: string | null;
  type?: string | null;
  url?: string | null;
  published_at?: string | null;
  collected_at?: string | null;
  title?: string | null;
  text?: string | null;
  author?: SocqActor | null;
  author_name?: string | null;
  metrics?: SocqMetrics | null;
  media?: SocqMedia[] | null;
  hashtags?: string[] | null;
  source?: string | null;
  domain?: string | null;
  image_url?: string | null;
  sentiment?: SocqSentimentScores | null;
  [key: string]: unknown;
}

export interface TaskResultsPage {
  items: SocqItem[];
  next_cursor: string | null;
  has_more: boolean;
}

export interface TaskInfo {
  task_id: string;
  status: TaskStatus;
  result_count?: number | null;
  credits_amount?: number | null;
  error_message?: string | null;
  results?: TaskResultsPage | null;
}

export interface SubmitResult {
  task_id: string;
  status: TaskStatus;
  credits_amount?: number | null;
}

export interface AccountInfo {
  credits: number | null;
  email: string | null;
  raw: Record<string, unknown>;
}
