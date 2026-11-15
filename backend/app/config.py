import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()

MODEL = "claude-haiku-5-5"
SUMMARY_MIN_REVIEWS = 3      # first summary once a campus has this many approved reviews
SUMMARY_REFRESH_DELTA = 5    # regenerate after this many new approved reviews
SUMMARY_MAX_REVIEWS = 100    # most recent approved reviews fed to the model
CATEGORIES = ("food", "surroundings", "social", "education", "prices", "dorm", "campus")


@dataclass(frozen=True)
class Settings:
    supabase_url: str
    supabase_service_role_key: str
    webhook_secret: str
    frontend_origins: list[str]

    @classmethod
    def from_env(cls) -> "Settings":
        missing = [k for k in ("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "WEBHOOK_SECRET") if not os.environ.get(k)]
        if missing:
            raise RuntimeError(f"Missing env vars: {', '.join(missing)} (see backend/.env.example)")
        origins = os.environ.get("FRONTEND_ORIGINS", "http://localhost:5173")
        return cls(
            supabase_url=os.environ["SUPABASE_URL"],
            supabase_service_role_key=os.environ["SUPABASE_SERVICE_ROLE_KEY"],
            webhook_secret=os.environ["WEBHOOK_SECRET"],
            frontend_origins=[o.strip() for o in origins.split(",") if o.strip()],
        )
