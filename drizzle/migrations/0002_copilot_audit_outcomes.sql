CREATE TABLE public.assistant_activity (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, operation_id uuid, conversation_id uuid,
 kind text NOT NULL, status text NOT NULL, summary text NOT NULL, details jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
GRANT SELECT ON public.assistant_activity TO authenticated;
GRANT ALL ON public.assistant_activity TO service_role;
ALTER TABLE public.assistant_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads assistant activity" ON public.assistant_activity FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE INDEX assistant_activity_owner_time ON public.assistant_activity(user_id, created_at DESC);
ALTER PUBLICATION supabase_realtime ADD TABLE public.assistant_activity;
ALTER PUBLICATION supabase_realtime ADD TABLE public.copilot_operations;
CREATE FUNCTION public.audit_copilot_operation() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
 INSERT INTO public.assistant_activity(user_id,operation_id,conversation_id,kind,status,summary,details) VALUES
 (NEW.user_id,NEW.id,NEW.conversation_id,NEW.action,NEW.status,NEW.summary,jsonb_build_object('entity',NEW.entity,'record_id',NEW.record_id,'changes',NEW.changes,'before',NEW.before_record,'result',NEW.result));
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER copilot_operation_audit AFTER INSERT OR UPDATE ON public.copilot_operations FOR EACH ROW EXECUTE FUNCTION public.audit_copilot_operation();
CREATE FUNCTION public.guard_copilot_outcome() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF current_user = 'authenticated' AND (NEW.status = 'succeeded' OR NEW.result IS DISTINCT FROM OLD.result OR OLD.status <> 'pending') THEN RAISE EXCEPTION 'Le résultat ne peut être écrit que par une exécution vérifiée'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_copilot_outcome BEFORE UPDATE ON public.copilot_operations FOR EACH ROW EXECUTE FUNCTION public.guard_copilot_outcome();
REVOKE EXECUTE ON FUNCTION public.execute_copilot_operation(uuid) FROM authenticated;
CREATE FUNCTION public.run_audited_copilot_operation(operation_id uuid, confirmed boolean) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE op public.copilot_operations; output jsonb; failure text;
BEGIN
 SELECT * INTO op FROM public.copilot_operations WHERE id = operation_id AND user_id = auth.uid() FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('status','failed','message','Opération introuvable ou inaccessible. Aucune action exécutée.'); END IF;
 IF op.status = 'succeeded' THEN RETURN jsonb_build_object('status','succeeded','result',op.result,'message','Action déjà exécutée avec succès.'); END IF;
 IF op.status <> 'pending' THEN RETURN jsonb_build_object('status','failed','message','Opération annulée : aucune nouvelle action exécutée.'); END IF;
 IF NOT confirmed THEN
 UPDATE public.copilot_operations SET status = 'cancelled' WHERE id = op.id;
 RETURN jsonb_build_object('status','cancelled','message','Action annulée. Aucune modification exécutée.');
 END IF;
 INSERT INTO public.assistant_activity(user_id,operation_id,conversation_id,kind,status,summary,details) VALUES (op.user_id,op.id,op.conversation_id,op.action,'running',op.summary,jsonb_build_object('entity',op.entity,'changes',op.changes));
 BEGIN
 output := public.execute_copilot_operation(op.id);
 IF output IS NULL THEN RAISE EXCEPTION 'Aucun résultat enregistré'; END IF;
 RETURN jsonb_build_object('status','succeeded','result',output,'message','Action exécutée et enregistrée avec succès.');
 EXCEPTION WHEN OTHERS THEN
 GET STACKED DIAGNOSTICS failure = MESSAGE_TEXT;
 UPDATE public.copilot_operations SET status = 'cancelled' WHERE id = op.id;
 INSERT INTO public.assistant_activity(user_id,operation_id,conversation_id,kind,status,summary,details) VALUES (op.user_id,op.id,op.conversation_id,op.action,'failed',op.summary,jsonb_build_object('entity',op.entity,'changes',op.changes,'error',failure,'executed',false));
 RETURN jsonb_build_object('status','failed','message','Action non exécutée : ' || failure,'result',NULL);
 END;
END $$;
REVOKE ALL ON FUNCTION public.run_audited_copilot_operation(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.run_audited_copilot_operation(uuid,boolean) TO authenticated;
CREATE FUNCTION public.log_assistant_event(event_kind text, event_status text, event_summary text, event_details jsonb, conversation uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Connexion requise'; END IF;
 IF event_kind NOT IN ('read_data','read_attachment','request','proposal_error','speech') OR event_status NOT IN ('started','completed','failed') THEN RAISE EXCEPTION 'Événement invalide'; END IF;
 INSERT INTO public.assistant_activity(user_id,conversation_id,kind,status,summary,details) VALUES(auth.uid(),conversation,event_kind,event_status,left(event_summary,1000),event_details);
END $$;
REVOKE ALL ON FUNCTION public.log_assistant_event(text,text,text,jsonb,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.log_assistant_event(text,text,text,jsonb,uuid) TO authenticated;