# Website Studio — Version History

**Updated:** 2026-07-18 (Phase 4)

## Storage

Uses existing Theme Studio draft/version tables (`theme_studio_*` technical names preserved).  
No parallel persistence system.

## Tracked change types

- Initial business brief  
- Generated concepts / regenerations  
- AI refinements  
- Manual edits  
- App add/remove  
- Layout changes  
- Image changes / approval  
- Quality status changes  
- Concept selection  
- Draft approval state  

Each version records: version number, timestamp, actor, change type, summary, quality status.

## Restore

`POST api/theme-studio/restore-version`

Restoring a prior version **creates a new version** cloned from the target. History is never destroyed.

## Image decisions

`POST api/theme-studio/persist-images` writes selected/approved/rejected image state onto the draft version (asset, alternates, source, attribution, brief, query, import plan). Approval state is not session-only.
