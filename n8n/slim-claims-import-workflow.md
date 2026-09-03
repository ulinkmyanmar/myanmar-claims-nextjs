# n8n workflow: Slim Claims File refresh

Recommended automation flow:

1. Trigger
   - Manual admin trigger, scheduled 6-month reminder, or Supabase Storage file-created event.
2. Download uploaded Slim Claims Excel file.
3. Validate required columns.
4. Count total rows, unique members, unique claims, duplicate claim numbers, missing identifiers, invalid dates.
5. Insert records into staging tables or call `/api/admin/stage-claims-snapshot`.
6. Generate synchronization preview:
   - New claims
   - Updated claims
   - Unchanged claims
   - Duplicates prevented
7. Notify Admin for confirmation.
8. After confirmation in web app:
   - Upsert members and claims.
   - Mark new database version active.
   - Archive previous active version.
   - Write audit log.
9. Send completion notification.

n8n should automate validation and notification, but the Next.js application should remain the system of record and approval surface.
