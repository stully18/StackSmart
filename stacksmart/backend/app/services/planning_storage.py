"""Short, non-retrying transport for synchronous AI-plan storage operations."""
import os
from supabase import ClientOptions, create_client

PLANNING_STORAGE_TIMEOUT_SECONDS = 5


def get_supabase_client():
    options = ClientOptions(postgrest_client_timeout=PLANNING_STORAGE_TIMEOUT_SECONDS,
                            auto_refresh_token=False, persist_session=False)
    # Newer clients enable automatic PostgREST retries by default. Older releases
    # have no retry option; keep the same bounded single-attempt behavior.
    if hasattr(options, "postgrest_client_retry"):
        options.postgrest_client_retry = False
    return create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_ROLE_KEY"), options=options)
