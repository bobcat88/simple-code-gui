use serde::Serialize;
use std::path::Path;
use std::process::Command;

#[derive(Serialize, Clone)]
pub struct ProjectIntelligence {
    pub git: Option<GitInfo>,
    pub stacks: Vec<StackInfo>,
    pub health: HealthSummary,
    pub gitnexus: Option<GitNexusInfo>,
}

#[derive(Serialize, Clone)]
pub struct GitInfo {
    pub branch: String,
    pub is_dirty: bool,
    pub uncommitted_count: u32,
    pub recent_commits: Vec<CommitInfo>,
    pub remote: Option<String>,
    pub ahead: u32,
    pub behind: u32,
}

#[derive(Serialize, Clone)]
pub struct CommitInfo {
    pub hash: String,
    pub message: String,
    pub author: String,
    pub date: String,
}

#[derive(Serialize, Clone)]
pub struct StackInfo {
    pub name: String,
    pub icon: String,
    pub version: Option<String>,
    pub config_file: String,
}

#[derive(Serialize, Clone)]
pub struct HealthSummary {
    pub score: u8,
    pub has_git: bool,
    pub has_readme: bool,
    pub has_ci: bool,
    pub has_tests: bool,
    pub has_linter: bool,
    pub has_lockfile: bool,
}

#[derive(Serialize, Clone)]
pub struct GitNexusInfo {
    pub symbols: u32,
    pub relationships: u32,
    pub processes: u32,
    pub stale: bool,
}

fn run_git(cwd: &str, args: &[&str]) -> Option<String> {
    Command::new("git")
        .args(args)
        .current_dir(cwd)
        .output()
        .ok()
        .and_then(|o| {
            if o.status.success() {
                Some(String::from_utf8_lossy(&o.stdout).trim().to_string())
            } else {
                None
            }
        })
}

fn detect_git(cwd: &str) -> Option<GitInfo> {
    let branch = run_git(cwd, &["rev-parse", "--abbrev-ref", "HEAD"])?;

    let status = run_git(cwd, &["status", "--porcelain"]).unwrap_or_default();
    let uncommitted_count = status.lines().count() as u32;

    let log = run_git(cwd, &["log", "--oneline", "--format=%H|||%s|||%an|||%ar", "-5"])
        .unwrap_or_default();
    let recent_commits: Vec<CommitInfo> = log
        .lines()
        .filter_map(|line| {
            let parts: Vec<&str> = line.splitn(4, "|||").collect();
            if parts.len() == 4 {
                Some(CommitInfo {
                    hash: parts[0][..7.min(parts[0].len())].to_string(),
                    message: parts[1].to_string(),
                    author: parts[2].to_string(),
                    date: parts[3].to_string(),
                })
            } else {
                None
            }
        })
        .collect();

    let remote = run_git(cwd, &["remote", "get-url", "origin"]);

    let mut ahead = 0u32;
    let mut behind = 0u32;
    if let Some(ab) = run_git(cwd, &["rev-list", "--left-right", "--count", "HEAD...@{upstream}"]) {
        let parts: Vec<&str> = ab.split_whitespace().collect();
        if parts.len() == 2 {
            ahead = parts[0].parse().unwrap_or(0);
            behind = parts[1].parse().unwrap_or(0);
        }
    }

    Some(GitInfo {
        branch,
        is_dirty: uncommitted_count > 0,
        uncommitted_count,
        recent_commits,
        remote,
        ahead,
        behind,
    })
}

