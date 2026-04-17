# Project Structure

## Directory Layout

```
res-api-relay/
├── .github/                    # GitHub templates and workflows
│   ├── ISSUE_TEMPLATE/        # Issue templates
│   │   ├── bug_report.md      # Bug report template
│   │   └── feature_request.md # Feature request template
│   └── PULL_REQUEST_TEMPLATE.md # PR template
│
├── admin/                      # Web admin panel
│   ├── static/                # Static assets
│   │   ├── css/
│   │   │   └── style.css      # Stylesheet
│   │   └── js/
│   │       └── app.js         # Frontend JavaScript
│   └── templates/
│       └── index.html         # Admin panel HTML
│
├── database/                   # Database storage (empty in repo)
│   ├── backups/               # Backup directory
│   └── .gitkeep               # Preserve empty directory
│
├── examples/                   # Usage examples
│   └── openrouter_example.py  # OpenRouter SDK example
│
├── logs/                       # Log files (empty in repo)
│   └── .gitkeep               # Preserve empty directory
│
├── src/                        # Core modules
│   ├── __init__.py
│   ├── auth.py                # API key authentication
│   ├── database.py            # Database management
│   ├── logger.py              # Request logging
│   ├── model_manager.py       # Model configuration
│   ├── models.py              # Pydantic data models
│   ├── proxy.py               # API proxy core
│   ├── rate_limiter.py        # Rate limiting
│   └── stats.py               # Statistics aggregation
│
├── .dockerignore              # Docker ignore patterns
├── .env.example               # Environment variables template
├── .gitignore                 # Git ignore patterns
├── CHANGELOG.md               # Version history
├── CLAUDE.md                  # Development guidelines
├── cleanup.sh                 # Cleanup script
├── CODE_OF_CONDUCT.md         # Community standards
├── config.json.example        # Configuration template
├── CONTRIBUTING.md            # Contribution guidelines
├── docker-compose.yml         # Docker compose configuration
├── Dockerfile                 # Docker image definition
├── init.sh                    # Initialization script
├── LICENSE                    # MIT License
├── main.py                    # Main application entry
├── Makefile                   # Build and utility commands
├── README.md                  # Chinese documentation
├── README_EN.md               # English documentation
├── requirements.txt           # Python dependencies
├── SECURITY.md                # Security policy
├── start.sh                   # Service start script
└── stop.sh                    # Service stop script
```

## Key Files

### Configuration
- `config.json.example`: Configuration template (rename to `config.json` for use)
- `.env.example`: Environment variables template
- `requirements.txt`: Python dependencies

### Scripts
- `init.sh`: First-time project initialization
- `start.sh`: Start the service
- `stop.sh`: Stop the service
- `cleanup.sh`: Clean runtime data

### Documentation
- `README.md`: Main documentation (Chinese)
- `README_EN.md`: English documentation
- `CHANGELOG.md`: Version history
- `CLAUDE.md`: Development guidelines for AI assistants
- `CONTRIBUTING.md`: How to contribute
- `SECURITY.md`: Security policy
- `CODE_OF_CONDUCT.md`: Community standards

### Core Application
- `main.py`: FastAPI application entry point
- `src/`: Core backend modules
- `admin/`: Web admin panel

### Docker
- `Dockerfile`: Container image definition
- `docker-compose.yml`: Multi-container setup
- `.dockerignore`: Files to exclude from Docker build

## Runtime Data (Not in Git)

- `database/*.db`: SQLite database files
- `database/backups/*.db`: Database backups
- `logs/*.log`: Application logs
- `relay.pid`: Process ID file
- `config.json`: Actual configuration (contains secrets)
- `.env`: Actual environment variables (contains secrets)

## Development Files

- `.github/`: GitHub-specific templates
- `Makefile`: Development utilities
- `examples/`: Usage examples

## Clean Project

The repository contains no:
- Runtime data (database files, logs)
- Python cache (`__pycache__/`)
- Environment secrets (`.env`, `config.json`)
- IDE configurations
- Temporary files

All directories that need to exist but are empty contain `.gitkeep` files to preserve them in git.