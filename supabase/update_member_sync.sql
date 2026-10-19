-- STEP 3. Apply only after backing up the database and disabling confirmation.
-- Atomic replacement; the old signature is preserved plus one new argument.
BEGIN;

CREATE OR REPLACE FUNCTION "MyanmarClaimSystem".apply_claims_sync(
  p_version text, p_coverage_date date, p_records jsonb, p_actor_id uuid,
  p_member_resolutions jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  r jsonb;
  g jsonb;
  old_claim "MyanmarClaimSystem".mcs_claims%ROWTYPE;
  claim_key text;
  v_group_key text;
  expected jsonb;
  existing_member bigint;
  selected_member bigint;
  existing_group_member bigint;
  v_requested_member bigint;
  decision text;
  v_inserted integer := 0;
  v_updated integer := 0;
  v_unchanged integer := 0;
  v_new_members integer := 0;
  v_role text;
  v_active boolean;
  v_now timestamp := now()::timestamp;
  v_different boolean;
  v_actual_status text;
  v_ids bigint[];
  v_name text;
  v_dob date;
  v_gender text;
  n integer;
BEGIN
  IF p_actor_id IS NULL THEN RAISE EXCEPTION 'Actor required'; END IF;
  SELECT role::text, active INTO v_role, v_active FROM public.profiles WHERE user_id = p_actor_id;
  IF NOT coalesce(v_active,false) OR lower(coalesce(v_role,'')) <> 'admin' THEN
    RAISE EXCEPTION 'Administrator access required';
  END IF;
  IF nullif(btrim(p_version),'') IS NULL OR p_coverage_date IS NULL
     OR jsonb_typeof(p_records) IS DISTINCT FROM 'array'
     OR jsonb_typeof(p_member_resolutions) IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_records) NOT BETWEEN 1 AND 10000
     OR jsonb_array_length(p_member_resolutions) NOT BETWEEN 1 AND 10000
  THEN RAISE EXCEPTION 'Invalid sync request'; END IF;

  -- Serialize sync operations and prevent unrelated updates to claims/members
  -- during validation and assignment.
  PERFORM pg_catalog.pg_advisory_xact_lock(9032026, 1);
  LOCK TABLE "MyanmarClaimSystem".mcs_claims IN SHARE ROW EXCLUSIVE MODE;
  LOCK TABLE "MyanmarClaimSystem".mcs_members IN SHARE ROW EXCLUSIVE MODE;

  CREATE TEMP TABLE pg_temp.sync_groups (
    group_key text PRIMARY KEY,
    action text NOT NULL,
    requested_member bigint,
    resolved_member bigint
  ) ON COMMIT DROP;

  FOR g IN SELECT value FROM pg_catalog.jsonb_array_elements(p_member_resolutions) LOOP
    v_group_key := nullif(btrim(g->>'groupKey'), '');
    decision := g->>'action';
    IF v_group_key IS NULL OR decision NOT IN ('EXISTING', 'CREATE_NEW') THEN
      RAISE EXCEPTION 'Invalid member resolution';
    END IF;
    IF decision = 'EXISTING' THEN
      IF coalesce(g->>'memberId','') !~ '^[1-9][0-9]*$' THEN
        RAISE EXCEPTION 'Existing Member ID required for group %', v_group_key;
      END IF;
      v_requested_member := (g->>'memberId')::bigint;
    ELSE
      IF g->>'memberId' IS NOT NULL THEN
        RAISE EXCEPTION 'New member must not have an existing Member ID';
      END IF;
      v_requested_member := NULL;
    END IF;
    INSERT INTO pg_temp.sync_groups(group_key, action, requested_member)
    VALUES (v_group_key, decision, v_requested_member);
  END LOOP;

  CREATE TEMP TABLE pg_temp.sync_claims (
    claim_no text PRIMARY KEY,
    group_key text NOT NULL REFERENCES pg_temp.sync_groups(group_key),
    incoming jsonb NOT NULL,
    existing_member bigint,
    status text NOT NULL
  ) ON COMMIT DROP;

  -- Pass 1: verify exact preview classifications, baselines, and claim relationships.
  FOR r IN SELECT value FROM pg_catalog.jsonb_array_elements(p_records) LOOP
    claim_key := nullif(btrim(r->>'claimNo'), '');
    v_group_key := nullif(btrim(r->>'groupKey'), '');
    IF claim_key IS NULL OR v_group_key IS NULL OR NOT EXISTS
       (SELECT 1 FROM pg_temp.sync_groups WHERE group_key = v_group_key) THEN
      RAISE EXCEPTION 'Claim number or member group is missing';
    END IF;
    IF r->>'_status' NOT IN ('NEW_RECORD','EXISTING_UPDATE','UNCHANGED') THEN
      RAISE EXCEPTION 'Invalid preview classification for claim %', claim_key;
    END IF;
    IF nullif(btrim(r->>'clientName'),'') IS NULL OR nullif(btrim(r->>'gender'),'') IS NULL THEN
      RAISE EXCEPTION 'Member name/gender missing: %', claim_key;
    END IF;
    IF r->>'dateOfBirth' IS NOT NULL AND (r->>'dateOfBirth') !~ '^\d{4}-\d{2}-\d{2}$' THEN
      RAISE EXCEPTION 'Invalid DOB: %', claim_key;
    END IF;
    IF r->>'incidentDate' IS NOT NULL AND (r->>'incidentDate') !~ '^\d{4}-\d{2}-\d{2}$' THEN
      RAISE EXCEPTION 'Invalid incident date: %', claim_key;
    END IF;
    SELECT * INTO old_claim FROM "MyanmarClaimSystem".mcs_claims WHERE claim_no = claim_key FOR UPDATE;
    IF FOUND THEN
      IF r->>'_status' = 'NEW_RECORD' OR old_claim.member_id IS NULL THEN
        RAISE EXCEPTION 'Existing claim membership changed or missing: %', claim_key;
      END IF;
      expected := r->'_existingValues';
      IF expected IS NULL OR pg_catalog.jsonb_typeof(expected) <> 'object' THEN
        RAISE EXCEPTION 'Missing preview baseline: %', claim_key;
      END IF;
      IF old_claim.member_id IS DISTINCT FROM nullif(expected->>'member_id','')::bigint
       OR lower(pg_catalog.regexp_replace(btrim(coalesce(old_claim.client_name,'')), '\s+', ' ', 'g')) IS DISTINCT FROM lower(pg_catalog.regexp_replace(btrim(coalesce(expected->>'client_name','')), '\s+', ' ', 'g'))
       OR old_claim.date_of_birth IS DISTINCT FROM nullif(expected->>'date_of_birth','')::date
       OR lower(pg_catalog.regexp_replace(btrim(coalesce(old_claim.gender,'')), '\s+', ' ', 'g')) IS DISTINCT FROM lower(pg_catalog.regexp_replace(btrim(coalesce(expected->>'gender','')), '\s+', ' ', 'g'))
       OR old_claim.incident_date IS DISTINCT FROM nullif(expected->>'incident_date','')::date
       OR lower(pg_catalog.regexp_replace(btrim(coalesce(old_claim.description,'')), '\s+', ' ', 'g')) IS DISTINCT FROM lower(pg_catalog.regexp_replace(btrim(coalesce(expected->>'description','')), '\s+', ' ', 'g'))
      THEN RAISE EXCEPTION 'Stale preview: %', claim_key; END IF;
      v_different :=
          lower(pg_catalog.regexp_replace(btrim(coalesce(old_claim.client_name,'')), '\s+', ' ', 'g')) IS DISTINCT FROM lower(pg_catalog.regexp_replace(btrim(coalesce(r->>'clientName','')), '\s+', ' ', 'g'))
       OR old_claim.date_of_birth IS DISTINCT FROM nullif(r->>'dateOfBirth','')::date
       OR lower(pg_catalog.regexp_replace(btrim(coalesce(old_claim.gender,'')), '\s+', ' ', 'g')) IS DISTINCT FROM lower(pg_catalog.regexp_replace(btrim(coalesce(r->>'gender','')), '\s+', ' ', 'g'))
       OR old_claim.incident_date IS DISTINCT FROM nullif(r->>'incidentDate','')::date
       OR lower(pg_catalog.regexp_replace(btrim(coalesce(old_claim.description,'')), '\s+', ' ', 'g')) IS DISTINCT FROM lower(pg_catalog.regexp_replace(btrim(coalesce(r->>'description','')), '\s+', ' ', 'g'));
      v_actual_status := CASE WHEN v_different THEN 'EXISTING_UPDATE' ELSE 'UNCHANGED' END;
      IF v_actual_status <> r->>'_status' THEN
        RAISE EXCEPTION 'Preview classification changed: %', claim_key;
      END IF;
      existing_member := old_claim.member_id;
    ELSE
      IF r->>'_status' <> 'NEW_RECORD' THEN
        RAISE EXCEPTION 'Claim disappeared after preview: %', claim_key;
      END IF;
      existing_member := NULL;
    END IF;
    INSERT INTO pg_temp.sync_claims(claim_no,group_key,incoming,existing_member,status)
    VALUES (claim_key,v_group_key,r,existing_member,r->>'_status');
  END LOOP;

  -- Every submitted member group must have records.
  IF EXISTS (SELECT 1 FROM pg_temp.sync_groups g WHERE NOT EXISTS
    (SELECT 1 FROM pg_temp.sync_claims c WHERE c.group_key=g.group_key)) THEN
    RAISE EXCEPTION 'Member resolution without claims';
  END IF;

  -- A single Excel group must not contain claims from two permanent members.
  FOR g IN SELECT pg_catalog.to_jsonb(t) FROM
    (SELECT group_key FROM pg_temp.sync_groups) t LOOP
    v_group_key := g->>'group_key';
    SELECT pg_catalog.array_agg(DISTINCT existing_member) FILTER (WHERE existing_member IS NOT NULL)
      INTO v_ids FROM pg_temp.sync_claims WHERE sync_claims.group_key = v_group_key;
    IF coalesce(pg_catalog.array_length(v_ids,1),0) > 1 THEN
      RAISE EXCEPTION 'Multiple permanent members in Excel group %', v_group_key;
    END IF;
    SELECT action, requested_member INTO decision, v_requested_member
      FROM pg_temp.sync_groups WHERE sync_groups.group_key = v_group_key;
    existing_group_member := v_ids[1];
    IF existing_group_member IS NOT NULL THEN
      IF decision <> 'EXISTING' OR v_requested_member IS DISTINCT FROM existing_group_member THEN
        RAISE EXCEPTION 'Attempt to reassign existing claims in group %', v_group_key;
      END IF;
      selected_member := existing_group_member;
    ELSIF decision = 'EXISTING' THEN
      IF NOT EXISTS (SELECT 1 FROM "MyanmarClaimSystem".mcs_members WHERE id=v_requested_member) THEN
        RAISE EXCEPTION 'Unknown permanent Member ID %', v_requested_member;
      END IF;
      selected_member := v_requested_member;
    ELSE
      -- Explicit administrator choice to create a distinct member.
      -- Never infer identity from matching demographic data alone.
      SELECT r.incoming->>'clientName', nullif(r.incoming->>'dateOfBirth','')::date,
             r.incoming->>'gender' INTO v_name,v_dob,v_gender
      FROM pg_temp.sync_claims r WHERE r.group_key=v_group_key LIMIT 1;
      INSERT INTO "MyanmarClaimSystem".mcs_members(client_name,date_of_birth,gender)
      VALUES(v_name,v_dob,v_gender) RETURNING id INTO selected_member;
      v_new_members := v_new_members + 1;
    END IF;
    UPDATE pg_temp.sync_groups SET resolved_member=selected_member WHERE sync_groups.group_key=v_group_key;
  END LOOP;

  -- Pass 2: apply writes only after all membership validations have passed.
  FOR r IN SELECT incoming || pg_catalog.jsonb_build_object('_resolvedMemberId',g.resolved_member)
      FROM pg_temp.sync_claims c JOIN pg_temp.sync_groups g ON g.group_key=c.group_key LOOP
    IF r->>'_status' = 'NEW_RECORD' THEN
      INSERT INTO "MyanmarClaimSystem".mcs_claims
        (claim_no,client_name,date_of_birth,gender,incident_date,description,claim_status,claim_type,createddatetime,member_id)
      VALUES
        (btrim(r->>'claimNo'),r->>'clientName',nullif(r->>'dateOfBirth','')::date,
         r->>'gender',nullif(r->>'incidentDate','')::date,r->>'description',
         'Active','Historical Import',v_now,(r->>'_resolvedMemberId')::bigint);
      v_inserted := v_inserted + 1;
    ELSIF r->>'_status' = 'EXISTING_UPDATE' THEN
      UPDATE "MyanmarClaimSystem".mcs_claims SET
        client_name=r->>'clientName',date_of_birth=nullif(r->>'dateOfBirth','')::date,
        gender=r->>'gender',incident_date=nullif(r->>'incidentDate','')::date,
        description=r->>'description',modifieddatetime=v_now,modifiedbyuser=p_actor_id::text
      WHERE claim_no=btrim(r->>'claimNo') AND member_id=(r->>'_resolvedMemberId')::bigint;
      GET DIAGNOSTICS n = ROW_COUNT;
      IF n <> 1 THEN RAISE EXCEPTION 'Member relationship changed while updating claim'; END IF;
      v_updated := v_updated + 1;
    ELSE
      v_unchanged := v_unchanged + 1;
    END IF;
  END LOOP;

  IF v_inserted+v_updated = 0 THEN RAISE EXCEPTION 'No changed claims to synchronize'; END IF;
  UPDATE "MyanmarClaimSystem".mcs_database_sync_history SET status='Archived' WHERE status='Active';
  INSERT INTO "MyanmarClaimSystem".mcs_database_sync_history
    (version,coverage_date,status,method,updated_by,createddatetime)
  VALUES(btrim(p_version),p_coverage_date,'Active',
    pg_catalog.format('Controlled member sync: %s new, %s updated, %s unchanged; %s members created',
      v_inserted,v_updated,v_unchanged,v_new_members),p_actor_id::text,v_now);
  RETURN pg_catalog.jsonb_build_object('insertedCount',v_inserted,'updatedCount',v_updated,
    'unchangedCount',v_unchanged,'membersCreated',v_new_members,
    'submittedCount',pg_catalog.jsonb_array_length(p_records));
END;
$function$;

-- Prevent old callers from inserting unlinked claims through the four-argument function.
REVOKE EXECUTE ON FUNCTION "MyanmarClaimSystem".apply_claims_sync(text,date,jsonb,uuid)
  FROM PUBLIC, anon, authenticated, service_role;
-- Only the server service role is allowed to call the new function.
REVOKE ALL ON FUNCTION "MyanmarClaimSystem".apply_claims_sync(text,date,jsonb,uuid,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "MyanmarClaimSystem".apply_claims_sync(text,date,jsonb,uuid,jsonb) TO service_role;
COMMIT;

NOTIFY pgrst, 'reload schema';
