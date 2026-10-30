-- Reference DDL of an applied cloud migration; do not reapply blindly.
-- CloeDashboard wvwxwutjdqsktnrcdbkf
-- Cloud version 20261030171706: analysis_reviews_revision_owner_index.
-- This reference is separate from the original table migration.
create index analysis_reviews_revision_owner_idx
  on public.analysis_review_snapshots (revision_of, user_id);
