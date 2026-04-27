import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const OWNER = 'SynkraAI';
const REPO = 'aiox-core';
const FULL_NAME = `${OWNER}/${REPO}`;
const GITHUB_API = 'https://api.github.com';

async function fetchJson(url, fallback = null) {
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'Base44-GitHub-Public-Sync'
    }
  });

  if (response.status === 404 && fallback !== null) {
    return fallback;
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub API error ${response.status}: ${text}`);
  }

  return response.json();
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const now = new Date().toISOString();

    const repo = await fetchJson(`${GITHUB_API}/repos/${OWNER}/${REPO}`);
    const commits = await fetchJson(`${GITHUB_API}/repos/${OWNER}/${REPO}/commits?per_page=10`, []);
    const latestRelease = await fetchJson(`${GITHUB_API}/repos/${OWNER}/${REPO}/releases/latest`, null);

    const payload = {
      owner: OWNER,
      repo: REPO,
      full_name: FULL_NAME,
      html_url: repo.html_url,
      description: repo.description || '',
      default_branch: repo.default_branch || '',
      language: repo.language || '',
      stars: repo.stargazers_count || 0,
      forks: repo.forks_count || 0,
      watchers: repo.watchers_count || 0,
      open_issues: repo.open_issues_count || 0,
      size: repo.size || 0,
      visibility: repo.visibility || 'public',
      pushed_at: repo.pushed_at,
      github_created_at: repo.created_at,
      github_updated_at: repo.updated_at,
      last_synced_at: now,
      latest_commits: commits.map((commit) => ({
        sha: commit.sha,
        message: commit.commit?.message || '',
        author: commit.commit?.author?.name || '',
        date: commit.commit?.author?.date || '',
        html_url: commit.html_url
      })),
      latest_release: latestRelease ? {
        name: latestRelease.name || latestRelease.tag_name,
        tag_name: latestRelease.tag_name,
        published_at: latestRelease.published_at,
        html_url: latestRelease.html_url
      } : null,
      raw: {
        id: repo.id,
        node_id: repo.node_id,
        license: repo.license,
        topics: repo.topics || []
      }
    };

    const existing = await base44.asServiceRole.entities.GitHubRepository.filter({ full_name: FULL_NAME }, '-created_date', 1);

    if (existing.length > 0) {
      await base44.asServiceRole.entities.GitHubRepository.update(existing[0].id, payload);
      return Response.json({ success: true, action: 'updated', repository: payload });
    }

    const created = await base44.asServiceRole.entities.GitHubRepository.create(payload);
    return Response.json({ success: true, action: 'created', repository: created });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});