CREATE TABLE IF NOT EXISTS videos (
  videoId TEXT PRIMARY KEY,
  title TEXT,
  keyword_used TEXT,
  humanized_caption TEXT,
  r2_url TEXT,
  status TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
