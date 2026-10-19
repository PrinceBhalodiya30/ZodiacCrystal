export interface GuideLink {
  label: string;
  path: string;
  queryParams?: Record<string, string | number>;
}

export interface GuideSection {
  heading?: string;
  paragraphs: string[];
}

export interface Guide {
  slug: string;
  title: string;
  shortDescription: string;
  sections: GuideSection[];
  relatedLinks: GuideLink[];
}
