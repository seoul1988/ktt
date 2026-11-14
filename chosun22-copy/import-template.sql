-- Run ONLY in BAPCARRY project miskaxvfipywmlvxelrs after copying media.
-- Imports Chosun Ok (22) menus, options, sections and website settings.
-- Leaves payments, owners, domains, orders and website publication unchanged.
BEGIN;
SET LOCAL statement_timeout = '180s';
LOCK TABLE public.businesses, public.business_menu_categories, public.business_menu_items,
 public.business_menu_option_groups, public.business_menu_option_items, public.business_sections
 IN SHARE ROW EXCLUSIVE MODE;
CREATE TEMP TABLE bap22_payload(data jsonb) ON COMMIT DROP;
INSERT INTO bap22_payload VALUES ($bap22$__PAYLOAD_JSON__$bap22$::jsonb);
CREATE TEMP TABLE bap22_id_map(kind text, old_id bigint, new_id bigint, PRIMARY KEY(kind, old_id)) ON COMMIT DROP;
CREATE OR REPLACE FUNCTION pg_temp.bap22_insert(tn text, row_data jsonb) RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE cols text; result_id bigint; BEGIN
 SELECT string_agg(format('%I', k), ', ' ORDER BY k) INTO cols
 FROM jsonb_object_keys(row_data - 'id') k
 JOIN information_schema.columns c ON c.table_schema='public' AND c.table_name=tn AND c.column_name=k
 WHERE c.is_generated='NEVER';
 IF cols IS NULL THEN RAISE EXCEPTION 'No matching columns: %',tn; END IF;
 EXECUTE format('INSERT INTO public.%I (%s) SELECT %s FROM jsonb_populate_record(NULL::public.%I,$1) RETURNING id',tn,cols,cols,tn)
 INTO result_id USING row_data;
 RETURN result_id;
END $$;
DO $$
DECLARE p jsonb; r jsonb; tn text; sn text; mx bigint; lv bigint; new_id bigint; category_id bigint; item_id bigint; group_id bigint;
BEGIN
 SELECT data INTO p FROM bap22_payload;
 IF NOT EXISTS (SELECT 1 FROM public.businesses WHERE id=22 AND name='Chosun Ok') THEN
  RAISE EXCEPTION 'Target business 22 must be Chosun Ok';
 END IF;
 -- The supplied BAPCARRY snapshot was empty. Abort if someone added content meanwhile.
 FOREACH tn IN ARRAY ARRAY['business_menu_categories','business_menu_items','business_menu_option_groups','business_menu_option_items','business_sections','menu_option_groups'] LOOP
  EXECUTE format('SELECT count(*) FROM public.%I WHERE business_id=22',tn) INTO mx;
  IF mx<>0 THEN RAISE EXCEPTION 'Business 22 now has rows in %. Import cancelled; request a refreshed overwrite package.',tn; END IF;
 END LOOP;
 IF jsonb_array_length(p->'items')<>113 OR jsonb_array_length(p->'sections')<>6 THEN
  RAISE EXCEPTION 'Incomplete source data';
 END IF;
 -- Bring identity sequences forward, without reusing IDs or touching other restaurants.
 FOREACH tn IN ARRAY ARRAY['business_menu_categories','business_menu_items','business_menu_option_groups','business_menu_option_items','business_sections'] LOOP
  sn := pg_get_serial_sequence('public.'||quote_ident(tn),'id');
  IF sn IS NULL THEN RAISE EXCEPTION 'Missing id sequence: %',tn; END IF;
  EXECUTE format('SELECT max(id) FROM public.%I',tn) INTO mx;
  EXECUTE format('SELECT last_value FROM %s',sn) INTO lv;
  PERFORM setval(sn::regclass,greatest(coalesce(mx,0),lv,1),true);
 END LOOP;
 FOR r IN SELECT value FROM jsonb_array_elements(p->'categories') LOOP
  new_id:=pg_temp.bap22_insert('business_menu_categories',r||jsonb_build_object('business_id',22));
  INSERT INTO bap22_id_map VALUES ('category',(r->>'id')::bigint,new_id);
 END LOOP;
 FOR r IN SELECT value FROM jsonb_array_elements(p->'items') LOOP
  category_id:=NULL;
  IF r->>'category_id' IS NOT NULL THEN
   SELECT m.new_id INTO STRICT category_id FROM bap22_id_map m WHERE kind='category' AND old_id=(r->>'category_id')::bigint;
  END IF;
  new_id:=pg_temp.bap22_insert('business_menu_items',r||jsonb_build_object('business_id',22,'category_id',category_id));
  INSERT INTO bap22_id_map VALUES ('item',(r->>'id')::bigint,new_id);
 END LOOP;
 FOR r IN SELECT value FROM jsonb_array_elements(p->'option_groups') LOOP
  SELECT m.new_id INTO STRICT item_id FROM bap22_id_map m WHERE kind='item' AND old_id=(r->>'menu_item_id')::bigint;
  new_id:=pg_temp.bap22_insert('business_menu_option_groups',r||jsonb_build_object('business_id',22,'menu_item_id',item_id));
  INSERT INTO bap22_id_map VALUES ('group',(r->>'id')::bigint,new_id);
 END LOOP;
 FOR r IN SELECT value FROM jsonb_array_elements(p->'option_items') LOOP
  SELECT m.new_id INTO STRICT group_id FROM bap22_id_map m WHERE kind='group' AND old_id=(r->>'option_group_id')::bigint;
  new_id:=pg_temp.bap22_insert('business_menu_option_items',r||jsonb_build_object('business_id',22,'option_group_id',group_id));
 END LOOP;
 FOR r IN SELECT value FROM jsonb_array_elements(p->'sections') LOOP
  new_id:=pg_temp.bap22_insert('business_sections',r||jsonb_build_object('business_id',22));
 END LOOP;
 UPDATE public.businesses SET website_settings=p->'business'->'website_settings',
  template_key=p->'business'->>'template_key' WHERE id=22;
 IF (SELECT count(*) FROM public.business_menu_items WHERE business_id=22)<>113 OR
    (SELECT count(*) FROM public.business_menu_categories WHERE business_id=22)<>15 OR
    (SELECT count(*) FROM public.business_menu_option_groups WHERE business_id=22)<>2 OR
    (SELECT count(*) FROM public.business_menu_option_items WHERE business_id=22)<>7 OR
    (SELECT count(*) FROM public.business_sections WHERE business_id=22)<>6 THEN
  RAISE EXCEPTION 'Final count verification failed';
 END IF;
END $$;
SELECT 'Chosun Ok 22 imported' AS result,
 (SELECT count(*) FROM business_menu_items WHERE business_id=22) AS menus,
 (SELECT count(*) FROM business_menu_categories WHERE business_id=22) AS categories,
 (SELECT count(*) FROM business_sections WHERE business_id=22) AS layers;
COMMIT;