fn detect_stacks(cwd: &str) -> Vec<StackInfo> {
    let p = Path::new(cwd);
    let mut stacks = Vec::new();

    let checks: Vec<(&str, &str, &str, Box<dyn Fn(&Path) -> Option<String>>)> = vec![
        ("package.json", "Node.js", "📦", Box::new(|path| {
            std::fs::read_to_string(path).ok().and_then(|c| {
                serde_json::from_str::<serde_json::Value>(&c).ok()?.get("version")?.as_str().map(|s| s.to_string())
            })
        })),
        ("Cargo.toml", "Rust", "🦀", Box::new(|path| {
            let content = std::fs::read_to_string(path).ok()?;
            content.lines().find(|l| l.starts_with("version")).and_then(|l| {
                l.split('=').nth(1).map(|v| v.trim().trim_matches('"').to_string())
            })
        })),
        ("pyproject.toml", "Python", "🐍", Box::new(|_| None)),
        ("go.mod", "Go", "🔵", Box::new(|_| None)),
        ("Gemfile", "Ruby", "💎", Box::new(|_| None)),
        ("build.gradle", "Java/Kotlin", "☕", Box::new(|_| None)),
        ("pom.xml", "Java (Maven)", "☕", Box::new(|_| None)),
        ("mix.exs", "Elixir", "💜", Box::new(|_| None)),
        ("composer.json", "PHP", "🐘", Box::new(|_| None)),
        ("CMakeLists.txt", "C/C++", "⚙️", Box::new(|_| None)),
        ("Dockerfile", "Docker", "🐳", Box::new(|_| None)),
        ("docker-compose.yml", "Docker Compose", "🐳", Box::new(|_| None)),
        ("docker-compose.yaml", "Docker Compose", "🐳", Box::new(|_| None)),
    ];

    // Also check sub-framework indicators
    let framework_checks: Vec<(&str, &str, &str)> = vec![
        ("vite.config.ts", "Vite", "⚡"),
        ("vite.config.js", "Vite", "⚡"),
        ("next.config.js", "Next.js", "▲"),
        ("next.config.mjs", "Next.js", "▲"),
        ("tailwind.config.js", "Tailwind CSS", "🎨"),
        ("tailwind.config.ts", "Tailwind CSS", "🎨"),
        ("tsconfig.json", "TypeScript", "🔷"),
        ("src-tauri/tauri.conf.json", "Tauri", "🪟"),
        (".eslintrc.json", "ESLint", "🔍"),
        (".eslintrc.js", "ESLint", "🔍"),
        ("eslint.config.js", "ESLint", "🔍"),
        (".prettierrc", "Prettier", "✨"),
        ("vitest.config.ts", "Vitest", "🧪"),
        ("jest.config.js", "Jest", "🧪"),
    ];

    for (file, name, icon, version_fn) in &checks {
        let file_path = p.join(file);
        if file_path.exists() {
            stacks.push(StackInfo {
                name: name.to_string(),
                icon: icon.to_string(),
                version: version_fn(&file_path),
                config_file: file.to_string(),
            });
        }
    }

    for (file, name, icon) in &framework_checks {
        let file_path = p.join(file);
        if file_path.exists() {
            stacks.push(StackInfo {
                name: name.to_string(),
                icon: icon.to_string(),
                version: None,
                config_file: file.to_string(),
            });
        }
    }

    stacks
}

fn detect_health(cwd: &str) -> HealthSummary {
    let p = Path::new(cwd);

    let has_git = p.join(".git").exists();
    let has_readme = p.join("README.md").exists() || p.join("readme.md").exists();
    let has_ci = p.join(".github/workflows").exists() || p.join(".gitlab-ci.yml").exists() || p.join(".circleci").exists();
    let has_tests = p.join("__tests__").exists()
        || p.join("tests").exists()
        || p.join("test").exists()
        || p.join("src/__tests__").exists()
        || p.join("spec").exists();
    let has_linter = p.join(".eslintrc.json").exists()
        || p.join(".eslintrc.js").exists()
        || p.join("eslint.config.js").exists()
        || p.join(".prettierrc").exists()
        || p.join("rustfmt.toml").exists()
        || p.join(".ruff.toml").exists();
    let has_lockfile = p.join("package-lock.json").exists()
        || p.join("yarn.lock").exists()
        || p.join("bun.lockb").exists()
        || p.join("Cargo.lock").exists()
        || p.join("poetry.lock").exists()
        || p.join("uv.lock").exists();

    let checks = [has_git, has_readme, has_ci, has_tests, has_linter, has_lockfile];
    let score = ((checks.iter().filter(|&&c| c).count() as f32 / checks.len() as f32) * 100.0) as u8;

    HealthSummary {
        score,
        has_git,
        has_readme,
        has_ci,
        has_tests,
        has_linter,
        has_lockfile,
    }
}

fn detect_gitnexus(cwd: &str) -> Option<GitNexusInfo> {
    let meta_path = Path::new(cwd).join(".gitnexus/meta.json");
    if !meta_path.exists() {
        return None;
    }

    let content = std::fs::read_to_string(&meta_path).ok()?;
    let meta: serde_json::Value = serde_json::from_str(&content).ok()?;
    let stats = meta.get("stats")?;

    // Check staleness: compare last_analyzed to last git commit
    let stale = if let Some(analyzed) = meta.get("last_analyzed").and_then(|v| v.as_str()) {
        run_git(cwd, &["log", "-1", "--format=%aI"])
            .map(|commit_date| commit_date > analyzed.to_string())
            .unwrap_or(true)
    } else {
        true
    };

    Some(GitNexusInfo {
        symbols: stats.get("symbols").and_then(|v| v.as_u64()).unwrap_or(0) as u32,
        relationships: stats.get("relationships").and_then(|v| v.as_u64()).unwrap_or(0) as u32,
        processes: stats.get("processes").and_then(|v| v.as_u64()).unwrap_or(0) as u32,
        stale,
    })
}

#[tauri::command]
pub async fn scan_project_intelligence(cwd: String) -> Result<ProjectIntelligence, String> {
    let git = detect_git(&cwd);
    let stacks = detect_stacks(&cwd);
    let health = detect_health(&cwd);
    let gitnexus = detect_gitnexus(&cwd);

    Ok(ProjectIntelligence {
        git,
        stacks,
        health,
        gitnexus,
    })
}
