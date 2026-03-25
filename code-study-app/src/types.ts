export type ChangeEntry = {
  id: string;
  timestamp: string;
  project: string;
  commitHash: string;
  commitMessage: string;
  diff: string;
  filesChanged: string[];
  author: string;
  reviewed: boolean;
  notes: string;
  aiExplanation?: string | null;
};

export type DailyLog = {
  date: string;
  entries: ChangeEntry[];
};
