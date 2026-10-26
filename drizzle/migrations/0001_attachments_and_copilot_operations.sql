CREATE TABLE public.attachments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL DEFAULT auth.uid(),
 note_id uuid REFERENCES public.notes(id) ON DELETE CASCADE,
 task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
 name text NOT NULL, path text NOT NULL, mime_type text NOT NULL, size bigint NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT attachment_parent CHECK ((note_id IS NOT NULL)::int + (task_id IS NOT NULL)::int = 1)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attachments TO authenticated;
GRANT ALL ON public.attachments TO service_role;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own attachments" ON public.attachments FOR ALL TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid() AND path LIKE auth.uid()::text || '/%' AND
 (note_id IS NULL OR EXISTS (SELECT 1 FROM public.notes n WHERE n.id = note_id AND n.user_id = auth.uid())) AND
 (task_id IS NULL OR EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND t.user_id = auth.uid())));
CREATE POLICY "attachment files" ON storage.objects FOR ALL TO authenticated USING (bucket_id = 'attachments' AND (storage.foldername(name))[1] = auth.uid()::text) WITH CHECK (bucket_id = 'attachments' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE TABLE public.copilot_operations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL DEFAULT auth.uid(), conversation_id uuid NOT NULL,
 entity text NOT NULL CHECK (entity IN ('tasks','notes','task_lists','goals','attachments')),
 action text NOT NULL CHECK (action IN ('create','update','delete')),
 record_id uuid, changes jsonb NOT NULL DEFAULT '{}', before_record jsonb,
 summary text NOT NULL, status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','succeeded','cancelled')),
 result jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.copilot_operations TO authenticated;
GRANT ALL ON public.copilot_operations TO service_role;
ALTER TABLE public.copilot_operations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own operations" ON public.copilot_operations FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE FUNCTION public.execute_copilot_operation(operation_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE op public.copilot_operations; current_record jsonb; output_record jsonb; assignments text; allowed text[]; key text; new_id uuid := gen_random_uuid(); defaults jsonb;
BEGIN
 SELECT * INTO op FROM public.copilot_operations WHERE id = operation_id AND user_id = auth.uid() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Opération introuvable'; END IF;
 IF op.status = 'succeeded' THEN RETURN op.result; END IF;
 IF op.status <> 'pending' OR op.created_at < now() - interval '1 hour' THEN RAISE EXCEPTION 'Opération annulée ou expirée'; END IF;
 allowed := CASE op.entity WHEN 'tasks' THEN ARRAY['title','due_at','tag','list_id','done','completed_at'] WHEN 'notes' THEN ARRAY['content','tasks_extracted'] WHEN 'task_lists' THEN ARRAY['name'] WHEN 'goals' THEN ARRAY['title','progress'] ELSE ARRAY[]::text[] END;
 FOR key IN SELECT jsonb_object_keys(op.changes) LOOP
  IF NOT key = ANY(allowed) THEN RAISE EXCEPTION 'Champ non autorisé'; END IF;
 END LOOP;
 IF op.entity = 'attachments' AND op.action <> 'delete' THEN RAISE EXCEPTION 'Action non autorisée'; END IF;
 IF op.entity = 'goals' AND op.changes ? 'progress' AND ((op.changes->>'progress')::int < 0 OR (op.changes->>'progress')::int > 100) THEN RAISE EXCEPTION 'Progression invalide'; END IF;
 IF op.entity = 'tasks' AND op.changes->>'list_id' IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.task_lists WHERE id = (op.changes->>'list_id')::uuid AND user_id = auth.uid()) THEN RAISE EXCEPTION 'Liste inaccessible'; END IF;
 IF op.action <> 'create' THEN
  EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE id = $1 AND user_id = $2 FOR UPDATE', op.entity) INTO current_record USING op.record_id, auth.uid();
  IF current_record IS NULL THEN RAISE EXCEPTION 'Élément introuvable'; END IF;
  IF current_record IS DISTINCT FROM op.before_record THEN RAISE EXCEPTION 'Élément modifié depuis la proposition : demandez une nouvelle proposition'; END IF;
  IF op.entity = 'task_lists' AND current_record->>'is_default' = 'true' AND op.action = 'delete' THEN RAISE EXCEPTION 'La liste par défaut ne peut pas être supprimée'; END IF;
 END IF;
 IF op.entity = 'tasks' AND op.changes ? 'done' THEN
  op.changes := op.changes || jsonb_build_object('completed_at', CASE WHEN (op.changes->>'done')::boolean THEN to_jsonb(now()) ELSE 'null'::jsonb END);
 END IF;
 IF op.action = 'delete' THEN
  EXECUTE format('DELETE FROM public.%I WHERE id = $1 AND user_id = $2', op.entity) USING op.record_id, auth.uid();
  output_record := current_record;
 ELSIF op.action = 'update' THEN
  SELECT string_agg(format('%I = (jsonb_populate_record(NULL::public.%I, $1)).%I', k, op.entity, k), ', ') INTO assignments FROM jsonb_object_keys(op.changes) k;
  IF assignments IS NULL THEN RAISE EXCEPTION 'Aucune modification'; END IF;
  EXECUTE format('UPDATE public.%I t SET %s WHERE id = $2 AND user_id = $3 RETURNING to_jsonb(t)', op.entity, assignments) INTO output_record USING op.changes, op.record_id, auth.uid();
 ELSE
  defaults := jsonb_build_object('id',new_id,'user_id',auth.uid(),'created_at',now());
  CASE op.entity
   WHEN 'tasks' THEN defaults := defaults || '{"done":false,"completed_at":null,"due_at":null,"list_id":null,"tag":"Personnel","source":"voice"}'::jsonb;
   WHEN 'notes' THEN defaults := defaults || '{"tasks_extracted":0}'::jsonb;
   WHEN 'task_lists' THEN defaults := defaults || '{"is_default":false}'::jsonb;
   WHEN 'goals' THEN defaults := defaults || '{"progress":0}'::jsonb;
   ELSE RAISE EXCEPTION 'Création non autorisée';
  END CASE;
  EXECUTE format('INSERT INTO public.%I SELECT (jsonb_populate_record(NULL::public.%I, $1)).* RETURNING to_jsonb(%I)', op.entity, op.entity, op.entity) INTO output_record USING defaults || op.changes;
 END IF;
 UPDATE public.copilot_operations SET status = 'succeeded', result = output_record WHERE id = operation_id;
 RETURN output_record;
END $$;
REVOKE ALL ON FUNCTION public.execute_copilot_operation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.execute_copilot_operation(uuid) TO authenticated;
