# Audit

Site Brain writes `site_brain_events` for sync, knowledge propose/approve/reject, observations, recommendations, bootstrap review, and related mutations.

Recommendation approve/reject records status changes with actor metadata.

API responses include `persisted` so the UI never claims a save when storage failed.
